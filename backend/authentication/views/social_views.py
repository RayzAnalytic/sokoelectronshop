# authentication/views/social_views.py

import logging

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from rest_framework import status
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
        # TEMPORARY DEBUG — remove before production
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
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        google_user = serializer.validated_data['google_user']
        email = google_user['email'].strip().lower()

        given_name = google_user.get('given_name', '') or ''
        family_name = google_user.get('family_name', '') or ''

        # ── Resolve default role safely ──
        # FIX 1: getattr fallback so we don't crash if User.Roles is missing
        RolesClass = getattr(User, 'Roles', None)
        default_role = (
            getattr(RolesClass, 'CUSTOMER', 'CUSTOMER')
            if RolesClass else 'CUSTOMER'
        )

        created = False

        # FIX 3: wrap in a transaction + handle IntegrityError for the race
        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()

            if user is None:
                try:
                    # FIX 2: use set_unusable_password explicitly so it's
                    # clear this account can't log in with a password.
                    user = User(
                        email=email,
                        first_name=given_name,
                        last_name=family_name,
                        role=default_role,
                    )
                    user.set_unusable_password()
                    user.email_verified = True
                    user.save()
                    created = True
                    logger.info("New user created via Google: %s", email)
                except IntegrityError:
                    # Another request created the same email concurrently
                    user = User.objects.get(email__iexact=email)
                    created = False
                    logger.info(
                        "Concurrent Google signup resolved for %s", email
                    )
            else:
                if not user.email_verified:
                    user.email_verified = True
                    user.save(update_fields=['email_verified'])
                logger.info("User logged in via Google: %s", email)

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserDetailSerializer(user).data,
                'created': created,
            },
            status=(
                status.HTTP_201_CREATED if created
                else status.HTTP_200_OK
            ),
        )