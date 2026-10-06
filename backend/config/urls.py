# config/urls.py

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from dashboard.social.views import OAuthCallbackView as SocialOAuthCallbackView
from dashboard.settings import views as settings_views
from dashboard.settings.urls import public_urls as settings_public_urls


urlpatterns = [
    path("admin/", admin.site.urls),

    # ── Auth ────────────────────────────────────────────────────────────────
    path("api/v1/auth/", include("authentication.urls")),

    # ── Catalog ─────────────────────────────────────────────────────────────
    path("api/catalog/", include("catalog.urls")),

    # ── AI · CUSTOMER SIDE (public storefront assistant) ────────────────────
    path("api/ai/", include("ai.urls")),

    # ── AI & AUTOMATIONS · ADMIN SIDE (staff dashboard) ─────────────────────
    path("api/admin/ai/", include("dashboard.aiandautomations.urls", namespace="aiandautomations")),

    # ── Checkout ────────────────────────────────────────────────────────────
    path("api/v1/checkout/", include("checkout.urls")),

    # ── Account ─────────────────────────────────────────────────────────────
    path("api/v1/account/", include("account.urls")),

    # ── Newsletter ──────────────────────────────────────────────────────────
    path("api/v1/newsletter/", include("newsletter.urls")),

    # ── Dashboard (admin APIs) ──────────────────────────────────────────────
    path("api/v1/admin/products/",   include("dashboard.products.urls")),
    path("api/v1/admin/categories/", include("dashboard.categories.urls")),
    path("api/v1/admin/brands/",     include("dashboard.brands.urls")),
    path("api/v1/admin/newsletter/", include("dashboard.newsletter.urls")),
    path("api/v1/admin/customers/",  include("dashboard.customers.urls")),
    path("api/v1/admin/orders/",     include("dashboard.orders.urls")),
    path("api/v1/admin/suppliers/",  include("dashboard.suppliers.urls")),
    path("api/v1/admin/inventory/",  include("dashboard.inventory.urls")),
    path("api/v1/admin/reviews/",    include("dashboard.reviews.urls")),
    path("api/v1/admin/discounts/",  include("dashboard.discounts.urls")),

    # ── Dashboard · Reports & Analytics ─────────────────────────────────────
    # Backs /admin/reports page (Sales · Orders · Customers · Products ·
    # Inventory · Payments · Taxes & VAT · Shipping · Discounts · Social).
    # Read-only aggregation across the other dashboard apps, plus an export
    # log and a cache-refresh endpoint.
    #
    #   GET   /api/v1/admin/reports/sales/       daily revenue vs orders
    #   GET   /api/v1/admin/reports/orders/      order rows for the tab
    #   GET   /api/v1/admin/reports/customers/   new vs returning + top buyers
    #   GET   /api/v1/admin/reports/products/    top-selling products
    #   GET   /api/v1/admin/reports/inventory/   stock levels + counters
    #   GET   /api/v1/admin/reports/payments/    M-Pesa stream split
    #   GET   /api/v1/admin/reports/taxes/       VAT periods + status
    #   GET   /api/v1/admin/reports/shipping/    carrier performance
    #   GET   /api/v1/admin/reports/discounts/   code performance + ROI
    #   GET   /api/v1/admin/reports/social/      videos · platforms · funnel
    #   POST  /api/v1/admin/reports/export/      log CSV / Excel / PDF export
    #   POST  /api/v1/admin/reports/refresh/     clear cache for a tab
    #
    # Every endpoint accepts ?range=today|yesterday|7days|30days|this_month|
    # last_month|custom (and &start=&end= when range=custom).
    path("api/v1/admin/reports/", include("dashboard.reports.urls", namespace="reports")),

    # ── Dashboard · Users & Roles ───────────────────────────────────────────
    # Backs /admin/users page (Staff Users · Roles · Permission Matrix tabs).
    # Staff-account CRUD, role catalogue, permission matrix, and the
    # caller's effective permissions. Invite management lives in its own
    # URLconf below.
    #
    #   GET         /api/v1/admin/users/                          list staff (filter: ?role=&q=)
    #   GET/PATCH   /api/v1/admin/users/<uuid>/                   detail / edit
    #   DELETE      /api/v1/admin/users/<uuid>/                   remove
    #   POST        /api/v1/admin/users/<uuid>/suspend/           suspend/activate toggle
    #   POST        /api/v1/admin/users/<uuid>/reset-password/    email reset link
    #   GET         /api/v1/admin/users/me/permissions/           effective modules for caller
    #   GET         /api/v1/admin/users/roles/                    role catalogue
    #   GET/PUT     /api/v1/admin/users/permissions/              permission matrix
    path("api/v1/admin/users/", include("dashboard.users.urls")),

    # ── Staff Invites · ADMIN MANAGEMENT ────────────────────────────────────
    # Top-level prefix so the resource can grow sibling actions
    # (resend, duplicate) without nesting under a user.
    #
    #   GET         /api/v1/admin/invites/           list invites (filter: ?status=)
    #   POST        /api/v1/admin/invites/           create + send invite (SendGrid)
    #   DELETE      /api/v1/admin/invites/<uuid>/    soft-cancel invite
    path("api/v1/admin/invites/", include("dashboard.users.invites_urls")),

    # ── Staff Invites · PUBLIC ──────────────────────────────────────────────
    # No auth — the invitee has no session yet. Throttled by IP.
    # Backs /auth/staff/register?token=<uuid> in the frontend.
    #
    #   GET   /api/v1/staff-invites/<uuid>/          fetch invite (name/email/role/department)
    #   POST  /api/v1/staff-invites/<uuid>/accept/   set password → creates User + StaffProfile,
    #                                                logs in via session cookie, returns redirect_to
    path("api/v1/staff-invites/", include("dashboard.users.urls_public")),

    # ── Dashboard · Settings ────────────────────────────────────────────────
    path("api/v1/admin/settings/", include("dashboard.settings.urls")),

    # ── Settings · Public (storefront checkout) ─────────────────────────────
    path("api/v1/", include(settings_public_urls)),

    # ── M-Pesa Daraja callback (public, no auth — Safaricom posts here) ─────
    path(
        "api/mpesa/callback/",
        settings_views.mpesa_callback,
        name="mpesa-callback",
    ),

    # Dashboard · Transactions / Shipping
    path("api/v1/dashboard/transactions/", include("dashboard.transactions.urls")),
    path("api/v1/dashboard/shipping/",     include("dashboard.shipping.urls")),

    # Dashboard · Banners & Hero (admin CRUD + public hero feed)
    path("api/v1/", include("dashboard.banners.urls")),

    # Dashboard · Social media hub
    path("api/v1/admin/social/", include("dashboard.social.urls")),

    # Social OAuth callbacks (public)
    path(
        "api/v1/social/oauth/<str:platform>/callback/",
        SocialOAuthCallbackView.as_view(),
        name="social-oauth-callback",
    ),

    # ── WhatsApp Float Widget (storefront popup) ────────────────────────────
    path("api/", include("whatsapfloat.urls")),

    # ── WhatsApp (dashboard: webhooks, cart handoff, OTP, inbox, …) ─────────
    path("api/v1/whatsapp/", include("dashboard.whatsapp.urls")),

    path(
        "api/v1/dashboard/direct-orders/",
        include("dashboard.direct_orders.urls"),
    ),
    path("api/v1/admin/analytics/", include("dashboard.analytics.urls", namespace="analytics")),
    path("api/v1/admin/overview/", include("dashboard.overview.urls", namespace="overview")),

    # ── API schema + docs ───────────────────────────────────────────────────
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="docs",
    ),
]


# Serve uploaded media in development.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)