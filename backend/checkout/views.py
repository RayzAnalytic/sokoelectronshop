"""
checkout/views.py

Endpoints:

    POST /api/v1/checkout/orders/                     — create order (COD)
    POST /api/v1/checkout/payments/stk-push/          — M-Pesa (creates + pays)
    GET  /api/v1/checkout/payments/<pk>/              — poll
    GET  /api/v1/checkout/payments/by-reference/<ref>/ — success-page fetch
    POST /api/v1/checkout/payments/<pk>/cancel/       — best-effort cancel
    POST /api/v1/checkout/mpesa/callback/             — Safaricom callback
    POST /api/v1/checkout/mpesa/timeout/              — Safaricom timeout
    GET  /api/v1/checkout/config/                     — counties, fees, tax
    GET  /api/v1/checkout/payment-methods/            — enabled methods  ← NEW
    POST /api/v1/checkout/validate-coupon/            — coupon probe

    GET    /api/v1/checkout/cart/                     — read cart
    POST   /api/v1/checkout/cart/items/               — add / increment item
    PATCH  /api/v1/checkout/cart/items/<id>/          — set quantity
    DELETE /api/v1/checkout/cart/items/<id>/          — remove item
    DELETE /api/v1/checkout/cart/                     — clear cart
    POST   /api/v1/checkout/cart/merge/               — fold anonymous cart

    --- Admin transactions ledger (STAFF ONLY) ---
    GET    /api/v1/dashboard/transactions/                — list, filter, search
    GET    /api/v1/dashboard/transactions/summary/        — summary cards
    GET    /api/v1/dashboard/transactions/<pk>/           — detail (drawer)
    GET    /api/v1/dashboard/transactions/export/         — CSV (filtered)
    POST   /api/v1/dashboard/transactions/export/         — CSV (bulk ids)
    POST   /api/v1/dashboard/transactions/<pk>/retry/     — retry failed M-Pesa
    POST   /api/v1/dashboard/transactions/<pk>/reconcile/ — manual reconcile

SETTINGS AWARENESS
==================
    The `CheckoutConfigView` and the new `PaymentMethodsView` read from
    the cached settings bundle so the frontend gets a single, coherent
    snapshot of what the shop offers:

      * Which payment methods are enabled    (payments.mpesa_enabled)
      * Whether delivery / pickup is offered (shipping.*)
      * Free-shipping threshold and default fee (shipping.*)
      * VAT rate and mode                    (tax.*)
      * Guest checkout / phone required      (checkout.*)
      * WhatsApp fallback availability       (checkout.whatsapp_fallback)
      * Shop currency                        (general.currency)

    Every read routes through `_settings()` with a fallback to
    `checkout.constants`, so management commands and tests that touch
    these views before the settings tables exist still work.

AUTH MODEL:
    Checkout is open to signed-in customers AND guests — gated by
    `checkout.allow_guest_checkout`. When that setting is off, the
    service layer rejects anonymous submissions before the view
    returns.

    Payment lookup endpoints scope their queryset by caller identity:
      * Signed-in → filter by `order__user=request.user`
      * Guest     → filter by `order__user__isnull=True`

    Safaricom callback and timeout endpoints remain public.

RACE CONDITION NOTE (lazy timeout + cancel):
    Both `PaymentDetailView` (lazy timeout) and `PaymentCancelView` can
    race the M-Pesa callback. Every write path that changes
    Payment.status loads the row with `select_for_update()` inside a
    transaction — including the polling view's lazy-timeout path.
"""

import csv
import logging
from datetime import timedelta
from io import StringIO

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import (
    AllowAny,
    IsAdminUser,
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from . import constants
from .exceptions import (
    CheckoutError,
    CouponError,
    InvalidPhone,
    MpesaError,
    PricingError,
)
from .models import (
    MpesaCallbackLog,
    Order,
    Payment,
    ReconciliationLog,
)
from .mpesa import parse_callback as mpesa_parse_callback
from .serializers import (
    AddCartItemSerializer,
    BulkExportSerializer,
    CartSerializer,
    CouponValidateSerializer,
    MergeCartSerializer,
    OrderCreateResponseSerializer,
    OrderCreateSerializer,
    PaymentSerializer,
    ReconcilePaymentSerializer,
    RetryPaymentSerializer,
    StkPushSerializer,
    TransactionSerializer,
    TransactionSummarySerializer,
    UpdateCartItemQtySerializer,
)
from .services import (
    add_cart_item,
    clear_cart,
    create_order,
    get_cart,
    merge_cart,
    process_checkout,
    reconcile_payment,
    remove_cart_item,
    retry_payment,
    transition_payment,
    update_cart_item_qty,
    validate_coupon,
)

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# Settings helpers — safe during migrations / cold boot
#
# Every settings read goes through `_settings()` which returns the
# cached bundle or None. When None, the caller falls back to
# `checkout.constants`. This keeps the API contract stable while
# letting the live shop reflect Settings changes immediately.
# ═════════════════════════════════════════════════════════════════════════════
def _settings():
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


# ── General ──────────────────────────────────────────────────────────────────
def _currency() -> str:
    s = _settings()
    return s['general'].currency if s else 'KES'


# ── Checkout rules ───────────────────────────────────────────────────────────
def _allow_guest_checkout() -> bool:
    s = _settings()
    return bool(s['checkout'].allow_guest_checkout) if s else True


def _require_phone() -> bool:
    s = _settings()
    return bool(s['checkout'].require_phone) if s else True


def _whatsapp_fallback() -> bool:
    s = _settings()
    return bool(s['checkout'].whatsapp_fallback) if s else True


# ── Payment rules ────────────────────────────────────────────────────────────
def _mpesa_enabled() -> bool:
    s = _settings()
    return bool(s['payments'].mpesa_enabled) if s else True


def _min_amount_kes() -> str:
    s = _settings()
    return str(s['payments'].min_amount_kes) if s else "0"


def _max_amount_kes() -> str:
    s = _settings()
    return str(s['payments'].max_amount_kes) if s else str(constants.MAX_STK_PUSH_AMOUNT)


def _transaction_fee_kes() -> str:
    s = _settings()
    return str(s['payments'].transaction_fee_kes) if s else "0"


# ── Shipping rules ───────────────────────────────────────────────────────────
def _shipping_enabled() -> bool:
    s = _settings()
    return bool(s['shipping'].shipping_enabled) if s else True


def _local_pickup_enabled() -> bool:
    s = _settings()
    return bool(s['shipping'].local_pickup_enabled) if s else True


def _free_shipping_threshold() -> str:
    s = _settings()
    if s:
        return str(s['shipping'].free_shipping_threshold_kes)
    return str(constants.FREE_DELIVERY_THRESHOLD)


def _default_delivery_fee() -> str:
    s = _settings()
    if s:
        return str(s['shipping'].default_delivery_fee_kes)
    return str(constants.DELIVERY_FEES["standard"])


# ── Tax rules ────────────────────────────────────────────────────────────────
def _vat_enabled() -> bool:
    s = _settings()
    return bool(s['tax'].vat_enabled) if s else True


def _vat_rate() -> str:
    s = _settings()
    if s:
        return str(s['tax'].vat_rate)
    return str(constants.TAX_RATE * 100)


def _prices_include_tax() -> bool:
    s = _settings()
    return bool(s['tax'].prices_include_tax) if s else False


# ─────────────────────────────────────────────────────────────────────────────
# Response helpers
# ─────────────────────────────────────────────────────────────────────────────
def _error(message, code="error", http_status=400, extra=None):
    """
    Uniform error envelope.
    """
    body = {"code": code, "detail": message}
    if extra:
        body.update(extra)
    return Response(body, status=http_status)


def _idempotency_key_from(request) -> str:
    """
    Prefer the header. Fall back to a body field for API clients that
    can't set headers.
    """
    return (
        request.headers.get("Idempotency-Key")
        or request.data.get("idempotency_key")
        or ""
    ).strip()


def _caller_user(request):
    """
    Return `request.user` if authenticated, else `None`.
    """
    return request.user if request.user.is_authenticated else None


def _scope_payment_to_caller(qs, request):
    """
    Filter a Payment queryset down to what the caller is allowed to see.
    """
    if request.user.is_authenticated:
        return qs.filter(order__user=request.user)
    return qs.filter(order__user__isnull=True)


def _scope_order_to_caller(qs, request):
    """Same as _scope_payment_to_caller, but for Order querysets."""
    if request.user.is_authenticated:
        return qs.filter(user=request.user)
    return qs.filter(user__isnull=True)


def _locked_payment_or_none(payment_id, request):
    """
    Load a Payment with a row lock, scoped to the caller.
    """
    qs = (
        Payment.objects
        .select_for_update()
        .select_related("order")
        .filter(pk=payment_id)
    )
    qs = _scope_payment_to_caller(qs, request)
    return qs.first()


# ═════════════════════════════════════════════════════════════════════════════
# Config — every read-side fact the checkout page needs
# ═════════════════════════════════════════════════════════════════════════════
class CheckoutConfigView(APIView):
    """
    GET /api/v1/checkout/config/

    The frontend fetches this once on mount. Everything the customer-
    facing pages need to render the cart, checkout, and order-success
    views lives here.

    Every value is settings-aware, so the response changes on the next
    request after the shop owner toggles anything in Settings — no
    server restart.

    Response shape (all values as strings unless noted):

      {
        "counties": ["Nairobi", ...],
        "currency": "KES",
        "delivery_fees": {
          "express_guest":  "500",
          "express_member": "0",
          "standard":       "<settings.shipping.default_delivery_fee_kes>",
          "pickup":         "0"
        },
        "your_express_fee": "<computed for this caller>",
        "free_delivery_threshold": "<settings.shipping.free_shipping_threshold_kes>",
        "shipping_enabled":        <bool>,
        "local_pickup_enabled":    <bool>,
        "tax": {
          "enabled":           <bool>,
          "rate":              "<settings.tax.vat_rate>",
          "prices_include_tax": <bool>
        },
        "delivery_days": {...},
        "checkout": {
          "allow_guest_checkout": <bool>,
          "require_phone":        <bool>,
          "whatsapp_fallback":    <bool>,
          "mpesa_enabled":        <bool>,
          "min_amount_kes":       "<settings.payments.min_amount_kes>",
          "max_amount_kes":       "<settings.payments.max_amount_kes>",
          "transaction_fee_kes":  "<settings.payments.transaction_fee_kes>"
        }
      }

    The `checkout` block was added so the frontend can pre-validate its
    own form (mark the phone field required, hide the M-Pesa button,
    disable guest checkout) before the customer hits Submit. Without
    it, every settings change forces a round-trip on submit to learn
    the rule.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        is_member = request.user.is_authenticated

        return Response({
            "counties": constants.KENYAN_COUNTIES,
            "currency": _currency(),
            "delivery_fees": {
                # Guest and member express rates, side-by-side.
                "express_guest": str(constants.DELIVERY_FEES["express"]),
                "express_member": str(constants.EXPRESS_FEE_MEMBER),
                "standard": _default_delivery_fee(),
                "pickup": str(constants.DELIVERY_FEES["pickup"]),
            },
            "your_express_fee": str(
                constants.delivery_fee("express", is_member=is_member)
            ),
            "free_delivery_threshold": _free_shipping_threshold(),
            "shipping_enabled": _shipping_enabled(),
            "local_pickup_enabled": _local_pickup_enabled(),
            "tax": {
                "enabled": _vat_enabled(),
                "rate": _vat_rate(),
                "prices_include_tax": _prices_include_tax(),
            },
            "delivery_days": constants.DELIVERY_DAYS,
            "checkout": {
                "allow_guest_checkout": _allow_guest_checkout(),
                "require_phone": _require_phone(),
                "whatsapp_fallback": _whatsapp_fallback(),
                "mpesa_enabled": _mpesa_enabled(),
                "min_amount_kes": _min_amount_kes(),
                "max_amount_kes": _max_amount_kes(),
                "transaction_fee_kes": _transaction_fee_kes(),
            },
        })


# ═════════════════════════════════════════════════════════════════════════════
# Payment methods — what the shop currently offers
# ═════════════════════════════════════════════════════════════════════════════
class PaymentMethodsView(APIView):
    """
    GET /api/v1/checkout/payment-methods/

    Returns only the payment methods the shop owner has enabled in
    Settings → Store → Payments. The frontend cart page calls this once
    and renders exactly what the shop supports — no hardcoded method
    list on the client.

    Response:

      {
        "methods": [
          {
            "id": "mpesa",
            "label": "M-Pesa",
            "description": "STK Push to your phone",
            "requires_phone": true,
            "badge": null
          },
          {
            "id": "cod",
            "label": "Cash on Delivery",
            "description": "Pay the rider when your order arrives",
            "requires_phone": true,
            "badge": null
          }
        ],
        "currency": "KES",
        "bounds": {
          "min_amount_kes": "100",
          "max_amount_kes": "500000",
          "transaction_fee_kes": "0"
        }
      }

    The `bounds` block lets the cart page disable checkout below the
    minimum or warn above the maximum before the customer submits.

    `requires_phone` mirrors `checkout.require_phone` — a shop that
    collects phone for delivery needs it for both methods, but a
    digital-goods shop might not.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        require_phone = _require_phone()
        methods = []

        if _mpesa_enabled():
            methods.append({
                "id": "mpesa",
                "label": "M-Pesa",
                "description": "STK Push to your phone",
                "requires_phone": require_phone,
                "badge": None,
            })

        # COD is always available on this shop. If the shop owner ever
        # adds a toggle for it, wrap this in an `if _cod_enabled()`.
        methods.append({
            "id": "cod",
            "label": "Cash on Delivery",
            "description": "Pay the rider when your order arrives",
            "requires_phone": require_phone,
            "badge": None,
        })

        # If the shop owner has disabled everything, still return an
        # empty list rather than a 500 — the frontend renders a
        # "contact support" state when no methods are available.
        return Response({
            "methods": methods,
            "currency": _currency(),
            "bounds": {
                "min_amount_kes": _min_amount_kes(),
                "max_amount_kes": _max_amount_kes(),
                "transaction_fee_kes": _transaction_fee_kes(),
            },
        })


# ═════════════════════════════════════════════════════════════════════════════
# Coupon validate
# ═════════════════════════════════════════════════════════════════════════════
class CouponValidateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = CouponValidateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            coupon = validate_coupon(
                ser.validated_data["code"],
                ser.validated_data["subtotal"],
            )
        except CouponError as exc:
            return Response(
                {"valid": False, "message": str(exc)},
                status=status.HTTP_200_OK,
            )
        return Response(
            {
                "valid": True,
                "code": coupon.code,
                "percent_off": str(coupon.percent_off),
                "message": f"{int(coupon.percent_off * 100)}% discount applied",
            }
        )


# ═════════════════════════════════════════════════════════════════════════════
# Order creation — COD path
# ═════════════════════════════════════════════════════════════════════════════
class OrderCreateView(APIView):
    """
    POST /api/v1/checkout/orders/

    Pay-on-delivery entry point. Open to signed-in customers AND
    guests — the service layer enforces `checkout.allow_guest_checkout`
    and `checkout.require_phone`.

    Errors:
      400 code=pricing_mismatch    totals don't match server recompute
      400 code=coupon_error        coupon invalid/expired
      400 code=checkout_error      guest checkout disabled / phone missing
    """
    permission_classes = [AllowAny]
    throttle_scope = "checkout"

    def post(self, request):
        idempotency_key = _idempotency_key_from(request)
        if not idempotency_key:
            return _error(
                "Idempotency-Key header is required.",
                code="missing_idempotency_key",
            )

        ser = OrderCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        checkout_payload = ser.validated_data["checkout"]
        payment_method = ser.validated_data["payment_method"]

        try:
            order = create_order(
                checkout_payload=checkout_payload,
                payment_method=payment_method,
                user=_caller_user(request),
                idempotency_key=idempotency_key,
            )
        except PricingError as exc:
            return _error(str(exc), code="pricing_mismatch")
        except CouponError as exc:
            return _error(str(exc), code="coupon_error")
        except CheckoutError as exc:
            return _error(str(exc), code="checkout_error")

        return Response(
            OrderCreateResponseSerializer(order).data,
            status=status.HTTP_201_CREATED,
        )


# ═════════════════════════════════════════════════════════════════════════════
# STK push — M-Pesa path
# ═════════════════════════════════════════════════════════════════════════════
class StkPushView(APIView):
    """
    POST /api/v1/checkout/payments/stk-push/

    Open to signed-in customers AND guests. The service layer enforces
    `payments.mpesa_enabled`, `checkout.allow_guest_checkout`, and
    `checkout.require_phone` before firing the STK push. When M-Pesa is
    disabled, the service raises `CheckoutError` and this view returns
    a 400 with a customer-readable message.
    """
    permission_classes = [AllowAny]
    throttle_scope = "stk_push"

    def post(self, request):
        idempotency_key = _idempotency_key_from(request)
        if not idempotency_key:
            return _error(
                "Idempotency-Key header is required.",
                code="missing_idempotency_key",
            )

        ser = StkPushSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        payload = ser.validated_data

        try:
            payment = process_checkout(
                payload=payload,
                user=_caller_user(request),
                idempotency_key=idempotency_key,
            )
        except PricingError as exc:
            return _error(str(exc), code="pricing_mismatch")
        except CouponError as exc:
            return _error(str(exc), code="coupon_error")
        except InvalidPhone as exc:
            return _error(str(exc), code="invalid_phone")
        except MpesaError as exc:
            logger.exception("M-Pesa STK push failed")
            return _error(
                str(exc),
                code="mpesa_error",
                http_status=status.HTTP_502_BAD_GATEWAY,
            )
        except CheckoutError as exc:
            return _error(str(exc), code="checkout_error")

        return Response(PaymentSerializer(payment).data)


# ═════════════════════════════════════════════════════════════════════════════
# Payment detail (polling target)
# ═════════════════════════════════════════════════════════════════════════════
class PaymentDetailView(APIView):
    """
    GET /api/v1/checkout/payments/<pk>/

    Polled by the checkout page while waiting for the customer to
    enter their PIN. Lazy timeout with row lock — see the module
    docstring for the race-condition rationale.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        qs = Payment.objects.select_related("order").filter(pk=pk)
        qs = _scope_payment_to_caller(qs, request)
        payment = qs.first()

        if not payment:
            return _error(
                "Payment not found.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        if payment.status == Payment.Status.PROCESSING:
            age = (timezone.now() - payment.updated_at).total_seconds()
            if age > settings.CHECKOUT_TIMEOUT_SECONDS:
                with transaction.atomic():
                    locked = _locked_payment_or_none(pk, request)
                    if locked and locked.status == Payment.Status.PROCESSING:
                        payment = transition_payment(
                            locked,
                            Payment.Status.TIMEOUT,
                            result_description="No response from M-Pesa.",
                        )
                    elif locked:
                        payment = locked

        return Response(PaymentSerializer(payment).data)


# ═════════════════════════════════════════════════════════════════════════════
# Payment by reference (success page)
# ═════════════════════════════════════════════════════════════════════════════
class PaymentByReferenceView(APIView):
    """
    GET /api/v1/checkout/payments/by-reference/<reference>/

    Fetched by the order-success page on mount.
    """
    permission_classes = [AllowAny]

    def get(self, request, reference):
        qs = (
            Order.objects.select_related("user")
            .filter(reference=reference)
        )
        qs = _scope_order_to_caller(qs, request)
        order = qs.first()

        if not order:
            return _error(
                "No order for that reference.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        payment = order.successful_payment or order.latest_payment
        if not payment:
            return _error(
                "No payment for that reference.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        return Response(PaymentSerializer(payment).data)


# ═════════════════════════════════════════════════════════════════════════════
# Cancel (best-effort)
# ═════════════════════════════════════════════════════════════════════════════
class PaymentCancelView(APIView):
    """
    POST /api/v1/checkout/payments/<pk>/cancel/

    Best-effort cancellation. Locks the row before transitioning to
    avoid racing the callback.
    """
    permission_classes = [AllowAny]

    def post(self, request, pk):
        with transaction.atomic():
            payment = _locked_payment_or_none(pk, request)
            if not payment:
                return Response(status=status.HTTP_204_NO_CONTENT)

            if payment.status in (
                Payment.Status.PENDING,
                Payment.Status.PROCESSING,
            ):
                transition_payment(
                    payment,
                    Payment.Status.CANCELLED,
                    result_description="Cancelled by user.",
                )

        return Response(status=status.HTTP_204_NO_CONTENT)


# ═════════════════════════════════════════════════════════════════════════════
# M-Pesa callback — the source of truth
# ═════════════════════════════════════════════════════════════════════════════
class MpesaCallbackView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        log = MpesaCallbackLog.objects.create(body=request.data)

        try:
            parsed = mpesa_parse_callback(request.data)
        except MpesaError as exc:
            logger.warning("Malformed M-Pesa callback: %s", exc)
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        checkout_request_id = parsed["checkout_request_id"]
        log.checkout_request_id = checkout_request_id
        log.save(update_fields=["checkout_request_id"])

        if not checkout_request_id:
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        try:
            with transaction.atomic():
                payment = (
                    Payment.objects.select_for_update()
                    .filter(checkout_request_id=checkout_request_id)
                    .first()
                )
                if not payment:
                    logger.warning(
                        "Callback for unknown checkout_request_id %s",
                        checkout_request_id,
                    )
                    log.processed = True
                    log.save(update_fields=["processed"])
                    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

                if payment.status in Payment.TERMINAL_STATUSES:
                    log.processed = True
                    log.save(update_fields=["processed"])
                    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

                if parsed["result_code"] == 0:
                    transition_payment(
                        payment,
                        Payment.Status.SUCCESS,
                        result_code=parsed["result_code"],
                        result_description=parsed["result_description"],
                        mpesa_receipt_number=parsed["receipt"] or "",
                        raw_callback=request.data,
                    )
                else:
                    transition_payment(
                        payment,
                        Payment.Status.FAILED,
                        result_code=parsed["result_code"],
                        result_description=parsed["result_description"],
                        raw_callback=request.data,
                    )

                log.processed = True
                log.save(update_fields=["processed"])
        except Exception:
            logger.exception(
                "Unhandled error processing M-Pesa callback for %s",
                checkout_request_id,
            )

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


# ═════════════════════════════════════════════════════════════════════════════
# M-Pesa timeout — Safaricom calls this when the request expires
# ═════════════════════════════════════════════════════════════════════════════
class MpesaTimeoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        MpesaCallbackLog.objects.create(body=request.data)
        try:
            parsed = mpesa_parse_callback(request.data)
        except MpesaError:
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        checkout_request_id = parsed["checkout_request_id"]
        if not checkout_request_id:
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        try:
            with transaction.atomic():
                payment = (
                    Payment.objects.select_for_update()
                    .filter(checkout_request_id=checkout_request_id)
                    .first()
                )
                if payment and payment.status not in Payment.TERMINAL_STATUSES:
                    transition_payment(
                        payment,
                        Payment.Status.TIMEOUT,
                        result_description="M-Pesa request timed out.",
                        raw_callback=request.data,
                    )
        except Exception:
            logger.exception(
                "Unhandled error processing M-Pesa timeout for %s",
                checkout_request_id,
            )

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


# ═════════════════════════════════════════════════════════════════════════════
# CART
# ═════════════════════════════════════════════════════════════════════════════

def _empty_cart_payload():
    """
    Shape returned when a user has no cart yet or just cleared it.
    """
    return {
        "id": None,
        "items": [],
        "itemCount": 0,
        "totalUnits": 0,
        "subtotal": "0.00",
        "updatedAt": None,
    }


class CartView(APIView):
    """
    GET    /api/v1/checkout/cart/     — read the current user's cart
    DELETE /api/v1/checkout/cart/     — clear it
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart = get_cart(request.user)
        if not cart:
            return Response(_empty_cart_payload())
        return Response(CartSerializer(cart).data)

    def delete(self, request):
        clear_cart(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartItemAddView(APIView):
    """
    POST /api/v1/checkout/cart/items/

    Adds a variant to the cart. If the same (productId, variantId) is
    already present, the service increments the existing line.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = AddCartItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            add_cart_item(request.user, **ser.to_service_kwargs())
        except CheckoutError as exc:
            return _error(str(exc), code="cart_error")

        cart = get_cart(request.user)
        return Response(
            CartSerializer(cart).data,
            status=status.HTTP_201_CREATED,
        )


class CartItemDetailView(APIView):
    """
    PATCH  /api/v1/checkout/cart/items/<id>/   — set quantity
    DELETE /api/v1/checkout/cart/items/<id>/   — remove line
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, item_id):
        ser = UpdateCartItemQtySerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            update_cart_item_qty(
                request.user,
                item_id,
                ser.validated_data["quantity"],
            )
        except CheckoutError as exc:
            return _error(
                str(exc),
                code="cart_error",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        cart = get_cart(request.user)
        return Response(CartSerializer(cart).data)

    def delete(self, request, item_id):
        remove_cart_item(request.user, item_id)
        cart = get_cart(request.user)
        if not cart:
            return Response(_empty_cart_payload())
        return Response(CartSerializer(cart).data)


class CartMergeView(APIView):
    """
    POST /api/v1/checkout/cart/merge/

    Called exactly once, immediately after login, with the anonymous
    cart the browser has been holding in Zustand / localStorage.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = MergeCartSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        raw_items = ser.validated_data.get("items") or []
        normalised = []
        for item in raw_items:
            normalised.append({
                "productId": item["productId"],
                "variantId": item.get("variantId") or "",
                "name": item["name"],
                "brand": item.get("brand") or "",
                "image": item.get("image") or "",
                "variantLabel": item.get("variantLabel") or "",
                "unitPrice": item["unitPrice"],
                "compareAtPrice": item.get("compareAtPrice"),
                "quantity": item.get("quantity") or 1,
                "stock": item.get("stock") or "In Stock",
                "stockCount": item.get("stockCount") or 0,
            })

        try:
            cart = merge_cart(request.user, normalised)
        except CheckoutError as exc:
            return _error(str(exc), code="cart_error")

        return Response(CartSerializer(cart).data)


# ═════════════════════════════════════════════════════════════════════════════
# TRANSACTIONS LEDGER (admin)
# ═════════════════════════════════════════════════════════════════════════════

_STATUS_MAP = {
    "Success":  [Payment.Status.SUCCESS],
    "Pending":  [Payment.Status.PENDING, Payment.Status.PROCESSING],
    "Failed":   [Payment.Status.FAILED, Payment.Status.CANCELLED, Payment.Status.TIMEOUT],
    "Reversed": [Payment.Status.REVERSED],
}

_DATE_RANGE_DAYS = {
    "Today": 0,
    "Yesterday": 1,
    "Last 7 Days": 7,
    "Last 30 Days": 30,
}


def _ledger_base_queryset():
    return Payment.objects.select_related("order", "order__user")


def _filtered_ledger_qs(request):
    """
    Apply the frontend's filter bar to the base queryset.
    """
    qs = _ledger_base_queryset()

    q = (request.query_params.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(mpesa_receipt_number__icontains=q)
            | Q(order__reference__icontains=q)
            | Q(phone_number__icontains=q)
            | Q(order__contact_email__icontains=q)
            | Q(order__contact_phone__icontains=q)
            | Q(order__snapshot__full_name__icontains=q)
        )

    status_param = (request.query_params.get("status") or "").strip()
    if status_param and status_param in _STATUS_MAP:
        qs = qs.filter(status__in=_STATUS_MAP[status_param])

    method = (request.query_params.get("method") or "").strip().upper()
    if method in {c for c, _ in Payment.Method.choices}:
        qs = qs.filter(method=method)

    date_range = (request.query_params.get("dateRange") or "").strip()
    if date_range in _DATE_RANGE_DAYS:
        days = _DATE_RANGE_DAYS[date_range]
        now = timezone.now()
        if date_range == "Today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            qs = qs.filter(created_at__gte=start)
        elif date_range == "Yesterday":
            start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            start = start_today - timedelta(days=1)
            qs = qs.filter(created_at__gte=start, created_at__lt=start_today)
        else:
            qs = qs.filter(created_at__gte=now - timedelta(days=days))

    min_amount = (request.query_params.get("minAmount") or "").strip()
    if min_amount:
        try:
            qs = qs.filter(amount__gte=float(min_amount))
        except ValueError:
            pass

    max_amount = (request.query_params.get("maxAmount") or "").strip()
    if max_amount:
        try:
            qs = qs.filter(amount__lte=float(max_amount))
        except ValueError:
            pass

    return qs


class TransactionListView(APIView):
    """
    GET /api/v1/dashboard/transactions/
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = _filtered_ledger_qs(request).prefetch_related("events")
        serializer = TransactionSerializer(qs, many=True)
        return Response(serializer.data)


class TransactionSummaryView(APIView):
    """
    GET /api/v1/dashboard/transactions/summary/
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = _filtered_ledger_qs(request)

        agg = qs.aggregate(
            successful=Sum("amount", filter=Q(status=Payment.Status.SUCCESS)),
            pending=Sum("amount", filter=Q(status__in=[
                Payment.Status.PENDING, Payment.Status.PROCESSING,
            ])),
            failed=Sum("amount", filter=Q(status__in=[
                Payment.Status.FAILED, Payment.Status.CANCELLED, Payment.Status.TIMEOUT,
            ])),
            fees=Sum("fee"),
        )

        successful = agg["successful"] or 0
        pending    = agg["pending"] or 0
        failed     = agg["failed"] or 0
        fees       = agg["fees"] or 0
        net        = successful - fees

        per_method = {}
        for method_value, method_label in Payment.Method.choices:
            method_qs = qs.filter(method=method_value)
            m_agg = method_qs.aggregate(
                successful=Sum("amount", filter=Q(status=Payment.Status.SUCCESS)),
                pending=Sum("amount", filter=Q(status__in=[
                    Payment.Status.PENDING, Payment.Status.PROCESSING,
                ])),
                failed=Sum("amount", filter=Q(status__in=[
                    Payment.Status.FAILED, Payment.Status.CANCELLED, Payment.Status.TIMEOUT,
                ])),
                fees=Sum("fee"),
                count=Count("id"),
            )
            per_method[method_value] = {
                "label": method_label,
                "successful": str(m_agg["successful"] or 0),
                "pending": str(m_agg["pending"] or 0),
                "failed": str(m_agg["failed"] or 0),
                "fees": str(m_agg["fees"] or 0),
                "count": m_agg["count"] or 0,
            }

        payload = {
            "totalSuccessful": successful,
            "totalPending": pending,
            "totalFailed": failed,
            "totalFees": fees,
            "netAmount": net,
            "perMethod": per_method,
            "transactionCount": qs.count(),
        }
        return Response(TransactionSummarySerializer(payload).data)


class TransactionDetailView(APIView):
    """
    GET /api/v1/dashboard/transactions/<pk>/
    """
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        qs = (
            _ledger_base_queryset()
            .prefetch_related("events", "reconciliations", "reversals")
            .filter(pk=pk)
        )
        payment = qs.first()
        if not payment:
            return _error(
                "Transaction not found.",
                http_status=status.HTTP_404_NOT_FOUND,
            )
        return Response(TransactionSerializer(payment).data)


_CSV_COLUMNS = [
    "Ref",
    "Order #",
    "Method",
    "Amount",
    "Fee",
    "Phone",
    "Customer",
    "Email",
    "Status",
    "Response Code",
    "Response Description",
    "Date",
    "Merchant Request ID",
    "Checkout Request ID",
]


def _row_to_csv(payment: Payment) -> list:
    return [
        payment.mpesa_receipt_number or "",
        payment.order.reference if payment.order else "",
        payment.get_method_display(),
        str(payment.amount),
        str(payment.fee),
        payment.phone_number or "",
        payment.customer_name,
        payment.customer_email,
        payment.display_status,
        str(payment.result_code) if payment.result_code is not None else "",
        payment.result_description or "",
        payment.created_at.strftime("%Y-%m-%d %H:%M"),
        payment.merchant_request_id or "",
        payment.checkout_request_id or "",
    ]


class TransactionExportView(APIView):
    """
    GET  /api/v1/dashboard/transactions/export/   — filtered export
    POST /api/v1/dashboard/transactions/export/   — export selected ids
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = _filtered_ledger_qs(request).prefetch_related("events")
        return self._stream_csv(qs, filename="transactions.csv")

    def post(self, request):
        ser = BulkExportSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ids = ser.validated_data["ids"]

        qs = (
            _ledger_base_queryset()
            .filter(pk__in=ids)
            .prefetch_related("events")
        )
        return self._stream_csv(qs, filename="transactions-selected.csv")

    def _stream_csv(self, qs, *, filename: str) -> HttpResponse:
        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(_CSV_COLUMNS)
        for payment in qs.iterator():
            writer.writerow(_row_to_csv(payment))

        response = HttpResponse(buf.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class TransactionRetryView(APIView):
    """
    POST /api/v1/dashboard/transactions/<pk>/retry/

    Re-fires the STK push for a failed M-Pesa payment. Refuses when
    `payments.mpesa_enabled` is off — the service raises
    `CheckoutError` and this view returns a 400.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        ser = RetryPaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        phone_override = (ser.validated_data.get("phone_number") or "").strip() or None

        payment = _ledger_base_queryset().filter(pk=pk).first()
        if not payment:
            return _error(
                "Transaction not found.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        try:
            new_payment = retry_payment(
                payment=payment,
                user=request.user,
                phone=phone_override,
            )
        except InvalidPhone as exc:
            return _error(str(exc), code="invalid_phone")
        except MpesaError as exc:
            logger.exception("Retry STK push failed")
            return _error(
                str(exc),
                code="mpesa_error",
                http_status=status.HTTP_502_BAD_GATEWAY,
            )
        except CheckoutError as exc:
            return _error(str(exc), code="checkout_error")

        return Response(
            TransactionSerializer(new_payment).data,
            status=status.HTTP_201_CREATED,
        )


class TransactionReconcileView(APIView):
    """
    POST /api/v1/dashboard/transactions/<pk>/reconcile/
    """
    permission_classes = [IsAdminUser]

    _ACTION_MAP = {
        "Matched":   ReconciliationLog.Action.MATCHED,
        "Unmatched": ReconciliationLog.Action.UNMATCHED,
    }

    def post(self, request, pk):
        ser = ReconcilePaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        payment = _ledger_base_queryset().filter(pk=pk).first()
        if not payment:
            return _error(
                "Transaction not found.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        action = self._ACTION_MAP[ser.validated_data["status"]]
        order_ref = (ser.validated_data.get("orderNumber") or "").strip()
        note = (ser.validated_data.get("note") or "").strip()

        try:
            payment = reconcile_payment(
                payment=payment,
                action=action,
                order_reference=order_ref,
                note=note,
                actor=request.user,
            )
        except CheckoutError as exc:
            return _error(str(exc), code="reconcile_error")

        payment = _ledger_base_queryset().filter(pk=payment.pk).first()
        return Response(TransactionSerializer(payment).data)