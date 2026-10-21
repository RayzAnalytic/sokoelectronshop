from django.conf import settings
from django.db import models

from .constants import (
    CustomerSegment,
    CommunicationChannel,
    CommunicationDirection,
    SupportTicketPriority,
    SupportTicketStatus,
)


class CustomerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_profile",
    )

    orders_count = models.PositiveIntegerField(default=0)
    total_spent = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
    )
    last_order_date = models.DateTimeField(null=True, blank=True)

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

    def refresh_stats(self, save: bool = True) -> None:
        from django.db.models import Count, Max, Q, Sum
        from checkout.models import Order

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

    def _compute_segment(self) -> str:
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


class CustomerNote(models.Model):
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


class SupportTicket(models.Model):
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


class CommunicationLog(models.Model):
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