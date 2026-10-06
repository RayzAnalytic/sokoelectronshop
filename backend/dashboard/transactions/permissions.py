# dashboard/transactions/permissions.py

from rest_framework.permissions import BasePermission


class IsFinanceStaff(BasePermission):
    """
    Gate for every endpoint under `/api/v1/dashboard/transactions/`.

    The ledger exposes every customer's financial history and allows
    manual reconciliation — it is not a customer-facing surface.

    Resolution order:

      1. Unauthenticated → deny. Never let an anonymous request even
         reach the queryset.
      2. Superuser       → allow. Same trust as Django admin.
      3. `is_staff`      → allow. The default flag on the stock User
         model. Replace this branch if your project uses a role
         column instead (e.g. `user.role in {"STAFF", "OWNER"}`).
      4. Everything else → deny.

    Kept deliberately narrow. If you later need a read-only finance
    analyst role, add a second permission class (`IsFinanceViewer`)
    and apply it per-view rather than widening this one.
    """

    message = "Only finance staff can access the transactions ledger."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return bool(getattr(user, "is_staff", False))