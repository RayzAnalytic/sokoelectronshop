from django.urls import path

from . import views

app_name = "reports"

urlpatterns = [
    path("sales/",      views.sales,     name="sales"),
    path("orders/",     views.orders,    name="orders"),
    path("customers/",  views.customers, name="customers"),
    path("products/",   views.products,  name="products"),
    path("inventory/",  views.inventory, name="inventory"),
    path("payments/",   views.payments,  name="payments"),
    path("taxes/",      views.taxes,     name="taxes"),
    path("shipping/",   views.shipping,  name="shipping"),
    path("discounts/",  views.discounts, name="discounts"),
    path("social/",     views.social,    name="social"),
    path("export/",     views.log_export,    name="export"),
    path("refresh/",    views.refresh_cache, name="refresh"),
]