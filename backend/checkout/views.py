import logging

from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import constants
from .exceptions import (
    CheckoutError,
    CouponError,
    CustomerExists,
    InvalidPhone,
    MpesaError,
    PricingError,
)
from .models import MpesaCallbackLog, Payment
from .serializers import (
    CouponValidateSerializer,
    PaymentSerializer,
    StkPushSerializer,
)
from .services import (
    process_checkout,
    transition_payment,
    validate_coupon,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _error(message, code="error", http_status=400):
    return Response(
        {"code": code, "detail": message},
        status=http_status,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
class CheckoutConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "counties": constants.KENYAN_COUNTIES,
                "delivery_fees": {
                    k: str(v) for k, v in constants.DELIVERY_FEES.items()
                },
                "free_delivery_threshold": str(
                    constants.FREE_DELIVERY_THRESHOLD
                ),
                "tax_rate": str(constants.TAX_RATE),
            }
        )


# ─────────────────────────────────────────────────────────────────────────────
# Coupon validate
# ─────────────────────────────────────────────────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────────
# STK push — the main entry point
# ─────────────────────────────────────────────────────────────────────────────
class StkPushView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        idempotency_key = (
            request.headers.get("Idempotency-Key")
            or request.data.get("idempotency_key")
            or ""
        ).strip()
        if not idempotency_key:
            return _error(
                "Idempotency-Key header is required.",
                code="missing_idempotency_key",
            )

        ser = StkPushSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        payload = ser.validated_data
        password = payload.pop("password", "") or ""

        try:
            payment = process_checkout(
                payload=payload,
                password=password,
                idempotency_key=idempotency_key,
            )
        except PricingError as exc:
            return _error(str(exc), code="pricing_mismatch")
        except CustomerExists as exc:
            return _error(
                str(exc),
                code="sign_in_required",
                http_status=status.HTTP_409_CONFLICT,
            )
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


# ─────────────────────────────────────────────────────────────────────────────
# Payment detail (polling target)
# ─────────────────────────────────────────────────────────────────────────────
class PaymentDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            payment = Payment.objects.select_related("order").get(pk=pk)
        except Payment.DoesNotExist:
            return _error(
                "Payment not found.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        # Lazy timeout: if PROCESSING and older than threshold, flip to TIMEOUT
        if payment.status == Payment.Status.PROCESSING:
            age = (timezone_now() - payment.updated_at).total_seconds()
            if age > settings.CHECKOUT_TIMEOUT_SECONDS:
                payment = transition_payment(
                    payment,
                    Payment.Status.TIMEOUT,
                    result_description="No response from M-Pesa.",
                )

        return Response(PaymentSerializer(payment).data)


# ─────────────────────────────────────────────────────────────────────────────
# Payment by reference (success page)
# ─────────────────────────────────────────────────────────────────────────────
class PaymentByReferenceView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, reference):
        payment = (
            Payment.objects.select_related("order")
            .filter(order__reference=reference)
            .order_by("-created_at")
            .first()
        )
        if not payment:
            return _error(
                "No payment for that reference.",
                http_status=status.HTTP_404_NOT_FOUND,
            )
        return Response(PaymentSerializer(payment).data)


# ─────────────────────────────────────────────────────────────────────────────
# Cancel (best-effort)
# ─────────────────────────────────────────────────────────────────────────────
class PaymentCancelView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, pk):
        try:
            payment = Payment.objects.get(pk=pk)
        except Payment.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        if payment.status in (Payment.Status.PENDING, Payment.Status.PROCESSING):
            transition_payment(
                payment,
                Payment.Status.CANCELLED,
                result_description="Cancelled by user.",
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# M-Pesa callback — the source of truth
# ─────────────────────────────────────────────────────────────────────────────
class MpesaCallbackView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        # 1. Log raw body unconditionally
        log = MpesaCallbackLog.objects.create(body=request.data)

        # 2. Parse
        try:
            parsed = mpesa.parse_callback(request.data)
        except MpesaError as exc:
            logger.warning("Malformed M-Pesa callback: %s", exc)
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        checkout_request_id = parsed["checkout_request_id"]
        log.checkout_request_id = checkout_request_id
        log.save(update_fields=["checkout_request_id"])

        if not checkout_request_id:
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        # 3. Find payment with row lock
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

            # 4. Already terminal → idempotent no-op
            if payment.status in Payment.TERMINAL_STATUSES:
                log.processed = True
                log.save(update_fields=["processed"])
                return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

            # 5. Apply transition
            if parsed["result_code"] == 0:
                transition_payment(
                    payment,
                    Payment.Status.SUCCESS,
                    result_code=parsed["result_code"],
                    result_description=parsed["result_description"],
                    mpesa_receipt_number=parsed["receipt"] or "",
                )
            else:
                transition_payment(
                    payment,
                    Payment.Status.FAILED,
                    result_code=parsed["result_code"],
                    result_description=parsed["result_description"],
                )

            log.processed = True
            log.save(update_fields=["processed"])

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


# ─────────────────────────────────────────────────────────────────────────────
# M-Pesa timeout — Safaricom calls this on timeout
# ─────────────────────────────────────────────────────────────────────────────
class MpesaTimeoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        MpesaCallbackLog.objects.create(body=request.data)
        try:
            parsed = mpesa.parse_callback(request.data)
        except MpesaError:
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        checkout_request_id = parsed["checkout_request_id"]
        if not checkout_request_id:
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

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
                )

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


def timezone_now():
    from django.utils import timezone
    return timezone.now()