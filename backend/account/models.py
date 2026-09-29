from django.conf import settings
from django.db import models
from django.db.models import Q, UniqueConstraint


class Address(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="addresses",
    )
    label = models.CharField(max_length=32, default="Home")
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32)
    street = models.CharField(max_length=255)
    town = models.CharField(max_length=120)
    county = models.CharField(max_length=120)
    postal_code = models.CharField(max_length=20, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_default", "-updated_at"]
        constraints = [
            UniqueConstraint(
                fields=["user"],
                condition=Q(is_default=True),
                name="one_default_address_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.label}"


class Notification(models.Model):
    class Type(models.TextChoices):
        ORDER = "order", "Order"
        SHIPPING = "shipping", "Shipping"
        PROMO = "promo", "Promo"
        SECURITY = "security", "Security"
        SYSTEM = "system", "System"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=16, choices=Type.choices)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    href = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "is_read"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.title}"


class Review(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PUBLISHED = "published", "Published"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews",
    )

    # Denormalized product snapshot — swap to FKs when a catalog app lands.
    product_id = models.CharField(max_length=64)
    product_name = models.CharField(max_length=255)
    product_slug = models.CharField(max_length=255, blank=True)
    product_image = models.CharField(max_length=500, blank=True)
    product_brand = models.CharField(max_length=120, blank=True)
    variant_label = models.CharField(max_length=120, blank=True)

    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    images = models.JSONField(default=list, blank=True)

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    rejection_reason = models.CharField(max_length=255, blank=True)
    is_verified_purchase = models.BooleanField(default=False)
    moderated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            UniqueConstraint(
                fields=["user", "product_id"],
                name="one_review_per_product_per_user",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.product_id} · {self.rating}★"


class WishlistItem(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wishlist_items",
    )

    # Denormalized snapshot — swap to FKs when a catalog app lands.
    product_id = models.CharField(max_length=64)
    variant_id = models.CharField(max_length=64)

    product_name = models.CharField(max_length=255)
    product_slug = models.CharField(max_length=255, blank=True)
    product_brand = models.CharField(max_length=120, blank=True)
    product_image = models.CharField(max_length=500, blank=True)

    variant_name = models.CharField(max_length=120, blank=True)
    variant_image = models.CharField(max_length=500, blank=True)

    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    compare_at_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-added_at"]
        constraints = [
            UniqueConstraint(
                fields=["user", "variant_id"],
                name="one_wishlist_item_per_variant_per_user",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "-added_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.product_name}"