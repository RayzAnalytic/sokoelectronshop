from django.conf import settings
from django.db import models
from django.db.models import Q, UniqueConstraint
from django.utils import timezone


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
        ORDER    = "order",    "Order"
        SHIPPING = "shipping", "Shipping"
        PROMO    = "promo",    "Promo"
        SECURITY = "security", "Security"
        SYSTEM   = "system",   "System"
        REVIEW   = "review",   "Review"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(
        max_length=16, choices=Type.choices, default=Type.SYSTEM,
    )
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    href = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    dedup_key = models.CharField(
        max_length=128,
        blank=True,
        default="",
        db_index=True,
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            UniqueConstraint(
                fields=["user", "dedup_key"],
                condition=~Q(dedup_key=""),
                name="one_notification_per_user_per_dedup_key",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "is_read"]),
            models.Index(fields=["user", "dedup_key"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.title}"

    def mark_read(self):
        if self.is_read:
            return
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=["is_read", "read_at"])


class Review(models.Model):
    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        PUBLISHED = "published", "Published"
        REJECTED  = "rejected",  "Rejected"

    class FlagStatus(models.TextChoices):
        NONE     = "none",     "None"
        FLAGGED  = "flagged",  "Flagged"
        RESOLVED = "resolved", "Resolved"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviews",
    )

    order = models.ForeignKey(
        "checkout.Order",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reviews",
    )

    product_id = models.CharField(max_length=64, db_index=True)
    product_name = models.CharField(max_length=255)
    product_slug = models.CharField(max_length=255, blank=True)
    product_image = models.CharField(max_length=500, blank=True)
    product_brand = models.CharField(max_length=120, blank=True)
    variant_label = models.CharField(max_length=120, blank=True)

    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    images = models.JSONField(default=list, blank=True)

    guest_author_name = models.CharField(max_length=120, blank=True)

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    rejection_reason = models.CharField(max_length=255, blank=True)
    is_verified_purchase = models.BooleanField(default=False)

    moderated_at = models.DateTimeField(null=True, blank=True)
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="moderated_reviews",
    )

    flag_status = models.CharField(
        max_length=10,
        choices=FlagStatus.choices,
        default=FlagStatus.NONE,
        db_index=True,
    )
    flag_reason = models.CharField(max_length=255, blank=True)
    flagged_at = models.DateTimeField(null=True, blank=True)
    flagged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="flagged_reviews",
    )

    helpful_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            UniqueConstraint(
                fields=["user", "product_id"],
                condition=Q(user__isnull=False),
                name="one_review_per_product_per_user",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "product_id", "status"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["flag_status", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.product_id} · {self.rating}★"

    @property
    def order_reference(self) -> str:
        return self.order.reference if self.order_id else ""

    @property
    def display_author(self) -> str:
        if self.user_id:
            user = self.user
            full = f"{user.first_name} {user.last_name}".strip()
            return full or user.email or "Customer"
        return self.guest_author_name or "Anonymous"

    @property
    def display_email(self) -> str:
        return self.user.email if self.user_id else ""


class ReviewReply(models.Model):
    review = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        related_name="replies",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="review_replies",
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["review", "created_at"]),
        ]

    def __str__(self):
        return f"Reply on review {self.review_id} by {self.author_id or 'deleted'}"


class WishlistItem(models.Model):
    class Stock(models.TextChoices):
        IN  = "In Stock",     "In Stock"
        LOW = "Low Stock",    "Low Stock"
        OUT = "Out of Stock", "Out of Stock"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wishlist_items",
    )

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
        max_digits=12, decimal_places=2, null=True, blank=True,
    )

    stock = models.CharField(
        max_length=20, choices=Stock.choices, default=Stock.IN,
    )
    stock_count = models.PositiveIntegerField(default=0)
    discount_percent = models.PositiveIntegerField(default=0)

    rating = models.DecimalField(
        max_digits=3, decimal_places=2, default=0,
    )
    review_count = models.PositiveIntegerField(default=0)

    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
            models.Index(fields=["user", "variant_id"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.product_name}"