"""
dashboard/settings/urls.py

URL routing for the settings app.

Layout:

  • singleton_patterns — one path() per *Settings singleton, plus the
    runtime snapshot the admin frontend reads and the status-only
    credential endpoints. These use APIView subclasses, so they can't
    be registered with a router.

  • router — DefaultRouter for the multi-row viewsets (providers, zones,
    transactions, logs, integrations, audit, eTIMS submissions).

  • Security actions — plain function-based views for password change,
    2FA setup/verify, session list, session revoke.

  • public_urls — a separate sub-router for storefront reads (enabled
    delivery zones) plus the public settings snapshot. Mounted at a
    different prefix in config/urls.py.

Route ordering matters:
  1. Singletons first, because a viewset route like `integrations/`
     would otherwise shadow a scalar endpoint like `integrations/refresh/`.
  2. Explicit `refresh/` path BEFORE the router include for the same
     reason — routers match `<pk>/` lazily.
  3. Router include LAST.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views


# ══════════════════════════════════════════════════════════════
# Singletons — plain path() routes, NOT router registrations.
#
# DRF's DefaultRouter expects viewsets. Our singletons are APIView
# subclasses, so they must be registered with path() + .as_view().
# ══════════════════════════════════════════════════════════════

singleton_patterns = [
    # ── Runtime snapshot — the single read every admin page uses ──
    # Placed first so it's obvious this is the primary read endpoint.
    # Everything else below is a per-section CRUD endpoint the
    # Settings page itself uses.
    path(
        "runtime/",
        views.RuntimeSettingsView.as_view(),
        name="settings-runtime",
    ),

    # ── Per-section singletons (GET + PATCH) ──────────────────────
    path("general/",       views.GeneralView.as_view(),      name="settings-general"),
    path("store/",         views.StoreView.as_view(),        name="settings-store"),
    path("checkout/",      views.CheckoutView.as_view(),     name="settings-checkout"),
    path("inventory/",     views.InventoryView.as_view(),    name="settings-inventory"),
    path("reviews/",       views.ReviewView.as_view(),       name="settings-reviews"),
    path("payments/",      views.PaymentView.as_view(),      name="settings-payments"),
    path("shipping/",      views.ShippingView.as_view(),     name="settings-shipping"),
    path("notifications/", views.NotificationView.as_view(), name="settings-notifications"),
    path("security/",      views.SecurityView.as_view(),     name="settings-security"),
    path("tax/",           views.TaxView.as_view(),          name="settings-tax"),

    # ── Status-only singletons — read-only, no credentials ────────
    path(
        "payments/mpesa-status/",
        views.MpesaStatusView.as_view(),
        name="mpesa-status",
    ),
    path(
        "notifications/whatsapp-status/",
        views.WhatsAppStatusView.as_view(),
        name="whatsapp-status",
    ),
    path(
        "tax/etims-status/",
        views.EtimsStatusView.as_view(),
        name="etims-status",
    ),
]


# ══════════════════════════════════════════════════════════════
# Multi-row resources — router (they're real viewsets with CRUD)
# ══════════════════════════════════════════════════════════════

router = DefaultRouter()
router.register(
    "shipping/providers",
    views.ShippingProviderViewSet,
    basename="shipping-provider",
)
router.register(
    "shipping/zones",
    views.DeliveryZoneViewSet,
    basename="shipping-zone",
)
router.register(
    "payments/transactions",
    views.MpesaTransactionViewSet,
    basename="mpesa-txn",
)
router.register(
    "notifications/log",
    views.NotificationLogViewSet,
    basename="notif-log",
)
router.register(
    "security/login-history",
    views.LoginHistoryView,
    basename="login-history",
)
router.register(
    "integrations",
    views.IntegrationStatusViewSet,
    basename="integration",
)
router.register(
    "audit-log",
    views.AuditLogViewSet,
    basename="audit-log",
)
router.register(
    "tax/etims-submissions",
    views.EtimsSubmissionViewSet,
    basename="etims-sub",
)


# ══════════════════════════════════════════════════════════════
# Combined URL patterns
# ══════════════════════════════════════════════════════════════

urlpatterns = [
    # ── 1. Singletons FIRST so scalar routes win over router globs ──
    *singleton_patterns,

    # ── 2. Security actions ─────────────────────────────────────────
    path(
        "security/password/",
        views.change_password,
        name="change-password",
    ),
    path(
        "security/2fa/setup/",
        views.setup_2fa,
        name="2fa-setup",
    ),
    path(
        "security/2fa/verify/",
        views.verify_2fa,
        name="2fa-verify",
    ),
    path(
        "security/sessions/",
        views.list_sessions,
        name="list-sessions",
    ),
    path(
        "security/sessions/<str:session_key>/",
        views.revoke_session,
        name="revoke-session",
    ),

    # ── 3. Integration refresh BEFORE the router include ────────────
    # The router registers `integrations/<pk>/` as a catch-all. If we
    # put this path after the router, `integrations/refresh/` would
    # match `<pk=refresh>` and hit the detail view instead.
    path(
        "integrations/refresh/",
        views.refresh_integrations,
        name="refresh-integrations",
    ),

    # ── 4. Multi-row router URLs LAST ───────────────────────────────
    path("", include(router.urls)),
]


# ══════════════════════════════════════════════════════════════
# Public sub-router (storefront reads)
#
# Mounted at a different prefix (e.g. /api/v1/settings/) in config/urls.py.
# Contains the storefront-safe snapshot plus the enabled delivery zones.
# ══════════════════════════════════════════════════════════════

public_router = DefaultRouter()
public_router.register(
    "zones",
    views.PublicDeliveryZoneViewSet,
    basename="public-zones",
)

public_urls = [
    # The safe subset of settings the customer app is allowed to read.
    # Kept as a plain path() because PublicSettingsView is an APIView,
    # not a viewset.
    path(
        "public/",
        views.PublicSettingsView.as_view(),
        name="settings-public",
    ),
    # Router URLs for the storefront reads that *are* viewsets.
    *public_router.urls,
]