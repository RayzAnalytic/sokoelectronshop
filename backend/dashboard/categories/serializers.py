from rest_framework import serializers

from catalog.models import Category


class CategoryAdminReadSerializer(serializers.ModelSerializer):
    """
    Shape matches the frontend's `Category` interface:
      { id, name, slug, parentId, productsCount, status, image,
        displayOrder, description, seo, children }
    """
    parent_id = serializers.IntegerField(read_only=True, allow_null=True)
    productsCount = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    displayOrder = serializers.IntegerField(source="sort_order", read_only=True)
    seo = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id", "name", "slug", "parent_id", "productsCount",
            "status", "image", "displayOrder", "description", "seo",
            "is_active", "icon_name",
            "created_at", "updated_at",
        ]

    def get_productsCount(self, obj):
        return getattr(obj, "product_count", 0)

    def get_status(self, obj):
        return "Active" if obj.is_active else "Inactive"

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

    def get_seo(self, obj):
        return {
            "metaTitle": obj.meta_title or "",
            "metaDescription": obj.meta_description or "",
            "metaKeywords": obj.meta_keywords or "",
            "canonicalUrl": obj.canonical_url or "",
        }


class CategoryAdminWriteSerializer(serializers.ModelSerializer):
    """
    Accepts flat fields + a `seo` object and maps them onto the model.
    Parent is set via `parent_id` (nullable).
    """
    parent_id = serializers.IntegerField(
        required=False, allow_null=True, write_only=True,
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
            "id", "name", "slug", "parent_id",
            "description", "image", "icon_name",
            "is_active", "sort_order",
            "meta_title", "meta_description",
            "meta_keywords", "canonical_url",
            # Write-only conveniences
            "seo", "status",
        ]
        read_only_fields = ["id", "slug"]

    def validate_parent_id(self, value):
        if value is None:
            return None
        if not Category.objects.filter(id=value).exists():
            raise serializers.ValidationError("Parent category not found.")
        # Prevent a category from being its own ancestor.
        instance = getattr(self, "instance", None)
        if instance and instance.id == value:
            raise serializers.ValidationError("A category cannot be its own parent.")
        return value

    def _unpack(self, data):
        """Flatten `seo` and `status` into model fields."""
        data = dict(data)

        seo = data.pop("seo", None) or {}
        if "metaTitle" in seo:
            data["meta_title"] = seo.get("metaTitle", "")
        if "metaDescription" in seo:
            data["meta_description"] = seo.get("metaDescription", "")
        if "metaKeywords" in seo:
            data["meta_keywords"] = seo.get("metaKeywords", "")
        if "canonicalUrl" in seo:
            data["canonical_url"] = seo.get("canonicalUrl", "")

        status = data.pop("status", None)
        if status is not None:
            data["is_active"] = status == "Active"

        parent_id = data.pop("parent_id", "__keep__")
        if parent_id != "__keep__":
            data["parent"] = (
                Category.objects.get(id=parent_id) if parent_id else None
            )

        return data

    def create(self, validated_data):
        return Category.objects.create(**self._unpack(validated_data))

    def update(self, instance, validated_data):
        for field, value in self._unpack(validated_data).items():
            setattr(instance, field, value)
        instance.save()
        return instance