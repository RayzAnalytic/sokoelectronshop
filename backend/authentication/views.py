from django.conf import settings
from django.contrib.auth import login as django_login, logout as django_logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.middleware.csrf import get_token
from django.shortcuts import redirect
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .google import (
    build_authorize_url,
    exchange_code,
    fetch_userinfo,
    new_state,
    read_state,                    # ✅ FIX #5: signed state reader
)
from .models import (
    EmailVerificationCode,
    PasswordResetToken,
    Role,
    Status,
    User,
)
from .permissions import IsAdminRole, IsPendingVerification
from .serializers import (
    ChangePasswordSerializer,
    CustomerProfileSerializer,
    CustomerRegisterSerializer,
    CustomTokenObtainPairSerializer,
    ForgotPasswordSerializer,
    GENERIC_LOGIN_ERROR,
    LoginSerializer,
    MeSerializer,
    ResendVerificationSerializer,
    ResetPasswordSerializer,
    VerifyEmailSerializer,
    VerifyResetTokenSerializer,
)
from .throttles import LoginThrottle, PasswordResetThrottle

from dashboard.users.constants import ROLE_DASHBOARD_MAP, STAFF_ROLES
from dashboard.users.models import (
    InviteStatus,
    StaffInvite,
    StaffProfile,
    UserStatus,
)

GENERIC_FORGOT_MESSAGE = "If that email exists, a reset link has been sent."

DEFAULT_CUSTOMER_REDIRECT = "/pages/account"
DEFAULT_CUSTOMER_LOGIN_REDIRECT = "/pages/account"
DEFAULT_ADMIN_LOGIN_REDIRECT = "/admin"


# ✅ FIX #1: Shared authentication classes so every view that needs auth
# accepts BOTH a session cookie and a JWT Bearer token.
#
# Combined with REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES in settings,
# this makes MeView / ProfileView / ChangePasswordView work regardless of
# whether the user logged in via password (JWT) or via Google (JWT) or via
# Django admin (session).
DUAL_AUTH = [JWTAuthentication, SessionAuthentication]


def _safe_next(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    if not raw.startswith("/"):
        return None
    if raw.startswith("//") or raw.startswith("/\\"):
        return None
    return raw


def _is_admin_role(user) -> bool:
    if hasattr(user, "is_admin_role"):
        return bool(user.is_admin_role)
    return getattr(user, "role", None) in (Role.OWNER, Role.STAFF)


def _flatten_errors(errors) -> str:
    if isinstance(errors, dict):
        if "non_field_errors" in errors:
            return _flatten_errors(errors["non_field_errors"])
        for _, value in errors.items():
            msg = _flatten_errors(value)
            if msg:
                return msg
        return "Invalid input."
    if isinstance(errors, list) and errors:
        return _flatten_errors(errors[0])
    if isinstance(errors, str):
        return errors
    return "Invalid input."


def _unauthorized() -> Response:
    return Response(
        {"detail": "Not authenticated."},
        status=status.HTTP_401_UNAUTHORIZED,
    )


def _display_name(user) -> str:
    first = getattr(user, "first_name", "") or ""
    last = getattr(user, "last_name", "") or ""
    composed = f"{first} {last}".strip()
    if composed:
        return composed

    for method in ("get_username", "get_short_name"):
        fn = getattr(user, method, None)
        if callable(fn):
            try:
                value = fn()
                if value:
                    return str(value)
            except Exception:
                pass

    email = getattr(user, "email", "") or ""
    return email or "—"


def _serialize_me(user) -> dict:
    data = dict(MeSerializer(user).data)
    if not data.get("name"):
        data["name"] = _display_name(user)
    return data


def _issue_tokens(user) -> dict:
    """
    ✅ FIX #2: Single helper that produces the token payload returned by
    EVERY login/register/invite-accept endpoint. Keeps the response shape
    consistent so the frontend only needs ONE auth contract.
    """
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


def _auth_response(user, *, redirect_to: str, extra: dict | None = None,
                   http_status: int = status.HTTP_200_OK) -> Response:
    """
    ✅ FIX #2: Unified auth response payload.

    Shape: { access, refresh, user, redirect_to, ...extra }
    Used by LoginView, RegisterView, StaffInviteAcceptView, GoogleCallbackView.
    """
    payload = {
        **_issue_tokens(user),
        "user": _serialize_me(user),
        "redirect_to": redirect_to,
    }
    if extra:
        payload.update(extra)
    return Response(payload, status=http_status)


def _send_html_email(
    subject: str,
    text_body: str,
    to_email: str,
    html_body: str | None = None,
    *,
    fail_silently: bool = True,
) -> None:
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    if html_body:
        msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=fail_silently)


class CsrfBootstrapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        get_token(request)
        return Response({"detail": "ok"})


# ─────────────────────────────────────────────────────────────────────────────
# Registration / Email verification
# ─────────────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = CustomerRegisterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {
                    "detail": _flatten_errors(serializer.errors),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()

        # ✅ FIX #3: Also log in via session for Django admin compatibility
        django_login(
            request,
            user,
            backend="django.contrib.auth.backends.ModelBackend",
        )
        request.session["device_mode"] = "customer"

        # ✅ FIX #3: Return JWT tokens so the SPA can authenticate API calls.
        return _auth_response(
            user,
            redirect_to=user.redirect_path,
            extra={"verify_required": True},
            http_status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [IsPendingVerification]
    authentication_classes = DUAL_AUTH  # ✅ FIX #4

    def post(self, request):
        serializer = VerifyEmailSerializer(
            data=request.data,
            context={"request": request},
        )
        if not serializer.is_valid():
            return Response(
                {
                    "detail": _flatten_errors(serializer.errors),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()

        return Response({
            "user": _serialize_me(user),
            "redirect_to": user.redirect_path,
            "already_verified": bool(
                serializer.validated_data.get("already_verified")
            ),
        })


class ResendVerificationView(APIView):
    permission_classes = [IsPendingVerification]
    authentication_classes = DUAL_AUTH  # ✅ FIX #4

    def post(self, request):
        serializer = ResendVerificationSerializer(
            data=request.data,
            context={"request": request},
        )
        if not serializer.is_valid():
            return Response(
                {"detail": _flatten_errors(serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save()

        return Response({
            "detail": "A new code is on its way. Check your inbox.",
            "resend_in": int(EmailVerificationCode.RESEND_COOLDOWN.total_seconds()),
        })


# ─────────────────────────────────────────────────────────────────────────────
# Login / Logout
# ─────────────────────────────────────────────────────────────────────────────

class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]
    authentication_classes = DUAL_AUTH  # ✅ FIX #5

    def post(self, request):
        current_mode = request.session.get("device_mode")
        if request.user.is_authenticated and current_mode == "admin":
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
        is_admin = _is_admin_role(user)

        # Keep Django session for admin site compatibility
        django_login(request, user)
        request.session["device_mode"] = "admin" if is_admin else "customer"

        remember = bool(
            request.data.get("remember")
            or request.data.get("remember_me")
            or request.data.get("rememberMe")
        )
        if remember:
            request.session.set_expiry(60 * 60 * 24 * 30)
        else:
            request.session.set_expiry(0)

        redirect_to = (
            getattr(user, "redirect_path", None)
            or (DEFAULT_ADMIN_LOGIN_REDIRECT if is_admin
                else DEFAULT_CUSTOMER_LOGIN_REDIRECT)
        )

        # ✅ FIX #5: Return access/refresh so the SPA has JWTs too.
        return _auth_response(user, redirect_to=redirect_to)


class LogoutView(APIView):
    """
    ✅ FIX #6: Logs out BOTH the session and blacklists the JWT refresh token.
    The frontend should POST { "refresh": "<token>" } if it has one.
    """
    permission_classes = [AllowAny]
    authentication_classes = DUAL_AUTH

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                # Token was already expired or invalid — ignore.
                pass

        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Current user / profile / password
# ─────────────────────────────────────────────────────────────────────────────

class MeView(APIView):
    """
    ✅ FIX #7: Uses IsAuthenticated + DUAL_AUTH so this endpoint works with
    EITHER a session cookie OR an Authorization: Bearer <jwt> header.
    This is the endpoint that was returning 401 after Google login.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = DUAL_AUTH

    def get(self, request):
        return Response(_serialize_me(request.user))


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]           # ✅ FIX #8
    authentication_classes = DUAL_AUTH

    def get(self, request):
        return Response(CustomerProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = CustomerProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        if not serializer.is_valid():
            return Response(
                {
                    "detail": _flatten_errors(serializer.errors),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(serializer.data)

    def put(self, request):
        return self.patch(request)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]           # ✅ FIX #8
    authentication_classes = DUAL_AUTH

    def post(self, request):
        if not request.user.has_usable_password():
            return Response(
                {
                    "detail": (
                        "This account uses Google sign-in and has no password. "
                        "Use Forgot password to set one."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        ser = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        if not ser.is_valid():
            return Response(
                {
                    "detail": _flatten_errors(ser.errors),
                    "errors": ser.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser.save(request=request)
        return Response({"detail": "Password updated."})


# ─────────────────────────────────────────────────────────────────────────────
# Forgot / Reset password
# ─────────────────────────────────────────────────────────────────────────────

class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        user = User.objects.filter(email=email).first()

        if user and user.is_active and user.has_usable_password():
            now = timezone.now()
            PasswordResetToken.objects.filter(
                user=user, used_at__isnull=True,
            ).update(used_at=now)

            reset = PasswordResetToken.objects.create(
                user=user,
                expires_at=PasswordResetToken.default_expiry(),
                requested_ip=self._client_ip(request),
            )

            if _is_admin_role(user):
                path = "/admin/reset-password"
                subject = f"Reset your admin password — {settings.SHOP_NAME}"
            else:
                path = "/auth/reset-password"
                subject = f"Reset your password — {settings.SHOP_NAME}"

            url = f"{settings.FRONTEND_URL}{path}?token={reset.token}"

            text_body = (
                f"Hi,\n\n"
                f"Someone requested a password reset for your {settings.SHOP_NAME} "
                f"account. Click the link below to set a new password:\n\n"
                f"{url}\n\n"
                f"This link expires in 30 minutes and can only be used once.\n\n"
                f"If you didn't request this, you can safely ignore this email "
                f"— your password will remain unchanged.\n\n"
                f"— {settings.SHOP_NAME}"
            )

            _send_html_email(
                subject=subject,
                text_body=text_body,
                to_email=user.email,
            )

        return Response({"detail": GENERIC_FORGOT_MESSAGE})

    @staticmethod
    def _client_ip(request) -> str | None:
        xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")


class VerifyResetTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "")
        serializer = VerifyResetTokenSerializer(data={"token": token})
        if not serializer.is_valid():
            return Response(
                {"detail": _flatten_errors(serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"valid": True})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "detail": _flatten_errors(serializer.errors),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response({"detail": "Password has been reset. Please sign in."})


# ─────────────────────────────────────────────────────────────────────────────
# Google OAuth
# ─────────────────────────────────────────────────────────────────────────────

class GoogleStartView(APIView):
    """
    ✅ FIX #9: Uses signed state (via .google.new_state) that embeds the
    `next` path. No more session-stored state → works even when the session
    cookie is dropped between /auth/google/ and /auth/google/callback/.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if request.session.get("device_mode") == "admin":
            return redirect(f"{settings.FRONTEND_URL}{DEFAULT_ADMIN_LOGIN_REDIRECT}")

        nxt = _safe_next(request.query_params.get("next")) or DEFAULT_CUSTOMER_REDIRECT

        # new_state(next_path) should sign and return a string.
        state = new_state(nxt)
        return redirect(build_authorize_url(state))


class GoogleCallbackView(APIView):
    """
    ✅ FIX #10: Complete rewrite of the redirect logic.

    1. Reads next_path from signed state instead of session.
    2. Redirects to a DEDICATED /auth/callback route on the frontend
       (not to `next_path` directly, which would silently drop the
       #access=... fragment).
    3. Includes the serialized user in the fragment so the frontend
       can hydrate immediately without a second round trip.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from urllib.parse import urlencode
        import json as _json

        if request.session.get("device_mode") == "admin":
            return redirect(f"{settings.FRONTEND_URL}{DEFAULT_ADMIN_LOGIN_REDIRECT}")

        def back(error: str | None = None, next_path: str = DEFAULT_CUSTOMER_REDIRECT):
            target = f"{settings.FRONTEND_URL}{next_path}"
            if error:
                sep = "&" if "?" in target else "?"
                target = f"{target}{sep}error={error}"
            return redirect(target)

        # Error returned by Google itself
        if request.query_params.get("error"):
            return back("google")

        # ✅ FIX #10a: Read next_path from signed state (no session dependency)
        state = request.query_params.get("state") or ""
        next_path = read_state(state) if state else None
        if not next_path:
            return back("state")
        next_path = _safe_next(next_path) or DEFAULT_CUSTOMER_REDIRECT

        code = request.query_params.get("code")
        if not code:
            return back("code", next_path)

        try:
            token_data = exchange_code(code)
            userinfo = fetch_userinfo(token_data["access_token"])
        except Exception:
            return back("exchange", next_path)

        email = (userinfo.get("email") or "").strip().lower()
        sub = userinfo.get("sub") or ""
        email_verified = bool(userinfo.get("email_verified"))

        if not email or not email_verified:
            return back("email", next_path)

        existing = User.objects.filter(email=email).first()
        if existing and _is_admin_role(existing):
            return back("admin_email", next_path)

        if existing and (
            not existing.is_active
            or getattr(existing, "status", None) == Status.SUSPENDED
        ):
            return back("google", next_path)

        if existing:
            user = existing
            update_fields = []
            if not user.google_sub:
                user.google_sub = sub
                update_fields.append("google_sub")
            if not user.is_email_verified:
                user.is_email_verified = True
                user.email_verified_at = timezone.now()
                update_fields += ["is_email_verified", "email_verified_at"]
            if user.status == Status.PENDING:
                user.status = Status.ACTIVE
                update_fields.append("status")
            if update_fields:
                user.save(update_fields=update_fields)
        else:
            user = User.objects.create_user(
                email=email,
                password=None,
                role=Role.CUSTOMER,
                status=Status.ACTIVE,
                is_email_verified=True,
                email_verified_at=timezone.now(),
                google_sub=sub,
                first_name=userinfo.get("given_name", "") or "",
                last_name=userinfo.get("family_name", "") or "",
            )

        # Also open a Django session (for admin site compatibility)
        django_login(
            request,
            user,
            backend="django.contrib.auth.backends.ModelBackend",
        )
        request.session["device_mode"] = "customer"

        tokens = _issue_tokens(user)

        is_admin = _is_admin_role(user)
        redirect_to = (
            getattr(user, "redirect_path", None)
            or (DEFAULT_ADMIN_LOGIN_REDIRECT if is_admin
                else DEFAULT_CUSTOMER_REDIRECT)
        )

        # ✅ FIX #10b: Land on /auth/callback, not next_path. The frontend
        # handler stores tokens, then navigates to `next`.
        fragment = urlencode({
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "redirect_to": redirect_to,
            "next": next_path,
            "user": _json.dumps(_serialize_me(user), separators=(",", ":")),
        })

        return redirect(f"{settings.FRONTEND_URL}/auth/callback#{fragment}")


# ─────────────────────────────────────────────────────────────────────────────
# Staff invites
# ─────────────────────────────────────────────────────────────────────────────

class StaffInviteVerifyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "").strip()
        if not token:
            return Response(
                {"detail": "Missing invite token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invite = (
            StaffInvite.objects
            .select_related("invited_by")
            .filter(token=token)
            .first()
        )

        if not invite or not invite.is_valid:
            return Response(
                {"detail": "Invalid or expired invite."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "valid": True,
            "email": invite.email,
            "name": invite.name,
            "role": invite.role,
            "department": invite.department,
            "invited_by": (
                _display_name(invite.invited_by)
                if invite.invited_by else None
            ),
            "expires_at": invite.expires_at,
        })


class StaffInviteAcceptView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        token = (request.data.get("token") or "").strip()
        password = request.data.get("password") or ""
        password_confirm = (
            request.data.get("password_confirm")
            or request.data.get("confirm_password")
            or ""
        )
        phone = (request.data.get("phone") or "").strip()

        if not token:
            return Response(
                {"detail": "Invite token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not password:
            return Response(
                {"detail": "Password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if password != password_confirm:
            return Response(
                {"detail": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(password)
        except ValidationError as exc:
            return Response(
                {"detail": list(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invite = StaffInvite.objects.filter(token=token).first()
        if not invite or not invite.is_valid:
            return Response(
                {"detail": "Invalid or expired invite."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=invite.email).exists():
            return Response(
                {"detail": "An account with this email already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            name_parts = (invite.name or "").split(maxsplit=1)
            first_name = name_parts[0] if name_parts else ""
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            auth_role = (
                Role.OWNER if invite.role == "Administrator" else Role.STAFF
            )

            user = User.objects.create_user(
                email=invite.email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=auth_role,
                status=Status.ACTIVE,
                phone=phone,
                is_email_verified=True,
                email_verified_at=timezone.now(),
            )

            StaffProfile.objects.create(
                user=user,
                name=invite.name,
                role=invite.role,
                status=UserStatus.ACTIVE,
                department=invite.department,
            )

            invite.mark_accepted(user)

        django_login(
            request,
            user,
            backend="django.contrib.auth.backends.ModelBackend",
        )
        request.session["device_mode"] = "admin"

        redirect_to = ROLE_DASHBOARD_MAP.get(invite.role, "/admin")

        # ✅ FIX #11: Return JWT tokens for the admin dashboard SPA.
        return _auth_response(
            user,
            redirect_to=redirect_to,
            http_status=status.HTTP_201_CREATED,
        )


class StaffInviteListCreateView(APIView):
    permission_classes = [IsAdminRole]
    authentication_classes = DUAL_AUTH  # ✅ FIX #12

    def get(self, request):
        qs = (
            StaffInvite.objects
            .select_related("invited_by", "accepted_by")
            .order_by("-created_at")
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        return Response([
            {
                "id": str(inv.id),
                "email": inv.email,
                "name": inv.name,
                "role": inv.role,
                "department": inv.department,
                "status": inv.status,
                "invited_by": (
                    _display_name(inv.invited_by)
                    if inv.invited_by else None
                ),
                "accepted_by": (
                    _display_name(inv.accepted_by)
                    if inv.accepted_by else None
                ),
                "created_at": inv.created_at,
                "expires_at": inv.expires_at,
                "accepted_at": inv.accepted_at,
                "cancelled_at": inv.cancelled_at,
                "is_valid": inv.is_valid,
            }
            for inv in qs
        ])

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        role = request.data.get("role") or ""
        name = (request.data.get("name") or "").strip()
        department = (request.data.get("department") or "").strip()
        message = (request.data.get("message") or "").strip()

        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not name:
            return Response(
                {"detail": "Name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role not in STAFF_ROLES:
            return Response(
                {
                    "detail": (
                        f"Role must be one of: {', '.join(STAFF_ROLES)}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {
                    "detail": (
                        "An account with this email already exists. "
                        "Change their role in the Users page instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        if StaffInvite.objects.filter(
            email=email, status=InviteStatus.PENDING,
        ).exists():
            return Response(
                {
                    "detail": (
                        "A pending invite already exists for this email. "
                        "Resend it or cancel it first."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            invite = StaffInvite.objects.create(
                email=email,
                name=name,
                role=role,
                department=department,
                message=message,
                invited_by=request.user,
                expires_at=StaffInvite.default_expiry(),
            )

        from dashboard.users.tasks import send_invite_email
        transaction.on_commit(
            lambda: send_invite_email.delay(str(invite.id))
        )

        return Response(
            {
                "id": str(invite.id),
                "email": invite.email,
                "name": invite.name,
                "role": invite.role,
                "department": invite.department,
                "status": invite.status,
                "expires_at": invite.expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


class StaffInviteDetailView(APIView):
    permission_classes = [IsAdminRole]
    authentication_classes = DUAL_AUTH  # ✅ FIX #12

    def post(self, request, invite_id):
        try:
            invite = StaffInvite.objects.get(pk=invite_id)
        except StaffInvite.DoesNotExist:
            return Response(
                {"detail": "Invite not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invite.status == InviteStatus.ACCEPTED:
            return Response(
                {"detail": "This invite has already been accepted."},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            invite.mark_cancelled()

            new_invite = StaffInvite.objects.create(
                email=invite.email,
                name=invite.name,
                role=invite.role,
                department=invite.department,
                message=invite.message,
                invited_by=request.user,
                expires_at=StaffInvite.default_expiry(),
            )

        from dashboard.users.tasks import send_invite_email
        transaction.on_commit(
            lambda: send_invite_email.delay(str(new_invite.id))
        )

        return Response(
            {
                "id": str(new_invite.id),
                "email": new_invite.email,
                "name": new_invite.name,
                "role": new_invite.role,
                "status": new_invite.status,
                "expires_at": new_invite.expires_at,
            }
        )

    def delete(self, request, invite_id):
        try:
            invite = StaffInvite.objects.get(pk=invite_id)
        except StaffInvite.DoesNotExist:
            return Response(
                {"detail": "Invite not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invite.status == InviteStatus.ACCEPTED:
            return Response(
                {"detail": "Can't cancel an accepted invite."},
                status=status.HTTP_409_CONFLICT,
            )

        invite.mark_cancelled()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# JWT endpoints
# ─────────────────────────────────────────────────────────────────────────────

class JWTObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class JWTRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class JWTLogoutView(APIView):
    """
    Deprecated: use LogoutView instead, which also clears the Django session.
    Kept for backwards compatibility with existing frontend calls.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class JWTVerifyMeView(APIView):
    """
    JWT-only mirror of MeView. Kept for backwards compatibility.
    New frontend code should call /auth/me/ (which now supports both).
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        return Response(_serialize_me(request.user))