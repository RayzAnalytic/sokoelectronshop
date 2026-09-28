# authentication/views.py
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from dj_rest_auth.views import LoginView, LogoutView
from dj_rest_auth.registration.views import RegisterView
from allauth.account.utils import send_email_confirmation
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings

from .serializers import (
    CustomRegisterSerializer,
    UserSerializer,
    CustomTokenObtainPairSerializer,
)

User = get_user_model()


# ─────────────────────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────────────────────
class CustomRegisterView(RegisterView):
    """
    Overrides dj-rest-auth's RegisterView to use our CustomRegisterSerializer.
    The serializer is also declared in settings.REST_AUTH, but this makes it explicit.
    """
    serializer_class = CustomRegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = self.perform_create(serializer)

        # Optionally send email confirmation if ACCOUNT_EMAIL_VERIFICATION == "mandatory"
        if getattr(settings, "ACCOUNT_EMAIL_VERIFICATION", "optional") == "mandatory":
            send_email_confirmation(request, user)

        headers = self.get_success_headers(serializer.data)

        # Issue JWT tokens immediately
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


# ─────────────────────────────────────────────────────────────
# Login / Logout
# ─────────────────────────────────────────────────────────────
class CustomLoginView(LoginView):
    """
    Overrides dj-rest-auth's LoginView to return the full user object
    alongside the JWT tokens.
    """
    def get_response(self):
        response = super().get_response()

        # Attach user data
        if hasattr(self, "user") and self.user:
            response.data["user"] = UserSerializer(self.user).data

        return response


class CustomLogoutView(LogoutView):
    """
    Blacklists the refresh token and returns a simple 200.
    Expects `{"refresh": "<token>"}` in the request body.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            # Token already blacklisted or invalid — still return success
            pass

        return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────
# Current user
# ─────────────────────────────────────────────────────────────
class MeView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/auth/me/       → returns the current user
    PATCH /api/auth/me/      → updates full_name, phone_number
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


# ─────────────────────────────────────────────────────────────
# Password reset
# ─────────────────────────────────────────────────────────────
class PasswordResetRequestView(APIView):
    """
    POST /api/auth/password-reset/
    Body: { "email": "user@example.com" }

    Always returns 200 to prevent user enumeration.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?uid={uid}&token={token}"

            send_mail(
                subject="Reset your password",
                message=f"Click the link to reset your password:\n\n{reset_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )

        return Response(
            {"detail": "If an account exists for that email, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """
    POST /api/auth/password-reset/confirm/
    Body: { "uid": "...", "token": "...", "password": "...", "confirm_password": "..." }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        password = request.data.get("password")
        confirm_password = request.data.get("confirm_password")

        if not all([uid, token, password, confirm_password]):
            return Response(
                {"detail": "uid, token, password and confirm_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password != confirm_password:
            return Response(
                {"confirm_password": ["Passwords do not match."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"token": ["Invalid reset link."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"token": ["This reset link is invalid or has expired."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save(update_fields=["password"])

        return Response(
            {"detail": "Password has been reset successfully."},
            status=status.HTTP_200_OK,
        )