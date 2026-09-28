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
    path("api/onboarding/", include("onboarding.urls")),          # 👈 ADDED

]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )