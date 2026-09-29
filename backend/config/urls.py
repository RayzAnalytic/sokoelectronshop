from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth
    path("api/v1/auth/", include("authentication.urls")),

    # Checkout (orders, coupons, payments, mpesa callbacks)
    path("api/v1/checkout/", include("checkout.urls")),

    # Account (profile, addresses, notifications, reviews, wishlist)
    path("api/v1/account/", include("account.urls")),

    # API schema + docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="docs",
    ),
]