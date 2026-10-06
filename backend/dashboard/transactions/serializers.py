# dashboard/transactions/serializers.py

"""
Ledger serializers — the wire contract for `TransactionsLedgerPage`.

The camelCase field names below (`phoneNumber`, `orderNumber`,
`responseCode`, …) are what the frontend reads. Do NOT rename them
without updating the component in the same commit. The `source=`
arguments are the mapping to the backend model fields; the output
keys are frozen.

Models are imported from `checkout.models` — the data lives with
checkout, the shape lives here.
"""

from rest_framework import serializers

from checkout.models import (
    Payment,
    PaymentEvent,
    ReconciliationLog,
)


# ─────────────────────────────────────────────────────────────────────────────
# Timeline event
# ─────────────────────────────────────────────────────────────────────────────
class PaymentEventSerializer(serializers.ModelSerializer):
    """
    One row of the drawer's lifecycle timeline.

    Wire shape:
        { title: string, time: "HH:MM:SS",
          status: "completed" | "active" | "failed" }

    `time` is formatted to wall-clock `HH:MM:SS` server-side so the
    business's timezone (Africa/Nairobi) governs the timestamp
    regardless of where the admin opens the page from.
    """

    time = serializers.SerializerMethodField()
    status = serializers.CharField(source="state", read_only=True)

    class Meta:
        model = PaymentEvent
        fields = ("title", "time", "status")

    def get_time(self, obj) -> str:
        return obj.created_at.strftime("%H:%M:%S")


# ─────────────────────────────────────────────────────────────────────────────
# Row + detail
# ─────────────────────────────────────────────────────────────────────────────
class TransactionSerializer(serializers.ModelSerializer):
    """
    The ledger row AND the detail drawer payload — one serializer,
    two consumers. The row uses the flat fields; the drawer uses
    `payload` and `timeline` on top.

    Keeping them unified means a field rename cannot accidentally
    desync the two views.
    """

    # ── Identity / linkage ──────────────────────────────────────────
    ref         = serializers.CharField(source="mpesa_receipt_number", read_only=True)
    orderNumber = serializers.CharField(source="order.reference", read_only=True)

    # ── Money ───────────────────────────────────────────────────────
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    fee    = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    # ── Payer ───────────────────────────────────────────────────────
    phoneNumber = serializers.CharField(source="masked_phone", read_only=True)

    # ── Status / response ───────────────────────────────────────────
    status       = serializers.CharField(source="display_status", read_only=True)
    responseCode = serializers.SerializerMethodField()
    responseDesc = serializers.CharField(source="result_description", read_only=True)

    # ── Timestamps ──────────────────────────────────────────────────
    date = serializers.SerializerMethodField()

    # ── Customer (read off the linked Order) ────────────────────────
    customerName  = serializers.CharField(source="customer_name", read_only=True)
    customerEmail = serializers.CharField(source="customer_email", read_only=True)

    # ── Daraja identifiers ──────────────────────────────────────────
    merchantRequestId = serializers.CharField(source="merchant_request_id", read_only=True)
    checkoutRequestId = serializers.CharField(source="checkout_request_id", read_only=True)

    # ── Raw payload + timeline ──────────────────────────────────────
    payload  = serializers.JSONField(source="raw_callback", read_only=True)
    timeline = PaymentEventSerializer(source="events", many=True, read_only=True)

    # ── Extras the drawer + future filter will want ─────────────────
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
        """Frontend renders this as a string badge ("0", "1032")."""
        if obj.result_code is None:
            return ""
        return str(obj.result_code)

    def get_date(self, obj) -> str:
        """Frontend renders "YYYY-MM-DD HH:MM" verbatim."""
        return obj.created_at.strftime("%Y-%m-%d %H:%M")

    def get_reversals(self, obj):
        """Non-empty only when the payment has been reversed."""
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


# ─────────────────────────────────────────────────────────────────────────────
# Summary cards
# ─────────────────────────────────────────────────────────────────────────────
class TransactionSummarySerializer(serializers.Serializer):
    """
    Response for `GET /api/v1/dashboard/transactions/summary/`.

    The five cards on the page read:

        Successful  → totalSuccessful
        Pending     → totalPending
        Failed      → totalFailed
        M-Pesa Fees → totalFees
        Net settled → netAmount

    Decimal-strings so the frontend's `toLocaleString()` never
    encounters float drift.

    `perMethod` is not rendered today. It is included so the moment
    the cards split into M-Pesa / Cash / Account, the backend already
    serves the breakdown — and so a bug that drops a method from the
    list queryset is caught by the per-method totals disagreeing with
    the top-line numbers.
    """

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


# ─────────────────────────────────────────────────────────────────────────────
# Reconciliation — read + write
# ─────────────────────────────────────────────────────────────────────────────
class ReconciliationLogSerializer(serializers.ModelSerializer):
    """
    Read shape for the audit trail. Rides along on the detail
    endpoint; not rendered by the page today, but exposed so a
    future history panel has data without a second endpoint.
    """

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
    """
    Input for `POST /api/v1/dashboard/transactions/<pk>/reconcile/`.

    Accepts exactly what the modal sends:

        { status: 'Matched' | 'Unmatched',
          orderNumber: '#SKO-XXXX',   (optional)
          note: 'free text' }         (optional)

    The title-case `status` is what the radio buttons carry. The view
    maps it onto `ReconciliationLog.Action`.
    """

    status = serializers.ChoiceField(choices=("Matched", "Unmatched"))
    orderNumber = serializers.CharField(max_length=64, required=False, allow_blank=True)
    note        = serializers.CharField(required=False, allow_blank=True, allow_null=True)


# ─────────────────────────────────────────────────────────────────────────────
# Retry
# ─────────────────────────────────────────────────────────────────────────────
class RetryPaymentSerializer(serializers.Serializer):
    """
    Input for `POST /api/v1/dashboard/transactions/<pk>/retry/`.

    The retry button is one-click today (no body), but accepting an
    optional `phone_number` lets the modal grow into "retry with a
    different number" without a version bump. Validation of the phone
    format happens in the service (`mpesa.normalize_phone`), not here —
    one source of truth.
    """

    phone_number = serializers.CharField(max_length=32, required=False, allow_blank=True)


# ─────────────────────────────────────────────────────────────────────────────
# Bulk export
# ─────────────────────────────────────────────────────────────────────────────
class BulkExportSerializer(serializers.Serializer):
    """
    Input for the POST branch of the export endpoint. Rejects an
    empty list — the GET export is the endpoint for "dump everything
    filtered", the POST is for "these selected rows".
    """

    ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
    )