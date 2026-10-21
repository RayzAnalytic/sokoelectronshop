from django.urls import path

from .views import (
    ChangePasswordView,
    CsrfBootstrapView,
    ForgotPasswordView,
    GoogleCallbackView,
    GoogleStartView,
    JWTObtainPairView,
    JWTRefreshView,
    JWTLogoutView,
    JWTVerifyMeView,
    LoginView,
    LogoutView,
    MeView,
    ProfileView,
    RegisterView,
    ResendVerificationView,
    ResetPasswordView,
    StaffInviteAcceptView,
    StaffInviteVerifyView,
    VerifyEmailView,
    VerifyResetTokenView,
)

app_name = "authentication"

urlpatterns = [
    # ── Session bootstrap ────────────────────────────────────────────────
    # Sets a CSRF cookie; frontend calls this once before POSTing to
    # any session-authenticated endpoint (mostly for Django admin).
    path("csrf/", CsrfBootstrapView.as_view(), name="auth-csrf"),

    # ── JWT (SimpleJWT) ──────────────────────────────────────────────────
    # Standard JWT endpoints. /login/ (below) ALSO issues JWTs now,
    # so the frontend can use either — they return the same shape.
    path("token/", JWTObtainPairView.as_view(), name="jwt-obtain"),
    path("token/refresh/", JWTRefreshView.as_view(), name="jwt-refresh"),
    path("token/logout/", JWTLogoutView.as_view(), name="jwt-logout"),
    path(
        "token/verify-me/",
        JWTVerifyMeView.as_view(),
        name="jwt-verify-me",
    ),

    # ── Core auth ────────────────────────────────────────────────────────
    # register/ and login/ BOTH issue JWTs AND open a session.
    # The response shape is identical to /token/ so the frontend only
    # needs one auth contract.
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),

    # ── Email verification ───────────────────────────────────────────────
    # Accepts both session cookie and JWT Bearer.
    path(
        "verify-email/",
        VerifyEmailView.as_view(),
        name="auth-verify-email",
    ),
    path(
        "resend-verification/",
        ResendVerificationView.as_view(),
        name="auth-resend-verification",
    ),

    # ── Profile & password ───────────────────────────────────────────────
    # All accept both session cookie and JWT Bearer.
    path("profile/", ProfileView.as_view(), name="auth-profile"),
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
    # google/          → 302 to accounts.google.com with signed state
    # google/callback/ → 302 to {FRONTEND_URL}/auth/callback#<fragment>
    path(
        "google/",
        GoogleStartView.as_view(),
        name="auth-google-start",
    ),
    path(
        "google/callback/",
        GoogleCallbackView.as_view(),
        name="auth-google-callback",
    ),

    # ── Staff invites ────────────────────────────────────────────────────
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