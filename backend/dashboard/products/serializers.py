import base64
import binascii
import mimetypes
import re

from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import serializers

from catalog.models import (
    Brand,
    Category,
    Product,
    ProductFeature,
    ProductImage,
    ProductSpec,
)


_DATA_URL_RE = re.compile(
    r"^data:(?P<mime>[\w/+.\-]+);base64,(?P<data>.+)$",
    re.DOTALL,
)


def _data_url_to_file(value, name_hint="product"):
    if not isinstance(value, str):
        return None
    match = _DATA_URL_RE.match(value)
    if not match:
        return None
    try:
        raw = base64.b64decode(match.group("data"), validate=True)
    except (ValueError, binascii.Error):
        return None
    ext = mimetypes.guess_extension(match.group("mime")) or ".bin"
    if ext == ".jpe":
        ext = ".jpg"
    return ContentFile(raw, name=f"{name_hint}{ext}")


class AdminProductImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["id", "url", "alt_text", "is_primary", "sort_order"]

    def get_url(self, obj):
        if obj.external_url:
            return obj.external_url
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


class AdminProductFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductFeature
        fields = ["id", "text", "sort_order"]


class AdminProductSpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSpec
        fields = ["id", "key", "value", "sort_order"]


class AdminProductReadSerializer(serializers.ModelSerializer):
    brand = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    images = AdminProductImageSerializer(many=True, read_only=True)
    features = AdminProductFeatureSerializer(many=True, read_only=True)
    specs = AdminProductSpecSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "description",
            "brand", "category",
            "price", "compare_at_price",
            "stock_quantity", "low_stock_threshold",
            "featured", "best_seller",
            "sales_volume", "sales_count",
            "promo_end_date", "is_active",
            "rating_avg", "review_count",
            "images", "features", "specs",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_brand(self, obj):
        return {"id": obj.brand_id, "name": obj.brand.name}

    def get_category(self, obj):
        return {"id": obj.category_id, "name": obj.category.name}


class AdminProductWriteSerializer(serializers.ModelSerializer):
    brand_id = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(), source="brand", write_only=True,
    )
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source="category", write_only=True,
    )

    images = serializers.ListField(
        child=serializers.JSONField(),
        required=False,
        write_only=True,
    )
    features = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True,
    )
    specs = serializers.DictField(
        child=serializers.CharField(), required=False, write_only=True,
    )

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "description",
            "brand_id", "category_id",
            "price", "compare_at_price",
            "stock_quantity", "low_stock_threshold",
            "featured", "best_seller",
            "sales_volume", "sales_count",
            "promo_end_date", "is_active",
            "images", "features", "specs",
        ]
        read_only_fields = ["id", "slug", "sales_count"]

    def _normalise_image_row(self, row, index):
        if isinstance(row, str):
            return {
                "url": row,
                "alt_text": "",
                "is_primary": index == 0,
                "sort_order": index,
            }
        if isinstance(row, dict):
            return {
                "url": (
                    row.get("url")
                    or row.get("external_url")
                    or row.get("image")
                    or ""
                ),
                "alt_text": row.get("alt_text", ""),
                "is_primary": bool(row.get("is_primary", index == 0)),
                "sort_order": int(row.get("sort_order", index)),
            }
        return None

    def _sync_images(self, product, rows):
        product.images.all().delete()
        for i, raw in enumerate(rows or []):
            row = self._normalise_image_row(raw, i)
            if not row or not row["url"]:
                continue

            url = row["url"]
            img = ProductImage(
                product=product,
                alt_text=row["alt_text"],
                is_primary=row["is_primary"],
                sort_order=row["sort_order"],
            )

            if url.startswith("data:"):
                file = _data_url_to_file(
                    url, name_hint=f"product_{product.pk}_{i}"
                )
                if file is not None:
                    img.image.save(file.name, file, save=False)
                    img.save()
                continue

            img.external_url = url
            img.save()

    def _sync_features(self, product, texts):
        product.features.all().delete()
        for i, text in enumerate(texts or []):
            text = (text or "").strip()
            if text:
                ProductFeature.objects.create(
                    product=product, text=text, sort_order=i,
                )

    def _sync_specs(self, product, mapping):
        product.specs.all().delete()
        for i, (key, value) in enumerate((mapping or {}).items()):
            key = (key or "").strip()
            value = (value or "").strip()
            if key and value:
                ProductSpec.objects.create(
                    product=product, key=key, value=value, sort_order=i,
                )

    @transaction.atomic
    def create(self, validated_data):
        images = validated_data.pop("images", [])
        features = validated_data.pop("features", [])
        specs = validated_data.pop("specs", {})

        product = Product.objects.create(**validated_data)

        self._sync_images(product, images)
        self._sync_features(product, features)
        self._sync_specs(product, specs)
        return product

    @transaction.atomic
    def update(self, instance, validated_data):
        images = validated_data.pop("images", None)
        features = validated_data.pop("features", None)
        specs = validated_data.pop("specs", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if images is not None:
            self._sync_images(instance, images)
        if features is not None:
            self._sync_features(instance, features)
        if specs is not None:
            self._sync_specs(instance, specs)
        return instance