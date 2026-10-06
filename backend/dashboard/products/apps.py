# dashboard/products/apps.py
from django.apps import AppConfig
class ProductsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard.products"
    label = "dashboard_products"   # important, otherwise label collisions later