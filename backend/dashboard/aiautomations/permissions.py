from __future__ import annotations

import re
from typing import Iterable

from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import AISettings


def _user_is_authenticated(user) -> bool:
    return bool(user and user.is_authenticated)


def _user_is_staff(user) -> bool:
    return bool(_user_is_authenticated(user) and user.is_staff)


def _user_is_superuser(user) -> bool:
    return bool(_user_is_authenticated(user) and user.is_superuser)


def _user_has_any_perm(user, codenames: Iterable[str]) -> bool:
    if not _user_is_authenticated(user):
        return False
    return any(user.has_perm(c) for c in codenames)


def _user_has_all_perms(user, codenames: Iterable[str]) -> bool:
    if not _user_is_authenticated(user):
        return False
    return all(user.has_perm(c) for c in codenames)


def ai_settings() -> AISettings:
    try:
        cfg = AISettings.get_solo()
    except Exception:
        cfg = None
    if cfg is None:
        cfg = AISettings.objects.order_by("pk").first()
    if cfg is None:
        cfg = AISettings.objects.create()
    return cfg


def _normalize_module_key(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z]", "", str(value).lower())


MODULE_READ_PERMS: dict[str, tuple[str, ...]] = {
    "overview": (
        "orders.view_order",
        "analytics.view_dashboard",
        "core.view_dashboard",
    ),
    "analytics": (
        "analytics.view_dashboard",
        "analytics.view_report",
    ),
    "reports": (
        "analytics.view_report",
        "reports.view_report",
    ),
    "orders": ("orders.view_order",),
    "transactions": (
        "payments.view_transaction",
        "orders.view_transaction",
    ),
    "payments": ("payments.view_payment",),
    "returns": (
        "orders.view_return",
        "orders.view_refund",
        "payments.view_refund",
    ),
    "returnsrefunds": (
        "orders.view_return",
        "orders.view_refund",
        "payments.view_refund",
    ),
    "refunds": (
        "orders.view_refund",
        "payments.view_refund",
    ),
    "products": ("catalog.view_product",),
    "categories": ("catalog.view_category",),
    "brands": ("catalog.view_brand",),
    "inventory": (
        "catalog.view_inventory",
        "catalog.view_stock",
    ),
    "suppliers": ("catalog.view_supplier",),
    "customers": ("customers.view_customer",),
    "users": ("accounts.view_user",),
    "reviews": ("reviews.view_review",),
    "shipping": ("shipping.view_shipment",),
    "discounts": ("marketing.view_discount",),
    "newsletter": ("marketing.view_subscriber",),
    "campaigns": ("marketing.view_campaign",),
    "banners": ("marketing.view_banner",),
    "banner": ("marketing.view_banner",),
    "social": ("marketing.view_socialpost",),
    "tiktok": ("marketing.view_tiktokorder",),
    "whatsapp": ("marketing.view_whatsappmessage",),
    "settings": (
        "ai.view_aisettings",
        "core.view_setting",
    ),
    "automations": ("ai.view_aiautomation",),
}

SENSITIVE_MODULES = {
    "customers",
    "payments",
    "transactions",
    "returns",
    "returnsrefunds",
    "refunds",
    "orders",
    "whatsapp",
    "users",
}

DESTRUCTIVE_MODULES = {
    "orders",
    "payments",
    "transactions",
    "returns",
    "returnsrefunds",
    "refunds",
    "customers",
    "discounts",
    "whatsapp",
}


class IsAdminUser(BasePermission):
    message = "Staff access required."

    def has_permission(self, request, view) -> bool:
        return _user_is_staff(request.user)


class IsSuperUser(BasePermission):
    message = "Superuser access required."

    def has_permission(self, request, view) -> bool:
        return _user_is_superuser(request.user)


class IsAIAssistantEnabled(BasePermission):
    message = "AI assistant is disabled."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        cfg = ai_settings()
        return bool(cfg and cfg.enabled)


class IsAIStreamingAllowed(BasePermission):
    message = "AI streaming is disabled."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        cfg = ai_settings()
        return bool(cfg and cfg.streaming_enabled)


class CanAccessAIModule(BasePermission):
    message = "You do not have permission to query this module."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False

        module_key = self._resolve_module_key(request, view)
        if not module_key:
            return True

        allowed = MODULE_READ_PERMS.get(module_key)
        if allowed is None:
            return False

        settings_row = ai_settings()
        if settings_row.allowed_modules and module_key not in settings_row.allowed_modules:
            return False

        return _user_has_any_perm(request.user, allowed)

    @staticmethod
    def _resolve_module_key(request, view) -> str:
        if hasattr(view, "get_module_key"):
            key = view.get_module_key(request)  # type: ignore[attr-defined]
            if key:
                return _normalize_module_key(key)

        key = getattr(view, "module_key", "") or ""
        if key:
            return _normalize_module_key(key)

        qp = request.query_params.get("module") if hasattr(request, "query_params") else None
        if qp:
            return _normalize_module_key(qp)

        data = getattr(request, "data", None)
        if isinstance(data, dict):
            for field in ("module", "module_key", "context_module"):
                value = data.get(field)
                if value:
                    return _normalize_module_key(value)
            context = data.get("context")
            if isinstance(context, dict):
                for field in ("module", "module_key", "label"):
                    value = context.get(field)
                    if value:
                        return _normalize_module_key(value)

        return ""


class CanAccessAllAIModules(BasePermission):
    message = "You do not have permission to access all modules."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True

        settings_row = ai_settings()
        allowed_modules = settings_row.allowed_modules or list(MODULE_READ_PERMS.keys())

        for module_key in allowed_modules:
            perms = MODULE_READ_PERMS.get(module_key)
            if not perms:
                continue
            if not _user_has_any_perm(request.user, perms):
                return False
        return True


class CanAccessSensitiveData(BasePermission):
    message = "You do not have permission to access sensitive customer or payment data."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return request.user.has_perm("ai.view_sensitive_ai_data")


class CanAccessModuleSensitiveData(BasePermission):
    message = "You do not have permission to access sensitive data in this module."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True

        module_key = CanAccessAIModule._resolve_module_key(request, view)
        if module_key not in SENSITIVE_MODULES:
            return True

        return request.user.has_perm("ai.view_sensitive_ai_data")


class CanPerformAIWriteActions(BasePermission):
    message = "AI write actions are disabled or you lack the required permission."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False

        if request.method in SAFE_METHODS:
            return True

        cfg = ai_settings()
        if not cfg or not cfg.allow_write_actions:
            return False

        if _user_is_superuser(request.user):
            return True

        required = self._resolve_required_perms(request, view)
        if not required:
            return False

        return _user_has_all_perms(request.user, required)

    @staticmethod
    def _resolve_required_perms(request, view) -> tuple[str, ...]:
        if hasattr(view, "get_required_write_perms"):
            perms = view.get_required_write_perms(request)  # type: ignore[attr-defined]
            if perms:
                return tuple(perms)

        perms = getattr(view, "required_write_perms", None)
        if perms:
            return tuple(perms)

        return ()


class RequiresConfirmation(BasePermission):
    message = "This action requires explicit confirmation."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False

        if request.method in SAFE_METHODS:
            return True

        cfg = ai_settings()
        if not cfg or not cfg.require_confirmation_for_destructive:
            return True

        data = getattr(request, "data", None) or {}
        confirmed = bool(
            data.get("confirmed")
            or data.get("confirm")
            or request.META.get("HTTP_X_AI_CONFIRM") == "1"
        )
        return confirmed


class IsDestructiveActionAllowed(BasePermission):
    message = "You do not have permission to perform destructive actions."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if request.method in SAFE_METHODS:
            return True
        if _user_is_superuser(request.user):
            return True
        return request.user.has_perm("ai.perform_destructive_ai_actions")


class IsDestructiveModuleBlocked(BasePermission):
    message = "Destructive actions are not permitted in this module."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if request.method in SAFE_METHODS:
            return True
        if _user_is_superuser(request.user):
            return True

        module_key = CanAccessAIModule._resolve_module_key(request, view)
        if module_key in DESTRUCTIVE_MODULES:
            return request.user.has_perm("ai.perform_destructive_ai_actions")
        return True


class IsConversationOwner(BasePermission):
    message = "You do not have access to this conversation."

    def has_object_permission(self, request, view, obj) -> bool:
        if not _user_is_staff(request.user):
            return False
        if obj is None:
            return False
        if obj.user_id == getattr(request.user, "id", None):
            return True
        return request.user.has_perm("ai.view_all_conversations")


class IsMessageOwner(BasePermission):
    message = "You do not have access to this message."

    def has_object_permission(self, request, view, obj) -> bool:
        if not _user_is_staff(request.user):
            return False
        if obj is None:
            return False
        conv = getattr(obj, "conversation", None)
        if conv is None:
            return False
        if conv.user_id == getattr(request.user, "id", None):
            return True
        return request.user.has_perm("ai.view_all_conversations")


class CanViewAllConversations(BasePermission):
    message = "You do not have permission to view all conversations."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return request.user.has_perm("ai.view_all_conversations")


class CanManageAutomations(BasePermission):
    message = "You do not have permission to manage automations."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True

        if request.method in SAFE_METHODS:
            return _user_has_any_perm(
                request.user,
                ("ai.view_aiautomation", "ai.change_aiautomation"),
            )

        return request.user.has_perm("ai.change_aiautomation")


class CanRunAutomations(BasePermission):
    message = "You do not have permission to run automations."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return _user_has_any_perm(
            request.user,
            ("ai.run_aiautomation", "ai.change_aiautomation"),
        )


class CanToggleAutomations(BasePermission):
    message = "You do not have permission to toggle automations."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return _user_has_any_perm(
            request.user,
            ("ai.toggle_aiautomation", "ai.change_aiautomation"),
        )


class CanViewAutomationRuns(BasePermission):
    message = "You do not have permission to view automation history."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return _user_has_any_perm(
            request.user,
            ("ai.view_aiautomationrun", "ai.view_aiautomation"),
        )


class CanManageAlerts(BasePermission):
    message = "You do not have permission to manage alerts."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        if request.method in SAFE_METHODS:
            return True
        return _user_has_any_perm(
            request.user,
            ("ai.change_aialert", "ai.dismiss_aialert"),
        )


class CanManageInsights(BasePermission):
    message = "You do not have permission to manage insights."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        if request.method in SAFE_METHODS:
            return True
        return _user_has_any_perm(
            request.user,
            ("ai.change_aiinsight", "ai.dismiss_aiinsight"),
        )


class CanViewAISettings(BasePermission):
    message = "You do not have permission to view AI settings."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return request.user.has_perm("ai.view_aisettings")


class CanEditAISettings(BasePermission):
    message = "You do not have permission to change AI settings."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return request.user.has_perm("ai.change_aisettings")


class CanViewAIUsage(BasePermission):
    message = "You do not have permission to view AI usage."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return _user_has_any_perm(
            request.user,
            ("ai.view_aiusagelog", "ai.view_aisettings"),
        )


class CanViewAIAuditLog(BasePermission):
    message = "You do not have permission to view the AI audit log."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return request.user.has_perm("ai.view_aiauditlog")


class CanExportAIData(BasePermission):
    message = "You do not have permission to export AI data."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        if _user_is_superuser(request.user):
            return True
        return request.user.has_perm("ai.export_aidata")


class CanSubmitAIFeedback(BasePermission):
    message = "You do not have permission to submit feedback."

    def has_permission(self, request, view) -> bool:
        return _user_is_staff(request.user)


class CanPreviewAIActions(BasePermission):
    message = "You do not have permission to preview actions."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False
        cfg = ai_settings()
        return bool(cfg and cfg.enabled)


class CanExecuteAIActions(BasePermission):
    message = "You do not have permission to execute actions."

    def has_permission(self, request, view) -> bool:
        if not _user_is_staff(request.user):
            return False

        cfg = ai_settings()
        if not cfg or not cfg.enabled:
            return False
        if not cfg.allow_write_actions:
            return False

        if _user_is_superuser(request.user):
            return True

        required = self._resolve_required_perms(request, view)
        if not required:
            return True

        return _user_has_all_perms(request.user, required)

    @staticmethod
    def _resolve_required_perms(request, view) -> tuple[str, ...]:
        if hasattr(view, "get_required_write_perms"):
            perms = view.get_required_write_perms(request)  # type: ignore[attr-defined]
            if perms:
                return tuple(perms)

        perms = getattr(view, "required_write_perms", None)
        if perms:
            return tuple(perms)

        return ()


ChatPermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
    CanAccessAIModule,
)

ChatSensitivePermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
    CanAccessAIModule,
    CanAccessModuleSensitiveData,
)

StreamPermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
    IsAIStreamingAllowed,
    CanAccessAIModule,
)

ConversationPermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
)

ConversationObjectPermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
    IsConversationOwner,
)

RunAutomationPermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
    CanManageAutomations,
    CanRunAutomations,
)

WriteActionPermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
    CanPerformAIWriteActions,
    RequiresConfirmation,
)

DestructiveActionPermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
    CanPerformAIWriteActions,
    IsDestructiveActionAllowed,
    RequiresConfirmation,
)

ActionPreviewPermissions = (
    IsAdminUser,
    CanPreviewAIActions,
    CanAccessAIModule,
)

ActionExecutePermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
    CanExecuteAIActions,
    RequiresConfirmation,
)

FeedbackPermissions = (
    IsAdminUser,
    IsAIAssistantEnabled,
    CanSubmitAIFeedback,
)

SettingsReadPermissions = (
    IsAdminUser,
    CanViewAISettings,
)

SettingsWritePermissions = (
    IsAdminUser,
    CanEditAISettings,
)

UsagePermissions = (
    IsAdminUser,
    CanViewAIUsage,
)

AuditPermissions = (
    IsAdminUser,
    CanViewAIAuditLog,
)

ExportPermissions = (
    IsAdminUser,
    CanExportAIData,
)