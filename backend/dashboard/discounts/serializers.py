from __future__ import annotations

from rest_framework import serializers

from catalog.models import (
    Category,
    Discount,
    DiscountSource,
    DiscountType,
    AppliesTo,
    Product,
)

from . import services


TYPE_MAP = {
    "Percentage":       DiscountType.PERCENTAGE,
    "Fixed Amount":     DiscountType.FIXED_AMOUNT,
    "Free Shipping":    DiscountType.FREE_SHIPPING,
    "BOGO":             DiscountType.BUY_X_GET_Y,
    "Bundle":           DiscountType.BUY_X_GET_Y,
    "Tiered":           DiscountType.PERCENTAGE,
    "Buy X Get Y":      DiscountType.BUY_X_GET_Y,
}

TYPE_MAP_REVERSE = {
    DiscountType.PERCENTAGE:    "Percentage",
    DiscountType.FIXED_AMOUNT:  "Fixed Amount",
    DiscountType.FREE_SHIPPING: "Free Shipping",
    DiscountType.BUY_X_GET_Y:   "BOGO",
}

APPLIES_TO_MAP = {
    "Entire Order":         AppliesTo.ALL_PRODUCTS,
    "All Products":         AppliesTo.ALL_PRODUCTS,
    "Specific Products":    AppliesTo.SPECIFIC_PRODUCTS,
    "Specific Categories":  AppliesTo.SPECIFIC_CATEGORIES,
}

APPLIES_TO_MAP_REVERSE = {
    AppliesTo.ALL_PRODUCTS:         "Entire Order",
    AppliesTo.SPECIFIC_PRODUCTS:    "Specific Products",
    AppliesTo.SPECIFIC_CATEGORIES:  "Specific Categories",
}

STATUS_TO_OVERRIDE = {
    "Active":    "",
    "Draft":     "Draft",
    "Paused":    "Paused",
    "Scheduled": "",
    "Expired":   "",
}


class DiscountReadSerializer(serializers.ModelSerializer):
    dealTitle = serializers.CharField(source="deal_title", allow_blank=True)
    badgeText = serializers.CharField(source="badge_text", allow_blank=True)
    displayOnDealsPage = serializers.BooleanField(source="display_on_deals_page")
    isMostDeal = serializers.BooleanField(source="is_most_deal")

    type = serializers.SerializerMethodField()
    promotionType = serializers.CharField(source="promotion_type")
    minOrder = serializers.DecimalField(
        source="min_order", max_digits=12, decimal_places=2,
    )
    maxCap = serializers.DecimalField(
        source="max_cap", max_digits=12, decimal_places=2,
    )

    usageLimit = serializers.IntegerField(source="usage_limit")
    perCustomer = serializers.IntegerField(source="per_customer")
    usageCount = serializers.IntegerField(source="usage_count")

    startDate = serializers.DateTimeField(source="start_date")
    endDate = serializers.DateTimeField(source="end_date", allow_null=True)

    appliesTo = serializers.SerializerMethodField()
    targetAudience = serializers.CharField(
        source="target_audience", allow_blank=True,
    )

    status = serializers.SerializerMethodField()

    source = serializers.CharField()
    isAutomatic = serializers.BooleanField(source="is_automatic")
    isClearance = serializers.BooleanField(source="is_clearance")
    expiresWhenSoldOut = serializers.BooleanField(source="expires_when_sold_out")

    tiktokVideo = serializers.CharField(source="tiktok_video", allow_blank=True)

    linkedCategories = serializers.SerializerMethodField()
    linkedProductIds = serializers.SerializerMethodField()

    class Meta:
        model = Discount
        fields = [
            "id", "code", "description", "type", "value",
            "minOrder", "maxCap",
            "usageLimit", "perCustomer", "usageCount",
            "startDate", "endDate",
            "status", "appliesTo", "eligibility", "targetAudience",
            "source", "isAutomatic", "isClearance", "expiresWhenSoldOut",
            "isMostDeal", "image", "displayOnDealsPage",
            "promotionType", "dealTitle", "badgeText", "priority",
            "channels", "tiktokVideo",
            "linkedCategories", "linkedProductIds",
        ]

    def get_type(self, obj):
        return TYPE_MAP_REVERSE.get(obj.type, obj.type)

    def get_appliesTo(self, obj):
        return APPLIES_TO_MAP_REVERSE.get(obj.applies_to, obj.applies_to)

    def get_status(self, obj):
        return obj.status

    def get_linkedCategories(self, obj):
        return [c.name for c in obj.linked_categories.all()]

    def get_linkedProductIds(self, obj):
        return [p.id for p in obj.linked_products.all()]


class DiscountListSerializer(serializers.ModelSerializer):
    dealTitle = serializers.CharField(source="deal_title", allow_blank=True)
    usageCount = serializers.IntegerField(source="usage_count")
    status = serializers.SerializerMethodField()

    class Meta:
        model = Discount
        fields = [
            "id", "code", "dealTitle", "description",
            "type", "value", "usageCount", "status",
            "priority", "is_clearance",
            "image",
        ]

    def get_status(self, obj):
        return obj.status


class DiscountWriteSerializer(serializers.ModelSerializer):
    dealTitle = serializers.CharField(
        source="deal_title", required=False, allow_blank=True,
    )
    badgeText = serializers.CharField(
        source="badge_text", required=False, allow_blank=True,
    )
    displayOnDealsPage = serializers.BooleanField(
        source="display_on_deals_page", required=False,
    )
    isMostDeal = serializers.BooleanField(
        source="is_most_deal", required=False,
    )

    type = serializers.CharField(required=True)
    promotionType = serializers.CharField(
        source="promotion_type", required=False, allow_blank=True,
    )
    minOrder = serializers.DecimalField(
        source="min_order", max_digits=12, decimal_places=2, required=False,
    )
    maxCap = serializers.DecimalField(
        source="max_cap", max_digits=12, decimal_places=2, required=False,
    )

    usageLimit = serializers.IntegerField(
        source="usage_limit", required=False, min_value=0,
    )
    perCustomer = serializers.IntegerField(
        source="per_customer", required=False, min_value=0,
    )

    startDate = serializers.DateTimeField(source="start_date", required=False)
    endDate = serializers.DateTimeField(
        source="end_date", required=False, allow_null=True,
    )

    appliesTo = serializers.CharField(required=True, write_only=True)
    targetAudience = serializers.CharField(
        source="target_audience", required=False, allow_blank=True,
    )

    status = serializers.CharField(required=False, write_only=True)

    isAutomatic = serializers.BooleanField(
        source="is_automatic", required=False,
    )
    isClearance = serializers.BooleanField(
        source="is_clearance", required=False,
    )
    expiresWhenSoldOut = serializers.BooleanField(
        source="expires_when_sold_out", required=False,
    )

    tiktokVideo = serializers.CharField(
        source="tiktok_video", required=False, allow_blank=True,
    )

    linkedCategories = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True,
    )
    linkedProductIds = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True,
    )

    class Meta:
        model = Discount
        fields = [
            "code", "description", "type", "value",
            "minOrder", "maxCap",
            "usageLimit", "perCustomer",
            "startDate", "endDate",
            "appliesTo", "eligibility", "targetAudience",
            "isAutomatic", "isClearance", "expiresWhenSoldOut",
            "isMostDeal", "image", "displayOnDealsPage",
            "promotionType", "dealTitle", "badgeText", "priority",
            "channels", "tiktokVideo",
            "linkedCategories", "linkedProductIds",
            "status",
        ]

    def validate_type(self, value):
        if value not in TYPE_MAP:
            raise serializers.ValidationError(
                f"Unknown discount type '{value}'. "
                f"Allowed: {sorted(set(TYPE_MAP.keys()))}"
            )
        return value

    def validate_appliesTo(self, value):
        if value not in APPLIES_TO_MAP:
            raise serializers.ValidationError(
                f"Unknown appliesTo '{value}'. "
                f"Allowed: {sorted(APPLIES_TO_MAP.keys())}"
            )
        return value

    def validate_status(self, value):
        if value and value not in STATUS_TO_OVERRIDE:
            raise serializers.ValidationError(
                f"Unknown status '{value}'. "
                f"Allowed: {sorted(STATUS_TO_OVERRIDE.keys())}"
            )
        return value

    def validate_code(self, value):
        qs = Discount.objects.filter(code=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f"A discount with code '{value}' already exists."
            )
        return value

    def validate(self, attrs):
        is_automatic = attrs.get(
            "is_automatic",
            getattr(self.instance, "is_automatic", False),
        )
        if (
            is_automatic
            and not attrs.get("code")
            and not getattr(self.instance, "code", None)
        ):
            import uuid
            attrs["code"] = f"AUTO-{uuid.uuid4().hex[:8].upper()}"
        return attrs

    def create(self, validated_data):
        category_names = validated_data.pop("linkedCategories", [])
        product_ids    = validated_data.pop("linkedProductIds", [])
        status_value   = validated_data.pop("status", None)

        validated_data["type"] = TYPE_MAP[validated_data["type"]]
        validated_data["applies_to"] = APPLIES_TO_MAP[
            validated_data.pop("appliesTo")
        ]

        if status_value:
            validated_data["status_override"] = STATUS_TO_OVERRIDE[status_value]

        validated_data.setdefault("source", DiscountSource.MANUAL)

        if validated_data.get("end_date") == "":
            validated_data["end_date"] = None

        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data.setdefault("created_by", request.user)

        discount = Discount.objects.create(**validated_data)
        discount.linked_categories.set(
            services.resolve_categories(category_names)
        )
        discount.linked_products.set(
            services.resolve_products(product_ids)
        )
        return discount

    def update(self, instance, validated_data):
        category_names = validated_data.pop("linkedCategories", None)
        product_ids    = validated_data.pop("linkedProductIds", None)
        status_value   = validated_data.pop("status", None)

        if "type" in validated_data:
            validated_data["type"] = TYPE_MAP[validated_data["type"]]

        if "appliesTo" in validated_data:
            validated_data["applies_to"] = APPLIES_TO_MAP[
                validated_data.pop("appliesTo")
            ]

        if status_value is not None:
            validated_data["status_override"] = STATUS_TO_OVERRIDE[status_value]

        if validated_data.get("end_date") == "":
            validated_data["end_date"] = None

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if category_names is not None:
            instance.linked_categories.set(
                services.resolve_categories(category_names)
            )
        if product_ids is not None:
            instance.linked_products.set(
                services.resolve_products(product_ids)
            )

        return instance


class SlowMovingProductSerializer(serializers.ModelSerializer):
    brand = serializers.CharField(source="brand.name", read_only=True)
    category = serializers.CharField(source="category.name", read_only=True)
    daysSinceListed = serializers.IntegerField(source="days_since_listed")
    stockValue = serializers.SerializerMethodField()
    suggestedDiscountPct = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "brand", "category",
            "price", "stock_quantity",
            "sales_count", "daysSinceListed",
            "stockValue", "suggestedDiscountPct",
        ]

    def get_stockValue(self, obj):
        return str(obj.price * obj.stock_quantity)

    def get_suggestedDiscountPct(self, obj):
        days = obj.days_since_listed
        if days >= 180:
            return 30
        if days >= 120:
            return 20
        return 15


class AnalyticsSerializer(serializers.Serializer):
    kpis = serializers.DictField()
    redemptions_over_time = serializers.ListField(child=serializers.DictField())
    revenue_by_discount = serializers.ListField(child=serializers.DictField())
    type_breakdown = serializers.ListField(child=serializers.DictField())
    channel_breakdown = serializers.ListField(child=serializers.DictField())
    top_discounts = serializers.ListField(child=serializers.DictField())


class RulesSerializer(serializers.Serializer):
    conditions = serializers.ListField(child=serializers.DictField())
    actions = serializers.ListField(child=serializers.DictField())