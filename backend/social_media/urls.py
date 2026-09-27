# social_media/urls.py

from django.urls import path

from .views import (
    YouTubeSearchView,
    FacebookPostView,
    InstagramMediaView,
    TwitterTweetView,
    SocialAccountListView,
    TikTokShopAuthorizeView,
    TikTokShopCallbackView,
    TikTokShopProductsView,
)

app_name = "social_media"

urlpatterns = [
    # ── Connected accounts ──
    path(
        "accounts/",
        SocialAccountListView.as_view(),
        name="social-accounts",
    ),

    # ── YouTube ──
    path(
        "youtube/search/",
        YouTubeSearchView.as_view(),
        name="youtube-search",
    ),

    # ── Facebook ──
    path(
        "facebook/post/",
        FacebookPostView.as_view(),
        name="facebook-post",
    ),

    # ── Instagram ──
    path(
        "instagram/media/",
        InstagramMediaView.as_view(),
        name="instagram-media",
    ),

    # ── X (Twitter) ──
    path(
        "twitter/tweet/",
        TwitterTweetView.as_view(),
        name="twitter-tweet",
    ),

    # ── TikTok Shop ──
    path(
        "tiktok/authorize/",
        TikTokShopAuthorizeView.as_view(),
        name="tiktok-authorize",
    ),
    path(
        "tiktok/callback/",
        TikTokShopCallbackView.as_view(),
        name="tiktok-callback",
    ),
    path(
        "tiktok/products/",
        TikTokShopProductsView.as_view(),
        name="tiktok-products",
    ),
]