# ai/tests.py

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    AIAlert,
    AIAuditLog,
    AIAutomation,
    AIAutomationRun,
    AIConversation,
    AIInsight,
    AIMessage,
    AISettings,
    AIToolCall,
    AIUsageLog,
)
from .permissions import (
    CanAccessAIModule,
    CanAccessAllAIModules,
    CanAccessSensitiveData,
    CanEditAISettings,
    CanManageAlerts,
    CanManageAutomations,
    CanManageInsights,
    CanPerformAIWriteActions,
    CanRunAutomations,
    CanToggleAutomations,
    CanViewAIAuditLog,
    CanViewAIUsage,
    IsAIAssistantEnabled,
    IsAdminUser,
    IsConversationOwner,
    IsSuperUser,
    RequiresConfirmation,
)
from .serializers import (
    AIAlertSerializer,
    AIAuditLogSerializer,
    AIAutomationCreateSerializer,
    AIAutomationRunSerializer,
    AIAutomationSerializer,
    AIConversationSerializer,
    AIInsightSerializer,
    AIMessageSerializer,
    AISettingsSerializer,
    AISettingsUpdateSerializer,
    AIToolCallSerializer,
    AIUsageSerializer,
)
from .tools import execute_tool

User = get_user_model()


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def make_staff(username: str = "admin", **extra):
    return User.objects.create_user(
        username, f"{username}@b.c", "pw", is_staff=True, **extra
    )


def make_superuser(username: str = "root"):
    return User.objects.create_user(
        username, f"{username}@b.c", "pw", is_staff=True, is_superuser=True
    )


def make_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user)
    return client


# ═══════════════════════════════════════════════════════════════════════════
# TOOLS
# ═══════════════════════════════════════════════════════════════════════════

class ToolsTest(TestCase):
    def test_unknown_tool_does_not_raise(self):
        result = execute_tool("not_a_tool", {})
        self.assertEqual(result["items"], [])
        self.assertIn("note", result)

    def test_revenue_trend_degrades_gracefully(self):
        result = execute_tool("get_revenue_trend", {"days": 7})
        self.assertIn("items", result)


# ═══════════════════════════════════════════════════════════════════════════
# MODEL UNIT TESTS
# ═══════════════════════════════════════════════════════════════════════════

class AISettingsModelTest(TestCase):
    def test_singleton_is_created_once(self):
        a = AISettings.get_solo()
        b = AISettings.get_solo()
        self.assertEqual(a.pk, b.pk)
        self.assertEqual(AISettings.objects.count(), 1)

    def test_resolved_api_key_prefers_db(self):
        s = AISettings.get_solo()
        s.provider = "groq"
        s.api_key = "db-key"
        s.save()
        with self.settings(GROQ_API_KEY="env-key"):
            self.assertEqual(s.resolved_api_key(), "db-key")

    def test_resolved_api_key_falls_back_to_env(self):
        s = AISettings.get_solo()
        s.provider = "groq"
        s.api_key = ""
        s.save()
        with self.settings(GROQ_API_KEY="env-key"):
            self.assertEqual(s.resolved_api_key(), "env-key")

    def test_resolved_base_url_defaults_per_provider(self):
        s = AISettings.get_solo()
        s.base_url = ""
        s.provider = "openai"
        s.save()
        self.assertTrue(s.resolved_base_url().startswith("https://api.openai.com"))

    def test_resolved_base_url_custom_override(self):
        s = AISettings.get_solo()
        s.base_url = "https://example.test/v1"
        s.save()
        self.assertEqual(s.resolved_base_url(), "https://example.test/v1")


class AIConversationModelTest(TestCase):
    def setUp(self):
        self.user = make_staff()

    def test_defaults(self):
        c = AIConversation.objects.create(user=self.user)
        self.assertEqual(c.title, "New chat")
        self.assertEqual(c.status, "active")
        self.assertEqual(c.message_count, 0)
        self.assertFalse(c.is_pinned)

    def test_ordering_pins_first(self):
        c1 = AIConversation.objects.create(user=self.user, title="A")
        c2 = AIConversation.objects.create(user=self.user, title="B", is_pinned=True)
        self.assertEqual(list(AIConversation.objects.all())[0].pk, c2.pk)


class AIMessageModelTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.conv = AIConversation.objects.create(user=self.user)

    def test_message_defaults(self):
        m = AIMessage.objects.create(conversation=self.conv, role="assistant", content="hi")
        self.assertEqual(m.status, "ok")
        self.assertTrue(m.is_verified)
        self.assertEqual(m.data_sources, [])
        self.assertEqual(m.missing_data, [])


class AIAlertModelTest(TestCase):
    def test_is_active_false_when_dismissed(self):
        a = AIAlert.objects.create(
            severity="high", category="inventory", title="t", is_dismissed=True
        )
        self.assertFalse(a.is_active)

    def test_is_active_false_when_expired(self):
        a = AIAlert.objects.create(
            severity="high",
            category="inventory",
            title="t",
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        self.assertFalse(a.is_active)

    def test_is_active_true_for_fresh_alert(self):
        a = AIAlert.objects.create(severity="high", category="inventory", title="t")
        self.assertTrue(a.is_active)


class AIAutomationModelTest(TestCase):
    def test_defaults(self):
        a = AIAutomation.objects.create(name="N", trigger="T")
        self.assertEqual(a.status, "Draft")
        self.assertFalse(a.is_enabled)
        self.assertEqual(a.schedule_kind, "manual")
        self.assertEqual(a.timezone, "Africa/Nairobi")


class AIAutomationRunModelTest(TestCase):
    def test_run_created_with_defaults(self):
        a = AIAutomation.objects.create(name="N", trigger="T")
        r = AIAutomationRun.objects.create(automation=a)
        self.assertEqual(r.status, "queued")
        self.assertEqual(r.triggered_by, "schedule")
        self.assertEqual(r.output, {})


# ═══════════════════════════════════════════════════════════════════════════
# PERMISSION TESTS
# ═══════════════════════════════════════════════════════════════════════════

class _FakeView:
    module_key = ""
    required_write_perms = ()


class _FakeRequest:
    def __init__(self, user, method="GET", data=None, query_params=None):
        self.user = user
        self.method = method
        self.data = data or {}
        self.query_params = query_params or {}
        self.META = {}


class IsAdminUserTest(TestCase):
    def test_anonymous_denied(self):
        class _Anon:
            is_authenticated = False
            is_staff = False
        req = _FakeRequest(_Anon())
        self.assertFalse(IsAdminUser().has_permission(req, _FakeView()))

    def test_non_staff_denied(self):
        user = User.objects.create_user("u", "u@b.c", "pw")
        req = _FakeRequest(user)
        self.assertFalse(IsAdminUser().has_permission(req, _FakeView()))

    def test_staff_allowed(self):
        req = _FakeRequest(make_staff())
        self.assertTrue(IsAdminUser().has_permission(req, _FakeView()))


class IsSuperUserTest(TestCase):
    def test_staff_not_superuser_denied(self):
        req = _FakeRequest(make_staff())
        self.assertFalse(IsSuperUser().has_permission(req, _FakeView()))

    def test_superuser_allowed(self):
        req = _FakeRequest(make_superuser())
        self.assertTrue(IsSuperUser().has_permission(req, _FakeView()))


class IsAIAssistantEnabledTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.settings_row = AISettings.get_solo()

    def test_disabled_denies(self):
        self.settings_row.enabled = False
        self.settings_row.save()
        req = _FakeRequest(self.user)
        self.assertFalse(IsAIAssistantEnabled().has_permission(req, _FakeView()))

    def test_enabled_allows(self):
        self.settings_row.enabled = True
        self.settings_row.save()
        req = _FakeRequest(self.user)
        self.assertTrue(IsAIAssistantEnabled().has_permission(req, _FakeView()))


class CanAccessAIModuleTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.perm = CanAccessAIModule()

    def test_superuser_bypasses(self):
        req = _FakeRequest(make_superuser(), query_params={"module": "orders"})
        self.assertTrue(self.perm.has_permission(req, _FakeView()))

    def test_unknown_module_denied(self):
        req = _FakeRequest(self.user, query_params={"module": "does_not_exist"})
        self.assertFalse(self.perm.has_permission(req, _FakeView()))

    def test_no_module_scoped_allows(self):
        req = _FakeRequest(self.user)
        self.assertTrue(self.perm.has_permission(req, _FakeView()))

    def test_module_from_view_attr(self):
        class ViewWithModule:
            module_key = "orders"
        req = _FakeRequest(self.user)
        # User has no perms → denied
        self.assertFalse(self.perm.has_permission(req, ViewWithModule()))

    def test_module_from_body(self):
        req = _FakeRequest(self.user, method="POST", data={"module": "orders"})
        self.assertFalse(self.perm.has_permission(req, _FakeView()))


class CanAccessAllAIModulesTest(TestCase):
    def test_superuser_allowed(self):
        req = _FakeRequest(make_superuser())
        self.assertTrue(CanAccessAllAIModules().has_permission(req, _FakeView()))

    def test_plain_staff_denied(self):
        req = _FakeRequest(make_staff())
        self.assertFalse(CanAccessAllAIModules().has_permission(req, _FakeView()))


class CanPerformAIWriteActionsTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.settings_row = AISettings.get_solo()

    def test_safe_methods_always_allowed(self):
        req = _FakeRequest(self.user, method="GET")
        self.assertTrue(CanPerformAIWriteActions().has_permission(req, _FakeView()))

    def test_write_denied_when_globally_off(self):
        self.settings_row.allow_write_actions = False
        self.settings_row.save()
        req = _FakeRequest(self.user, method="POST")
        self.assertFalse(CanPerformAIWriteActions().has_permission(req, _FakeView()))

    def test_write_denied_without_required_perms(self):
        self.settings_row.allow_write_actions = True
        self.settings_row.save()
        req = _FakeRequest(self.user, method="POST")
        self.assertFalse(CanPerformAIWriteActions().has_permission(req, _FakeView()))

    def test_superuser_allowed(self):
        self.settings_row.allow_write_actions = True
        self.settings_row.save()
        req = _FakeRequest(make_superuser(), method="POST")
        self.assertTrue(CanPerformAIWriteActions().has_permission(req, _FakeView()))


class RequiresConfirmationTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.settings_row = AISettings.get_solo()
        self.settings_row.require_confirmation_for_destructive = True
        self.settings_row.save()

    def test_safe_methods_allowed(self):
        req = _FakeRequest(self.user, method="GET")
        self.assertTrue(RequiresConfirmation().has_permission(req, _FakeView()))

    def test_post_without_confirm_denied(self):
        req = _FakeRequest(self.user, method="POST", data={})
        self.assertFalse(RequiresConfirmation().has_permission(req, _FakeView()))

    def test_post_with_confirm_allowed(self):
        req = _FakeRequest(self.user, method="POST", data={"confirmed": True})
        self.assertTrue(RequiresConfirmation().has_permission(req, _FakeView()))

    def test_header_confirm_allowed(self):
        req = _FakeRequest(self.user, method="POST")
        req.META["HTTP_X_AI_CONFIRM"] = "1"
        self.assertTrue(RequiresConfirmation().has_permission(req, _FakeView()))


class IsConversationOwnerTest(TestCase):
    def test_owner_allowed(self):
        user = make_staff()
        conv = AIConversation.objects.create(user=user)
        req = _FakeRequest(user)
        self.assertTrue(IsConversationOwner().has_object_permission(req, _FakeView(), conv))

    def test_other_staff_denied(self):
        owner = make_staff("owner")
        other = make_staff("other")
        conv = AIConversation.objects.create(user=owner)
        req = _FakeRequest(other)
        self.assertFalse(IsConversationOwner().has_object_permission(req, _FakeView(), conv))

    def test_superuser_denied_without_explicit_perm(self):
        owner = make_staff("owner")
        su = make_superuser()
        conv = AIConversation.objects.create(user=owner)
        req = _FakeRequest(su)
        # superuser status is not enough — must hold ai.view_all_conversations
        self.assertFalse(IsConversationOwner().has_object_permission(req, _FakeView(), conv))


class CanManageAutomationsTest(TestCase):
    def test_superuser_allowed(self):
        req = _FakeRequest(make_superuser(), method="POST")
        self.assertTrue(CanManageAutomations().has_permission(req, _FakeView()))

    def test_plain_staff_denied_on_write(self):
        req = _FakeRequest(make_staff(), method="POST")
        self.assertFalse(CanManageAutomations().has_permission(req, _FakeView()))


class CanEditAISettingsTest(TestCase):
    def test_superuser_allowed(self):
        req = _FakeRequest(make_superuser())
        self.assertTrue(CanEditAISettings().has_permission(req, _FakeView()))

    def test_plain_staff_denied(self):
        req = _FakeRequest(make_staff())
        self.assertFalse(CanEditAISettings().has_permission(req, _FakeView()))


class CanViewAIAuditLogTest(TestCase):
    def test_superuser_allowed(self):
        req = _FakeRequest(make_superuser())
        self.assertTrue(CanViewAIAuditLog().has_permission(req, _FakeView()))

    def test_plain_staff_denied(self):
        req = _FakeRequest(make_staff())
        self.assertFalse(CanViewAIAuditLog().has_permission(req, _FakeView()))


# ═══════════════════════════════════════════════════════════════════════════
# SERIALIZER TESTS
# ═══════════════════════════════════════════════════════════════════════════

class AISettingsSerializerTest(TestCase):
    def test_read_hides_api_key_and_exposes_flag(self):
        s = AISettings.get_solo()
        s.api_key = "secret"
        s.save()
        data = AISettingsSerializer(s).data
        self.assertNotIn("api_key", data)
        self.assertIn("has_api_key", data)
        self.assertTrue(data["has_api_key"])

    def test_update_serializer_accepts_new_fields(self):
        ser = AISettingsUpdateSerializer(data={
            "temperature": 0.7,
            "streaming_enabled": True,
            "allowed_modules": ["orders", "products"],
            "mask_fields": ["customer_email"],
        })
        self.assertTrue(ser.is_valid(), ser.errors)

    def test_update_serializer_rejects_bad_temperature(self):
        ser = AISettingsUpdateSerializer(data={"temperature": 5.0})
        self.assertFalse(ser.is_valid())


class AIMessageSerializerTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.conv = AIConversation.objects.create(user=self.user)

    def test_camelcase_aliases(self):
        msg = AIMessage.objects.create(
            conversation=self.conv, role="assistant", content="ok",
            quick_replies=["a", "b"], tool_name="get_revenue_trend",
            is_verified=False, data_sources=["orders"],
        )
        data = AIMessageSerializer(msg).data
        self.assertEqual(data["quickReplies"], ["a", "b"])
        self.assertEqual(data["toolName"], "get_revenue_trend")
        self.assertFalse(data["isVerified"])
        self.assertEqual(data["dataSources"], ["orders"])

    def test_tool_calls_included(self):
        msg = AIMessage.objects.create(conversation=self.conv, role="assistant", content="ok")
        AIToolCall.objects.create(message=msg, tool_name="x", status="ok")
        data = AIMessageSerializer(msg).data
        self.assertEqual(len(data["tool_calls"]), 1)


class AIConversationSerializerTest(TestCase):
    def test_group_and_relative(self):
        user = make_staff()
        conv = AIConversation.objects.create(user=user)
        data = AIConversationSerializer(conv).data
        self.assertEqual(data["group"], "Today")
        self.assertIn("updatedAt", data)


class AIAlertSerializerTest(TestCase):
    def test_camelcase_and_is_active(self):
        a = AIAlert.objects.create(
            severity="high", category="inventory", title="Low stock",
            action_label="Open",
        )
        data = AIAlertSerializer(a).data
        self.assertEqual(data["actionLabel"], "Open")
        self.assertTrue(data["isActive"])
        self.assertIn("timestamp", data)


class AIAutomationSerializerTest(TestCase):
    def test_camelcase_and_last_run(self):
        a = AIAutomation.objects.create(
            name="N", trigger="T", success_rate=0.9, runs=3,
            last_run_at=timezone.now() - timedelta(minutes=5),
        )
        data = AIAutomationSerializer(a).data
        self.assertEqual(data["successRate"], 0.9)
        self.assertIn("lastRun", data)
        self.assertIn("recentRuns", data)

    def test_create_serializer_validates_kind(self):
        ser = AIAutomationCreateSerializer(data={"name": "x", "trigger": "y"})
        self.assertTrue(ser.is_valid(), ser.errors)

        ser_bad = AIAutomationCreateSerializer(data={"name": "x", "trigger": "y", "kind": "nope"})
        self.assertFalse(ser_bad.is_valid())


class AIAutomationRunSerializerTest(TestCase):
    def test_camelcase_and_relative(self):
        a = AIAutomation.objects.create(name="N", trigger="T")
        r = AIAutomationRun.objects.create(automation=a, status="success", items_affected=5)
        data = AIAutomationRunSerializer(r).data
        self.assertEqual(data["itemsAffected"], 5)
        self.assertIn("startedRelative", data)


class AIAuditLogSerializerTest(TestCase):
    def test_user_display_and_camelcase(self):
        user = make_staff()
        log = AIAuditLog.objects.create(
            user=user, action="chat", was_confirmed=True, is_verified=False,
        )
        data = AIAuditLogSerializer(log).data
        self.assertEqual(data["userDisplay"], user.get_username())
        self.assertTrue(data["wasConfirmed"])
        self.assertFalse(data["isVerified"])


class AIUsageSerializerTest(TestCase):
    def test_camelcase_aliases(self):
        u = AIUsageLog.objects.create(
            feature="assistant", model="x", tokens_in=10, tokens_out=20, cost_kes=0.1,
        )
        data = AIUsageSerializer(u).data
        self.assertEqual(data["tokensIn"], 10)
        self.assertEqual(data["tokensOut"], 20)
        self.assertEqual(data["costKes"], 0.1)


# ═══════════════════════════════════════════════════════════════════════════
# API TESTS — SETTINGS
# ═══════════════════════════════════════════════════════════════════════════

class AISettingsApiTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.client = make_client(self.user)
        AISettings.get_solo()

    def test_get_settings(self):
        res = self.client.get("/api/admin/ai/settings/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("provider", res.data)

    def test_patch_settings(self):
        res = self.client.patch(
            "/api/admin/ai/settings/",
            {"monthly_budget_kes": 2000, "provider": "groq"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(AISettings.get_solo().monthly_budget_kes, 2000)

    def test_disable(self):
        s = AISettings.get_solo()
        s.enabled = True
        s.save()
        res = self.client.post("/api/admin/ai/settings/disable/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(AISettings.get_solo().enabled)


# ═══════════════════════════════════════════════════════════════════════════
# API TESTS — CONVERSATIONS & MESSAGES
# ═══════════════════════════════════════════════════════════════════════════

class ConversationApiTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.client = make_client(self.user)
        s = AISettings.get_solo()
        s.enabled = True
        s.save()

    def test_create_conversation(self):
        res = self.client.post(
            "/api/admin/ai/conversations/",
            {"origin_module": "orders", "origin_path": "/admin/orders"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(AIConversation.objects.count(), 1)

    def test_list_only_own_conversations(self):
        other = make_staff("other")
        AIConversation.objects.create(user=other, title="Other")
        AIConversation.objects.create(user=self.user, title="Mine")
        res = self.client.get("/api/admin/ai/conversations/")
        self.assertEqual(res.status_code, 200)
        titles = [c["title"] for c in res.data.get("results", res.data)]
        self.assertIn("Mine", titles)
        self.assertNotIn("Other", titles)

    def test_rename_conversation(self):
        conv = AIConversation.objects.create(user=self.user)
        res = self.client.patch(
            f"/api/admin/ai/conversations/{conv.pk}/",
            {"title": "Renamed"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        conv.refresh_from_db()
        self.assertEqual(conv.title, "Renamed")


# ═══════════════════════════════════════════════════════════════════════════
# API TESTS — AUTOMATIONS
# ═══════════════════════════════════════════════════════════════════════════

class AutomationsApiTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.client = make_client(self.user)
        s = AISettings.get_solo()
        s.enabled = True
        s.save()

    def test_create_and_list(self):
        res = self.client.post(
            "/api/admin/ai/automations/",
            {"name": "Test", "trigger": "Order placed"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(AIAutomation.objects.count(), 1)

    def test_toggle_status(self):
        a = AIAutomation.objects.create(name="N", trigger="T", status="Draft")
        res = self.client.post(
            f"/api/admin/ai/automations/{a.pk}/status/",
            {"status": "Active", "is_enabled": True},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        a.refresh_from_db()
        self.assertEqual(a.status, "Active")
        self.assertTrue(a.is_enabled)

    def test_runs_endpoint_lists_history(self):
        a = AIAutomation.objects.create(name="N", trigger="T")
        AIAutomationRun.objects.create(automation=a, status="success", items_affected=2)
        res = self.client.get(f"/api/admin/ai/automations/{a.pk}/runs/")
        self.assertEqual(res.status_code, 200)


# ═══════════════════════════════════════════════════════════════════════════
# API TESTS — ALERTS & INSIGHTS
# ═══════════════════════════════════════════════════════════════════════════

class AlertsApiTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.client = make_client(self.user)
        s = AISettings.get_solo()
        s.enabled = True
        s.save()

    def test_dismiss_alert(self):
        a = AIAlert.objects.create(severity="high", category="inventory", title="x")
        res = self.client.post(f"/api/admin/ai/alerts/{a.pk}/dismiss/")
        self.assertEqual(res.status_code, 200)
        a.refresh_from_db()
        self.assertTrue(a.is_dismissed)
        self.assertEqual(a.dismissed_by, self.user)

    def test_list_alerts_excludes_dismissed(self):
        AIAlert.objects.create(severity="high", category="inventory", title="a")
        AIAlert.objects.create(
            severity="low", category="inventory", title="b", is_dismissed=True
        )
        res = self.client.get("/api/admin/ai/alerts/")
        self.assertEqual(res.status_code, 200)
        titles = [x["title"] for x in res.data.get("results", res.data)]
        self.assertIn("a", titles)
        self.assertNotIn("b", titles)


class InsightsApiTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.client = make_client(self.user)
        s = AISettings.get_solo()
        s.enabled = True
        s.save()

    def test_dismiss_insight(self):
        i = AIInsight.objects.create(category="sales", priority="high", text="x")
        res = self.client.post(f"/api/admin/ai/insights/{i.pk}/dismiss/")
        self.assertEqual(res.status_code, 200)
        i.refresh_from_db()
        self.assertTrue(i.is_dismissed)

    def test_execute_insight_returns_redirect(self):
        i = AIInsight.objects.create(
            category="sales", priority="medium", text="x",
            href="/admin/analytics", action_label="View",
        )
        res = self.client.post(f"/api/admin/ai/insights/{i.pk}/execute/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get("redirect"), "/admin/analytics")
        i.refresh_from_db()
        self.assertIsNotNone(i.executed_at)


# ═══════════════════════════════════════════════════════════════════════════
# API TESTS — USAGE & AUDIT
# ═══════════════════════════════════════════════════════════════════════════

class UsageOverviewTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.client = make_client(self.user)
        AISettings.get_solo()

    def test_overview_runs(self):
        AIUsageLog.objects.create(
            feature="assistant", model="x",
            tokens_in=10, tokens_out=20, cost_kes=0.1,
        )
        res = self.client.get("/api/admin/ai/overview/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("tokens_this_month", res.data)


class AuditLogApiTest(TestCase):
    def setUp(self):
        self.user = make_superuser()
        self.client = make_client(self.user)

    def test_list_audit_logs(self):
        AIAuditLog.objects.create(user=self.user, action="chat", tool="get_revenue_trend")
        res = self.client.get("/api/admin/ai/audit/")
        self.assertEqual(res.status_code, 200)

    def test_plain_staff_denied(self):
        other = make_staff()
        client = make_client(other)
        res = client.get("/api/admin/ai/audit/")
        self.assertEqual(res.status_code, 403)


# ═══════════════════════════════════════════════════════════════════════════
# SECURITY / BOUNDARY TESTS
# ═══════════════════════════════════════════════════════════════════════════

class PermissionBoundaryTest(TestCase):
    def setUp(self):
        s = AISettings.get_solo()
        s.enabled = True
        s.save()

    def test_anonymous_denied_everywhere(self):
        client = APIClient()
        for url in (
            "/api/admin/ai/settings/",
            "/api/admin/ai/automations/",
            "/api/admin/ai/alerts/",
            "/api/admin/ai/insights/",
        ):
            res = client.get(url)
            self.assertIn(res.status_code, (401, 403), url)

    def test_non_staff_denied(self):
        user = User.objects.create_user("u", "u@b.c", "pw")
        client = make_client(user)
        res = client.get("/api/admin/ai/settings/")
        self.assertEqual(res.status_code, 403)


# ═══════════════════════════════════════════════════════════════════════════
# INTEGRATION — AUTOMATION RUN LIFECYCLE
# ═══════════════════════════════════════════════════════════════════════════

class AutomationRunLifecycleTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.automation = AIAutomation.objects.create(
            name="Low stock",
            kind="low_stock",
            trigger="Stock < 5",
            action="Send alert",
            status="Active",
            is_enabled=True,
        )

    def test_run_completes_and_updates_stats(self):
        """Simulate a full run and verify stats roll up."""
        started = timezone.now()
        run = AIAutomationRun.objects.create(
            automation=self.automation,
            status="running",
            triggered_by="manual",
            triggered_by_user=self.user,
            started_at=started,
        )
        run.status = "success"
        run.finished_at = timezone.now()
        run.duration_ms = int((run.finished_at - started).total_seconds() * 1000)
        run.items_affected = 3
        run.summary = "3 items flagged"
        run.save()

        self.automation.runs += 1
        self.automation.last_run_at = run.finished_at
        self.automation.last_run_status = "success"
        self.automation.success_rate = 100.0
        self.automation.save()

        self.automation.refresh_from_db()
        self.assertEqual(self.automation.runs, 1)
        self.assertEqual(self.automation.last_run_status, "success")
        self.assertEqual(self.automation.executions.count(), 1)

    def test_failed_run_records_error(self):
        run = AIAutomationRun.objects.create(
            automation=self.automation,
            status="failed",
            error_message="provider unreachable",
        )
        self.automation.runs_failed += 1
        self.automation.runs += 1
        self.automation.last_run_status = "failed"
        self.automation.last_error = run.error_message
        self.automation.success_rate = 0.0
        self.automation.save()

        self.automation.refresh_from_db()
        self.assertEqual(self.automation.runs_failed, 1)
        self.assertEqual(self.automation.last_error, "provider unreachable")


# ═══════════════════════════════════════════════════════════════════════════
# INTEGRATION — TOOL CALL TRACE
# ═══════════════════════════════════════════════════════════════════════════

class ToolCallTraceTest(TestCase):
    def setUp(self):
        self.user = make_staff()
        self.conv = AIConversation.objects.create(user=self.user)
        self.msg = AIMessage.objects.create(
            conversation=self.conv, role="assistant", content="done"
        )

    def test_tool_call_is_linked_and_renderable(self):
        tc = AIToolCall.objects.create(
            message=self.msg,
            tool_name="get_revenue_trend",
            arguments={"days": 7},
            result_summary="7 rows",
            row_count=7,
            duration_ms=42,
            status="ok",
        )
        data = AIToolCallSerializer(tc).data
        self.assertEqual(data["tool_name"], "get_revenue_trend")
        self.assertEqual(data["row_count"], 7)

    def test_tool_call_error_captured(self):
        tc = AIToolCall.objects.create(
            message=self.msg,
            tool_name="get_revenue_trend",
            status="error",
            error_message="db timeout",
        )
        self.assertEqual(tc.status, "error")
        self.assertEqual(tc.error_message, "db timeout")


# ═══════════════════════════════════════════════════════════════════════════
# INTEGRATION — CASCADE & RETENTION
# ═══════════════════════════════════════════════════════════════════════════

class CascadeTest(TestCase):
    def test_deleting_conversation_cascades_messages(self):
        user = make_staff()
        conv = AIConversation.objects.create(user=user)
        AIMessage.objects.create(conversation=conv, role="user", content="hi")
        conv.delete()
        self.assertEqual(AIMessage.objects.count(), 0)

    def test_deleting_automation_cascades_runs(self):
        a = AIAutomation.objects.create(name="N", trigger="T")
        AIAutomationRun.objects.create(automation=a)
        a.delete()
        self.assertEqual(AIAutomationRun.objects.count(), 0)

    def test_deleting_message_cascades_tool_calls(self):
        user = make_staff()
        conv = AIConversation.objects.create(user=user)
        msg = AIMessage.objects.create(conversation=conv, role="assistant", content="hi")
        AIToolCall.objects.create(message=msg, tool_name="x")
        msg.delete()
        self.assertEqual(AIToolCall.objects.count(), 0)

    def test_deleting_automation_nulls_alert_fk(self):
        a = AIAutomation.objects.create(name="N", trigger="T")
        alert = AIAlert.objects.create(
            severity="high", category="inventory", title="x", automation=a
        )
        a.delete()
        alert.refresh_from_db()
        self.assertIsNone(alert.automation)


# ═══════════════════════════════════════════════════════════════════════════
# MASKING / PRIVACY
# ═══════════════════════════════════════════════════════════════════════════

class MaskingTest(TestCase):
    def test_mask_fields_roundtrip(self):
        s = AISettings.get_solo()
        s.mask_fields = ["customer_email", "customer_phone"]
        s.save()
        s.refresh_from_db()
        self.assertEqual(s.mask_fields, ["customer_email", "customer_phone"])

    def test_default_mask_fields_is_empty_list(self):
        s = AISettings.get_solo()
        s.mask_fields = []
        s.save()
        self.assertEqual(AISettings.get_solo().mask_fields, [])