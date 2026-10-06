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
    ProfileView,
    RegisterView,
    ResetPasswordView,
    StaffInviteAcceptView,
    StaffInviteVerifyView,
    VerifyResetTokenView,
)

app_name = "authentication"

# ─────────────────────────────────────────────────────────────────────────────
# Public auth routes — mounted at /api/v1/auth/
#
# The frontend calls these directly:
#   /auth/login              → login/
#   /auth/register           → register/
#   /auth/forgot-password    → forgot-password/
#   /auth/reset-password     → reset-password/   (?token=...)
#   /auth/staff/register     → invite/verify/  + invite/accept/
#
# The `google/` routes must match GOOGLE_OAUTH_REDIRECT_URI in settings:
#   http://localhost:8000/api/v1/auth/google/callback/
# ─────────────────────────────────────────────────────────────────────────────
urlpatterns = [
    # ── Session bootstrap ────────────────────────────────────────────────
    path("csrf/", CsrfBootstrapView.as_view(), name="auth-csrf"),

    # ── Core auth ────────────────────────────────────────────────────────
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),

    # ── Profile ──────────────────────────────────────────────────────────
    path("profile/", ProfileView.as_view(), name="auth-profile"),
    path(
        "change-password/",
        ChangePasswordView.as_view(),
        name="auth-change-password",
    ),

    # ── Password reset (three-step) ──────────────────────────────────────
    # 1. POST forgot-password/         → email a link containing ?token=...
    # 2. GET  verify-reset-token/      → does that token still work?
    # 3. POST reset-password/          → consume the token, set the password
    path(
        "forgot-password/",
        ForgotPasswordView.as_view(),
        name="auth-forgot-password",
    ),
    path(
        "verify-reset-token/",
        VerifyResetTokenView.as_view(),
        name="auth-verify-reset-token",
    ),
    path(
        "reset-password/",
        ResetPasswordView.as_view(),
        name="auth-reset-password",
    ),

    # ── Google OAuth ─────────────────────────────────────────────────────
    # Start:    browser is redirected to Google from google/
    # Callback: Google redirects back to google/callback/
    #
    # The callback URL is pinned in settings as GOOGLE_OAUTH_REDIRECT_URI
    # and must match exactly what's registered in Google Cloud Console.
    path("google/", GoogleStartView.as_view(), name="auth-google-start"),
    path(
        "google/callback/",
        GoogleCallbackView.as_view(),
        name="auth-google-callback",
    ),

    # ── Staff invitation acceptance (public — token is the auth) ────────
    # The frontend page /auth/staff/register?token=... calls these:
    #   GET  invite/verify/  → { valid, email, role, invited_by, ... }
    #   POST invite/accept/  → { user, redirect_to: "/admin" }
    path(
        "invite/verify/",
        StaffInviteVerifyView.as_view(),
        name="auth-invite-verify",
    ),
    path(
        "invite/accept/",
        StaffInviteAcceptView.as_view(),
        name="auth-invite-accept",
    ),
]