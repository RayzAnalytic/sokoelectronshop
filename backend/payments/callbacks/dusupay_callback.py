import logging
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import Payment

logger = logging.getLogger(__name__)


class DusupayCallbackView(APIView):
    """
    Dusupay posts collection notifications here.
    Configure this URL in your Dusupay merchant dashboard.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.data
        event = payload.get("event", "")
        merchant_ref = payload.get("merchant_reference") or payload.get("data", {}).get("merchant_reference")

        payment = Payment.objects.filter(gateway_reference=merchant_ref).first()
        if not payment:
            logger.warning("Dusupay callback: unknown merchant_reference %s", merchant_ref)
            return Response({"status": "ok"})

        if payment.status in (Payment.Status.COMPLETED, Payment.Status.FAILED):
            return Response({"status": "ok"})

        if event == "request.failed":
            payment.status = Payment.Status.FAILED
        else:
            txn_status = payload.get("transaction_status", "").upper()
            if txn_status in ("SUCCESS", "SUCCESSFUL", "COMPLETED"):
                payment.status = Payment.Status.COMPLETED
                payment.completed_at = timezone.now()
            elif txn_status in ("FAILED", "CANCELLED"):
                payment.status = Payment.Status.FAILED

        payment.response_payload = {**payment.response_payload, "callback": payload}
        payment.save()

        return Response({"status": "ok"})