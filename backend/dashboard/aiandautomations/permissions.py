from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Only staff/admin users can hit AI endpoints."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_staff or u.is_superuser))