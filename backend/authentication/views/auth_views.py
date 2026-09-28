# authentication/views/auth_views.py

import logging

from django.contrib.auth import get_user_model

from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.serializers.auth_serializer import (
    LoginSerializer,
    RegisterSerializer,
    UserDetailSerializer,
    UserUpdateSerializer,
)
from authentication.serializers.social_serializer import GoogleLoginSerializer

User = get_user_model()
logger = logging.getLogger(__name__)


# ============================================================
# THROTTLES
# ============================================================
class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterThrottle(AnonRateThrottle):
    scope = 'register'


# ============================================================
# HELPERS
# ============================================================
def _issue_tokens(user):
    """Mint a JWT pair and return it with user details."""
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserDetailSerializer(user).data,
    }


# ============================================================
# REGISTER
# ============================================================
class RegisterAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        logger.info("New user registered: %s", user.email)

        return Response(_issue_tokens(user), status=status.HTTP_201_CREATED)


# ============================================================
# LOGIN
# ============================================================
class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)

        # LoginSerializer.validate() sets attrs['user'] after authenticate()
        user = serializer.validated_data['user']

        if not user.is_active:
            return Response(
                {'error': 'This account has been disabled.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        logger.info("User logged in: %s", user.email)

        return Response(_issue_tokens(user), status=status.HTTP_200_OK)


# ============================================================
# GOOGLE LOGIN
# ============================================================
class GoogleLoginAPIView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        created = getattr(user, '_created_via_google', False)

        logger.info(
            "Google login: %s (%s)",
            user.email,
            "new" if created else "existing",
        )

        return Response(
            _issue_tokens(user),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ============================================================
# LOGOUT
# ============================================================
class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')

        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            # Already blacklisted or invalid — logout is idempotent
            logger.info(
                "Logout: token already invalid for %s",
                request.user.email,
            )
        except Exception as exc:
            logger.warning("Logout failed to blacklist token: %s", exc)

        logger.info("User logged out: %s", request.user.email)

        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================
# ME
# ============================================================
class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        return Response(UserDetailSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserDetailSerializer(request.user).data)