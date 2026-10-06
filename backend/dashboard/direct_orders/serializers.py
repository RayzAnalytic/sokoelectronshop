"""
Wire shapes for the Direct Orders admin surface.

Two audiences:

  * `DirectOrderSerializer` — reads `checkout.Order`. Its output keys
    match the frontend's `TikTokOrder` interface exactly. Renaming a
    key here requires a coordinated frontend change.

  * The other serializers — CRUD shapes for the app's own models
    (Creator, ContentPost, LiveSession, DirectProduct). Where the
    frontend uses title-case labels ("Video", "Scripted"), the
    serializer maps them to the model's enum keys transparently, so
    the frontend can send/receive the same vocabulary it already uses.
"""
from django.apps import apps
from django.db import transaction
from rest_framework import serializers

from checkout.models import Order, OrderItem
from .models import (
    Creator,
    ContentPost,
    DirectProduct,
    LiveSession,
)


# ═════════════════════════════════════════════════════════════════════
# Order — reads checkout.Order
# ═════════════════════════════════════════════════════════════════════

def _display_status(order: Order) -> str:
    """
    Map (Order.status, Order.payment_status) onto the frontend's
    granular display vocabulary.
    """
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


class DirectOrderItemSerializer(serializers.ModelSerializer):
    """One line of an order — matches the frontend's item shape."""

    productId = serializers.CharField(source="product_id", read_only=True)
    qty = serializers.IntegerField(source="quantity", read_only=True)
    price = serializers.DecimalField(
        source="unit_price", max_digits=12, decimal_places=2, read_only=True,
    )
    image = serializers.CharField(source="image_url", read_only=True)

    class Meta:
        model = OrderItem
        fields = ("productId", "name", "qty", "price", "image")


class DirectOrderSerializer(serializers.ModelSerializer):
    """
    Read shape for the admin orders table and drawer.
    """

    id = serializers.CharField(source="reference", read_only=True)
    reference = serializers.CharField(read_only=True)

    customerName = serializers.SerializerMethodField()
    customerPhone = serializers.CharField(source="contact_phone", read_only=True)
    customerTikTok = serializers.SerializerMethodField()

    source = serializers.SerializerMethodField()
    items = DirectOrderItemSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    status = serializers.SerializerMethodField()
    backendStatus = serializers.CharField(source="status", read_only=True)
    paymentStatus = serializers.CharField(source="payment_status", read_only=True)

    paymentMethod = serializers.SerializerMethodField()
    mpesaCode = serializers.SerializerMethodField()

    courier = serializers.CharField(read_only=True)
    trackingNumber = serializers.CharField(source="tracking_number", read_only=True)
    placedAt = serializers.SerializerMethodField()
    note = serializers.CharField(source="notes", read_only=True)

    channelMeta = serializers.JSONField(source="channel_meta", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id", "reference",
            "customerName", "customerPhone", "customerTikTok",
            "source", "items", "total",
            "status", "backendStatus", "paymentStatus",
            "paymentMethod", "mpesaCode",
            "courier", "trackingNumber",
            "placedAt", "note", "channelMeta",
        )

    def get_customerName(self, obj):
        return (
            (obj.snapshot or {}).get("full_name")
            or (obj.user.get_full_name() if obj.user else "")
            or obj.contact_email
            or "—"
        )

    def get_customerTikTok(self, obj):
        return (obj.channel_meta or {}).get("tiktok_handle", "")

    def get_source(self, obj):
        origin = (obj.channel_meta or {}).get("origin")
        if origin == "tiktok_video":
            return "Video"
        if origin == "tiktok_live":
            return "LIVE session"
        if origin == "tiktok_dm":
            return "DM"
        return "DM"

    def get_status(self, obj):
        return _display_status(obj)

    def get_paymentMethod(self, obj):
        return "M-Pesa" if obj.payment_method == "MPESA" else "Cash on Delivery"

    def get_mpesaCode(self, obj):
        p = obj.successful_payment
        return p.mpesa_receipt_number if p else ""

    def get_placedAt(self, obj):
        return obj.created_at.strftime("%b %d, %Y %H:%M")


# ═════════════════════════════════════════════════════════════════════
# Creator
# ═════════════════════════════════════════════════════════════════════

class CreatorSerializer(serializers.ModelSerializer):
    """
    Read + write. Derived analytics (`salesDriven`, `commissionOwed`,
    `commissionPaid`) are read-only — they come from `CreatorSale` rows.
    """

    commissionRate = serializers.DecimalField(
        source="commission_rate", max_digits=5, decimal_places=2,
    )
    startDate = serializers.DateField(
        source="start_date", required=False, allow_null=True,
    )

    # NEW: fields the Add Creator modal sends.
    avatar = serializers.URLField(
        source="avatar_url",
        required=False,
        allow_blank=True,
    )
    platform = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    salesDriven = serializers.IntegerField(source="sales_driven", read_only=True)
    commissionOwed = serializers.DecimalField(
        source="commission_owed", max_digits=12, decimal_places=2, read_only=True,
    )
    commissionPaid = serializers.DecimalField(
        source="commission_paid", max_digits=12, decimal_places=2, read_only=True,
    )

    class Meta:
        model = Creator
        fields = (
            "id", "name", "handle", "followers", "niche",
            "commissionRate", "startDate", "status",
            "avatar", "platform",
            "salesDriven", "commissionOwed", "commissionPaid",
            "notes", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "created_at", "updated_at",
            "salesDriven", "commissionOwed", "commissionPaid",
        )


# ═════════════════════════════════════════════════════════════════════
# ContentPost
# ═════════════════════════════════════════════════════════════════════

class ContentPostSerializer(serializers.ModelSerializer):
    """
    Read + write. The frontend sends and receives title-case labels
    ("Video", "Scripted", …); the serializer maps them to model enum
    keys internally.
    """

    STATUS_MAP = {
        "Draft": "IDEA",
        "Scheduled": "SCRIPTED",
        "Posted": "POSTED",
        "Archived": "POSTED",  # lossy until ARCHIVED is added to the model
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
    postedUrl = serializers.URLField(
        source="posted_url", required=False, allow_blank=True,
    )
    thumbnailUrl = serializers.URLField(
        source="thumbnail_url", required=False, allow_blank=True,
    )
    videoUrl = serializers.URLField(
        source="video_url", required=False, allow_blank=True,
    )
    caption = serializers.CharField(required=False, allow_blank=True)
    platform = serializers.CharField(required=False, allow_blank=True)

    products = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        default=list,
    )
    productName = serializers.SerializerMethodField()

    class Meta:
        model = ContentPost
        fields = (
            "id", "title", "type", "status",
            "platform", "scheduledAt",
            "script", "caption", "hashtags",
            "postedUrl", "thumbnailUrl", "videoUrl",
            "products", "productName",
            "views", "likes", "comments",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "productName")

    def get_type(self, obj):
        return self.TYPE_MAP_REVERSE.get(obj.content_type, obj.content_type)

    def get_status(self, obj):
        return self.STATUS_MAP_REVERSE.get(obj.status, obj.status)

    def get_productName(self, obj):
        if not obj.products:
            return ""
        first = obj.products[0]
        return first if isinstance(first, str) else str(first)

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

        return super().to_internal_value(data)


# ═════════════════════════════════════════════════════════════════════
# LiveSession
# ═════════════════════════════════════════════════════════════════════

class LiveSessionSerializer(serializers.ModelSerializer):
    """
    Read + write. Status vocabulary:
        Scheduled  ↔ SCHEDULED
        Live       ↔ LIVE
        Ended      ↔ COMPLETED
        Cancelled  ↔ CANCELLED
    """

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

    scheduledAt = serializers.DateTimeField(
        source="scheduled_start",
    )
    durationMin = serializers.IntegerField(
        source="duration_min", required=False,
    )
    hostName = serializers.CharField(
        source="host_name",
        required=False,
        allow_blank=True,
    )
    peakViewers = serializers.IntegerField(
        source="peak_viewers", required=False,
    )
    ordersGenerated = serializers.IntegerField(
        source="orders_generated", required=False,
    )
    topProduct = serializers.CharField(
        source="top_product", required=False, allow_blank=True,
    )

    class Meta:
        model = LiveSession
        fields = (
            "id", "title", "scheduledAt", "durationMin", "status",
            "hostName", "products",
            "peakViewers", "ordersGenerated", "revenue", "topProduct",
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


# ═════════════════════════════════════════════════════════════════════
# DirectProduct — read shape
# ═════════════════════════════════════════════════════════════════════

class DirectProductSerializer(serializers.ModelSerializer):
    """
    Read shape for a TikTok-promoted product. Catalog fields (name,
    sku, price, stock) are pulled through from `catalog.Product` and
    are read-only here — mutate them on the catalog product, not this
    wrapper.
    """

    name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    image = serializers.SerializerMethodField()
    price = serializers.DecimalField(
        source="product.price", max_digits=12, decimal_places=2, read_only=True,
    )
    compareAt = serializers.SerializerMethodField()
    stock = serializers.SerializerMethodField()
    commissionRate = serializers.SerializerMethodField()

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

    class Meta:
        model = DirectProduct
        fields = (
            "id", "name", "sku", "image", "price", "compareAt",
            "stock", "commissionRate",
            "lowStockThreshold", "status", "viral",
            "videoLink", "linkedToWebsite",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "name", "sku", "price", "stock", "commissionRate",
            "created_at", "updated_at",
        )

    def get_image(self, obj):
        p = obj.product
        for attr in ("image", "image_url", "thumbnail"):
            v = getattr(p, attr, None)
            if v:
                return str(v)
        # Fall back to first related image if the model uses an images M2M.
        images = getattr(p, "images", None)
        if images is not None:
            try:
                first = images.all().first()
                if first is not None:
                    for attr in ("url", "image_url", "image"):
                        v = getattr(first, attr, None)
                        if v:
                            return str(v)
            except Exception:
                pass
        return ""

    def get_compareAt(self, obj):
        for attr in ("compare_at_price", "compare_at"):
            v = getattr(obj.product, attr, None)
            if v is not None:
                return str(v)
        return None

    def get_stock(self, obj):
        return getattr(obj.product, "stock_quantity", 0)

    def get_commissionRate(self, obj):
        for attr in ("commission_rate", "commissionRate"):
            v = getattr(obj, attr, None)
            if v is not None:
                return str(v)
        return ""


# ═════════════════════════════════════════════════════════════════════
# DirectProduct — write shape (fans a flat payload into catalog + wrapper)
# ═════════════════════════════════════════════════════════════════════

class ProductCreateSerializer(serializers.Serializer):
    """
    Accepts the flat AddProductModal payload and creates a
    `catalog.Product` AND its `DirectProduct` wrapper in one transaction.

    The frontend sends:
        { name, sku, image, price, compareAtPrice, stockQuantity,
          category, brand, commissionRate, status }

    Which maps onto:
        catalog.Product   ← name, sku, price, compare_at_price,
                             stock_quantity, brand FK, category FK
        catalog.ProductImage (optional)
                          ← image URL
        DirectProduct     ← status (translated), product FK

    ─── IMPORTANT ───────────────────────────────────────────────────
    The `create()` body assumes:
      • app label is "catalog"
      • models are named Product, Brand, Category, ProductImage
      • Product has fields: name, sku, price, compare_at_price,
        stock_quantity, brand (FK), category (FK)
      • ProductImage has: product (FK), url, is_primary

    If your actual model uses different field names (e.g. `image`
    instead of `url`, or `image_url` instead of `images` M2M), edit
    the create() body. This is the ONLY place that touches the
    catalog app.
    ─────────────────────────────────────────────────────────────────
    """

    name = serializers.CharField(max_length=255)
    sku = serializers.CharField(required=False, allow_blank=True, default="")
    image = serializers.URLField(required=False, allow_blank=True, default="")
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
        # Resolve catalog models at runtime so a rename in the catalog
        # app does not require an import change here.
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

        # Attach the image if the catalog has a related image model.
        if validated.get("image"):
            try:
                ProductImage = apps.get_model("catalog", "ProductImage")
                ProductImage.objects.create(
                    product=product,
                    url=validated["image"],
                    is_primary=True,
                )
            except LookupError:
                # No ProductImage model — try a direct `image` field
                # on Product. If neither exists, silently skip; the
                # product is still created.
                if hasattr(product, "image"):
                    product.image = validated["image"]
                    product.save(update_fields=["image"])

        wrapper = DirectProduct.objects.create(
            product=product,
            status=self.STATUS_MAP[validated["status"]],
        )
        return wrapper