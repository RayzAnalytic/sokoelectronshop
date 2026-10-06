"""
Customers module models.

Two kinds of tables live here:

  1. Owned tables — CustomerNote, SupportTicket, CommunicationLog.
     These are admin-facing and have no counterpart elsewhere.

  2. A cached read-model — CustomerProfile. It mirrors aggregate stats
     computed from `checkout.Order`. The cache exists so the list view
     can filter and sort by segment, order count, and spend without
     running aggregate queries on every request.

     The cache is refreshed by `signals.py` whenever an Order is saved
     or deleted. If the cache ever drifts, `CustomerProfile.refresh_stats()`
     recomputes from source.
"""

from django.conf import settings
from django.db import models

from .constants import (
    CustomerSegment,
    CommunicationChannel,
    CommunicationDirection,
    SupportTicketPriority,
    SupportTicketStatus,
)


# ─────────────────────────────────────────────────────────────────────────────
# CustomerProfile — cached read-model
# ─────────────────────────────────────────────────────────────────────────────
class CustomerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_profile",
    )

    # Cached aggregates. Nullable until the first refresh runs.
    orders_count = models.PositiveIntegerField(default=0)
    total_spent = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
    )
    last_order_date = models.DateTimeField(null=True, blank=True)

    # Cached derived fields.
    segment = models.CharField(
        max_length=16,
        choices=CustomerSegment.choices,
        default=CustomerSegment.REGULAR,
        db_index=True,
    )
    most_purchased_category = models.CharField(
        max_length=120, blank=True, default="",
    )
    preferred_payment = models.CharField(
        max_length=20, blank=True, default="",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["segment"]),
            models.Index(fields=["-total_spent"]),
            models.Index(fields=["-last_order_date"]),
        ]

    def __str__(self):
        return f"CustomerProfile({self.user_id})"

    # ── Recompute ───────────────────────────────────────────────────────
    def refresh_stats(self, save: bool = True) -> None:
        """
        Recompute every cached field from source.

        Called by signals on Order save/delete, and safe to call by hand
        (e.g. from `tasks.recalculate_all_profiles`).

        Uses `aggregate` + `values` so this is 3 queries regardless of
        order count.

        Every assignment to a `CharField(blank=True)` field is guarded
        against a `None` return from the ORM — a LEFT JOIN can produce
        a row with a NULL string column even when `.exclude(...)` is
        present, and the DB column is `NOT NULL` because `blank=True`
        is a form-level flag, not a schema one.
        """
        from django.db.models import Count, Max, Q, Sum
        from checkout.models import Order

        # Only committed orders count. Pending and cancelled are excluded.
        counted = Q(
            status__in=[
                Order.Status.CONFIRMED,
                Order.Status.PROCESSING,
                Order.Status.SHIPPED,
                Order.Status.DELIVERED,
            ]
        )

        agg = (
            Order.objects
            .filter(user_id=self.user_id)
            .filter(counted)
            .aggregate(
                count=Count("id"),
                total=Sum("total"),
                last=Max("created_at"),
            )
        )

        self.orders_count = agg["count"] or 0
        self.total_spent = agg["total"] or 0
        self.last_order_date = agg["last"]

        # Most purchased category — group order items by their brand
        # string. The catalog lives outside this service, so we use the
        # denormalized name on OrderItem.
        #
        # `top_item["items__brand"]` can be None even after `.exclude()`
        # because the LEFT JOIN through `items` can produce a row whose
        # only column is NULL. Coerce to "" so the NOT NULL column
        # always receives a string.
        top_item = (
            Order.objects
            .filter(user_id=self.user_id)
            .filter(counted)
            .values("items__brand")
            .annotate(n=Count("items__id"))
            .exclude(items__brand="")
            .order_by("-n")
            .first()
        )
        self.most_purchased_category = (
            (top_item["items__brand"] if top_item else "") or ""
        )

        # Preferred payment — the payment_method used most often.
        pref = (
            Order.objects
            .filter(user_id=self.user_id)
            .filter(counted)
            .values("payment_method")
            .annotate(n=Count("id"))
            .order_by("-n")
            .first()
        )
        if pref and pref.get("payment_method"):
            self.preferred_payment = (
                "M-Pesa"
                if pref["payment_method"] == "MPESA"
                else "Cash on Delivery"
            )
        else:
            self.preferred_payment = ""

        self.segment = self._compute_segment()

        if save:
            self.save(
                update_fields=[
                    "orders_count",
                    "total_spent",
                    "last_order_date",
                    "most_purchased_category",
                    "preferred_payment",
                    "segment",
                    "updated_at",
                ]
            )

    # ── Segment rule ────────────────────────────────────────────────────
    def _compute_segment(self) -> str:
        """
        Order of evaluation matters:

          1. Never ordered and joined recently → New
          2. Never ordered and joined long ago → Churned
          3. Ordered but stale → At Risk / Churned
          4. High spend → VIP
          5. Repeat buyer → Loyal
          6. Everything else → Regular

        New is checked before VIP so a fresh account with one large
        purchase shows as New, not VIP — that matches intuition.
        """
        from datetime import timedelta
        from django.utils import timezone
        from .constants import (
            VIP_SPEND_THRESHOLD,
            LOYAL_ORDER_THRESHOLD,
            NEW_WINDOW_DAYS,
            AT_RISK_WINDOW_DAYS,
            CHURNED_WINDOW_DAYS,
        )

        now = timezone.now()
        joined = self.user.date_joined

        if self.orders_count == 0:
            if (now - joined).days <= NEW_WINDOW_DAYS:
                return CustomerSegment.NEW
            if (now - joined).days >= CHURNED_WINDOW_DAYS:
                return CustomerSegment.CHURNED
            return CustomerSegment.REGULAR

        if self.last_order_date:
            days_since = (now - self.last_order_date).days
            if days_since >= CHURNED_WINDOW_DAYS:
                return CustomerSegment.CHURNED
            if days_since >= AT_RISK_WINDOW_DAYS:
                return CustomerSegment.AT_RISK

        if (now - joined).days <= NEW_WINDOW_DAYS:
            return CustomerSegment.NEW

        if self.total_spent >= VIP_SPEND_THRESHOLD:
            return CustomerSegment.VIP

        if self.orders_count >= LOYAL_ORDER_THRESHOLD:
            return CustomerSegment.LOYAL

        return CustomerSegment.REGULAR


# ─────────────────────────────────────────────────────────────────────────────
# CustomerNote — internal admin notes
# ─────────────────────────────────────────────────────────────────────────────
class CustomerNote(models.Model):
    """
    Staff-only notes. Never exposed to the customer.

    `author` is nullable so a note survives the author's account being
    deleted (matching the soft-delete pattern on User).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_notes",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authored_customer_notes",
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"Note on {self.user_id} @ {self.created_at:%Y-%m-%d %H:%M}"


# ─────────────────────────────────────────────────────────────────────────────
# SupportTicket
# ─────────────────────────────────────────────────────────────────────────────
class SupportTicket(models.Model):
    """
    Minimal support-ticket record.

    If you later build a full support module, move this model there and
    reference it — but for the Customers admin page a flat record is
    enough.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_tickets",
    )
    subject = models.CharField(max_length=255)
    status = models.CharField(
        max_length=16,
        choices=SupportTicketStatus.choices,
        default=SupportTicketStatus.OPEN,
        db_index=True,
    )
    priority = models.CharField(
        max_length=10,
        choices=SupportTicketPriority.choices,
        default=SupportTicketPriority.MEDIUM,
        db_index=True,
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    last_update = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-opened_at"]
        indexes = [
            models.Index(fields=["user", "-opened_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.subject}"


# ─────────────────────────────────────────────────────────────────────────────
# CommunicationLog
# ─────────────────────────────────────────────────────────────────────────────
class CommunicationLog(models.Model):
    """
    Timeline of every interaction with a customer — WhatsApp, email,
    SMS, or phone call.

    Written by:
      * `services.log_communication` for admin-initiated messages
      * `signals` for system-generated events (order confirmations,
        receipts)

    Read-only in the admin UI. Delete rows by hand only when correcting
    a mistake.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="communication_log",
    )
    channel = models.CharField(
        max_length=16,
        choices=CommunicationChannel.choices,
        db_index=True,
    )
    direction = models.CharField(
        max_length=10,
        choices=CommunicationDirection.choices,
    )
    subject = models.CharField(max_length=255)
    agent = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["channel", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.channel} · {self.subject[:40]}"