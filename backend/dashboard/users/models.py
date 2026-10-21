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


class UserStatus(models.TextChoices):
    ACTIVE    = 'Active',    'Active'
    INVITED   = 'Invited',   'Invited'
    SUSPENDED = 'Suspended', 'Suspended'


class InviteStatus(models.TextChoices):
    PENDING   = 'Pending',   'Pending'
    ACCEPTED  = 'Accepted',  'Accepted'
    CANCELLED = 'Cancelled', 'Cancelled'
    EXPIRED   = 'Expired',   'Expired'


class StaffProfile(models.Model):
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

    @property
    def is_administrator(self) -> bool:
        return self.role == 'Administrator'

    @property
    def dashboard_url(self) -> str:
        return ROLE_DASHBOARD_MAP.get(self.role, '/admin')

    @classmethod
    def for_user(cls, user):
        if not user or not user.is_authenticated:
            return None
        return cls.objects.filter(user=user).first()

    @classmethod
    def is_staff_user(cls, user) -> bool:
        return cls.for_user(user) is not None

    def allowed_modules(self) -> list[str]:
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


class Role(models.Model):
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


class ModulePermission(models.Model):
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


class StaffInvite(models.Model):
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

    @property
    def is_expired(self) -> bool:
        return (
            self.status == InviteStatus.PENDING
            and timezone.now() >= self.expires_at
        )

    @property
    def is_valid(self) -> bool:
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

    def mark_accepted(self, user, *, save: bool = True) -> None:
        self.status = InviteStatus.ACCEPTED
        self.accepted_at = timezone.now()
        self.accepted_by = user
        if save:
            self.save(update_fields=['status', 'accepted_at', 'accepted_by'])

    def mark_cancelled(self, *, save: bool = True) -> None:
        self.status = InviteStatus.CANCELLED
        self.cancelled_at = timezone.now()
        if save:
            self.save(update_fields=['status', 'cancelled_at'])

    def mark_expired(self, *, save: bool = True) -> None:
        self.status = InviteStatus.EXPIRED
        if save:
            self.save(update_fields=['status'])

    @classmethod
    def default_expiry(cls):
        return timezone.now() + timedelta(days=7)

    @classmethod
    def expire_overdue(cls) -> int:
        return cls.objects.filter(
            status=InviteStatus.PENDING,
            expires_at__lt=timezone.now(),
        ).update(status=InviteStatus.EXPIRED)