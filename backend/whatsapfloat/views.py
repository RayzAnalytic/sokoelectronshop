from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WhatsAppConfig
from .serializers import WhatsAppConfigSerializer


class WhatsAppConfigView(APIView):
    """
    GET /api/whatsapp/config/

    Public — no authentication required. The storefront widget calls this
    on mount and renders itself if `enabled` is true.

    If no config row exists yet, we return `{ "enabled": false }` so the
    widget silently hides instead of erroring.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        config = WhatsAppConfig.objects.first()
        if config is None or not config.enabled:
            return Response({'enabled': False})
        return Response(WhatsAppConfigSerializer(config).data)