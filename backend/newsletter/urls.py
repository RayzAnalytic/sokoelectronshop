# newsletter/urls.py
from django.urls import path

from .views_public import (
    SubscribeView,
    UnsubscribeView,
    UnsubscribeLinkView,
)

app_name = "newsletter"

urlpatterns = [
    # POST /api/v1/newsletter/subscribe/
    # Storefront signup form (footer popup, checkout opt-in, etc.).
    path(
        "subscribe/",
        SubscribeView.as_view(),
        name="subscribe",
    ),

    # POST /api/v1/newsletter/unsubscribe/
    # Programmatic unsubscribe — accepts email OR token in the body.
    # Token takes precedence if both are supplied.
    path(
        "unsubscribe/",
        UnsubscribeView.as_view(),
        name="unsubscribe",
    ),

    # GET /api/v1/newsletter/unsubscribe/<uuid>/
    # Browser-friendly one-click link used in campaign email footers.
    # Renders an HTML page and marks the subscriber inactive in one request.
    # UUID converter means Django validates the token shape before the view
    # runs — an invalid token yields a 404, not a crash.
    path(
        "unsubscribe/<uuid:token>/",
        UnsubscribeLinkView.as_view(),
        name="unsubscribe-link",
    ),
]