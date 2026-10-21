from django.apps import AppConfig


class DashboardUsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard.users'
    label = 'dashboard_users'

    def ready(self):
        from . import signals