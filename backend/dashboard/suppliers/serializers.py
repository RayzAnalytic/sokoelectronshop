from rest_framework import serializers

from .models import Purchase, Supplier, SupplierActivity, SupplierProduct


class SupplierProductSerializer(serializers.ModelSerializer):
    productId = serializers.CharField(source="product_id")
    name = serializers.CharField(source="product_name")
    sku = serializers.CharField(source="product_sku", allow_blank=True)
    image = serializers.CharField(source="product_image", allow_blank=True)
    category = serializers.CharField(source="product_category", allow_blank=True)

    supplierSku = serializers.CharField(source="supplier_sku", allow_blank=True)
    costPrice = serializers.FloatField(source="cost_price")
    minOrderQty = serializers.IntegerField(source="min_order_qty")
    leadTimeDays = serializers.IntegerField(source="lead_time_days")

    lastPurchasePrice = serializers.FloatField(source="last_purchase_price")
    lastPurchaseDate = serializers.DateField(
        source="last_purchase_date", allow_null=True,
    )

    currentStock = serializers.SerializerMethodField()

    class Meta:
        model = SupplierProduct
        fields = (
            "id", "productId",
            "name", "sku", "image", "category",
            "currentStock",
            "supplierSku", "costPrice", "minOrderQty", "leadTimeDays",
            "lastPurchasePrice", "lastPurchaseDate",
        )

    def get_currentStock(self, obj) -> int:
        if not obj.product_id:
            return 0

        stock_map = self.context.get("product_stock_map")
        if stock_map is not None:
            return stock_map.get(obj.product_id, 0)

        from catalog.models import Product
        return (
            Product.objects
            .filter(pk=obj.product_id)
            .values_list("stock_quantity", flat=True)
            .first()
            or 0
        )


class PurchaseSerializer(serializers.ModelSerializer):
    itemsCount = serializers.IntegerField(source="items_count")
    totalQty = serializers.IntegerField(source="total_qty")
    totalAmount = serializers.FloatField(source="total_amount")
    paymentStatus = serializers.CharField(source="payment_status")

    class Meta:
        model = Purchase
        fields = (
            "id", "number", "date",
            "itemsCount", "totalQty", "totalAmount",
            "paymentStatus", "status",
        )


class SupplierActivitySerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="kind")
    user = serializers.CharField(source="user_label", allow_blank=True)
    date = serializers.DateTimeField(source="created_at")

    class Meta:
        model = SupplierActivity
        fields = ("id", "type", "description", "user", "date")


class SupplierReadSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="contact_name")
    taxPin = serializers.CharField(source="tax_pin", allow_blank=True)
    regNumber = serializers.CharField(source="reg_number", allow_blank=True)
    paymentTerms = serializers.CharField(source="payment_terms", allow_blank=True)
    paymentMethod = serializers.CharField(source="payment_method", allow_blank=True)
    createdAt = serializers.DateTimeField(source="created_at")

    products = SupplierProductSerializer(
        source="supplier_products", many=True, read_only=True,
    )
    purchases = PurchaseSerializer(many=True, read_only=True)
    activity = SupplierActivitySerializer(many=True, read_only=True)

    class Meta:
        model = Supplier
        fields = (
            "id",
            "name", "company", "type",
            "phone", "email", "website",
            "country", "county", "city", "address",
            "taxPin", "regNumber", "paymentTerms", "paymentMethod",
            "notes", "status", "createdAt",
            "products", "purchases", "activity",
        )


class SupplierWriteSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="contact_name", max_length=150)
    taxPin = serializers.CharField(
        source="tax_pin", required=False, allow_blank=True,
    )
    regNumber = serializers.CharField(
        source="reg_number", required=False, allow_blank=True,
    )
    paymentTerms = serializers.CharField(
        source="payment_terms", required=False, allow_blank=True,
    )
    paymentMethod = serializers.CharField(
        source="payment_method", required=False, allow_blank=True,
    )

    class Meta:
        model = Supplier
        fields = (
            "name", "company", "type",
            "phone", "email", "website",
            "country", "county", "city", "address",
            "taxPin", "regNumber", "paymentTerms", "paymentMethod",
            "notes", "status",
        )

    def validate(self, attrs):
        phone = (attrs.get("phone") or "").strip()
        email = (attrs.get("email") or "").strip()
        if not phone and not email:
            raise serializers.ValidationError(
                "Provide at least one contact method (phone or email)."
            )
        return attrs

    def validate_email(self, value):
        return (value or "").strip().lower()


class SupplierProductInputSerializer(serializers.Serializer):
    productId = serializers.CharField(max_length=64)
    name = serializers.CharField(max_length=255)
    sku = serializers.CharField(max_length=80, required=False, allow_blank=True)
    image = serializers.CharField(
        max_length=500, required=False, allow_blank=True,
    )
    category = serializers.CharField(
        max_length=120, required=False, allow_blank=True,
    )
    supplierSku = serializers.CharField(
        max_length=80, required=False, allow_blank=True,
    )
    costPrice = serializers.FloatField(required=False, default=0)
    minOrderQty = serializers.IntegerField(required=False, default=1)
    leadTimeDays = serializers.IntegerField(required=False, default=14)
    lastPurchasePrice = serializers.FloatField(required=False, default=0)
    lastPurchaseDate = serializers.DateField(required=False, allow_null=True)

    def to_model_kwargs(self) -> dict:
        d = self.validated_data
        return {
            "product_id": d["productId"],
            "product_name": d["name"],
            "product_sku": d.get("sku") or "",
            "product_image": d.get("image") or "",
            "product_category": d.get("category") or "",
            "supplier_sku": d.get("supplierSku") or "",
            "cost_price": d.get("costPrice") or 0,
            "min_order_qty": d.get("minOrderQty") or 1,
            "lead_time_days": d.get("leadTimeDays") or 14,
            "last_purchase_price": d.get("lastPurchasePrice") or 0,
            "last_purchase_date": d.get("lastPurchaseDate"),
        }


class PurchaseInputSerializer(serializers.Serializer):
    number = serializers.CharField(max_length=40)
    date = serializers.DateField()
    itemsCount = serializers.IntegerField(required=False, default=0)
    totalQty = serializers.IntegerField(required=False, default=0)
    totalAmount = serializers.FloatField(required=False, default=0)
    paymentStatus = serializers.ChoiceField(
        choices=Purchase.PaymentStatus.choices,
        required=False,
        default=Purchase.PaymentStatus.UNPAID,
    )
    status = serializers.ChoiceField(
        choices=Purchase.Status.choices,
        required=False,
        default=Purchase.Status.PENDING,
    )

    def to_model_kwargs(self) -> dict:
        d = self.validated_data
        return {
            "number": d["number"],
            "date": d["date"],
            "items_count": d.get("itemsCount") or 0,
            "total_qty": d.get("totalQty") or 0,
            "total_amount": d.get("totalAmount") or 0,
            "payment_status": d.get("paymentStatus"),
            "status": d.get("status"),
        }