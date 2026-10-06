from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..permissions import IsAdminUser
from ..services.overview import build_overview


@api_view(['GET'])
@permission_classes([IsAdminUser])
def overview_view(request):
    return Response(build_overview())