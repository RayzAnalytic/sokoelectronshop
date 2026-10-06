"""
URLs for the Direct Orders admin surface.

Mounted at /api/v1/dashboard/direct-orders/ in config/urls.py.

Route naming convention:
    /uploads/       — file uploads (images + videos)
    /orders/...     — order list, detail, actions
    /creators/...   — creator CRUD
    /content/...    — content post CRUD
    /lives/...      — live session CRUD
    /products/...   — direct product CRUD

Order routes use `<str:reference>` (e.g. "ORD-20261004-3F9A2C1D"),
not `<int:pk>` — orders are addressed by human-readable reference
throughout the app.
"""
from django.urls import path

from . import views

app_name = "direct_orders"

urlpatterns = [
    # ── File uploads ────────────────────────────────────────────────
    #
    # POST multipart/form-data:
    #   file: <binary>
    #   kind: "image" | "video"
    # → 200 { "url": "https://..." }
    #
    # Full path: /api/v1/dashboard/direct-orders/uploads/
    #
    # NOTE: the frontend's `uploadFile()` helper currently POSTs to
    # `/api/admin/uploads/`. Either:
    #   (a) change that constant in the frontend to the full path
    #       above, OR
    #   (b) add a second `path("uploads/", ...)` alias in config/urls.py
    #       at the `/api/admin/` prefix.
    # Option (a) is one line in the frontend; option (b) is one line
    # in config/urls.py. Pick whichever keeps your URL tree tidier.
    path("uploads/", views.UploadView.as_view(), name="upload"),

    # ── Orders ──────────────────────────────────────────────────────
    path("orders/", views.DirectOrderListView.as_view(), name="order-list"),
    path(
        "orders/<str:reference>/",
        views.DirectOrderDetailView.as_view(),
        name="order-detail",
    ),
    path(
        "orders/<str:reference>/advance/",
        views.DirectOrderAdvanceView.as_view(),
        name="order-advance",
    ),

    # ── Creators ────────────────────────────────────────────────────
    path("creators/", views.CreatorListCreateView.as_view(), name="creator-list"),
    path("creators/<int:pk>/", views.CreatorDetailView.as_view(), name="creator-detail"),

    # ── Content ─────────────────────────────────────────────────────
    path("content/", views.ContentListCreateView.as_view(), name="content-list"),
    path("content/<int:pk>/", views.ContentDetailView.as_view(), name="content-detail"),

    # ── Live sessions ───────────────────────────────────────────────
    path("lives/", views.LiveListCreateView.as_view(), name="live-list"),
    path("lives/<int:pk>/", views.LiveDetailView.as_view(), name="live-detail"),

    # ── Direct products ─────────────────────────────────────────────
    path("products/", views.DirectProductListCreateView.as_view(), name="product-list"),
    path("products/<int:pk>/", views.DirectProductDetailView.as_view(), name="product-detail"),
]