# authentication/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomRegisterView,
    CustomLoginView,
    CustomLogoutView,
    MeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)

app_name = "authentication"

urlpatterns = [
    # Registration
    path("register/", CustomRegisterView.as_view(), name="register"),

    # Login / logout
    path("login/", CustomLoginView.as_view(), name="login"),
    path("logout/", CustomLogoutView.as_view(), name="logout"),

    # JWT refresh
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # Current user
    path("me/", MeView.as_view(), name="me"),

    # Password reset
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
]