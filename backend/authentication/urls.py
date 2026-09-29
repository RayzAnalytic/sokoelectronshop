from django.urls import path

from .views import (
    ChangePasswordView,
    CsrfBootstrapView,
    ForgotPasswordView,
    GoogleCallbackView,
    GoogleStartView,
    LoginView,
    LogoutView,
    MeView,
    ResetPasswordView,
)

app_name = "authentication"

urlpatterns = [
    path("csrf/", CsrfBootstrapView.as_view(), name="auth-csrf"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path(
        "change-password/",
        ChangePasswordView.as_view(),
        name="auth-change-password",
    ),
    path(
        "forgot-password/",
        ForgotPasswordView.as_view(),
        name="auth-forgot-password",
    ),
    path(
        "reset-password/",
        ResetPasswordView.as_view(),
        name="auth-reset-password",
    ),
    path("google/", GoogleStartView.as_view(), name="auth-google-start"),
    path(
        "google/callback/",
        GoogleCallbackView.as_view(),
        name="auth-google-callback",
    ),
]