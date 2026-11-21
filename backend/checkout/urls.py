from django.urls import path

from . import views

app_name = "checkout"

urlpatterns = [
    path("config/", views.CheckoutConfigView.as_view(), name="config"),
    path("payment-methods/", views.PaymentMethodsView.as_view(), name="payment-methods"),
    path("validate-coupon/", views.CouponValidateView.as_view(), name="validate-coupon"),

    path("orders/", views.OrderCreateView.as_view(), name="order-create"),
    path(
        "orders/<str:reference>/status/",
        views.OrderStatusChangeView.as_view(),
        name="order-status-change",
    ),
    path("orders/abandon/", views.AbandonOrderView.as_view(), name="order-abandon"),
    path(
        "orders/claim-guest/",
        views.ClaimGuestOrdersView.as_view(),
        name="order-claim-guest",
    ),

    path("payments/stk-push/", views.StkPushView.as_view(), name="stk-push"),
    path(
        "payments/by-reference/<str:reference>/",
        views.PaymentByReferenceView.as_view(),
        name="payment-by-reference",
    ),
    path(
        "payments/<uuid:pk>/",
        views.PaymentDetailView.as_view(),
        name="payment-detail",
    ),
    path(
        "payments/<uuid:pk>/cancel/",
        views.PaymentCancelView.as_view(),
        name="payment-cancel",
    ),

    path("cart/", views.CartView.as_view(), name="cart"),
    path("cart/items/", views.CartItemAddView.as_view(), name="cart-item-add"),
    path(
        "cart/items/<int:item_id>/",
        views.CartItemDetailView.as_view(),
        name="cart-item-detail",
    ),
    path("cart/merge/", views.CartMergeView.as_view(), name="cart-merge"),
    path("cart/snapshot/", views.CartSnapshotView.as_view(), name="cart-snapshot"),
    path("cart/restore/", views.CartRestoreView.as_view(), name="cart-restore"),

    path("mpesa/callback/", views.MpesaCallbackView.as_view(), name="mpesa-callback"),
    path("mpesa/timeout/", views.MpesaTimeoutView.as_view(), name="mpesa-timeout"),
    path(
        "mpesa/c2b/validation/",
        views.C2BValidationView.as_view(),
        name="mpesa-c2b-validation",
    ),
    path(
        "mpesa/c2b/confirmation/",
        views.C2BConfirmationView.as_view(),
        name="mpesa-c2b-confirmation",
    ),
]