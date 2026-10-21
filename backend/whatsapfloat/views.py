from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WhatsAppConfig
from .serializers import WhatsAppConfigSerializer


class WhatsAppConfigView(APIView):
    permission_classes = [AllowAny]
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        config = WhatsAppConfig.objects.first()
        if config is None or not config.enabled:
            return Response({'enabled': False})
        return Response(WhatsAppConfigSerializer(config).data)