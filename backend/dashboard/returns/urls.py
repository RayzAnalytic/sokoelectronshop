from django.urls import path

from . import views

app_name = 'returns'

urlpatterns = [
    path(
        '',
        views.ReturnListCreateView.as_view(),
        name='return-list-create',
    ),
    path(
        'stats/',
        views.ReturnStatsView.as_view(),
        name='return-stats',
    ),
    path(
        'history/',
        views.ReturnHistoryView.as_view(),
        name='return-history',
    ),
    path(
        'settings/',
        views.ReturnSettingsView.as_view(),
        name='return-settings',
    ),
    path(
        'reasons/',
        views.ReturnReasonListCreateView.as_view(),
        name='reason-list-create',
    ),
    path(
        'reasons/<int:pk>/',
        views.ReturnReasonDetailView.as_view(),
        name='reason-detail',
    ),
    path(
        'refunds/',
        views.RefundListView.as_view(),
        name='refund-list',
    ),
    path(
        '<int:pk>/',
        views.ReturnDetailView.as_view(),
        name='return-detail',
    ),
    path(
        '<int:pk>/approve/',
        views.ReturnApproveView.as_view(),
        name='return-approve',
    ),
    path(
        '<int:pk>/reject/',
        views.ReturnRejectView.as_view(),
        name='return-reject',
    ),
    path(
        '<int:pk>/refund/',
        views.ReturnRefundView.as_view(),
        name='return-refund',
    ),
    path(
        '<int:pk>/refund-method/',
        views.ReturnRefundMethodView.as_view(),
        name='return-refund-method',
    ),
]