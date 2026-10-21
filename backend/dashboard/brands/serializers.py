from __future__ import annotations

import base64
import binascii
import mimetypes
import re
from typing import Optional

from django.core.files.base import ContentFile
from django.utils.text import slugify as django_slugify
from rest_framework import serializers

from catalog.models import Brand


_DATA_URL_RE = re.compile(
    r"^data:(?P<mime>[\w/+.\-]+);base64,(?P<data>.+)$",
    re.DOTALL,
)


def _slugify(value: str) -> str:
    return django_slugify(value or "").strip("-")


def _absolute_logo(request, field_file) -> Optional[str]:
    if not field_file:
        return None
    try:
        url = field_file.url
    except (ValueError, AttributeError):
        return None
    if not url:
        return None
    return request.build_absolute_uri(url) if request else url


def _data_url_to_file(value: str, name_hint: str = "brand") -> Optional[ContentFile]:
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


class BrandAdminReadSerializer(serializers.ModelSerializer):
    productsCount = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    logo = serializers.SerializerMethodField()
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
        read_only_fields = fields

    def get_logo(self, obj) -> Optional[str]:
        return _absolute_logo(self.context.get("request"), obj.logo)

    def get_productsCount(self, obj) -> int:
        annotated = getattr(obj, "product_count", None)
        if annotated is not None:
            return int(annotated)
        try:
            return obj.products.count()
        except Exception:
            return 0

    def get_status(self, obj) -> str:
        return "Active" if obj.is_active else "Inactive"

    def get_salesTotal(self, obj) -> float:
        return float(getattr(obj, "sales_total", 0) or 0)

    def get_salesGrowth(self, obj) -> float:
        current = float(getattr(obj, "_sales_last_30", 0) or 0)
        previous = float(getattr(obj, "_sales_prev_30", 0) or 0)
        if previous <= 0:
            return 0.0
        return round(((current - previous) / previous) * 100, 1)

    def get_customersCount(self, obj) -> int:
        return int(getattr(obj, "customers_count", 0) or 0)

    def get_seo(self, obj) -> dict:
        return {
            "metaTitle": obj.meta_title or "",
            "metaDescription": obj.meta_description or "",
            "metaKeywords": obj.meta_keywords or "",
            "canonicalUrl": obj.canonical_url or "",
        }


class BrandAdminWriteSerializer(serializers.ModelSerializer):
    websiteUrl = serializers.CharField(
        required=False, allow_blank=True, write_only=True,
    )
    seo = serializers.DictField(
        required=False, write_only=True, allow_empty=True,
    )
    status = serializers.ChoiceField(
        choices=["Active", "Inactive"],
        required=False,
        write_only=True,
    )
    slug = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=140,
    )

    class Meta:
        model = Brand
        fields = [
            "id", "name", "slug", "logo",
            "description", "websiteUrl",
            "featured", "is_active",
            "meta_title", "meta_description",
            "meta_keywords", "canonical_url",
            "seo", "status",
        ]
        read_only_fields = ["id"]

    def validate_name(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        qs = Brand.objects.filter(name__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A brand with this name already exists."
            )
        return value

    def validate_slug(self, value):
        if value is None:
            return value
        value = _slugify(value)
        if not value:
            return ""
        qs = Brand.objects.filter(slug=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A brand with this slug already exists."
            )
        return value

    def validate_websiteUrl(self, value):
        return (value or "").strip()

    def _unique_slug(self, base: str) -> str:
        base = base or "brand"
        candidate = base
        i = 2
        qs = Brand.objects.filter(slug=candidate)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        while qs.exists():
            candidate = f"{base}-{i}"
            i += 1
            qs = Brand.objects.filter(slug=candidate)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
        return candidate

    def _unpack(self, data: dict) -> dict:
        data = dict(data)

        if "websiteUrl" in data:
            data["website_url"] = data.pop("websiteUrl")

        seo = data.pop("seo", None) or {}
        if "metaTitle" in seo:
            data["meta_title"] = seo.get("metaTitle") or ""
        if "metaDescription" in seo:
            data["meta_description"] = seo.get("metaDescription") or ""
        if "metaKeywords" in seo:
            data["meta_keywords"] = seo.get("metaKeywords") or ""
        if "canonicalUrl" in seo:
            data["canonical_url"] = seo.get("canonicalUrl") or ""

        status = data.pop("status", None)
        if status is not None:
            data["is_active"] = status == "Active"

        name = data.get("name")
        raw_slug = data.get("slug")
        if raw_slug is None or raw_slug == "":
            if name:
                data["slug"] = self._unique_slug(_slugify(name))
            else:
                data.pop("slug", None)
        else:
            data["slug"] = raw_slug

        data = self._clean_logo(data)

        return data

    def _clean_logo(self, data: dict) -> dict:
        if "logo" not in data:
            return data

        value = data["logo"]

        if isinstance(value, str) and value.startswith("data:"):
            file = _data_url_to_file(value, name_hint="brand")
            if file is not None:
                data["logo"] = file
            else:
                data.pop("logo", None)
            return data

        if isinstance(value, str):
            if value in ("", "/placeholder.jpeg"):
                data.pop("logo", None)
                return data

            if self.instance is not None and self.instance.logo:
                current = self.instance.logo.url
                if value == current or value.endswith(current):
                    data.pop("logo", None)
                    return data

            data.pop("logo", None)

        return data

    def create(self, validated_data):
        return Brand.objects.create(**self._unpack(validated_data))

    def update(self, instance, validated_data):
        for field, value in self._unpack(validated_data).items():
            setattr(instance, field, value)
        instance.save()
        return instance