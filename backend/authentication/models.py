import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class Role(models.TextChoices):
    OWNER = "OWNER", "Owner"
    STAFF = "STAFF", "Staff"
    CUSTOMER = "CUSTOMER", "Customer"


class Status(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    PENDING = "PENDING", "Pending verification"


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    phone = models.CharField(max_length=32, blank=True, default="", db_index=True)

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    is_email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    google_sub = models.CharField(max_length=255, blank=True, default="", db_index=True)

    invited_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invited_users",
    )

    whatsapp_updates = models.BooleanField(default=True)
    email_promotions = models.BooleanField(default=True)
    sms_promotions = models.BooleanField(default=False)
    newsletter = models.BooleanField(default=False)

    deletion_requested_at = models.DateTimeField(null=True, blank=True)

    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        indexes = [models.Index(fields=["role", "status"])]
        constraints = [
            models.UniqueConstraint(
                fields=["phone"],
                condition=~models.Q(phone=""),
                name="unique_nonempty_phone",
            ),
        ]

    def __str__(self):
        return self.get_full_name()

    def get_full_name(self) -> str:
        full = f"{self.first_name} {self.last_name}".strip()
        return full or self.email

    def get_short_name(self) -> str:
        return self.first_name or self.last_name or self.email

    @property
    def is_admin_role(self) -> bool:
        return self.role in (Role.OWNER, Role.STAFF)

    @property
    def is_customer(self) -> bool:
        return self.role == Role.CUSTOMER

    @property
    def redirect_path(self) -> str:
        if self.is_admin_role:
            return settings.STAFF_REDIRECT_PATH
        return settings.CUSTOMER_REDIRECT_PATH

    @property
    def can_sign_in(self) -> bool:
        return self.is_active and self.status == Status.ACTIVE

    @property
    def has_usable_password(self) -> bool:
        return super().has_usable_password()

    @property
    def needs_email_verification(self) -> bool:
        return not self.is_email_verified

    def mark_email_verified(self) -> None:
        if self.is_email_verified and self.status != Status.PENDING:
            return

        now = timezone.now()
        fields: list[str] = []

        if not self.is_email_verified:
            self.is_email_verified = True
            self.email_verified_at = now
            fields += ["is_email_verified", "email_verified_at"]

        if self.status == Status.PENDING:
            self.status = Status.ACTIVE
            fields.append("status")

        if fields:
            self.save(update_fields=fields)


class EmailVerificationCode(models.Model):
    CODE_LENGTH = 6
    CODE_TTL = timedelta(minutes=10)
    MAX_ATTEMPTS = 5
    RESEND_COOLDOWN = timedelta(seconds=30)

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification_codes",
    )

    code_hash = models.CharField(max_length=128)
    delivered_to = models.EmailField()

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)

    attempts = models.PositiveSmallIntegerField(default=0)

    requested_ip = models.GenericIPAddressField(null=True, blank=True)
    used_ip = models.GenericIPAddressField(null=True, blank=True)

    provider_message_id = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["expires_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(used_at__isnull=True),
                name="unique_active_email_code_per_user",
            ),
        ]

    def __str__(self):
        return f"EmailCode({self.user_id}, attempts={self.attempts}, used={bool(self.used_at)})"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_attempts_exhausted(self) -> bool:
        return self.attempts >= self.MAX_ATTEMPTS

    @property
    def is_usable(self) -> bool:
        return (
            self.used_at is None
            and not self.is_expired
            and not self.is_attempts_exhausted
        )

    @property
    def seconds_until_expiry(self) -> int:
        return max(0, int((self.expires_at - timezone.now()).total_seconds()))

    @classmethod
    def issue(
        cls,
        user: User,
        *,
        ip: str | None = None,
    ) -> tuple["EmailVerificationCode", str]:
        now = timezone.now()

        cls.objects.filter(user=user, used_at__isnull=True).update(used_at=now)

        if settings.AUTH_DEV_FIXED_OTP:
            plaintext = settings.AUTH_DEV_FIXED_OTP
        else:
            plaintext = f"{secrets.randbelow(10 ** cls.CODE_LENGTH):0{cls.CODE_LENGTH}d}"

        row = cls.objects.create(
            user=user,
            code_hash=make_password(plaintext),
            delivered_to=user.email,
            expires_at=now + cls.CODE_TTL,
            requested_ip=ip,
        )
        return row, plaintext

    def verify(self, code: str, *, ip: str | None = None) -> bool:
        if not self.is_usable:
            return False

        self.attempts += 1

        if not check_password(code, self.code_hash):
            self.save(update_fields=["attempts"])
            return False

        now = timezone.now()
        self.used_at = now
        self.used_ip = ip
        self.save(update_fields=["attempts", "used_at", "used_ip"])
        return True

    @classmethod
    def seconds_until_resend_allowed(cls, user: User) -> int:
        latest = (
            cls.objects.filter(user=user)
            .order_by("-created_at")
            .values_list("created_at", flat=True)
            .first()
        )
        if latest is None:
            return 0

        ready_at = latest + cls.RESEND_COOLDOWN
        remaining = (ready_at - timezone.now()).total_seconds()
        return max(0, int(remaining))

    @classmethod
    def purge_expired(cls) -> int:
        cutoff = timezone.now() - timedelta(days=1)
        deleted, _ = cls.objects.filter(expires_at__lt=cutoff).delete()
        return deleted


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


class UserInvite(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        CANCELLED = "CANCELLED", "Cancelled"
        EXPIRED = "EXPIRED", "Expired"

    email = models.EmailField(db_index=True)

    role = models.CharField(
        max_length=20,
        choices=[
            (Role.OWNER, "Owner"),
            (Role.STAFF, "Staff"),
        ],
    )

    invited_name = models.CharField(max_length=150, blank=True)

    token = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        default=generate_invite_token,
    )

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
            models.UniqueConstraint(
                fields=["email"],
                condition=models.Q(status="PENDING"),
                name="unique_pending_invite_per_email",
            ),
        ]

    def __str__(self):
        return f"Invite({self.email} as {self.role}, {self.status})"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_usable(self) -> bool:
        return self.status == self.Status.PENDING and not self.is_expired

    @classmethod
    def default_expiry(cls):
        return timezone.now() + timedelta(days=7)


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


class PasswordResetToken(models.Model):
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