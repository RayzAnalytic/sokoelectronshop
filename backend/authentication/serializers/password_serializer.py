# authentication/serializers/password_serializer.py

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from rest_framework import serializers

User = get_user_model()


# ============================================================
# PASSWORD RESET — REQUEST
# ============================================================
class PasswordResetRequestSerializer(serializers.Serializer):
    """Payload for the 'forgot password' page."""
    email = serializers.EmailField()

    def validate_email(self, value):
        # Normalize; do NOT check existence (prevents email enumeration)
        return value.strip().lower()


# ============================================================
# PASSWORD RESET — CONFIRM
# ============================================================
class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Payload for the reset-password page after the user clicks the link.
    Expected token format: '<uidb64>.<token>'
    """
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        # --- 1. Password match ---
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError(
                {'confirm_password': 'Passwords do not match.'}
            )

        # --- 2. Parse the token ---
        token = attrs['token']
        if '.' not in token:
            raise serializers.ValidationError(
                {'token': 'This reset link is invalid or malformed.'}
            )

        uidb64, token_hash = token.split('.', 1)

        # --- 3. Decode the user ID ---
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError(
                {'token': 'This reset link is invalid or has expired.'}
            )

        # --- 4. Validate the token ---
        if not default_token_generator.check_token(user, token_hash):
            raise serializers.ValidationError(
                {'token': 'This reset link has expired or already been used.'}
            )

        # --- 5. Validate the new password ---
        try:
            validate_password(attrs['password'], user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})

        attrs['user'] = user
        return attrs

    def save(self, **kwargs):
        """Persist the new password. Called by the view via serializer.save()."""
        user = self.validated_data['user']
        user.set_password(self.validated_data['password'])
        user.save(update_fields=['password'])
        return user