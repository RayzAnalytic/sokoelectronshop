# authentication/serializers.py
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from dj_rest_auth.registration.serializers import RegisterSerializer
from django.contrib.auth import get_user_model
from phonenumber_field.serializerfields import PhoneNumberField

User = get_user_model()


class CustomRegisterSerializer(RegisterSerializer):
    full_name = serializers.CharField(required=True, max_length=255)
    phone = PhoneNumberField(required=True, region="KE")
    terms_accepted = serializers.BooleanField(required=True)

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError(
                "You must accept the terms and conditions."
            )
        return value

    def validate_email(self, email):
        email = email.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return email

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data.update({
            "full_name": self.validated_data.get("full_name", ""),
            "phone_number": self.validated_data.get("phone"),
            "terms_accepted": self.validated_data.get("terms_accepted", False),
        })
        return data

    def custom_signup(self, request, user):
        user.full_name = self.validated_data.get("full_name", "")
        user.phone_number = self.validated_data.get("phone")
        user.terms_accepted = self.validated_data.get("terms_accepted", False)
        if not user.username:
            user.username = user.email.split("@")[0]
        user.save()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "phone_number",
            "is_staff",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined", "is_staff"]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Adds user payload to the login response.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data