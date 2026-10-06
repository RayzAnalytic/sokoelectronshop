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
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .google import build_authorize_url, exchange_code, fetch_userinfo, new_state
from .models import (
    PasswordResetToken,
    Role,
    Status,
    User,
)
from .permissions import IsAdminRole
from .serializers import (
    ChangePasswordSerializer,
    CustomerProfileSerializer,
    CustomerRegisterSerializer,
    ForgotPasswordSerializer,
    GENERIC_LOGIN_ERROR,
    LoginSerializer,
    MeSerializer,
    ResetPasswordSerializer,
    VerifyResetTokenSerializer,
)
from .throttles import LoginThrottle, PasswordResetThrottle

# ── Invite handling lives in dashboard.users ─────────────────────
# The StaffInvite model, its status enum, and the StaffProfile that
# every accepted invite creates all live there. The auth app just
# serves the HTTP endpoints that verify and accept them.
from dashboard.users.constants import ROLE_DASHBOARD_MAP, STAFF_ROLES
from dashboard.users.models import (
    InviteStatus,
    StaffInvite,
    StaffProfile,
    UserStatus,
)

GENERIC_FORGOT_MESSAGE = "If that email exists, a reset link has been sent."

# Where OAuth sends the user when no explicit `next` is provided.
DEFAULT_CUSTOMER_REDIRECT = "/pages/account"

# Where a signed-in CUSTOMER lands after a successful password login.
DEFAULT_CUSTOMER_LOGIN_REDIRECT = "/pages/account"

# Where OWNER/STAFF land after login when their `redirect_path` is empty.
DEFAULT_ADMIN_LOGIN_REDIRECT = "/admin"


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


def _is_admin_role(user) -> bool:
    """
    OWNER/STAFF are 'admin' for our purposes. CUSTOMER is not.
    Uses the model's own property when present, falls back to the
    role field so this module doesn't hard-depend on the property's
    name.
    """
    if hasattr(user, "is_admin_role"):
        return bool(user.is_admin_role)
    return getattr(user, "role", None) in (Role.OWNER, Role.STAFF)


def _flatten_errors(errors) -> str:
    """
    Collapse a DRF serializer error tree into a single human string
    so the frontend's `detail` parser gets something usable.
    Priority: non_field_errors → first field error → "Invalid input."
    """
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
    """
    Uniform 401 body. DRF's `IsAuthenticated` downgrades its 401 to a
    403 when the authentication class doesn't send a `WWW-Authenticate`
    header — which `SessionAuthentication` doesn't. That turns every
    signed-out page mount into six `Forbidden` lines in the runserver
    log. Returning the 401 explicitly keeps the log clean and the
    semantics honest.
    """
    return Response(
        {"detail": "Not authenticated."},
        status=status.HTTP_401_UNAUTHORIZED,
    )


def _display_name(user) -> str:
    """
    Best-effort human name for the current user.

    The project's custom `authentication.User` model does NOT implement
    Django's `get_full_name()` (it inherits AbstractBaseUser, not
    AbstractUser), so we compose the name from `first_name` +
    `last_name` directly. Every lookup is `getattr`-guarded so a future
    model change can never turn this into a 500.

    Fallback chain:
        first_name + last_name → username → email → em-dash
    """
    first = getattr(user, "first_name", "") or ""
    last = getattr(user, "last_name", "") or ""
    composed = f"{first} {last}".strip()
    if composed:
        return composed

    # Optional methods — guarded in case the model drops them.
    for method in ("get_username", "get_short_name"):
        fn = getattr(user, method, None)
        if callable(fn):
            try:
                value = fn()
                if value:
                    return str(value)
            except Exception:
                # Never let a name helper take down an auth endpoint.
                pass

    email = getattr(user, "email", "") or ""
    return email or "—"


def _serialize_me(user) -> dict:
    """
    Return MeSerializer output with a guaranteed `name` key.

    The admin sidebar and header read `name` to render the account
    chip. If MeSerializer doesn't expose one, we compute it here so
    the frontend never has to know about `first_name` / `last_name`
    or which of the possible shapes the serializer happens to produce.

    Safe to call from every view that returns the current user:
    register, login, /me/, staff-invite accept.
    """
    data = dict(MeSerializer(user).data)
    if not data.get("name"):
        data["name"] = _display_name(user)
    return data


def _send_html_email(
    subject: str,
    text_body: str,
    to_email: str,
    html_body: str | None = None,
    *,
    fail_silently: bool = True,
) -> None:
    """
    One place for outbound transactional email.

    Anymail routes every Django email through SendGrid's v3 API —
    never import the SendGrid SDK directly, it bypasses Anymail's
    configuration.

    `fail_silently` defaults to True for password resets (anti-
    enumeration: a SendGrid outage shouldn't hint at valid emails).
    Invites pass False so a broken transport surfaces as a 500 and
    the admin retries.
    """
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    if html_body:
        msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=fail_silently)


# ─────────────────────────────────────────────────────────────────────────────
# CSRF bootstrap (called once by the frontend on load)
# ─────────────────────────────────────────────────────────────────────────────
class CsrfBootstrapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        get_token(request)  # forces Set-Cookie: csrftoken
        return Response({"detail": "ok"})


# ─────────────────────────────────────────────────────────────────────────────
# Register — CUSTOMER self-service sign-up
# ─────────────────────────────────────────────────────────────────────────────
class RegisterView(APIView):
    """
    POST /api/v1/auth/register/

    Body: { email, phone, password, confirm_password? }

    Response: { user: Me, redirect_to: str }  → 201

    Only creates CUSTOMER accounts. `role`, `status`, `is_staff`, and
    `is_superuser` are forced in the serializer's create() — they are
    never read from request.data, so a crafted payload cannot escalate
    a customer into admin. OWNER/STAFF are seeded out-of-band.

    Auto-logs the customer in after registration and returns their
    redirect target so the frontend can bounce them to /pages/account.

    Errors:
      * 400 — validation (weak password, bad email, missing phone)
      * 403 — email belongs to an OWNER/STAFF record (ReservedEmail)
      * 409 — email or phone already belongs to a CUSTOMER (Conflict)
    """
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

        # Auto sign-in — drop this if you switch to email verification
        # (then set status=PENDING in the serializer's create() and
        # route the frontend to a "check your inbox" page instead).
        django_login(
            request,
            user,
            backend="django.contrib.auth.backends.ModelBackend",
        )
        request.session["device_mode"] = "customer"

        return Response(
            {
                "user": _serialize_me(user),
                "redirect_to": user.redirect_path,
            },
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Login — serves both customers and staff
# ─────────────────────────────────────────────────────────────────────────────
class LoginView(APIView):
    """
    POST /api/v1/auth/login/

    Body: { email, password, remember? }

    Response: { user: Me, redirect_to: str }

    The same endpoint serves CUSTOMERs and OWNER/STAFF. The response's
    `redirect_to` field tells the frontend where to send them:

      * OWNER/STAFF   → their stored `redirect_path`, or /admin
      * CUSTOMER      → their stored `redirect_path`, or /pages/account

    `device_mode` on the session is set to reflect the role:
      * "admin"    for OWNER/STAFF
      * "customer" for CUSTOMER

    `remember` accepts `remember`, `remember_me`, or `rememberMe` from
    the request body — the frontend uses `rememberMe` in the API layer
    but the underlying helper may snake-case it.
    """
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        # Same-device rule: an admin session on this browser blocks
        # customer logins, and vice versa. Checked BEFORE we try to
        # authenticate so we don't waste a throttle slot on a request
        # that's going to be rejected anyway.
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

        django_login(request, user)
        request.session["device_mode"] = "admin" if is_admin else "customer"

        # "Remember me" controls how long the session survives.
        remember = bool(
            request.data.get("remember")
            or request.data.get("remember_me")
            or request.data.get("rememberMe")
        )
        if remember:
            request.session.set_expiry(60 * 60 * 24 * 30)  # 30 days
        else:
            request.session.set_expiry(0)  # expires at browser close

        redirect_to = (
            getattr(user, "redirect_path", None)
            or (DEFAULT_ADMIN_LOGIN_REDIRECT if is_admin
                else DEFAULT_CUSTOMER_LOGIN_REDIRECT)
        )

        return Response({
            "user": _serialize_me(user),
            "redirect_to": redirect_to,
        })


# ─────────────────────────────────────────────────────────────────────────────
# Logout
# ─────────────────────────────────────────────────────────────────────────────
class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Me — read by api.me() on every page mount, including the success page
# ─────────────────────────────────────────────────────────────────────────────
class MeView(APIView):
    """
    GET /api/v1/auth/me/

    Reads the current session. Returns 200 with the user JSON when
    signed in, 401 when not.

    Deliberately NOT DRF's `IsAuthenticated` permission class: DRF
    downgrades its 401 to a 403 because `SessionAuthentication` doesn't
    send a `WWW-Authenticate` header. That's semantically wrong for
    "not logged in" and turns every signed-out page mount into six
    `Forbidden` lines in the runserver log.

    The frontend's `api.me()` treats both 401 and 403 as "not signed
    in" and returns null, so functionally either would work — this is
    about log hygiene and correct HTTP semantics.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return _unauthorized()
        return Response(_serialize_me(request.user))


# ─────────────────────────────────────────────────────────────────────────────
# Profile — customer self-service read/update
# ─────────────────────────────────────────────────────────────────────────────
class ProfileView(APIView):
    """
    GET   /api/v1/auth/profile/  → full profile
    PATCH /api/v1/auth/profile/  → partial update
    PUT   /api/v1/auth/profile/  → same as PATCH (idempotent convenience)

    Email is read-only here — changing it must go through a verify-email
    flow, not a free-text PATCH. Role, status, and permission flags are
    not in the serializer's field list at all, so they can't be set.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return _unauthorized()
        return Response(CustomerProfileSerializer(request.user).data)

    def patch(self, request):
        if not request.user.is_authenticated:
            return _unauthorized()
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


# ─────────────────────────────────────────────────────────────────────────────
# Change password (authenticated)
# ─────────────────────────────────────────────────────────────────────────────
class ChangePasswordView(APIView):
    """
    POST /api/v1/auth/change-password/

    Body: { current_password, new_password }

    The current password is verified against the stored hash. The
    session is preserved via `update_session_auth_hash` inside the
    serializer — without it, Django would log the user out.

    Errors:
      * 400 — validation errors (weak password, mismatch)
      * 401 — not authenticated
      * 403 — user has no usable password (Google-only account)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if not request.user.is_authenticated:
            return _unauthorized()

        # Google-only users have no password to change.
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
# Forgot / verify / reset password
# ─────────────────────────────────────────────────────────────────────────────
class ForgotPasswordView(APIView):
    """
    POST /api/v1/auth/forgot-password/

    Body: { email }

    Response: always the same generic message, regardless of whether
    the email exists — this prevents account enumeration.

    Sends a reset link to any user (CUSTOMER, OWNER, or STAFF) whose
    email matches. The link target depends on the role:

      * CUSTOMER      → /auth/reset-password on the storefront
      * OWNER/STAFF   → /admin/reset-password on the admin panel

    Google-only users (no usable password) are skipped silently —
    sending them a "reset your password" link would be confusing since
    they never had one. If you want to nudge them toward setting one,
    send a different email; do NOT create a reset token for them.

    The token is a PasswordResetToken row, not Django's default token
    generator. Reason: the frontend's reset page reads only
    `?token=...` from the URL — no uid. Storing the user FK on the row
    lets the backend resolve the user server-side without exposing
    their id in the email link.
    """
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        user = User.objects.filter(email=email).first()

        # Only create a token if the account can actually be reset.
        if user and user.is_active and user.has_usable_password():
            # Invalidate any previous outstanding tokens for this user
            # so only the newest link is valid. This prevents an old
            # leaked link from staying live after the user clicks the
            # "resend" button.
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

        # Always the same response — no enumeration.
        return Response({"detail": GENERIC_FORGOT_MESSAGE})

    @staticmethod
    def _client_ip(request) -> str | None:
        """
        Best-effort client IP for the audit column. Prefer the first
        entry in X-Forwarded-For (proxy chain) if present.
        """
        xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")


class VerifyResetTokenView(APIView):
    """
    GET /api/v1/auth/verify-reset-token/?token=...

    Called by the frontend on mount of /auth/reset-password so it can
    decide whether to show the reset form or the "link expired" screen
    before the user types anything.

    Response:
        200 → { "valid": true }
        400 → { "detail": "Invalid or expired reset link." }
    """
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
    """
    POST /api/v1/auth/reset-password/

    Body: { token, new_password, confirm_password? }

    Response: { "detail": "Password has been reset." }

    Consumes the token: `used_at` is stamped on success, and any other
    pending tokens for the same user are invalidated (a password change
    should kill every outstanding key, not just the one that was used).

    Errors:
        400 → invalid/expired token, or password validation failure
        410 → token was valid on lookup but expired mid-transaction
    """
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
    permission_classes = [AllowAny]

    def get(self, request):
        # An admin session on this browser blocks customer OAuth.
        if request.session.get("device_mode") == "admin":
            return redirect(f"{settings.FRONTEND_URL}{DEFAULT_ADMIN_LOGIN_REDIRECT}")

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
        # An admin session on this browser blocks customer OAuth.
        if request.session.get("device_mode") == "admin":
            return redirect(f"{settings.FRONTEND_URL}{DEFAULT_ADMIN_LOGIN_REDIRECT}")

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
        email_verified = bool(userinfo.get("email_verified"))

        # Reject unverified emails — Google sometimes returns profiles
        # for unverified addresses. The frontend has a specific message
        # for this (`email` error code).
        if not email or not email_verified:
            return back("email")

        existing = User.objects.filter(email=email).first()
        if existing and _is_admin_role(existing):
            # Admin email must never authenticate via Google.
            return back("admin_email")

        # Reject suspended / inactive accounts.
        if existing and (
            not existing.is_active
            or getattr(existing, "status", None) != Status.ACTIVE
        ):
            return back("google")

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
            if update_fields:
                user.save(update_fields=update_fields)
        else:
            user = User.objects.create_user(
                email=email,
                password=None,  # unusable password — Google-only account
                role=Role.CUSTOMER,
                status=Status.ACTIVE,
                is_email_verified=True,
                email_verified_at=timezone.now(),
                google_sub=sub,
                first_name=userinfo.get("given_name", "") or "",
                last_name=userinfo.get("family_name", "") or "",
            )

        django_login(request, user)
        request.session["device_mode"] = "customer"

        return redirect(f"{settings.FRONTEND_URL}{next_path}")


# ─────────────────────────────────────────────────────────────────────────────
# Staff invite — public endpoints
# ─────────────────────────────────────────────────────────────────────────────
class StaffInviteVerifyView(APIView):
    """
    GET /api/v1/auth/invite/verify/?token=...

    Called by the frontend on mount of /auth/staff/register so it can
    show the accept form (with the email locked to the invite) or the
    "expired" screen.

    Response (200):
        {
          "valid": true,
          "email": "...",
          "name": "...",
          "role": "Sales Staff",
          "department": "Sales",
          "invited_by": "Owner Admin",
          "expires_at": "2026-10-13T09:00:00Z"
        }

    Response (400):
        { "detail": "Invalid or expired invite." }

    Reads from `dashboard.users.StaffInvite` — the invite model lives
    there. This view only handles the HTTP lookup.
    """
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
    """
    POST /api/v1/auth/invite/accept/

    Body: { token, password, password_confirm?, phone?, confirm_password? }

    Response: { user: Me, redirect_to: "/admin" }  → 201

    Creates a User AND a StaffProfile in one transaction. The
    StaffProfile's presence is what makes the account "staff" — a
    post_save signal on the model then flips `user.is_staff = True`.

    The email and granular role come from the invite row — the client
    cannot influence either. Auth-level `User.role` is set to OWNER
    for an Administrator invite, STAFF for everyone else.

    The accept view auto-logs the new staff member in — intentional.
    The email link IS the authentication proof.

    Errors:
        400 → invalid/expired invite, weak password, mismatch
        409 → email already belongs to an account
    """
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

        # ── 1. Validate input ────────────────────────────────
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

        # ── 2. Resolve the invite ────────────────────────────
        invite = StaffInvite.objects.filter(token=token).first()
        if not invite or not invite.is_valid:
            return Response(
                {"detail": "Invalid or expired invite."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 3. Guard against existing accounts ───────────────
        if User.objects.filter(email=invite.email).exists():
            return Response(
                {"detail": "An account with this email already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        # ── 4. Create User + StaffProfile atomically ─────────
        with transaction.atomic():
            name_parts = (invite.name or "").split(maxsplit=1)
            first_name = name_parts[0] if name_parts else ""
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            # Auth-level role — OWNER for Administrator, STAFF otherwise.
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

            # The StaffProfile is what makes this user "staff". Its
            # post_save signal flips `user.is_staff` to True.
            StaffProfile.objects.create(
                user=user,
                name=invite.name,
                role=invite.role,
                status=UserStatus.ACTIVE,
                department=invite.department,
            )

            # Mark the invite consumed — this also stamps accepted_by.
            invite.mark_accepted(user)

        # ── 5. Log the new staff member in ───────────────────
        django_login(
            request,
            user,
            backend="django.contrib.auth.backends.ModelBackend",
        )
        request.session["device_mode"] = "admin"

        redirect_to = ROLE_DASHBOARD_MAP.get(invite.role, "/admin")

        return Response(
            {
                "user": _serialize_me(user),
                "redirect_to": redirect_to,
            },
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Staff invite — admin management endpoints
# ─────────────────────────────────────────────────────────────────────────────
class StaffInviteListCreateView(APIView):
    """
    GET  /api/v1/admin/invites/   → list all invites
    POST /api/v1/admin/invites/   → create and send a new invite

    Body: { email, role, name, department?, message? }

    `role` is a granular staff role — one of STAFF_ROLES from
    `dashboard.users.constants`. The frontend sends these values
    directly; the previous version's coarse `'STAFF'/'OWNER'` check
    was mismatched with what the admin UI sends.

    Only accessible by OWNER and STAFF. Inviting someone who already
    has an account is rejected — an admin should change their role
    directly in the Users page instead.

    The email contains a link to:
        {FRONTEND_URL}{STAFF_INVITE_ACCEPT_PATH}?token=<token>
    """
    permission_classes = [IsAdminRole]

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

        # ── Validation ───────────────────────────────────────
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

        # Can't invite an email that already has an account.
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

        # Can't have two pending invites for the same email.
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

        # ── Create + dispatch ────────────────────────────────
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

        # Fire the email via Celery so the HTTP request doesn't block
        # on SendGrid. on_commit ensures the row is visible to the
        # worker when the task runs.
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
    """
    POST   /api/v1/admin/invites/<uuid>/resend/  → regenerate + resend
    DELETE /api/v1/admin/invites/<uuid>/         → cancel (soft)

    `invite_id` is a UUID — the model's primary key. Resend cancels
    the old row and creates a fresh one, so the audit trail shows the
    original attempt alongside its replacement.
    """
    permission_classes = [IsAdminRole]

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

        # Regenerate the token + expiry, cancel the old row, create a
        # fresh one. Same pattern as before, now using the model's
        # explicit transitions.
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