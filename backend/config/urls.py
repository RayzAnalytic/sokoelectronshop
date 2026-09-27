# config/urls.py

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    # ── Django admin ──
    path("admin/", admin.site.urls),

    # ── allauth browser-facing URLs (required for Google OAuth) ──
    path("accounts/", include("allauth.urls")),

    # ── Authentication ──
    path("api/auth/", include("authentication.urls")),

    # ── Onboarding (12-step setup) ──
    path("api/onboarding/", include("onboarding.urls")),

    # ── Payments (Dusupay, Pesapal, M-Pesa) ──
    path("api/payments/", include("payments.urls")),

    # ── Catalog (categories + products) ──
    path("api/catalog/", include("catalog.urls")),           # 👈 ADDED

    # ── Social media ──
    path("api/social/", include("social_media.urls")),

    # ── WhatsApp ──
    path("api/whatsapp/", include("whatsapp.urls")),

    # ── Team invites ──
    path("api/team/", include("team.urls")),                 # 👈 ADDED

    # ── Business + admin dashboard endpoints (catch-all-ish, keep LAST) ──
    path("api/", include("admin_dashboard.urls")),
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )