from django.urls import path

from checkout.views import StickerDataView

from . import views

app_name = "dashboard_orders"

urlpatterns = [
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
    path(
        "verify-qr/",
        views.AdminOrderVerifyQRView.as_view(),
        name="verify-qr",
    ),

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
        "<str:reference>/pdf/",
        views.AdminOrderPdfView.as_view(),
        name="pdf",
    ),
    path(
        "<str:reference>/fulfill-qr/",
        views.AdminOrderFulfillQRView.as_view(),
        name="fulfill-qr",
    ),
    path(
        "<str:reference>/sticker/<int:item_id>/",
        StickerDataView.as_view(),
        name="sticker",
    ),
    path(
        "<str:reference>/",
        views.AdminOrderDetailView.as_view(),
        name="detail",
    ),
]