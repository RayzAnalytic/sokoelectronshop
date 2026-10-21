import logging

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.models import Payment
from checkout.serializers import (
    TransactionSerializer,
    TransactionSummarySerializer,
)

from . import services
from .serializers import (
    PaymentConfigReadSerializer,
    PaymentConfigWriteSerializer,
    PaymentTestResultSerializer,
)

logger = logging.getLogger(__name__)


class IsPaymentsStaff(BasePermission):
    message = 'Only payments staff can access this resource.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return bool(getattr(user, 'is_staff', False))


def _error(message, code='error', http_status=400):
    return Response({'code': code, 'detail': message}, status=http_status)


class PaymentConfigView(APIView):
    permission_classes = [IsPaymentsStaff]

    def get(self, request):
        return Response(
            PaymentConfigReadSerializer(services.get_config_dict()).data,
        )

    def patch(self, request):
        ser = PaymentConfigWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        updated = services.update_config(
            ser.validated_data, actor=request.user,
        )
        return Response(PaymentConfigReadSerializer(updated).data)


class PaymentTestConnectionView(APIView):
    permission_classes = [IsPaymentsStaff]

    def post(self, request):
        result = services.test_connection()
        return Response(PaymentTestResultSerializer(result).data)


class PaymentSummaryView(APIView):
    permission_classes = [IsPaymentsStaff]

    def get(self, request):
        now = timezone.now()
        start_today = now.replace(
            hour=0, minute=0, second=0, microsecond=0,
        )

        qs = Payment.objects.all()

        success = qs.filter(status=Payment.Status.SUCCESS)
        pending = qs.filter(
            status__in=[
                Payment.Status.PENDING,
                Payment.Status.PROCESSING,
            ],
        )
        failed = qs.filter(
            status__in=[
                Payment.Status.FAILED,
                Payment.Status.TIMEOUT,
                Payment.Status.CANCELLED,
            ],
        )

        totals = qs.aggregate(
            successful=Sum('amount', filter=Q(status=Payment.Status.SUCCESS)),
            pending=Sum('amount', filter=Q(
                status__in=[
                    Payment.Status.PENDING,
                    Payment.Status.PROCESSING,
                ],
            )),
            failed=Sum('amount', filter=Q(
                status__in=[
                    Payment.Status.FAILED,
                    Payment.Status.TIMEOUT,
                    Payment.Status.CANCELLED,
                ],
            )),
            fees=Sum('fee', filter=Q(status=Payment.Status.SUCCESS)),
        )

        today_success = success.filter(created_at__gte=start_today)
        today_volume = today_success.aggregate(t=Sum('amount'))['t'] or 0

        total_count = qs.count()
        success_count = success.count()
        success_rate = (
            round((success_count / total_count) * 100, 2)
            if total_count
            else 0.0
        )

        return Response({
            'total_records': total_count,
            'success_count': success_count,
            'pending_count': pending.count(),
            'failed_count': failed.count(),
            'refund_pending_count': Payment.objects.filter(
                reversals__isnull=False,
            ).distinct().count(),
            'total_volume': str(totals['successful'] or 0),
            'total_pending': str(totals['pending'] or 0),
            'total_failed': str(totals['failed'] or 0),
            'total_fees': str(totals['fees'] or 0),
            'today_volume': str(today_volume),
            'success_rate': success_rate,
        })


class PaymentTransactionListView(APIView):
    permission_classes = [IsPaymentsStaff]

    def get(self, request):
        qs = (
            Payment.objects
            .select_related('order', 'order__user')
            .prefetch_related('events', 'reversals')
            .order_by('-created_at')
        )

        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(mpesa_receipt_number__icontains=q)
                | Q(order__reference__icontains=q)
                | Q(phone_number__icontains=q)
                | Q(order__contact_email__icontains=q)
                | Q(order__snapshot__full_name__icontains=q)
            )

        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter)

        method_filter = request.query_params.get('method')
        if method_filter and method_filter != 'ALL':
            qs = qs.filter(method=method_filter)

        try:
            limit = int(request.query_params.get('limit', 200))
        except (TypeError, ValueError):
            limit = 200
        limit = max(1, min(limit, 500))

        return Response(TransactionSerializer(qs[:limit], many=True).data)


class PaymentTransactionDetailView(APIView):
    permission_classes = [IsPaymentsStaff]

    def get(self, request, pk):
        payment = (
            Payment.objects
            .select_related('order', 'order__user')
            .prefetch_related('events', 'reversals')
            .filter(pk=pk)
            .first()
        )
        if not payment:
            return _error('Payment not found.', http_status=404)
        return Response(TransactionSerializer(payment).data)


class PaymentTransactionSummaryView(APIView):
    permission_classes = [IsPaymentsStaff]

    def get(self, request):
        qs = Payment.objects.all()

        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(mpesa_receipt_number__icontains=q)
                | Q(order__reference__icontains=q)
                | Q(phone_number__icontains=q)
            )

        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter)

        method_filter = request.query_params.get('method')
        if method_filter and method_filter != 'ALL':
            qs = qs.filter(method=method_filter)

        total_successful = qs.filter(
            status=Payment.Status.SUCCESS,
        ).aggregate(t=Sum('amount'))['t'] or 0
        total_pending = qs.filter(
            status__in=[
                Payment.Status.PENDING,
                Payment.Status.PROCESSING,
            ],
        ).aggregate(t=Sum('amount'))['t'] or 0
        total_failed = qs.filter(
            status__in=[
                Payment.Status.FAILED,
                Payment.Status.TIMEOUT,
                Payment.Status.CANCELLED,
            ],
        ).aggregate(t=Sum('amount'))['t'] or 0
        total_fees = qs.filter(
            status=Payment.Status.SUCCESS,
        ).aggregate(t=Sum('fee'))['t'] or 0

        net = total_successful - total_fees

        payload = {
            'totalSuccessful': str(total_successful),
            'totalPending': str(total_pending),
            'totalFailed': str(total_failed),
            'totalFees': str(total_fees),
            'netAmount': str(net),
            'transactionCount': qs.count(),
            'perMethod': {},
        }

        for method in ('MPESA', 'COD'):
            sub = qs.filter(method=method)
            payload['perMethod'][method] = {
                'label': method,
                'successful': str(
                    sub.filter(status=Payment.Status.SUCCESS)
                    .aggregate(t=Sum('amount'))['t'] or 0
                ),
                'pending': str(
                    sub.filter(status__in=[
                        Payment.Status.PENDING,
                        Payment.Status.PROCESSING,
                    ]).aggregate(t=Sum('amount'))['t'] or 0
                ),
                'failed': str(
                    sub.filter(status__in=[
                        Payment.Status.FAILED,
                        Payment.Status.TIMEOUT,
                        Payment.Status.CANCELLED,
                    ]).aggregate(t=Sum('amount'))['t'] or 0
                ),
                'fees': str(
                    sub.filter(status=Payment.Status.SUCCESS)
                    .aggregate(t=Sum('fee'))['t'] or 0
                ),
                'count': sub.count(),
            }

        return Response(
            TransactionSummarySerializer(payload).data
            if False else payload
        )


class PaymentTransactionRetryView(APIView):
    permission_classes = [IsPaymentsStaff]

    def post(self, request, pk):
        payment = Payment.objects.filter(pk=pk).first()
        if not payment:
            return _error('Payment not found.', http_status=404)

        phone = (request.data.get('phone_number') or '').strip() or None

        try:
            new_payment = services.retry_payment(
                payment, actor=request.user, phone=phone,
            )
        except Exception as exc:
            logger.exception('Retry failed for payment %s', pk)
            return _error(str(exc), code='retry_error')

        return Response(
            TransactionSerializer(new_payment).data,
            status=status.HTTP_201_CREATED,
        )


class PaymentTransactionReconcileView(APIView):
    permission_classes = [IsPaymentsStaff]

    def post(self, request, pk):
        payment = Payment.objects.filter(pk=pk).first()
        if not payment:
            return _error('Payment not found.', http_status=404)

        action = (request.data.get('status') or '').strip()
        if action not in ('Matched', 'Unmatched', 'Cash Paid'):
            return _error(
                "status must be 'Matched', 'Unmatched', or 'Cash Paid'.",
                code='invalid_status',
            )

        try:
            updated = services.reconcile_payment(
                payment,
                action=action,
                order_reference=(request.data.get('orderNumber') or '').strip(),
                note=(request.data.get('note') or '').strip(),
                actor=request.user,
            )
        except Exception as exc:
            logger.exception('Reconcile failed for payment %s', pk)
            return _error(str(exc), code='reconcile_error')

        return Response(TransactionSerializer(updated).data)