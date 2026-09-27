# admin_dashboard/views/overview_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser

from admin_dashboard.models.overview import get_dashboard_stats
from admin_dashboard.serializers.overview_serializer import DashboardStatsSerializer


class DashboardOverviewView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(DashboardStatsSerializer(get_dashboard_stats()).data)
