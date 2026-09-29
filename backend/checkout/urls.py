from django.urls import path

from . import views

app_name = "checkout"

urlpatterns = [
    # Config + coupon
    path("config/", views.CheckoutConfigView.as_view(), name="config"),
    path(
        "validate-coupon/",
        views.CouponValidateView.as_view(),
        name="validate-coupon",
    ),

    # Payments
    path(
        "payments/stk-push/",
        views.StkPushView.as_view(),
        name="stk-push",
    ),
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

    # M-Pesa callbacks (public)
    path(
        "mpesa/callback/",
        views.MpesaCallbackView.as_view(),
        name="mpesa-callback",
    ),
    path(
        "mpesa/timeout/",
        views.MpesaTimeoutView.as_view(),
        name="mpesa-timeout",
    ),
]