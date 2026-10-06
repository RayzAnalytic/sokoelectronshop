from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException, PermissionDenied

from .models import PasswordResetToken, Role, Status, UserInvite

User = get_user_model()

GENERIC_LOGIN_ERROR = "Invalid email or password."


# ─────────────────────────────────────────────────────────────────────────────
# Custom exceptions — DRF renders these as {"detail": "..."} with the right
# status code, which is exactly what the frontend's ApiError parser expects.
# ─────────────────────────────────────────────────────────────────────────────
class Conflict(APIException):
    status_code = 409
    default_detail = "Conflict."
    default_code = "conflict"


class ReservedEmail(PermissionDenied):
    default_detail = (
        "This email is reserved for a staff/admin account. "
        "Please sign in via the admin page."
    )
    default_code = "reserved_email"


class Gone(APIException):
    status_code = 410
    default_detail = "This resource is no longer available."
    default_code = "gone"


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────
class LoginSerializer(serializers.Serializer):
    """
    Authenticates any user — customers, staff, and owners.

    Every failure returns the SAME generic message so an attacker can't
    enumerate accounts by watching the response. The status check that
    follows is the one exception: a suspended account gets a distinct
    message, because telling a suspended user "invalid credentials"
    would make them retry forever.

    The role check that used to live here rejected CUSTOMER — that
    broke customer sign-in on the storefront. Removed; the redirect
    after login is chosen by the view based on the user's role.
    """
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        password = attrs["password"]

        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        # Generic failure for bad credentials or a disabled account.
        if user is None or not user.is_active:
            raise serializers.ValidationError(GENERIC_LOGIN_ERROR)

        # A suspended account gets a specific message so the user knows
        # to contact support instead of retrying the password.
        if getattr(user, "status", None) == Status.SUSPENDED:
            raise serializers.ValidationError(
                "Your account has been suspended. Please contact support."
            )

        # Pending accounts can log in, but the frontend may want to
        # route them to a "verify your email" page. Allow it here and
        # let the view decide where to send them.
        attrs["user"] = user
        return attrs


# ─────────────────────────────────────────────────────────────────────────────
# Register (customers only)
# ─────────────────────────────────────────────────────────────────────────────
class CustomerRegisterSerializer(serializers.ModelSerializer):
    """
    Self-service sign-up for CUSTOMER accounts only.

    Role and status are forced server-side — never read from the request
    body — so a crafted POST can't create an OWNER/STAFF account.
    Admin and staff accounts are seeded out-of-band (management command,
    fixture, or admin panel) and never through this endpoint.

    `confirm_password` is accepted for defense-in-depth. The frontend
    already validates it, but the backend re-checks when it's present.

    Phone is required and unique across non-empty phones. The frontend
    enforces both; the backend re-enforces so a crafted POST can't skip
    them. The uniqueness check returns 409, matching the frontend's
    expectation for both email and phone conflicts.
    """

    email = serializers.EmailField()
    phone = serializers.CharField(
        min_length=7,
        max_length=32,
        error_messages={
            "blank": "Phone number is required.",
            "min_length": "Please enter a valid phone number.",
            "max_length": "Please enter a valid phone number.",
        },
    )
    password = serializers.CharField(
        write_only=True,
        min_length=10,
        style={"input_type": "password"},
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = ("email", "phone", "password", "confirm_password")

    def validate_email(self, value):
        email = value.strip().lower()
        existing = User.objects.filter(email__iexact=email).first()

        if existing:
            # Never let a customer grab an admin/staff email — and don't
            # leak whether it exists as a customer either. Different
            # messages so the UX is honest without being a directory.
            if existing.is_admin_role:
                raise ReservedEmail()
            raise Conflict(
                "An account with this email already exists. "
                "Try signing in instead."
            )

        return email

    def validate_phone(self, value):
        phone = value.strip()

        # Reject if any other user already has this phone. The manager
        # normalizes the phone before checking, and treats empty as
        # "not taken" — so Google-only users with blank phones don't
        # collide with each other.
        if User.objects.phone_exists(phone):
            raise Conflict(
                "An account with this phone number already exists. "
                "Try signing in instead."
            )

        return phone

    def validate(self, attrs):
        confirm = attrs.pop("confirm_password", "") or ""
        if confirm and confirm != attrs["password"]:
            raise serializers.ValidationError(
                {"confirm_password": ["Passwords do not match."]}
            )

        # Run Django's password validators (min length, common passwords,
        # numeric-only, similarity to email, etc.).
        temp_user = User(
            email=attrs.get("email", ""),
            phone=attrs.get("phone", ""),
        )
        try:
            validate_password(attrs["password"], user=temp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")

        # Use the manager so phone normalization, email lowercasing, and
        # the set_password / set_unusable_password logic all run in one
        # place. Role and status are forced here — never read from input.
        user = User.objects.create_user(
            email=validated_data["email"],
            password=password,
            phone=validated_data.get("phone", ""),
            role=Role.CUSTOMER,
            status=Status.ACTIVE,
            is_active=True,
            is_staff=False,
            is_superuser=False,
        )
        return user


# ─────────────────────────────────────────────────────────────────────────────
# Profile (customer self-service update)
# ─────────────────────────────────────────────────────────────────────────────
class CustomerProfileSerializer(serializers.ModelSerializer):
    """
    PATCH-able profile for the signed-in customer.

    Email is read-only here — changing it must go through a verify-email
    flow to prove ownership, not a free-text PATCH. Role, status, and
    flags are never writable from the client.
    """

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "whatsapp_updates",
            "email_promotions",
            "sms_promotions",
            "newsletter",
            "date_joined",
        )
        read_only_fields = ("id", "email", "date_joined")

    def validate_phone(self, value):
        phone = value.strip()

        # Allow the user to keep their current phone. Only reject if
        # a DIFFERENT user already has it.
        if phone and User.objects.phone_exists(phone):
            if phone != self.instance.phone:
                raise Conflict(
                    "This phone number is already in use on another account."
                )

        return phone


# ─────────────────────────────────────────────────────────────────────────────
# Me
# ─────────────────────────────────────────────────────────────────────────────
class MeSerializer(serializers.ModelSerializer):
    """
    Shape consumed by `api.me()` on every page mount — including the
    order-success page, which uses it to decide whether to show "Go to
    my account" or the prefilled "Sign in" prompt.

    `phone` is included so the checkout page can prefill the delivery
    contact number for signed-in customers. Without it, step 1 of
    checkout is skipped and the backend receives an empty phone, which
    the CheckoutPayloadSerializer rejects with
    `{"checkout":{"phone":["This field may not be blank."]}}`.

    `redirect_to` is the API contract the frontend reads — it maps
    to the model's `redirect_path` property. Do not rename without
    updating all four auth pages.
    """
    redirect_to = serializers.CharField(source="redirect_path", read_only=True)
    joined_at = serializers.DateTimeField(source="date_joined", read_only=True)
    default_address = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name",
            "phone",
            "role", "status", "is_email_verified", "redirect_to",
            "joined_at", "default_address",
        )

    def get_default_address(self, obj):
        """
        Return the user's default address (or their first one) in the
        shape the frontend expects. Lazy imports avoid a circular import
        with the account app, which imports User at module scope.
        """
        try:
            from account.models import Address
            from account.serializers import AddressSerializer
            addr = (
                Address.objects.filter(user=obj, is_default=True).first()
                or Address.objects.filter(user=obj).first()
            )
            return AddressSerializer(addr).data if addr else None
        except Exception:
            return None


# ─────────────────────────────────────────────────────────────────────────────
# Password change (authenticated user)
# ─────────────────────────────────────────────────────────────────────────────
class ChangePasswordSerializer(serializers.Serializer):
    """
    Change the current user's password.

    Called by POST /api/v1/auth/change-password/.

    The current password is verified against the stored hash so a
    hijacked session can't silently rotate the password. The session
    is preserved after the change via `update_session_auth_hash` —
    without it, Django would log the user out.
    """

    current_password = serializers.CharField(
        trim_whitespace=False, write_only=True,
    )
    new_password = serializers.CharField(
        trim_whitespace=False, write_only=True,
    )

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        user = self.context["request"].user
        validate_password(value, user)
        return value

    def validate(self, attrs):
        # Reject a "change" that's just the current password.
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({
                "new_password": "New password must be different from the current one.",
            })
        return attrs

    def save(self, *, request):
        user = request.user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        # Keep the current session alive after the password change.
        update_session_auth_hash(request, user)
        return user


# ─────────────────────────────────────────────────────────────────────────────
# Password reset — forgot
# ─────────────────────────────────────────────────────────────────────────────
class ForgotPasswordSerializer(serializers.Serializer):
    """
    Request a password reset link via email.

    Always returns success (the view handles that) regardless of whether
    the email matches an account — this prevents email enumeration.
    """
    email = serializers.EmailField()


# ─────────────────────────────────────────────────────────────────────────────
# Password reset — verify token
# ─────────────────────────────────────────────────────────────────────────────
class VerifyResetTokenSerializer(serializers.Serializer):
    """
    Check whether a reset token from the URL is still valid.

    Called by the frontend on mount of /auth/reset-password?token=...

    Response:
        200 → { "valid": true }
        400 → { "detail": "Invalid or expired reset link." }

    The serializer is used as a query-param validator, not a model
    serializer — the view reads `token` from `request.query_params`.
    """
    token = serializers.CharField()

    def validate_token(self, value):
        try:
            reset = PasswordResetToken.objects.get(token=value)
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired reset link.")

        if not reset.is_usable:
            raise serializers.ValidationError("Invalid or expired reset link.")

        self._reset = reset
        return value

    @property
    def reset(self):
        return getattr(self, "_reset", None)


# ─────────────────────────────────────────────────────────────────────────────
# Password reset — set new password
# ─────────────────────────────────────────────────────────────────────────────
class ResetPasswordSerializer(serializers.Serializer):
    """
    Set a new password using a one-time reset token.

    The frontend sends:
        POST /api/v1/auth/reset-password/
        { "token": "...", "new_password": "...", "confirm_password": "..." }

    Why a token-only design (no `uid` in the URL):
        Django's default_token_generator requires both a uidb64 AND a
        token in the URL. Our frontend reads only `?token=...`, so we
        store the user FK on a PasswordResetToken row and look it up
        server-side. This also avoids leaking the numeric user id in
        the email link.

    Tokens are single-use: `used_at` is stamped on success and any
    pending reset tokens for the same user are invalidated by the
    login signal (see signals.py).
    """
    token = serializers.CharField()
    new_password = serializers.CharField(trim_whitespace=False, write_only=True)
    confirm_password = serializers.CharField(
        trim_whitespace=False, write_only=True, required=False, allow_blank=True,
    )

    def validate(self, attrs):
        confirm = attrs.pop("confirm_password", "") or ""
        if confirm and confirm != attrs["new_password"]:
            raise serializers.ValidationError(
                {"confirm_password": ["Passwords do not match."]}
            )

        try:
            reset = PasswordResetToken.objects.select_related("user").get(
                token=attrs["token"],
            )
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired reset link.")

        if not reset.is_usable:
            raise serializers.ValidationError("Invalid or expired reset link.")

        user = reset.user
        if not user.is_active or user.status != Status.ACTIVE:
            # A suspended or disabled account should not be resettable.
            # Return the same generic message — do not reveal account state.
            raise serializers.ValidationError("Invalid or expired reset link.")

        # Run Django's password validators against the actual user so
        # the similarity check (password vs email) works correctly.
        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})

        attrs["user"] = user
        attrs["reset"] = reset
        return attrs

    def save(self):
        user = self.validated_data["user"]
        reset = self.validated_data["reset"]

        with transaction.atomic():
            user.set_password(self.validated_data["new_password"])
            user.save(update_fields=["password"])

            # Invalidate this token AND any other pending tokens for
            # the same user. A password change should kill every
            # outstanding key, not just the one that was used.
            now = timezone.now()
            PasswordResetToken.objects.filter(
                user=user, used_at__isnull=True,
            ).update(used_at=now)

        return user


# ─────────────────────────────────────────────────────────────────────────────
# Staff invite — verify (GET with token)
# ─────────────────────────────────────────────────────────────────────────────
class StaffInviteVerifySerializer(serializers.Serializer):
    """
    Check whether an invite token is valid before showing the accept form.

    Response shape (on success):
        {
          "valid": true,
          "email": "staff@company.com",
          "role": "STAFF",
          "invited_name": "Jane Doe",
          "invited_by": "Alex Doe"
        }

    The email is included so the frontend can display it read-only —
    the invitee cannot change it. Role is included for display only;
    the server reads it from the invite row on acceptance.
    """
    token = serializers.CharField()

    def validate_token(self, value):
        try:
            invite = UserInvite.objects.select_related("invited_by").get(token=value)
        except UserInvite.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired invite.")

        if not invite.is_usable:
            raise serializers.ValidationError("This invite has expired or been used.")

        # If a user already exists for this email, the invite is moot.
        if User.objects.email_exists(invite.email):
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        self._invite = invite
        return value

    @property
    def invite(self):
        return getattr(self, "_invite", None)

    def to_representation(self, instance):
        invite = self.invite
        if invite is None:
            return {"valid": False}
        return {
            "valid": True,
            "email": invite.email,
            "role": invite.role,
            "invited_name": invite.invited_name,
            "invited_by": (
                invite.invited_by.get_full_name() or invite.invited_by.email
                if invite.invited_by else ""
            ),
            "expires_at": invite.expires_at,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Staff invite — accept (POST)
# ─────────────────────────────────────────────────────────────────────────────
class StaffInviteAcceptSerializer(serializers.Serializer):
    """
    Accept a staff invitation.

    The client sends ONLY the token and the fields the invitee chooses
    (phone, password, display name). The email and role are read from
    the UserInvite row — the client cannot influence either.

    After acceptance:
      * invite.status = ACCEPTED
      * invite.accepted_at = now
      * invite.accepted_by = new user
      * User created via User.objects.create_staff(...)
    """
    token = serializers.CharField()
    phone = serializers.CharField(
        min_length=7,
        max_length=32,
        error_messages={
            "blank": "Phone number is required.",
            "min_length": "Please enter a valid phone number.",
            "max_length": "Please enter a valid phone number.",
        },
    )
    password = serializers.CharField(
        write_only=True,
        min_length=10,
        style={"input_type": "password"},
    )
    confirm_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        # 1. Confirm passwords match (defense in depth — frontend also checks).
        confirm = attrs.pop("confirm_password", "") or ""
        if confirm and confirm != attrs["password"]:
            raise serializers.ValidationError(
                {"confirm_password": ["Passwords do not match."]}
            )

        # 2. Validate the invite token.
        try:
            invite = UserInvite.objects.select_related("invited_by").get(
                token=attrs["token"],
            )
        except UserInvite.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired invite.")

        if not invite.is_usable:
            raise serializers.ValidationError("This invite has expired or been used.")

        # 3. Reject if a user already exists for the invited email.
        #    This can happen if the person self-registered in the interim.
        if User.objects.email_exists(invite.email):
            raise Conflict(
                "An account with this email already exists. "
                "An admin can change their role in the Users page instead."
            )

        # 4. Reject if the phone is already taken by another account.
        if User.objects.phone_exists(attrs["phone"]):
            raise Conflict(
                "An account with this phone number already exists."
            )

        # 5. Run Django's password validators. Use a temp user with the
        #    invite email so the similarity check works.
        temp_user = User(email=invite.email, phone=attrs["phone"])
        try:
            validate_password(attrs["password"], user=temp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        attrs["invite"] = invite
        return attrs

    @transaction.atomic
    def save(self):
        # Re-lock the invite inside the transaction so two simultaneous
        # clicks on the same link can't both create a user.
        invite = (
            UserInvite.objects
            .select_for_update()
            .select_related("invited_by")
            .get(pk=self.validated_data["invite"].pk)
        )
        if not invite.is_usable:
            raise Gone("This invite has expired or been used.")

        # Role comes from the invite row, NEVER from the client payload.
        user = User.objects.create_staff(
            email=invite.email,
            password=self.validated_data["password"],
            phone=self.validated_data["phone"],
            role=invite.role,
            invited_by=invite.invited_by,
            first_name=invite.invited_name.split(" ", 1)[0] if invite.invited_name else "",
            is_email_verified=True,
        )

        invite.status = UserInvite.Status.ACCEPTED
        invite.accepted_at = timezone.now()
        invite.accepted_by = user
        invite.save(update_fields=["status", "accepted_at", "accepted_by"])

        return user