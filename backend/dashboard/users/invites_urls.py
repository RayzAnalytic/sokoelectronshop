# dashboard/users/invites_urls.py
#
# Mounted at: /api/v1/admin/invites/
#
# Admin-only invite management. Split out from urls.py so the prefix
# can live at the top level (matching the frontend's API contract)
# rather than nested under /admin/users/.

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
