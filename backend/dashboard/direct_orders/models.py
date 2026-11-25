from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone

ORDER_SOURCE_CHOICES = [
    ("tiktok_dm", "TikTok DM"),
    ("tiktok_comment", "TikTok Comment"),
    ("live", "TikTok LIVE"),
    ("video_dm", "Video DM"),
    ("bio_link", "Bio Link"),
    ("whatsapp", "WhatsApp"),
    ("phone", "Phone"),
    ("admin", "Admin / Manual"),
]

ORDER_STATUS_CHOICES = [
    ("New", "New"),
    ("Awaiting Payment", "Awaiting Payment"),
    ("Paid", "Paid"),
    ("Awaiting Shipment", "Awaiting Shipment"),
    ("Shipped", "Shipped"),
    ("Delivered", "Delivered"),
    ("Cancelled", "Cancelled"),
    ("Returned", "Returned"),
]

PAYMENT_STATUS_CHOICES = [
    ("unpaid", "Unpaid"),
    ("partial", "Partial"),
    ("paid", "Paid"),
    ("refunded", "Refunded"),
]

PAYMENT_METHOD_CHOICES = [
    ("mpesa", "M-Pesa"),
    ("bank", "Bank Transfer"),
    ("card", "Card"),
    ("cod", "Cash on Delivery"),
    ("cash", "Cash"),
]

CUSTOMER_SEGMENT_CHOICES = [
    ("New", "New"),
    ("Repeat", "Repeat"),
    ("VIP", "VIP"),
    ("Regular", "Regular"),
    ("Wholesale", "Wholesale"),
    ("COD Risk", "COD Risk"),
    ("Inactive", "Inactive"),
]

INBOX_CHANNEL_CHOICES = [
    ("tiktok_dm", "TikTok DM"),
    ("tiktok_comment", "TikTok Comment"),
    ("instagram_dm", "Instagram DM"),
    ("whatsapp", "WhatsApp"),
    ("phone", "Phone"),
    ("email", "Email"),
]

INBOX_STATUS_CHOICES = [
    ("open", "Open"),
    ("pending", "Pending"),
    ("converted", "Converted"),
    ("closed", "Closed"),
    ("spam", "Spam"),
]

TEAM_ROLE_CHOICES = [
    ("Owner", "Owner"),
    ("Admin", "Admin"),
    ("Operations", "Operations"),
    ("Finance", "Finance"),
    ("Content", "Content"),
    ("Support", "Support"),
    ("Creator", "Creator"),
]

TEAM_STATUS_CHOICES = [
    ("Active", "Active"),
    ("Invited", "Invited"),
    ("Suspended", "Suspended"),
]

PAYOUT_STATUS_CHOICES = [
    ("Draft", "Draft"),
    ("Pending", "Pending"),
    ("Approved", "Approved"),
    ("Processing", "Processing"),
    ("Paid", "Paid"),
    ("Failed", "Failed"),
    ("Reversed", "Reversed"),
]

RETURN_STATUS_CHOICES = [
    ("Requested", "Requested"),
    ("Approved", "Approved"),
    ("Rejected", "Rejected"),
    ("Received", "Received"),
    ("Refunded", "Refunded"),
]

RETURN_REASON_CHOICES = [
    ("damaged", "Damaged"),
    ("wrong_item", "Wrong item"),
    ("not_as_described", "Not as described"),
    ("late_delivery", "Late delivery"),
    ("changed_mind", "Changed mind"),
    ("other", "Other"),
]

INVENTORY_MOVEMENT_CHOICES = [
    ("in", "Stock in"),
    ("out", "Stock out"),
    ("adjustment", "Adjustment"),
    ("damaged", "Damaged"),
    ("return", "Return restock"),
    ("transfer", "Transfer"),
]

PURCHASE_ORDER_STATUS_CHOICES = [
    ("Draft", "Draft"),
    ("Ordered", "Ordered"),
    ("Partially Received", "Partially Received"),
    ("Received", "Received"),
    ("Cancelled", "Cancelled"),
]

EXPENSE_CATEGORY_CHOICES = [
    ("inventory", "Inventory"),
    ("shipping", "Shipping"),
    ("marketing", "Marketing"),
    ("creator", "Creator"),
    ("software", "Software"),
    ("rent", "Rent"),
    ("utilities", "Utilities"),
    ("salaries", "Salaries"),
    ("tax", "Tax"),
    ("other", "Other"),
]

CAMPAIGN_STATUS_CHOICES = [
    ("Draft", "Draft"),
    ("Active", "Active"),
    ("Paused", "Paused"),
    ("Ended", "Ended"),
]

AUTOMATION_TRIGGER_CHOICES = [
    ("order_created", "Order Created"),
    ("order_paid", "Order Paid"),
    ("order_shipped", "Order Shipped"),
    ("order_delivered", "Order Delivered"),
    ("order_cancelled", "Order Cancelled"),
    ("abandoned_inbox", "Abandoned Inbox"),
    ("low_stock", "Low Stock"),
    ("creator_payout_due", "Creator Payout Due"),
    ("live_scheduled", "LIVE Scheduled"),
    ("customer_birthday", "Customer Birthday"),
    ("review_received", "Review Received"),
]

AUTOMATION_ACTION_CHOICES = [
    ("whatsapp", "Send WhatsApp"),
    ("sms", "Send SMS"),
    ("email", "Send Email"),
    ("notify_team", "Notify Team"),
    ("create_task", "Create Task"),
    ("apply_tag", "Apply Tag"),
]

AUTOMATION_STATUS_CHOICES = [
    ("Draft", "Draft"),
    ("Active", "Active"),
    ("Paused", "Paused"),
]

NOTIFICATION_KIND_CHOICES = [
    ("info", "Info"),
    ("success", "Success"),
    ("warning", "Warning"),
    ("danger", "Danger"),
]

AUDIT_ACTION_CHOICES = [
    ("create", "Create"),
    ("update", "Update"),
    ("delete", "Delete"),
    ("login", "Login"),
    ("logout", "Logout"),
    ("payout", "Payout"),
    ("status_change", "Status Change"),
]

REVIEW_STATUS_CHOICES = [
    ("Pending", "Pending"),
    ("Approved", "Approved"),
    ("Rejected", "Rejected"),
]

ATTRIBUTION_KIND_CHOICES = [
    ("link", "Link"),
    ("code", "Code"),
    ("utm", "UTM"),
]

COURIER_CHOICES = [
    ("pickup_mtaani", "Pickup Mtaani"),
    ("sendy", "Sendy"),
    ("g4s", "G4S"),
    ("boda", "Boda"),
    ("rider", "In-house Rider"),
    ("postal", "Postal"),
    ("pickup", "Customer Pickup"),
]

SHIPPING_ZONE_CHOICES = [
    ("nairobi", "Nairobi"),
    ("mombasa", "Mombasa"),
    ("kisumu", "Kisumu"),
    ("nakuru", "Nakuru"),
    ("eldoret", "Eldoret"),
    ("thika", "Thika"),
    ("upcountry", "Upcountry"),
    ("international", "International"),
]

LOCATION_KIND_CHOICES = [
    ("warehouse", "Warehouse"),
    ("shop", "Shop"),
    ("pickup", "Pickup Point"),
]

INTEGRATION_STATUS_CHOICES = [
    ("connected", "Connected"),
    ("disconnected", "Disconnected"),
    ("error", "Error"),
    ("expired", "Expired"),
]

LEAD_STATUS_CHOICES = [
    ("New", "New"),
    ("Contacted", "Contacted"),
    ("Interested", "Interested"),
    ("Negotiating", "Negotiating"),
    ("Awaiting Decision", "Awaiting Decision"),
    ("Converted", "Converted"),
    ("Lost", "Lost"),
]

LEAD_SOURCE_CHOICES = [
    ("tiktok_dm", "TikTok DM"),
    ("tiktok_comment", "TikTok Comment"),
    ("live", "TikTok LIVE"),
    ("whatsapp", "WhatsApp"),
    ("phone", "Phone"),
    ("bio_link", "Bio Link"),
]

TICKET_STATUS_CHOICES = [
    ("Open", "Open"),
    ("In Progress", "In Progress"),
    ("Waiting for Customer", "Waiting for Customer"),
    ("Waiting for Staff", "Waiting for Staff"),
    ("Resolved", "Resolved"),
    ("Closed", "Closed"),
]

TICKET_PRIORITY_CHOICES = [
    ("Low", "Low"),
    ("Normal", "Normal"),
    ("High", "High"),
    ("Urgent", "Urgent"),
]

FOLLOWUP_TYPE_CHOICES = [
    ("Call", "Call"),
    ("Message", "Message"),
    ("Email", "Email"),
    ("Visit", "Visit"),
]

FOLLOWUP_STATUS_CHOICES = [
    ("Upcoming", "Upcoming"),
    ("Today", "Today"),
    ("Overdue", "Overdue"),
    ("Completed", "Completed"),
    ("Cancelled", "Cancelled"),
]

CREATOR_APPLICATION_STATUS_CHOICES = [
    ("New", "New"),
    ("Under Review", "Under Review"),
    ("Approved", "Approved"),
    ("Rejected", "Rejected"),
    ("Invited", "Invited"),
    ("Accepted", "Accepted"),
    ("Declined", "Declined"),
]

PARTNERSHIP_STATUS_CHOICES = [
    ("Active", "Active"),
    ("Paused", "Paused"),
    ("Completed", "Completed"),
    ("Cancelled", "Cancelled"),
]

SAMPLE_STATUS_CHOICES = [
    ("Requested", "Requested"),
    ("Approved", "Approved"),
    ("Dispatched", "Dispatched"),
    ("Delivered", "Delivered"),
    ("Rejected", "Rejected"),
]

COMMISSION_STATUS_CHOICES = [
    ("Pending", "Pending"),
    ("Under Review", "Under Review"),
    ("Approved", "Approved"),
    ("Payable", "Payable"),
    ("Paid", "Paid"),
    ("Reversed", "Reversed"),
    ("Cancelled", "Cancelled"),
]

AD_CAMPAIGN_STATUS_CHOICES = [
    ("Draft", "Draft"),
    ("Active", "Active"),
    ("Paused", "Paused"),
    ("Ended", "Ended"),
]

CONTENT_TYPE_CHOICES = [
    ("Video", "Video"),
    ("Photo Carousel", "Photo Carousel"),
    ("LIVE Promo", "LIVE Promo"),
]

CONTENT_STATUS_CHOICES = [
    ("Idea", "Idea"),
    ("Draft", "Draft"),
    ("In Review", "In Review"),
    ("Approved", "Approved"),
    ("Scheduled", "Scheduled"),
    ("Posted", "Posted"),
    ("Failed", "Failed"),
    ("Archived", "Archived"),
]

CONTENT_PLATFORM_CHOICES = [
    ("TikTok", "TikTok"),
    ("Instagram", "Instagram"),
    ("YouTube", "YouTube"),
]

LIVE_STATUS_CHOICES = [
    ("Scheduled", "Scheduled"),
    ("Live", "Live"),
    ("Ended", "Ended"),
    ("Cancelled", "Cancelled"),
]

PRODUCT_STATUS_CHOICES = [
    ("Draft", "Draft"),
    ("Active", "Active"),
    ("Archived", "Archived"),
]

CREATOR_STATUS_CHOICES = [
    ("Active", "Active"),
    ("Inactive", "Inactive"),
    ("Pending", "Pending"),
    ("Invited", "Invited"),
    ("Paused", "Paused"),
]

CREATOR_PLATFORM_CHOICES = [
    ("TikTok", "TikTok"),
    ("Instagram", "Instagram"),
    ("YouTube", "YouTube"),
]


class Supplier(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    contact_person = models.CharField(max_length=128, blank=True)
    payment_terms = models.CharField(max_length=128, blank=True)
    tax_pin = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Location(models.Model):
    name = models.CharField(max_length=128)
    kind = models.CharField(max_length=16, choices=LOCATION_KIND_CHOICES, default="warehouse")
    address = models.TextField(blank=True)
    county = models.CharField(max_length=64, blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class DirectProduct(models.Model):
    product = models.OneToOneField(
        "catalog.Product",
        on_delete=models.CASCADE,
        related_name="direct_listing",
    )
    status = models.CharField(max_length=16, choices=PRODUCT_STATUS_CHOICES, default="Draft")
    viral = models.BooleanField(default=False)
    video_link = models.URLField(max_length=500, blank=True)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    linked_to_website = models.BooleanField(default=True)

    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    supplier = models.ForeignKey(
        Supplier,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="products",
    )
    reorder_point = models.PositiveIntegerField(default=5)
    reorder_quantity = models.PositiveIntegerField(default=10)
    is_bundle = models.BooleanField(default=False)
    is_preorder = models.BooleanField(default=False)
    preorder_eta = models.DateField(null=True, blank=True)

    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("10.00"),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )

    tags = models.JSONField(default=list, blank=True)
    seo_title = models.CharField(max_length=255, blank=True)
    seo_description = models.TextField(blank=True)

    direct_sales_count = models.PositiveIntegerField(default=0)
    direct_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "Direct Product"
        verbose_name_plural = "Direct Products"
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["-updated_at"]),
        ]

    def __str__(self):
        return f"{self.product.name} ({self.status})"

    @property
    def margin(self) -> Decimal:
        try:
            price = Decimal(self.product.price or 0)
        except Exception:
            price = Decimal("0.00")
        return price - self.cost_price

    @property
    def margin_percent(self) -> Decimal:
        try:
            price = Decimal(self.product.price or 0)
        except Exception:
            price = Decimal("0.00")
        if price <= 0:
            return Decimal("0.00")
        return (self.margin / price) * Decimal("100")

    def recompute_sales_stats(self, save: bool = True) -> None:
        from django.db.models import Count, Sum

        agg = DirectOrderItem.objects.filter(
            product=self,
            order__status__in=["Paid", "Awaiting Shipment", "Shipped", "Delivered"],
        ).aggregate(count=Count("id"), revenue=Sum("subtotal"))
        self.direct_sales_count = agg["count"] or 0
        self.direct_revenue = agg["revenue"] or Decimal("0.00")
        if save:
            self.save(update_fields=["direct_sales_count", "direct_revenue", "updated_at"])


class ProductVariant(models.Model):
    product = models.ForeignKey(DirectProduct, on_delete=models.CASCADE, related_name="variants")
    name = models.CharField(max_length=128)
    sku = models.CharField(max_length=64, blank=True)
    size = models.CharField(max_length=32, blank=True)
    color = models.CharField(max_length=32, blank=True)
    price_delta = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    stock_quantity = models.IntegerField(default=0)
    image_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product", "id"]

    def __str__(self):
        return f"{self.product.product.name} — {self.name}"


class PurchaseOrder(models.Model):
    reference = models.CharField(max_length=32, unique=True, db_index=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchase_orders")
    status = models.CharField(max_length=24, choices=PURCHASE_ORDER_STATUS_CHOICES, default="Draft")
    expected_at = models.DateField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    shipping = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference} — {self.supplier.name}"

    def recompute_totals(self, save: bool = True) -> None:
        from django.db.models import Sum

        agg = self.items.aggregate(sub=Sum("subtotal"))
        self.subtotal = agg["sub"] or Decimal("0.00")
        self.total = self.subtotal + self.shipping
        if save:
            self.save(update_fields=["subtotal", "total", "updated_at"])


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        DirectProduct,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="purchase_items",
    )
    product_name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def save(self, *args, **kwargs):
        self.subtotal = Decimal(self.quantity) * Decimal(self.unit_cost)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quantity}× {self.product_name}"


class InventoryMovement(models.Model):
    product = models.ForeignKey(DirectProduct, on_delete=models.CASCADE, related_name="movements")
    variant = models.ForeignKey(
        ProductVariant,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movements",
    )
    location = models.ForeignKey(
        Location,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movements",
    )
    kind = models.CharField(max_length=16, choices=INVENTORY_MOVEMENT_CHOICES, default="adjustment")
    quantity = models.IntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    reference = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inventory_movements",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product", "-created_at"]),
            models.Index(fields=["kind"]),
        ]

    def __str__(self):
        return f"{self.kind} {self.quantity}× {self.product}"


class Customer(models.Model):
    name = models.CharField(max_length=128)
    phone = models.CharField(max_length=32, db_index=True)
    email = models.EmailField(blank=True)
    username = models.CharField(max_length=64, blank=True)
    county = models.CharField(max_length=64, blank=True)
    estate = models.CharField(max_length=64, blank=True)
    address = models.TextField(blank=True)

    segment = models.CharField(max_length=16, choices=CUSTOMER_SEGMENT_CHOICES, default="New")
    tags = models.JSONField(default=list, blank=True)
    whatsapp_opt_in = models.BooleanField(default=True)
    sms_opt_in = models.BooleanField(default=False)
    email_opt_in = models.BooleanField(default=False)
    birthday = models.DateField(null=True, blank=True)

    total_orders = models.PositiveIntegerField(default=0)
    lifetime_spend = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    avg_order_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    last_order_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_order_at", "-created_at"]
        indexes = [
            models.Index(fields=["segment"]),
            models.Index(fields=["-lifetime_spend"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.phone})"

    def recompute_stats(self, save: bool = True) -> None:
        from django.db.models import Count, Sum, Max

        agg = self.orders.aggregate(
            count=Count("id"),
            spend=Sum("total"),
            last=Max("created_at"),
        )
        self.total_orders = agg["count"] or 0
        self.lifetime_spend = agg["spend"] or Decimal("0.00")
        self.last_order_at = agg["last"]
        if self.total_orders > 0:
            self.avg_order_value = self.lifetime_spend / Decimal(self.total_orders)
        else:
            self.avg_order_value = Decimal("0.00")

        if self.lifetime_spend >= Decimal("50000") or self.total_orders >= 5:
            self.segment = "VIP"
        elif self.total_orders >= 2:
            self.segment = "Repeat"
        elif self.segment not in ("Wholesale", "COD Risk", "Inactive"):
            self.segment = "New"

        if save:
            self.save(
                update_fields=[
                    "total_orders",
                    "lifetime_spend",
                    "avg_order_value",
                    "last_order_at",
                    "segment",
                    "updated_at",
                ]
            )


class Creator(models.Model):
    name = models.CharField(max_length=128)
    handle = models.CharField(max_length=64, unique=True)
    platform = models.CharField(max_length=32, choices=CREATOR_PLATFORM_CHOICES, default="TikTok")
    followers = models.PositiveIntegerField(default=0)
    niche = models.CharField(max_length=64, blank=True)
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    start_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=CREATOR_STATUS_CHOICES, default="Active")
    notes = models.TextField(blank=True)

    avatar_url = models.URLField(max_length=500, blank=True)

    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    tax_pin = models.CharField(max_length=32, blank=True)
    payout_method = models.CharField(max_length=32, default="M-Pesa")
    payout_phone = models.CharField(max_length=32, blank=True)

    engagement_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    avg_views = models.PositiveIntegerField(default=0)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="creator_profiles",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} (@{self.handle})"

    @property
    def sales_driven(self) -> int:
        return self.sales.count()

    @property
    def commission_owed(self) -> Decimal:
        from django.db.models import Sum

        return (
            self.sales.filter(paid=False).aggregate(total=Sum("commission_amount"))["total"]
            or Decimal("0.00")
        )

    @property
    def commission_paid(self) -> Decimal:
        from django.db.models import Sum

        return (
            self.sales.filter(paid=True).aggregate(total=Sum("commission_amount"))["total"]
            or Decimal("0.00")
        )

    @property
    def revenue(self) -> Decimal:
        from django.db.models import Sum

        return self.sales.aggregate(total=Sum("order__total"))["total"] or Decimal("0.00")

    @property
    def orders_count(self) -> int:
        return self.sales_driven


class CreatorSale(models.Model):
    creator = models.ForeignKey(Creator, on_delete=models.CASCADE, related_name="sales")
    order = models.ForeignKey("checkout.Order", on_delete=models.PROTECT, related_name="creator_sales")
    attributed_at = models.DateTimeField(auto_now_add=True)

    commission_rate = models.DecimalField(max_digits=5, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)

    paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    payout_reference = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)

    payout = models.ForeignKey(
        "PayoutBatch",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sales",
    )

    status = models.CharField(max_length=16, choices=COMMISSION_STATUS_CHOICES, default="Pending")

    class Meta:
        ordering = ["-attributed_at"]
        constraints = [
            models.UniqueConstraint(fields=["creator", "order"], name="one_sale_per_creator_per_order"),
        ]

    def __str__(self):
        return f"{self.creator.handle} ← {self.order.reference}"


class PayoutBatch(models.Model):
    reference = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(max_length=16, choices=PAYOUT_STATUS_CHOICES, default="Draft")
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    items_count = models.PositiveIntegerField(default=0)
    payout_method = models.CharField(max_length=32, default="M-Pesa")

    creator = models.ForeignKey(
        Creator,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payouts",
    )

    transaction_reference = models.CharField(max_length=64, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_payouts",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference} ({self.status})"

    def recompute_totals(self, save: bool = True) -> None:
        from django.db.models import Sum, Count

        agg = self.sales.aggregate(total=Sum("commission_amount"), count=Count("id"))
        self.total_amount = agg["total"] or Decimal("0.00")
        self.items_count = agg["count"] or 0
        if save:
            self.save(update_fields=["total_amount", "items_count", "updated_at"])


class Campaign(models.Model):
    name = models.CharField(max_length=128)
    slug = models.SlugField(max_length=64, unique=True)
    status = models.CharField(max_length=16, choices=CAMPAIGN_STATUS_CHOICES, default="Draft")
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    budget = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    actual_spend = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    objective = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class AttributionLink(models.Model):
    kind = models.CharField(max_length=16, choices=ATTRIBUTION_KIND_CHOICES, default="link")
    code = models.CharField(max_length=64, unique=True, db_index=True)
    label = models.CharField(max_length=128, blank=True)
    url = models.URLField(max_length=500, blank=True)
    utm_source = models.CharField(max_length=64, blank=True)
    utm_medium = models.CharField(max_length=64, blank=True)
    utm_campaign = models.CharField(max_length=64, blank=True)

    creator = models.ForeignKey(
        Creator,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attribution_links",
    )
    campaign = models.ForeignKey(
        Campaign,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attribution_links",
    )
    content = models.ForeignKey(
        "ContentPost",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attribution_links",
    )
    live = models.ForeignKey(
        "LiveSession",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attribution_links",
    )

    clicks = models.PositiveIntegerField(default=0)
    conversions = models.PositiveIntegerField(default=0)
    revenue = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code} → {self.label or 'untitled'}"


class DirectOrder(models.Model):
    reference = models.CharField(max_length=32, unique=True, db_index=True)
    customer_name = models.CharField(max_length=128)
    customer_phone = models.CharField(max_length=32, blank=True)
    customer_email = models.EmailField(blank=True)
    customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )

    source = models.CharField(max_length=24, choices=ORDER_SOURCE_CHOICES, default="tiktok_dm")
    status = models.CharField(max_length=32, choices=ORDER_STATUS_CHOICES, default="New")

    payment_method = models.CharField(max_length=32, choices=PAYMENT_METHOD_CHOICES, default="mpesa")
    payment_status = models.CharField(max_length=16, choices=PAYMENT_STATUS_CHOICES, default="unpaid")
    payment_reference = models.CharField(max_length=64, blank=True)
    mpesa_reference = models.CharField(max_length=64, blank=True)
    verification_status = models.CharField(max_length=16, default="unverified")

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    shipping = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    creator = models.ForeignKey(
        Creator,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="direct_orders",
    )
    commission = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    campaign = models.ForeignKey(
        Campaign,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )
    attribution = models.ForeignKey(
        AttributionLink,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )

    courier = models.CharField(max_length=32, choices=COURIER_CHOICES, blank=True)
    tracking_number = models.CharField(max_length=64, blank=True)
    shipping_zone = models.CharField(max_length=32, choices=SHIPPING_ZONE_CHOICES, blank=True)

    cod_risk = models.CharField(max_length=16, blank=True)
    priority = models.CharField(max_length=16, default="normal")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_orders",
    )

    notes = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)

    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["source"]),
            models.Index(fields=["-created_at"]),
            models.Index(fields=["payment_status"]),
        ]

    def __str__(self):
        return f"{self.reference} — {self.customer_name}"

    @property
    def item_count(self) -> int:
        return sum(item.quantity for item in self.items.all())

    @property
    def payment_method_label(self) -> str:
        mapping = {
            "mpesa": "M-Pesa",
            "cod": "Cash on delivery",
            "bank": "Bank transfer",
            "card": "Card",
            "cash": "Cash",
        }
        return mapping.get(self.payment_method, self.payment_method)

    def recompute_totals(self, save: bool = True) -> None:
        from django.db.models import Sum

        agg = self.items.aggregate(sub=Sum("subtotal"))
        self.subtotal = agg["sub"] or Decimal("0.00")
        self.total = self.subtotal + self.shipping - self.discount
        if save:
            self.save(update_fields=["subtotal", "total", "updated_at"])

        for item in self.items.select_related("product"):
            if item.product_id:
                item.product.recompute_sales_stats(save=True)

    @staticmethod
    def generate_reference() -> str:
        import random

        for _ in range(20):
            ref = f"#TT-{random.randint(10000, 99999)}"
            if not DirectOrder.objects.filter(reference=ref).exists():
                return ref
        return f"#TT-{int(timezone.now().timestamp())}"


class DirectOrderItem(models.Model):
    order = models.ForeignKey(DirectOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        DirectProduct,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="order_items",
    )
    variant = models.ForeignKey(
        ProductVariant,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="order_items",
    )

    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=64, blank=True)
    image = models.URLField(max_length=500, blank=True)

    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity}× {self.product_name}"

    def save(self, *args, **kwargs):
        self.subtotal = Decimal(self.quantity) * Decimal(self.price)
        super().save(*args, **kwargs)


class ContentPost(models.Model):
    title = models.CharField(max_length=255)
    platform = models.CharField(max_length=32, choices=CONTENT_PLATFORM_CHOICES, default="TikTok")
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES, default="Video")
    status = models.CharField(max_length=16, choices=CONTENT_STATUS_CHOICES, default="Draft")

    scheduled_at = models.DateTimeField(null=True, blank=True)

    hook = models.CharField(max_length=255, blank=True)
    script = models.TextField(blank=True)
    hashtags = models.CharField(max_length=255, blank=True)
    caption = models.TextField(blank=True)
    sound = models.CharField(max_length=128, blank=True)

    posted_url = models.URLField(max_length=500, blank=True)
    thumbnail_url = models.URLField(max_length=500, blank=True)
    video_url = models.URLField(max_length=500, blank=True)

    products = models.JSONField(default=list, blank=True)

    creator = models.ForeignKey(
        Creator,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="content_posts",
    )
    campaign = models.ForeignKey(
        Campaign,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="content_posts",
    )

    views = models.PositiveIntegerField(default=0)
    likes = models.PositiveIntegerField(default=0)
    comments = models.PositiveIntegerField(default=0)
    shares = models.PositiveIntegerField(default=0)
    saves = models.PositiveIntegerField(default=0)

    orders_attributed = models.PositiveIntegerField(default=0)
    revenue_attributed = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_at", "-created_at"]
        indexes = [
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return self.title

    @property
    def product_name(self) -> str:
        if not self.products:
            return ""
        if isinstance(self.products, list):
            return " · ".join(str(p) for p in self.products)
        return str(self.products)

    @property
    def revenue_per_1k_views(self) -> Decimal:
        if self.views <= 0:
            return Decimal("0.00")
        return (self.revenue_attributed / Decimal(self.views)) * Decimal("1000")


class LiveSession(models.Model):
    title = models.CharField(max_length=255)
    scheduled_start = models.DateTimeField()
    scheduled_end = models.DateTimeField(null=True, blank=True)
    duration_min = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=16, choices=LIVE_STATUS_CHOICES, default="Scheduled")

    host_name = models.CharField(max_length=128, blank=True)
    cohost_name = models.CharField(max_length=128, blank=True)

    creator = models.ForeignKey(
        Creator,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="live_sessions",
    )
    campaign = models.ForeignKey(
        Campaign,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="live_sessions",
    )

    products = models.JSONField(default=list, blank=True)
    run_sheet = models.TextField(blank=True)
    coupon_code = models.CharField(max_length=32, blank=True)

    peak_viewers = models.PositiveIntegerField(default=0)
    total_viewers = models.PositiveIntegerField(default=0)
    orders_generated = models.PositiveIntegerField(default=0)
    revenue = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    top_product = models.CharField(max_length=255, blank=True)
    replay_url = models.URLField(max_length=500, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_start"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["-scheduled_start"]),
        ]

    def __str__(self):
        return self.title


class InboxConversation(models.Model):
    channel = models.CharField(max_length=24, choices=INBOX_CHANNEL_CHOICES, default="tiktok_dm")
    status = models.CharField(max_length=16, choices=INBOX_STATUS_CHOICES, default="open")
    subject = models.CharField(max_length=255, blank=True)

    customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="conversations",
    )
    contact_name = models.CharField(max_length=128, blank=True)
    contact_handle = models.CharField(max_length=128, blank=True)

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inbox_conversations",
    )
    converted_order = models.ForeignKey(
        DirectOrder,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="source_conversations",
    )

    unread_count = models.PositiveIntegerField(default=0)
    last_message_at = models.DateTimeField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]
        indexes = [
            models.Index(fields=["channel"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.channel} — {self.contact_name or self.contact_handle}"


class InboxMessage(models.Model):
    DIRECTION = [
        ("in", "Incoming"),
        ("out", "Outgoing"),
    ]

    conversation = models.ForeignKey(InboxConversation, on_delete=models.CASCADE, related_name="messages")
    direction = models.CharField(max_length=4, choices=DIRECTION, default="in")
    body = models.TextField()
    attachment_url = models.URLField(max_length=500, blank=True)

    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sent_inbox_messages",
    )
    external_id = models.CharField(max_length=128, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self):
        return f"{self.direction}: {self.body[:40]}"


class TeamMember(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="team_memberships",
    )
    name = models.CharField(max_length=128)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    role = models.CharField(max_length=16, choices=TEAM_ROLE_CHOICES, default="Support")
    status = models.CharField(max_length=16, choices=TEAM_STATUS_CHOICES, default="Invited")

    permissions = models.JSONField(default=dict, blank=True)
    location = models.ForeignKey(
        Location,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="team_members",
    )

    last_active_at = models.DateTimeField(null=True, blank=True)
    invited_at = models.DateTimeField(auto_now_add=True)
    joined_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.role})"


class ReturnRequest(models.Model):
    reference = models.CharField(max_length=32, unique=True, db_index=True)
    order = models.ForeignKey(DirectOrder, on_delete=models.CASCADE, related_name="returns")
    status = models.CharField(max_length=16, choices=RETURN_STATUS_CHOICES, default="Requested")
    reason = models.CharField(max_length=32, choices=RETURN_REASON_CHOICES, default="other")
    reason_detail = models.TextField(blank=True)

    refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    restock = models.BooleanField(default=False)
    restocked_at = models.DateTimeField(null=True, blank=True)

    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resolved_returns",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.reference} ← {self.order.reference}"


class Expense(models.Model):
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=16, choices=EXPENSE_CATEGORY_CHOICES, default="other")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_on = models.DateField(default=timezone.localdate)
    payment_method = models.CharField(max_length=32, default="M-Pesa")
    reference = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    receipt_url = models.URLField(max_length=500, blank=True)

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="recorded_expenses",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-paid_on", "-created_at"]
        indexes = [
            models.Index(fields=["category"]),
            models.Index(fields=["-paid_on"]),
        ]

    def __str__(self):
        return f"{self.title} — {self.amount}"


class Automation(models.Model):
    name = models.CharField(max_length=128)
    trigger = models.CharField(max_length=32, choices=AUTOMATION_TRIGGER_CHOICES)
    action = models.CharField(max_length=16, choices=AUTOMATION_ACTION_CHOICES)
    status = models.CharField(max_length=16, choices=AUTOMATION_STATUS_CHOICES, default="Draft")

    channel = models.CharField(max_length=32, blank=True)
    template = models.TextField(blank=True)
    delay_minutes = models.PositiveIntegerField(default=0)
    conditions = models.JSONField(default=dict, blank=True)

    runs_count = models.PositiveIntegerField(default=0)
    last_run_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} ({self.trigger} → {self.action})"


class Notification(models.Model):
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    kind = models.CharField(max_length=16, choices=NOTIFICATION_KIND_CHOICES, default="info")
    link = models.CharField(max_length=255, blank=True)

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="direct_notifications",
    )
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "-created_at"]),
            models.Index(fields=["read_at"]),
        ]

    def __str__(self):
        return self.title


class AuditLog(models.Model):
    action = models.CharField(max_length=16, choices=AUDIT_ACTION_CHOICES)
    entity = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=64, blank=True)
    summary = models.CharField(max_length=255, blank=True)
    diff = models.JSONField(default=dict, blank=True)

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_entries",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["entity", "entity_id"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return f"{self.action} {self.entity}"


class Review(models.Model):
    product = models.ForeignKey(
        DirectProduct,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviews",
    )
    order = models.ForeignKey(
        DirectOrder,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviews",
    )
    customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviews",
    )

    rating = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    title = models.CharField(max_length=128, blank=True)
    body = models.TextField(blank=True)
    media_url = models.URLField(max_length=500, blank=True)

    status = models.CharField(max_length=16, choices=REVIEW_STATUS_CHOICES, default="Pending")
    is_ugc = models.BooleanField(default=False)
    rights_granted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.rating}★ — {self.title or 'review'}"


class DeliveryZone(models.Model):
    name = models.CharField(max_length=128)
    zone = models.CharField(max_length=32, choices=SHIPPING_ZONE_CHOICES)
    counties = models.JSONField(default=list, blank=True)
    base_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    free_over = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    eta_days_min = models.PositiveSmallIntegerField(default=1)
    eta_days_max = models.PositiveSmallIntegerField(default=3)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.zone})"


class Coupon(models.Model):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    description = models.CharField(max_length=255, blank=True)
    percent_off = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    amount_off = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    min_order_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(default=0)
    uses = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code


class Lead(models.Model):
    name = models.CharField(max_length=128)
    handle = models.CharField(max_length=64, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    interest = models.CharField(max_length=255, blank=True)
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    source = models.CharField(max_length=24, choices=LEAD_SOURCE_CHOICES, default="tiktok_dm")
    status = models.CharField(max_length=24, choices=LEAD_STATUS_CHOICES, default="New")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_leads",
    )
    notes = models.TextField(blank=True)
    converted_customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="converted_leads",
    )
    converted_order = models.ForeignKey(
        DirectOrder,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="converted_leads",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["source"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.status})"


class FollowUp(models.Model):
    lead = models.ForeignKey(
        Lead,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="followups",
    )
    customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="followups",
    )
    name = models.CharField(max_length=128)
    phone = models.CharField(max_length=32, blank=True)
    type = models.CharField(max_length=16, choices=FOLLOWUP_TYPE_CHOICES, default="Call")
    date = models.DateTimeField()
    status = models.CharField(max_length=16, choices=FOLLOWUP_STATUS_CHOICES, default="Upcoming")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_followups",
    )
    notes = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.name} — {self.type} on {self.date}"


class SupportTicket(models.Model):
    reference = models.CharField(max_length=32, unique=True, db_index=True)
    customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tickets",
    )
    customer_name = models.CharField(max_length=128, blank=True)
    order = models.ForeignKey(
        DirectOrder,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tickets",
    )
    subject = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=16, choices=TICKET_PRIORITY_CHOICES, default="Normal")
    status = models.CharField(max_length=24, choices=TICKET_STATUS_CHOICES, default="Open")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_tickets",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["priority"]),
        ]

    def __str__(self):
        return f"{self.reference} — {self.subject}"


class CustomerSegment(models.Model):
    name = models.CharField(max_length=128)
    slug = models.SlugField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    rule = models.JSONField(default=dict, blank=True)
    color = models.CharField(max_length=16, default="#172554")
    is_dynamic = models.BooleanField(default=True)
    member_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Integration(models.Model):
    key = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=INTEGRATION_STATUS_CHOICES, default="disconnected")
    account_name = models.CharField(max_length=128, blank=True)
    permissions = models.CharField(max_length=255, blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.status})"


class AdCampaign(models.Model):
    campaign_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=AD_CAMPAIGN_STATUS_CHOICES, default="Draft")
    currency = models.CharField(max_length=8, default="KES")
    budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    spend = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    attributed_revenue = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    impressions = models.PositiveIntegerField(default=0)
    clicks = models.PositiveIntegerField(default=0)
    conversions = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    @property
    def cpa(self) -> Decimal:
        if self.conversions <= 0:
            return Decimal("0.00")
        return self.spend / Decimal(self.conversions)

    @property
    def roas(self) -> Decimal:
        if self.spend <= 0:
            return Decimal("0.00")
        return self.attributed_revenue / self.spend


class CreatorApplication(models.Model):
    creator = models.ForeignKey(
        Creator,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="applications",
    )
    name = models.CharField(max_length=128)
    handle = models.CharField(max_length=64)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    followers = models.PositiveIntegerField(default=0)
    niche = models.CharField(max_length=64, blank=True)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=24, choices=CREATOR_APPLICATION_STATUS_CHOICES, default="New")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_creator_applications",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} (@{self.handle}) — {self.status}"


class Partnership(models.Model):
    creator = models.ForeignKey(Creator, on_delete=models.CASCADE, related_name="partnerships")
    status = models.CharField(max_length=16, choices=PARTNERSHIP_STATUS_CHOICES, default="Active")
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))
    start_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.creator.name} — {self.status}"


class CreatorSample(models.Model):
    creator = models.ForeignKey(Creator, on_delete=models.CASCADE, related_name="samples")
    product = models.ForeignKey(DirectProduct, on_delete=models.CASCADE, related_name="creator_samples")
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=16, choices=SAMPLE_STATUS_CHOICES, default="Requested")
    tracking_number = models.CharField(max_length=64, blank=True)
    notes = models.TextField(blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return f"{self.creator.name} — {self.product.product.name}"


class PermissionGroup(models.Model):
    name = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    permissions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class NotificationSetting(models.Model):
    key = models.CharField(max_length=64, unique=True)
    label = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return f"{self.label} ({'on' if self.enabled else 'off'})"