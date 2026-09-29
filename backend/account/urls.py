from django.urls import path

from .views import (
    overview,
    orders,
    addresses,
    notifications,
    settings as settings_views,
    reviews,
    wishlist,
)

app_name = "account"

urlpatterns = [
    # ── 1. Overview ──────────────────────────────────────────────────────────
    path("overview/", overview.OverviewView.as_view(), name="overview"),

    # ── 2. Profile / settings ────────────────────────────────────────────────
    path("profile/", settings_views.ProfileView.as_view(), name="profile"),
    path(
        "profile/preferences/",
        settings_views.PreferencesView.as_view(),
        name="profile-preferences",
    ),
    path(
        "profile/delete/",
        settings_views.DeleteAccountView.as_view(),
        name="profile-delete",
    ),

    # ── 3. Notifications ─────────────────────────────────────────────────────
    path(
        "notifications/",
        notifications.NotificationListView.as_view(),
        name="notifications",
    ),
    path(
        "notifications/unread-count/",
        notifications.UnreadCountView.as_view(),
        name="notifications-unread-count",
    ),
    path(
        "notifications/read-all/",
        notifications.MarkAllReadView.as_view(),
        name="notifications-read-all",
    ),
    path(
        "notifications/<int:pk>/",
        notifications.NotificationDetailView.as_view(),
        name="notification-detail",
    ),

    # ── 4. Reviews ───────────────────────────────────────────────────────────
    path(
        "reviews/",
        reviews.ReviewListCreateView.as_view(),
        name="reviews",
    ),
    path(
        "reviews/<int:pk>/",
        reviews.ReviewDetailView.as_view(),
        name="review-detail",
    ),

    # ── 5. Addresses ─────────────────────────────────────────────────────────
    path(
        "addresses/",
        addresses.AddressListCreateView.as_view(),
        name="addresses",
    ),
    path(
        "addresses/<int:pk>/",
        addresses.AddressDetailView.as_view(),
        name="address-detail",
    ),
    path(
        "addresses/<int:pk>/default/",
        addresses.AddressSetDefaultView.as_view(),
        name="address-set-default",
    ),

    # ── 6. Orders ────────────────────────────────────────────────────────────
    path("orders/", orders.OrderListView.as_view(), name="orders"),
    path(
        "orders/<str:reference>/",
        orders.OrderDetailView.as_view(),
        name="order-detail",
    ),

    # ── 7. Wishlist ──────────────────────────────────────────────────────────
    path(
        "wishlist/",
        wishlist.WishlistListCreateView.as_view(),
        name="wishlist",
    ),
    path(
        "wishlist/check/",
        wishlist.WishlistCheckView.as_view(),
        name="wishlist-check",
    ),
    path(
        "wishlist/clear/",
        wishlist.WishlistClearView.as_view(),
        name="wishlist-clear",
    ),
    path(
        "wishlist/by-variant/<str:variant_id>/",
        wishlist.WishlistRemoveByVariantView.as_view(),
        name="wishlist-remove-by-variant",
    ),
    path(
        "wishlist/<int:pk>/",
        wishlist.WishlistDetailView.as_view(),
        name="wishlist-detail",
    ),
]