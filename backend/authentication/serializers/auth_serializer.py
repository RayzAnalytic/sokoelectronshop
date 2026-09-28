# authentication/serializers/auth_serializer.py

import requests
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

from rest_framework import serializers
from phonenumber_field.phonenumber import to_python

User = get_user_model()


# ============================================================
# USER DETAIL SERIALIZER
# ============================================================
class UserDetailSerializer(serializers.ModelSerializer):
    """
    Returned after login/register so the frontend has user info.
    Read-only — used in JWT responses and /me endpoints.
    """
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'phone_number',
            'profile_picture',
            'email_verified',
            'date_joined',
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email


# ============================================================
# USER UPDATE SERIALIZER
# ============================================================
class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Used by PATCH /api/auth/me/.
    Excludes email (changing it requires verification).
    """
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone_number', 'profile_picture']
        extra_kwargs = {
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
            'phone_number': {'required': False, 'allow_blank': True},
            'profile_picture': {'required': False, 'allow_null': True},
        }

    def validate_phone_number(self, value):
        """Allow blank, otherwise validate via phonenumber_field."""
        if not value:
            return value
        try:
            number = to_python(value.strip())
            if not number or not number.is_valid():
                raise ValueError
        except Exception:
            raise serializers.ValidationError('Enter a valid phone number.')
        return number


# ============================================================
# REGISTER SERIALIZER
# ============================================================
class RegisterSerializer(serializers.Serializer):
    """
    Matches the exact payload the Next.js register page sends:
    {
        fullName, email, phone, password, confirmPassword, termsAccepted
    }
    """
    fullName = serializers.CharField(max_length=255, write_only=True)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, write_only=True)
    password = serializers.CharField(write_only=True, min_length=8)
    confirmPassword = serializers.CharField(write_only=True)
    termsAccepted = serializers.BooleanField()

    def validate_fullName(self, value):
        value = ' '.join(value.split())
        if not value:
            raise serializers.ValidationError('Full name is required.')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                'An account with this email already exists.'
            )
        return value

    def validate_phone(self, value):
        try:
            number = to_python(value.strip())
            if not number or not number.is_valid():
                raise ValueError
        except Exception:
            raise serializers.ValidationError('Enter a valid phone number.')
        return number

    def validate(self, attrs):
        if attrs['password'] != attrs['confirmPassword']:
            raise serializers.ValidationError(
                {'confirmPassword': 'Passwords do not match.'}
            )

        if not attrs.get('termsAccepted'):
            raise serializers.ValidationError(
                {'termsAccepted': 'You must accept the terms and conditions.'}
            )

        try:
            validate_password(attrs['password'])
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})

        return attrs

    def create(self, validated_data):
        full_name = validated_data.pop('fullName')
        validated_data.pop('confirmPassword')
        validated_data.pop('termsAccepted')

        parts = full_name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''

        email = validated_data['email']

        user = User.objects.create_user(
            email=email,
            password=validated_data['password'],
            first_name=first_name,
            last_name=last_name,
            phone_number=validated_data['phone'],
            role=User.Roles.CUSTOMER,
        )

        if hasattr(user, 'terms_accepted_at'):
            user.terms_accepted_at = timezone.now()
            user.save(update_fields=['terms_accepted_at'])

        return user


# ============================================================
# LOGIN SERIALIZER
# ============================================================
class LoginSerializer(serializers.Serializer):
    """
    Used if you ever need a manual login serializer.
    If you're using dj-rest-auth's built-in login view, this may be unused.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        request = self.context.get('request')

        user = authenticate(
            request=request,
            username=attrs['email'],   # Django's fixed kwarg name
            password=attrs['password'],
        )

        if not user:
            raise serializers.ValidationError('Invalid email or password.')

        if not user.is_active:
            raise serializers.ValidationError('This account has been disabled.')

        attrs['user'] = user
        return attrs


# ============================================================
# GOOGLE LOGIN SERIALIZER — access-token flow
# ============================================================
class GoogleLoginSerializer(serializers.Serializer):
    """
    Accepts a Google OAuth *access token* (starts with 'ya29.'),
    calls Google's userinfo endpoint to fetch the profile, then
    creates/returns the local user. The view responds with JWT tokens.

    Payload:
        { "access_token": "ya29...." }
    """
    access_token = serializers.CharField(write_only=True)

    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

    def validate_access_token(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Access token is required.")
        if not value.startswith("ya29."):
            raise serializers.ValidationError(
                "This doesn't look like a Google access token."
            )
        return value

    def validate(self, attrs):
        token = attrs["access_token"]

        try:
            resp = requests.get(
                self.GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
        except requests.RequestException as exc:
            raise serializers.ValidationError({
                "access_token": f"Could not reach Google: {exc}"
            })

        if resp.status_code == 401:
            raise serializers.ValidationError({
                "access_token": "Invalid or expired Google access token."
            })
        if resp.status_code != 200:
            raise serializers.ValidationError({
                "access_token": f"Google returned {resp.status_code}."
            })

        profile = resp.json()

        email = (profile.get("email") or "").strip().lower()
        if not email:
            raise serializers.ValidationError({
                "access_token": "Google account has no email address."
            })

        # Google returns email_verified as either a bool or the string "true"
        email_verified = profile.get("email_verified")
        if email_verified in (False, "false", "False"):
            raise serializers.ValidationError({
                "access_token": "Google email is not verified."
            })

        attrs["profile"] = profile
        attrs["email"] = email
        return attrs

    def create(self, validated_data):
        profile = validated_data["profile"]
        email = validated_data["email"]

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email.split("@")[0],
                "first_name": profile.get("given_name", "") or "",
                "last_name": profile.get("family_name", "") or "",
                "role": User.Roles.CUSTOMER if hasattr(User, "Roles") else "CUSTOMER",
            },
        )

        # Refresh first/last name if they were empty
        changed_fields = []
        if not user.first_name and profile.get("given_name"):
            user.first_name = profile["given_name"]
            changed_fields.append("first_name")
        if not user.last_name and profile.get("family_name"):
            user.last_name = profile["family_name"]
            changed_fields.append("last_name")
        if changed_fields:
            user.save(update_fields=changed_fields)

        # Mark email as verified since it came from Google
        if hasattr(user, "email_verified") and not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])

        return user