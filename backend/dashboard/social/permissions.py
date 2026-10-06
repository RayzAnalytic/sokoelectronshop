"""
Access control for the social admin endpoints.

The whole app is dashboard-only, so every endpoint requires an authenticated
staff user. Swap `IsStaff` for whatever role gate the rest of your dashboard
uses — this is the same shape as the other `dashboard.*` sub-apps.
"""
from rest_framework.permissions import BasePermission


class IsStaff(BasePermission):
    """Allow only authenticated staff users."""

    message = "Staff access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


class IsAdminOrStaff(IsStaff):
    """Alias kept for readability at the view level."""