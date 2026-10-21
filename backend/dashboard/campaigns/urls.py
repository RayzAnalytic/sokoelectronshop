from django.urls import path

from .views import (
    CampaignAnalyticsView,
    CampaignDetailView,
    CampaignDispatchView,
    CampaignListCreateView,
    CampaignPauseView,
    CampaignResumeView,
)

app_name = 'campaigns'

urlpatterns = [
    path('', CampaignListCreateView.as_view(), name='list'),
    path('<uuid:pk>/', CampaignDetailView.as_view(), name='detail'),
    path('<uuid:pk>/dispatch/', CampaignDispatchView.as_view(), name='dispatch'),
    path('<uuid:pk>/pause/', CampaignPauseView.as_view(), name='pause'),
    path('<uuid:pk>/resume/', CampaignResumeView.as_view(), name='resume'),
    path('<uuid:pk>/analytics/', CampaignAnalyticsView.as_view(), name='analytics'),
]