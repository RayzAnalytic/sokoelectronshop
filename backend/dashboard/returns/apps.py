from django.apps import AppConfig


class ReturnsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard.returns'
    label = 'returns'
    verbose_name = 'Returns & Refunds'