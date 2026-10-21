from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import SocialTeamMember, TeamRole


ROLE_RANK: dict[str, int] = {
    TeamRole.VIEWER:   0,
    TeamRole.APPROVER: 1,
    TeamRole.EDITOR:   2,
    TeamRole.ADMIN:    3,
    TeamRole.OWNER:    4,
}


def _user_role(user) -> str | None:
    if not user or not user.is_authenticated:
        return None
    if getattr(user, "is_superuser", False):
        return TeamRole.OWNER
    if getattr(user, "is_staff", False):
        profile = SocialTeamMember.objects.filter(user=user, is_active=True).first()
        if profile:
            return profile.role
        return TeamRole.ADMIN
    profile = SocialTeamMember.objects.filter(user=user, is_active=True).first()
    return profile.role if profile else None


def _has_min_role(user, min_role: str) -> bool:
    role = _user_role(user)
    if role is None:
        return False
    return ROLE_RANK.get(role, -1) >= ROLE_RANK.get(min_role, 99)


class IsStaff(BasePermission):
    message = "Staff access required."

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or user.is_superuser)
        )


class IsAdminOrStaff(IsStaff):
    pass


class IsSuperUser(BasePermission):
    message = "Superuser access required."

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.is_superuser)


class StaffOnly(BasePermission):
    message = "This endpoint is restricted to staff."

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return bool(user.is_staff or user.is_superuser)


class ReadOnly(BasePermission):
    message = "This endpoint is read-only."

    def has_permission(self, request, view) -> bool:
        return request.method in SAFE_METHODS


class IsStaffReadOnly(IsStaff):
    message = "Only superusers may modify connected accounts."

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.method in SAFE_METHODS:
            return True
        user = getattr(request, "user", None)
        return bool(user and user.is_superuser)


class HasMinRole(BasePermission):
    message = "Your role does not permit this action."
    min_role: str = TeamRole.VIEWER

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_superuser", False):
            return True
        return _has_min_role(user, self.min_role)


class CanView(HasMinRole):
    min_role = TeamRole.VIEWER


class CanApprove(HasMinRole):
    message = "Approver role or above required."
    min_role = TeamRole.APPROVER


class CanEdit(HasMinRole):
    message = "Editor role or above required."
    min_role = TeamRole.EDITOR


class CanPublish(HasMinRole):
    message = "Editor role or above required to publish."
    min_role = TeamRole.EDITOR


class CanManageAccounts(HasMinRole):
    message = "Admin role or above required to manage accounts."
    min_role = TeamRole.ADMIN


class CanManageTeam(HasMinRole):
    message = "Admin role or above required to manage the team."
    min_role = TeamRole.ADMIN


class CanViewAuditLog(HasMinRole):
    message = "Admin role or above required to view the audit log."
    min_role = TeamRole.ADMIN


class CanManageReports(HasMinRole):
    message = "Editor role or above required to manage reports."
    min_role = TeamRole.EDITOR


class CanManageMedia(HasMinRole):
    message = "Editor role or above required to manage the media library."
    min_role = TeamRole.EDITOR


class CanManageInbox(HasMinRole):
    message = "Editor role or above required to manage the inbox."
    min_role = TeamRole.EDITOR


class CanManageQueue(HasMinRole):
    message = "Editor role or above required to manage queue slots."
    min_role = TeamRole.EDITOR


class CanManageTemplates(HasMinRole):
    message = "Editor role or above required to manage templates."
    min_role = TeamRole.EDITOR


class CanManageLinks(HasMinRole):
    message = "Editor role or above required to manage links."
    min_role = TeamRole.EDITOR


class CanManageSettings(HasMinRole):
    message = "Admin role or above required to manage settings."
    min_role = TeamRole.ADMIN


class IsOwnerOrStaff(BasePermission):
    message = "You do not have access to this post."

    def has_object_permission(self, request, view, obj) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True

        owner = getattr(obj, "created_by", None)
        if owner is None:
            post = getattr(obj, "post", None)
            owner = getattr(post, "created_by", None)
        if owner is None:
            draft = getattr(obj, "source_post", None)
            owner = getattr(draft, "created_by", None)

        return owner_id_matches(user, owner)


def owner_id_matches(user, owner) -> bool:
    if owner is None or user is None:
        return False
    return getattr(owner, "pk", None) == getattr(user, "pk", None)


class IsDraftAuthorOrApprover(BasePermission):
    message = "Only the draft author or an approver may perform this action."

    def has_object_permission(self, request, view, obj) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        if _has_min_role(user, TeamRole.APPROVER):
            return True
        author = getattr(obj, "author", None)
        return owner_id_matches(user, author)


class IsInboxAssigneeOrStaff(BasePermission):
    message = "Only the assigned editor or an admin may perform this action."

    def has_object_permission(self, request, view, obj) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        if _has_min_role(user, TeamRole.ADMIN):
            return True
        assignee = getattr(obj, "assigned_to", None)
        if assignee is None:
            return True
        return owner_id_matches(user, assignee)


class HasConnectedAccount(BasePermission):
    message = "This platform is not connected."

    def has_object_permission(self, request, view, obj) -> bool:
        account = resolve_account(obj)
        if account is None:
            return True
        return bool(account.is_connected and not account.is_token_expired)


class HasValidToken(BasePermission):
    message = "OAuth token expired — reconnect the account."

    def has_object_permission(self, request, view, obj) -> bool:
        account = resolve_account(obj)
        if account is None:
            return True
        if not account.is_connected:
            return False
        return not account.is_token_expired


class HasScopes(BasePermission):
    message = "The connected account is missing required permissions."
    required_scopes: tuple[str, ...] = ()

    def has_object_permission(self, request, view, obj) -> bool:
        if not self.required_scopes:
            return True
        account = resolve_account(obj)
        if account is None:
            return True
        granted = set(account.scopes or [])
        return all(scope in granted for scope in self.required_scopes)


class CanPublishToChannel(HasConnectedAccount, HasValidToken):
    message = "Cannot publish to this channel — reconnect the account."

    def has_object_permission(self, request, view, obj) -> bool:
        if not HasConnectedAccount.has_object_permission(self, request, view, obj):
            return False
        return HasValidToken.has_object_permission(self, request, view, obj)


def resolve_account(obj):
    if hasattr(obj, "is_connected") and hasattr(obj, "platform"):
        return obj

    account = getattr(obj, "account", None)
    if account is not None:
        return account

    platform = getattr(obj, "platform", None)
    if platform:
        try:
            from social.models import SocialAccount
            return SocialAccount.objects.filter(platform=platform).first()
        except Exception:
            return None

    return None


__all__ = [
    "IsStaff",
    "IsAdminOrStaff",
    "IsSuperUser",
    "StaffOnly",
    "ReadOnly",
    "IsStaffReadOnly",
    "HasMinRole",
    "CanView",
    "CanApprove",
    "CanEdit",
    "CanPublish",
    "CanManageAccounts",
    "CanManageTeam",
    "CanViewAuditLog",
    "CanManageReports",
    "CanManageMedia",
    "CanManageInbox",
    "CanManageQueue",
    "CanManageTemplates",
    "CanManageLinks",
    "CanManageSettings",
    "IsOwnerOrStaff",
    "IsDraftAuthorOrApprover",
    "IsInboxAssigneeOrStaff",
    "HasConnectedAccount",
    "HasValidToken",
    "HasScopes",
    "CanPublishToChannel",
    "resolve_account",
    "owner_id_matches",
]