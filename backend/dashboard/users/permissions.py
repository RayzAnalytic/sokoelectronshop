# dashboard/users/permissions.py

from rest_framework.permissions import BasePermission

from .constants import ROLE_ADMIN, ROLE_MANAGER
from .models import ModulePermission, StaffProfile, UserStatus


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def _get_staff_profile(request) -> StaffProfile | None:
    """
    Return the StaffProfile for the request's user, or None.

    Memoized on the request so a view with two permission classes
    (e.g. [IsStaff, HasModulePermission]) triggers one query, not two.

    Anonymous requests short-circuit without touching the DB.
    """
    if not request.user or not request.user.is_authenticated:
        return None

    cached = getattr(request, "_staff_profile_cache", None)
    if cached is not None:
        # Sentinel: we stored the result (even if None) on a previous
        # call. Sentinel is the tuple (found, profile).
        _, profile = cached
        return profile

    profile = StaffProfile.for_user(request.user)
    request._staff_profile_cache = (True, profile)
    return profile


def _is_active_staff(profile: StaffProfile | None) -> bool:
    """A staff profile exists and isn't suspended."""
    return profile is not None and profile.status != UserStatus.SUSPENDED


def _has_module_grant(profile: StaffProfile, module: str) -> bool:
    """
    True iff the profile's role has `granted=True` for `module`.

    Administrators are short-circuited: the matrix UI locks the
    Administrator column, and the seed always grants everything, so
    a live query would be redundant. This also protects against a
    migration that accidentally leaves an Administrator row ungranted.
    """
    if profile.role == ROLE_ADMIN:
        return True

    cache = getattr(profile, "_module_cache", None)
    if cache is None:
        cache = {}
        profile._module_cache = cache

    if module in cache:
        return cache[module]

    granted = ModulePermission.objects.filter(
        module=module,
        role=profile.role,
        granted=True,
    ).exists()

    cache[module] = granted
    return granted


# ─────────────────────────────────────────────────────────────
# Permission classes
# ─────────────────────────────────────────────────────────────
class IsStaff(BasePermission):
    """
    Any authenticated user who has a StaffProfile and isn't suspended.

    Use this on every dashboard endpoint that doesn't need a
    role-specific gate. It's the baseline — an endpoint that only
    says `IsStaff` is accessible to every active staff member.
    """
    message = "Staff access required."

    def has_permission(self, request, view):
        return _is_active_staff(_get_staff_profile(request))


class IsAdministrator(BasePermission):
    """
    Only the Administrator role.

    Use this for endpoints that touch other staff (creating invites,
    editing the permission matrix, deleting users).
    """
    message = "Administrator access required."

    def has_permission(self, request, view):
        profile = _get_staff_profile(request)
        if not _is_active_staff(profile):
            return False
        return profile.role == ROLE_ADMIN


class IsAdminOrManager(BasePermission):
    """
    Administrator or Manager.

    The default for read-heavy admin endpoints: they need someone
    who can see everything but don't require the elevation
    Administrator implies.
    """
    message = "Administrator or Manager access required."

    def has_permission(self, request, view):
        profile = _get_staff_profile(request)
        if not _is_active_staff(profile):
            return False
        return profile.role in (ROLE_ADMIN, ROLE_MANAGER)


class HasModulePermission(BasePermission):
    """
    Gate any dashboard endpoint by the permission matrix.

    Reads `view.module_name` — a string that must match a
    `ModulePermission.module` value exactly. Use the MODULES
    constant to avoid typos:

        from dashboard.users.constants import MODULES

        class ProductViewSet(viewsets.ModelViewSet):
            module_name = MODULES['PRODUCTS']
            permission_classes = [IsStaff, HasModulePermission]

    Multiple modules:

        module_name = [MODULES['PRODUCTS'], MODULES['INVENTORY']]

    In that case the user needs at least one of the listed modules.

    A view with no `module_name` denies everyone. That's deliberate:
    forgetting to declare the module should fail closed, not open.
    """
    message = "You do not have access to this module."

    def has_permission(self, request, view):
        profile = _get_staff_profile(request)
        if not _is_active_staff(profile):
            return False

        modules = getattr(view, "module_name", None)
        if not modules:
            return False

        if isinstance(modules, str):
            modules = [modules]

        return any(_has_module_grant(profile, m) for m in modules)


# ─────────────────────────────────────────────────────────────
# Mixins — attach module_name without cluttering each viewset
# ─────────────────────────────────────────────────────────────
class ModuleScopedViewSetMixin:
    """
    Convenience mixin that wires `module_name` and the standard
    permission pair together.

    Usage:

        class ProductViewSet(ModuleScopedViewSetMixin, viewsets.ModelViewSet):
            module_key = 'PRODUCTS'          # from MODULES
            ...
    """
    module_key: str | None = None  # subclasses override

    def get_permissions(self):
        from .constants import MODULES

        if self.module_key and self.module_key in MODULES:
            # Set on the instance so HasModulePermission can read it.
            self.module_name = MODULES[self.module_key]

        return [IsStaff(), HasModulePermission()]


class AdministratorOnlyMixin:
    """
    Restrict a viewset to Administrators.

    Usage:

        class StaffInviteViewSet(AdministratorOnlyMixin, viewsets.ModelViewSet):
            ...
    """
    def get_permissions(self):
        return [IsAdministrator()]