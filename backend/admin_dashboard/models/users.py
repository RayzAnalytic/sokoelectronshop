# admin_dashboard/models/users.py

import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


# ============================================================
# CUSTOM MANAGER — email is the login identifier
# ============================================================
class UserManager(BaseUserManager):
    """
    Custom manager where email is the unique identifier for authentication
    instead of username.
    """
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("The email address must be set.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email, password, **extra_fields)


# ============================================================
# USER
# ============================================================
class User(AbstractUser):
    """
    Custom User model.
    - Login by email (username field is removed).
    - UUID primary key.
    - Role-based access (ADMIN / MANAGER / CUSTOMER).
    """
    class Roles(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        MANAGER = "MANAGER", "Manager"
        CUSTOMER = "CUSTOMER", "Customer"

    # ── Remove the default username field ──
    username = None

    # ── Primary key ──
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Required unique identifier ──
    email = models.EmailField(unique=True, db_index=True)

    # ── Profile fields ──
    role = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.CUSTOMER,
        db_index=True,
    )
    phone_number = models.CharField(max_length=20, blank=True)
    profile_picture = models.ImageField(
        upload_to="users/profiles/",
        null=True,
        blank=True,
    )
    date_of_birth = models.DateField(null=True, blank=True)
    email_verified = models.BooleanField(default=False)

    # ── Auth configuration ──
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # email + password are the only required fields

    objects = UserManager()

    class Meta:
        db_table = "users"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.email} ({self.role})"

    # ── Convenience helpers ──
    @property
    def is_admin(self):
        return self.role == self.Roles.ADMIN

    @property
    def is_manager(self):
        return self.role == self.Roles.MANAGER

    @property
    def is_customer(self):
        return self.role == self.Roles.CUSTOMER


# ============================================================
# ADDRESS
# ============================================================
class Address(models.Model):
    class AddressType(models.TextChoices):
        SHIPPING = "SHIPPING", "Shipping"
        BILLING = "BILLING", "Billing"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="addresses",
    )
    address_type = models.CharField(
        max_length=10,
        choices=AddressType.choices,
        default=AddressType.SHIPPING,
    )
    label = models.CharField(
        max_length=50,
        blank=True,
        help_text="e.g. Home, Office, Parents",
    )
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    street = models.CharField(max_length=255)
    town = models.CharField(max_length=100)
    county = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, default="Kenya")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_addresses"
        ordering = ["-is_default", "-created_at"]
        verbose_name_plural = "Addresses"

    def __str__(self):
        return f"{self.full_name} — {self.street}, {self.town}"

    def save(self, *args, **kwargs):
        """
        When this address is marked as default, unmark every other
        address of the same type for this user.
        """
        if self.is_default:
            Address.objects.filter(
                user=self.user,
                address_type=self.address_type,
                is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)