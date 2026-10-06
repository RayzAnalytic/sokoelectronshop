# dashboard/discounts/serializers.py

"""
All serializers for the dashboard discounts API.

Enum normalization
------------------
The React form uses different string values than the Django model for
some fields. The mappings below are the ONLY place those translations
happen. If either side changes, update the map.

React value            Django value
------------           ----------------
type: 'Percentage'  →  'Percentage'
type: 'Fixed Amount'→  'Fixed Amount'
type: 'Free Shipping'→ 'Free Shipping'
type: 'BOGO'        →  'Buy X Get Y'
type: 'Bundle'      →  'Buy X Get Y'
type: 'Tiered'      →  'Percentage'

appliesTo: 'Entire Order'         → 'All Products'
appliesTo: 'Specific Products'    → 'Specific Products'
appliesTo: 'Specific Categories'  → 'Specific Categories'
appliesTo: 'Exclude Products'     → (not supported, rejected in validate)

status: 'Active'  → status_override=''         (dates decide)
status: 'Draft'   → status_override='Draft'
status: 'Paused'  → status_override='Paused'

Camel-case contract
-------------------
The frontend `Discount` TS interface uses camelCase (`dealTitle`,
`targetAudience`, etc.). Every camelCase serializer field carries an
explicit `source=` pointing at the snake_case model column.

Virtual fields
--------------
`appliesTo`, `status`, `linkedCategories`, and `linkedProductIds` have
no matching model attribute. They are declared `write_only=True` so DRF
never tries to read them off a model instance during response
serialization.
"""

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


# ═════════════════════════════════════════════════════════════════════════════
# Enum maps
# ═════════════════════════════════════════════════════════════════════════════
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


# ═════════════════════════════════════════════════════════════════════════════
# Read serializers
# ═════════════════════════════════════════════════════════════════════════════
class DiscountReadSerializer(serializers.ModelSerializer):
    """
    Full wire shape the React admin table + edit modal consume.

    Every camelCase field has an explicit `source=` pointing at the
    matching snake_case model column.
    """
    # ── Identity ─────────────────────────────────────────────────────
    dealTitle = serializers.CharField(source="deal_title", allow_blank=True)
    badgeText = serializers.CharField(source="badge_text", allow_blank=True)
    displayOnDealsPage = serializers.BooleanField(source="display_on_deals_page")
    isMostDeal = serializers.BooleanField(source="is_most_deal")

    # ── Mechanics ────────────────────────────────────────────────────
    type = serializers.SerializerMethodField()
    promotionType = serializers.CharField(source="promotion_type")
    minOrder = serializers.DecimalField(
        source="min_order", max_digits=12, decimal_places=2,
    )
    maxCap = serializers.DecimalField(
        source="max_cap", max_digits=12, decimal_places=2,
    )

    # ── Limits ───────────────────────────────────────────────────────
    usageLimit = serializers.IntegerField(source="usage_limit")
    perCustomer = serializers.IntegerField(source="per_customer")
    usageCount = serializers.IntegerField(source="usage_count")

    # ── Window ───────────────────────────────────────────────────────
    startDate = serializers.DateTimeField(source="start_date")
    endDate = serializers.DateTimeField(source="end_date", allow_null=True)

    # ── Targeting ────────────────────────────────────────────────────
    appliesTo = serializers.SerializerMethodField()
    targetAudience = serializers.CharField(
        source="target_audience", allow_blank=True,
    )

    # ── Status ───────────────────────────────────────────────────────
    status = serializers.SerializerMethodField()

    # ── Slow-stock ───────────────────────────────────────────────────
    source = serializers.CharField()
    isAutomatic = serializers.BooleanField(source="is_automatic")
    isClearance = serializers.BooleanField(source="is_clearance")
    expiresWhenSoldOut = serializers.BooleanField(source="expires_when_sold_out")

    # ── Social / channels ────────────────────────────────────────────
    tiktokVideo = serializers.CharField(source="tiktok_video", allow_blank=True)

    # ── M2M — exposed as names for the frontend ─────────────────────
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
    """
    Lightweight shape for the Overview tab.

    Includes `image` so the compact row can render a thumbnail — the
    frontend table shows an 8×8 preview next to every discount title.
    Omits the heavier fields (`channels`, `tiktokVideo`, `startDate`,
    `endDate`, `linkedCategories`, `linkedProductIds`) that only the
    edit modal needs — the modal fetches `detail` instead.
    """
    dealTitle = serializers.CharField(source="deal_title", allow_blank=True)
    usageCount = serializers.IntegerField(source="usage_count")
    status = serializers.SerializerMethodField()

    class Meta:
        model = Discount
        fields = [
            "id", "code", "dealTitle", "description",
            "type", "value", "usageCount", "status",
            "priority", "is_clearance",
            "image",                        # ← added — makes the
                                            #   thumbnail render
        ]

    def get_status(self, obj):
        return obj.status


# ═════════════════════════════════════════════════════════════════════════════
# Write serializer
# ═════════════════════════════════════════════════════════════════════════════
class DiscountWriteSerializer(serializers.ModelSerializer):
    """
    Accepts the React `DiscountModal` payload.

    Every camelCase field has an explicit `source=` pointing at the
    matching snake_case model column. Virtual fields (`appliesTo`,
    `status`, `linkedCategories`, `linkedProductIds`) are
    `write_only=True` so DRF never tries to read them back off the
    model instance during response serialization.
    """
    # ── Identity ─────────────────────────────────────────────────────
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

    # ── Mechanics ────────────────────────────────────────────────────
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

    # ── Limits ───────────────────────────────────────────────────────
    usageLimit = serializers.IntegerField(
        source="usage_limit", required=False, min_value=0,
    )
    perCustomer = serializers.IntegerField(
        source="per_customer", required=False, min_value=0,
    )

    # ── Window ───────────────────────────────────────────────────────
    startDate = serializers.DateTimeField(source="start_date", required=False)
    endDate = serializers.DateTimeField(
        source="end_date", required=False, allow_null=True,
    )

    # ── Targeting ────────────────────────────────────────────────────
    # `appliesTo` is VIRTUAL — no matching model field. Must be
    # `write_only` so DRF doesn't try to read it off the instance.
    appliesTo = serializers.CharField(required=True, write_only=True)
    targetAudience = serializers.CharField(
        source="target_audience", required=False, allow_blank=True,
    )

    # ── Status ───────────────────────────────────────────────────────
    # Virtual — maps to `status_override` in `create`/`update`.
    status = serializers.CharField(required=False, write_only=True)

    # ── Slow-stock ───────────────────────────────────────────────────
    isAutomatic = serializers.BooleanField(
        source="is_automatic", required=False,
    )
    isClearance = serializers.BooleanField(
        source="is_clearance", required=False,
    )
    expiresWhenSoldOut = serializers.BooleanField(
        source="expires_when_sold_out", required=False,
    )

    # ── Social ───────────────────────────────────────────────────────
    tiktokVideo = serializers.CharField(
        source="tiktok_video", required=False, allow_blank=True,
    )

    # ── M2M — virtual, resolved in create/update ────────────────────
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

    # ── Field-level validation ────────────────────────────────────────
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

    # ── Create / update ───────────────────────────────────────────────
    def create(self, validated_data):
        category_names = validated_data.pop("linkedCategories", [])
        product_ids    = validated_data.pop("linkedProductIds", [])
        status_value   = validated_data.pop("status", None)

        # Enum normalization — `pop` so the virtual key doesn't leak
        # into `Discount.objects.create(**validated_data)`.
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


# ═════════════════════════════════════════════════════════════════════════════
# Slow-stock serializer
# ═════════════════════════════════════════════════════════════════════════════
class SlowMovingProductSerializer(serializers.ModelSerializer):
    """
    One row in the "Clear Slow Stock" wizard.
    """
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


# ═════════════════════════════════════════════════════════════════════════════
# Analytics + Rules (pass-through)
# ═════════════════════════════════════════════════════════════════════════════
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