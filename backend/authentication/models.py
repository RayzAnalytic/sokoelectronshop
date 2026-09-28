# authentication/models.py

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for the whole project.
    Email is the login field.
    """

    email = models.EmailField(unique=True)

    # ── renamed from `phone` to match serializers ──
    phone_number = models.CharField(max_length=20, blank=True, default="")

    # ── Verification state ──
    email_verified = models.BooleanField(default=False)

    # ── Role ──
    role = models.CharField(
        max_length=20,
        choices=[
            ("ADMIN", "Admin"),
            ("MANAGER", "Manager"),
            ("CUSTOMER", "Customer"),
        ],
        default="CUSTOMER",
    )

    # ── Profile picture ──
    profile_picture = models.ImageField(
        upload_to="profile_pictures/",
        null=True,
        blank=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.email

    # ── Nested roles enum (used by serializers) ──
    class Roles:
        ADMIN = "ADMIN"
        MANAGER = "MANAGER"
        CUSTOMER = "CUSTOMER"