from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import Automation, AutomationTemplate, AutomationStatus
from ..permissions import IsAdminUser
from ..serializers import AutomationSerializer, AutomationTemplateSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def automations_view(request):
    if request.method == 'GET':
        return Response(AutomationSerializer(Automation.objects.all(), many=True).data)

    data = request.data or {}
    trigger = data.get('trigger') or data.get('trigger_label') or 'Order placed'
    event = data.get('trigger_event') or _event_for_label(trigger)
    auto = Automation.objects.create(
        name=data.get('name') or 'New automation',
        trigger_event=event,
        trigger_label=trigger,
        conditions=data.get('conditions') or {},
        timing=data.get('timing') or 'Immediately',
        action_type=data.get('action_type') or 'Send WhatsApp',
        template=data.get('template') or '',
        variable_map=data.get('variable_map') or '',
        recipients=data.get('recipients') or 'Customer',
        admin_channel=data.get('admin_channel') or 'Email',
        status=data.get('status') or AutomationStatus.DRAFT,
    )
    return Response(AutomationSerializer(auto).data, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminUser])
def automation_detail(request, pk):
    auto = Automation.objects.filter(pk=pk).first()
    if not auto:
        return Response({'detail': 'Not found'}, status=404)

    if request.method == 'DELETE':
        auto.delete()
        return Response(status=204)

    s = AutomationSerializer(auto, data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def automation_status(request, pk):
    auto = Automation.objects.filter(pk=pk).first()
    if not auto:
        return Response({'detail': 'Not found'}, status=404)
    new_status = (request.data or {}).get('status')
    if new_status not in dict(AutomationStatus.choices):
        return Response({'detail': 'invalid status'}, status=400)
    auto.status = new_status
    auto.save(update_fields=['status'])
    return Response(AutomationSerializer(auto).data)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def templates_view(request):
    qs = AutomationTemplate.objects.all()
    return Response(AutomationTemplateSerializer(qs, many=True).data)


def _event_for_label(label: str) -> str:
    mapping = {
        'Order placed': 'order.placed',
        'Order status → Shipped': 'order.status.shipped',
        'Order status → Delivered': 'order.status.delivered',
        'Cart abandoned for 1 hour': 'cart.abandoned',
        'Order unpaid for 24 hours': 'order.unpaid.24h',
        'First message from new customer': 'customer.first_message',
        'Stock below threshold': 'stock.below_threshold',
        'Customer total spend > KES 50,000': 'customer.became_vip',
        'Creator sales logged': 'creator.sale_logged',
    }
    return mapping.get(label, 'order.placed')