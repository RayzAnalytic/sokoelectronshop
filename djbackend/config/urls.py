# config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # ─────────────────────────────────────────────
    # Auth — dj-rest-auth built-in endpoints
    # Provides:
    #   POST /api/auth/login/                 (login)
    #   POST /api/auth/logout/                (logout)
    #   POST /api/auth/password/reset/        (request reset)
    #   POST /api/auth/password/reset/confirm/(confirm reset)
    #   POST /api/auth/password/change/       (change password)
    #   GET  /api/auth/user/                  (current user)
    # ─────────────────────────────────────────────
    path("api/auth/", include("dj_rest_auth.urls")),

    # ─────────────────────────────────────────────
    # Registration — dj-rest-auth registration endpoints
    # Provides:
    #   POST /api/auth/registration/          (register)
    #   POST /api/auth/registration/verify-email/
    #   etc. (from allauth)
    # ─────────────────────────────────────────────
    path("api/auth/registration/", include("dj_rest_auth.registration.urls")),

    # ─────────────────────────────────────────────
    # JWT — refresh access token
    #   POST /api/auth/token/refresh/
    # ─────────────────────────────────────────────
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # ─────────────────────────────────────────────
    # API documentation
    #   GET /api/schema/   → OpenAPI schema
    #   GET /api/docs/     → Swagger UI
    # ─────────────────────────────────────────────
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

# ─────────────────────────────────────────────
# Serve media + static files in development
# (in production, Nginx or S3 handles these)
# ─────────────────────────────────────────────
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)