from django.contrib import admin

from .models import Campaign, CampaignDispatch


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'campaign_type', 'status', 'scheduled_at', 'created_at')
    list_filter = ('status', 'campaign_type', 'audience_source')
    search_fields = ('name',)


@admin.register(CampaignDispatch)
class CampaignDispatchAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'channel', 'status', 'sent_at')
    list_filter = ('channel', 'status')
    search_fields = ('campaign__name',)