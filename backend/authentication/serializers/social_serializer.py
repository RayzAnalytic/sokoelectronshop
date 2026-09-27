# authentication/serializers/social_serializer.py

import logging

import requests
from django.conf import settings
from django.contrib.auth import get_user_model

from rest_framework import serializers

from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

User = get_user_model()
logger = logging.getLogger(__name__)


class GoogleLoginSerializer(serializers.Serializer):
    """
    Payload the Next.js frontend sends after Google returns a credential.
    Send either access_token (older popup flow) or id_token (GSI, preferred).
    """
    access_token = serializers.CharField(required=False, allow_blank=True)
    id_token = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        access_token = attrs.get('access_token')
        id_token = attrs.get('id_token')

        # --- 1. Require at least one ---
        if not access_token and not id_token:
            raise serializers.ValidationError(
                'Provide either access_token or id_token.'
            )

        # --- 2. Reject ambiguous payloads ---
        if access_token and id_token:
            raise serializers.ValidationError(
                'Provide only one of access_token or id_token, not both.'
            )

        # --- 3. Verify the ID token (preferred path) ---
        if id_token:
            attrs['google_user'] = self._verify_id_token(id_token)
            return attrs

        # --- 4. Verify the access token via Google's userinfo endpoint ---
        attrs['google_user'] = self._verify_access_token(access_token)
        return attrs

    # ── ID token verification ──
    def _verify_id_token(self, id_token):
        try:
            idinfo = google_id_token.verify_oauth2_token(
                id_token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError:
            raise serializers.ValidationError(
                {'id_token': 'Invalid or expired Google ID token.'}
            )
        except (GoogleAuthError, TransportError):
            logger.exception("Google token verification failed (transport)")
            raise serializers.ValidationError(
                {'id_token': 'Could not verify Google token. Please try again.'}
            )

        # Issuer check (defense in depth — verify_oauth2_token already does this)
        if idinfo.get('iss') not in (
            'accounts.google.com',
            'https://accounts.google.com',
        ):
            raise serializers.ValidationError(
                {'id_token': 'Invalid token issuer.'}
            )

        # Audience check (verify_oauth2_token already validates, but explicit)
        if idinfo.get('aud') != settings.GOOGLE_CLIENT_ID:
            raise serializers.ValidationError(
                {'id_token': 'Token was issued for a different client.'}
            )

        # Authorized party check (only when multiple client IDs are used)
        azp = idinfo.get('azp')
        if azp and azp != settings.GOOGLE_CLIENT_ID:
            raise serializers.ValidationError(
                {'id_token': 'Token was issued for a different client.'}
            )

        # Email must be verified by Google
        if not idinfo.get('email_verified'):
            raise serializers.ValidationError(
                {'id_token': 'Google account email is not verified.'}
            )

        # Email must be present
        if not idinfo.get('email'):
            raise serializers.ValidationError(
                {'id_token': 'Google token did not include an email.'}
            )

        return idinfo

    # ── Access token verification (via userinfo endpoint) ──
    def _verify_access_token(self, access_token):
        try:
            resp = requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=10,
            )
        except requests.RequestException:
            logger.exception("Google userinfo request failed")
            raise serializers.ValidationError(
                {'access_token': 'Could not reach Google to verify token.'}
            )

        if resp.status_code != 200:
            raise serializers.ValidationError(
                {'access_token': 'Invalid or expired Google access token.'}
            )

        idinfo = resp.json()

        if not idinfo.get('email_verified'):
            raise serializers.ValidationError(
                {'access_token': 'Google account email is not verified.'}
            )

        if not idinfo.get('email'):
            raise serializers.ValidationError(
                {'access_token': 'Google token did not include an email.'}
            )

        return idinfo