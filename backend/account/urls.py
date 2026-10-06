from django.urls import path

from . import views

app_name = "account"

urlpatterns = [
    # ── Overview ─────────────────────────────────────────────────────
    path(
        "overview/",
        views.OverviewView.as_view(),
        name="overview",
    ),

    # ── Settings (profile + preferences) ─────────────────────────────
    # Password change lives in the authentication app; the frontend
    # calls `/api/v1/auth/change-password/` directly, not a route here.
    path(
        "settings/",
        views.SettingsView.as_view(),
        name="settings",
    ),
    path(
        "settings/preferences/",
        views.PreferencesView.as_view(),
        name="settings-preferences",
    ),

    # ── Addresses ────────────────────────────────────────────────────
    path(
        "addresses/",
        views.AddressListCreateView.as_view(),
        name="address-list",
    ),
    path(
        "addresses/<int:pk>/",
        views.AddressDetailView.as_view(),
        name="address-detail",
    ),
    path(
        "addresses/<int:pk>/set-default/",
        views.AddressSetDefaultView.as_view(),
        name="address-set-default",
    ),

    # ── Wishlist ─────────────────────────────────────────────────────
    # Literal routes first, `<int:pk>/` last. The int converter would
    # reject "check" anyway, but ordering the specific routes first
    # makes the intent obvious and prevents surprises if the converter
    # ever changes.
    path(
        "wishlist/",
        views.WishlistListCreateView.as_view(),
        name="wishlist-list",
    ),
    path(
        "wishlist/check/",
        views.WishlistCheckView.as_view(),
        name="wishlist-check",
    ),
    path(
        "wishlist/check-batch/",
        views.WishlistBatchCheckView.as_view(),
        name="wishlist-check-batch",
    ),
    path(
        "wishlist/bulk-add/",
        views.WishlistBulkAddView.as_view(),
        name="wishlist-bulk-add",
    ),
    path(
        "wishlist/clear/",
        views.WishlistClearView.as_view(),
        name="wishlist-clear",
    ),
    path(
        "wishlist/by-variant/<str:variant_id>/",
        views.WishlistByVariantView.as_view(),
        name="wishlist-by-variant",
    ),
    path(
        "wishlist/<int:pk>/",
        views.WishlistDetailView.as_view(),
        name="wishlist-detail",
    ),

    # ── Reviews ──────────────────────────────────────────────────────
    # Literal routes (`pending/`, `uploads/`) before `<int:pk>/`.
    # The int converter rejects both literals anyway, but ordering the
    # specific routes first makes the intent obvious and prevents
    # surprises if the converter ever changes.
    path(
        "reviews/",
        views.ReviewListCreateView.as_view(),
        name="review-list",
    ),
    path(
        "reviews/pending/",
        views.PendingReviewListView.as_view(),
        name="review-pending",
    ),
    path(
        "reviews/uploads/",
        views.ReviewImageUploadView.as_view(),
        name="review-upload",
    ),
    path(
        "reviews/<int:pk>/",
        views.ReviewDetailView.as_view(),
        name="review-detail",
    ),

    # ── Orders ───────────────────────────────────────────────────────
    # Route ordering:
    #   * Literal + suffix routes first — `reorder/`, `reject/`,
    #     `claim/` all end in a fixed word, so they cannot collide
    #     with `<str:reference>/`.
    #   * The generic `<str:reference>/` is listed after them so a
    #     future route with a suffix is not shadowed by the detail
    #     view matching the suffix as part of the reference.
    #
    # Note on `str:reference`: the reference format is
    # `ORD-YYYYMMDD-XXXXXXXX` — alphanumerics and dashes. It never
    # contains a slash, so `str:` (which matches anything except `/`)
    # is correct. If the reference format ever changes to include
    # slashes, this needs `<path:reference>`.
    path(
        "orders/",
        views.OrderListView.as_view(),
        name="order-list",
    ),
    path(
        "orders/<str:reference>/reorder/",
        views.OrderReorderView.as_view(),
        name="order-reorder",
    ),
    path(
        "orders/<str:reference>/reject/",
        views.OrderRejectView.as_view(),
        name="order-reject",
    ),
    path(
        "orders/<str:reference>/claim/",
        views.OrderClaimView.as_view(),
        name="order-claim",
    ),
    path(
        "orders/<str:reference>/",
        views.OrderDetailView.as_view(),
        name="order-detail",
    ),

    # ── Notifications ────────────────────────────────────────────────
    # Literal routes before `<int:pk>/`, same reasoning as wishlist.
    path(
        "notifications/",
        views.NotificationListView.as_view(),
        name="notification-list",
    ),
    path(
        "notifications/read-all/",
        views.NotificationMarkAllReadView.as_view(),
        name="notification-read-all",
    ),
    path(
        "notifications/clear/",
        views.NotificationClearView.as_view(),
        name="notification-clear",
    ),
    path(
        "notifications/unread-count/",
        views.NotificationUnreadCountView.as_view(),
        name="notification-unread-count",
    ),
    path(
        "notifications/<int:pk>/read/",
        views.NotificationMarkReadView.as_view(),
        name="notification-read",
    ),
    path(
        "notifications/<int:pk>/",
        views.NotificationDeleteView.as_view(),
        name="notification-delete",
    ),
]