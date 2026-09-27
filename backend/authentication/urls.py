# authentication/urls.py

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from authentication.views import (
    # Auth
    RegisterAPIView,
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    GoogleLoginView,
    # Password reset
    PasswordResetRequestAPIView,
    PasswordResetValidateAPIView,
    PasswordResetConfirmAPIView,
)

# Optional: uncomment if you want reverse('auth:auth-login') namespacing
# app_name = "auth"


urlpatterns = [
    # ── Core auth ──
    path("register/", RegisterAPIView.as_view(), name="auth-register"),
    path("login/", LoginAPIView.as_view(), name="auth-login"),
    path("logout/", LogoutAPIView.as_view(), name="auth-logout"),
    path("me/", MeAPIView.as_view(), name="auth-me"),
    path(
        "token/refresh/",
        TokenRefreshView.as_view(),
        name="auth-token-refresh",
    ),

    # ── Google OAuth ──
    path("google/", GoogleLoginView.as_view(), name="auth-google"),

    # ── Password reset ──
    path(
        "password/reset/",
        PasswordResetRequestAPIView.as_view(),
        name="password-reset",
    ),
    path(
        "password/reset/validate/",
        PasswordResetValidateAPIView.as_view(),
        name="password-reset-validate",
    ),
    path(
        "password/reset/confirm/",
        PasswordResetConfirmAPIView.as_view(),
        name="password-reset-confirm",
    ),
]