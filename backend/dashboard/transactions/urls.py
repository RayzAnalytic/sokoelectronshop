# dashboard/transactions/urls.py

"""
Mounted at /api/v1/dashboard/transactions/ in config/urls.py.

Route ordering:
    `summary/` and `export/` are literals and sit BEFORE the generic
    `<uuid:pk>/` route. Django resolves top-down, and the UUID
    converter would reject "summary" on its own — but the explicit
    order documents the intent so a future edit cannot accidentally
    swap them.

    The suffixed routes (`<uuid:pk>/retry/`, `<uuid:pk>/reconcile/`)
    are disambiguated by their suffix and cannot collide with the
    bare `<uuid:pk>/`.
"""

from django.urls import path

from . import views

app_name = "transactions"

urlpatterns = [
    # List — the ledger table
    path("", views.TransactionListView.as_view(), name="list"),

    # Summary — the five cards
    path("summary/", views.TransactionSummaryView.as_view(), name="summary"),

    # CSV export — GET (filtered) and POST (bulk ids)
    path("export/", views.TransactionExportView.as_view(), name="export"),

    # Retry a failed M-Pesa attempt
    path("<uuid:pk>/retry/", views.TransactionRetryView.as_view(), name="retry"),

    # Manual reconciliation
    path(
        "<uuid:pk>/reconcile/",
        views.TransactionReconcileView.as_view(),
        name="reconcile",
    ),

    # Detail — LAST so the literals above are matched first
    path("<uuid:pk>/", views.TransactionDetailView.as_view(), name="detail"),
]