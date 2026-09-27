# authentication/views/social_views.py

import logging

from django.contrib.auth import get_user_model

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.serializers.auth_serializer import UserDetailSerializer
from authentication.serializers.social_serializer import GoogleLoginSerializer

User = get_user_model()
logger = logging.getLogger(__name__)


class GoogleLoginView(APIView):
    """
    Google sign-in / sign-up.

    Accepts either:
      - { id_token: "<JWT>" }        — from GSI One Tap / ID token flow
      - { access_token: "ya29..." }  — from the OAuth 2.0 token flow

    The serializer verifies the credential with Google before we
    create or retrieve the user.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        # ─────────────────────────────────────────────────────
        # TEMPORARY DEBUG — remove once Google login works
        # ─────────────────────────────────────────────────────
        logger.warning("=== Google Login Debug ===")
        logger.warning("Content-Type: %s", request.content_type)
        logger.warning("Keys received: %s", list(request.data.keys()))
        for k, v in request.data.items():
            val = str(v)
            logger.warning("  %s = %s... (len=%d)", k, val[:30], len(val))
        # ─────────────────────────────────────────────────────

        serializer = GoogleLoginSerializer(data=request.data)

        if not serializer.is_valid():
            logger.warning("Serializer errors: %s", serializer.errors)
            return Response(serializer.errors, status=400)

        google_user = serializer.validated_data['google_user']
        email = google_user['email'].strip().lower()

        # Case-insensitive lookup to avoid duplicates like
        # Test@example.com vs test@example.com
        user = User.objects.filter(email__iexact=email).first()
        created = False

        if user is None:
            # New user — create with an unusable password so they
            # can only ever sign in via Google.
            user = User.objects.create_user(
                email=email,
                password=None,
                first_name=google_user.get('given_name', ''),
                last_name=google_user.get('family_name', ''),
                role=User.Roles.CUSTOMER,
            )
            user.email_verified = True
            user.save(update_fields=['email_verified'])
            created = True
            logger.info("New user created via Google: %s", email)
        else:
            if not user.email_verified:
                user.email_verified = True
                user.save(update_fields=['email_verified'])
            logger.info("User logged in via Google: %s", email)

        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserDetailSerializer(user).data,
            'created': created,
        })