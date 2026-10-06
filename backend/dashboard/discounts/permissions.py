# discounts/permissions.py

from rest_framework.permissions import BasePermission


class IsStaff(BasePermission):
    """
    Only authenticated staff may access the dashboard discounts API.

    This is stricter than the storefront's permissions — the dashboard
    has no public read path. Every action, including `list` and
    `retrieve`, requires `is_staff=True`.
    """
    message = "Staff access required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )