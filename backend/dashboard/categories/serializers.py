# dashboard/categories/serializers.py
"""
Serializers for the admin Categories page.

Contract (must match the frontend's `ApiCategory` in
`app/admin/categories/page.tsx`):

    {
      "id":            1,
      "name":          "Smart Home",
      "slug":          "smart-home",
      "parent_id":     null,
      "productsCount": 0,
      "status":        "Active",          # or "Inactive"
      "image":         "http://…/foo.jpg" | null,
      "displayOrder":  1,
      "description":   "",
      "seo": {
          "metaTitle":       "",
          "metaDescription": "",
          "metaKeywords":    "",
          "canonicalUrl":    ""
      },
      "is_active": true,
      "icon_name": "",
      "children":  [ …same shape… ]
    }
"""
from __future__ import annotations

import base64
import binascii
import mimetypes
import re
from typing import Any, Optional

from django.core.files.base import ContentFile
from django.utils.text import slugify as django_slugify
from rest_framework import serializers

from catalog.models import Category


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
_DATA_URL_RE = re.compile(
    r"^data:(?P<mime>[\w/+.\-]+);base64,(?P<data>.+)$",
    re.DOTALL,
)


def _slugify(value: str) -> str:
    """Match the frontend's slugify(): lowercase, dashes, no edge dashes."""
    return django_slugify(value or "").strip("-")


def _absolute_image(request, field_file) -> Optional[str]:
    """ImageField → absolute URL (or None if empty/placeholder)."""
    if not field_file:
        return None
    try:
        url = field_file.url
    except (ValueError, AttributeError):
        return None
    if not url:
        return None
    return request.build_absolute_uri(url) if request else url


def _data_url_to_file(value: str, name_hint: str = "upload") -> Optional[ContentFile]:
    """Convert a `data:image/png;base64,…` string into a Django ContentFile.

    `AddCategoryModal` uploads images as data URLs (see fileToDataUrl in the
    modal), so the API has to accept them or editing a category with an image
    returns 400.
    """
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
    # Normalise `.jpe` → `.jpg`
    if ext == ".jpe":
        ext = ".jpg"
    return ContentFile(raw, name=f"{name_hint}{ext}")


# ─────────────────────────────────────────────────────────────────────────────
# Read
# ─────────────────────────────────────────────────────────────────────────────
class CategoryAdminReadSerializer(serializers.ModelSerializer):
    """Shape returned by GET /api/v1/admin/categories/ and .../<id>/."""

    parent_id = serializers.IntegerField(read_only=True, allow_null=True)
    productsCount = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    displayOrder = serializers.IntegerField(source="sort_order", read_only=True)
    image = serializers.SerializerMethodField()
    seo = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "parent_id",
            "productsCount",
            "status",
            "image",
            "displayOrder",
            "description",
            "seo",
            "is_active",
            "icon_name",
            "children",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    # ── computed ──────────────────────────────────────────────────────────
    def get_productsCount(self, obj) -> int:
        # Prefer an annotation added by the viewset (`product_count`).
        annotated = getattr(obj, "product_count", None)
        if annotated is not None:
            return int(annotated)
        # Fall back to a live count so a mis-configured view still works.
        try:
            return obj.products.count()
        except Exception:
            return 0

    def get_status(self, obj) -> str:
        return "Active" if obj.is_active else "Inactive"

    def get_image(self, obj) -> Optional[str]:
        return _absolute_image(self.context.get("request"), obj.image)

    def get_seo(self, obj) -> dict:
        return {
            "metaTitle": obj.meta_title or "",
            "metaDescription": obj.meta_description or "",
            "metaKeywords": obj.meta_keywords or "",
            "canonicalUrl": obj.canonical_url or "",
        }

    def get_children(self, obj):
        """Recursively render children up to `children_depth` (0 = flat).

        The viewset should pass `children_depth` in the context. Default 0
        keeps the response cheap for the "flat list" endpoint.
        """
        depth = self.context.get("children_depth", 0)
        if depth <= 0:
            return []

        qs = obj.children.all()
        try:
            qs = qs.order_by("sort_order", "name")
        except Exception:
            pass

        child_ctx = {**self.context, "children_depth": depth - 1}
        return CategoryAdminReadSerializer(qs, many=True, context=child_ctx).data


# ─────────────────────────────────────────────────────────────────────────────
# Write
# ─────────────────────────────────────────────────────────────────────────────
class CategoryAdminWriteSerializer(serializers.ModelSerializer):
    """
    Accepts the payload produced by `categoryToApi()` in the frontend:

        {
          "name":         "…",
          "slug":         "…",           # optional; auto-derived if missing
          "parent_id":    null | <int>,
          "description":  "…",
          "image":        "<data-url>" | "<absolute-url>" | undefined,
          "is_active":    true,
          "sort_order":   1,
          "seo":  { "metaTitle": …, "metaDescription": …,
                    "metaKeywords": …, "canonicalUrl": … },
          "status": "Active" | "Inactive"    # optional convenience
        }
    """

    parent_id = serializers.IntegerField(
        required=False, allow_null=True, write_only=True,
    )
    slug = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=255,
    )
    seo = serializers.DictField(
        required=False, write_only=True, allow_empty=True,
    )
    status = serializers.ChoiceField(
        choices=["Active", "Inactive"], required=False, write_only=True,
    )

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "parent_id",
            "description",
            "image",
            "icon_name",
            "is_active",
            "sort_order",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "canonical_url",
            # write-only conveniences
            "seo",
            "status",
        ]
        read_only_fields = ["id"]

    # ── field-level validation ────────────────────────────────────────────
    def validate_name(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        qs = Category.objects.filter(name__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A category with this name already exists."
            )
        return value

    def validate_slug(self, value):
        if value is None:
            return value
        value = _slugify(value)
        if not value:
            # Blank in → let _unpack derive it from the name.
            return ""
        qs = Category.objects.filter(slug=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A category with this slug already exists."
            )
        return value

    def validate_parent_id(self, value):
        if value is None:
            return None

        try:
            parent = Category.objects.get(pk=value)
        except Category.DoesNotExist:
            raise serializers.ValidationError("Parent category not found.")

        # Can't be its own parent.
        if self.instance is not None and parent.pk == self.instance.pk:
            raise serializers.ValidationError(
                "A category cannot be its own parent."
            )

        # Can't create an ancestor cycle (A → B → A).
        if self.instance is not None:
            seen: set[int] = set()
            node = parent
            while node is not None and node.pk not in seen:
                if node.pk == self.instance.pk:
                    raise serializers.ValidationError(
                        "That parent would create a circular hierarchy."
                    )
                seen.add(node.pk)
                node = node.parent

        return value

    # ── internal flattener ────────────────────────────────────────────────
    def _unpack(self, data: dict) -> dict:
        data = dict(data)

        # 1. SEO object → flat model fields
        seo = data.pop("seo", None) or {}
        if "metaTitle" in seo:
            data["meta_title"] = seo.get("metaTitle") or ""
        if "metaDescription" in seo:
            data["meta_description"] = seo.get("metaDescription") or ""
        if "metaKeywords" in seo:
            data["meta_keywords"] = seo.get("metaKeywords") or ""
        if "canonicalUrl" in seo:
            data["canonical_url"] = seo.get("canonicalUrl") or ""

        # 2. status → is_active
        status = data.pop("status", None)
        if status is not None:
            data["is_active"] = status == "Active"

        # 3. parent_id → Category instance (or None)
        parent_id = data.pop("parent_id", serializers.empty)
        if parent_id is not serializers.empty:
            if parent_id in (None, "", 0):
                data["parent"] = None
            else:
                # Existence already validated by validate_parent_id.
                data["parent"] = Category.objects.get(pk=parent_id)

        # 4. slug: derive from name when the caller didn't send one
        name = data.get("name")
        raw_slug = data.get("slug")
        if raw_slug is None or raw_slug == "":
            if name:
                base = _slugify(name)
                data["slug"] = self._unique_slug(base)
            else:
                data.pop("slug", None)
        else:
            data["slug"] = raw_slug  # already slugified in validate_slug

        # 5. image: accept data URLs, ignore plain URLs that aren't ours
        data = self._clean_image(data)

        return data

    def _unique_slug(self, base: str) -> str:
        """Ensure a generated slug doesn't collide with an existing one."""
        base = base or "category"
        candidate = base
        i = 2
        qs = Category.objects.filter(slug=candidate)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        while qs.exists():
            candidate = f"{base}-{i}"
            i += 1
            qs = Category.objects.filter(slug=candidate)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
        return candidate

    def _clean_image(self, data: dict) -> dict:
        """Normalise the incoming `image` value.

        Accepts:
          - data URLs (from AddCategoryModal) → decoded to ContentFile
          - blank / placeholder → dropped so the existing image is kept
          - anything else (external URL, stale path) → dropped
        """
        if "image" not in data:
            return data

        value = data["image"]

        if isinstance(value, str) and value.startswith("data:"):
            file = _data_url_to_file(value, name_hint="category")
            if file is not None:
                data["image"] = file
            else:
                data.pop("image", None)
            return data

        if isinstance(value, str):
            if value in ("", "/placeholder.jpeg"):
                data.pop("image", None)
                return data

            # If it already matches the current image, leave it alone.
            if self.instance is not None and self.instance.image:
                current = self.instance.image.url
                if value == current or value.endswith(current):
                    data.pop("image", None)
                    return data

            # External URL we can't fetch server-side — skip rather than 400.
            data.pop("image", None)

        return data

    # ── persistence ───────────────────────────────────────────────────────
    def create(self, validated_data):
        return Category.objects.create(**self._unpack(validated_data))

    def update(self, instance, validated_data):
        for field, value in self._unpack(validated_data).items():
            setattr(instance, field, value)
        instance.save()
        return instance


# ─────────────────────────────────────────────────────────────────────────────
# Delete (optional, if you want a confirmation payload on DELETE)
# ─────────────────────────────────────────────────────────────────────────────
class CategoryDeleteResultSerializer(serializers.Serializer):
    """Optional: returned by DELETE when you want to report cascade effects."""
    id = serializers.IntegerField()
    deleted = serializers.BooleanField()
    children_removed = serializers.IntegerField(required=False, default=0)