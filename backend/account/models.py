"""
account/models.py

Address, Notification, Review, ReviewReply, WishlistItem — the five
models behind the customer account area.

Design principles applied across all four (plus the reply):

  * Ownership: every model has `user` as a FK. Every query is scoped by
    `request.user` in the view layer. No account data is global.

  * Denormalization: `Review` and `WishlistItem` snapshot their product
    data at write time. A rename or price change in the catalog does
    not retroactively alter what the customer reviewed or saved.

  * Immutability where it matters: `Review.created_at` and
    `WishlistItem.added_at` are `auto_now_add` and never change. Any
    "when was this last touched?" concern is answered by a separate
    `updated_at` (where present).

  * Cross-app references stay as string identifiers, not FKs, for
    anything the catalog owns. The catalog lives outside this app and
    may eventually move to a separate service — treating product_id
    and variant_id as opaque strings keeps that door open.

  * Moderation state lives on Review, not on a sidecar. `status`,
    `rejection_reason`, `moderated_at`, `moderated_by` were already
    here; the moderation work for the admin Reviews page added
    `flag_status`, `flag_reason`, `flagged_at`, `flagged_by`, and
    `helpful_count`. All are optional in practice — a fresh review
    starts with flag_status='none' and helpful_count=0.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q, UniqueConstraint
from django.utils import timezone


# ═════════════════════════════════════════════════════════════════════════════
# Address
# ═════════════════════════════════════════════════════════════════════════════
class Address(models.Model):
    """
    A saved delivery address.

    The `one_default_address_per_user` constraint guarantees at most
    one default. It does NOT guarantee at least one — a user with N
    addresses can legally have zero defaults. The service layer is
    responsible for maintaining the invariant:

      * First address created → force is_default=True
      * Default deleted       → promote another
      * New default set       → atomically clear the previous one

    `county` is a plain CharField. The 47-item list from
    `settings.KENYAN_COUNTIES` is enforced in
    `AddressSerializer.validate_county` — keeping the model flexible
    for data imports and historical rows while blocking bad API input.

    `phone` is not normalized at the model level. The serializer
    applies the same normalization as registration so that a saved
    address phone always matches the format `claim_guest_orders`
    expects.
    """

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


# ═════════════════════════════════════════════════════════════════════════════
# Notification
# ═════════════════════════════════════════════════════════════════════════════
class Notification(models.Model):
    """
    An in-app notification for a customer.

    Written exclusively through `account.services.notify()` (and the
    typed helpers that wrap it, e.g. `notify_order_shipped`). Every
    other app that needs to notify a customer calls into that service
    — no direct model writes from checkout, reviews, or auth.

    Deletion is hard (the frontend's `remove` and `clearAll` endpoints
    do a real DELETE). Notifications are ephemeral UI; the durable
    audit trail for order events lives in `checkout.OrderStatusEvent`.

    `href` is server-generated, never client-provided. The frontend
    navigates to whatever string the backend stores, so the backend
    must construct it from the notification's own metadata — never
    from user-supplied input.
    """

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

    def mark_read(self):
        """
        Idempotent read-flag flip. Called by `services.mark_notification_read`,
        which the views use. Also safe to call directly.

        Skips the save when already read so repeated calls don't churn the
        row — matters because the frontend fires this on every notification
        click, including re-clicks on already-read items.
        """
        if self.is_read:
            return
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=["is_read", "read_at"])


# ═════════════════════════════════════════════════════════════════════════════
# Review
# ═════════════════════════════════════════════════════════════════════════════
class Review(models.Model):
    """
    A customer's review of a product.

    The `order` FK links the review to the delivered order that earned
    the verified-purchase badge. Serializers and views refer to the
    order by its reference string — the FK is the storage, and
    `order.reference` is what the API exposes.

    Unique on `(user, product_id)` — a customer can only review a given
    product once, ever. This matches Amazon/Google Reviews semantics:
    a review describes the product, not the transaction, so multiple
    purchases don't earn multiple reviews.

    Moderation:
      * `status` starts at PENDING unless the shop's auto-publish
        setting is on (which makes the create view set PUBLISHED).
      * Editing a review resets it to PENDING — see the update view.
      * `moderated_at` and `moderated_by` are both stamped when a
        staff member approves or rejects. The FK uses SET_NULL so a
        deleted staff account doesn't lose the moderation record.

    Flags:
      * `flag_status` is `'none'` for a clean review, `'flagged'` when
        an admin has flagged it for follow-up, and `'resolved'` after
        the flag is cleared. A subsequent re-flag flips it back to
        `'flagged'` — the previous resolution is not preserved as a
        separate row. If full flag history becomes a requirement,
        migrate to a `ReviewFlag` table.
      * `flagged_by` uses SET_NULL for the same reason as
        `moderated_by` — a deleted staff account should not orphan the
        record.

    Guest reviews:
      * `guest_author_name` is populated only for reviews migrated from
        the old `catalog.Review` table (which had no User FK). New
        reviews are always written by a signed-in customer, so
        `user` is set and `guest_author_name` stays empty.
      * The admin serializer resolves the display name as
        `user.get_full_name() or user.email or guest_author_name`.

    Social:
      * `helpful_count` is a simple counter, incremented by the admin
        moderation page. There is no per-user tracking — an admin
        marking a review as helpful is a judgement call, not a vote.
    """

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
        on_delete=models.CASCADE,
        related_name="reviews",
    )

    # Nullable because the customer may review a product they bought
    # before the Order FK existed, or without an order (data imports,
    # seeded reviews). The verified-purchase flag is what actually
    # matters for the UI; the FK is provenance.
    order = models.ForeignKey(
        "checkout.Order",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reviews",
    )

    # Catalog identity — opaque strings, not FKs. The catalog may live
    # outside this service. Same pattern as CartItem and WishlistItem.
    product_id = models.CharField(max_length=64, db_index=True)
    product_name = models.CharField(max_length=255)
    product_slug = models.CharField(max_length=255, blank=True)
    product_image = models.CharField(max_length=500, blank=True)
    product_brand = models.CharField(max_length=120, blank=True)
    variant_label = models.CharField(max_length=120, blank=True)

    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    # List of image URLs. Populated by the review-image upload endpoint,
    # which stores to S3 or MEDIA (respecting settings.USE_S3) and
    # returns just the URL — the model never sees the File object.
    images = models.JSONField(default=list, blank=True)

    # Display name for guest-authored or migrated reviews. Populated
    # only when there is no `user` (which is impossible for reviews
    # created through the current API, but happens for rows migrated
    # from the old `catalog.Review` table). Serializers fall back to
    # this when `user` is missing.
    guest_author_name = models.CharField(max_length=120, blank=True)

    # ── Moderation state ────────────────────────────────────────────
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

    # ── Flags ────────────────────────────────────────────────────────
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

    # ── Social ───────────────────────────────────────────────────────
    helpful_count = models.PositiveIntegerField(default=0)

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
            models.Index(fields=["user", "product_id", "status"]),
            # For the "products awaiting moderation" admin queue.
            models.Index(fields=["status", "-created_at"]),
            # For the admin flagged-only filter and badge count.
            models.Index(fields=["flag_status", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.product_id} · {self.rating}★"

    @property
    def order_reference(self) -> str:
        """
        The order's reference string, or "" when the review has no
        order. Exposed so serializers can read `instance.order_reference`
        without a null check at every call site.
        """
        return self.order.reference if self.order_id else ""

    @property
    def display_author(self) -> str:
        """
        Best-effort display name for the review's author.

        Order of preference:
          1. The user's full name (first + last).
          2. The user's email.
          3. The `guest_author_name` snapshot (migrated rows only).
          4. The literal "Anonymous".

        Used by the moderation serializer and any other consumer that
        needs the author's name without caring whether the row is
        user-backed or guest-backed.
        """
        if self.user_id:
            user = self.user
            full = f"{user.first_name} {user.last_name}".strip()
            return full or user.email or "Customer"
        return self.guest_author_name or "Anonymous"

    @property
    def display_email(self) -> str:
        """
        The author's email, or "" for guest rows.
        """
        return self.user.email if self.user_id else ""


# ═════════════════════════════════════════════════════════════════════════════
# ReviewReply
# ═════════════════════════════════════════════════════════════════════════════
class ReviewReply(models.Model):
    """
    One staff reply on a review.

    Public-facing: the storefront renders the reply below the review it
    answers. Written only through the admin Reviews page — the customer
    cannot reply to a reply.

    `author` is a real FK (not a denormalized name) because the reply's
    display name should update if the staff member changes their name.
    This is different from `Review.product_name`, which is a snapshot
    for provenance — the review is a historical record of what a
    customer saw, the reply is a live staff action.

    SET_NULL on `author` so a staff departure doesn't delete their
    replies. The serializer falls back to "Support" when the author
    is null.
    """

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


# ═════════════════════════════════════════════════════════════════════════════
# WishlistItem
# ═════════════════════════════════════════════════════════════════════════════
class WishlistItem(models.Model):
    """
    A saved product variant.

    Every display field is denormalized. The wishlist page renders
    without fanning out to the catalog — an N-item wishlist costs one
    query, not N.

    Two timestamps:
      * `added_at`   — set once when the variant is first saved.
                       Never changes, even if the customer removes and
                       re-adds.
      * `updated_at` — bumped on every write, including the snapshot
                       refresh that happens when the customer re-adds
                       an item already in their wishlist. Use this for
                       "when did we last see fresh data for this row?".

    Stock, price, rating, and review_count are snapshots from the
    moment of add (or last refresh). Stale values are acceptable by
    design — the wishlist is a shortcut, not a live mirror. Customers
    who want the current price click through to the product page.
    """

    class Stock(models.TextChoices):
        IN  = "In Stock",     "In Stock"
        LOW = "Low Stock",    "Low Stock"
        OUT = "Out of Stock", "Out of Stock"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wishlist_items",
    )

    # Catalog identity — opaque strings, not FKs. Same pattern as
    # CartItem. The pair (product_id, variant_id) is what the frontend
    # keys on everywhere.
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

    # Live-ish catalog state at add time.
    stock = models.CharField(
        max_length=20, choices=Stock.choices, default=Stock.IN,
    )
    stock_count = models.PositiveIntegerField(default=0)
    discount_percent = models.PositiveIntegerField(default=0)

    # Product-level rating snapshot. `rating` is the average on the
    # product at add time; `review_count` its total.
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