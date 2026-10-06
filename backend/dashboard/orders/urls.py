from django.urls import path

from . import views

app_name = "dashboard_orders"

urlpatterns = [
    # ── List + aggregates ─────────────────────────────────────────────
    path(
        "",
        views.AdminOrderListView.as_view(),
        name="list",
    ),
    path(
        "stats/",
        views.AdminOrderStatsView.as_view(),
        name="stats",
    ),
    path(
        "tab-counts/",
        views.AdminOrderTabCountsView.as_view(),
        name="tab-counts",
    ),
    path(
        "export/",
        views.AdminOrderExportView.as_view(),
        name="export",
    ),

    # ── Detail + actions ──────────────────────────────────────────────
    # Suffix routes before the generic `<str:reference>/` so the
    # specific verb is never swallowed into the reference string.
    path(
        "<str:reference>/status/",
        views.AdminOrderStatusView.as_view(),
        name="status",
    ),
    path(
        "<str:reference>/tracking/",
        views.AdminOrderTrackingView.as_view(),
        name="tracking",
    ),
    path(
        "<str:reference>/refund/",
        views.AdminOrderRefundView.as_view(),
        name="refund",
    ),
    path(
        "<str:reference>/returned/",
        views.AdminOrderReturnView.as_view(),
        name="returned",
    ),
    path(
        "<str:reference>/notes/",
        views.AdminOrderNoteView.as_view(),
        name="notes",
    ),
    path(
        "<str:reference>/whatsapp/",
        views.AdminOrderWhatsAppView.as_view(),
        name="whatsapp",
    ),
    path(
        "<str:reference>/",
        views.AdminOrderDetailView.as_view(),
        name="detail",
    ),
]