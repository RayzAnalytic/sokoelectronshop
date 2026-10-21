import logging
from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.models import Order

from . import services
from .models import Refund, ReturnReason, ReturnRequest, ReturnSettings
from .serializers import (
    RefundCreateSerializer,
    RefundSerializer,
    ReturnReasonSerializer,
    ReturnRefundMethodSerializer,
    ReturnRequestCreateSerializer,
    ReturnRequestSerializer,
    ReturnSettingsSerializer,
    ReturnStatusUpdateSerializer,
)

logger = logging.getLogger(__name__)


class IsReturnsStaff(BasePermission):
    message = 'Only returns staff can access this resource.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return bool(getattr(user, 'is_staff', False))


def _error(message, code='error', http_status=400):
    return Response({'code': code, 'detail': message}, status=http_status)


class ReturnListCreateView(APIView):
    permission_classes = [IsReturnsStaff]

    def get(self, request):
        qs = (
            ReturnRequest.objects
            .select_related('order', 'reason')
            .prefetch_related('items')
        )

        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(code__icontains=q)
                | Q(order__reference__icontains=q)
                | Q(customer_name__icontains=q)
                | Q(customer_email__icontains=q)
            )

        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'ALL':
            qs = qs.filter(status=status_filter)

        refund_filter = request.query_params.get('refund_status')
        if refund_filter and refund_filter != 'ALL':
            qs = qs.filter(refund_status=refund_filter)

        sort = request.query_params.get('sort')
        if sort == 'oldest':
            qs = qs.order_by('requested_at')
        elif sort == 'amount_high':
            qs = qs.order_by('-original_amount')
        elif sort == 'amount_low':
            qs = qs.order_by('original_amount')
        else:
            qs = qs.order_by('-requested_at')

        return Response(ReturnRequestSerializer(qs, many=True).data)

    def post(self, request):
        ser = ReturnRequestCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        order = Order.objects.filter(
            reference=ser.validated_data['order_id'],
        ).first()
        if not order:
            return _error('Order not found.', http_status=404)

        reason = None
        reason_id = ser.validated_data.get('reason_id')
        if reason_id:
            reason = ReturnReason.objects.filter(pk=reason_id).first()

        try:
            req = services.create_return_request(
                order=order,
                reason=reason,
                reason_text=ser.validated_data.get('reason_text', ''),
                notes=ser.validated_data.get('notes', ''),
                items=ser.validated_data['items'],
                actor=request.user,
            )
        except ValueError as exc:
            return _error(str(exc), code='return_error')

        return Response(
            ReturnRequestSerializer(req).data,
            status=status.HTTP_201_CREATED,
        )


class ReturnDetailView(APIView):
    permission_classes = [IsReturnsStaff]

    def _get(self, pk):
        return (
            ReturnRequest.objects
            .select_related('order', 'reason')
            .prefetch_related('items')
            .filter(pk=pk)
            .first()
        )

    def get(self, request, pk):
        req = self._get(pk)
        if not req:
            return _error('Return not found.', http_status=404)
        return Response(ReturnRequestSerializer(req).data)

    def patch(self, request, pk):
        req = self._get(pk)
        if not req:
            return _error('Return not found.', http_status=404)

        data = request.data

        if 'internalNotes' in data:
            req.internal_notes = data.get('internalNotes') or ''
            req.save(update_fields=['internal_notes', 'updated_at'])

        if 'refundMethod' in data:
            m_ser = ReturnRefundMethodSerializer(
                data={'refund_method': data.get('refundMethod')},
            )
            m_ser.is_valid(raise_exception=True)
            req.refund_method = m_ser.validated_data['refund_method']
            req.save(update_fields=['refund_method', 'updated_at'])

        if 'status' in data:
            s_ser = ReturnStatusUpdateSerializer(data={'status': data['status']})
            s_ser.is_valid(raise_exception=True)
            new_status = s_ser.validated_data['status']

            if new_status == ReturnRequest.Status.APPROVED:
                services.approve_return(req, actor=request.user)
            elif new_status == ReturnRequest.Status.REJECTED:
                services.reject_return(req, actor=request.user)
            elif new_status == ReturnRequest.Status.ITEM_RECEIVED:
                services.mark_item_received(req, actor=request.user)
            else:
                req.status = new_status
                req.save(update_fields=['status', 'updated_at'])

        req.refresh_from_db()
        return Response(ReturnRequestSerializer(req).data)


class ReturnApproveView(APIView):
    permission_classes = [IsReturnsStaff]

    def post(self, request, pk):
        req = ReturnRequest.objects.filter(pk=pk).first()
        if not req:
            return _error('Return not found.', http_status=404)
        services.approve_return(req, actor=request.user)
        return Response(ReturnRequestSerializer(req).data)


class ReturnRejectView(APIView):
    permission_classes = [IsReturnsStaff]

    def post(self, request, pk):
        req = ReturnRequest.objects.filter(pk=pk).first()
        if not req:
            return _error('Return not found.', http_status=404)
        note = (request.data.get('note') or '').strip()
        services.reject_return(req, actor=request.user, note=note)
        return Response(ReturnRequestSerializer(req).data)


class ReturnRefundView(APIView):
    permission_classes = [IsReturnsStaff]

    def post(self, request, pk):
        req = ReturnRequest.objects.filter(pk=pk).first()
        if not req:
            return _error('Return not found.', http_status=404)

        ser = RefundCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        services.process_refund(
            req,
            actor=request.user,
            method=ser.validated_data.get('method'),
            reference=ser.validated_data.get('reference', ''),
            note=ser.validated_data.get('note', ''),
        )
        return Response(ReturnRequestSerializer(req).data)


class ReturnRefundMethodView(APIView):
    permission_classes = [IsReturnsStaff]

    def patch(self, request, pk):
        req = ReturnRequest.objects.filter(pk=pk).first()
        if not req:
            return _error('Return not found.', http_status=404)

        ser = ReturnRefundMethodSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        req.refund_method = ser.validated_data['refund_method']
        req.save(update_fields=['refund_method', 'updated_at'])
        return Response(ReturnRequestSerializer(req).data)


class RefundListView(APIView):
    permission_classes = [IsReturnsStaff]

    def get(self, request):
        qs = (
            Refund.objects
            .select_related('return_request', 'return_request__order')
        )
        q = (request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(return_request__code__icontains=q)
                | Q(return_request__order__reference__icontains=q)
                | Q(return_request__customer_name__icontains=q)
            )
        return Response(RefundSerializer(qs, many=True).data)


class ReturnReasonListCreateView(APIView):
    permission_classes = [IsReturnsStaff]

    def get(self, request):
        qs = ReturnReason.objects.all()
        return Response(ReturnReasonSerializer(qs, many=True).data)

    def post(self, request):
        ser = ReturnReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        reason = ReturnReason.objects.create(**ser.validated_data)
        return Response(
            ReturnReasonSerializer(reason).data,
            status=status.HTTP_201_CREATED,
        )


class ReturnReasonDetailView(APIView):
    permission_classes = [IsReturnsStaff]

    def patch(self, request, pk):
        reason = ReturnReason.objects.filter(pk=pk).first()
        if not reason:
            return _error('Reason not found.', http_status=404)
        ser = ReturnReasonSerializer(reason, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk):
        reason = ReturnReason.objects.filter(pk=pk).first()
        if not reason:
            return _error('Reason not found.', http_status=404)
        reason.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReturnStatsView(APIView):
    permission_classes = [IsReturnsStaff]

    def get(self, request):
        now = timezone.now()
        last30 = now - timedelta(days=30)

        pending = ReturnRequest.objects.filter(
            status__in=[
                ReturnRequest.Status.REQUESTED,
                ReturnRequest.Status.UNDER_REVIEW,
            ],
        ).count()

        approved = ReturnRequest.objects.filter(
            status=ReturnRequest.Status.APPROVED,
        ).count()

        refunded_agg = Refund.objects.filter(
            status=Refund.Status.COMPLETED,
            completed_at__gte=last30,
        ).aggregate(total=Sum('amount'), n=Count('id'))

        resolved = ReturnRequest.objects.filter(resolved_at__isnull=False)
        days = [
            max((r.resolved_at - r.requested_at).days, 0)
            for r in resolved
        ]
        avg = round(sum(days) / len(days), 1) if days else 0.0

        return Response({
            'pending': pending,
            'approved': approved,
            'refunded30d': float(refunded_agg['total'] or 0),
            'completed30d': refunded_agg['n'] or 0,
            'avgDays': avg,
        })


class ReturnHistoryView(APIView):
    permission_classes = [IsReturnsStaff]

    def get(self, request):
        now = timezone.now()
        first_of_month = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0,
        )

        months = []
        for i in range(4):
            end = first_of_month - timedelta(days=i * 30)
            start = end.replace(day=1)
            next_month = (start + timedelta(days=32)).replace(day=1)

            agg = Refund.objects.filter(
                status=Refund.Status.COMPLETED,
                completed_at__gte=start,
                completed_at__lt=next_month,
            ).aggregate(total=Sum('amount'), n=Count('id'))

            orders_in_month = Order.objects.filter(
                created_at__gte=start, created_at__lt=next_month,
            ).count()
            return_count = ReturnRequest.objects.filter(
                requested_at__gte=start, requested_at__lt=next_month,
            ).count()

            rate = (
                f'{(return_count / orders_in_month * 100):.1f}%'
                if orders_in_month else '—'
            )

            months.append({
                'month': start.strftime('%b %Y'),
                'returns': return_count,
                'refunded': float(agg['total'] or 0),
                'rate': rate,
            })

        return Response(months)


class ReturnSettingsView(APIView):
    permission_classes = [IsReturnsStaff]

    def get(self, request):
        return Response(
            ReturnSettingsSerializer(ReturnSettings.load()).data,
        )

    def patch(self, request):
        ser = ReturnSettingsSerializer(
            ReturnSettings.load(), data=request.data, partial=True,
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)