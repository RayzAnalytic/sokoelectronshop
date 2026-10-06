from django.db.models import Count, Q
from rest_framework import serializers

from catalog.models import Brand


# ─────────────────────────────────────────────────────────────────────────────
# Read — nested shape matching the admin frontend's `Brand` interface
# ─────────────────────────────────────────────────────────────────────────────
class BrandAdminReadSerializer(serializers.ModelSerializer):
    """
    Shape matches the frontend's `Brand` interface:
      { id, name, slug, logo, productsCount, status, description,
        websiteUrl, salesTotal, salesGrowth, customersCount, featured, seo }

    `productsCount` requires the queryset to be annotated with
    `product_count` (see the viewset's queryset).

    `salesTotal` / `salesGrowth` / `customersCount` are computed server-side
    once order aggregation is in place. For now they return 0 — the frontend
    renders them fine, and the values become real as soon as order data
    flows into the API.
    """
    productsCount = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    logo = serializers.SerializerMethodField()

    # camelCase aliases for the admin's interface
    websiteUrl = serializers.CharField(
        source="website_url", allow_blank=True, read_only=True,
    )
    salesTotal = serializers.SerializerMethodField()
    salesGrowth = serializers.SerializerMethodField()
    customersCount = serializers.SerializerMethodField()

    seo = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            "id", "name", "slug", "logo",
            "productsCount", "status", "description",
            "websiteUrl",
            "salesTotal", "salesGrowth", "customersCount",
            "featured", "seo",
            "is_active", "created_at", "updated_at",
        ]

    def get_logo(self, obj):
        if not obj.logo:
            return None
        request = self.context.get("request")
        url = obj.logo.url
        return request.build_absolute_uri(url) if request else url

    def get_productsCount(self, obj):
        return getattr(obj, "product_count", 0)

    def get_status(self, obj):
        return "Active" if obj.is_active else "Inactive"

    def get_salesTotal(self, obj):
        # TODO: aggregate from checkout.Order / OrderItem once available.
        return getattr(obj, "sales_total", 0)

    def get_salesGrowth(self, obj):
        # TODO: compute vs. previous 30-day window.
        return getattr(obj, "sales_growth", 0.0)

    def get_customersCount(self, obj):
        # TODO: count distinct users who ordered from this brand.
        return getattr(obj, "customers_count", 0)

    def get_seo(self, obj):
        return {
            "metaTitle": obj.meta_title or "",
            "metaDescription": obj.meta_description or "",
            "metaKeywords": obj.meta_keywords or "",
            "canonicalUrl": obj.canonical_url or "",
        }


# ─────────────────────────────────────────────────────────────────────────────
# Write — accepts the flat admin form fields + a nested `seo` object
# ─────────────────────────────────────────────────────────────────────────────
class BrandAdminWriteSerializer(serializers.ModelSerializer):
    """
    Accepts `websiteUrl` (camelCase) and `seo` (nested) from the admin form
    and unpacks them onto the model.
    """
    websiteUrl = serializers.CharField(
        required=False, allow_blank=True, write_only=True,
    )
    seo = serializers.DictField(
        required=False, write_only=True, allow_empty=True,
    )
    status = serializers.ChoiceField(
        choices=["Active", "Inactive"],
        required=False, write_only=True,
    )
    # Read-only on write — the model derives it from name.
    slug = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Brand
        fields = [
            "id", "name", "slug", "logo",
            "description", "websiteUrl",
            "featured", "is_active",
            "meta_title", "meta_description",
            "meta_keywords", "canonical_url",
            # Write-only conveniences
            "seo", "status",
        ]
        read_only_fields = ["id"]

    def _unpack(self, data):
        """Flatten `websiteUrl`, `seo`, and `status` onto model fields."""
        data = dict(data)

        # camelCase → snake_case
        if "websiteUrl" in data:
            data["website_url"] = data.pop("websiteUrl")

        # Nested SEO object → flat model fields
        seo = data.pop("seo", None) or {}
        if "metaTitle" in seo:
            data["meta_title"] = seo.get("metaTitle", "")
        if "metaDescription" in seo:
            data["meta_description"] = seo.get("metaDescription", "")
        if "metaKeywords" in seo:
            data["meta_keywords"] = seo.get("metaKeywords", "")
        if "canonicalUrl" in seo:
            data["canonical_url"] = seo.get("canonicalUrl", "")

        # Status → is_active
        status = data.pop("status", None)
        if status is not None:
            data["is_active"] = status == "Active"

        return data

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def create(self, validated_data):
        return Brand.objects.create(**self._unpack(validated_data))

    def update(self, instance, validated_data):
        for field, value in self._unpack(validated_data).items():
            setattr(instance, field, value)
        instance.save()
        return instance