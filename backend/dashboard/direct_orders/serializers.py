from django.apps import apps
from django.conf import settings
from django.db import transaction
from rest_framework import serializers

from checkout.models import Order, OrderItem
from .models import (
    AttributionLink,
    AuditLog,
    Automation,
    Campaign,
    ContentPost,
    Coupon,
    Creator,
    CreatorSale,
    Customer,
    DeliveryZone,
    DirectOrder,
    DirectOrderItem,
    DirectProduct,
    Expense,
    InboxConversation,
    InboxMessage,
    InventoryMovement,
    LiveSession,
    Location,
    Notification,
    PayoutBatch,
    ProductVariant,
    PurchaseOrder,
    PurchaseOrderItem,
    ReturnRequest,
    Review,
    Supplier,
    TeamMember,
)


def _absolute_url(request, url: str | None) -> str:
    if not url:
        return ""
    url = str(url).strip()
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url

    stripped = url.lstrip("/")
    media_prefix = (settings.MEDIA_URL or "/media/").strip("/")

    if media_prefix and not stripped.startswith(f"{media_prefix}/"):
        if not stripped.startswith(("static/",)):
            stripped = f"{media_prefix}/{stripped}"

    normalised = "/" + stripped

    if request is not None:
        try:
            return request.build_absolute_uri(normalised)
        except Exception:
            return normalised
    return normalised


def _first_image_url(product) -> str | None:
    if product is None:
        return None

    images = getattr(product, "images", None)
    if images is not None:
        try:
            first = images.all().first()
            if first is not None:
                for attr in ("url", "image_url", "image", "src"):
                    v = getattr(first, attr, None)
                    if v:
                        return str(v)
        except Exception:
            pass

    for attr in ("image", "image_url", "thumbnail"):
        v = getattr(product, attr, None)
        if v:
            return str(v)

    return None


def _display_status(order: Order) -> str:
    if order.status == "cancelled":
        return "Cancelled"
    if order.status == "returned":
        return "Returned"
    if order.status == "failed":
        return "Cancelled"
    if order.status == "delivered":
        return "Delivered"
    if order.status == "shipped":
        return "Shipped"

    if order.payment_status == "paid":
        if order.status in ("confirmed", "processing"):
            return "Awaiting Shipment"
        return "Paid"

    if order.status == "pending":
        return "Awaiting Payment"
    return "New"


class ProductVariantSerializer(serializers.ModelSerializer):
    priceDelta = serializers.DecimalField(
        source="price_delta", max_digits=12, decimal_places=2,
        required=False, default=0,
    )
    stockQuantity = serializers.IntegerField(
        source="stock_quantity", required=False, default=0,
    )
    imageUrl = serializers.CharField(
        source="image_url", required=False, allow_blank=True, default="",
    )
    isActive = serializers.BooleanField(
        source="is_active", required=False, default=True,
    )

    class Meta:
        model = ProductVariant
        fields = (
            "id", "name", "sku", "size", "color",
            "priceDelta", "stockQuantity", "imageUrl", "isActive",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class SupplierSerializer(serializers.ModelSerializer):
    contactPerson = serializers.CharField(
        source="contact_person", required=False, allow_blank=True, default="",
    )
    paymentTerms = serializers.CharField(
        source="payment_terms", required=False, allow_blank=True, default="",
    )
    taxPin = serializers.CharField(
        source="tax_pin", required=False, allow_blank=True, default="",
    )
    isActive = serializers.BooleanField(
        source="is_active", required=False, default=True,
    )

    class Meta:
        model = Supplier
        fields = (
            "id", "name", "phone", "email", "address",
            "contactPerson", "paymentTerms", "taxPin",
            "isActive", "notes", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    productId = serializers.IntegerField(
        source="product_id", required=False, allow_null=True,
    )
    productName = serializers.CharField(source="product_name", max_length=255)
    unitCost = serializers.DecimalField(
        source="unit_cost", max_digits=12, decimal_places=2,
    )
    subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )

    class Meta:
        model = PurchaseOrderItem
        fields = (
            "id", "productId", "productName",
            "quantity", "unitCost", "subtotal",
        )
        read_only_fields = ("id", "subtotal")


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplierName = serializers.CharField(source="supplier.name", read_only=True)
    supplierId = serializers.IntegerField(source="supplier_id")
    expectedAt = serializers.DateField(
        source="expected_at", required=False, allow_null=True,
    )
    receivedAt = serializers.DateTimeField(
        source="received_at", read_only=True,
    )
    items = PurchaseOrderItemSerializer(many=True, required=False)
    subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )
    total = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )

    class Meta:
        model = PurchaseOrder
        fields = (
            "id", "reference", "supplierId", "supplierName",
            "status", "expectedAt", "receivedAt",
            "subtotal", "shipping", "total", "notes",
            "items", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "reference", "supplierName",
            "subtotal", "total", "receivedAt",
            "created_at", "updated_at",
        )

    @transaction.atomic
    def create(self, validated):
        items_data = validated.pop("items", [])
        if not validated.get("reference"):
            import random
            validated["reference"] = f"PO-{random.randint(10000, 99999)}"
        po = PurchaseOrder.objects.create(**validated)
        for item in items_data:
            product = None
            pid = item.pop("product_id", None)
            if pid:
                try:
                    product = DirectProduct.objects.get(pk=pid)
                except DirectProduct.DoesNotExist:
                    product = None
            PurchaseOrderItem.objects.create(
                purchase_order=po,
                product=product,
                product_name=item.get("product_name", ""),
                quantity=item.get("quantity", 1),
                unit_cost=item["unit_cost"],
                subtotal=item["unit_cost"] * item.get("quantity", 1),
            )
        po.recompute_totals()
        return po

    @transaction.atomic
    def update(self, instance, validated):
        items_data = validated.pop("items", None)
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                product = None
                pid = item.pop("product_id", None)
                if pid:
                    try:
                        product = DirectProduct.objects.get(pk=pid)
                    except DirectProduct.DoesNotExist:
                        product = None
                PurchaseOrderItem.objects.create(
                    purchase_order=instance,
                    product=product,
                    product_name=item.get("product_name", ""),
                    quantity=item.get("quantity", 1),
                    unit_cost=item["unit_cost"],
                    subtotal=item["unit_cost"] * item.get("quantity", 1),
                )
            instance.recompute_totals()
        return instance


class LocationSerializer(serializers.ModelSerializer):
    isDefault = serializers.BooleanField(
        source="is_default", required=False, default=False,
    )
    isActive = serializers.BooleanField(
        source="is_active", required=False, default=True,
    )

    class Meta:
        model = Location
        fields = (
            "id", "name", "kind", "address", "county",
            "isDefault", "isActive", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class InventoryMovementSerializer(serializers.ModelSerializer):
    productId = serializers.IntegerField(source="product_id")
    variantId = serializers.IntegerField(
        source="variant_id", required=False, allow_null=True,
    )
    locationId = serializers.IntegerField(
        source="location_id", required=False, allow_null=True,
    )
    unitCost = serializers.DecimalField(
        source="unit_cost", max_digits=12, decimal_places=2,
        required=False, default=0,
    )
    createdBy = serializers.IntegerField(
        source="created_by_id", read_only=True,
    )

    class Meta:
        model = InventoryMovement
        fields = (
            "id", "productId", "variantId", "locationId",
            "kind", "quantity", "unitCost",
            "reference", "notes", "createdBy", "created_at",
        )
        read_only_fields = ("id", "createdBy", "created_at")


class CustomerSerializer(serializers.ModelSerializer):
    whatsappOptIn = serializers.BooleanField(
        source="whatsapp_opt_in", required=False, default=True,
    )
    smsOptIn = serializers.BooleanField(
        source="sms_opt_in", required=False, default=False,
    )
    emailOptIn = serializers.BooleanField(
        source="email_opt_in", required=False, default=False,
    )
    totalOrders = serializers.IntegerField(
        source="total_orders", read_only=True,
    )
    lifetimeSpend = serializers.DecimalField(
        source="lifetime_spend",
        max_digits=14, decimal_places=2, read_only=True,
    )
    avgOrderValue = serializers.DecimalField(
        source="avg_order_value",
        max_digits=12, decimal_places=2, read_only=True,
    )
    lastOrderAt = serializers.DateTimeField(
        source="last_order_at", read_only=True,
    )

    class Meta:
        model = Customer
        fields = (
            "id", "name", "phone", "email",
            "county", "estate", "address",
            "segment", "tags",
            "whatsappOptIn", "smsOptIn", "emailOptIn", "birthday",
            "totalOrders", "lifetimeSpend", "avgOrderValue", "lastOrderAt",
            "notes", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "totalOrders", "lifetimeSpend", "avgOrderValue",
            "lastOrderAt", "created_at", "updated_at",
        )


class DirectOrderItemSerializer(serializers.ModelSerializer):
    productId = serializers.CharField(source="product_id", read_only=True)
    productName = serializers.CharField(source="name", read_only=True)
    qty = serializers.IntegerField(source="quantity", read_only=True)
    price = serializers.DecimalField(
        source="unit_price", max_digits=12, decimal_places=2, read_only=True,
    )
    subtotal = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            "productId", "productName", "sku",
            "qty", "price", "subtotal", "image",
        )

    def get_subtotal(self, obj):
        try:
            return str(obj.unit_price * obj.quantity)
        except Exception:
            return "0"

    def get_image(self, obj):
        request = self.context.get("request")

        for attr in ("image_url", "image"):
            v = getattr(obj, attr, None)
            if v:
                return _absolute_url(request, str(v))

        product = getattr(obj, "product", None)
        if product is not None:
            return _absolute_url(request, _first_image_url(product))

        return ""


class DirectOrderSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="reference", read_only=True)
    reference = serializers.CharField(read_only=True)

    customerName = serializers.SerializerMethodField()
    customerPhone = serializers.CharField(source="contact_phone", read_only=True)
    customerEmail = serializers.SerializerMethodField()
    customerTikTok = serializers.SerializerMethodField()

    source = serializers.SerializerMethodField()
    items = DirectOrderItemSerializer(many=True, read_only=True)
    itemCount = serializers.SerializerMethodField()

    subtotal = serializers.SerializerMethodField()
    shipping = serializers.SerializerMethodField()
    discount = serializers.SerializerMethodField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    status = serializers.SerializerMethodField()
    backendStatus = serializers.CharField(source="status", read_only=True)
    paymentStatus = serializers.CharField(source="payment_status", read_only=True)

    paymentMethod = serializers.SerializerMethodField()
    mpesaCode = serializers.SerializerMethodField()

    courier = serializers.CharField(read_only=True)
    trackingNumber = serializers.CharField(source="tracking_number", read_only=True)

    creatorId = serializers.SerializerMethodField()
    creatorName = serializers.SerializerMethodField()
    commission = serializers.SerializerMethodField()

    notes = serializers.CharField(read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    deliveredAt = serializers.DateTimeField(source="delivered_at", read_only=True)

    channelMeta = serializers.JSONField(source="channel_meta", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id", "reference",
            "customerName", "customerPhone", "customerEmail", "customerTikTok",
            "source", "items", "itemCount",
            "subtotal", "shipping", "discount", "total",
            "status", "backendStatus", "paymentStatus",
            "paymentMethod", "mpesaCode",
            "courier", "trackingNumber",
            "creatorId", "creatorName", "commission",
            "notes", "createdAt", "updatedAt", "deliveredAt",
            "channelMeta",
        )

    def get_customerName(self, obj):
        return (
            (obj.snapshot or {}).get("full_name")
            or (obj.user.get_full_name() if obj.user else "")
            or obj.contact_email
            or "—"
        )

    def get_customerEmail(self, obj):
        return obj.contact_email or ""

    def get_customerTikTok(self, obj):
        return (obj.channel_meta or {}).get("tiktok_handle", "")

    def get_source(self, obj):
        if obj.source:
            return obj.source
        origin = (obj.channel_meta or {}).get("origin")
        if origin == "tiktok_video":
            return "admin"
        if origin in ("tiktok_live", "tiktok_dm"):
            return "whatsapp"
        return "whatsapp"

    def get_itemCount(self, obj):
        try:
            return sum(i.quantity for i in obj.items.all())
        except Exception:
            return 0

    def get_subtotal(self, obj):
        return str(getattr(obj, "subtotal", obj.total) or "0")

    def get_shipping(self, obj):
        return str(getattr(obj, "shipping_cost", 0) or 0)

    def get_discount(self, obj):
        return str(getattr(obj, "discount_amount", 0) or 0)

    def get_status(self, obj):
        return _display_status(obj)

    def get_paymentMethod(self, obj):
        return "M-Pesa" if obj.payment_method == "MPESA" else "Cash on Delivery"

    def get_mpesaCode(self, obj):
        p = getattr(obj, "successful_payment", None)
        return p.mpesa_receipt_number if p else ""

    def get_creatorId(self, obj):
        sale = obj.creator_sales.select_related("creator").first()
        return sale.creator_id if sale else None

    def get_creatorName(self, obj):
        sale = obj.creator_sales.select_related("creator").first()
        return sale.creator.name if sale else ""

    def get_commission(self, obj):
        sale = obj.creator_sales.first()
        return str(sale.commission_amount) if sale else "0"


class DirectOrderItemWriteSerializer(serializers.ModelSerializer):
    productId = serializers.IntegerField(
        source="product_id", required=False, allow_null=True,
    )
    variantId = serializers.IntegerField(
        source="variant_id", required=False, allow_null=True,
    )
    productName = serializers.CharField(source="product_name", max_length=255)
    sku = serializers.CharField(required=False, allow_blank=True, default="")
    image = serializers.SerializerMethodField()
    qty = serializers.IntegerField(source="quantity", required=False, default=1)
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    subtotal = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )
    costPrice = serializers.DecimalField(
        source="cost_price", max_digits=12, decimal_places=2,
        required=False, default=0,
    )

    class Meta:
        model = DirectOrderItem
        fields = (
            "productId", "variantId", "productName", "sku", "image",
            "qty", "price", "subtotal", "costPrice",
        )

    def get_image(self, obj):
        request = self.context.get("request")

        v = getattr(obj, "image", None)
        if v:
            return _absolute_url(request, str(v))

        product = getattr(obj, "product", None)
        if product is not None:
            catalog_product = getattr(product, "product", None)
            if catalog_product is not None:
                return _absolute_url(request, _first_image_url(catalog_product))

        return ""

    def to_internal_value(self, data):
        data = dict(data)
        image = data.pop("image", None)
        validated = super().to_internal_value(data)
        if image is not None:
            validated["image"] = image
        return validated


class DirectOrderWriteSerializer(serializers.ModelSerializer):
    customerName = serializers.CharField(source="customer_name", max_length=128)
    customerPhone = serializers.CharField(
        source="customer_phone", max_length=32,
        required=False, allow_blank=True, default="",
    )
    customerEmail = serializers.EmailField(
        source="customer_email",
        required=False, allow_blank=True, default="",
    )
    customerId = serializers.IntegerField(
        source="customer_id", required=False, allow_null=True,
    )
    source = serializers.ChoiceField(
        choices=["whatsapp", "phone", "admin", "live", "video_dm", "bio_link"],
        default="whatsapp",
    )
    status = serializers.ChoiceField(
        choices=[
            "New", "Awaiting Payment", "Paid",
            "Awaiting Shipment", "Shipped", "Delivered",
            "Cancelled", "Returned",
        ],
        default="New",
    )
    paymentMethod = serializers.CharField(
        source="payment_method", required=False, default="M-Pesa",
    )
    paymentStatus = serializers.ChoiceField(
        source="payment_status",
        choices=["unpaid", "partial", "paid", "refunded"],
        required=False,
        default="unpaid",
    )
    paymentReference = serializers.CharField(
        source="payment_reference",
        required=False, allow_blank=True, default="",
    )
    courier = serializers.CharField(
        required=False, allow_blank=True, default="",
    )
    trackingNumber = serializers.CharField(
        source="tracking_number",
        required=False, allow_blank=True, default="",
    )
    shippingZone = serializers.CharField(
        source="shipping_zone",
        required=False, allow_blank=True, default="",
    )
    priority = serializers.CharField(required=False, default="normal")
    assignedTo = serializers.IntegerField(
        source="assigned_to_id", required=False, allow_null=True,
    )
    creatorId = serializers.IntegerField(
        source="creator_id", required=False, allow_null=True,
    )
    commission = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0,
    )
    campaignId = serializers.IntegerField(
        source="campaign_id", required=False, allow_null=True,
    )
    attributionId = serializers.IntegerField(
        source="attribution_id", required=False, allow_null=True,
    )
    shipping = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0,
    )
    discount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    tags = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )

    items = DirectOrderItemWriteSerializer(many=True)

    class Meta:
        model = DirectOrder
        fields = (
            "reference",
            "customerName", "customerPhone", "customerEmail", "customerId",
            "source", "status",
            "paymentMethod", "paymentStatus", "paymentReference",
            "shipping", "discount",
            "courier", "trackingNumber", "shippingZone", "priority",
            "assignedTo", "creatorId", "commission",
            "campaignId", "attributionId",
            "notes", "tags", "items",
        )
        read_only_fields = ("reference",)

    @transaction.atomic
    def create(self, validated):
        items_data = validated.pop("items", [])

        validated["reference"] = DirectOrder.generate_reference()
        order = DirectOrder.objects.create(**validated)

        for item in items_data:
            product = None
            pid = item.pop("product_id", None)
            if pid:
                try:
                    product = DirectProduct.objects.get(pk=pid)
                except DirectProduct.DoesNotExist:
                    product = None

            variant = None
            vid = item.pop("variant_id", None)
            if vid:
                try:
                    variant = ProductVariant.objects.get(pk=vid)
                except ProductVariant.DoesNotExist:
                    variant = None

            DirectOrderItem.objects.create(
                order=order,
                product=product,
                variant=variant,
                product_name=item.get("product_name", ""),
                sku=item.get("sku", ""),
                image=item.get("image", ""),
                quantity=item.get("quantity", 1),
                price=item["price"],
                subtotal=item["price"] * item.get("quantity", 1),
                cost_price=item.get("cost_price", 0),
            )

        order.recompute_totals()
        if order.customer_id is None and order.customer_phone:
            cust, _ = Customer.objects.get_or_create(
                phone=order.customer_phone,
                defaults={
                    "name": order.customer_name,
                    "email": order.customer_email,
                },
            )
            order.customer = cust
            order.save(update_fields=["customer"])
        if order.customer_id:
            order.customer.recompute_stats()
        return order

    @transaction.atomic
    def update(self, instance, validated):
        items_data = validated.pop("items", None)

        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                product = None
                pid = item.pop("product_id", None)
                if pid:
                    try:
                        product = DirectProduct.objects.get(pk=pid)
                    except DirectProduct.DoesNotExist:
                        product = None

                variant = None
                vid = item.pop("variant_id", None)
                if vid:
                    try:
                        variant = ProductVariant.objects.get(pk=vid)
                    except ProductVariant.DoesNotExist:
                        variant = None

                DirectOrderItem.objects.create(
                    order=instance,
                    product=product,
                    variant=variant,
                    product_name=item.get("product_name", ""),
                    sku=item.get("sku", ""),
                    image=item.get("image", ""),
                    quantity=item.get("quantity", 1),
                    price=item["price"],
                    subtotal=item["price"] * item.get("quantity", 1),
                    cost_price=item.get("cost_price", 0),
                )
            instance.recompute_totals()

        return instance


class DirectOrderReadSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="reference", read_only=True)
    reference = serializers.CharField(read_only=True)

    customerName = serializers.CharField(source="customer_name", read_only=True)
    customerPhone = serializers.CharField(source="customer_phone", read_only=True)
    customerEmail = serializers.CharField(source="customer_email", read_only=True)
    customerId = serializers.IntegerField(source="customer_id", read_only=True)

    items = DirectOrderItemWriteSerializer(many=True, read_only=True)
    itemCount = serializers.IntegerField(source="item_count", read_only=True)

    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    shipping = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    status = serializers.CharField(read_only=True)
    backendStatus = serializers.CharField(source="status", read_only=True)
    paymentStatus = serializers.CharField(source="payment_status", read_only=True)
    paymentMethod = serializers.CharField(source="payment_method", read_only=True)
    paymentReference = serializers.CharField(
        source="payment_reference", read_only=True,
    )

    courier = serializers.CharField(read_only=True)
    trackingNumber = serializers.CharField(source="tracking_number", read_only=True)
    shippingZone = serializers.CharField(source="shipping_zone", read_only=True)
    priority = serializers.CharField(read_only=True)

    creatorId = serializers.IntegerField(source="creator_id", read_only=True)
    creatorName = serializers.SerializerMethodField()
    commission = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )

    campaignId = serializers.IntegerField(source="campaign_id", read_only=True)
    attributionId = serializers.IntegerField(
        source="attribution_id", read_only=True,
    )

    assignedTo = serializers.IntegerField(source="assigned_to_id", read_only=True)
    codRisk = serializers.CharField(source="cod_risk", read_only=True)

    notes = serializers.CharField(read_only=True)
    tags = serializers.JSONField(read_only=True)

    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    deliveredAt = serializers.DateTimeField(source="delivered_at", read_only=True)

    class Meta:
        model = DirectOrder
        fields = (
            "id", "reference",
            "customerName", "customerPhone", "customerEmail", "customerId",
            "source", "items", "itemCount",
            "subtotal", "shipping", "discount", "total",
            "status", "backendStatus", "paymentStatus",
            "paymentMethod", "paymentReference",
            "courier", "trackingNumber", "shippingZone", "priority",
            "creatorId", "creatorName", "commission",
            "campaignId", "attributionId",
            "assignedTo", "codRisk",
            "notes", "tags",
            "createdAt", "updatedAt", "deliveredAt",
        )

    def get_creatorName(self, obj):
        return obj.creator.name if obj.creator_id else ""


class DirectOrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            "New", "Awaiting Payment", "Paid",
            "Awaiting Shipment", "Shipped", "Delivered",
            "Cancelled", "Returned",
        ]
    )


class CreatorSerializer(serializers.ModelSerializer):
    commissionRate = serializers.DecimalField(
        source="commission_rate", max_digits=5, decimal_places=2,
    )
    startDate = serializers.DateField(
        source="start_date", required=False, allow_null=True,
    )
    avatar = serializers.SerializerMethodField()
    platform = serializers.CharField(
        required=False,
        allow_blank=True,
        default="TikTok",
    )
    payoutMethod = serializers.CharField(
        source="payout_method",
        required=False,
        allow_blank=True,
        default="M-Pesa",
    )
    payoutPhone = serializers.CharField(
        source="payout_phone",
        required=False,
        allow_blank=True,
        default="",
    )
    taxPin = serializers.CharField(
        source="tax_pin",
        required=False,
        allow_blank=True,
        default="",
    )
    engagementRate = serializers.DecimalField(
        source="engagement_rate",
        max_digits=5, decimal_places=2,
        required=False, default=0,
    )
    avgViews = serializers.IntegerField(
        source="avg_views", required=False, default=0,
    )

    salesDriven = serializers.IntegerField(source="sales_driven", read_only=True)
    commissionOwed = serializers.DecimalField(
        source="commission_owed", max_digits=12, decimal_places=2, read_only=True,
    )
    commissionPaid = serializers.DecimalField(
        source="commission_paid", max_digits=12, decimal_places=2, read_only=True,
    )
    revenue = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )
    ordersCount = serializers.IntegerField(source="orders_count", read_only=True)

    class Meta:
        model = Creator
        fields = (
            "id", "name", "handle", "followers", "niche",
            "commissionRate", "startDate", "status",
            "avatar", "platform",
            "phone", "email", "taxPin",
            "payoutMethod", "payoutPhone",
            "engagementRate", "avgViews",
            "salesDriven", "commissionOwed", "commissionPaid",
            "revenue", "ordersCount",
            "notes", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "created_at", "updated_at",
            "salesDriven", "commissionOwed", "commissionPaid",
            "revenue", "ordersCount",
        )

    def get_avatar(self, obj):
        request = self.context.get("request")
        return _absolute_url(request, obj.avatar_url)

    def validate_handle(self, value):
        return value.lstrip("@")

    def to_internal_value(self, data):
        data = dict(data)
        avatar = data.pop("avatar", None)
        validated = super().to_internal_value(data)
        if avatar is not None:
            validated["avatar_url"] = avatar
        return validated


class CreatorSaleSerializer(serializers.ModelSerializer):
    creatorId = serializers.IntegerField(source="creator_id")
    creatorName = serializers.CharField(source="creator.name", read_only=True)
    orderReference = serializers.CharField(source="order.reference", read_only=True)
    commissionRate = serializers.DecimalField(
        source="commission_rate", max_digits=5, decimal_places=2,
    )
    commissionAmount = serializers.DecimalField(
        source="commission_amount", max_digits=12, decimal_places=2,
    )
    attributedAt = serializers.DateTimeField(
        source="attributed_at", read_only=True,
    )
    paidAt = serializers.DateTimeField(
        source="paid_at", required=False, allow_null=True,
    )
    payoutReference = serializers.CharField(
        source="payout_reference",
        required=False,
        allow_blank=True,
        default="",
    )
    payoutId = serializers.IntegerField(
        source="payout_id", required=False, allow_null=True,
    )

    class Meta:
        model = CreatorSale
        fields = (
            "id", "creatorId", "creatorName", "order", "orderReference",
            "commissionRate", "commissionAmount",
            "paid", "paidAt", "payoutReference", "payoutId",
            "notes", "attributedAt",
        )
        read_only_fields = ("id", "attributedAt", "creatorName", "orderReference")


class PayoutBatchSerializer(serializers.ModelSerializer):
    totalAmount = serializers.DecimalField(
        source="total_amount", max_digits=14, decimal_places=2, read_only=True,
    )
    itemsCount = serializers.IntegerField(source="items_count", read_only=True)
    payoutMethod = serializers.CharField(
        source="payout_method",
        required=False,
        allow_blank=True,
        default="M-Pesa",
    )
    approvedBy = serializers.IntegerField(
        source="approved_by_id", read_only=True,
    )
    approvedAt = serializers.DateTimeField(
        source="approved_at", read_only=True,
    )
    paidAt = serializers.DateTimeField(source="paid_at", read_only=True)

    class Meta:
        model = PayoutBatch
        fields = (
            "id", "reference", "status",
            "totalAmount", "itemsCount", "payoutMethod",
            "approvedBy", "approvedAt", "paidAt",
            "notes", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "reference", "totalAmount", "itemsCount",
            "approvedBy", "approvedAt", "paidAt",
            "created_at", "updated_at",
        )


class CampaignSerializer(serializers.ModelSerializer):
    startsAt = serializers.DateTimeField(
        source="starts_at", required=False, allow_null=True,
    )
    endsAt = serializers.DateTimeField(
        source="ends_at", required=False, allow_null=True,
    )

    class Meta:
        model = Campaign
        fields = (
            "id", "name", "slug", "status",
            "startsAt", "endsAt", "budget", "objective",
            "notes", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class AttributionLinkSerializer(serializers.ModelSerializer):
    utmSource = serializers.CharField(
        source="utm_source", required=False, allow_blank=True, default="",
    )
    utmMedium = serializers.CharField(
        source="utm_medium", required=False, allow_blank=True, default="",
    )
    utmCampaign = serializers.CharField(
        source="utm_campaign", required=False, allow_blank=True, default="",
    )
    creatorId = serializers.IntegerField(
        source="creator_id", required=False, allow_null=True,
    )
    campaignId = serializers.IntegerField(
        source="campaign_id", required=False, allow_null=True,
    )
    contentId = serializers.IntegerField(
        source="content_id", required=False, allow_null=True,
    )
    liveId = serializers.IntegerField(
        source="live_id", required=False, allow_null=True,
    )
    isActive = serializers.BooleanField(
        source="is_active", required=False, default=True,
    )

    class Meta:
        model = AttributionLink
        fields = (
            "id", "kind", "code", "label", "url",
            "utmSource", "utmMedium", "utmCampaign",
            "creatorId", "campaignId", "contentId", "liveId",
            "clicks", "conversions", "revenue", "isActive",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ContentPostSerializer(serializers.ModelSerializer):
    STATUS_MAP = {
        "Draft": "IDEA",
        "Scheduled": "SCRIPTED",
        "Posted": "POSTED",
        "Archived": "POSTED",
    }
    STATUS_MAP_REVERSE = {
        "IDEA": "Draft",
        "SCRIPTED": "Scheduled",
        "FILMED": "Scheduled",
        "POSTED": "Posted",
    }

    TYPE_MAP = {
        "Video": "VIDEO",
        "Photo carousel": "PHOTO_CAROUSEL",
        "LIVE promotion": "LIVE_PROMO",
    }
    TYPE_MAP_REVERSE = {v: k for k, v in TYPE_MAP.items()}

    type = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    scheduledAt = serializers.DateTimeField(
        source="scheduled_at",
        required=False,
        allow_null=True,
    )
    postedUrl = serializers.SerializerMethodField()
    thumbnailUrl = serializers.SerializerMethodField()
    videoUrl = serializers.SerializerMethodField()

    caption = serializers.CharField(required=False, allow_blank=True, default="")
    platform = serializers.CharField(required=False, allow_blank=True, default="TikTok")
    hook = serializers.CharField(required=False, allow_blank=True, default="")
    sound = serializers.CharField(required=False, allow_blank=True, default="")

    creatorId = serializers.IntegerField(
        source="creator_id", required=False, allow_null=True,
    )
    campaignId = serializers.IntegerField(
        source="campaign_id", required=False, allow_null=True,
    )

    products = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        default=list,
    )
    productName = serializers.SerializerMethodField()

    shares = serializers.IntegerField(required=False, default=0)
    saves = serializers.IntegerField(required=False, default=0)
    ordersAttributed = serializers.IntegerField(
        source="orders_attributed", required=False, default=0,
    )
    revenueAttributed = serializers.DecimalField(
        source="revenue_attributed",
        max_digits=14, decimal_places=2, read_only=True,
    )
    revenuePer1kViews = serializers.DecimalField(
        source="revenue_per_1k_views",
        max_digits=14, decimal_places=2, read_only=True,
    )

    class Meta:
        model = ContentPost
        fields = (
            "id", "title", "type", "status",
            "platform", "scheduledAt",
            "hook", "script", "caption", "hashtags", "sound",
            "postedUrl", "thumbnailUrl", "videoUrl",
            "creatorId", "campaignId",
            "products", "productName",
            "views", "likes", "comments", "shares", "saves",
            "ordersAttributed", "revenueAttributed", "revenuePer1kViews",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "created_at", "updated_at", "productName",
            "revenueAttributed", "revenuePer1kViews",
        )

    def get_type(self, obj):
        return self.TYPE_MAP_REVERSE.get(obj.content_type, obj.content_type)

    def get_status(self, obj):
        return self.STATUS_MAP_REVERSE.get(obj.status, obj.status)

    def get_productName(self, obj):
        if not obj.products:
            return ""
        first = obj.products[0]
        return first if isinstance(first, str) else str(first)

    def get_postedUrl(self, obj):
        request = self.context.get("request")
        return _absolute_url(request, obj.posted_url)

    def get_thumbnailUrl(self, obj):
        request = self.context.get("request")
        return _absolute_url(request, obj.thumbnail_url)

    def get_videoUrl(self, obj):
        request = self.context.get("request")
        return _absolute_url(request, obj.video_url)

    def to_internal_value(self, data):
        data = dict(data)

        if "type" in data:
            data["content_type"] = self.TYPE_MAP.get(data.pop("type"))

        if "status" in data:
            raw = data.pop("status")
            data["status"] = self.STATUS_MAP.get(raw, raw)

        if "thumbnail" in data:
            data["thumbnail_url"] = data.pop("thumbnail")

        if "productName" in data and "products" not in data:
            pn = data.pop("productName")
            data["products"] = [pn] if pn else []

        for key, target in (
            ("videoUrl", "video_url"),
            ("thumbnailUrl", "thumbnail_url"),
            ("postedUrl", "posted_url"),
        ):
            if key in data:
                data[target] = data.pop(key)

        return super().to_internal_value(data)


class LiveSessionSerializer(serializers.ModelSerializer):
    STATUS_MAP = {
        "Scheduled": "SCHEDULED",
        "Live": "LIVE",
        "Ended": "COMPLETED",
        "Cancelled": "CANCELLED",
    }
    STATUS_MAP_REVERSE = {
        "SCHEDULED": "Scheduled",
        "LIVE": "Live",
        "COMPLETED": "Ended",
        "CANCELLED": "Cancelled",
    }

    status = serializers.SerializerMethodField()

    scheduledAt = serializers.DateTimeField(source="scheduled_start")
    scheduledEnd = serializers.DateTimeField(
        source="scheduled_end", required=False, allow_null=True,
    )
    durationMin = serializers.IntegerField(
        source="duration_min", required=False, default=60,
    )
    hostName = serializers.CharField(
        source="host_name",
        required=False,
        allow_blank=True,
        default="",
    )
    cohostName = serializers.CharField(
        source="cohost_name",
        required=False,
        allow_blank=True,
        default="",
    )
    creatorId = serializers.IntegerField(
        source="creator_id", required=False, allow_null=True,
    )
    campaignId = serializers.IntegerField(
        source="campaign_id", required=False, allow_null=True,
    )
    runSheet = serializers.CharField(
        source="run_sheet", required=False, allow_blank=True, default="",
    )
    couponCode = serializers.CharField(
        source="coupon_code", required=False, allow_blank=True, default="",
    )
    peakViewers = serializers.IntegerField(
        source="peak_viewers", required=False, default=0,
    )
    totalViewers = serializers.IntegerField(
        source="total_viewers", required=False, default=0,
    )
    ordersGenerated = serializers.IntegerField(
        source="orders_generated", required=False, default=0,
    )
    topProduct = serializers.CharField(
        source="top_product", required=False, allow_blank=True, default="",
    )
    replayUrl = serializers.CharField(
        source="replay_url", required=False, allow_blank=True, default="",
    )

    class Meta:
        model = LiveSession
        fields = (
            "id", "title", "scheduledAt", "scheduledEnd", "durationMin", "status",
            "hostName", "cohostName",
            "creatorId", "campaignId",
            "products", "runSheet", "couponCode",
            "peakViewers", "totalViewers",
            "ordersGenerated", "revenue", "topProduct", "replayUrl",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_status(self, obj):
        return self.STATUS_MAP_REVERSE.get(obj.status, obj.status)

    def to_internal_value(self, data):
        data = dict(data)
        if "status" in data:
            raw = data.pop("status")
            data["status"] = self.STATUS_MAP.get(raw, raw)
        return super().to_internal_value(data)


class DirectProductSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    image = serializers.SerializerMethodField()
    price = serializers.DecimalField(
        source="product.price", max_digits=12, decimal_places=2, read_only=True,
    )
    compareAtPrice = serializers.SerializerMethodField()
    stockQuantity = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    brand = serializers.SerializerMethodField()

    directSalesCount = serializers.IntegerField(
        source="direct_sales_count", read_only=True,
    )
    directRevenue = serializers.DecimalField(
        source="direct_revenue",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    lowStockThreshold = serializers.IntegerField(
        source="low_stock_threshold", required=False,
    )
    videoLink = serializers.URLField(
        source="video_link", required=False, allow_blank=True,
    )
    linkedToWebsite = serializers.BooleanField(
        source="linked_to_website", required=False,
    )
    viral = serializers.BooleanField(required=False)

    costPrice = serializers.DecimalField(
        source="cost_price", max_digits=12, decimal_places=2,
        required=False, default=0,
    )
    supplierId = serializers.IntegerField(
        source="supplier_id", required=False, allow_null=True,
    )
    reorderPoint = serializers.IntegerField(
        source="reorder_point", required=False, default=5,
    )
    reorderQuantity = serializers.IntegerField(
        source="reorder_quantity", required=False, default=10,
    )
    isBundle = serializers.BooleanField(
        source="is_bundle", required=False, default=False,
    )
    isPreorder = serializers.BooleanField(
        source="is_preorder", required=False, default=False,
    )
    preorderEta = serializers.DateField(
        source="preorder_eta", required=False, allow_null=True,
    )
    commissionRate = serializers.DecimalField(
        source="commission_rate",
        max_digits=5, decimal_places=2,
        required=False, default=10,
    )
    margin = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True,
    )
    marginPercent = serializers.DecimalField(
        source="margin_percent",
        max_digits=6, decimal_places=2, read_only=True,
    )
    variants = ProductVariantSerializer(many=True, read_only=True)

    class Meta:
        model = DirectProduct
        fields = (
            "id", "name", "sku", "image", "price", "compareAtPrice",
            "stockQuantity", "category", "brand",
            "directSalesCount", "directRevenue",
            "lowStockThreshold", "status", "viral",
            "videoLink", "linkedToWebsite",
            "costPrice", "supplierId", "reorderPoint", "reorderQuantity",
            "isBundle", "isPreorder", "preorderEta", "commissionRate",
            "tags", "seo_title", "seo_description",
            "margin", "marginPercent",
            "variants",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "name", "sku", "price", "stockQuantity",
            "category", "brand", "directSalesCount", "directRevenue",
            "margin", "marginPercent",
            "created_at", "updated_at",
        )

    def get_image(self, obj):
        request = self.context.get("request")
        return _absolute_url(request, _first_image_url(obj.product))

    def get_compareAtPrice(self, obj):
        for attr in ("compare_at_price", "compare_at"):
            v = getattr(obj.product, attr, None)
            if v is not None:
                return str(v)
        return None

    def get_stockQuantity(self, obj):
        return getattr(obj.product, "stock_quantity", 0)

    def get_category(self, obj):
        cat = getattr(obj.product, "category", None)
        return getattr(cat, "name", "") if cat else ""

    def get_brand(self, obj):
        b = getattr(obj.product, "brand", None)
        return getattr(b, "name", "") if b else ""


class ProductCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    sku = serializers.CharField(required=False, allow_blank=True, default="")
    image = serializers.CharField(required=False, allow_blank=True, default="")
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    compareAtPrice = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True,
    )
    stockQuantity = serializers.IntegerField(required=False, default=0)
    category = serializers.CharField(required=False, allow_blank=True, default="")
    brand = serializers.CharField(required=False, allow_blank=True, default="")
    commissionRate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=0,
    )
    costPrice = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0,
    )
    supplierId = serializers.IntegerField(required=False, allow_null=True)
    reorderPoint = serializers.IntegerField(required=False, default=5)
    reorderQuantity = serializers.IntegerField(required=False, default=10)
    isBundle = serializers.BooleanField(required=False, default=False)
    isPreorder = serializers.BooleanField(required=False, default=False)
    preorderEta = serializers.DateField(required=False, allow_null=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    seoTitle = serializers.CharField(
        required=False, allow_blank=True, default="",
    )
    seoDescription = serializers.CharField(
        required=False, allow_blank=True, default="",
    )
    status = serializers.ChoiceField(
        choices=["Draft", "Active", "Archived"], default="Draft",
    )

    STATUS_MAP = {
        "Draft": "DRAFT",
        "Active": "ACTIVE",
        "Archived": "PAUSED",
    }

    @transaction.atomic
    def create(self, validated):
        Product = apps.get_model("catalog", "Product")
        Brand = apps.get_model("catalog", "Brand")
        Category = apps.get_model("catalog", "Category")

        brand_obj = None
        if validated.get("brand"):
            brand_obj, _ = Brand.objects.get_or_create(
                name=validated["brand"],
            )

        category_obj = None
        if validated.get("category"):
            category_obj, _ = Category.objects.get_or_create(
                name=validated["category"],
            )

        product_kwargs = {
            "name": validated["name"],
            "price": validated["price"],
        }
        if validated.get("sku"):
            product_kwargs["sku"] = validated["sku"]
        if validated.get("compareAtPrice") is not None:
            product_kwargs["compare_at_price"] = validated["compareAtPrice"]
        if validated.get("stockQuantity") is not None:
            product_kwargs["stock_quantity"] = validated["stockQuantity"]
        if brand_obj is not None:
            product_kwargs["brand"] = brand_obj
        if category_obj is not None:
            product_kwargs["category"] = category_obj

        product = Product.objects.create(**product_kwargs)

        if validated.get("image"):
            try:
                ProductImage = apps.get_model("catalog", "ProductImage")
                ProductImage.objects.create(
                    product=product,
                    url=validated["image"],
                    is_primary=True,
                )
            except LookupError:
                if hasattr(product, "image"):
                    product.image = validated["image"]
                    product.save(update_fields=["image"])

        wrapper_kwargs = {
            "product": product,
            "status": self.STATUS_MAP[validated["status"]],
            "cost_price": validated.get("costPrice", 0),
            "reorder_point": validated.get("reorderPoint", 5),
            "reorder_quantity": validated.get("reorderQuantity", 10),
            "is_bundle": validated.get("isBundle", False),
            "is_preorder": validated.get("isPreorder", False),
            "preorder_eta": validated.get("preorderEta"),
            "commission_rate": validated.get("commissionRate", 0),
            "tags": validated.get("tags", []),
            "seo_title": validated.get("seoTitle", ""),
            "seo_description": validated.get("seoDescription", ""),
        }

        supplier_id = validated.get("supplierId")
        if supplier_id:
            try:
                wrapper_kwargs["supplier"] = Supplier.objects.get(pk=supplier_id)
            except Supplier.DoesNotExist:
                pass

        wrapper = DirectProduct.objects.create(**wrapper_kwargs)
        return wrapper


class DirectProductWriteSerializer(serializers.ModelSerializer):
    lowStockThreshold = serializers.IntegerField(
        source="low_stock_threshold", required=False,
    )
    videoLink = serializers.URLField(
        source="video_link", required=False, allow_blank=True,
    )
    linkedToWebsite = serializers.BooleanField(
        source="linked_to_website", required=False,
    )
    viral = serializers.BooleanField(required=False)
    costPrice = serializers.DecimalField(
        source="cost_price", max_digits=12, decimal_places=2,
        required=False,
    )
    supplierId = serializers.IntegerField(
        source="supplier_id", required=False, allow_null=True,
    )
    reorderPoint = serializers.IntegerField(
        source="reorder_point", required=False,
    )
    reorderQuantity = serializers.IntegerField(
        source="reorder_quantity", required=False,
    )
    isBundle = serializers.BooleanField(source="is_bundle", required=False)
    isPreorder = serializers.BooleanField(source="is_preorder", required=False)
    preorderEta = serializers.DateField(
        source="preorder_eta", required=False, allow_null=True,
    )
    commissionRate = serializers.DecimalField(
        source="commission_rate", max_digits=5, decimal_places=2,
        required=False,
    )

    class Meta:
        model = DirectProduct
        fields = (
            "status", "viral", "videoLink",
            "lowStockThreshold", "linkedToWebsite",
            "costPrice", "supplierId", "reorderPoint", "reorderQuantity",
            "isBundle", "isPreorder", "preorderEta", "commissionRate",
            "tags", "seo_title", "seo_description",
        )


class InboxMessageSerializer(serializers.ModelSerializer):
    attachmentUrl = serializers.CharField(
        source="attachment_url",
        required=False,
        allow_blank=True,
        default="",
    )
    sentBy = serializers.IntegerField(
        source="sent_by_id", read_only=True,
    )
    externalId = serializers.CharField(
        source="external_id",
        required=False,
        allow_blank=True,
        default="",
    )

    class Meta:
        model = InboxMessage
        fields = (
            "id", "direction", "body", "attachmentUrl",
            "sentBy", "externalId", "created_at",
        )
        read_only_fields = ("id", "sentBy", "created_at")


class InboxConversationSerializer(serializers.ModelSerializer):
    customerId = serializers.IntegerField(
        source="customer_id", required=False, allow_null=True,
    )
    contactName = serializers.CharField(
        source="contact_name", required=False, allow_blank=True, default="",
    )
    contactHandle = serializers.CharField(
        source="contact_handle", required=False, allow_blank=True, default="",
    )
    assignedTo = serializers.IntegerField(
        source="assigned_to_id", required=False, allow_null=True,
    )
    convertedOrder = serializers.IntegerField(
        source="converted_order_id", required=False, allow_null=True,
    )
    unreadCount = serializers.IntegerField(
        source="unread_count", required=False, default=0,
    )
    lastMessageAt = serializers.DateTimeField(
        source="last_message_at", read_only=True,
    )
    messages = InboxMessageSerializer(many=True, read_only=True)

    class Meta:
        model = InboxConversation
        fields = (
            "id", "channel", "status", "subject",
            "customerId", "contactName", "contactHandle",
            "assignedTo", "convertedOrder",
            "unreadCount", "lastMessageAt", "tags",
            "messages",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "lastMessageAt", "created_at", "updated_at")


class TeamMemberSerializer(serializers.ModelSerializer):
    lastActiveAt = serializers.DateTimeField(
        source="last_active_at", read_only=True,
    )
    joinedAt = serializers.DateTimeField(source="joined_at", read_only=True)
    invitedAt = serializers.DateTimeField(source="invited_at", read_only=True)
    locationId = serializers.IntegerField(
        source="location_id", required=False, allow_null=True,
    )
    userId = serializers.IntegerField(
        source="user_id", required=False, allow_null=True,
    )

    class Meta:
        model = TeamMember
        fields = (
            "id", "userId", "name", "email", "phone",
            "role", "status", "permissions", "locationId",
            "lastActiveAt", "invitedAt", "joinedAt",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "lastActiveAt", "invitedAt", "joinedAt",
            "created_at", "updated_at",
        )


class ReturnRequestSerializer(serializers.ModelSerializer):
    orderId = serializers.IntegerField(source="order_id")
    orderReference = serializers.CharField(
        source="order.reference", read_only=True,
    )
    reasonDetail = serializers.CharField(
        source="reason_detail",
        required=False,
        allow_blank=True,
        default="",
    )
    refundAmount = serializers.DecimalField(
        source="refund_amount",
        max_digits=12, decimal_places=2,
        required=False, default=0,
    )
    restockedAt = serializers.DateTimeField(
        source="restocked_at", read_only=True,
    )
    resolvedBy = serializers.IntegerField(
        source="resolved_by_id", read_only=True,
    )
    resolvedAt = serializers.DateTimeField(
        source="resolved_at", read_only=True,
    )

    class Meta:
        model = ReturnRequest
        fields = (
            "id", "reference", "orderId", "orderReference",
            "status", "reason", "reasonDetail",
            "refundAmount", "restock", "restockedAt",
            "resolvedBy", "resolvedAt",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "reference", "orderReference",
            "restockedAt", "resolvedBy", "resolvedAt",
            "created_at", "updated_at",
        )


class ExpenseSerializer(serializers.ModelSerializer):
    paidOn = serializers.DateField(source="paid_on", required=False)
    paymentMethod = serializers.CharField(
        source="payment_method",
        required=False,
        allow_blank=True,
        default="M-Pesa",
    )
    receiptUrl = serializers.CharField(
        source="receipt_url",
        required=False,
        allow_blank=True,
        default="",
    )
    recordedBy = serializers.IntegerField(
        source="recorded_by_id", read_only=True,
    )

    class Meta:
        model = Expense
        fields = (
            "id", "title", "category", "amount",
            "paidOn", "paymentMethod", "reference",
            "notes", "receiptUrl", "recordedBy",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "recordedBy", "created_at", "updated_at")


class AutomationSerializer(serializers.ModelSerializer):
    delayMinutes = serializers.IntegerField(
        source="delay_minutes", required=False, default=0,
    )
    runsCount = serializers.IntegerField(source="runs_count", read_only=True)
    lastRunAt = serializers.DateTimeField(source="last_run_at", read_only=True)

    class Meta:
        model = Automation
        fields = (
            "id", "name", "trigger", "action", "status",
            "channel", "template", "delayMinutes", "conditions",
            "runsCount", "lastRunAt",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "runsCount", "lastRunAt",
            "created_at", "updated_at",
        )


class NotificationSerializer(serializers.ModelSerializer):
    recipientId = serializers.IntegerField(
        source="recipient_id", read_only=True,
    )
    readAt = serializers.DateTimeField(source="read_at", read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id", "title", "body", "kind", "link",
            "recipientId", "readAt", "created_at",
        )
        read_only_fields = ("id", "recipientId", "readAt", "created_at")


class AuditLogSerializer(serializers.ModelSerializer):
    entityId = serializers.CharField(source="entity_id", read_only=True)
    actorId = serializers.IntegerField(source="actor_id", read_only=True)
    actorName = serializers.SerializerMethodField()
    ipAddress = serializers.CharField(source="ip_address", read_only=True)
    userAgent = serializers.CharField(source="user_agent", read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id", "action", "entity", "entityId", "summary", "diff",
            "actorId", "actorName", "ipAddress", "userAgent",
            "created_at",
        )
        read_only_fields = fields

    def get_actorName(self, obj):
        if not obj.actor_id:
            return ""
        try:
            return obj.actor.get_full_name() or obj.actor.get_username()
        except Exception:
            return ""


class ReviewSerializer(serializers.ModelSerializer):
    productId = serializers.IntegerField(
        source="product_id", required=False, allow_null=True,
    )
    orderId = serializers.IntegerField(
        source="order_id", required=False, allow_null=True,
    )
    customerId = serializers.IntegerField(
        source="customer_id", required=False, allow_null=True,
    )
    mediaUrl = serializers.CharField(
        source="media_url",
        required=False,
        allow_blank=True,
        default="",
    )
    isUgc = serializers.BooleanField(source="is_ugc", required=False, default=False)
    rightsGranted = serializers.BooleanField(
        source="rights_granted", required=False, default=False,
    )

    class Meta:
        model = Review
        fields = (
            "id", "productId", "orderId", "customerId",
            "rating", "title", "body", "mediaUrl",
            "status", "isUgc", "rightsGranted",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class DeliveryZoneSerializer(serializers.ModelSerializer):
    baseFee = serializers.DecimalField(
        source="base_fee", max_digits=12, decimal_places=2,
        required=False, default=0,
    )
    freeOver = serializers.DecimalField(
        source="free_over", max_digits=12, decimal_places=2,
        required=False, default=0,
    )
    etaDaysMin = serializers.IntegerField(
        source="eta_days_min", required=False, default=1,
    )
    etaDaysMax = serializers.IntegerField(
        source="eta_days_max", required=False, default=3,
    )
    isActive = serializers.BooleanField(
        source="is_active", required=False, default=True,
    )

    class Meta:
        model = DeliveryZone
        fields = (
            "id", "name", "zone", "counties",
            "baseFee", "freeOver",
            "etaDaysMin", "etaDaysMax", "isActive",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class CouponSerializer(serializers.ModelSerializer):
    percentOff = serializers.DecimalField(
        source="percent_off", max_digits=5, decimal_places=2,
        required=False, default=0,
    )
    amountOff = serializers.DecimalField(
        source="amount_off", max_digits=12, decimal_places=2,
        required=False, default=0,
    )
    minOrderValue = serializers.DecimalField(
        source="min_order_value", max_digits=12, decimal_places=2,
        required=False, default=0,
    )
    startsAt = serializers.DateTimeField(
        source="starts_at", required=False, allow_null=True,
    )
    endsAt = serializers.DateTimeField(
        source="ends_at", required=False, allow_null=True,
    )
    maxUses = serializers.IntegerField(
        source="max_uses", required=False, default=0,
    )
    isActive = serializers.BooleanField(
        source="is_active", required=False, default=True,
    )

    class Meta:
        model = Coupon
        fields = (
            "id", "code", "description",
            "percentOff", "amountOff", "minOrderValue",
            "startsAt", "endsAt",
            "maxUses", "uses", "isActive",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "uses", "created_at", "updated_at")