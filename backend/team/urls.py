# team/urls.py

from django.urls import path

from .views import (
    AcceptInviteView,
    RevokeInviteView,
    TeamInviteDetailView,
    TeamInviteListView,
)

app_name = "team"

urlpatterns = [
    # List + create
    path("invites/", TeamInviteListView.as_view(), name="invite-list"),

    # Detail + delete (soft revoke)
    path(
        "invites/<uuid:id>/",
        TeamInviteDetailView.as_view(),
        name="invite-detail",
    ),

    # Explicit revoke
    path(
        "invites/<uuid:id>/revoke/",
        RevokeInviteView.as_view(),
        name="invite-revoke",
    ),

    # Accept (public — email link target)
    path("accept/", AcceptInviteView.as_view(), name="accept-invite"),
]