# payments/urls.py

from django.urls import path

from .views import (
    DusupayInitiateView,
    PesapalInitiateView,
    MpesaInitiateView,
    PaymentListView,
    PaymentDetailView,
)
from .callbacks.dusupay_callback import DusupayCallbackView
from .callbacks.pesapal_ipn import PesapalIPNView
from .callbacks.mpesa_callback import MpesaCallbackView


app_name = "payments"


urlpatterns = [
    # ─────────────────────────────────────────────────────
    # READS — user's own payments
    # ─────────────────────────────────────────────────────
    path("", PaymentListView.as_view(), name="payment-list"),
    path("<uuid:id>/", PaymentDetailView.as_view(), name="payment-detail"),

    # ─────────────────────────────────────────────────────
    # INITIATION — authenticated user starts a payment
    # ─────────────────────────────────────────────────────
    path(
        "dusupay/initiate/",
        DusupayInitiateView.as_view(),
        name="dusupay-initiate",
    ),
    path(
        "pesapal/initiate/",
        PesapalInitiateView.as_view(),
        name="pesapal-initiate",
    ),
    path(
        "mpesa/initiate/",
        MpesaInitiateView.as_view(),
        name="mpesa-initiate",
    ),

    # ─────────────────────────────────────────────────────
    # CALLBACKS — public, called by gateways
    # ─────────────────────────────────────────────────────
    path(
        "dusupay/callback/",
        DusupayCallbackView.as_view(),
        name="dusupay-callback",
    ),
    path(
        "pesapal/ipn/",
        PesapalIPNView.as_view(),
        name="pesapal-ipn",
    ),
    path(
        "mpesa/callback/",
        MpesaCallbackView.as_view(),
        name="mpesa-callback",
    ),
]