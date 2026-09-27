import logging
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import Payment
from ..services.pesapal import PesapalGateway

logger = logging.getLogger(__name__)


class PesapalIPNView(APIView):
    """
    Pesapal IPN — receives notification, then verifies with Pesapal.
    Register URL: settings.PESAPAL_IPN_URL
    """
    permission_classes = [AllowAny]

    def post(self, request):
        order_tracking_id = request.data.get("OrderTrackingId") or request.query_params.get("OrderTrackingId")
        merchant_ref = request.data.get("OrderMerchantReference") or request.query_params.get("OrderMerchantReference")

        if not order_tracking_id:
            return Response({"status": 500, "message": "Missing OrderTrackingId"})

        payment = Payment.objects.filter(gateway_reference=merchant_ref).first()
        if not payment:
            logger.warning("Pesapal IPN: unknown merchant ref %s", merchant_ref)
            return Response({"status": 200, "message": "Acknowledged"})

        if payment.status in (Payment.Status.COMPLETED, Payment.Status.FAILED):
            return Response({"status": 200, "message": "Already processed"})

        # CRITICAL: verify with Pesapal — IPN payload is not trustworthy alone
        try:
            verified = PesapalGateway().get_transaction_status(order_tracking_id)
        except Exception as exc:
            logger.exception("Pesapal verify failed for %s", order_tracking_id)
            return Response({"status": 500, "message": str(exc)})

        status_code = str(verified.get("status_code", ""))
        # 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED
        if status_code == "1":
            payment.status = Payment.Status.COMPLETED
            payment.completed_at = timezone.now()
        elif status_code in ("2", "0"):
            payment.status = Payment.Status.FAILED
        elif status_code == "3":
            payment.status = Payment.Status.REFUNDED
        else:
            payment.status = Payment.Status.PROCESSING

        payment.response_payload = {**payment.response_payload, "ipn": request.data, "verified": verified}
        payment.save()

        return Response({"status": 200, "message": "IPN received"})