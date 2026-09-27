# catalog/serializers.py

from rest_framework import serializers

from .models import Category, Product, ProductImage


# ─────────────────────────────────────────────────────────────
# CATEGORY — READ
# ─────────────────────────────────────────────────────────────
class CategoryReadSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    parent_name = serializers.CharField(
        source="parent.name", read_only=True, default=""
    )

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "image",
            "parent",
            "parent_name",
            "order",
            "is_active",
            "product_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_product_count(self, obj):
        # Uses reverse relation: Category.products (from Product.category FK)
        if hasattr(obj, "products"):
            return obj.products.count()
        return 0


# ─────────────────────────────────────────────────────────────
# CATEGORY — WRITE
# ─────────────────────────────────────────────────────────────
class CategoryWriteSerializer(serializers.ModelSerializer):
    """
    Used for create/update on the dashboard.
    Slug is auto-generated from name if not provided.
    """

    class Meta:
        model = Category
        fields = [
            "name",
            "slug",
            "description",
            "image",
            "parent",
            "order",
            "is_active",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
            "description": {"required": False, "allow_blank": True},
            "image": {"required": False, "allow_null": True},
            "parent": {"required": False, "allow_null": True},
            "order": {"required": False},
            "is_active": {"required": False},
        }

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Category name is required.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        return Category.objects.create(user=user, **validated_data)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


# ─────────────────────────────────────────────────────────────
# PRODUCT IMAGE — READ
# ─────────────────────────────────────────────────────────────
class ProductImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["id", "url", "order"]
        read_only_fields = fields

    def get_url(self, obj):
        request = self.context.get("request")
        if not obj.image:
            return None
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


# ─────────────────────────────────────────────────────────────
# PRODUCT — READ
# ─────────────────────────────────────────────────────────────
class ProductReadSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=""
    )
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "short_description",
            "price",
            "sale_price",
            "sku",
            "stock",
            "category",
            "category_name",
            "images",
            "primary_image",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_primary_image(self, obj):
        """Return the URL of the first image (order=0), if any."""
        # If images prefetched, use cache to avoid extra query
        if hasattr(obj, "_prefetched_objects_cache") and "images" in obj._prefetched_objects_cache:
            images = obj._prefetched_objects_cache["images"]
        else:
            images = list(obj.images.all())

        if not images:
            return None

        first = images[0]
        request = self.context.get("request")
        url = first.image.url
        return request.build_absolute_uri(url) if request else url


# ─────────────────────────────────────────────────────────────
# PRODUCT IMAGE — WRITE (nested)
# ─────────────────────────────────────────────────────────────
class ProductImageWriteSerializer(serializers.Serializer):
    image = serializers.ImageField()
    order = serializers.IntegerField(default=0, required=False)


# ─────────────────────────────────────────────────────────────
# PRODUCT — WRITE
# ─────────────────────────────────────────────────────────────
class ProductWriteSerializer(serializers.ModelSerializer):
    """
    Used for create/update on the dashboard.
    Accepts an optional nested `images` array.
    `category_id` is accepted instead of `category` for cleaner API.
    """
    category_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )
    images = ProductImageWriteSerializer(
        many=True, required=False, write_only=True
    )

    class Meta:
        model = Product
        fields = [
            "name",
            "slug",
            "short_description",
            "price",
            "sale_price",
            "sku",
            "stock",
            "is_active",
            "category_id",
            "images",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
            "short_description": {"required": False, "allow_blank": True},
            "sale_price": {"required": False, "allow_null": True},
            "sku": {"required": False, "allow_blank": True},
            "is_active": {"required": False},
        }

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Product name is required.")
        return value

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than 0.")
        return value

    def validate(self, attrs):
        # If sale_price > price, swap them
        sale = attrs.get("sale_price")
        price = attrs.get("price")
        if sale is not None and price is not None and sale > price:
            attrs["sale_price"], attrs["price"] = price, sale
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        images_data = validated_data.pop("images", [])
        category_id = validated_data.pop("category_id", None)

        category = None
        if category_id:
            category = Category.objects.filter(
                user=user, id=category_id
            ).first()

        product = Product.objects.create(
            user=user,
            category=category,
            **validated_data,
        )

        for idx, img in enumerate(images_data):
            ProductImage.objects.create(
                product=product,
                image=img["image"],
                order=img.get("order", idx),
            )

        return product

    def update(self, instance, validated_data):
        images_data = validated_data.pop("images", None)
        category_id = validated_data.pop("category_id", None)

        # Update scalar fields
        for field, value in validated_data.items():
            setattr(instance, field, value)

        # Update category if provided
        if category_id is not None:
            if category_id == "":
                instance.category = None
            else:
                instance.category = Category.objects.filter(
                    user=instance.user, id=category_id
                ).first()

        instance.save()

        # Replace images if the caller sent them
        if images_data is not None:
            instance.images.all().delete()
            for idx, img in enumerate(images_data):
                ProductImage.objects.create(
                    product=instance,
                    image=img["image"],
                    order=img.get("order", idx),
                )

        return instance


# ─────────────────────────────────────────────────────────────
# CATEGORY — LEGACY (bulk-create used by onboarding Step 7)
# ─────────────────────────────────────────────────────────────
class CategoryCreateSerializer(serializers.Serializer):
    """
    Used by onboarding Step 7 (bulk-create).
    Accepts an array under `categories`.
    """
    name = serializers.CharField(max_length=80)
    slug = serializers.SlugField(
        max_length=100, required=False, allow_blank=True
    )
    description = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )