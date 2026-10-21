from django.urls import path

from . import views

app_name = "dashboard_invites"


urlpatterns = [
    path(
        "",
        views.InviteListCreateView.as_view(),
        name="list-create",
    ),
    path(
        "<uuid:pk>/",
        views.InviteRevokeView.as_view(),
        name="revoke",
    ),
]
