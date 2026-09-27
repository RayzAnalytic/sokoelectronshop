# onboarding/serializers.py

import re
import uuid

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.text import slugify

from rest_framework import serializers

from phonenumber_field.phonenumber import to_python
from admin_dashboard.models import (
    BusinessDetails,
    ShippingRate,
    ShippingZone,
    StoreProfile,
    StoreShippingConfig,
    StoreTheme,
)

from payments.models import StorePaymentConfig
from catalog.models import Category, Product, ProductImage
from onboarding.constants import STEP_META
from onboarding.models import OnboardingProgress
from onboarding.services.progress import get_or_create_progress
from payments.models import StorePaymentConfig as _StorePaymentConfig  # noqa: F401
from social_media.models import SocialAccount
from team.models import TeamInvite
from whatsapp.models import StoreWhatsAppConfig

User = get_user_model()


# ─────────────────────────────────────────────────────────────
# PROGRESS
# ─────────────────────────────────────────────────────────────
class OnboardingProgressSerializer(serializers.ModelSerializer):
    completed_count = serializers.IntegerField(read_only=True)
    percent_complete = serializers.IntegerField(read_only=True)

    class Meta:
        model = OnboardingProgress
        fields = [
            "id", "current_step", "completed_steps", "step_data",
            "status", "started_at", "submitted_at", "reviewed_at",
            "review_notes", "completed_count", "percent_complete",
            "created_at", "updated_at",
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────
# STEP 1 — ACCOUNT
# ─────────────────────────────────────────────────────────────
class Step1AccountSerializer(serializers.Serializer):
    """
    Step 1: confirm owner account details.
    """
    fullName = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    role = serializers.ChoiceField(
        choices=["Owner", "Manager", "Staff"],
        default="Owner",
    )
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        min_length=8,
    )
    confirm = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )
    agreed = serializers.BooleanField()

    def validate_email(self, value):
        value = value.strip().lower()
        user = self.context["request"].user
        if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError(
                "Another account already uses this email."
            )
        return value

    def validate_phone(self, value):
        try:
            number = to_python(value.strip())
            if not number or not number.is_valid():
                raise ValueError
        except Exception:
            raise serializers.ValidationError("Enter a valid phone number.")
        return number

    def validate(self, attrs):
        password = attrs.get("password") or ""
        confirm = attrs.get("confirm") or ""

        if password and password != confirm:
            raise serializers.ValidationError(
                {"confirm": "Passwords do not match."}
            )

        if password:
            try:
                validate_password(password, self.context["request"].user)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)})

        if not attrs.get("agreed"):
            raise serializers.ValidationError(
                {"agreed": "You must accept the Terms & Privacy Policy."}
            )

        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        data = self.validated_data

        full_name = " ".join(data["fullName"].split())
        parts = full_name.split(" ", 1)
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ""

        user.email = data["email"]
        user.phone_number = data["phone"]

        if data.get("password"):
            user.set_password(data["password"])

        user.save()

        return {
            "fullName": data["fullName"],
            "email": data["email"],
            "phone": str(data["phone"]),
            "role": data["role"],
        }


# ─────────────────────────────────────────────────────────────
# STEP 2 — STORE PROFILE
# ─────────────────────────────────────────────────────────────
class Step2StoreSerializer(serializers.ModelSerializer):
    """
    Step 2: store profile. Handles multipart for the logo upload.
    """

    class Meta:
        model = StoreProfile
        fields = [
            "name", "tagline", "description", "logo",
            "street", "town", "county", "postal_code",
            "support_email", "support_phone",
        ]
        extra_kwargs = {
            "name": {"required": True},
            "tagline": {"required": False, "allow_blank": True},
            "description": {"required": False, "allow_blank": True},
            "logo": {"required": False, "allow_null": True},
            "street": {"required": False, "allow_blank": True},
            "town": {"required": False, "allow_blank": True},
            "county": {"required": False, "allow_blank": True},
            "postal_code": {"required": False, "allow_blank": True},
            "support_email": {"required": False, "allow_blank": True},
            "support_phone": {"required": False, "allow_blank": True},
        }

    def validate_description(self, value):
        if len(value) > 200:
            raise serializers.ValidationError(
                "Description must be 200 characters or fewer."
            )
        return value

    def validate_logo(self, value):
        if not value:
            return value
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Logo must be 2MB or smaller.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        store, _ = StoreProfile.objects.update_or_create(
            user=user,
            defaults=validated_data,
        )
        return store

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.logo:
            request = self.context.get("request")
            url = instance.logo.url
            data["logo"] = request.build_absolute_uri(url) if request else url
        else:
            data["logo"] = None
        return data


# ─────────────────────────────────────────────────────────────
# STEP 3 — BUSINESS & TAX
# ─────────────────────────────────────────────────────────────
class Step3BusinessSerializer(serializers.ModelSerializer):
    """
    Step 3: business & tax info. Handles conditional validation.
    """

    class Meta:
        model = BusinessDetails
        fields = [
            "type",
            "kra_pin",
            "reg_number",
            "vat_registered",
            "vat_number",
            "etims_enabled",
            "etims_device_id",
            "etims_pin",
            "etims_api_key",
            "etims_env",
            "invoice_footer",
        ]
        extra_kwargs = {
            "type": {"required": True},
            "kra_pin": {"required": False, "allow_blank": True},
            "reg_number": {"required": False, "allow_blank": True},
            "vat_registered": {"required": False},
            "vat_number": {"required": False, "allow_blank": True},
            "etims_enabled": {"required": False},
            "etims_device_id": {"required": False, "allow_blank": True},
            "etims_pin": {"required": False, "allow_blank": True},
            "etims_api_key": {"required": False, "allow_blank": True, "write_only": True},
            "etims_env": {"required": False},
            "invoice_footer": {"required": False, "allow_blank": True},
        }

    def validate_kra_pin(self, value):
        if not value:
            return value
        value = value.strip().upper()
        if not re.match(r"^[A-Z]\d{9}[A-Z]$", value):
            raise serializers.ValidationError(
                "KRA PIN should look like A123456789X."
            )
        return value

    def validate(self, attrs):
        btype = attrs.get("type")

        if btype != BusinessDetails.BusinessType.NONE:
            if not attrs.get("kra_pin"):
                raise serializers.ValidationError(
                    {"kra_pin": "KRA PIN is required for registered businesses."}
                )

        if attrs.get("vat_registered") and not attrs.get("vat_number"):
            raise serializers.ValidationError(
                {"vat_number": "VAT number is required when VAT registered."}
            )

        if attrs.get("etims_enabled"):
            missing = {}
            if not attrs.get("etims_device_id"):
                missing["etims_device_id"] = "Device ID is required for eTIMS."
            if not attrs.get("etims_pin"):
                missing["etims_pin"] = "eTIMS PIN is required."
            if not attrs.get("etims_api_key"):
                missing["etims_api_key"] = "API key is required."
            if missing:
                raise serializers.ValidationError(missing)

        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        business, _ = BusinessDetails.objects.update_or_create(
            user=user,
            defaults=validated_data,
        )
        return business

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data.pop("etims_api_key", None)
        return data


# ─────────────────────────────────────────────────────────────
# STEP 4 — PAYMENTS
# ─────────────────────────────────────────────────────────────
class Step4PaymentsSerializer(serializers.Serializer):
    """
    Step 4: payment configuration (M-Pesa + aggregator).
    """
    mpesa_enabled = serializers.BooleanField(required=False, default=False)
    mpesa = serializers.DictField(required=False, default=dict)

    aggregator = serializers.ChoiceField(
        choices=["none", "pesapal", "dusupay"],
        default="none",
    )
    aggregator_credentials = serializers.DictField(required=False, default=dict)

    def validate(self, attrs):
        if attrs.get("mpesa_enabled"):
            m = attrs.get("mpesa") or {}
            required = ["consumer_key", "consumer_secret", "passkey", "shortcode"]
            missing = {f: "This field is required." for f in required if not m.get(f)}
            if missing:
                raise serializers.ValidationError({"mpesa": missing})

        agg = attrs.get("aggregator", "none")
        if agg != "none":
            c = attrs.get("aggregator_credentials") or {}
            required = ["public_key", "secret_key"]
            missing = {f: "This field is required." for f in required if not c.get(f)}
            if missing:
                raise serializers.ValidationError(
                    {"aggregator_credentials": missing}
                )

        if not attrs.get("mpesa_enabled") and agg == "none":
            raise serializers.ValidationError(
                "Enable M-Pesa or choose an aggregator (Pesapal/Dusupay)."
            )

        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        data = self.validated_data

        mpesa = data.get("mpesa") or {}
        agg_creds = data.get("aggregator_credentials") or {}

        config, _ = StorePaymentConfig.objects.update_or_create(
            user=user,
            defaults={
                "mpesa_enabled": data.get("mpesa_enabled", False),
                "mpesa_consumer_key": mpesa.get("consumer_key", ""),
                "mpesa_consumer_secret": mpesa.get("consumer_secret", ""),
                "mpesa_passkey": mpesa.get("passkey", ""),
                "mpesa_shortcode": mpesa.get("shortcode", ""),
                "mpesa_env": mpesa.get("env", "sandbox"),
                "aggregator": data.get("aggregator", "none"),
                "aggregator_public_key": agg_creds.get("public_key", ""),
                "aggregator_secret_key": agg_creds.get("secret_key", ""),
                "aggregator_env": agg_creds.get("env", "sandbox"),
            },
        )
        return config

    def to_representation(self, instance):
        return {
            "mpesa_enabled": instance.mpesa_enabled,
            "mpesa": {
                "consumer_key": instance.mpesa_consumer_key,
                "consumer_secret": "",
                "passkey": "",
                "shortcode": instance.mpesa_shortcode,
                "env": instance.mpesa_env,
            },
            "aggregator": instance.aggregator,
            "aggregator_credentials": {
                "public_key": instance.aggregator_public_key,
                "secret_key": "",
                "env": instance.aggregator_env,
            },
        }


# ─────────────────────────────────────────────────────────────
# STEP 5 — WHATSAPP
# ─────────────────────────────────────────────────────────────
class Step5WhatsAppSerializer(serializers.Serializer):
    """
    Step 5: WhatsApp configuration.
    """
    number = serializers.CharField(max_length=20, allow_blank=True)
    template = serializers.CharField(
        allow_blank=True,
        max_length=1000,
        required=False,
    )
    new_order_alert = serializers.BooleanField(default=True)
    auto_reply = serializers.BooleanField(default=False)

    ALLOWED_PLACEHOLDERS = {
        "store_name", "items", "total", "address", "customer_name"
    }

    def validate_number(self, value):
        if not value:
            return value
        value = value.strip()
        if not value.startswith("+"):
            raise serializers.ValidationError(
                "Number must start with + and the country code."
            )
        digits = value.replace("+", "").replace(" ", "").replace("-", "")
        if not digits.isdigit() or len(digits) < 10:
            raise serializers.ValidationError("Enter a valid phone number.")
        return value

    def validate_template(self, value):
        if not value:
            return value

        placeholders = set(re.findall(r"\{(\w+)\}", value))
        unknown = placeholders - self.ALLOWED_PLACEHOLDERS
        if unknown:
            raise serializers.ValidationError(
                f"Unknown placeholders: {', '.join(sorted(unknown))}. "
                f"Allowed: {', '.join(sorted(self.ALLOWED_PLACEHOLDERS))}."
            )
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        data = self.validated_data

        config, _ = StoreWhatsAppConfig.objects.update_or_create(
            user=user,
            defaults={
                "number": data.get("number", ""),
                "template": (
                    data.get("template")
                    or StoreWhatsAppConfig._meta.get_field("template").default
                ),
                "new_order_alert": data.get("new_order_alert", True),
                "auto_reply": data.get("auto_reply", False),
            },
        )
        return config

    def to_representation(self, instance):
        return {
            "number": instance.number,
            "verified": instance.verified,
            "verified_at": instance.verified_at,
            "template": instance.template,
            "new_order_alert": instance.new_order_alert,
            "auto_reply": instance.auto_reply,
        }


# ─────────────────────────────────────────────────────────────
# STEP 6 — SHIPPING
# ─────────────────────────────────────────────────────────────
class ShippingRateSerializer(serializers.Serializer):
    method = serializers.CharField(max_length=80, default="Standard")
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    eta = serializers.CharField(max_length=80, allow_blank=True, required=False)


class ShippingZoneSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    counties = serializers.ListField(
        child=serializers.CharField(max_length=80),
        allow_empty=True,
        default=list,
    )
    rates = ShippingRateSerializer(many=True, allow_empty=False)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Zone name is required.")
        return value


class Step6ShippingSerializer(serializers.Serializer):
    """
    Step 6: shipping configuration.
    """
    preset = serializers.ChoiceField(
        choices=["national", "nairobi", "custom"],
        default="national",
    )
    zones = ShippingZoneSerializer(many=True, allow_empty=False)
    free_shipping_enabled = serializers.BooleanField(default=False)
    free_shipping_threshold = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        if attrs.get("free_shipping_enabled") and not attrs.get("free_shipping_threshold"):
            raise serializers.ValidationError({
                "free_shipping_threshold": "Threshold is required when free shipping is on.",
            })
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        data = self.validated_data

        config, _ = StoreShippingConfig.objects.update_or_create(
            user=user,
            defaults={
                "preset": data["preset"],
                "free_shipping_enabled": data["free_shipping_enabled"],
                "free_shipping_threshold": data.get("free_shipping_threshold"),
            },
        )

        config.zones.all().delete()

        for idx, zone_data in enumerate(data["zones"]):
            zone = ShippingZone.objects.create(
                config=config,
                name=zone_data["name"],
                counties=zone_data.get("counties", []),
                order=idx,
            )
            for r_idx, rate_data in enumerate(zone_data["rates"]):
                ShippingRate.objects.create(
                    zone=zone,
                    method=rate_data.get("method") or "Standard",
                    price=rate_data["price"],
                    eta=rate_data.get("eta", ""),
                    order=r_idx,
                )

        return config

    def to_representation(self, instance):
        return {
            "preset": instance.preset,
            "free_shipping_enabled": instance.free_shipping_enabled,
            "free_shipping_threshold": (
                str(instance.free_shipping_threshold)
                if instance.free_shipping_threshold is not None
                else None
            ),
            "zones": [
                {
                    "id": str(zone.id),
                    "name": zone.name,
                    "counties": zone.counties or [],
                    "rates": [
                        {
                            "id": str(rate.id),
                            "method": rate.method,
                            "price": str(rate.price),
                            "eta": rate.eta,
                        }
                        for rate in zone.rates.all()
                    ],
                }
                for zone in instance.zones.all()
            ],
        }


# ─────────────────────────────────────────────────────────────
# STEP 7 — FIRST CATEGORIES
# ─────────────────────────────────────────────────────────────
class Step7CategoryItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    slug = serializers.SlugField(max_length=100, required=False, allow_blank=True)
    description = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Category name is required.")
        return value


class Step7CategoriesSerializer(serializers.Serializer):
    """
    Step 7: create the first set of categories.
    """
    categories = Step7CategoryItemSerializer(many=True, allow_empty=False)

    def validate_categories(self, value):
        slugs = [c.get("slug") or "" for c in value if c.get("slug")]
        if len(slugs) != len(set(slugs)):
            raise serializers.ValidationError(
                "Duplicate slugs in the submitted categories."
            )
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        request = self.context["request"]
        data = self.validated_data

        created = []

        for idx, cat_data in enumerate(data["categories"]):
            base_slug = cat_data.get("slug") or slugify(cat_data["name"])
            slug = base_slug
            suffix = 1
            while Category.objects.filter(user=user, slug=slug).exists():
                suffix += 1
                slug = f"{base_slug}-{suffix}"

            image_file = request.FILES.get(f"image_{idx}")

            cat = Category.objects.create(
                user=user,
                name=cat_data["name"],
                slug=slug,
                description=cat_data.get("description", ""),
                image=image_file if image_file else None,
                order=idx,
            )
            created.append(cat)

        return created


# ─────────────────────────────────────────────────────────────
# STEP 8 — FIRST PRODUCTS
# ─────────────────────────────────────────────────────────────
class Step8ProductItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    category = serializers.CharField(max_length=80, required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    sale_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    stock = serializers.IntegerField(min_value=0)
    sku = serializers.CharField(max_length=64, required=False, allow_blank=True)
    short_description = serializers.CharField(
        max_length=160, required=False, allow_blank=True
    )

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than 0.")
        return value

    def validate(self, attrs):
        sale = attrs.get("sale_price")
        price = attrs.get("price")
        if sale is not None and price is not None and sale > price:
            # Likely swapped — correct it
            attrs["sale_price"], attrs["price"] = price, sale
        return attrs


class Step8ProductsSerializer(serializers.Serializer):
    """
    Step 8: create the first set of products.
    """
    products = Step8ProductItemSerializer(many=True, allow_empty=False)

    def save(self, **kwargs):
        user = self.context["request"].user
        request = self.context["request"]
        data = self.validated_data

        created = []

        for idx, prod_data in enumerate(data["products"]):
            # ── Resolve or create category by name ──
            category = None
            cat_name = (prod_data.get("category") or "").strip()
            if cat_name:
                category = Category.objects.filter(
                    user=user, name__iexact=cat_name
                ).first()
                if not category:
                    base_slug = slugify(cat_name) or f"cat-{uuid.uuid4().hex[:6]}"
                    slug = base_slug
                    n = 1
                    while Category.objects.filter(user=user, slug=slug).exists():
                        n += 1
                        slug = f"{base_slug}-{n}"
                    category = Category.objects.create(
                        user=user, name=cat_name, slug=slug
                    )

            # ── Create product ──
            product = Product.objects.create(
                user=user,
                category=category,
                name=prod_data["name"],
                short_description=prod_data.get("short_description", ""),
                price=prod_data["price"],
                sale_price=prod_data.get("sale_price"),
                stock=prod_data["stock"],
                sku=prod_data.get("sku", ""),
            )

            # ── Attach images (max 3) ──
            for n in range(3):
                file_key = f"image_{idx}_{n}"
                img_file = request.FILES.get(file_key)
                if img_file:
                    ProductImage.objects.create(
                        product=product, image=img_file, order=n
                    )

            created.append(product)

        return created


# ─────────────────────────────────────────────────────────────
# STEP 9 — SOCIAL CHANNELS
# ─────────────────────────────────────────────────────────────
STEP9_PLATFORMS = ["tiktok_shop", "instagram", "facebook", "youtube", "x"]


class Step9SocialPlatformStatusSerializer(serializers.Serializer):
    id = serializers.CharField()
    connected = serializers.BooleanField()
    username = serializers.CharField(allow_blank=True)
    connected_at = serializers.DateTimeField(allow_null=True)
    gated = serializers.BooleanField()


class Step9SocialStatusSerializer(serializers.Serializer):
    platforms = Step9SocialPlatformStatusSerializer(many=True)
    connected_count = serializers.IntegerField()
    total_count = serializers.IntegerField()


class Step9MarkSerializer(serializers.Serializer):
    """Payload for POST /api/onboarding/steps/9/."""
    connected_platforms = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )


# ─────────────────────────────────────────────────────────────
# STEP 10 — THEME
# ─────────────────────────────────────────────────────────────
HEX_RE = r"^#(?:[0-9a-fA-F]{3}){1,2}$"


class Step10ThemeSerializer(serializers.ModelSerializer):
    """
    Step 10: storefront theme.
    """

    class Meta:
        model = StoreTheme
        fields = [
            "preset", "primary", "accent",
            "font", "radius", "dark_store",
        ]
        extra_kwargs = {
            "preset": {"required": False},
            "primary": {"required": False},
            "accent": {"required": False},
            "font": {"required": False},
            "radius": {"required": False},
            "dark_store": {"required": False},
        }

    def validate_primary(self, value):
        if value and not re.match(HEX_RE, value):
            raise serializers.ValidationError("Use a valid hex color (e.g. #1e3a8a).")
        return value

    def validate_accent(self, value):
        if value and not re.match(HEX_RE, value):
            raise serializers.ValidationError("Use a valid hex color (e.g. #3b82f6).")
        return value

    def validate_radius(self, value):
        if value is not None and (value < 0 or value > 24):
            raise serializers.ValidationError("Radius must be between 0 and 24.")
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        theme, _ = StoreTheme.objects.update_or_create(
            user=user,
            defaults=validated_data,
        )
        return theme

    def to_representation(self, instance):
        return {
            "preset": instance.preset,
            "primary": instance.primary,
            "accent": instance.accent,
            "font": instance.font,
            "radius": instance.radius,
            "dark_store": instance.dark_store,
        }


# ─────────────────────────────────────────────────────────────
# STEP 11 — TEAM
# ─────────────────────────────────────────────────────────────
class Step11InviteItemSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=["admin", "manager", "orders", "content"]
    )

    def validate_email(self, value):
        return value.strip().lower()


class Step11TeamSerializer(serializers.Serializer):
    """
    Step 11: invite team members.
    """
    invites = Step11InviteItemSerializer(many=True, allow_empty=True)

    def validate_invites(self, value):
        emails = [i["email"] for i in value]
        if len(emails) != len(set(emails)):
            raise serializers.ValidationError(
                "Duplicate emails in the invite list."
            )

        owner = self.context["request"].user
        for item in value:
            if item["email"] == owner.email.lower():
                raise serializers.ValidationError(
                    f"You can't invite yourself ({item['email']})."
                )
        return value

    def save(self, **kwargs):
        from team.services import create_invite, send_invite_email

        owner = self.context["request"].user
        data = self.validated_data

        created = []
        for item in data["invites"]:
            invite = create_invite(owner, item["email"], item["role"])
            try:
                send_invite_email(invite)
            except Exception:
                pass  # logged in service
            created.append(invite)

        return created


# ─────────────────────────────────────────────────────────────
# STEP 12 — FINISH
# ─────────────────────────────────────────────────────────────
REQUIRED_STEPS = [1, 2, 4, 6, 7, 8]
OPTIONAL_STEPS = [3, 5, 9, 10, 11]


class Step12FinalizeSerializer(serializers.Serializer):
    """
    Payload for POST /api/onboarding/steps/12/.
    """
    confirm = serializers.BooleanField()

    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError(
                "You must confirm before going live."
            )
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        progress = get_or_create_progress(user)
        completed = set(progress.completed_steps or [])

        missing = [s for s in REQUIRED_STEPS if s not in completed]
        if missing:
            titles = [
                STEP_META.get(s, {}).get("title", f"Step {s}") for s in missing
            ]
            raise serializers.ValidationError({
                "non_field_errors": [
                    f"Please complete these steps first: {', '.join(titles)}."
                ]
            })
        return attrs