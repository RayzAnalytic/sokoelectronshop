# dashboard/users/urls.py
#
# Mounted at: /api/v1/admin/users/
#
# Admin-only staff management. Every view here is gated by
# IsStaff + one of IsAdminOrManager / IsAdministrator — see
# the permission_classes on each view.
#
# Invites live in their own URLconf (invites_urls.py) so the
# resource can sit at the top-level /api/v1/admin/invites/ prefix
# instead of nesting under /admin/users/.

from django.urls import path

from . import views

app_name = "dashboard_users"


urlpatterns = [
    # ── Literal-name routes FIRST ──────────────────────────
    #
    # Ordering is defensive, not mandatory: the UUID converter
    # below won't match "roles" or "me" anyway. But putting the
    # literals first means the intent reads top-to-bottom and a
    # future addition can't accidentally get shadowed by
    # `<uuid:pk>/`.

    # Current user's effective permission list — the sidebar
    # reads this to decide which nav items to render.
    path(
        "me/permissions/",
        views.MyPermissionsView.as_view(),
        name="user-me-permissions",
    ),

    # Role catalogue — read-only cards on the Roles tab.
    path(
        "roles/",
        views.RoleListView.as_view(),
        name="role-list",
    ),

    # Permission matrix — GET reads, PUT replaces the whole matrix.
    path(
        "permissions/",
        views.PermissionMatrixView.as_view(),
        name="permissions",
    ),

    # ── Users CRUD ─────────────────────────────────────────
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