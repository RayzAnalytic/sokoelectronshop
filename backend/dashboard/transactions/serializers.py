from rest_framework import serializers

from checkout.models import (
    Payment,
    PaymentEvent,
    ReconciliationLog,
)


class PaymentEventSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()
    status = serializers.CharField(source="state", read_only=True)

    class Meta:
        model = PaymentEvent
        fields = ("title", "time", "status")

    def get_time(self, obj) -> str:
        return obj.created_at.strftime("%H:%M:%S")


class TransactionSerializer(serializers.ModelSerializer):
    ref         = serializers.CharField(source="mpesa_receipt_number", read_only=True)
    orderNumber = serializers.CharField(source="order.reference", read_only=True)

    amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    fee    = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    phoneNumber = serializers.CharField(source="masked_phone", read_only=True)

    status       = serializers.CharField(source="display_status", read_only=True)
    responseCode = serializers.SerializerMethodField()
    responseDesc = serializers.CharField(source="result_description", read_only=True)

    date = serializers.SerializerMethodField()

    customerName  = serializers.CharField(source="customer_name", read_only=True)
    customerEmail = serializers.CharField(source="customer_email", read_only=True)

    merchantRequestId = serializers.CharField(source="merchant_request_id", read_only=True)
    checkoutRequestId = serializers.CharField(source="checkout_request_id", read_only=True)

    payload  = serializers.JSONField(source="raw_callback", read_only=True)
    timeline = PaymentEventSerializer(source="events", many=True, read_only=True)

    method    = serializers.CharField(read_only=True)
    settledAt = serializers.DateTimeField(source="settled_at", read_only=True, allow_null=True)
    reversals = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = (
            "id",
            "ref",
            "orderNumber",
            "amount",
            "fee",
            "phoneNumber",
            "status",
            "responseCode",
            "responseDesc",
            "date",
            "customerName",
            "customerEmail",
            "merchantRequestId",
            "checkoutRequestId",
            "payload",
            "timeline",
            "method",
            "settledAt",
            "reversals",
        )

    def get_responseCode(self, obj) -> str:
        if obj.result_code is None:
            return ""
        return str(obj.result_code)

    def get_date(self, obj) -> str:
        return obj.created_at.strftime("%Y-%m-%d %H:%M")

    def get_reversals(self, obj):
        qs = (
            obj.reversals.all()
            if obj.status == Payment.Status.REVERSED
            else obj.reversals.none()
        )
        return [
            {
                "id": str(rev.id),
                "status": rev.display_status,
                "createdAt": rev.created_at.isoformat(),
                "reason": rev.reversal_reason or "",
            }
            for rev in qs
        ]


class TransactionSummarySerializer(serializers.Serializer):
    totalSuccessful = serializers.DecimalField(max_digits=14, decimal_places=2)
    totalPending    = serializers.DecimalField(max_digits=14, decimal_places=2)
    totalFailed     = serializers.DecimalField(max_digits=14, decimal_places=2)
    totalFees       = serializers.DecimalField(max_digits=14, decimal_places=2)
    netAmount       = serializers.DecimalField(max_digits=14, decimal_places=2)

    perMethod = serializers.DictField(
        child=serializers.DictField(child=serializers.CharField()),
        required=False,
    )
    transactionCount = serializers.IntegerField(required=False)


class ReconciliationLogSerializer(serializers.ModelSerializer):
    actorLabel = serializers.CharField(source="actor_label", read_only=True)
    createdAt  = serializers.DateTimeField(source="created_at", read_only=True)
    matchedOrderReference = serializers.CharField(
        source="matched_order_reference", read_only=True,
    )

    class Meta:
        model = ReconciliationLog
        fields = (
            "id",
            "action",
            "actorLabel",
            "matchedOrderReference",
            "note",
            "createdAt",
        )


class ReconcilePaymentSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("Matched", "Unmatched"))
    orderNumber = serializers.CharField(max_length=64, required=False, allow_blank=True)
    note        = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class RetryPaymentSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=32, required=False, allow_blank=True)


class BulkExportSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )