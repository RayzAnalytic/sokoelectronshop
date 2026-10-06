from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role, Status


# ─────────────────────────────────────────────────────────────────────────────
# Shared base
# ─────────────────────────────────────────────────────────────────────────────
class _ActiveBase(BasePermission):
    """
    Every role gate requires:
      * an authenticated user,
      * is_active == True,
      * status == ACTIVE.

    SUSPENDED and PENDING accounts are rejected even if they hold the
    right role — this is the choke point that keeps a suspended user
    from doing anything with a still-valid session cookie.

    `is_active` is enforced by Django's auth backend on session load
    (returns AnonymousUser if False), but we check it here too — cheap,
    and it catches the case where a user object was cached in memory
    before the flag flipped.
    """

    message = "Your account is not active."

    def _ok(self, user) -> bool:
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_active", True)
            and getattr(user, "status", None) == Status.ACTIVE
        )


# ─────────────────────────────────────────────────────────────────────────────
# Role gates
# ─────────────────────────────────────────────────────────────────────────────
class IsOwner(_ActiveBase):
    """OWNER only — the highest privilege tier."""

    message = "Owner access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role == Role.OWNER


class IsOwnerOrStaff(_ActiveBase):
    """OWNER or STAFF — the admin panel tier."""

    message = "Admin access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role in (Role.OWNER, Role.STAFF)


class IsStaffOnly(_ActiveBase):
    """
    STAFF only, excluding OWNER.

    Useful when an action must not be performable by the owner account
    itself (e.g. audit-visible changes that require a second pair of
    hands). Add this only if you actually have such a rule — otherwise
    it's dead code.
    """

    message = "Staff access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role == Role.STAFF


class IsCustomer(_ActiveBase):
    """CUSTOMER only — storefront self-service."""

    message = "Customer access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.role == Role.CUSTOMER


class IsAdminRole(_ActiveBase):
    """
    Alias that mirrors `User.is_admin_role` on the model.

    Prefer this over importing IsOwnerOrStaff when the check is really
    "is this an admin-tier user" and you don't want the permission name
    to drift if a third admin role is added later.
    """

    message = "Admin access required."

    def has_permission(self, request, view):
        return self._ok(request.user) and request.user.is_admin_role


# ─────────────────────────────────────────────────────────────────────────────
# Composite gates
# ─────────────────────────────────────────────────────────────────────────────
class IsSelfOrAdmin(_ActiveBase):
    """
    Object-level gate: allow if the target user IS the requester, or
    the requester is OWNER/STAFF.

    Assumes the view passes the target `User` as the object (or sets
    `obj.user`). If the view has no object yet (list/create), only the
    admin branch applies.

    IMPORTANT: `has_permission` must be overridden here. Without it,
    DRF's `BasePermission.has_permission` returns True unconditionally,
    which means list/create endpoints would accept requests from
    anonymous or suspended users — the object-level check only runs on
    detail routes.
    """

    message = "You can only access your own account."

    def has_permission(self, request, view):
        # Any active user may reach the view. Whether they can actually
        # touch the *specific object* is decided per-object below.
        return self._ok(request.user)

    def has_object_permission(self, request, view, obj):
        if not self._ok(request.user):
            return False
        if request.user.is_admin_role:
            return True
        # Accept either a User instance or anything with `.user`.
        target = getattr(obj, "user", obj)
        return target == request.user


class ReadOnly(BasePermission):
    """
    Allow any authenticated user to GET/HEAD/OPTIONS, block writes.
    Useful for endpoints that are read-only for customers but writable
    for admins via a different permission class.
    """

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


class IsAnyActiveUser(_ActiveBase):
    """
    OWNER + STAFF + CUSTOMER, all gated on ACTIVE. Equivalent to
    "any signed-in, active user" regardless of role.

    Use this for endpoints that every logged-in user can reach — e.g.
    "view my own orders", "update my own profile".
    """

    message = "Authentication required."

    def has_permission(self, request, view):
        return self._ok(request.user)


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: usable-password gate
# ─────────────────────────────────────────────────────────────────────────────
class HasUsablePassword(BasePermission):
    """
    Reject users whose password is unusable (Google-only signups that
    never set a password).

    Use on endpoints that *require* a password to be meaningful — e.g.
    "change my password", "enable 2FA via password confirmation".
    Without this, a Google-only user hitting those endpoints would
    pass authentication but fail in confusing ways deeper in the view.
    """

    message = "This action requires a password. Set one first."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return user.has_usable_password()