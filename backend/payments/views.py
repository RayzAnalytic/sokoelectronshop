# payments/views.py

import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment, PaymentAttempt
from .serializers import (
    DusupayInitiateSerializer,
    MpesaInitiateSerializer,
    PaymentReadSerializer,
    PesapalInitiateSerializer,
)
from .services.base import GatewayError
from .services.dusupay import DusupayGateway
from .services.mpesa import MpesaGateway
from .services.pesapal import PesapalGateway

logger = logging.getLogger(__name__)


# ============================================================
# READS — user's own payments
# ============================================================
class PaymentListView(generics.ListAPIView):
    """
    GET /api/payments/
    Returns the authenticated user's payments.
    Supports ?gateway=DUSUPAY and ?status=COMPLETED filters.
    """
    serializer_class = PaymentReadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            Payment.objects.filter(user=self.request.user)
            .prefetch_related("attempts")
            .order_by("-created_at")
        )
        gateway = self.request.query_params.get("gateway")
        status_param = self.request.query_params.get("status")
        if gateway:
            qs = qs.filter(gateway=gateway.upper())
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs


class PaymentDetailView(generics.RetrieveAPIView):
    """
    GET /api/payments/<uuid:id>/
    Only returns payments belonging to the requesting user.
    """
    serializer_class = PaymentReadSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        return (
            Payment.objects.filter(user=self.request.user)
            .prefetch_related("attempts")
        )


# ============================================================
# INITIATION — Dusupay
# ============================================================
class DusupayInitiateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = DusupayInitiateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        payment = Payment.objects.create(
            order_reference=data["order_reference"],
            user=request.user,
            amount=data["amount"],
            currency=data["currency"],
            gateway=Payment.Gateway.DUSUPAY,
            description=data["description"],
            status=Payment.Status.PROCESSING,
            request_payload=data,
        )

        gateway = DusupayGateway()
        try:
            response = gateway.initiate_collection({
                "merchant_reference": "auto",
                "transaction_method": data["transaction_method"],
                "currency": data["currency"],
                "amount": float(data["amount"]),
                "provider_code": data["provider_code"],
                "msisdn": data.get("msisdn") or "",
                "customer_email": data.get("customer_email") or "",
                "customer_name": data.get("customer_name") or "",
                "description": data["description"],
                "charge_customer": False,
                "allow_final_status_change": True,
                "redirect_url": data["redirect_url"],
            })
        except GatewayError as exc:
            logger.warning("Dusupay initiate failed: %s", exc)
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=["status", "updated_at"])
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        inner = response.get("data", {})
        payment.internal_reference = inner.get("internal_reference", "")
        payment.gateway_reference = inner.get("merchant_reference", "")
        payment.payment_url = inner.get("payment_url", "")
        payment.response_payload = response
        payment.save()

        PaymentAttempt.objects.create(
            payment=payment,
            gateway_checkout_id=payment.internal_reference,
            raw_request=data,
            raw_response=response,
        )

        return Response(
            PaymentReadSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


# ============================================================
# INITIATION — Pesapal
# ============================================================
class PesapalInitiateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = PesapalInitiateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        payment = Payment.objects.create(
            order_reference=data["order_reference"],
            user=request.user,
            amount=data["amount"],
            currency=data["currency"],
            gateway=Payment.Gateway.PESAPAL,
            description=data["description"],
            status=Payment.Status.PROCESSING,
            request_payload=data,
        )

        gateway = PesapalGateway()
        try:
            response = gateway.submit_order({
                "id": data["order_reference"],
                "currency": data["currency"],
                "amount": float(data["amount"]),
                "description": data["description"],
                "callback_url": data["callback_url"],
                "cancellation_url": data.get("cancellation_url", ""),
                "notification_id": settings.PESAPAL_IPN_ID,
                "billing_address": {
                    "email_address": data["email_address"],
                    "phone_number": data["phone_number"],
                    "country_code": data["country_code"],
                    "first_name": data["first_name"],
                    "last_name": data["last_name"],
                },
            })
        except GatewayError as exc:
            logger.warning("Pesapal initiate failed: %s", exc)
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=["status", "updated_at"])
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.internal_reference = response.get("order_tracking_id", "")
        payment.gateway_reference = data["order_reference"]
        payment.payment_url = response.get("redirect_url", "")
        payment.response_payload = response
        payment.save()

        PaymentAttempt.objects.create(
            payment=payment,
            gateway_checkout_id=payment.internal_reference,
            raw_request=data,
            raw_response=response,
        )

        return Response(
            PaymentReadSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


# ============================================================
# INITIATION — M-Pesa STK Push
# ============================================================
class MpesaInitiateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = MpesaInitiateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        payment = Payment.objects.create(
            order_reference=data["order_reference"],
            user=request.user,
            amount=data["amount"],
            currency="KES",
            gateway=Payment.Gateway.MPESA,
            description=data["description"],
            status=Payment.Status.PROCESSING,
            request_payload=data,
        )

        gateway = MpesaGateway()
        try:
            response = gateway.stk_push(
                phone_number=data["phone_number"],
                amount=data["amount"],
                order_reference=data["order_reference"],
                description=data["description"],
            )
        except GatewayError as exc:
            logger.warning("M-Pesa initiate failed: %s", exc)
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=["status", "updated_at"])
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.internal_reference = response.get("CheckoutRequestID", "")
        payment.gateway_reference = response.get("MerchantRequestID", "")
        payment.response_payload = response
        payment.save()

        PaymentAttempt.objects.create(
            payment=payment,
            gateway_checkout_id=payment.internal_reference,
            raw_request=data,
            raw_response=response,
        )

        return Response(
            PaymentReadSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


# ============================================================
# CALLBACKS — public, called by gateways
# ============================================================
class DusupayCallbackView(APIView):
    """
    Dusupay posts collection notifications here.
    Configure this URL in your Dusupay merchant dashboard.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.data or {}
        event = payload.get("event", "")
        data = payload.get("data", {}) or {}

        merchant_ref = (
            payload.get("merchant_reference")
            or data.get("merchant_reference")
        )

        # ── Lock the row to prevent race conditions ──
        with transaction.atomic():
            payment = (
                Payment.objects.select_for_update()
                .filter(
                    gateway_reference=merchant_ref,
                    gateway=Payment.Gateway.DUSUPAY,
                )
                .first()
            )

            if not payment:
                logger.warning(
                    "Dusupay callback: unknown merchant_reference %s",
                    merchant_ref,
                )
                return Response({"status": "ok"})

            # Idempotency — never reprocess a terminal state
            if payment.status in (
                Payment.Status.COMPLETED,
                Payment.Status.FAILED,
                Payment.Status.REFUNDED,
            ):
                return Response({"status": "ok"})

            if event == "request.failed":
                payment.status = Payment.Status.FAILED
            else:
                txn_status = (data.get("transaction_status") or "").upper()
                if txn_status in ("SUCCESS", "SUCCESSFUL", "COMPLETED"):
                    payment.status = Payment.Status.COMPLETED
                    payment.completed_at = timezone.now()
                elif txn_status in ("FAILED", "CANCELLED"):
                    payment.status = Payment.Status.FAILED

            payment.response_payload = {
                **(payment.response_payload or {}),
                "callback": payload,
            }
            payment.save()

        return Response({"status": "ok"})


class PesapalIPNView(APIView):
    """
    Pesapal IPN — receives notification, then verifies with Pesapal.
    Register URL: settings.PESAPAL_IPN_URL
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        order_tracking_id = (
            request.data.get("OrderTrackingId")
            or request.query_params.get("OrderTrackingId")
        )
        merchant_ref = (
            request.data.get("OrderMerchantReference")
            or request.query_params.get("OrderMerchantReference")
        )

        if not order_tracking_id:
            return Response(
                {"status": 500, "message": "Missing OrderTrackingId"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Fetch + lock first, then verify outside the lock ──
        payment = (
            Payment.objects.filter(
                gateway_reference=merchant_ref,
                gateway=Payment.Gateway.PESAPAL,
            )
            .first()
        )

        if not payment:
            logger.warning(
                "Pesapal IPN: unknown merchant ref %s", merchant_ref
            )
            return Response({"status": 200, "message": "Acknowledged"})

        # Terminal state? Short-circuit.
        if payment.status in (
            Payment.Status.COMPLETED,
            Payment.Status.FAILED,
            Payment.Status.REFUNDED,
        ):
            return Response({"status": 200, "message": "Already processed"})

        # CRITICAL: verify with Pesapal — IPN payload alone is not trustworthy
        try:
            verified = PesapalGateway().get_transaction_status(
                order_tracking_id
            )
        except Exception as exc:
            logger.exception(
                "Pesapal verify failed for %s", order_tracking_id
            )
            return Response(
                {"status": 500, "message": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ── Re-fetch under lock, re-check idempotency, then update ──
        with transaction.atomic():
            payment = (
                Payment.objects.select_for_update()
                .filter(pk=payment.pk)
                .first()
            )
            if payment.status in (
                Payment.Status.COMPLETED,
                Payment.Status.FAILED,
                Payment.Status.REFUNDED,
            ):
                return Response({"status": 200, "message": "Already processed"})

            status_code = str(verified.get("status_code", ""))
            # Pesapal: 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED
            if status_code == "1":
                payment.status = Payment.Status.COMPLETED
                payment.completed_at = timezone.now()
            elif status_code in ("0", "2"):
                payment.status = Payment.Status.FAILED
            elif status_code == "3":
                payment.status = Payment.Status.REFUNDED
            else:
                payment.status = Payment.Status.PROCESSING

            payment.response_payload = {
                **(payment.response_payload or {}),
                "ipn": request.data,
                "verified": verified,
            }
            payment.save()

        return Response({"status": 200, "message": "IPN received"})


class MpesaCallbackView(APIView):
    """
    Safaricom posts STK results here.
    Register URL: settings.MPESA_CALLBACK_URL
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        body = request.data.get("Body", {}) or {}
        stk = body.get("stkCallback", {}) or {}

        checkout_id = stk.get("CheckoutRequestID", "")
        result_code = stk.get("ResultCode")
        result_desc = stk.get("ResultDesc", "")

        with transaction.atomic():
            payment = (
                Payment.objects.select_for_update()
                .filter(
                    internal_reference=checkout_id,
                    gateway=Payment.Gateway.MPESA,
                )
                .first()
            )

            if not payment:
                logger.warning(
                    "M-Pesa callback: unknown CheckoutRequestID %s",
                    checkout_id,
                )
                return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

            if payment.status in (
                Payment.Status.COMPLETED,
                Payment.Status.FAILED,
                Payment.Status.REFUNDED,
            ):
                return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

            if result_code == 0:
                items = {
                    i["Name"]: i.get("Value")
                    for i in stk.get("CallbackMetadata", {}).get(
                        "Item", []
                    )
                }
                payment.status = Payment.Status.COMPLETED
                payment.completed_at = timezone.now()
                payment.response_payload = {
                    **(payment.response_payload or {}),
                    "callback": body,
                    "receipt": items,
                }
                logger.info(
                    "M-Pesa payment %s completed. Receipt: %s",
                    payment.order_reference,
                    items.get("MpesaReceiptNumber"),
                )
            else:
                payment.status = Payment.Status.FAILED
                payment.response_payload = {
                    **(payment.response_payload or {}),
                    "callback": body,
                }
                logger.info(
                    "M-Pesa payment %s failed: %s",
                    payment.order_reference,
                    result_desc,
                )

            payment.save()

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})