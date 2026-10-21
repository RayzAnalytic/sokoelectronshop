from django.urls import path

from . import views

app_name = "transactions"

urlpatterns = [
    path("", views.TransactionListView.as_view(), name="list"),
    path("summary/", views.TransactionSummaryView.as_view(), name="summary"),
    path("export/", views.TransactionExportView.as_view(), name="export"),
    path("<uuid:pk>/retry/", views.TransactionRetryView.as_view(), name="retry"),
    path(
        "<uuid:pk>/reconcile/",
        views.TransactionReconcileView.as_view(),
        name="reconcile",
    ),
    path("<uuid:pk>/", views.TransactionDetailView.as_view(), name="detail"),
]