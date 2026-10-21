from rest_framework.permissions import BasePermission


class IsFinanceStaff(BasePermission):
    message = "Only finance staff can access the transactions ledger."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return bool(getattr(user, "is_staff", False))