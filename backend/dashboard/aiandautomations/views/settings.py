from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import AISettings, AuditLog
from ..permissions import IsAdminUser
from ..serializers import AISettingsSerializer
from ..services.crypto import encrypt
from ..services.usage import monthly_summary


@api_view(['GET', 'PATCH'])
@permission_classes([IsAdminUser])
def settings_view(request):
    s = AISettings.get_solo()
    if request.method == 'PATCH':
        data = dict(request.data or {})
        api_key = data.pop('api_key', None)
        ser = AISettingsSerializer(s, data=data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        if api_key:
            s.api_key_encrypted = encrypt(api_key)
            s.save(update_fields=['api_key_encrypted'])
        AuditLog.objects.create(
            user=request.user, action='settings.update',
            detail={'provider': s.provider, 'model': s.model},
        )
        return Response(AISettingsSerializer(s).data)
    return Response(AISettingsSerializer(s).data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def disable_view(request):
    s = AISettings.get_solo()
    s.enabled = False
    s.save(update_fields=['enabled'])
    AuditLog.objects.create(user=request.user, action='ai.disable')
    return Response({'enabled': False})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def usage_view(request):
    return Response(monthly_summary())