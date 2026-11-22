from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve as media_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from dashboard.social.views import OAuthCallbackView as SocialOAuthCallbackView
from dashboard.settings import views as settings_views
from dashboard.settings.urls import public_urls as settings_public_urls


urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/v1/auth/", include("authentication.urls")),

    path("api/catalog/", include("catalog.urls")),

    path("api/ai/", include("ai.urls")),

    path("api/admin/ai/", include("dashboard.aiautomations.urls", namespace="aiadmin")),

    path("api/v1/checkout/", include("checkout.urls")),

    path("api/v1/account/", include("account.urls")),

    path("api/v1/newsletter/", include("newsletter.urls")),

    path("api/v1/admin/products/",   include("dashboard.products.urls")),
    path("api/v1/admin/categories/", include("dashboard.categories.urls")),
    path("api/v1/admin/brands/",     include("dashboard.brands.urls")),

    path("api/v1/admin/orders/",     include("dashboard.orders.urls")),

    path("api/v1/admin/newsletter/", include("dashboard.newsletter.urls")),
    path("api/v1/admin/customers/",  include("dashboard.customers.urls")),
    path("api/v1/admin/suppliers/",  include("dashboard.suppliers.urls")),
    path("api/v1/admin/inventory/",  include("dashboard.inventory.urls")),

    path("api/v1/admin/reviews/",    include("dashboard.reviews.urls")),
    path("api/v1/admin/discounts/",  include("dashboard.discounts.urls")),
    path(
        "api/v1/admin/reports/",
        include("dashboard.reports.urls", namespace="reports"),
    ),

    path("api/v1/admin/users/",   include("dashboard.users.urls")),
    path("api/v1/admin/invites/", include("dashboard.users.invites_urls")),

    path("api/v1/staff-invites/", include("dashboard.users.urls_public")),

    path("api/v1/admin/settings/", include("dashboard.settings.urls")),

    path("api/v1/", include(settings_public_urls)),

    path(
        "api/mpesa/callback/",
        settings_views.mpesa_callback,
        name="mpesa-callback",
    ),

    path(
        "api/v1/dashboard/returns/",
        include("dashboard.returns.urls"),
    ),

    path("api/v1/dashboard/transactions/", include("dashboard.transactions.urls")),
    path("api/v1/dashboard/shipping/",     include("dashboard.shipping.urls")),

    path("api/v1/", include("dashboard.banners.urls")),

    path("api/v1/", include("dashboard.posters.urls")),

    path("api/v1/admin/social/", include("dashboard.social.urls")),

    path(
        "api/v1/dashboard/payments/",
        include("dashboard.payments.urls"),
    ),

    path(
        "api/v1/social/oauth/<str:platform>/callback/",
        SocialOAuthCallbackView.as_view(),
        name="social-oauth-callback",
    ),

    path("api/", include("whatsapfloat.urls")),

    path("api/v1/whatsapp/", include("dashboard.whatsapp.urls")),

    path(
        "api/v1/dashboard/direct-orders/",
        include("dashboard.direct_orders.urls"),
    ),

    path('api/v1/admin/campaigns/', include('dashboard.campaigns.urls')),

    path(
        "api/v1/admin/analytics/",
        include("dashboard.analytics.urls", namespace="analytics"),
    ),
    path(
        "api/v1/admin/overview/",
        include("dashboard.overview.urls", namespace="overview"),
    ),

    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="docs",
    ),
]


urlpatterns += [
    re_path(
        r"^media/(?P<path>.*)$",
        media_serve,
        {"document_root": settings.MEDIA_ROOT},
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)