# social_media/views.py

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import redirect

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SocialAccount
from .serializers import SocialAccountSerializer
from .services.youtube import YouTubeService
from .services.facebook import FacebookService
from .services.instagram import InstagramService
from .services.twitter import TwitterService
from .services.tiktok_shop import TikTokShopService

User = get_user_model()
logger = logging.getLogger(__name__)


# ============================================================
# YOUTUBE
# ============================================================
class YouTubeSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response(
                {"detail": "Query parameter 'q' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = YouTubeService.search_videos(query)
        except Exception as exc:
            logger.exception("YouTube search failed")
            return Response(
                {"detail": f"YouTube API error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(data, status=status.HTTP_200_OK)


# ============================================================
# FACEBOOK
# ============================================================
class FacebookPostView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get("message", "").strip()
        link = request.data.get("link", "").strip() or None

        if not message:
            return Response(
                {"detail": "message is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = FacebookService.post_to_page(message, link)
        except Exception as exc:
            logger.exception("Facebook post failed")
            return Response(
                {"detail": f"Facebook API error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(data, status=status.HTTP_201_CREATED)


# ============================================================
# INSTAGRAM
# ============================================================
class InstagramMediaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            data = InstagramService.get_media()
        except Exception as exc:
            logger.exception("Instagram media fetch failed")
            return Response(
                {"detail": f"Instagram API error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(data, status=status.HTTP_200_OK)


# ============================================================
# X (TWITTER)
# ============================================================
class TwitterTweetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        text = request.data.get("text", "").strip()
        if not text:
            return Response(
                {"detail": "text is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(text) > 280:
            return Response(
                {"detail": "Tweet exceeds 280 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = TwitterService.post_tweet(text)
        except Exception as exc:
            logger.exception("Tweet post failed")
            return Response(
                {"detail": f"Twitter API error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(data, status=status.HTTP_201_CREATED)


# ============================================================
# CONNECTED ACCOUNTS
# ============================================================
class SocialAccountListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        accounts = SocialAccount.objects.filter(user=request.user)
        return Response(
            SocialAccountSerializer(accounts, many=True).data,
            status=status.HTTP_200_OK,
        )


# ============================================================
# TIKTOK SHOP — OAuth
# ============================================================
class TikTokShopAuthorizeView(APIView):
    """Return the TikTok Shop authorization URL for the current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            service = TikTokShopService()
            url = service.get_authorization_url(state=str(request.user.id))
        except Exception as exc:
            logger.exception("TikTok authorize URL build failed")
            return Response(
                {"detail": f"TikTok setup error: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"authorization_url": url}, status=status.HTTP_200_OK)


class TikTokShopCallbackView(APIView):
    """
    OAuth callback — TikTok redirects here with ?code=...&state=...
    Exchanges code for tokens and saves a SocialAccount row.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        auth_code = request.query_params.get("code")
        state = request.query_params.get("state", "")

        if not auth_code:
            return Response(
                {"detail": "Missing authorization code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            service = TikTokShopService()
            token_data = service.exchange_code_for_token(auth_code)
        except Exception as exc:
            logger.exception("TikTok token exchange failed")
            return Response(
                {"detail": f"Token exchange failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        inner = token_data.get("data", {}) or {}
        access_token = inner.get("access_token", "")
        refresh_token = inner.get("refresh_token", "")

        if not access_token:
            return Response(
                {"detail": "No access_token in TikTok response.", "raw": token_data},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Fetch authorized shops to grab the shop_cipher
        shop_cipher = ""
        try:
            authed_service = TikTokShopService(access_token=access_token)
            shops = authed_service.get_authorized_shops()
            shop_list = (shops.get("data") or {}).get("shops") or []
            if shop_list:
                shop_cipher = shop_list[0].get("cipher", "")
        except Exception:
            logger.exception("TikTok authorized-shops fetch failed")

        # Attach to the user identified by `state`
        user = User.objects.filter(pk=state).first() if state else None
        if user:
            SocialAccount.objects.update_or_create(
                user=user,
                platform=SocialAccount.Platform.TIKTOK_SHOP,
                defaults={
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "shop_cipher": shop_cipher,
                    "is_active": True,
                },
            )

        return Response(
            {
                "detail": "TikTok Shop connected successfully.",
                "shop_cipher": shop_cipher,
                "linked_to_user": bool(user),
            },
            status=status.HTTP_200_OK,
        )


class TikTokShopProductsView(APIView):
    """List products from the connected TikTok Shop."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        account = SocialAccount.objects.filter(
            user=request.user,
            platform=SocialAccount.Platform.TIKTOK_SHOP,
            is_active=True,
        ).first()

        if not account:
            return Response(
                {"detail": "No TikTok Shop connected. Authorize first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            service = TikTokShopService(
                access_token=account.access_token,
                shop_cipher=account.shop_cipher,
            )
            data = service.list_products()
        except Exception as exc:
            logger.exception("TikTok products fetch failed")
            return Response(
                {"detail": f"TikTok API error: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(data, status=status.HTTP_200_OK)
