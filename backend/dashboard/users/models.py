import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from .constants import (
    MATRIX_ROLE_CHOICES,
    ROLE_CHOICES,
    ROLE_DASHBOARD_MAP,
)


# ─────────────────────────────────────────────────────────────
# STATUS ENUMS
# ─────────────────────────────────────────────────────────────
class UserStatus(models.TextChoices):
    ACTIVE    = 'Active',    'Active'
    INVITED   = 'Invited',   'Invited'
    SUSPENDED = 'Suspended', 'Suspended'


class InviteStatus(models.TextChoices):
    """
    Lifecycle of a staff invite.

    `is_valid` on the model is derived from this + `expires_at` so
    callers never have to reimplement the logic:

        PENDING   + not expired  → valid
        PENDING   + expired      → invalid (auto-flagged as EXPIRED)
        ACCEPTED                 → invalid
        CANCELLED                → invalid
        EXPIRED                  → invalid
    """
    PENDING   = 'Pending',   'Pending'
    ACCEPTED  = 'Accepted',  'Accepted'
    CANCELLED = 'Cancelled', 'Cancelled'
    EXPIRED   = 'Expired',   'Expired'


# ─────────────────────────────────────────────────────────────
# STAFF PROFILE  (OneToOne extension of authentication.User)
# ─────────────────────────────────────────────────────────────
class StaffProfile(models.Model):
    """
    Staff-only fields layered on top of authentication.User.
    Presence of a StaffProfile row = the user is staff.

    Note on `last_login`:
        We deliberately do NOT store a separate `last_login_at` here.
        Django's `auth.User.last_login` is updated automatically by the
        auth backend on every successful login. Duplicating it invites
        drift. The serializer reads `user.last_login` instead.

    Note on `is_staff`:
        When a StaffProfile is created, the underlying User's
        `is_staff` flag should be set to True — and cleared when the
        profile is deleted. See `dashboard/users/signals.py` for the
        receivers. Doing it via signals (not in `save()`) keeps the
        model layer free of side effects and makes the behaviour
        testable in isolation.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='staff_profile',
        primary_key=True,
    )
    name       = models.CharField(max_length=150)
    role       = models.CharField(max_length=32, choices=ROLE_CHOICES)
    status     = models.CharField(
        max_length=16, choices=UserStatus.choices, default=UserStatus.INVITED,
    )
    department = models.CharField(max_length=64, blank=True)
    avatar     = models.URLField(blank=True)

    class Meta:
        db_table = 'dashboard_staff_profiles'
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.user.email} ({self.role})'

    # ── Role helpers ─────────────────────────────────────────────

    @property
    def is_administrator(self) -> bool:
        return self.role == 'Administrator'

    @property
    def dashboard_url(self) -> str:
        """Where this staff member lands after login."""
        return ROLE_DASHBOARD_MAP.get(self.role, '/admin')

    # ── Lookups ──────────────────────────────────────────────────

    @classmethod
    def for_user(cls, user):
        """
        Return the StaffProfile for `user`, or None if the user is
        not staff. Prefer this over `hasattr(user, 'staff_profile')`
        so the intent is explicit and the query is one call.
        """
        if not user or not user.is_authenticated:
            return None
        return cls.objects.filter(user=user).first()

    @classmethod
    def is_staff_user(cls, user) -> bool:
        """True iff `user` has a StaffProfile row."""
        return cls.for_user(user) is not None

    # ── Permission helpers ───────────────────────────────────────

    def allowed_modules(self) -> list[str]:
        """
        Every module this staff member's role has been granted.

        Returns a plain list of module keys (e.g. ["Products",
        "Orders", "Customers"]). Reads directly from the
        ModulePermission table so the matrix is the single source of
        truth — no per-profile overrides.

        Administrators get every module by convention, even if a
        migration accidentally leaves a row ungranted. That keeps the
        lock visible in the UI honest.
        """
        if self.is_administrator:
            return list(
                ModulePermission.objects
                .filter(role='Administrator')
                .values_list('module', flat=True)
                .distinct()
            )

        return list(
            ModulePermission.objects
            .filter(role=self.role, granted=True)
            .values_list('module', flat=True)
            .distinct()
        )


# ─────────────────────────────────────────────────────────────
# ROLE CATALOGUE
# ─────────────────────────────────────────────────────────────
class Role(models.Model):
    """
    Read-only catalogue of the roles shown on the Roles tab.

    Seeded from `ROLE_CHOICES` via a data migration so the constant
    remains the source of truth. Editing a Role row by hand will not
    affect anything else — the value that matters elsewhere in the
    app is `StaffProfile.role` (a plain string), not this FK.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=32, unique=True)
    description = models.TextField()
    scope       = models.CharField(max_length=64)
    color       = models.CharField(max_length=64)
    icon        = models.CharField(max_length=32)
    is_customer = models.BooleanField(default=False)

    class Meta:
        db_table = 'dashboard_roles'
        ordering = ['is_customer', 'name']

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────
# MODULE PERMISSION  (permission matrix)
# ─────────────────────────────────────────────────────────────
class ModulePermission(models.Model):
    """
    One row per (module, role). The matrix's nested shape — where each
    module carries a `roles: { ... }` map — is assembled at read time
    by pivoting these rows.

    `role` uses MATRIX_ROLE_CHOICES (staff + Customer), NOT
    ROLE_CHOICES (staff only). The Customer column exists in the
    matrix even though Customer is never a valid StaffProfile role.
    """
    module  = models.CharField(max_length=64)
    group   = models.CharField(max_length=32)
    role    = models.CharField(max_length=32, choices=MATRIX_ROLE_CHOICES)
    granted = models.BooleanField(default=False)

    class Meta:
        db_table = 'dashboard_module_permissions'
        unique_together = ('module', 'role')
        ordering = ['group', 'module', 'role']
        indexes = [
            models.Index(fields=['role', 'granted']),
        ]

    def __str__(self):
        return f'{self.module} · {self.role} = {self.granted}'


# ─────────────────────────────────────────────────────────────
# STAFF INVITES
# ─────────────────────────────────────────────────────────────
class StaffInvite(models.Model):
    """
    Email invitation that a new staff member clicks to set up their
    account.

    Lifecycle:
        created                → status=PENDING,  accepted_at=None
        accepted by invitee    → status=ACCEPTED, accepted_at=now,
                                                  accepted_by=<user>
        cancelled by an admin  → status=CANCELLED
        7 days pass            → status=EXPIRED (set lazily by `is_valid`)

    `is_valid` is the single source of truth for "can this invite
    still be used?". It returns False for anything that isn't a
    PENDING, unexpired row — including a PENDING row whose date has
    silently passed. No caller should reimplement the check.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email       = models.EmailField()
    name        = models.CharField(max_length=150)
    role        = models.CharField(max_length=32, choices=ROLE_CHOICES)
    department  = models.CharField(max_length=64, blank=True)
    message     = models.TextField(blank=True)

    status      = models.CharField(
        max_length=16,
        choices=InviteStatus.choices,
        default=InviteStatus.PENDING,
    )
    token       = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    invited_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_staff_invites',
    )
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accepted_staff_invites',
    )

    created_at  = models.DateTimeField(auto_now_add=True)
    expires_at  = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'dashboard_staff_invites'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['token']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'Invite → {self.email} ({self.role}, {self.status})'

    # ── Validity ─────────────────────────────────────────────────

    @property
    def is_expired(self) -> bool:
        return (
            self.status == InviteStatus.PENDING
            and timezone.now() >= self.expires_at
        )

    @property
    def is_valid(self) -> bool:
        """True only for PENDING invites whose expiry is in the future."""
        return (
            self.status == InviteStatus.PENDING
            and timezone.now() < self.expires_at
        )

    @property
    def is_pending(self) -> bool:
        return self.status == InviteStatus.PENDING

    @property
    def is_accepted(self) -> bool:
        return self.status == InviteStatus.ACCEPTED

    @property
    def is_cancelled(self) -> bool:
        return self.status == InviteStatus.CANCELLED

    # ── Transitions ──────────────────────────────────────────────

    def mark_accepted(self, user, *, save: bool = True) -> None:
        """Called from the accept view after the staff user is created."""
        self.status = InviteStatus.ACCEPTED
        self.accepted_at = timezone.now()
        self.accepted_by = user
        if save:
            self.save(update_fields=['status', 'accepted_at', 'accepted_by'])

    def mark_cancelled(self, *, save: bool = True) -> None:
        """Called from the Delete / Cancel action on the invite row."""
        self.status = InviteStatus.CANCELLED
        self.cancelled_at = timezone.now()
        if save:
            self.save(update_fields=['status', 'cancelled_at'])

    def mark_expired(self, *, save: bool = True) -> None:
        """
        Lazily flag an overdue invite. Called by the list view when it
        sweeps PENDING rows whose `expires_at` has passed.
        """
        self.status = InviteStatus.EXPIRED
        if save:
            self.save(update_fields=['status'])

    # ── Factories ────────────────────────────────────────────────

    @classmethod
    def default_expiry(cls):
        """Invites expire 7 days after creation."""
        return timezone.now() + timedelta(days=7)

    @classmethod
    def expire_overdue(cls) -> int:
        """
        Bulk-flip every PENDING row whose expiry has passed to EXPIRED.
        Returns the number of rows affected. Cheap enough to run at
        the top of the list view; also safe to run from a cron.
        """
        return cls.objects.filter(
            status=InviteStatus.PENDING,
            expires_at__lt=timezone.now(),
        ).update(status=InviteStatus.EXPIRED)