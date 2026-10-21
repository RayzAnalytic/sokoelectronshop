from django.urls import path

from . import views

app_name = "shipping"

urlpatterns = [
    path("regions/", views.RegionsView.as_view(), name="regions"),

    path("zones/", views.ZoneListCreateView.as_view(), name="zone-list-create"),
    path(
        "zones/<int:pk>/rates/",
        views.ZoneRateAddView.as_view(),
        name="zone-rate-add",
    ),
    path(
        "zones/<int:pk>/rates/<int:rate_id>/",
        views.ZoneRateDeleteView.as_view(),
        name="zone-rate-delete",
    ),
    path(
        "zones/<int:pk>/",
        views.ZoneDetailView.as_view(),
        name="zone-detail",
    ),

    path("methods/", views.MethodListView.as_view(), name="method-list"),
    path(
        "methods/<int:pk>/toggle/",
        views.MethodToggleView.as_view(),
        name="method-toggle",
    ),

    path(
        "pickups/",
        views.PickupListCreateView.as_view(),
        name="pickup-list-create",
    ),
    path(
        "pickups/<int:pk>/toggle/",
        views.PickupToggleView.as_view(),
        name="pickup-toggle",
    ),
    path(
        "pickups/<int:pk>/",
        views.PickupDetailView.as_view(),
        name="pickup-detail",
    ),

    path("shipments/", views.ShipmentListView.as_view(), name="shipment-list"),
    path(
        "shipments/<int:pk>/status/",
        views.ShipmentStatusView.as_view(),
        name="shipment-status",
    ),

    path("couriers/", views.CourierListView.as_view(), name="courier-list"),
    path(
        "couriers/<slug:slug>/toggle/",
        views.CourierToggleView.as_view(),
        name="courier-toggle",
    ),
    path(
        "couriers/<slug:slug>/test/",
        views.CourierTestView.as_view(),
        name="courier-test",
    ),

    path(
        "public/zones/",
        views.PublicZoneListView.as_view(),
        name="public-zone-list",
    ),
    path(
        "public/zones/<int:pk>/",
        views.PublicZoneDetailView.as_view(),
        name="public-zone-detail",
    ),
]