from django.apps import AppConfig


class CampaignsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard.campaigns'
    label = 'campaigns'
    verbose_name = 'Campaigns'