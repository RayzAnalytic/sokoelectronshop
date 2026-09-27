# catalog/models.py

import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


# ─────────────────────────────────────────────────────────────
# CATEGORY
# ─────────────────────────────────────────────────────────────
class Category(models.Model):
    """
    Product category for a store. Belongs to a user (store owner).
    Slugs are unique per user.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    image = models.ImageField(
        upload_to="categories/",
        null=True,
        blank=True,
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "categories"
        unique_together = [("user", "slug")]
        ordering = ["order", "name"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return f"{self.name} ({self.user.email})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


# ─────────────────────────────────────────────────────────────
# PRODUCT
# ─────────────────────────────────────────────────────────────
class Product(models.Model):
    """
    A product in the store's catalog. Belongs to a user (store owner).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="products",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )

    # ── Core fields ──
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220)
    short_description = models.CharField(max_length=160, blank=True)

    # ── Pricing ──
    price = models.DecimalField(max_digits=12, decimal_places=2)
    sale_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    # ── Inventory ──
    sku = models.CharField(max_length=64, blank=True)
    stock = models.PositiveIntegerField(default=0)

    # ── Status ──
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "products"
        unique_together = [("user", "slug")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.user.email})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:200]
            self.slug = base

        # Auto-generate SKU if blank
        if not self.sku:
            words = self.name.split()[:3]
            prefix = "".join(w[0] for w in words).upper() or "PRD"
            self.sku = f"{prefix}-{uuid.uuid4().hex[:6].upper()}"

        super().save(*args, **kwargs)


# ─────────────────────────────────────────────────────────────
# PRODUCT IMAGE
# ─────────────────────────────────────────────────────────────
class ProductImage(models.Model):
    """
    Product images. `order = 0` is the primary image.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ImageField(upload_to="products/")
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "product_images"
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.product.name} — image {self.order}"