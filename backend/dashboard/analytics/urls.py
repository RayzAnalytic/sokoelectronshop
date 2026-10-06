from django.urls import path

from . import views

app_name = "analytics"

urlpatterns = [
    path("traffic/",   views.traffic,        name="traffic"),
    path("sales/",     views.sales,          name="sales"),
    path("customers/", views.customers,      name="customers"),
    path("products/",  views.products,       name="products"),
    path("channels/",  views.channels,       name="channels"),
    path("refresh/",   views.refresh_cache,  name="refresh"),
]