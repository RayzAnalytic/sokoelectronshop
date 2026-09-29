from rest_framework.permissions import BasePermission

from .models import Role, Status


class _ActiveBase(BasePermission):
    def _ok(self, user):
        return bool(user and user.is_authenticated and user.status == Status.ACTIVE)


class IsOwner(_ActiveBase):
    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role == Role.OWNER


class IsOwnerOrStaff(_ActiveBase):
    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role in (Role.OWNER, Role.STAFF)


class IsCustomer(_ActiveBase):
    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role == Role.CUSTOMER