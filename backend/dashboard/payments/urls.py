from django.urls import path

from . import views

app_name = 'payments'

urlpatterns = [
    path(
        'config/',
        views.PaymentConfigView.as_view(),
        name='config',
    ),
    path(
        'config/test-connection/',
        views.PaymentTestConnectionView.as_view(),
        name='test-connection',
    ),
    path(
        'summary/',
        views.PaymentSummaryView.as_view(),
        name='summary',
    ),
    path(
        'transactions/',
        views.PaymentTransactionListView.as_view(),
        name='transaction-list',
    ),
    path(
        'transactions/summary/',
        views.PaymentTransactionSummaryView.as_view(),
        name='transaction-summary',
    ),
    path(
        'transactions/<uuid:pk>/',
        views.PaymentTransactionDetailView.as_view(),
        name='transaction-detail',
    ),
    path(
        'transactions/<uuid:pk>/retry/',
        views.PaymentTransactionRetryView.as_view(),
        name='transaction-retry',
    ),
    path(
        'transactions/<uuid:pk>/reconcile/',
        views.PaymentTransactionReconcileView.as_view(),
        name='transaction-reconcile',
    ),
]