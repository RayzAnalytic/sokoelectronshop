from django.urls import path

from . import views

app_name = "dashboard_users"


urlpatterns = [
    path(
        "me/permissions/",
        views.MyPermissionsView.as_view(),
        name="user-me-permissions",
    ),

    path(
        "roles/",
        views.RoleListView.as_view(),
        name="role-list",
    ),

    path(
        "permissions/",
        views.PermissionMatrixView.as_view(),
        name="permissions",
    ),

    path(
        "",
        views.UserListView.as_view(),
        name="user-list",
    ),
    path(
        "<uuid:pk>/",
        views.UserDetailView.as_view(),
        name="user-detail",
    ),
    path(
        "<uuid:pk>/suspend/",
        views.toggle_suspend,
        name="user-suspend",
    ),
    path(
        "<uuid:pk>/reset-password/",
        views.reset_password,
        name="user-reset-password",
    ),
]