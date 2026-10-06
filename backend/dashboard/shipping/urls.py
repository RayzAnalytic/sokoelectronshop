# dashboard/shipping/urls.py

"""
Mounted at /api/v1/dashboard/shipping/ in config/urls.py.

Route ordering matters for the zone subtree:
    `/zones/<pk>/rates/` and `/zones/<pk>/rates/<rate_id>/` are
    listed before `/zones/<pk>/` (which only handles DELETE). Django
    resolves top-down, so the more specific routes win.

COURIER ROUTES USE SLUG, NOT PK
    `/couriers/<slug:slug>/...` matches the `slug` field on
    `CourierConfig`. The `CourierConfigSerializer` exposes
    `id = slug`, so the frontend sends `easycoach`, never an integer.
    An `<int:pk>` route rejects the path segment before the view
    runs — that is a silent 404 with no view-level log line, which
    is the exact failure mode this converter exists to prevent.

    Every other resource keeps `<int:pk>` because every other
    serializer exposes the model's integer pk as `id`. If a future
    serializer renames `id` to `slug` / `reference` / anything else,
    the corresponding URL pattern must change with it.
"""

from django.urls import path

from . import views

app_name = "shipping"

urlpatterns = [
    # ── Reference data ─────────────────────────────────────────────────
    path("regions/", views.RegionsView.as_view(), name="regions"),

    # ── Zones & Rates ──────────────────────────────────────────────────
    path(
        "zones/",
        views.ZoneListCreateView.as_view(),
        name="zone-list-create",
    ),
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

    # ── Methods ────────────────────────────────────────────────────────
    path(
        "methods/",
        views.MethodListView.as_view(),
        name="method-list",
    ),
    path(
        "methods/<int:pk>/toggle/",
        views.MethodToggleView.as_view(),
        name="method-toggle",
    ),

    # ── Pickup locations ───────────────────────────────────────────────
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

    # ── Shipments (Tracking) ───────────────────────────────────────────
    path(
        "shipments/",
        views.ShipmentListView.as_view(),
        name="shipment-list",
    ),
    path(
        "shipments/<int:pk>/status/",
        views.ShipmentStatusView.as_view(),
        name="shipment-status",
    ),

    # ── Couriers (Providers) ───────────────────────────────────────────
    # `<slug:slug>` — matches `CourierConfig.slug`. The serializer
    # exposes `id = slug`, so this is what the frontend actually sends.
    # See the module docstring's note on courier routes.
    path(
        "couriers/",
        views.CourierListView.as_view(),
        name="courier-list",
    ),
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
]