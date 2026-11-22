import logging

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone
from django.utils.html import escape
from rest_framework import serializers
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    EmailVerificationCode,
    PasswordResetToken,
    Role,
    Status,
    UserInvite,
)

User = get_user_model()
logger = logging.getLogger(__name__)

GENERIC_LOGIN_ERROR = "Invalid email or password."


_VERIFY_EMAIL_TEXT = """\
Hi{name},

Your verification code is:

    {code}

Enter it on the page you were just on to finish creating your account.
The code expires in {ttl_minutes} minutes.

If you didn't sign up, you can ignore this email — no account is created
without entering the code.
"""

_VERIFY_EMAIL_HTML = """\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;">
            <tr>
              <td style="padding:28px 24px 8px 24px;">
                <h1 style="margin:0 0 8px 0;font-size:18px;font-weight:600;color:#0f172a;">Verify your email</h1>
                <p style="margin:0;font-size:14px;line-height:1.5;color:#475569;">
                  Hi{name}, use the code below to finish creating your account.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px;">
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:0.35em;text-align:center;color:#0f172a;background:#f1f5f9;border-radius:6px;padding:18px 12px;">
                  {code}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">
                  This code expires in {ttl_minutes} minutes. If you didn&rsquo;t sign up, you can safely ignore this email — no account is created until the code is entered.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _send_verification_code_email(*, user, code: str, request=None) -> str | None:
    if settings.AUTH_DEV_FIXED_OTP:
        logger.info(
            "[DEV] OTP for %s is %r (email skipped — AUTH_DEV_FIXED_OTP set)",
            user.email, code,
        )
        return None

    ttl_minutes = 10

    raw_name = (user.first_name or "").strip()
    raw_name = raw_name.replace("{", "").replace("}", "")
    safe_name = escape(raw_name)

    text_body = _VERIFY_EMAIL_TEXT.format(
        name=f" {raw_name}" if raw_name else "",
        code=code,
        ttl_minutes=ttl_minutes,
    )
    html_body = _VERIFY_EMAIL_HTML.format(
        name=f" {safe_name}" if safe_name else "",
        code=code,
        ttl_minutes=ttl_minutes,
    )

    msg = EmailMultiAlternatives(
        subject=f"{code} is your verification code",
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)

    status = getattr(msg, "anymail_status", None)
    if status is not None and getattr(status, "message_id", None):
        return status.message_id
    return None


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


class LoginSerializer(serializers.Serializer):
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

        if user is None or not user.is_active:
            raise serializers.ValidationError(GENERIC_LOGIN_ERROR)

        if getattr(user, "status", None) == Status.SUSPENDED:
            raise serializers.ValidationError(
                "Your account has been suspended. Please contact support."
            )

        attrs["user"] = user
        return attrs


class CustomerRegisterSerializer(serializers.ModelSerializer):
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
            if existing.is_admin_role:
                raise ReservedEmail()

            if not existing.is_email_verified:
                raise Conflict(
                    {
                        "detail": (
                            "An account with this email already exists but "
                            "isn't verified yet. Check your inbox for the "
                            "code, or request a new one."
                        ),
                        "verify_required": True,
                    }
                )

            raise Conflict(
                "An account with this email already exists. "
                "Try signing in instead."
            )

        return email

    def validate_phone(self, value):
        phone = value.strip()

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

        temp_user = User(
            email=attrs.get("email", ""),
            phone=attrs.get("phone", ""),
        )
        try:
            validate_password(attrs["password"], user=temp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        return attrs

    def _client_ip(self) -> str | None:
        request = self.context.get("request")
        if request is None:
            return None
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        ip = self._client_ip()

        user = User.objects.create_user(
            email=validated_data["email"],
            password=password,
            phone=validated_data.get("phone", ""),
            role=Role.CUSTOMER,
            status=Status.PENDING,
            is_email_verified=False,
            is_active=True,
            is_staff=False,
            is_superuser=False,
        )

        row, code = EmailVerificationCode.issue(user, ip=ip)

        transaction.on_commit(
            lambda: self._send_verification_email(user, row, code)
        )

        return user

    def _send_verification_email(self, user, row, code: str) -> None:
        try:
            message_id = _send_verification_code_email(
                user=user,
                code=code,
                request=self.context.get("request"),
            )
        except Exception:
            logger.exception(
                "Verification email send failed for user_id=%s email=%s",
                user.pk,
                user.email,
            )
            return

        if message_id:
            try:
                EmailVerificationCode.objects.filter(pk=row.pk).update(
                    provider_message_id=message_id,
                )
            except Exception:
                logger.exception(
                    "Could not persist provider_message_id for code_id=%s", row.pk
                )


class VerifyEmailSerializer(serializers.Serializer):
    code = serializers.CharField(
        min_length=EmailVerificationCode.CODE_LENGTH,
        max_length=EmailVerificationCode.CODE_LENGTH,
        trim_whitespace=True,
        error_messages={
            "min_length": "Enter the 6-digit code from your email.",
            "max_length": "Enter the 6-digit code from your email.",
        },
    )

    def validate_code(self, value):
        cleaned = value.strip()
        if not cleaned.isdigit():
            raise serializers.ValidationError(
                "Enter the 6-digit code from your email."
            )
        return cleaned

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user

        if not user or not user.is_authenticated:
            raise serializers.ValidationError(
                "Sign in before entering your verification code."
            )

        if user.is_email_verified:
            attrs["user"] = user
            attrs["already_verified"] = True
            return attrs

        code_row = (
            EmailVerificationCode.objects
            .filter(user=user, used_at__isnull=True)
            .order_by("-created_at")
            .first()
        )

        if code_row is None:
            raise serializers.ValidationError(
                "No active verification code. Request a new one."
            )

        if code_row.is_expired:
            raise serializers.ValidationError(
                "This code has expired. Request a new one."
            )

        if code_row.is_attempts_exhausted:
            raise serializers.ValidationError(
                "Too many incorrect attempts. Request a new code."
            )

        ok = code_row.verify(attrs["code"], ip=self._client_ip())

        if not ok:
            remaining = max(
                0, EmailVerificationCode.MAX_ATTEMPTS - code_row.attempts
            )
            if remaining <= 0:
                raise serializers.ValidationError(
                    "Too many incorrect attempts. Request a new code."
                )
            raise serializers.ValidationError(
                f"Incorrect code. {remaining} attempt"
                f"{'s' if remaining != 1 else ''} remaining."
            )

        attrs["user"] = user
        attrs["already_verified"] = False
        return attrs

    def _client_ip(self) -> str | None:
        request = self.context.get("request")
        if request is None:
            return None
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")

    def save(self):
        user = self.validated_data["user"]
        if not self.validated_data.get("already_verified"):
            user.mark_email_verified()
        return user


class ResendVerificationSerializer(serializers.Serializer):
    def validate(self, attrs):
        request = self.context["request"]
        user = request.user

        if not user or not user.is_authenticated:
            raise serializers.ValidationError(
                "Sign in before requesting a new code."
            )

        if user.is_email_verified:
            attrs["user"] = user
            attrs["skipped"] = True
            return attrs

        remaining = EmailVerificationCode.seconds_until_resend_allowed(user)
        if remaining > 0:
            raise serializers.ValidationError(
                f"Please wait {remaining} second"
                f"{'s' if remaining != 1 else ''} before requesting a new code."
            )

        attrs["user"] = user
        attrs["skipped"] = False
        return attrs

    def _client_ip(self) -> str | None:
        request = self.context.get("request")
        if request is None:
            return None
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")

    def save(self):
        user = self.validated_data["user"]

        if self.validated_data.get("skipped"):
            return None

        row, code = EmailVerificationCode.issue(user, ip=self._client_ip())

        transaction.on_commit(
            lambda: self._send(user, row, code)
        )
        return row

    def _send(self, user, row, code: str) -> None:
        try:
            message_id = _send_verification_code_email(
                user=user,
                code=code,
                request=self.context.get("request"),
            )
        except Exception:
            logger.exception(
                "Verification resend failed for user_id=%s", user.pk
            )
            return

        if message_id:
            try:
                EmailVerificationCode.objects.filter(pk=row.pk).update(
                    provider_message_id=message_id,
                )
            except Exception:
                logger.exception(
                    "Could not persist provider_message_id for code_id=%s",
                    row.pk,
                )


class CustomerProfileSerializer(serializers.ModelSerializer):
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

        if phone and User.objects.phone_exists(phone):
            if phone != self.instance.phone:
                raise Conflict(
                    "This phone number is already in use on another account."
                )

        return phone


class MeSerializer(serializers.ModelSerializer):
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


class ChangePasswordSerializer(serializers.Serializer):
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
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({
                "new_password": "New password must be different from the current one.",
            })
        return attrs

    def save(self, *, request):
        user = request.user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        update_session_auth_hash(request, user)
        return user


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class VerifyResetTokenSerializer(serializers.Serializer):
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


class ResetPasswordSerializer(serializers.Serializer):
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
            raise serializers.ValidationError("Invalid or expired reset link.")

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

            now = timezone.now()
            PasswordResetToken.objects.filter(
                user=user, used_at__isnull=True,
            ).update(used_at=now)

        return user


class StaffInviteVerifySerializer(serializers.Serializer):
    token = serializers.CharField()

    def validate_token(self, value):
        try:
            invite = UserInvite.objects.select_related("invited_by").get(token=value)
        except UserInvite.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired invite.")

        if not invite.is_usable:
            raise serializers.ValidationError("This invite has expired or been used.")

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


class StaffInviteAcceptSerializer(serializers.Serializer):
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
        confirm = attrs.pop("confirm_password", "") or ""
        if confirm and confirm != attrs["password"]:
            raise serializers.ValidationError(
                {"confirm_password": ["Passwords do not match."]}
            )

        try:
            invite = UserInvite.objects.select_related("invited_by").get(
                token=attrs["token"],
            )
        except UserInvite.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired invite.")

        if not invite.is_usable:
            raise serializers.ValidationError("This invite has expired or been used.")

        if User.objects.email_exists(invite.email):
            raise Conflict(
                "An account with this email already exists. "
                "An admin can change their role in the Users page instead."
            )

        if User.objects.phone_exists(attrs["phone"]):
            raise Conflict(
                "An account with this phone number already exists."
            )

        temp_user = User(email=invite.email, phone=attrs["phone"])
        try:
            validate_password(attrs["password"], user=temp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        attrs["invite"] = invite
        return attrs

    @transaction.atomic
    def save(self):
        invite = (
            UserInvite.objects
            .select_for_update()
            .select_related("invited_by")
            .get(pk=self.validated_data["invite"].pk)
        )
        if not invite.is_usable:
            raise Gone("This invite has expired or been used.")

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


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user

        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "This account is not active."}
            )

        if getattr(user, "status", None) == Status.SUSPENDED:
            raise serializers.ValidationError(
                {"detail": "Your account has been suspended. Please contact support."}
            )

        me = dict(MeSerializer(user).data)
        if not me.get("name"):
            first = getattr(user, "first_name", "") or ""
            last = getattr(user, "last_name", "") or ""
            composed = f"{first} {last}".strip()
            me["name"] = composed or user.email or "—"

        is_admin = (
            user.is_superuser
            or user.is_staff
            or user.role in (Role.OWNER, Role.STAFF)
        )

        redirect_to = user.redirect_path or (
            "/admin" if is_admin else "/pages/account"
        )

        if is_admin and redirect_to == "/pages/account":
            redirect_to = "/admin"

        data["user"] = me
        data["redirect_to"] = redirect_to
        return data