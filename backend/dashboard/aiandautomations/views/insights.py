from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import Insight
from ..permissions import IsAdminUser
from ..serializers import InsightSerializer


@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_view(request):
    qs = Insight.objects.filter(dismissed_at__isnull=True)
    cat = request.query_params.get('category')
    if cat and cat != 'all':
        qs = qs.filter(category=cat)
    return Response(InsightSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def dismiss_view(request, pk):
    ins = Insight.objects.filter(pk=pk).first()
    if not ins:
        return Response({'detail': 'Not found'}, status=404)
    ins.dismissed_at = timezone.now()
    ins.save(update_fields=['dismissed_at'])
    return Response(status=204)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def execute_view(request, pk):
    ins = Insight.objects.filter(pk=pk).first()
    if not ins:
        return Response({'detail': 'Not found'}, status=404)
    return Response({'redirect': ins.action_link})