from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Campaign
from .serializers import CampaignSerializer, CampaignWriteSerializer
from .services import aggregate_analytics, dispatch_campaign


class CampaignListCreateView(generics.ListCreateAPIView):
    queryset = Campaign.objects.all().prefetch_related('dispatches')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CampaignWriteSerializer
        return CampaignSerializer

    def create(self, request, *args, **kwargs):
        write = self.get_serializer(data=request.data)
        write.is_valid(raise_exception=True)
        data = write.validated_data

        campaign = Campaign.objects.create(
            name=data['name'],
            campaign_type=data['campaign_type'],
            audience_source=data.get('audience_source', Campaign.AudienceSource.ALL),
            audience_ref_id=data.get('audience_ref_id', ''),
            scheduled_at=data.get('scheduled_at'),
            channels=data['channels'],
            content=data.get('content', {}),
            created_by=request.user if request.user.is_authenticated else None,
        )
        return Response(
            CampaignSerializer(campaign).data,
            status=status.HTTP_201_CREATED,
        )


class CampaignDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Campaign.objects.all().prefetch_related('dispatches')
    serializer_class = CampaignSerializer


class CampaignDispatchView(APIView):
    def post(self, request, pk):
        campaign = Campaign.objects.filter(pk=pk).first()
        if not campaign:
            return Response({'detail': 'Not found'}, status=404)
        dispatch_campaign(campaign)
        campaign.refresh_from_db()
        return Response(CampaignSerializer(campaign).data)


class CampaignPauseView(APIView):
    def post(self, request, pk):
        campaign = Campaign.objects.filter(pk=pk).first()
        if not campaign:
            return Response({'detail': 'Not found'}, status=404)
        campaign.status = Campaign.Status.PAUSED
        campaign.save(update_fields=['status', 'updated_at'])
        return Response(CampaignSerializer(campaign).data)


class CampaignResumeView(APIView):
    def post(self, request, pk):
        campaign = Campaign.objects.filter(pk=pk).first()
        if not campaign:
            return Response({'detail': 'Not found'}, status=404)
        dispatch_campaign(campaign)
        campaign.refresh_from_db()
        return Response(CampaignSerializer(campaign).data)


class CampaignAnalyticsView(APIView):
    def get(self, request, pk):
        campaign = Campaign.objects.filter(pk=pk).first()
        if not campaign:
            return Response({'detail': 'Not found'}, status=404)
        return Response(aggregate_analytics(campaign))