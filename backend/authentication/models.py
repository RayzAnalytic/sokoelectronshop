import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


# ══════════════════════════════════════════════════════════════════════════
# ENUMS
# ══════════════════════════════════════════════════════════════════════════

class Role(models.TextChoices):
    OWNER = "OWNER", "Owner"
    STAFF = "STAFF", "Staff"
    CUSTOMER = "CUSTOMER", "Customer"


class Status(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    PENDING = "PENDING", "Pending verification"


# ══════════════════════════════════════════════════════════════════════════
# USER
# ══════════════════════════════════════════════════════════════════════════

class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    # Primary contact number. Used for checkout, addresses, and delivery.
    # Indexed because the register flow checks "phone already in use?" on
    # every signup — without an index, that's a full table scan.
    phone = models.CharField(max_length=32, blank=True, default="", db_index=True)

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    is_email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    google_sub = models.CharField(max_length=255, blank=True, default="", db_index=True)

    # Set only when the user was created via an admin invite. Null for
    # self-registered customers and Google signups. Answers "who invited
    # this staff member?" without a join through UserInvite.
    invited_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invited_users",
    )

    # ── Communication preferences ──
    whatsapp_updates = models.BooleanField(default=True)
    email_promotions = models.BooleanField(default=True)
    sms_promotions = models.BooleanField(default=False)
    newsletter = models.BooleanField(default=False)

    # ── Account deletion (soft-delete) ──
    deletion_requested_at = models.DateTimeField(null=True, blank=True)

    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        indexes = [models.Index(fields=["role", "status"])]
        constraints = [
            # Prevent two non-empty phones from colliding. Empty phones are
            # allowed to repeat (Google-only signups that never set a phone).
            models.UniqueConstraint(
                fields=["phone"],
                condition=~models.Q(phone=""),
                name="unique_nonempty_phone",
            ),
        ]

    def __str__(self):
        return self.email

    # ── Role helpers ──
    @property
    def is_admin_role(self) -> bool:
        return self.role in (Role.OWNER, Role.STAFF)

    @property
    def is_customer(self) -> bool:
        return self.role == Role.CUSTOMER

    # ── Redirect target after login ──
    # Serializers expose this as `redirect_to` (the API contract the
    # frontend expects). The model keeps its original name so nothing
    # internal breaks.
    @property
    def redirect_path(self) -> str:
        return "/admin" if self.is_admin_role else "/pages/account"

    # ── Usability helpers ──
    @property
    def can_sign_in(self) -> bool:
        return self.is_active and self.status == Status.ACTIVE

    @property
    def has_usable_password(self) -> bool:
        """False for Google-only users who have no password set."""
        return super().has_usable_password()


# ══════════════════════════════════════════════════════════════════════════
# STAFF INVITATIONS
# ══════════════════════════════════════════════════════════════════════════

def generate_invite_token() -> str:
    """Cryptographically strong URL-safe token (32 bytes → 43 chars)."""
    return secrets.token_urlsafe(32)


class UserInvite(models.Model):
    """
    An invitation for someone to create a staff/owner account.

    Created by an OWNER or STAFF user. Carries the intended role, the
    email the invite was sent to, and a one-time token. The invited
    person clicks a link containing the token; the backend reads the
    role from this row — never from the client.

    Two different register paths exist:
      • Public customer register  → role hard-coded to CUSTOMER
      • Staff invite accept       → role read from this row

    The client cannot influence role in either case.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        CANCELLED = "CANCELLED", "Cancelled"
        EXPIRED = "EXPIRED", "Expired"

    # Who is being invited.
    email = models.EmailField(db_index=True)

    # What role they'll get on acceptance. Restricted to admin roles —
    # you cannot invite someone as CUSTOMER through this flow; use the
    # public register endpoint for that.
    role = models.CharField(
        max_length=20,
        choices=[
            (Role.OWNER, "Owner"),
            (Role.STAFF, "Staff"),
        ],
    )

    # Optional display name to prefill on the acceptance form.
    invited_name = models.CharField(max_length=150, blank=True)

    # One-time token. Unique. Never reused.
    token = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        default=generate_invite_token,
    )

    # Lifecycle.
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_invites",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    # Who accepted it (set at acceptance time — the User created from it).
    accepted_by = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accepted_invite",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "status"]),
            models.Index(fields=["status", "expires_at"]),
        ]
        constraints = [
            # Only one PENDING invite per email at a time. Cancelled or
            # accepted invites don't block a re-invite.
            models.UniqueConstraint(
                fields=["email"],
                condition=models.Q(status="PENDING"),
                name="unique_pending_invite_per_email",
            ),
        ]

    def __str__(self):
        return f"Invite({self.email} as {self.role}, {self.status})"

    # ── Helpers ──
    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_usable(self) -> bool:
        return self.status == self.Status.PENDING and not self.is_expired

    @classmethod
    def default_expiry(cls):
        return timezone.now() + timedelta(days=7)


# ══════════════════════════════════════════════════════════════════════════
# PASSWORD RESET TOKENS
# ══════════════════════════════════════════════════════════════════════════

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


class PasswordResetToken(models.Model):
    """
    A one-time token for resetting a user's password.

    The frontend link is:
        {FRONTEND_URL}/auth/reset-password?token=<token>

    Only the `token` is sent in the URL — no `uid`. So we store the
    user FK on this row and look it up server-side. This avoids leaking
    the user ID in the email and keeps the URL short.

    Tokens expire after 30 minutes and cannot be reused.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )
    token = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        default=generate_reset_token,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    # Audit: which IP requested the reset (useful if abuse is suspected).
    requested_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self):
        return f"Reset({self.user.email}, used={bool(self.used_at)})"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_usable(self) -> bool:
        return self.used_at is None and not self.is_expired

    @classmethod
    def default_expiry(cls):
        return timezone.now() + timedelta(minutes=30)