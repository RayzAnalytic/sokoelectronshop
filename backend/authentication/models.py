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

    # Primary contact number. Used for checkout, addresses, and delivery.
    phone = models.CharField(max_length=32, blank=True, default="")

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    is_email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    google_sub = models.CharField(max_length=255, blank=True, default="", db_index=True)

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
    @property
    def redirect_path(self) -> str:
        return "/admin" if self.is_admin_role else "/pages/account"