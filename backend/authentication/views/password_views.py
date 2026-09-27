# authentication/views/password_views.py

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle
from rest_framework.views import APIView

from rest_framework_simplejwt.token_blacklist.models import (
    OutstandingToken,
    BlacklistedToken,
)

from authentication.serializers.password_serializer import (
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


# ============================================================
# THROTTLES
# ============================================================
class PasswordResetIPThrottle(AnonRateThrottle):
    scope = 'password_reset'


class PasswordResetEmailThrottle(SimpleRateThrottle):
    """Throttle by the target email so one inbox can't be spammed."""
    scope = 'password_reset_email'

    def get_cache_key(self, request, view):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return None
        return self.cache_format % {
            'scope': self.scope,
            'ident': email,
        }


class PasswordResetValidateThrottle(AnonRateThrottle):
    scope = 'password_reset_validate'


# ============================================================
# HELPERS
# ============================================================
def _build_reset_link(user):
    """
    Build the reset link.
    Uses a QUERY STRING (?token=...) so the frontend can read it with
    useSearchParams(). If you prefer a fragment (#token=...), update
    the frontend to read window.location.hash instead.
    """
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    combined = f"{uidb64}.{token}"
    frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    return f"{frontend.rstrip('/')}/auth/reset-password?token={combined}"


def _revoke_user_tokens(user):
    """Blacklist all outstanding refresh tokens for this user."""
    try:
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:
        logger.exception("Failed to revoke tokens for user_id=%s", user.pk)


# ============================================================
# REQUEST RESET
# ============================================================
class PasswordResetRequestAPIView(APIView):
    """
    Send a password reset link by email.
    Always returns 200 to avoid leaking whether an account exists.
    """
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetIPThrottle, PasswordResetEmailThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        user = User.objects.filter(email__iexact=email, is_active=True).first()

        if user:
            reset_link = _build_reset_link(user)
            subject = 'Reset your password'
            message = (
                f"Hi {user.first_name or 'there'},\n\n"
                f"We received a request to reset the password on your account.\n"
                f"Click the link below to choose a new password:\n\n"
                f"{reset_link}\n\n"
                f"If you didn't request this, you can safely ignore this email.\n"
                f"The link expires in 24 hours.\n\n"
                f"— The team"
            )
            try:
                # Prefer Celery for non-blocking delivery:
                # from authentication.tasks import send_password_reset_email
                # send_password_reset_email.delay(
                #     subject, message, settings.DEFAULT_FROM_EMAIL, user.email,
                # )
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                # Log internally, but never leak to the client
                logger.exception(
                    "Password reset email failed for user_id=%s", user.pk
                )

        return Response(
            {'detail': 'If an account exists for that email, a reset link has been sent.'},
            status=status.HTTP_200_OK,
        )


# ============================================================
# VALIDATE TOKEN (does not consume it)
# ============================================================
class PasswordResetValidateAPIView(APIView):
    """
    Check whether a reset token is valid WITHOUT consuming it.
    Used by the frontend to show the form or the 'expired' state.
    """
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetValidateThrottle]

    def get(self, request):
        token = request.query_params.get('token', '')

        if not token or '.' not in token:
            return Response(
                {'valid': False, 'detail': 'Malformed token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uidb64, token_hash = token.split('.', 1)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {'valid': False, 'detail': 'Invalid token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token_hash):
            return Response(
                {'valid': False, 'detail': 'Token expired or already used.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {'valid': True, 'email': user.email},
            status=status.HTTP_200_OK,
        )


# ============================================================
# CONFIRM RESET
# ============================================================
class PasswordResetConfirmAPIView(APIView):
    """
    Apply the new password.
    Token is invalidated automatically after use.
    All existing refresh tokens are revoked.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        user.set_password(serializer.validated_data['password'])
        user.save(update_fields=['password'])

        # Log out all other sessions
        _revoke_user_tokens(user)

        return Response(
            {'detail': 'Password reset successfully. You can now sign in.'},
            status=status.HTTP_200_OK,
        )