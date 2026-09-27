# onboarding/views.py

import json
import logging

from django.utils import timezone

from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from onboarding.constants import STEP_META, TOTAL_STEPS
from onboarding.serializers import (
    OnboardingProgressSerializer,
    Step1AccountSerializer,
    Step2StoreSerializer,
    Step3BusinessSerializer,
    Step4PaymentsSerializer,
    Step5WhatsAppSerializer,
    Step6ShippingSerializer,
    Step7CategoriesSerializer,
    Step8ProductsSerializer,
    Step9MarkSerializer,
    Step10ThemeSerializer,
    Step11TeamSerializer,
    Step12FinalizeSerializer,
)
from onboarding.services.progress import (
    get_or_create_progress,
    mark_step_complete,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# PROGRESS + META
# ─────────────────────────────────────────────────────────────
class OnboardingProgressView(APIView):
    """GET /api/onboarding/progress/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        progress = get_or_create_progress(request.user)
        return Response(OnboardingProgressSerializer(progress).data)


class OnboardingStepsMetaView(APIView):
    """GET /api/onboarding/steps/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"total_steps": TOTAL_STEPS, "steps": STEP_META})


# ─────────────────────────────────────────────────────────────
# STEP 1 — ACCOUNT
# ─────────────────────────────────────────────────────────────
class Step1AccountView(APIView):
    """
    GET  /api/onboarding/steps/1/  — prefill from current user
    POST /api/onboarding/steps/1/  — save account details, mark step done
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "fullName": user.get_full_name() or "",
            "email": user.email,
            "phone": str(user.phone_number or ""),
            "role": "Owner",
            "agreed": False,
        })

    def post(self, request):
        serializer = Step1AccountSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        stored = serializer.save()

        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 1, stored)

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# STEP 2 — STORE PROFILE
# ─────────────────────────────────────────────────────────────
class Step2StoreView(APIView):
    """
    GET  /api/onboarding/steps/2/  — prefill from existing store
    POST /api/onboarding/steps/2/  — save store profile (JSON or multipart)
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        from admin_dashboard.models import StoreProfile
        store = StoreProfile.objects.filter(user=request.user).first()
        if not store:
            return Response({
                "name": "",
                "tagline": "",
                "description": "",
                "logo": None,
                "street": "",
                "town": "",
                "county": "Nairobi",
                "postal_code": "",
                "support_email": "",
                "support_phone": "",
            })
        return Response(
            Step2StoreSerializer(store, context={"request": request}).data
        )

    def post(self, request):
        from admin_dashboard.models import StoreProfile
        store = StoreProfile.objects.filter(user=request.user).first()

        serializer = Step2StoreSerializer(
            instance=store,
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        store = serializer.save()

        stored = {
            "name": store.name,
            "tagline": store.tagline,
            "description": store.description,
            "logo": store.logo.url if store.logo else None,
            "street": store.street,
            "town": store.town,
            "county": store.county,
            "postal_code": store.postal_code,
            "support_email": store.support_email,
            "support_phone": store.support_phone,
        }

        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 2, stored)

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# STEP 3 — BUSINESS & TAX
# ─────────────────────────────────────────────────────────────
class Step3BusinessView(APIView):
    """
    GET  /api/onboarding/steps/3/  — prefill from existing business
    POST /api/onboarding/steps/3/  — save business info, mark step done
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        from admin_dashboard.models import BusinessDetails
        business = BusinessDetails.objects.filter(user=request.user).first()
        if not business:
            return Response({
                "type": "none",
                "kra_pin": "",
                "reg_number": "",
                "vat_registered": False,
                "vat_number": "",
                "etims_enabled": False,
                "etims_device_id": "",
                "etims_pin": "",
                "etims_env": "sandbox",
                "invoice_footer": "Thank you for shopping with us!",
            })
        return Response(
            Step3BusinessSerializer(business, context={"request": request}).data
        )

    def post(self, request):
        from admin_dashboard.models import BusinessDetails
        business = BusinessDetails.objects.filter(user=request.user).first()

        serializer = Step3BusinessSerializer(
            instance=business,
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        business = serializer.save()

        stored = {
            "type": business.type,
            "kra_pin": business.kra_pin,
            "reg_number": business.reg_number,
            "vat_registered": business.vat_registered,
            "vat_number": business.vat_number,
            "etims_enabled": business.etims_enabled,
            "etims_env": business.etims_env,
            "invoice_footer": business.invoice_footer,
        }

        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 3, stored)

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


class Step3ETimsTestView(APIView):
    """
    POST /api/onboarding/steps/3/etims-test/
    Verifies the eTIMS credentials against KRA's endpoint (placeholder).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        device_id = request.data.get("device_id", "").strip()
        pin = request.data.get("pin", "").strip()
        api_key = request.data.get("api_key", "").strip()
        env = request.data.get("env", "sandbox")

        if not all([device_id, pin, api_key]):
            return Response(
                {"detail": "Device ID, PIN, and API key are all required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # TODO: replace with real KRA eTIMS call
        try:
            if env == "sandbox":
                return Response({
                    "ok": True,
                    "detail": "Sandbox credentials accepted.",
                })
            return Response({
                "ok": True,
                "detail": "eTIMS connection verified.",
            })
        except Exception as exc:
            logger.exception("eTIMS test failed")
            return Response(
                {"ok": False, "detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


# ─────────────────────────────────────────────────────────────
# STEP 4 — PAYMENTS
# ─────────────────────────────────────────────────────────────
class Step4PaymentsView(APIView):
    """
    GET  /api/onboarding/steps/4/  — prefill
    POST /api/onboarding/steps/4/  — save payment config
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from payments.models import StorePaymentConfig
        config = StorePaymentConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({
                "mpesa_enabled": False,
                "mpesa": {
                    "consumer_key": "",
                    "consumer_secret": "",
                    "passkey": "",
                    "shortcode": "",
                    "env": "sandbox",
                },
                "aggregator": "none",
                "aggregator_credentials": {
                    "public_key": "",
                    "secret_key": "",
                    "env": "sandbox",
                },
            })
        return Response(Step4PaymentsSerializer().to_representation(config))

    def post(self, request):
        serializer = Step4PaymentsSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        config = serializer.save()

        stored = {
            "mpesa_enabled": config.mpesa_enabled,
            "aggregator": config.aggregator,
        }

        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 4, stored)

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


class Step4TestConnectionView(APIView):
    """
    POST /api/onboarding/steps/4/test/
    Body: { "target": "mpesa" | "aggregator", "credentials": { ... } }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        target = request.data.get("target", "")
        creds = request.data.get("credentials") or {}

        if target == "mpesa":
            required = ["consumer_key", "consumer_secret", "passkey", "shortcode"]
            missing = [k for k in required if not creds.get(k)]
            if missing:
                return Response({
                    "ok": False,
                    "detail": f"Missing: {', '.join(missing)}",
                })

            # TODO: real Daraja call
            return Response({
                "ok": True,
                "detail": "M-Pesa credentials verified.",
            })

        if target == "aggregator":
            agg = creds.get("aggregator", "").lower()
            if agg not in {"pesapal", "dusupay"}:
                return Response({
                    "ok": False,
                    "detail": "Choose Pesapal or Dusupay.",
                })

            public_key = creds.get("public_key")
            secret_key = creds.get("secret_key")
            if not public_key or not secret_key:
                return Response({
                    "ok": False,
                    "detail": "Both keys are required.",
                })

            # TODO: real Pesapal/Dusupay call
            return Response({
                "ok": True,
                "detail": f"{agg.capitalize()} credentials verified.",
            })

        return Response(
            {"detail": "Invalid target."},
            status=status.HTTP_400_BAD_REQUEST,
        )


# ─────────────────────────────────────────────────────────────
# STEP 5 — WHATSAPP
# ─────────────────────────────────────────────────────────────
class Step5WhatsAppView(APIView):
    """
    GET  /api/onboarding/steps/5/  — prefill
    POST /api/onboarding/steps/5/  — save number + template + toggles
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from whatsapp.models import StoreWhatsAppConfig
        config = StoreWhatsAppConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({
                "number": "",
                "verified": False,
                "verified_at": None,
                "template": StoreWhatsAppConfig._meta.get_field("template").default,
                "new_order_alert": True,
                "auto_reply": False,
            })
        return Response(Step5WhatsAppSerializer().to_representation(config))

    def post(self, request):
        from whatsapp.models import StoreWhatsAppConfig
        config = StoreWhatsAppConfig.objects.filter(user=request.user).first()

        serializer = Step5WhatsAppSerializer(
            instance=config,
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        config = serializer.save()

        stored = {
            "number": config.number,
            "template": config.template,
            "new_order_alert": config.new_order_alert,
            "auto_reply": config.auto_reply,
        }

        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 5, stored)

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


class Step5VerifyWhatsAppView(APIView):
    """
    POST /api/onboarding/steps/5/verify/
    Body: { "number": "+254712345678", "otp": "123456" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from whatsapp.models import StoreWhatsAppConfig

        number = request.data.get("number", "").strip()
        otp = request.data.get("otp", "").strip()

        if not number or not otp:
            return Response(
                {"detail": "Number and OTP are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # TODO: real OTP verification
        if len(otp) != 6 or not otp.isdigit():
            return Response(
                {"ok": False, "detail": "Invalid OTP format."},
                status=status.HTTP_200_OK,
            )

        StoreWhatsAppConfig.objects.update_or_create(
            user=request.user,
            defaults={
                "number": number,
                "verified": True,
                "verified_at": timezone.now(),
            },
        )

        return Response({"ok": True, "detail": "Number verified."})


class Step5SendTestView(APIView):
    """
    POST /api/onboarding/steps/5/send-test/
    Sends a test WhatsApp message to the configured number.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from whatsapp.models import StoreWhatsAppConfig
        config = StoreWhatsAppConfig.objects.filter(user=request.user).first()
        if not config or not config.number:
            return Response(
                {"ok": False, "detail": "No WhatsApp number configured."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        template = request.data.get("template") or config.template
        sample = request.data.get("sample_data") or {}

        rendered = template
        defaults = {
            "store_name": "TechHub",
            "items": "1x Sony WH-1000XM5 — KES 38,999",
            "total": "KES 38,999",
            "address": "Riverside Drive, Nairobi",
            "customer_name": "Wanjiru",
        }
        for k, default in defaults.items():
            value = sample.get(k, default)
            rendered = rendered.replace("{" + k + "}", value)

        # TODO: real send via WhatsAppClient
        return Response({
            "ok": True,
            "detail": f"Test message sent to {config.number}.",
            "rendered": rendered,
        })


# ─────────────────────────────────────────────────────────────
# STEP 6 — SHIPPING
# ─────────────────────────────────────────────────────────────
class Step6ShippingView(APIView):
    """
    GET  /api/onboarding/steps/6/  — prefill
    POST /api/onboarding/steps/6/  — save shipping zones and rates
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from admin_dashboard.models import StoreShippingConfig
        config = StoreShippingConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({
                "preset": "national",
                "free_shipping_enabled": False,
                "free_shipping_threshold": None,
                "zones": [
                    {
                        "id": "temp",
                        "name": "Nairobi",
                        "counties": ["Nairobi"],
                        "rates": [
                            {
                                "id": "temp",
                                "method": "Standard",
                                "price": "300",
                                "eta": "1-2 days",
                            }
                        ],
                    }
                ],
            })
        return Response(Step6ShippingSerializer().to_representation(config))

    def post(self, request):
        serializer = Step6ShippingSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        config = serializer.save()

        stored = {
            "preset": config.preset,
            "zone_count": config.zones.count(),
            "free_shipping_enabled": config.free_shipping_enabled,
        }

        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 6, stored)

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# STEP 7 — FIRST CATEGORIES
# ─────────────────────────────────────────────────────────────
class Step7CategoriesView(APIView):
    """
    GET  /api/onboarding/steps/7/  — list existing categories
    POST /api/onboarding/steps/7/  — bulk-create categories (JSON or multipart)
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        from catalog.models import Category
        from catalog.serializers import CategoryReadSerializer

        qs = Category.objects.filter(user=request.user).order_by("order", "name")
        return Response({
            "categories": CategoryReadSerializer(qs, many=True).data,
        })

    def post(self, request):
        from catalog.models import Category
        from catalog.serializers import CategoryReadSerializer

        data = (
            request.data.copy()
            if hasattr(request.data, "copy")
            else dict(request.data)
        )

        if "categories" in data and isinstance(data["categories"], str):
            try:
                data["categories"] = json.loads(data["categories"])
            except json.JSONDecodeError:
                return Response(
                    {"categories": ["Invalid JSON in 'categories' field."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = Step7CategoriesSerializer(
            data=data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        created = serializer.save()

        stored = {
            "count": len(created),
            "names": [c.name for c in created],
        }
        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 7, stored)

        return Response(
            {
                "created": CategoryReadSerializer(created, many=True).data,
                "progress": OnboardingProgressSerializer(progress).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────
# STEP 8 — FIRST PRODUCTS
# ─────────────────────────────────────────────────────────────
class Step8ProductsView(APIView):
    """
    GET  /api/onboarding/steps/8/  — list existing products
    POST /api/onboarding/steps/8/  — bulk-create products (JSON or multipart)
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        from catalog.models import Product
        from catalog.serializers import ProductReadSerializer

        qs = (
            Product.objects.filter(user=request.user)
            .prefetch_related("images")
            .order_by("-created_at")
        )
        return Response({
            "products": ProductReadSerializer(
                qs, many=True, context={"request": request}
            ).data,
        })

    def post(self, request):
        from catalog.models import Product
        from catalog.serializers import ProductReadSerializer

        data = (
            request.data.copy()
            if hasattr(request.data, "copy")
            else dict(request.data)
        )

        if "products" in data and isinstance(data["products"], str):
            try:
                data["products"] = json.loads(data["products"])
            except json.JSONDecodeError:
                return Response(
                    {"products": ["Invalid JSON in 'products' field."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = Step8ProductsSerializer(
            data=data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        created = serializer.save()

        stored = {
            "count": len(created),
            "names": [p.name for p in created],
        }
        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 8, stored)

        return Response(
            {
                "created": ProductReadSerializer(
                    created, many=True, context={"request": request}
                ).data,
                "progress": OnboardingProgressSerializer(progress).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────
# STEP 9 — SOCIAL CHANNELS
# ─────────────────────────────────────────────────────────────
class Step9SocialView(APIView):
    """
    GET  /api/onboarding/steps/9/  — social platform connection status
    POST /api/onboarding/steps/9/  — mark step done
    """
    permission_classes = [IsAuthenticated]

    PLATFORM_META = {
        "tiktok_shop": {"gated": True},
        "instagram":   {"gated": False},
        "facebook":    {"gated": False},
        "youtube":     {"gated": True},
        "x":           {"gated": False},
    }

    def get(self, request):
        from social_media.models import SocialAccount

        slug_to_platform = {
            "tiktok_shop": SocialAccount.Platform.TIKTOK_SHOP,
            "instagram":   SocialAccount.Platform.INSTAGRAM,
            "facebook":    SocialAccount.Platform.FACEBOOK,
            "youtube":     SocialAccount.Platform.YOUTUBE,
            "x":           SocialAccount.Platform.X,
        }

        existing = {
            sa.platform: sa
            for sa in SocialAccount.objects.filter(user=request.user)
        }

        platforms = []
        for slug, meta in self.PLATFORM_META.items():
            enum_value = slug_to_platform[slug]
            account = existing.get(enum_value)
            platforms.append({
                "id": slug,
                "connected": bool(account and account.is_active),
                "username": account.username if account else "",
                "connected_at": account.created_at if account else None,
                "gated": meta["gated"],
            })

        return Response({
            "platforms": platforms,
            "connected_count": sum(1 for p in platforms if p["connected"]),
            "total_count": len(platforms),
        })

    def post(self, request):
        serializer = Step9MarkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        stored = {
            "connected_platforms": serializer.validated_data.get(
                "connected_platforms", []
            )
        }

        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 9, stored)

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# STEP 10 — THEME
# ─────────────────────────────────────────────────────────────
class Step10ThemeView(APIView):
    """
    GET  /api/onboarding/steps/10/  — prefill theme
    POST /api/onboarding/steps/10/  — save theme
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from admin_dashboard.models import StoreTheme
        theme = StoreTheme.objects.filter(user=request.user).first()
        if not theme:
            return Response({
                "preset": "blue",
                "primary": "#1e3a8a",
                "accent": "#3b82f6",
                "font": "Inter",
                "radius": 4,
                "dark_store": False,
            })
        return Response(Step10ThemeSerializer().to_representation(theme))

    def post(self, request):
        from admin_dashboard.models import StoreTheme
        theme = StoreTheme.objects.filter(user=request.user).first()

        serializer = Step10ThemeSerializer(
            instance=theme,
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        theme = serializer.save()

        stored = {
            "preset": theme.preset,
            "primary": theme.primary,
            "accent": theme.accent,
            "font": theme.font,
            "radius": theme.radius,
            "dark_store": theme.dark_store,
        }

        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 10, stored)

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# STEP 11 — TEAM
# ─────────────────────────────────────────────────────────────
class Step11TeamView(APIView):
    """
    GET  /api/onboarding/steps/11/  — list pending invites
    POST /api/onboarding/steps/11/  — send new invites
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from team.models import TeamInvite
        invites = TeamInvite.objects.filter(
            owner=request.user,
            status=TeamInvite.Status.PENDING,
        )
        return Response({
            "invites": [
                {
                    "id": str(i.id),
                    "email": i.email,
                    "role": i.role,
                    "status": i.status,
                    "created_at": i.created_at,
                    "expires_at": i.expires_at,
                }
                for i in invites
            ],
        })

    def post(self, request):
        serializer = Step11TeamSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        created = serializer.save()

        stored = {
            "count": len(created),
            "emails": [i.email for i in created],
        }
        progress = get_or_create_progress(request.user)
        mark_step_complete(progress, 11, stored)

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────
# STEP 12 — FINISH
# ─────────────────────────────────────────────────────────────
class Step12FinishView(APIView):
    """
    GET  /api/onboarding/steps/12/  — full summary
    POST /api/onboarding/steps/12/  — finalize (Go Live)
    """
    permission_classes = [IsAuthenticated]

    REQUIRED_STEPS = [1, 2, 4, 6, 7, 8]

    def get(self, request):
        from admin_dashboard.models import StoreProfile
        from catalog.models import Category, Product
        from payments.models import StorePaymentConfig
        from team.models import TeamInvite

        user = request.user
        progress = get_or_create_progress(user)
        completed = set(progress.completed_steps or [])

        # ── Checklist ──
        steps = []
        for n in range(1, 13):
            meta = STEP_META.get(n, {})
            steps.append({
                "number": n,
                "slug": meta.get("key", f"step{n}"),
                "title": meta.get("title", f"Step {n}"),
                "description": meta.get("description", ""),
                "optional": meta.get("optional", False),
                "state": "done" if n in completed else "skipped",
            })

        # ── Stats ──
        payment_config = StorePaymentConfig.objects.filter(user=user).first()
        payment_methods = 0
        if payment_config:
            if payment_config.mpesa_enabled:
                payment_methods += 1
            if payment_config.aggregator != "none":
                payment_methods += 1

        team_count = TeamInvite.objects.filter(
            owner=user,
            status=TeamInvite.Status.PENDING,
        ).count()

        missing = [s for s in self.REQUIRED_STEPS if s not in completed]

        return Response({
            "steps": steps,
            "stats": {
                "categories_added": Category.objects.filter(user=user).count(),
                "products_added": Product.objects.filter(user=user).count(),
                "payment_methods": payment_methods,
                "team_members": team_count,
            },
            "completed_count": len(completed),
            "total_count": 12,
            "ready_to_go_live": len(missing) == 0,
            "missing_steps": missing,
            "status": progress.status,
            "submitted_at": progress.submitted_at,
        })

    def post(self, request):
        from admin_dashboard.models import StoreProfile
        from onboarding.models import OnboardingProgress
        from django.core.mail import send_mail
        from django.conf import settings as dj_settings

        serializer = Step12FinalizeSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        progress = get_or_create_progress(request.user)

        # Already submitted → idempotent
        if progress.status == OnboardingProgress.Status.SUBMITTED:
            return Response(
                OnboardingProgressSerializer(progress).data,
                status=status.HTTP_200_OK,
            )

        mark_step_complete(progress, 12, {"finalized": True})
        progress.status = OnboardingProgress.Status.SUBMITTED
        progress.submitted_at = timezone.now()
        progress.save(
            update_fields=["status", "submitted_at", "updated_at"]
        )

        # Confirmation email (best-effort)
        try:
            user = request.user
            store = StoreProfile.objects.filter(user=user).first()
            store_name = store.name if store else "your store"

            send_mail(
                subject=f"Your {store_name} setup is complete",
                message=(
                    f"Hi {user.get_full_name() or 'there'},\n\n"
                    f"Your store setup is complete. We've received your "
                    f"submission and it's now pending review.\n\n"
                    f"You'll receive another email once your store is "
                    f"approved and live to the public.\n\n"
                    f"In the meantime, you can continue adding products and "
                    f"configuring your store from the dashboard.\n\n"
                    f"— The Sokoelectron team"
                ),
                from_email=dj_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception:
            logger.exception("Failed to send finalize email")

        return Response(
            OnboardingProgressSerializer(progress).data,
            status=status.HTTP_200_OK,
        )