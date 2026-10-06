# dashboard/transactions/views.py

"""
Admin transactions ledger API.

Six endpoints under `/api/v1/dashboard/transactions/`:

    GET    /                              list + filter + search
    GET    /summary/                      the five summary cards
    GET    /<uuid:pk>/                    detail drawer payload
    GET    /export/                       CSV (filtered)
    POST   /export/                       CSV (bulk ids)
    POST   /<uuid:pk>/retry/              re-fire a failed STK push
    POST   /<uuid:pk>/reconcile/          manual finance action

Every view is `IsFinanceStaff`. The route layer never sees the
permission — it is applied per-view so a future swap (custom role
field) is a view-level change, not a routing change.
"""

import csv
import logging
from datetime import timedelta
from io import StringIO

from django.db.models import Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.exceptions import CheckoutError, InvalidPhone, MpesaError
from checkout.models import Payment, ReconciliationLog

from .permissions import IsFinanceStaff
from .serializers import (
    BulkExportSerializer,
    ReconcilePaymentSerializer,
    RetryPaymentSerializer,
    TransactionSerializer,
    TransactionSummarySerializer,
)
from .services import reconcile_payment, retry_payment

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _error(message, code="error", http_status=400):
    return Response({"code": code, "detail": message}, status=http_status)


# The frontend's 4-state vocabulary. Kept as a module constant so the
# list and the summary agree by construction.
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
    """
    Every ledger endpoint starts here.

    `select_related("order", "order__user")` is not optional: the
    serializer reads `order.reference`, `order.contact_email`,
    `order.snapshot.full_name`, and `order.user` on every row.
    Without it, N rows become N+1 queries.
    """
    return Payment.objects.select_related("order", "order__user")


def _filtered_ledger_qs(request):
    """
    Apply the filter bar to the base queryset.

    Query params (all optional):
      q           free-text: M-Pesa ref, order #, phone, customer
      status      Success | Pending | Failed | Reversed
      method      MPESA | COD
      dateRange   Today | Yesterday | Last 7 Days | Last 30 Days
      minAmount   inclusive lower bound on amount
      maxAmount   inclusive upper bound on amount
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
    if status_param in _STATUS_MAP:
        qs = qs.filter(status__in=_STATUS_MAP[status_param])

    method = (request.query_params.get("method") or "").strip().upper()
    if method in {c for c, _ in Payment.Method.choices}:
        qs = qs.filter(method=method)

    date_range = (request.query_params.get("dateRange") or "").strip()
    if date_range in _DATE_RANGE_DAYS:
        now = timezone.now()
        if date_range == "Today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            qs = qs.filter(created_at__gte=start)
        elif date_range == "Yesterday":
            start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            start = start_today - timedelta(days=1)
            qs = qs.filter(created_at__gte=start, created_at__lt=start_today)
        else:
            days = _DATE_RANGE_DAYS[date_range]
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


# ─────────────────────────────────────────────────────────────────────────────
# List
# ─────────────────────────────────────────────────────────────────────────────
class TransactionListView(APIView):
    """
    GET /api/v1/dashboard/transactions/

    The ledger table. Returns the FULL filtered set — the frontend
    paginates client-side today. If the ledger grows past what a
    single response can hold, wrap this view in DRF pagination
    (PageNumberPagination, page size 50) and update the component to
    append pages. The filters stay identical either way.
    """

    permission_classes = [IsFinanceStaff]

    def get(self, request):
        qs = _filtered_ledger_qs(request).prefetch_related("events")
        return Response(TransactionSerializer(qs, many=True).data)


# ─────────────────────────────────────────────────────────────────────────────
# Summary cards
# ─────────────────────────────────────────────────────────────────────────────
class TransactionSummaryView(APIView):
    """
    GET /api/v1/dashboard/transactions/summary/

    The five cards. Every aggregate is computed over the SAME filtered
    queryset the list view uses — so the card totals always match what
    the table shows.

    "Net settled = Successful − Fees" is correct across all methods
    without an explicit filter: COD payments carry `fee = 0`, so the
    sum is already M-Pesa-aware.

    `perMethod` is the guardrail that catches a method-filter bug the
    moment the two totals disagree. Not rendered today; ready when the
    UI splits.
    """

    permission_classes = [IsFinanceStaff]

    def get(self, request):
        qs = _filtered_ledger_qs(request)

        agg = qs.aggregate(
            successful=Sum("amount", filter=Q(status=Payment.Status.SUCCESS)),
            pending=Sum(
                "amount",
                filter=Q(status__in=[
                    Payment.Status.PENDING, Payment.Status.PROCESSING,
                ]),
            ),
            failed=Sum(
                "amount",
                filter=Q(status__in=[
                    Payment.Status.FAILED,
                    Payment.Status.CANCELLED,
                    Payment.Status.TIMEOUT,
                ]),
            ),
            fees=Sum("fee"),
        )

        successful = agg["successful"] or 0
        pending    = agg["pending"] or 0
        failed     = agg["failed"] or 0
        fees       = agg["fees"] or 0

        # Per-method breakdown, iterated over the enum so a new method
        # is automatically included.
        per_method = {}
        for method_value, method_label in Payment.Method.choices:
            m = qs.filter(method=method_value).aggregate(
                successful=Sum("amount", filter=Q(status=Payment.Status.SUCCESS)),
                pending=Sum(
                    "amount",
                    filter=Q(status__in=[
                        Payment.Status.PENDING, Payment.Status.PROCESSING,
                    ]),
                ),
                failed=Sum(
                    "amount",
                    filter=Q(status__in=[
                        Payment.Status.FAILED,
                        Payment.Status.CANCELLED,
                        Payment.Status.TIMEOUT,
                    ]),
                ),
                fees=Sum("fee"),
                count=Sum(1),
            )
            per_method[method_value] = {
                "label": method_label,
                "successful": str(m["successful"] or 0),
                "pending": str(m["pending"] or 0),
                "failed": str(m["failed"] or 0),
                "fees": str(m["fees"] or 0),
                "count": m["count"] or 0,
            }

        payload = {
            "totalSuccessful": successful,
            "totalPending": pending,
            "totalFailed": failed,
            "totalFees": fees,
            "netAmount": successful - fees,
            "perMethod": per_method,
            "transactionCount": qs.count(),
        }
        return Response(TransactionSummarySerializer(payload).data)


# ─────────────────────────────────────────────────────────────────────────────
# Detail (drawer)
# ─────────────────────────────────────────────────────────────────────────────
class TransactionDetailView(APIView):
    """
    GET /api/v1/dashboard/transactions/<uuid:pk>/

    One transaction, fully hydrated for the drawer: the fields the
    row already shows, plus `payload` (raw Daraja body) and `timeline`
    (payment lifecycle events).

    Prefetches `events` and `reversals` so both relationships stay one
    round-trip. `reconciliations` is prefetched too, so a future
    history panel reads it without an extra query.
    """

    permission_classes = [IsFinanceStaff]

    def get(self, request, pk):
        payment = (
            _ledger_base_queryset()
            .prefetch_related("events", "reconciliations", "reversals")
            .filter(pk=pk)
            .first()
        )
        if not payment:
            return _error("Transaction not found.", http_status=404)
        return Response(TransactionSerializer(payment).data)


# ─────────────────────────────────────────────────────────────────────────────
# CSV export
# ─────────────────────────────────────────────────────────────────────────────
_CSV_COLUMNS = [
    "M-Pesa Ref",
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
    GET  /api/v1/dashboard/transactions/export/   filtered
    POST /api/v1/dashboard/transactions/export/   bulk ids

    Same filters as the list view for GET. POST accepts
    `{ "ids": ["<uuid>", ...] }` and streams only those rows.
    """

    permission_classes = [IsFinanceStaff]

    def get(self, request):
        qs = _filtered_ledger_qs(request)
        return self._stream_csv(qs, filename="transactions.csv")

    def post(self, request):
        ser = BulkExportSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ids = ser.validated_data["ids"]
        qs = _ledger_base_queryset().filter(pk__in=ids)
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


# ─────────────────────────────────────────────────────────────────────────────
# Retry
# ─────────────────────────────────────────────────────────────────────────────
class TransactionRetryView(APIView):
    """
    POST /api/v1/dashboard/transactions/<uuid:pk>/retry/

    Re-fires the STK push for a failed M-Pesa attempt. The service
    creates a NEW Payment row (never mutates the failed one) and
    returns it in the ledger row shape so the frontend can append it
    without a refetch.
    """

    permission_classes = [IsFinanceStaff]

    def post(self, request, pk):
        ser = RetryPaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        phone_override = (ser.validated_data.get("phone_number") or "").strip() or None

        payment = _ledger_base_queryset().filter(pk=pk).first()
        if not payment:
            return _error("Transaction not found.", http_status=404)

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
            return _error(str(exc), code="mpesa_error", http_status=502)
        except CheckoutError as exc:
            return _error(str(exc), code="checkout_error")

        return Response(
            TransactionSerializer(new_payment).data,
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Reconcile
# ─────────────────────────────────────────────────────────────────────────────
class TransactionReconcileView(APIView):
    """
    POST /api/v1/dashboard/transactions/<uuid:pk>/reconcile/

    Manual finance action. Maps the modal's title-case status onto
    `ReconciliationLog.Action`:

        'Matched'   → MATCHED
        'Unmatched' → UNMATCHED

    `CASH_PAID` and `ON_ACCOUNT` are NOT exposed here — they have
    distinct side effects (flipping a Payment to SUCCESS, spawning an
    invoice) that belong to their own flows. This view stays a pure
    audit-log writer.

    Every call writes a `ReconciliationLog` row. A `MATCHED` action
    with a changed `orderNumber` also re-links the payment.
    """

    permission_classes = [IsFinanceStaff]

    _ACTION_MAP = {
        "Matched":   ReconciliationLog.Action.MATCHED,
        "Unmatched": ReconciliationLog.Action.UNMATCHED,
    }

    def post(self, request, pk):
        ser = ReconcilePaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        payment = _ledger_base_queryset().filter(pk=pk).first()
        if not payment:
            return _error("Transaction not found.", http_status=404)

        try:
            reconcile_payment(
                payment=payment,
                action=self._ACTION_MAP[ser.validated_data["status"]],
                order_reference=(ser.validated_data.get("orderNumber") or "").strip(),
                note=(ser.validated_data.get("note") or "").strip(),
                actor=request.user,
            )
        except CheckoutError as exc:
            return _error(str(exc), code="reconcile_error")

        # Re-fetch so the response reflects any re-linked order fields.
        payment = _ledger_base_queryset().filter(pk=payment.pk).first()
        return Response(TransactionSerializer(payment).data)