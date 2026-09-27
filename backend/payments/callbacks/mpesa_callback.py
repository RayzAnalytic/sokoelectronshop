import logging
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from ..models import Payment

logger = logging.getLogger(__name__)


class MpesaCallbackView(APIView):
    """
    Safaricom posts STK results here.
    Register URL: settings.MPESA_CALLBACK_URL
    """
    permission_classes = [AllowAny]

    def post(self, request):
        body = request.data.get("Body", {})
        stk = body.get("stkCallback", {})
        checkout_id = stk.get("CheckoutRequestID", "")
        result_code = stk.get("ResultCode")
        result_desc = stk.get("ResultDesc", "")

        payment = Payment.objects.filter(internal_reference=checkout_id).first()
        if not payment:
            logger.warning("M-Pesa callback: unknown CheckoutRequestID %s", checkout_id)
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        # Idempotency — don't reprocess
        if payment.status in (Payment.Status.COMPLETED, Payment.Status.FAILED):
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        if result_code == 0:
            items = {i["Name"]: i.get("Value") for i in stk.get("CallbackMetadata", {}).get("Item", [])}
            payment.status = Payment.Status.COMPLETED
            payment.completed_at = timezone.now()
            payment.response_payload = {**payment.response_payload, "callback": body}
            payment.save()
            logger.info("M-Pesa payment %s completed. Receipt: %s",
                        payment.order_reference, items.get("MpesaReceiptNumber"))
        else:
            payment.status = Payment.Status.FAILED
            payment.response_payload = {**payment.response_payload, "callback": body}
            payment.save()
            logger.info("M-Pesa payment %s failed: %s", payment.order_reference, result_desc)

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})