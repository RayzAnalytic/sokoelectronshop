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

Route ordering — the ONLY ordering constraint that matters:

  The literal path `integrations/refresh/` MUST appear before the
  router include. The router registers `integrations/<lookup>/` where
  `<lookup>` is the integration key (e.g. "mpesa", "whatsapp").
  Without the explicit `refresh/` path coming first, Django would
  match `/integrations/refresh/` as a detail lookup for key="refresh"
  and hit the retrieve view.

  Everything else can be in any order. The singletons are listed
  first for human readability, not because Django requires it.

Lookup fields — important for router URLs:

  * `shipping/providers/<key>/`      → key is the provider slug ("g4s")
  * `shipping/zones/<int:pk>/`       → numeric id
  * `payments/transactions/<int:pk>/`→ numeric id
  * `notifications/log/<int:pk>/`    → numeric id
  * `security/login-history/`        → no detail route (list-only)
  * `integrations/<key>/`            → key is the integration slug
  * `audit-log/<int:pk>/`            → numeric id
  * `tax/etims-submissions/<int:pk>/`→ numeric id
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
#
# `lookup_field` on each viewset determines what the router's
# `<lookup>` slot matches. Viewsets without an explicit
# `lookup_field` use the default `<int:pk>`.
# ══════════════════════════════════════════════════════════════

router = DefaultRouter()

# Provider key is the slug — `shipping/providers/g4s/`, not `/1/`.
router.register(
    "shipping/providers",
    views.ShippingProviderViewSet,
    basename="shipping-provider",
)

# Delivery zone id is numeric — `shipping/zones/5/`.
router.register(
    "shipping/zones",
    views.DeliveryZoneViewSet,
    basename="shipping-zone",
)

# M-Pesa transaction id is numeric — `payments/transactions/42/`.
router.register(
    "payments/transactions",
    views.MpesaTransactionViewSet,
    basename="mpesa-txn",
)

# Notification log id is numeric — `notifications/log/88/`.
router.register(
    "notifications/log",
    views.NotificationLogViewSet,
    basename="notif-log",
)

# Login history is list-only (no retrieve route registered on the
# viewset), so the router won't emit `<pk>/` at all.
router.register(
    "security/login-history",
    views.LoginHistoryView,
    basename="login-history",
)

# Integration lookup is the KEY slug — `integrations/mpesa/`, not `/1/`.
# This is why the explicit `refresh/` path below must come first.
router.register(
    "integrations",
    views.IntegrationStatusViewSet,
    basename="integration",
)

# Audit log id is numeric — `audit-log/1024/`.
router.register(
    "audit-log",
    views.AuditLogViewSet,
    basename="audit-log",
)

# eTIMS submission id is numeric — `tax/etims-submissions/9/`.
router.register(
    "tax/etims-submissions",
    views.EtimsSubmissionViewSet,
    basename="etims-sub",
)


# ══════════════════════════════════════════════════════════════
# Combined URL patterns
# ══════════════════════════════════════════════════════════════

urlpatterns = [
    # ── 1. Singletons ───────────────────────────────────────────────
    # No ordering constraint with the router — these all end in a
    # trailing slash on a fully-literal path, so they can never be
    # swallowed by a router's `<lookup>/` pattern. Grouped first for
    # human readability.
    *singleton_patterns,

    # ── 2. Security actions ─────────────────────────────────────────
    # Plain function-based views — not viewsets, so no router overlap.
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

    # ── 3. Integration refresh — MUST be before the router include ──
    #
    # Why: the router registers `integrations/<lookup>/` where
    # `<lookup>` matches the integration key. If this path came
    # AFTER the router include, Django would try
    # `/integrations/refresh/` as a detail lookup with key="refresh"
    # and route it to `IntegrationStatusViewSet.retrieve()` — which
    # would 404 or, worse, hit a real integration named "refresh".
    #
    # This is the single ordering constraint in this file.
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
# Mounted at a different prefix (e.g. /api/v1/settings/) in
# config/urls.py. Contains the storefront-safe snapshot plus the
# enabled delivery zones.
#
# None of these routes require authentication. They expose only
# the fields the customer app needs to render checkout — no
# credentials, no admin emails, no session config.
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