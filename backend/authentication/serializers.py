from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

User = get_user_model()

GENERIC_LOGIN_ERROR = "Invalid email or password."


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────
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

        # Single generic failure for every case — no enumeration, no timing hints.
        if (
            user is None
            or user.role == "CUSTOMER"
            or user.status != "ACTIVE"
            or not user.is_active
        ):
            raise serializers.ValidationError(GENERIC_LOGIN_ERROR)

        attrs["user"] = user
        return attrs


# ─────────────────────────────────────────────────────────────────────────────
# Me
# ─────────────────────────────────────────────────────────────────────────────
class MeSerializer(serializers.ModelSerializer):
    redirect_to = serializers.CharField(source="redirect_path", read_only=True)
    joined_at = serializers.DateTimeField(source="date_joined", read_only=True)
    default_address = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name",
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
# Password reset
# ─────────────────────────────────────────────────────────────────────────────
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        try:
            uid = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError("Invalid or expired reset link.")

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError("Invalid or expired reset link.")

        validate_password(attrs["new_password"], user)
        attrs["user"] = user
        return attrs

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user