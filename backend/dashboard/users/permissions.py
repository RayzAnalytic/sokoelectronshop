from rest_framework.permissions import BasePermission

from .constants import ROLE_ADMIN, ROLE_MANAGER
from .models import ModulePermission, StaffProfile, UserStatus


def _get_staff_profile(request) -> StaffProfile | None:
    if not request.user or not request.user.is_authenticated:
        return None

    cached = getattr(request, "_staff_profile_cache", None)
    if cached is not None:
        _, profile = cached
        return profile

    profile = StaffProfile.for_user(request.user)
    request._staff_profile_cache = (True, profile)
    return profile


def _is_active_staff(profile: StaffProfile | None) -> bool:
    return profile is not None and profile.status != UserStatus.SUSPENDED


def _has_module_grant(profile: StaffProfile, module: str) -> bool:
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


class IsStaff(BasePermission):
    message = "Staff access required."

    def has_permission(self, request, view):
        return _is_active_staff(_get_staff_profile(request))


class IsAdministrator(BasePermission):
    message = "Administrator access required."

    def has_permission(self, request, view):
        profile = _get_staff_profile(request)
        if not _is_active_staff(profile):
            return False
        return profile.role == ROLE_ADMIN


class IsAdminOrManager(BasePermission):
    message = "Administrator or Manager access required."

    def has_permission(self, request, view):
        profile = _get_staff_profile(request)
        if not _is_active_staff(profile):
            return False
        return profile.role in (ROLE_ADMIN, ROLE_MANAGER)


class HasModulePermission(BasePermission):
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


class ModuleScopedViewSetMixin:
    module_key: str | None = None

    def get_permissions(self):
        from .constants import MODULES

        if self.module_key and self.module_key in MODULES:
            self.module_name = MODULES[self.module_key]

        return [IsStaff(), HasModulePermission()]


class AdministratorOnlyMixin:
    def get_permissions(self):
        return [IsAdministrator()]