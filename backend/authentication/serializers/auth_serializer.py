# authentication/serializers/auth_serializer.py

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