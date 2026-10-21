from django.urls import path

from . import views

app_name = "direct_orders"

urlpatterns = [
    path("uploads/", views.UploadView.as_view(), name="upload"),

    path(
        "logged/",
        views.DirectOrderListCreateView.as_view(),
        name="logged-list",
    ),
    path(
        "logged/<str:reference>/",
        views.DirectOrderDetailView.as_view(),
        name="logged-detail",
    ),
    path(
        "logged/<str:reference>/advance/",
        views.DirectOrderStatusAdvanceView.as_view(),
        name="logged-advance",
    ),

    path(
        "orders/",
        views.CheckoutOrderListView.as_view(),
        name="order-list",
    ),
    path(
        "orders/<str:reference>/",
        views.CheckoutOrderDetailView.as_view(),
        name="order-detail",
    ),
    path(
        "orders/<str:reference>/advance/",
        views.CheckoutOrderAdvanceView.as_view(),
        name="order-advance",
    ),

    path(
        "creators/",
        views.CreatorListCreateView.as_view(),
        name="creator-list",
    ),
    path(
        "creators/<int:pk>/",
        views.CreatorDetailView.as_view(),
        name="creator-detail",
    ),

    path(
        "creator-sales/",
        views.CreatorSaleListCreateView.as_view(),
        name="creator-sale-list",
    ),
    path(
        "creator-sales/<int:pk>/",
        views.CreatorSaleDetailView.as_view(),
        name="creator-sale-detail",
    ),

    path(
        "payouts/",
        views.PayoutBatchListCreateView.as_view(),
        name="payout-list",
    ),
    path(
        "payouts/<int:pk>/",
        views.PayoutBatchDetailView.as_view(),
        name="payout-detail",
    ),

    path(
        "content/",
        views.ContentListCreateView.as_view(),
        name="content-list",
    ),
    path(
        "content/<int:pk>/",
        views.ContentDetailView.as_view(),
        name="content-detail",
    ),

    path(
        "lives/",
        views.LiveListCreateView.as_view(),
        name="live-list",
    ),
    path(
        "lives/<int:pk>/",
        views.LiveDetailView.as_view(),
        name="live-detail",
    ),

    path(
        "products/",
        views.DirectProductListCreateView.as_view(),
        name="product-list",
    ),
    path(
        "products/<int:pk>/",
        views.DirectProductDetailView.as_view(),
        name="product-detail",
    ),

    path(
        "variants/",
        views.ProductVariantListCreateView.as_view(),
        name="variant-list",
    ),
    path(
        "variants/<int:pk>/",
        views.ProductVariantDetailView.as_view(),
        name="variant-detail",
    ),

    path(
        "suppliers/",
        views.SupplierListCreateView.as_view(),
        name="supplier-list",
    ),
    path(
        "suppliers/<int:pk>/",
        views.SupplierDetailView.as_view(),
        name="supplier-detail",
    ),

    path(
        "purchase-orders/",
        views.PurchaseOrderListCreateView.as_view(),
        name="purchase-order-list",
    ),
    path(
        "purchase-orders/<int:pk>/",
        views.PurchaseOrderDetailView.as_view(),
        name="purchase-order-detail",
    ),

    path(
        "locations/",
        views.LocationListCreateView.as_view(),
        name="location-list",
    ),
    path(
        "locations/<int:pk>/",
        views.LocationDetailView.as_view(),
        name="location-detail",
    ),

    path(
        "inventory/movements/",
        views.InventoryMovementListCreateView.as_view(),
        name="inventory-movement-list",
    ),
    path(
        "inventory/movements/<int:pk>/",
        views.InventoryMovementDetailView.as_view(),
        name="inventory-movement-detail",
    ),
    path(
        "inventory/summary/",
        views.InventorySummaryView.as_view(),
        name="inventory-summary",
    ),

    path(
        "customers/",
        views.CustomerListCreateView.as_view(),
        name="customer-list",
    ),
    path(
        "customers/stats/",
        views.CustomerStatsView.as_view(),
        name="customer-stats",
    ),
    path(
        "customers/<int:pk>/",
        views.CustomerDetailView.as_view(),
        name="customer-detail",
    ),

    path(
        "inbox/",
        views.InboxConversationListCreateView.as_view(),
        name="inbox-list",
    ),
    path(
        "inbox/<int:pk>/",
        views.InboxConversationDetailView.as_view(),
        name="inbox-detail",
    ),
    path(
        "inbox/<int:pk>/convert/",
        views.InboxConvertView.as_view(),
        name="inbox-convert",
    ),
    path(
        "inbox/messages/",
        views.InboxMessageListCreateView.as_view(),
        name="inbox-message-list",
    ),

    path(
        "team/",
        views.TeamMemberListCreateView.as_view(),
        name="team-list",
    ),
    path(
        "team/<int:pk>/",
        views.TeamMemberDetailView.as_view(),
        name="team-detail",
    ),

    path(
        "returns/",
        views.ReturnRequestListCreateView.as_view(),
        name="return-list",
    ),
    path(
        "returns/<int:pk>/",
        views.ReturnRequestDetailView.as_view(),
        name="return-detail",
    ),

    path(
        "expenses/",
        views.ExpenseListCreateView.as_view(),
        name="expense-list",
    ),
    path(
        "expenses/<int:pk>/",
        views.ExpenseDetailView.as_view(),
        name="expense-detail",
    ),

    path(
        "automations/",
        views.AutomationListCreateView.as_view(),
        name="automation-list",
    ),
    path(
        "automations/<int:pk>/",
        views.AutomationDetailView.as_view(),
        name="automation-detail",
    ),

    path(
        "notifications/",
        views.NotificationListView.as_view(),
        name="notification-list",
    ),
    path(
        "notifications/<int:pk>/read/",
        views.NotificationMarkReadView.as_view(),
        name="notification-read",
    ),
    path(
        "notifications/read-all/",
        views.NotificationMarkAllReadView.as_view(),
        name="notification-read-all",
    ),

    path(
        "audit/",
        views.AuditLogListView.as_view(),
        name="audit-list",
    ),

    path(
        "reviews/",
        views.ReviewListCreateView.as_view(),
        name="review-list",
    ),
    path(
        "reviews/<int:pk>/",
        views.ReviewDetailView.as_view(),
        name="review-detail",
    ),

    path(
        "delivery-zones/",
        views.DeliveryZoneListCreateView.as_view(),
        name="delivery-zone-list",
    ),
    path(
        "delivery-zones/<int:pk>/",
        views.DeliveryZoneDetailView.as_view(),
        name="delivery-zone-detail",
    ),

    path(
        "coupons/",
        views.CouponListCreateView.as_view(),
        name="coupon-list",
    ),
    path(
        "coupons/<int:pk>/",
        views.CouponDetailView.as_view(),
        name="coupon-detail",
    ),

    path(
        "campaigns/",
        views.CampaignListCreateView.as_view(),
        name="campaign-list",
    ),
    path(
        "campaigns/<int:pk>/",
        views.CampaignDetailView.as_view(),
        name="campaign-detail",
    ),

    path(
        "attribution/",
        views.AttributionLinkListCreateView.as_view(),
        name="attribution-list",
    ),
    path(
        "attribution/<int:pk>/",
        views.AttributionLinkDetailView.as_view(),
        name="attribution-detail",
    ),

    path(
        "analytics/summary/",
        views.AnalyticsSummaryView.as_view(),
        name="analytics-summary",
    ),
    path(
        "finance/summary/",
        views.FinanceSummaryView.as_view(),
        name="finance-summary",
    ),
]