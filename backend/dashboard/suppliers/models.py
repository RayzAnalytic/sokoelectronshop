from django.db import models


class Supplier(models.Model):
    class Type(models.TextChoices):
        MANUFACTURER = "Manufacturer", "Manufacturer"
        DISTRIBUTOR = "Distributor", "Distributor"
        WHOLESALER = "Wholesaler", "Wholesaler"
        IMPORTER = "Importer", "Importer"
        RETAILER = "Retailer", "Retailer"

    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        INACTIVE = "Inactive", "Inactive"

    contact_name = models.CharField(max_length=150)
    company = models.CharField(max_length=200, db_index=True)
    type = models.CharField(
        max_length=20,
        choices=Type.choices,
        default=Type.DISTRIBUTOR,
    )

    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)

    country = models.CharField(max_length=80, default="Kenya")
    county = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    address = models.CharField(max_length=255, blank=True)

    tax_pin = models.CharField(max_length=40, blank=True)
    reg_number = models.CharField(max_length=60, blank=True)
    payment_terms = models.CharField(max_length=40, blank=True, default="Net 30")
    payment_method = models.CharField(
        max_length=40, blank=True, default="Bank Transfer",
    )

    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["company"]
        indexes = [
            models.Index(fields=["status", "company"]),
            models.Index(fields=["company"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return self.company


class SupplierProduct(models.Model):
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name="supplier_products",
    )

    product_id = models.CharField(max_length=64, db_index=True)

    product_name = models.CharField(max_length=255)
    product_sku = models.CharField(max_length=80, blank=True)
    product_image = models.CharField(max_length=500, blank=True)
    product_category = models.CharField(max_length=120, blank=True)

    supplier_sku = models.CharField(max_length=80, blank=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_order_qty = models.PositiveIntegerField(default=1)
    lead_time_days = models.PositiveIntegerField(default=14)

    last_purchase_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
    )
    last_purchase_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["supplier", "product_id"],
                name="uniq_supplier_product",
            ),
        ]
        indexes = [
            models.Index(fields=["supplier", "-created_at"]),
            models.Index(fields=["product_id"]),
        ]

    def __str__(self):
        return f"{self.supplier.company} · {self.product_name}"


class Purchase(models.Model):
    class PaymentStatus(models.TextChoices):
        PAID = "Paid", "Paid"
        PARTIAL = "Partial", "Partial"
        UNPAID = "Unpaid", "Unpaid"

    class Status(models.TextChoices):
        RECEIVED = "Received", "Received"
        PENDING = "Pending", "Pending"
        CANCELLED = "Cancelled", "Cancelled"

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name="purchases",
    )
    number = models.CharField(max_length=40, db_index=True)
    date = models.DateField()

    items_count = models.PositiveIntegerField(default=0)
    total_qty = models.PositiveIntegerField(default=0)
    total_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
    )

    payment_status = models.CharField(
        max_length=10,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        db_index=True,
    )
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.PENDING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["supplier", "-date"]),
            models.Index(fields=["number"]),
        ]

    def __str__(self):
        return f"{self.number} · {self.supplier.company}"


class SupplierActivity(models.Model):
    class Kind(models.TextChoices):
        CREATED = "created", "Created"
        PRODUCT_ADDED = "product_added", "Product added"
        PURCHASE_RECORDED = "purchase_recorded", "Purchase recorded"
        UPDATED = "updated", "Updated"

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name="activity",
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    description = models.CharField(max_length=255)
    user_label = models.CharField(max_length=120, blank=True, default="System")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["supplier", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.supplier_id} · {self.kind} · {self.description[:40]}"