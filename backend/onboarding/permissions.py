# apps/onboarding/permissions.py

from rest_framework.permissions import BasePermission


class IsOnboardingOwner(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, obj, view):
        return getattr(obj, "user_id", None) == request.user.id