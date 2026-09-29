from django.conf import settings
from django.contrib.auth import login as django_login, logout as django_logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.middleware.csrf import get_token
from django.shortcuts import redirect
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .google import build_authorize_url, exchange_code, fetch_userinfo, new_state
from .models import Role, Status, User
from .serializers import (
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    GENERIC_LOGIN_ERROR,
    LoginSerializer,
    MeSerializer,
    ResetPasswordSerializer,
)
from .throttles import LoginThrottle, PasswordResetThrottle

GENERIC_FORGOT_MESSAGE = "If that email exists, a reset link has been sent."

# Where OAuth sends the user when no explicit `next` is provided.
DEFAULT_CUSTOMER_REDIRECT = "/pages/account"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _safe_next(raw: str | None) -> str | None:
    """
    Accept only same-origin paths. Rejects absolute URLs, protocol-relative
    URLs (`//evil.com`), and anything that doesn't start with a single `/`.
    """
    if not raw:
        return None
    raw = raw.strip()
    if not raw.startswith("/"):
        return None
    if raw.startswith("//") or raw.startswith("/\\"):
        return None
    return raw


# ── CSRF bootstrap (called once by the frontend on load) ─────────────────────
class CsrfBootstrapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        get_token(request)  # forces Set-Cookie: csrftoken
        return Response({"detail": "ok"})


# ── Admin login ──────────────────────────────────────────────────────────────
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        # Same-device rule: admin session blocks anything else here.
        if (
            request.session.get("device_mode") == "admin"
            and request.user.is_authenticated
        ):
            return Response(
                {"detail": "This device is signed in as admin. Log out first."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = LoginSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return Response({"detail": GENERIC_LOGIN_ERROR}, status=400)

        user = serializer.validated_data["user"]
        django_login(request, user)
        request.session["device_mode"] = "admin"

        # "Remember me" controls how long the session survives.
        # Read from the raw request — the serializer doesn't declare it.
        remember = bool(request.data.get("remember", False))
        if remember:
            request.session.set_expiry(60 * 60 * 24 * 30)  # 30 days
        else:
            request.session.set_expiry(0)  # expires at browser close

        return Response({
            "user": MeSerializer(user).data,
            "redirect_to": user.redirect_path,
        })


# ── Logout ───────────────────────────────────────────────────────────────────
class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Me ───────────────────────────────────────────────────────────────────────
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


# ── Change password (authenticated) ──────────────────────────────────────────
class ChangePasswordView(APIView):
    """
    POST /api/v1/auth/change-password/

    Body: { current_password, new_password }

    The current password is verified against the stored hash. The
    session is preserved via `update_session_auth_hash` inside the
    serializer — without it, Django would log the user out.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(request=request)
        return Response({"detail": "Password updated."})


# ── Forgot / reset password ──────────────────────────────────────────────────
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        user = User.objects.filter(email=email).first()
        if user and user.is_admin_role:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            url = (
                f"{settings.FRONTEND_URL}/admin/reset-password"
                f"?uid={uid}&token={token}"
            )
            send_mail(
                subject="Reset your admin password",
                message=f"Reset link (valid 1 hour): {url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )

        # Always the same response — no enumeration.
        return Response({"detail": GENERIC_FORGOT_MESSAGE})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password has been reset."})


# ── Google OAuth (customer only) ─────────────────────────────────────────────
class GoogleStartView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Same-device rule: an admin session on this browser blocks
        # customer login.
        if request.session.get("device_mode") == "admin":
            return redirect(f"{settings.FRONTEND_URL}/admin/dashboard")

        # Stash a same-origin `next` path so the callback can return there.
        # Rejects protocol-relative and absolute URLs.
        nxt = _safe_next(request.query_params.get("next"))
        if nxt:
            request.session["oauth_next"] = nxt
        else:
            request.session.pop("oauth_next", None)

        state = new_state()
        request.session["google_oauth_state"] = state
        return redirect(build_authorize_url(state))


class GoogleCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Same-device rule again on the way back.
        if request.session.get("device_mode") == "admin":
            return redirect(f"{settings.FRONTEND_URL}/admin/dashboard")

        # Always pull the stashed next — pop so it's single-use.
        next_path = (
            request.session.pop("oauth_next", None)
            or DEFAULT_CUSTOMER_REDIRECT
        )

        def back(error: str | None = None):
            target = f"{settings.FRONTEND_URL}{next_path}"
            if error:
                sep = "&" if "?" in target else "?"
                target = f"{target}{sep}error={error}"
            return redirect(target)

        # Google sends ?error=access_denied if the user cancels.
        if request.query_params.get("error"):
            return back("google")

        # CSRF: state must match what we stashed at the start.
        state = request.query_params.get("state")
        expected = request.session.pop("google_oauth_state", None)
        if not state or state != expected:
            return back("state")

        code = request.query_params.get("code")
        if not code:
            return back("code")

        # Trade code for token, then fetch profile.
        try:
            token_data = exchange_code(code)
            userinfo = fetch_userinfo(token_data["access_token"])
        except Exception:
            return back("exchange")

        email = (userinfo.get("email") or "").strip().lower()
        sub = userinfo.get("sub") or ""
        if not email:
            return back("email")

        existing = User.objects.filter(email=email).first()
        if existing and existing.is_admin_role:
            # Admin email must never authenticate via Google.
            return back("admin_email")

        if existing:
            user = existing
            if not user.google_sub:
                user.google_sub = sub
                user.save(update_fields=["google_sub"])
        else:
            user = User.objects.create_user(
                email=email,
                password=None,
                role=Role.CUSTOMER,
                status=Status.ACTIVE,
                is_email_verified=True,
                google_sub=sub,
                first_name=userinfo.get("given_name", "") or "",
                last_name=userinfo.get("family_name", "") or "",
            )

        django_login(request, user)
        request.session["device_mode"] = "customer"

        return redirect(f"{settings.FRONTEND_URL}{next_path}")