from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard.users'
    label = 'dashboard_users'
    verbose_name = 'Dashboard · Users & Roles'