"""
Webhook (Meta → us), handoff endpoints (frontend → us), and the dashboard-side
WhatsApp API surface consumed by `lib/admin-api.ts`.
"""
from __future__ import annotations

import json
import logging
import secrets
from datetime import timedelta, timezone as dt_timezone
from decimal import Decimal, InvalidOperation                          # ── ADDED

import phonenumbers
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# ── ADDED — checkout imports for the two new admin endpoints ─────────
# `checkout.services` imports from `catalog`, `dashboard.inventory`,
# and `authentication.managers` — none of which import `whatsapp`, so
# no circular import at module load.
from checkout import constants as checkout_constants
from checkout.exceptions import CheckoutError, PricingError
from checkout.services import create_order

from .models import (
    WhatsAppAccount,
    WhatsAppCartSession,
    WhatsAppContact,
    WhatsAppConversation,
    WhatsAppMessage,
    WhatsAppTemplate,
)
from .serializers import CartHandoffRequestSerializer, WhatsAppCartSessionSerializer
from .services import (
    MetaAPIError,
    send_template,
    verify_webhook_signature,
)
from .tasks import process_whatsapp_event

logger = logging.getLogger("whatsapp.webhook")


# ═════════════════════════════════════════════════════════════════════════════
# Serialisation helpers — single source of truth for wire shapes
#
# Every helper here returns the *exact* keys declared in lib/admin-types.ts
# so the frontend never hits "Cannot read properties of undefined".
# ═════════════════════════════════════════════════════════════════════════════

def _account_payload(account: WhatsAppAccount | None) -> dict:
    """Shape: AdminWhatsAppAccount"""
    if account is None:
        return {
            "id": None,
            "isActive": False,
            "displayPhone": "",
            "displayName": "",
            "businessName": "",
            "phoneNumberId": "",
            "wabaId": "",
            "businessId": "",
            "qualityScore": "UNKNOWN",
            "messagingLimit": "—",
            "verificationStatus": "NOT_VERIFIED",
            "tokenDaysLeft": None,
            "tokenExpiresAt": None,
            "lastSyncedAt": None,
        }

    token_expires_at = getattr(account, "token_expires_at", None)
    token_days_left = None
    if token_expires_at:
        delta = token_expires_at - timezone.now()
        token_days_left = max(0, delta.days)

    return {
        "id": account.pk,
        "isActive": account.is_active,
        "displayPhone": getattr(account, "display_phone", "") or "",
        "displayName": getattr(account, "business_name", "") or "",
        "businessName": getattr(account, "business_name", "") or "",
        "phoneNumberId": getattr(account, "phone_number_id", "") or "",
        "wabaId": getattr(account, "waba_id", "") or "",
        "businessId": getattr(account, "waba_id", "") or "",
        "qualityScore": getattr(account, "quality_score", "UNKNOWN") or "UNKNOWN",
        "messagingLimit": getattr(account, "messaging_limit", "—") or "—",
        "verificationStatus": getattr(account, "verification_status", "NOT_VERIFIED") or "NOT_VERIFIED",
        "tokenDaysLeft": token_days_left,
        "tokenExpiresAt": token_expires_at.isoformat() if token_expires_at else None,
        "lastSyncedAt": (
            account.updated_at.isoformat()
            if getattr(account, "updated_at", None) else None
        ),
    }


def _contact_payload(c: WhatsAppContact) -> dict:
    """
    Shape: AdminWhatsAppContact

    `userId` is null for walk-in contacts that have never signed up —
    which is most of them in the Kenyan social-commerce case. The
    admin inbox uses this to decide whether to offer "Convert to
    order" (creates a guest order) or "Link to account" (rare).

    Reading `c.user_id` directly is a column read, not a query — no
    `select_related("user")` needed anywhere this is called.
    """
    return {
        "id": c.pk,
        "waId": c.wa_id,
        "profileName": c.profile_name or None,
        "userId": c.user_id,
        "tags": list(c.tags or []),
        "notes": c.notes or "",
        "optInStatus": c.opt_in_status,
        "lastInboundAt": (
            c.last_inbound_at.isoformat() if c.last_inbound_at else None
        ),
        "isVerified": c.is_verified,
    }


def _message_payload(m: WhatsAppMessage) -> dict:
    """Shape: AdminWhatsAppMessage"""
    return {
        "id": m.pk,
        "waMessageId": m.wa_message_id or "",
        "direction": m.direction,       # 'IN' | 'OUT'
        "type": m.type,                 # 'TEXT' | 'IMAGE' | ...
        "body": m.body or "",
        "status": m.status,             # 'SENT' | 'DELIVERED' | 'READ' | ...
        "errorMessage": m.error_message or "",
        "timestamp": m.timestamp.isoformat() if m.timestamp else None,
    }


def _conversation_payload(c: WhatsAppConversation, *, with_messages: bool = False) -> dict:
    """Shape: AdminWhatsAppConversation / AdminWhatsAppConversationDetail"""
    last_msg = c.messages.order_by("-timestamp").first()
    payload = {
        "id": c.pk,
        "contact": _contact_payload(c.contact),
        "status": c.status,
        "assignedTo": getattr(c, "assigned_to_id", None),
        "assignedToName": (
            str(c.assigned_to) if getattr(c, "assigned_to", None) else None
        ),
        "lastMessagePreview": (last_msg.body if last_msg else "") or "",
        "lastMessageAt": (
            c.last_message_at.isoformat() if c.last_message_at else None
        ),
        "createdAt": c.created_at.isoformat() if c.created_at else None,
    }

    if with_messages:
        payload["messages"] = [
            _message_payload(m) for m in c.messages.order_by("timestamp")
        ]
        last_inbound = c.messages.filter(direction="IN").order_by("-timestamp").first()
        payload["windowOpen"] = bool(
            last_inbound
            and last_inbound.timestamp
            and (timezone.now() - last_inbound.timestamp) < timedelta(hours=24)
        )
        payload["notes"] = c.contact.notes or ""

    return payload


def _template_payload(t: WhatsAppTemplate) -> dict:
    """Shape: AdminWhatsAppTemplate"""
    return {
        "id": t.pk,
        "name": t.name,
        "language": t.language,
        "category": t.category,
        "status": t.status,
        "quality": t.quality or "UNKNOWN",
        "components": t.components or [],
        "metaTemplateId": t.meta_template_id or "",
        "lastSyncedAt": t.last_synced_at.isoformat() if t.last_synced_at else None,
        "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
    }


# ═════════════════════════════════════════════════════════════════════════════
# Meta webhook
# ═════════════════════════════════════════════════════════════════════════════

@csrf_exempt
@require_GET
def verify_webhook(request):
    mode = request.GET.get("hub.mode")
    token = request.GET.get("hub.verify_token")
    challenge = request.GET.get("hub.challenge", "")

    if mode != "subscribe":
        return HttpResponse("bad request", status=400)

    try:
        candidates = set(
            WhatsAppAccount.objects.filter(is_active=True)
            .exclude(verify_token__isnull=True)
            .exclude(verify_token="")
            .values_list("verify_token", flat=True)
        )
    except Exception:
        candidates = set()

    if getattr(settings, "WHATSAPP_VERIFY_TOKEN", None):
        candidates.add(settings.WHATSAPP_VERIFY_TOKEN)

    if token in candidates and token:
        return HttpResponse(challenge, content_type="text/plain")
    return HttpResponse("forbidden", status=403)


@csrf_exempt
@require_POST
def receive_webhook(request):
    raw = request.body
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not verify_webhook_signature(raw, signature):
        logger.warning("Rejected webhook with invalid signature")
        return HttpResponse("forbidden", status=403)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return HttpResponse("bad json", status=400)

    process_whatsapp_event.delay(data)
    return JsonResponse({"received": True})


# ═════════════════════════════════════════════════════════════════════════════
# Cart handoff
# ═════════════════════════════════════════════════════════════════════════════

class CartHandoffView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "whatsapp_cart_handoff"

    def post(self, request):
        if not settings.WHATSAPP_ENABLED:
            return Response(
                {"status": "disabled", "message": "WhatsApp is not enabled."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        ser = CartHandoffRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        payload = ser.validated_data

        contact = WhatsAppContact.objects.filter(
            user=request.user, is_verified=True
        ).first()
        if not contact:
            return Response(
                {
                    "status": "unverified",
                    "message": "Verify your WhatsApp number before ordering via WhatsApp.",
                },
                status=status.HTTP_409_CONFLICT,
            )

        ttl = timedelta(hours=settings.WHATSAPP_CART_TOKEN_TTL_HOURS)
        session = WhatsAppCartSession.objects.create(
            user=request.user,
            contact=contact,
            cart_snapshot={"items": payload["items"]},
            delivery_method=payload["delivery"],
            coupon_code=payload.get("coupon", ""),
            notes=payload.get("notes", ""),
            expires_at=timezone.now() + ttl,
        )

        checkout_url = (
            f"{settings.WHATSAPP_CART_CHECKOUT_URL.rstrip('/')}/{session.token}"
        )

        template_name = settings.WHATSAPP_TEMPLATES["CART_RECOVERY"]
        first_name = (request.user.get_full_name() or request.user.username).split()[0]

        try:
            resp = send_template(
                to=contact.wa_id,
                template_name=template_name,
                body_params=[first_name],
                button_url_param=str(session.token),
            )
            wa_message_id = (resp.get("messages") or [{}])[0].get("id", "")
            session.wa_message_id = wa_message_id
            session.status = "SENT"
            session.save(update_fields=["wa_message_id", "status"])
        except MetaAPIError as exc:
            logger.error("Cart handoff send failed: %s", exc)
            session.status = "FAILED"
            session.save(update_fields=["status"])
            return Response(
                {
                    "status": "fallback",
                    "checkout_url": checkout_url,
                    "message": "Could not send WhatsApp message. Opening WhatsApp directly.",
                }
            )

        return Response(
            {
                "status": "sent",
                "session_token": str(session.token),
                "checkout_url": checkout_url,
                "message": "Check WhatsApp — we sent your cart link.",
            }
        )


class CartSessionDetailView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, token):
        try:
            session = WhatsAppCartSession.objects.select_related("contact").get(
                token=token
            )
        except WhatsAppCartSession.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if session.is_expired():
            session.status = "EXPIRED"
            session.save(update_fields=["status"])
            return Response({"detail": "Session expired."}, status=410)

        if session.status in {"SENT", "DELIVERED", "READ"}:
            session.status = "OPENED"
            session.save(update_fields=["status"])

        return Response(WhatsAppCartSessionSerializer(session).data)


# ═════════════════════════════════════════════════════════════════════════════
# OTP
# ═════════════════════════════════════════════════════════════════════════════

class OTPRequestView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "whatsapp_otp"

    def post(self, request):
        from django.core.cache import cache

        phone = (request.data.get("phone") or "").strip()
        if not phone:
            return Response({"detail": "phone required"}, status=400)

        try:
            parsed = phonenumbers.parse(
                phone, settings.WHATSAPP_DEFAULT_TEMPLATE_COUNTRY
            )
            if not phonenumbers.is_valid_number(parsed):
                raise ValueError
            wa_id = f"{parsed.country_code}{parsed.national_number}"
        except Exception:
            return Response({"detail": "Invalid phone number."}, status=400)

        code = f"{secrets.randbelow(10**6):06d}"
        cache.set(f"wa_otp:{wa_id}", code, timeout=settings.WHATSAPP_OTP_TTL_MINUTES * 60)

        try:
            send_template(
                to=wa_id,
                template_name=settings.WHATSAPP_TEMPLATES["VERIFY_NUMBER"],
                body_params=[code],
            )
        except MetaAPIError as exc:
            logger.error("OTP send failed: %s", exc)
            return Response({"detail": "Could not send OTP."}, status=502)

        return Response(
            {
                "status": "sent",
                "expires_in_minutes": settings.WHATSAPP_OTP_TTL_MINUTES,
            }
        )


class OTPConfirmView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "whatsapp_otp"

    def post(self, request):
        from django.core.cache import cache

        phone = (request.data.get("phone") or "").strip()
        code = (request.data.get("code") or "").strip()
        if not phone or not code:
            return Response({"detail": "phone and code required"}, status=400)

        try:
            parsed = phonenumbers.parse(
                phone, settings.WHATSAPP_DEFAULT_TEMPLATE_COUNTRY
            )
            wa_id = f"{parsed.country_code}{parsed.national_number}"
        except Exception:
            return Response({"detail": "Invalid phone number."}, status=400)

        expected = cache.get(f"wa_otp:{wa_id}")
        if not expected or expected != code:
            return Response({"detail": "Invalid or expired code."}, status=400)

        cache.delete(f"wa_otp:{wa_id}")

        contact, _ = WhatsAppContact.objects.get_or_create(wa_id=wa_id)
        if hasattr(contact, "user"):
            contact.user = request.user
        contact.is_verified = True
        contact.save()

        return Response({"status": "verified", "wa_id": wa_id})


# ═════════════════════════════════════════════════════════════════════════════
# Connection — /api/v1/whatsapp/account/*
# ═════════════════════════════════════════════════════════════════════════════

class WhatsAppAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        account = (
            WhatsAppAccount.objects.filter(is_active=True).first()
            or WhatsAppAccount.objects.first()
        )
        return Response(_account_payload(account))

    def put(self, request):
        account = WhatsAppAccount.objects.filter(is_active=True).first()
        if account is None:
            account = WhatsAppAccount()

        field_map = {
            "displayPhone": "display_phone",
            "phoneNumber": "display_phone",
            "businessName": "business_name",
            "displayName": "business_name",
            "phoneNumberId": "phone_number_id",
            "wabaId": "waba_id",
            "businessId": "waba_id",
            "verifyToken": "verify_token",
        }
        for key, attr in field_map.items():
            if key in request.data and hasattr(account, attr):
                setattr(account, attr, request.data[key])
        account.is_active = True
        account.save()
        return Response(_account_payload(account))


class WhatsAppAccountSetActiveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        target = bool(request.data.get("isActive"))
        WhatsAppAccount.objects.update(is_active=False)
        account = WhatsAppAccount.objects.first()
        if account:
            account.is_active = target
            account.save(update_fields=["is_active"])
        return Response(_account_payload(account))


class WhatsAppAccountRefreshView(APIView):
    """Stub — pull live account info from Meta when wired."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        account = WhatsAppAccount.objects.filter(is_active=True).first()
        return Response(_account_payload(account))


class WhatsAppAccountProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        account = WhatsAppAccount.objects.filter(is_active=True).first()
        if not account:
            return Response({"detail": "No active account."}, status=404)

        field_map = {
            "displayName": "business_name",
            "businessName": "business_name",
            "phoneNumber": "display_phone",
            "displayPhone": "display_phone",
            "phoneNumberId": "phone_number_id",
            "wabaId": "waba_id",
        }
        for key, attr in field_map.items():
            if key in request.data and hasattr(account, attr):
                setattr(account, attr, request.data[key])
        account.save()
        return Response(_account_payload(account))


# ═════════════════════════════════════════════════════════════════════════════
# Inbox — conversations, messages, poll
# ═════════════════════════════════════════════════════════════════════════════

class ConversationListView(APIView):
    """GET /api/v1/whatsapp/conversations/ → AdminWhatsAppConversation[] (bare array)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            WhatsAppConversation.objects
            .select_related("contact")
            .order_by("-last_message_at", "-created_at")
        )

        search = request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(contact__wa_id__icontains=search)
                | Q(contact__profile_name__icontains=search)
            )

        tab = (request.query_params.get("tab") or "").lower()
        if tab == "unassigned":
            qs = qs.filter(assigned_to__isnull=True)
        elif tab == "mine":
            qs = qs.filter(assigned_to=request.user)
        elif tab == "open":
            qs = qs.filter(status="OPEN")
        elif tab == "resolved":
            qs = qs.filter(status="RESOLVED")

        return Response([_conversation_payload(c) for c in qs[:200]])


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            c = (
                WhatsAppConversation.objects
                .select_related("contact")
                .get(pk=pk)
            )
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        return Response(_conversation_payload(c, with_messages=True))


class ConversationMessageView(APIView):
    """
    POST — send a free-form (non-template) message.

    Free-form messages are only allowed within the 24-hour customer
    service window — Meta rejects anything outside it with error
    code 131026, and a silent failure here is worse than a loud one.
    So the window is checked BEFORE we touch the network.

    The actual `send_text` call is still a TODO — the `services`
    module exports `send_template` only. When `send_text` lands:

        from .services import send_text
        resp = send_text(to=contact.wa_id, body=body)
        msg.wa_message_id = (resp.get("messages") or [{}])[0].get("id", "")
        msg.status = "SENT"

    Until then, the row is persisted with status="QUEUED" so the
    admin sees their message in the thread (and knows it has not
    actually been delivered). Never status="SENT" on a stub — that
    lies to the sender.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = WhatsAppConversation.objects.select_related("contact").get(pk=pk)
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        body = (request.data.get("body") or "").strip()
        if not body:
            return Response({"detail": "body required"}, status=400)

        # 24-hour service window — Meta rejects free-form outside it.
        if not c.is_within_service_window():
            return Response(
                {
                    "code": "window_closed",
                    "detail": (
                        "The 24-hour customer service window is closed. "
                        "Send an approved template instead."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # TODO: call send_text once the service exposes it. See the
        # docstring above for the exact lines to add.
        msg = WhatsAppMessage.objects.create(
            conversation=c,
            direction="OUT",
            type="text",
            body=body,
            status="QUEUED",
        )
        c.last_message_at = msg.timestamp
        c.save(update_fields=["last_message_at"])

        return Response(_message_payload(msg), status=201)


class ConversationSendTemplateView(APIView):
    """
    POST — send an approved template.

    Templates are the ONLY way to reach a customer outside the 24-hour
    window, and the only way to *open* a conversation proactively.

    The template name must exist as an APPROVED row on `WhatsAppTemplate`
    (Meta will reject anything else with 132001). We do not check the
    status here — Meta is the authority, and surfacing its rejection
    verbatim is more useful than a generic "template not approved".
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = WhatsAppConversation.objects.select_related("contact").get(pk=pk)
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        template_name = request.data.get("templateName") or ""
        if not template_name:
            return Response({"detail": "templateName required"}, status=400)

        body_params = request.data.get("bodyParams") or []
        button_url_param = request.data.get("buttonUrlParam")

        try:
            resp = send_template(
                to=c.contact.wa_id,
                template_name=template_name,
                body_params=list(body_params),
                button_url_param=button_url_param,
            )
        except MetaAPIError as exc:
            logger.error("Template send failed (conv %s): %s", c.pk, exc)
            msg = WhatsAppMessage.objects.create(
                conversation=c,
                direction="OUT",
                type="template",
                body=template_name,
                status="FAILED",
                error_message=str(exc)[:500],
            )
            return Response(
                {"detail": str(exc), "code": "meta_error"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        wa_message_id = (resp.get("messages") or [{}])[0].get("id", "")
        msg = WhatsAppMessage.objects.create(
            conversation=c,
            direction="OUT",
            type="template",
            body=template_name,
            wa_message_id=wa_message_id or None,
            status="SENT",
            payload=resp or {},
        )
        c.last_message_at = msg.timestamp
        c.save(update_fields=["last_message_at"])

        return Response(_message_payload(msg), status=201)


class ConversationCreateOrderView(APIView):
    """
    POST /api/v1/whatsapp/conversations/<pk>/create-order/

    Seller converts a chat into an order. MINIMAL payload — the seller
    provides items and payment method; the address defaults to a
    placeholder and the seller updates it on the order detail page once
    the customer shares a real address in the chat.

    Body:
        {
          "items": [
            { "product_id": "KB-ERG-01", "name": "Keyboard", "qty": 1,
              "price": "6999", "image": "https://..." },
            ...
          ],
          "paymentMethod": "MPESA" | "COD"   (default: "COD"),
          "note": "optional free text"
        }

    Response (201):
        {
          "order_reference": "ORD-20261004-ABCD1234",
          "status": "confirmed",
          "payment_status": "unpaid",
          "total": "8118.84",
          "checkout_url": "/pages/order-success/ORD-..."
        }

    The order is created with:
        source="whatsapp"
        channel_meta={
          "whatsapp_conversation_id": <pk>,
          "whatsapp_contact_wa_id": "<wa_id>",
          "origin": "tiktok_dm",
          "tiktok_handle": "@..." (when present in contact tags)
        }
        user=contact.user (may be None — the walk-in case)

    Idempotency: prefers `Idempotency-Key` header; falls back to a
    conversation-scoped key valid for one second — enough to stop a
    double-click but not enough to dedupe a deliberate retry.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            conv = WhatsAppConversation.objects.select_related(
                "contact", "contact__user",
            ).get(pk=pk)
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        contact = conv.contact

        # ── Line items ────────────────────────────────────────────
        raw_items = request.data.get("items") or []
        if not raw_items:
            return Response(
                {"detail": "items required", "code": "items_required"},
                status=400,
            )

        line_items = []
        subtotal = Decimal("0")
        for idx, raw in enumerate(raw_items):
            try:
                qty = int(raw.get("qty") or raw.get("quantity") or 1)
                price = Decimal(str(raw.get("price") or 0))
            except (TypeError, ValueError, InvalidOperation):
                return Response(
                    {"detail": f"bad item shape at index {idx}",
                     "code": "bad_item"},
                    status=400,
                )
            if qty < 1:
                return Response(
                    {"detail": f"qty must be >= 1 at index {idx}"},
                    status=400,
                )
            if price < 0:
                return Response(
                    {"detail": f"price must be >= 0 at index {idx}"},
                    status=400,
                )

            line_items.append({
                "productId": str(raw.get("product_id") or raw.get("productId") or ""),
                "name": str(raw.get("name") or "Item")[:255],
                "brand": str(raw.get("brand") or "")[:120],
                "price": str(price),
                "quantity": qty,
                "image": str(raw.get("image") or "")[:500],
            })
            subtotal += price * qty
        subtotal = subtotal.quantize(Decimal("0.01"))

        # ── Payment method ────────────────────────────────────────
        payment_method = (request.data.get("paymentMethod") or "COD").upper()
        if payment_method in {"MPESA", "M-PESA"}:
            payment_method = "MPESA"
        elif payment_method in {"COD", "CASH ON DELIVERY", "CASH_ON_DELIVERY"}:
            payment_method = "COD"
        else:
            return Response(
                {"detail": "paymentMethod must be MPESA or COD"},
                status=400,
            )

        # ── Totals (must match server recompute) ──────────────────
        # Default delivery is `pickup`, which the shipping rules in
        # `checkout.services.recompute_totals` treat as always free.
        # No coupon, no discount. Tax uses the same constant the
        # service uses, so the totals we send as a claim validate.
        discount = Decimal("0.00")
        shipping = Decimal("0.00")
        tax = (subtotal * checkout_constants.TAX_RATE).quantize(Decimal("0.01"))
        total = (subtotal - discount + shipping + tax).quantize(Decimal("0.01"))

        # ── Contact details for the order ─────────────────────────
        # `wa_id` is stored without leading '+'. `_persist_order`
        # normalizes `contact_phone` anyway, so passing the raw form
        # is safe.
        phone = contact.wa_id

        if contact.user_id and getattr(contact.user, "email", ""):
            email = contact.user.email
        else:
            email = f"wa-{contact.wa_id}@placeholder.local"

        full_name = contact.profile_name or "WhatsApp Customer"

        # ── Attribution ───────────────────────────────────────────
        # Default origin is tiktok_dm since the admin inbox is where
        # most seller-initiated orders start. If the contact's tags
        # include a TikTok handle, expose it in channel_meta so the
        # admin order page can render the @handle next to the order.
        tags = list(contact.tags or [])
        tiktok_handle = next(
            (t for t in tags if isinstance(t, str) and t.startswith("@")),
            "",
        )

        note = (request.data.get("note") or "").strip()

        checkout_payload = {
            "email": email,
            "phone": phone,
            "full_name": full_name,
            "address": {
                "street": "Collection arranged via WhatsApp",
                "town": "—",
                "county": "—",
                "postal_code": "",
            },
            "delivery_method": "pickup",
            "estimated_delivery": "",
            "coupon": "",
            "notes": note,
            "items": line_items,
            "totals": {
                "subtotal": str(subtotal),
                "discount": str(discount),
                "shipping": str(shipping),
                "tax": str(tax),
                "total": str(total),
            },
            "source": "whatsapp",
            "channel_meta": {
                "whatsapp_conversation_id": conv.pk,
                "whatsapp_contact_wa_id": contact.wa_id,
                "origin": "tiktok_dm",
                "tiktok_handle": tiktok_handle,
            },
        }

        # ── Idempotency ───────────────────────────────────────────
        # Header takes precedence (frontend can send a stable UUID per
        # click). Fallback is scoped to the conversation and the
        # current second — enough to stop a double-click but not
        # enough to dedupe a deliberate retry minutes later.
        idempotency_key = (
            request.headers.get("Idempotency-Key")
            or f"wa-conv-{conv.pk}-{int(timezone.now().timestamp())}"
        )[:64]

        try:
            order = create_order(
                checkout_payload=checkout_payload,
                payment_method=payment_method,
                user=contact.user if contact.user_id else None,
                idempotency_key=idempotency_key,
            )
        except PricingError as exc:
            logger.exception("Create-order price mismatch for conv %s", conv.pk)
            return Response(
                {"detail": str(exc), "code": "pricing_mismatch"},
                status=400,
            )
        except CheckoutError as exc:
            logger.exception("Create-order failed for conv %s", conv.pk)
            return Response(
                {"detail": str(exc), "code": "checkout_error"},
                status=400,
            )
        except Exception:
            logger.exception(
                "Unexpected create-order failure for conv %s", conv.pk,
            )
            return Response(
                {"detail": "Could not create order."},
                status=500,
            )

        # ── Local-only timeline note ──────────────────────────────
        # Not sent to Meta — just a marker in the thread so the seller
        # sees what happened when they scroll back. Same pattern as
        # `ConversationMessageView`'s "QUEUED" status convention: this
        # row is a UI breadcrumb, not a delivered message.
        WhatsAppMessage.objects.create(
            conversation=conv,
            direction="OUT",
            type="text",
            body=f"Order {order.reference} created.",
            status="SENT",
        )
        conv.last_message_at = timezone.now()
        conv.save(update_fields=["last_message_at"])

        return Response(
            {
                "order_reference": order.reference,
                "status": order.status,
                "payment_status": order.payment_status,
                "total": str(order.total),
                "checkout_url": f"/pages/order-success/{order.reference}",
            },
            status=201,
        )


class ConversationSendCheckoutLinkView(APIView):
    """
    POST /api/v1/whatsapp/conversations/<pk>/send-checkout-link/

    Creates a `WhatsAppCartSession` for the contact and sends the
    CART_RECOVERY template with a checkout URL.

    Unlike `CartHandoffView`, this does NOT require the contact to
    have a User account — it is the admin-initiated case for walk-in
    customers, which is the majority in the Kenyan social-commerce
    case. The `user` field on the session is left NULL.

    Body (all optional):
        {
          "items": [ {"product_id": "...", "quantity": 1}, ... ],
          "delivery": "standard" | "express" | "pickup",   (default: "standard"),
          "note": "free text"
        }

    Response (200):
        {
          "status": "sent",
          "session_token": "<uuid>",
          "checkout_url": "https://.../checkout/whatsapp/<uuid>"
        }

    Errors:
      404  — conversation not found
      503  — WhatsApp is disabled
      502  — Meta rejected the send (surfaced verbatim)
    """
    permission_classes = [IsAuthenticated]
    throttle_scope = "whatsapp_cart_handoff"

    def post(self, request, pk):
        if not settings.WHATSAPP_ENABLED:
            return Response(
                {"status": "disabled", "message": "WhatsApp is not enabled."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            conv = WhatsAppConversation.objects.select_related(
                "contact", "contact__user",
            ).get(pk=pk)
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        contact = conv.contact
        raw_items = request.data.get("items") or []

        # Normalize items into the cart_snapshot shape. No schema
        # enforcement — the snapshot is a preview, not a source of
        # truth. The checkout page reads live inventory when the
        # customer lands on it.
        items = []
        for raw in raw_items:
            pid = str(
                raw.get("product_id") or raw.get("productId") or ""
            ).strip()
            if not pid:
                continue
            try:
                qty = int(raw.get("quantity") or raw.get("qty") or 1)
            except (TypeError, ValueError):
                qty = 1
            items.append({"product_id": pid, "quantity": max(1, qty)})

        delivery = (request.data.get("delivery") or "standard").lower()
        if delivery not in {"standard", "express", "pickup"}:
            delivery = "standard"

        note = (request.data.get("note") or "").strip()

        ttl = timedelta(
            hours=getattr(settings, "WHATSAPP_CART_TOKEN_TTL_HOURS", 24),
        )

        session = WhatsAppCartSession.objects.create(
            user=contact.user if contact.user_id else None,
            contact=contact,
            cart_snapshot={"items": items},
            delivery_method=delivery,
            notes=note,
            expires_at=timezone.now() + ttl,
        )

        checkout_url = (
            f"{settings.WHATSAPP_CART_CHECKOUT_URL.rstrip('/')}/{session.token}"
        )

        template_name = settings.WHATSAPP_TEMPLATES["CART_RECOVERY"]
        first_name = (contact.profile_name or "there").split()[0]

        try:
            resp = send_template(
                to=contact.wa_id,
                template_name=template_name,
                body_params=[first_name],
                button_url_param=str(session.token),
            )
        except MetaAPIError as exc:
            logger.error(
                "Send checkout link failed (conv %s): %s", conv.pk, exc,
            )
            session.status = "FAILED"
            session.save(update_fields=["status"])
            return Response(
                {"detail": str(exc), "code": "meta_error"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        wa_message_id = (resp.get("messages") or [{}])[0].get("id", "")
        session.wa_message_id = wa_message_id
        session.status = "SENT"
        session.save(update_fields=["wa_message_id", "status"])

        WhatsAppMessage.objects.create(
            conversation=conv,
            direction="OUT",
            type="template",
            body=template_name,
            wa_message_id=wa_message_id or None,
            status="SENT",
            payload=resp or {},
        )
        conv.last_message_at = timezone.now()
        conv.save(update_fields=["last_message_at"])

        return Response(
            {
                "status": "sent",
                "session_token": str(session.token),
                "checkout_url": checkout_url,
                "message": "Checkout link sent.",
            }
        )


class ConversationAssignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = WhatsAppConversation.objects.select_related("contact").get(pk=pk)
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        # TODO: wire assignee if your model has `assigned_to`
        return Response(_conversation_payload(c))


class ConversationResolveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = WhatsAppConversation.objects.select_related("contact").get(pk=pk)
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        c.status = "RESOLVED"
        c.save(update_fields=["status"])
        return Response(_conversation_payload(c))


class ConversationReopenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = WhatsAppConversation.objects.select_related("contact").get(pk=pk)
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        c.status = "OPEN"
        c.save(update_fields=["status"])
        return Response(_conversation_payload(c))


class ConversationTagView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = WhatsAppConversation.objects.select_related("contact").get(pk=pk)
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        tags = request.data.get("tags") or []
        c.contact.tags = list(tags)
        c.contact.save()
        return Response(_conversation_payload(c))


class ConversationNoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = WhatsAppConversation.objects.select_related("contact").get(pk=pk)
        except WhatsAppConversation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        # TODO: dedicated notes model. For now append to contact.notes.
        text = (request.data.get("note") or request.data.get("text") or "").strip()
        if text:
            c.contact.notes = (c.contact.notes or "") + ("\n" if c.contact.notes else "") + text
            c.contact.save()
        return Response(_conversation_payload(c), status=201)


class MessagePollView(APIView):
    """
    GET /api/v1/whatsapp/messages/poll/?since=<ISO8601>

    Returns AdminWhatsAppMessage[] (bare array). Real query now that
    WhatsAppMessage exists.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        since_raw = (request.query_params.get("since") or "").strip()
        since = parse_datetime(since_raw) if since_raw else None
        if since is not None and since.tzinfo is None:
            since = since.replace(tzinfo=dt_timezone.utc)

        qs = WhatsAppMessage.objects.order_by("timestamp")
        if since:
            qs = qs.filter(timestamp__gt=since)

        return Response([_message_payload(m) for m in qs[:500]])


# ═════════════════════════════════════════════════════════════════════════════
# Templates
# ═════════════════════════════════════════════════════════════════════════════

class TemplateListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = WhatsAppTemplate.objects.all().order_by("-updated_at")
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        return Response([_template_payload(t) for t in qs[:500]])

    def post(self, request):
        payload = request.data or {}
        t = WhatsAppTemplate.objects.create(
            name=payload.get("name", ""),
            language=payload.get("language", "en"),
            category=payload.get("category", "UTILITY"),
            status="DRAFT",
            components=payload.get("components", []),
        )
        return Response(_template_payload(t), status=201)


class TemplateDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return WhatsAppTemplate.objects.get(pk=pk)
        except WhatsAppTemplate.DoesNotExist:
            return None

    def get(self, request, pk):
        t = self._get(pk)
        if not t:
            return Response({"detail": "Not found."}, status=404)
        return Response(_template_payload(t))

    def patch(self, request, pk):
        t = self._get(pk)
        if not t:
            return Response({"detail": "Not found."}, status=404)
        for field in ("name", "language", "category", "components"):
            if field in request.data:
                setattr(t, field, request.data[field])
        t.save()
        return Response(_template_payload(t))

    def delete(self, request, pk):
        t = self._get(pk)
        if t:
            t.delete()
        return Response(status=204)


class TemplateSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            t = WhatsAppTemplate.objects.get(pk=pk)
        except WhatsAppTemplate.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        # TODO: push to Meta and read back meta_template_id.
        t.status = "PENDING"
        t.last_synced_at = timezone.now()
        t.save(update_fields=["status", "last_synced_at"])
        return Response(_template_payload(t))


class TemplateSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # TODO: pull from Meta. Frontend reads `added` and `updated`.
        return Response({"added": 0, "updated": 0, "removed": 0})


# ═════════════════════════════════════════════════════════════════════════════
# Automations — stubs (no model yet)
# ═════════════════════════════════════════════════════════════════════════════

def _automation_stub(**overrides) -> dict:
    base = {
        "id": 0,
        "name": "",
        "trigger": "",
        "templateId": None,
        "templateName": "",
        "delayMinutes": 0,
        "recipients": "CUSTOMER",
        "conditions": "",
        "status": "DRAFT",
        "messagesSent": 0,
        "lastTriggered": None,
    }
    base.update(overrides)
    return base


class AutomationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([])

    def post(self, request):
        payload = request.data or {}
        return Response(_automation_stub(id=0, **{
            k: payload[k] for k in
            ("name", "trigger", "templateId", "templateName",
             "delayMinutes", "recipients", "conditions")
            if k in payload
        }), status=201)


class AutomationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        return Response(_automation_stub(id=pk))

    def patch(self, request, pk):
        return Response(_automation_stub(id=pk, **request.data))

    def delete(self, request, pk):
        return Response(status=204)


class AutomationToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        return Response(_automation_stub(id=pk, status="ACTIVE"))


# ═════════════════════════════════════════════════════════════════════════════
# Broadcasts — stubs (no model yet)
# ═════════════════════════════════════════════════════════════════════════════

def _broadcast_stub(**overrides) -> dict:
    base = {
        "id": 0,
        "campaignName": "",
        "templateName": "",
        "recipients": 0,
        "delivered": 0,
        "read": 0,
        "replied": 0,
        "sentAt": None,
        "scheduledAt": None,
        "status": "DRAFT",
    }
    base.update(overrides)
    return base


class BroadcastListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([])

    def post(self, request):
        payload = request.data or {}
        return Response(_broadcast_stub(
            campaignName=payload.get("campaignName", ""),
            templateName=payload.get("templateName", ""),
            scheduledAt=payload.get("scheduledAt"),
        ), status=201)


class BroadcastDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        return Response(_broadcast_stub(id=pk))

    def patch(self, request, pk):
        return Response(_broadcast_stub(id=pk, **request.data))

    def delete(self, request, pk):
        return Response(status=204)


class BroadcastSendView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        return Response(_broadcast_stub(
            id=pk, status="SENDING", sentAt=timezone.now().isoformat(),
        ))


class BroadcastPauseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        return Response(_broadcast_stub(id=pk, status="PAUSED"))


class BroadcastStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        return Response({
            "recipients": 0, "sent": 0, "delivered": 0,
            "read": 0, "replied": 0, "failed": 0,
        })


# ═════════════════════════════════════════════════════════════════════════════
# Contacts
# ═════════════════════════════════════════════════════════════════════════════

class ContactListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = WhatsAppContact.objects.all().order_by("-last_inbound_at", "-created_at")
        search = request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(wa_id__icontains=search) | Q(profile_name__icontains=search)
            )
        return Response([_contact_payload(c) for c in qs[:200]])


class ContactDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        try:
            return WhatsAppContact.objects.get(pk=pk)
        except WhatsAppContact.DoesNotExist:
            return None

    def get(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        return Response(_contact_payload(c))

    def patch(self, request, pk):
        c = self._get(pk)
        if not c:
            return Response({"detail": "Not found."}, status=404)
        field_map = {
            "profileName": "profile_name",
            "notes": "notes",
            "optInStatus": "opt_in_status",
            "tags": "tags",
        }
        for key, attr in field_map.items():
            if key in request.data and hasattr(c, attr):
                setattr(c, attr, request.data[key])
        c.save()
        return Response(_contact_payload(c))


class ContactUnsubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            c = WhatsAppContact.objects.get(pk=pk)
        except WhatsAppContact.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        c.opt_in_status = "UNSUBSCRIBED"
        c.save(update_fields=["opt_in_status"])
        return Response(_contact_payload(c))


# ═════════════════════════════════════════════════════════════════════════════
# Analytics + Billing
#
# Shapes are read verbatim by AnalyticsTab / BillingTab. Every key listed
# in admin-types.ts must be present, even if the value is zero/empty.
# ═════════════════════════════════════════════════════════════════════════════

class AnalyticsSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "sent": 0,
            "delivered": 0,
            "read": 0,
            "replied": 0,
            "totalCostKes": "0",
            "deliveryRate": 0.0,
            "readRate": 0.0,
            "responseRate": 0.0,
        })


class AnalyticsSeriesView(APIView):
    """Must return {"days": [...]} — the frontend does `series.days.map(...)`."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"days": []})


class CostBreakdownView(APIView):
    """Must return {"buckets": [{name, value, color}, ...]}."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "buckets": [
                {"name": "Utility",        "value": 0, "color": "#10b981"},
                {"name": "Marketing",      "value": 0, "color": "#3b82f6"},
                {"name": "Authentication", "value": 0, "color": "#f59e0b"},
                {"name": "Service",        "value": 0, "color": "#94a3b8"},
            ],
            "total": 0,
            "currency": "KES",
        })


class BillingSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def _payload(self, request):
        return {
            "month": request.query_params.get("month") or timezone.now().strftime("%Y-%m"),
            "totalKes": "0",
            "utilityKes": "0",
            "marketingKes": "0",
            "authKes": "0",
            "serviceKes": "0",
            "utilityCount": 0,
            "marketingCount": 0,
            "authCount": 0,
            "serviceCount": 0,
            "freeServiceUsed": 0,
            "freeServiceLimit": 1000,
            "lastSyncedAt": timezone.now().isoformat(),
        }

    def get(self, request):
        return Response(self._payload(request))


class BillingRefreshView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({
            "month": timezone.now().strftime("%Y-%m"),
            "totalKes": "0",
            "utilityKes": "0",
            "marketingKes": "0",
            "authKes": "0",
            "serviceKes": "0",
            "utilityCount": 0,
            "marketingCount": 0,
            "authCount": 0,
            "serviceCount": 0,
            "freeServiceUsed": 0,
            "freeServiceLimit": 1000,
            "lastSyncedAt": timezone.now().isoformat(),
        })