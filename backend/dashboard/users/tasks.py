# dashboard/users/tasks.py

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from .models import InviteStatus, StaffInvite


# ─────────────────────────────────────────────────────────────
# Email helper — mirrors authentication/views.py::_send_html_email
#
# Anymail routes every Django email through SendGrid's v3 API. The
# backend is configured in settings; this file just builds the
# message and calls .send(). Never import `sendgrid` directly — the
# SDK bypasses Anymail, ignores the sandbox setting, and duplicates
# configuration.
# ─────────────────────────────────────────────────────────────
def _send_html_email(
    subject: str,
    text_body: str,
    to_email: str,
    html_body: str | None = None,
) -> None:
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    if html_body:
        msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)


def _inviter_name(user) -> str:
    """
    Compose a display name for the user who sent an invite.

    The project's custom User model has no `.name` and no
    `get_full_name()` — build from first_name + last_name, then
    fall back to email, then a generic label.
    """
    if not user:
        return "The team"

    first = getattr(user, "first_name", "") or ""
    last = getattr(user, "last_name", "") or ""
    composed = f"{first} {last}".strip()
    if composed:
        return composed

    email = getattr(user, "email", "") or ""
    return email or "The team"


# ─────────────────────────────────────────────────────────────
# Staff invite email
# ─────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_invite_email(self, invite_id):
    try:
        invite = StaffInvite.objects.select_related("invited_by").get(id=invite_id)
    except StaffInvite.DoesNotExist:
        return

    # No-op for anything that isn't a fresh pending invite. Retries
    # shouldn't resurrect a cancelled or already-accepted link.
    if invite.status != InviteStatus.PENDING:
        return

    accept_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"{settings.STAFF_INVITE_ACCEPT_PATH}?token={invite.token}"
    )

    context = {
        "name":       invite.name,
        "email":      invite.email,
        "role":       invite.role,
        "department": invite.department,
        "inviter":    _inviter_name(invite.invited_by),
        "message":    invite.message,
        "accept_url": accept_url,
        "expires_at": invite.expires_at,
        "expires_in": f"{settings.STAFF_INVITE_TTL_DAYS} days",
        "shop_name":  settings.SHOP_NAME,
    }

    # Render from the template if it exists; fall back to inline HTML
    # so a missing template doesn't burn 3 retries and drop the email.
    try:
        html = render_to_string("users/staff_invite.html", context)
    except Exception:
        html = _fallback_invite_html(context)

    text = (
        f"Hi {invite.name},\n\n"
        f"{context['inviter']} has invited you to join {settings.SHOP_NAME} "
        f"as {invite.role}.\n\n"
        f"Set up your account here:\n{accept_url}\n\n"
        f"This invite expires in {settings.STAFF_INVITE_TTL_DAYS} days.\n\n"
        f"— {settings.SHOP_NAME}"
    )

    try:
        _send_html_email(
            subject=f"You're invited to {settings.SHOP_NAME} as {invite.role}",
            text_body=text,
            html_body=html,
            to_email=invite.email,
        )
    except Exception as exc:
        raise self.retry(exc=exc)


def _fallback_invite_html(ctx: dict) -> str:
    """Minimal HTML for when the template file isn't deployed yet."""
    department_line = (
        f'<p style="color:#475569;margin:4px 0;">Department: '
        f'<strong>{ctx["department"]}</strong></p>'
        if ctx.get("department") else ""
    )
    message_block = (
        f'<blockquote style="border-left:3px solid #cbd5e1;margin:16px 0;'
        f'padding:8px 16px;color:#64748b;">{ctx["message"]}</blockquote>'
        if ctx.get("message") else ""
    )

    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;">
      <h2 style="color:#0f172a;">You've been invited to {ctx["shop_name"]}</h2>
      <p style="color:#475569;">Hi <strong>{ctx["name"]}</strong>,</p>
      <p style="color:#475569;">
        <strong>{ctx["inviter"]}</strong> has invited you to join
        <strong>{ctx["shop_name"]}</strong> as <strong>{ctx["role"]}</strong>.
      </p>
      {department_line}
      {message_block}
      <p style="color:#475569;">Click the button below to set up your account:</p>
      <a href="{ctx["accept_url"]}"
         style="display:inline-block;background:#1e3a8a;color:#fff;
                padding:12px 20px;border-radius:4px;text-decoration:none;
                font-weight:600;">
        Accept invitation
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        This invite expires on {ctx["expires_at"]:%Y-%m-%d}. If you didn't
        expect this email, you can safely ignore it.
      </p>
    </div>
    """


# ─────────────────────────────────────────────────────────────
# Password reset email
#
# Uses the auth app's PasswordResetToken so both staff and customer
# reset flows create the same kind of row and use the same URL:
#     {FRONTEND_URL}/auth/reset-password?token=<token>
#     {FRONTEND_URL}/admin/reset-password?token=<token>   (staff)
# ─────────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email(self, user_id):
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    from authentication.models import PasswordResetToken

    # Invalidate any previous outstanding tokens — only the newest
    # link should be live, matching ForgotPasswordView's behaviour.
    PasswordResetToken.objects.filter(
        user=user, used_at__isnull=True,
    ).update(used_at=timezone.now())

    reset = PasswordResetToken.objects.create(
        user=user,
        expires_at=PasswordResetToken.default_expiry(),
    )

    is_staff = hasattr(user, "staff_profile")
    path = "/admin/reset-password" if is_staff else "/auth/reset-password"
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}{path}?token={reset.token}"

    subject = (
        f"Reset your admin password — {settings.SHOP_NAME}"
        if is_staff else
        f"Reset your password — {settings.SHOP_NAME}"
    )

    text = (
        f"Hi,\n\n"
        f"Someone requested a password reset for your {settings.SHOP_NAME} "
        f"account. Click the link below to set a new password:\n\n"
        f"{reset_url}\n\n"
        f"This link expires in 30 minutes and can only be used once.\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— {settings.SHOP_NAME}"
    )

    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;">
      <h2 style="color:#0f172a;">Reset your {settings.SHOP_NAME} password</h2>
      <p style="color:#475569;">Hi <strong>{user.email}</strong>,</p>
      <p style="color:#475569;">Click the button below to set a new password:</p>
      <a href="{reset_url}"
         style="display:inline-block;background:#1e3a8a;color:#fff;
                padding:12px 20px;border-radius:4px;text-decoration:none;
                font-weight:600;">
        Reset password
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        This link expires in 30 minutes and can only be used once.
        If you didn't request this, you can safely ignore the email.
      </p>
    </div>
    """

    try:
        _send_html_email(
            subject=subject,
            text_body=text,
            html_body=html,
            to_email=user.email,
        )
    except Exception as exc:
        raise self.retry(exc=exc)


# ─────────────────────────────────────────────────────────────
# Housekeeping — sweep expired unaccepted invites
#
# Marks PENDING invites as EXPIRED; doesn't delete. Preserves the
# audit trail and matches InviteStatus. Runs hourly via Celery Beat.
# ─────────────────────────────────────────────────────────────
@shared_task
def sweep_expired_invites():
    """
    Flip every PENDING invite whose `expires_at` has passed to
    EXPIRED. Returns the number of rows affected.
    """
    count = StaffInvite.expire_overdue()
    return {"expired": count}