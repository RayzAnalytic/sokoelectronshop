import csv
import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from io import StringIO

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
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
    OrderItem,
    Payment,
    ReconciliationLog,
)
from .mpesa import parse_callback as mpesa_parse_callback
from .serializers import (
    AddCartItemSerializer,
    BulkExportSerializer,
    CartSerializer,
    CompleteOrderSerializer,
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
    abandon_pending_order,
    add_cart_item,
    change_order_status,
    claim_guest_orders,
    clear_cart,
    create_order,
    get_cart,
    mark_cash_collected,
    merge_cart,
    process_checkout,
    reconcile_payment,
    remove_cart_item,
    restore_cart_from_snapshot,
    retry_payment,
    snapshot_cart,
    transition_payment,
    update_cart_item_qty,
    validate_coupon,
)

logger = logging.getLogger(__name__)

_DELIVERY_TO_METHOD_NAME = {
    "standard": "Standard Delivery",
    "express": "Express Boda",
    "pickup": "Pickup Mtaani / Locker",
}

_MAX_IMAGE_URL_LEN = 500


def _settings():
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


def _currency() -> str:
    s = _settings()
    return s['general'].currency if s else 'KES'


def _allow_guest_checkout() -> bool:
    s = _settings()
    return bool(s['checkout'].allow_guest_checkout) if s else True


def _require_phone() -> bool:
    s = _settings()
    return bool(s['checkout'].require_phone) if s else True


def _whatsapp_fallback() -> bool:
    s = _settings()
    return bool(s['checkout'].whatsapp_fallback) if s else True


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


def _shipping_method_fee(delivery_key: str) -> Decimal:
    from dashboard.shipping.models import ShippingMethod

    if delivery_key == "pickup":
        return Decimal("0")

    name = _DELIVERY_TO_METHOD_NAME.get(delivery_key)
    if not name:
        return Decimal("0")

    method = (
        ShippingMethod.objects
        .filter(name=name, status=ShippingMethod.Status.ACTIVE)
        .first()
    )
    if method is None:
        return Decimal("0")

    return Decimal(str(method.default_price))


def _default_delivery_fee() -> str:
    return str(_shipping_method_fee("standard"))


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


def _error(message, code="error", http_status=400, extra=None):
    body = {"code": code, "detail": message}
    if extra:
        body.update(extra)
    return Response(body, status=http_status)


def _idempotency_key_from(request) -> str:
    return (
        request.headers.get("Idempotency-Key")
        or request.data.get("idempotency_key")
        or ""
    ).strip()


def _caller_user(request):
    return request.user if request.user.is_authenticated else None


def _scope_payment_to_caller(qs, request):
    if request.user.is_authenticated:
        return qs.filter(order__user=request.user)
    return qs.filter(order__user__isnull=True)


def _scope_order_to_caller(qs, request):
    if request.user.is_authenticated:
        return qs.filter(user=request.user)
    return qs.filter(user__isnull=True)


def _locked_payment_or_none(payment_id, request):
    qs = (
        Payment.objects
        .select_for_update()
        .select_related("order")
        .filter(pk=payment_id)
    )
    qs = _scope_payment_to_caller(qs, request)
    return qs.first()


def _safe_image_url(url: str) -> str:
    if not url:
        return ""
    if url.startswith("data:"):
        return ""
    if len(url) > _MAX_IMAGE_URL_LEN:
        return ""
    return url


def _resolve_product_image(product_id: str, request=None) -> str:
    if not product_id:
        return ""
    try:
        from catalog.models import Product
    except Exception:
        return ""

    product = None
    base = Product._base_manager
    for field in ("pk", "sku", "barcode", "slug"):
        try:
            product = (
                base
                .prefetch_related("images")
                .filter(**{field: product_id})
                .first()
            )
        except Exception:
            product = None
        if product:
            break

    if not product:
        return ""

    first = product.images.order_by("sort_order", "id").first()
    if not first:
        return ""

    if first.external_url:
        return _safe_image_url(first.external_url)

    if not first.image:
        return ""

    try:
        url = first.image.url
    except Exception:
        return ""

    if request is not None:
        try:
            url = request.build_absolute_uri(url)
        except Exception:
            pass

    return _safe_image_url(url)


class CheckoutConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        is_member = request.user.is_authenticated

        standard_fee = _shipping_method_fee("standard")
        express_fee = _shipping_method_fee("express")
        pickup_fee = Decimal("0")

        if is_member:
            your_express_fee = Decimal("0")
        else:
            your_express_fee = express_fee

        return Response({
            "counties": constants.KENYAN_COUNTIES,
            "currency": _currency(),
            "delivery_fees": {
                "express_guest": str(express_fee),
                "express_member": str(Decimal("0")),
                "standard": str(standard_fee),
                "pickup": str(pickup_fee),
            },
            "your_express_fee": str(your_express_fee),
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


class PaymentMethodsView(APIView):
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

        methods.append({
            "id": "cod",
            "label": "Cash on Delivery",
            "description": "Pay the rider when your order arrives",
            "requires_phone": require_phone,
            "badge": None,
        })

        return Response({
            "methods": methods,
            "currency": _currency(),
            "bounds": {
                "min_amount_kes": _min_amount_kes(),
                "max_amount_kes": _max_amount_kes(),
                "transaction_fee_kes": _transaction_fee_kes(),
            },
        })


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


class OrderCreateView(APIView):
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


class AbandonOrderView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        reference = (
            request.data.get("reference")
            or request.data.get("order_reference")
            or ""
        ).strip()
        if not reference:
            return _error(
                "Order reference is required.",
                code="missing_reference",
            )

        qs = Order.objects.filter(reference=reference)
        qs = _scope_order_to_caller(qs, request)
        order = qs.first()

        if not order:
            return _error(
                "Order not found.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        try:
            result = abandon_pending_order(
                order=order, user=_caller_user(request),
            )
        except CheckoutError as exc:
            return _error(str(exc), code="checkout_error")

        if result is None:
            return _error(
                "This order can no longer be abandoned.",
                code="not_abandonable",
                http_status=status.HTTP_409_CONFLICT,
            )

        return Response({
            "reference": result.reference,
            "status": result.status,
        })


class ClaimGuestOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            claimed = claim_guest_orders(request.user)
        except Exception:
            logger.exception(
                "Failed to claim guest orders for user %s", request.user.pk,
            )
            return _error(
                "Could not link past orders right now.",
                code="claim_failed",
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response({"claimed": claimed})


class StkPushView(APIView):
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


class PaymentDetailView(APIView):
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


class PaymentByReferenceView(APIView):
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


class PaymentCancelView(APIView):
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


class ShippingQuoteView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        county = (request.query_params.get("county") or request.GET.get("county") or "").strip()
        method = (request.query_params.get("method") or request.GET.get("method") or "standard").strip().lower()
        if method not in ("standard", "express", "pickup"):
            method = "standard"
        from .services import _resolve_shipping_fee as _rsf
        try:
            fee = _rsf(method, county)
        except Exception:
            fee = _shipping_method_fee(method)
        from .services import _free_shipping_threshold as _fst
        try:
            threshold = _fst(method, county)
        except Exception:
            threshold = Decimal(_free_shipping_threshold())
        return Response({
            "county": county,
            "method": method,
            "price": str(fee),
            "free_threshold": str(threshold),
        })


def _empty_cart_payload():
    return {
        "id": None,
        "items": [],
        "itemCount": 0,
        "totalUnits": 0,
        "subtotal": "0.00",
        "updatedAt": None,
    }


class CartView(APIView):
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
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = MergeCartSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        raw_items = ser.validated_data.get("items") or []
        normalised = []
        for item in raw_items:
            image = (item.get("image") or "").strip()
            if not image or image.startswith("data:") or len(image) > _MAX_IMAGE_URL_LEN:
                image = _resolve_product_image(item["productId"], request)

            normalised.append({
                "productId": item["productId"],
                "variantId": item.get("variantId") or "",
                "name": item["name"],
                "brand": item.get("brand") or "",
                "image": image,
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


class CartSnapshotView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(snapshot_cart(request.user))


class CartRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        snapshot = request.data if isinstance(request.data, dict) else {}
        if "items" not in snapshot:
            return _error(
                "Snapshot must contain an 'items' list.",
                code="invalid_snapshot",
            )

        try:
            cart = restore_cart_from_snapshot(request.user, snapshot)
        except CheckoutError as exc:
            return _error(str(exc), code="cart_error")

        return Response(CartSerializer(cart).data)


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

    source = (request.query_params.get("source") or "").strip().upper()
    if source in {"STK", "C2B", "MANUAL"}:
        qs = qs.filter(source=source)

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
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = _filtered_ledger_qs(request).prefetch_related("events")
        serializer = TransactionSerializer(qs, many=True)
        return Response(serializer.data)


class TransactionSummaryView(APIView):
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
    permission_classes = [IsAdminUser]

    _ACTION_MAP = {
        "Matched":   ReconciliationLog.Action.MATCHED,
        "Unmatched": ReconciliationLog.Action.UNMATCHED,
        "Cash Paid": ReconciliationLog.Action.CASH_PAID,
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

        raw_status = ser.validated_data["status"]
        if raw_status not in self._ACTION_MAP:
            return _error(
                f"Unsupported reconciliation status: {raw_status}",
                code="invalid_action",
            )
        action = self._ACTION_MAP[raw_status]
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


class MarkCashCollectedView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        payment = _ledger_base_queryset().filter(pk=pk).first()
        if not payment:
            return _error(
                "Transaction not found.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        note = (request.data.get("note") or "").strip()

        try:
            payment = mark_cash_collected(
                payment=payment,
                actor=request.user,
                note=note,
            )
        except CheckoutError as exc:
            return _error(str(exc), code="reconcile_error")

        payment = _ledger_base_queryset().filter(pk=payment.pk).first()
        return Response(TransactionSerializer(payment).data)


class OrderStatusChangeView(APIView):
    permission_classes = [IsAdminUser]

    _ALLOWED = {c for c, _ in Order.Status.choices}

    def post(self, request, reference):
        new_status = (request.data.get("status") or "").strip().upper()
        if new_status not in self._ALLOWED:
            return _error(
                "Unknown order status.",
                code="invalid_status",
            )

        order = Order.objects.filter(reference=reference).first()
        if not order:
            return _error(
                "Order not found.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        note = (request.data.get("note") or "").strip()
        actor_name = (
            getattr(request.user, "get_full_name", lambda: "")()
            or getattr(request.user, "email", "")
            or "Admin"
        )

        try:
            order = change_order_status(
                order,
                new_status,
                actor=request.user,
                actor_label=actor_name[:120],
                note=note,
                notify=True,
            )
        except CheckoutError as exc:
            return _error(str(exc), code="status_error")

        return Response({
            "reference": order.reference,
            "status": order.status,
        })


class C2BValidationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


class C2BConfirmationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        data = request.data or {}
        trans_id = (data.get("TransID") or "").strip()
        if not trans_id:
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        if Payment.objects.filter(mpesa_receipt_number=trans_id).exists():
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        try:
            amount = Decimal(str(data.get("TransAmount") or "0"))
        except (InvalidOperation, ValueError):
            amount = Decimal("0")

        phone = (data.get("MSISDN") or "").strip()
        full_name = " ".join(
            part.strip()
            for part in (
                data.get("FirstName", ""),
                data.get("MiddleName", ""),
                data.get("LastName", ""),
            )
            if part and part.strip()
        ) or "Walk-in customer"

        with transaction.atomic():
            order = Order.objects.create(
                status=Order.Status.CONFIRMED,
                payment_status=Order.PaymentStatus.PAID,
                payment_method=Order.PaymentMethod.MPESA,
                source=Order.Source.IN_STORE,
                contact_email="",
                contact_phone=phone,
                full_name=full_name,
                address_street="In-store",
                address_town="Counter",
                address_county="Nairobi",
                delivery_method="pickup",
                estimated_delivery="Today",
                subtotal=Decimal("0"),
                shipping=Decimal("0"),
                tax=Decimal("0"),
                total=amount,
                notes=f"Auto-created from Till {trans_id}",
            )
            Payment.objects.create(
                method=Payment.Method.MPS,
                source=Payment.Source.C2B,
                status=Payment.Status.SUCCESS,
                amount=amount,
                phone_number=phone,
                idempotency_key=trans_id,
                mpesa_receipt_number=trans_id,
                result_code=0,
                result_description="Buy Goods payment",
                raw_callback=data,
                order=order,
            )

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


class CompleteOrderFromPaymentView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            payment = Payment.objects.select_related("order").get(pk=pk, source="C2B")
        except Payment.DoesNotExist:
            return _error("Payment not found.", http_status=status.HTTP_404_NOT_FOUND)

        order = payment.order
        if order is None:
            return _error("Payment has no linked order.")

        ser = CompleteOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        subtotal = Decimal("0")
        order.items.all().delete()

        for row in data["items"]:
            qty = row["quantity"]
            unit = row["unit_price"]
            OrderItem.objects.create(
                order=order,
                product_id=row.get("product_id", "") or "",
                name=row["name"],
                brand=row.get("brand", "") or "",
                unit_price=unit,
                quantity=qty,
                image_url=row.get("image_url", "") or "",
                serial_number=row.get("serial_number", "") or "",
                imei=row.get("imei", "") or "",
            )
            subtotal += unit * qty

        order.subtotal = subtotal
        order.total = payment.amount
        order.shipping = max(Decimal("0"), payment.amount - subtotal)
        if data.get("customer_name"):
            order.full_name = data["customer_name"]
        if data.get("customer_phone"):
            order.contact_phone = data["customer_phone"]
        if data.get("address"):
            order.address_street = data["address"]
        order.save()

        return Response({
            "reference": order.reference,
            "total": str(order.total),
            "items_count": order.items.count(),
        })


class StickerDataView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, reference, item_id):
        try:
            item = OrderItem.objects.select_related("order").get(
                order__reference=reference, id=item_id
            )
        except OrderItem.DoesNotExist:
            return _error("Item not found.", http_status=status.HTTP_404_NOT_FOUND)

        return Response({
            "order_reference": item.order.reference,
            "item_id": item.id,
            "name": item.name,
            "brand": item.brand,
            "quantity": item.quantity,
            "unit_price": str(item.unit_price),
            "serial_number": item.serial_number,
            "imei": item.imei,
            "customer_name": item.order.full_name,
            "customer_phone_last4": (item.order.contact_phone or "")[-4:],
            "created_at": item.order.created_at.isoformat(),
            "qr_payload": f"{item.order.reference}/{item.id}",
        })