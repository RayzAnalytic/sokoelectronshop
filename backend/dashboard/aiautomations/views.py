# ai/views.py

from __future__ import annotations

import json
from datetime import timedelta

from django.db.models import Prefetch, Q, Sum
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    permission_classes,
    renderer_classes,
)
from rest_framework.renderers import BaseRenderer
from rest_framework.response import Response

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
    ActionExecutePermissions,
    ActionPreviewPermissions,
    CanEditAISettings,
    CanExportAIData,
    CanManageAlerts,
    CanManageAutomations,
    CanManageInsights,
    CanRunAutomations,
    CanToggleAutomations,
    CanViewAIAuditLog,
    CanViewAIUsage,
    CanViewAutomationRuns,
    ChatPermissions,
    ConversationPermissions,
    IsAIAssistantEnabled,
    IsAdminUser,
    IsConversationOwner,
    StreamPermissions,
)
from .serializers import (
    AIActionExecuteSerializer,
    AIActionPreviewSerializer,
    AIAlertDismissSerializer,
    AIAlertSerializer,
    AIAlertSnoozeSerializer,
    AIAuditLogSerializer,
    AIAutomationCreateSerializer,
    AIAutomationRunRequestSerializer,
    AIAutomationRunSerializer,
    AIAutomationSerializer,
    AIAutomationStatusSerializer,
    AIAutomationUpdateSerializer,
    AIContentBulkSerializer,
    AIContentGenerateSerializer,
    AIConversationCreateSerializer,
    AIConversationDetailSerializer,
    AIConversationSerializer,
    AIConversationUpdateSerializer,
    AIInsightExecuteSerializer,
    AIInsightSerializer,
    AIMessageCreateSerializer,
    AIMessageFeedbackSerializer,
    AIMessageSerializer,
    AISettingsSerializer,
    AISettingsUpdateSerializer,
    AIToolCallSerializer,
    AIUsageSerializer,
)
from .services import generate_content, run_automation, stream_assistant_reply
from .tools import execute_tool, tool_manifest


class EventStreamRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "txt"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b""
        if isinstance(data, bytes):
            return data
        if isinstance(data, str):
            return data.encode(self.charset)
        if isinstance(data, (dict, list)):
            return json.dumps(data, default=str).encode(self.charset)
        return str(data).encode(self.charset)


def _sse(event: dict) -> bytes:
    return f"data: {json.dumps(event)}\n\n".encode("utf-8")


def _require_enabled() -> Response | None:
    if not AISettings.get_solo().enabled:
        return Response(
            {"detail": "AI features are disabled."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return None


def _audit(request, action: str, **extra) -> None:
    try:
        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR")
            or None
        )
        AIAuditLog.objects.create(
            user=getattr(request, "user", None)
            if getattr(request.user, "is_authenticated", False)
            else None,
            action=action,
            ip_address=ip,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
            path=request.path[:255],
            **extra,
        )
    except Exception:  # noqa: BLE001
        pass


@api_view(["GET"])
@permission_classes([IsAdminUser])
def overview(request):
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    agg = AIUsageLog.objects.filter(created_at__gte=month_start).aggregate(
        tokens=Sum("tokens_in") + Sum("tokens_out"),
        cost=Sum("cost_kes"),
    )
    tokens = int(agg["tokens"] or 0)
    cost = float(agg["cost"] or 0.0)

    by_day: dict[str, dict[str, int]] = {}
    for row in AIUsageLog.objects.filter(created_at__gte=now - timedelta(days=7)):
        key = row.created_at.strftime("%a")
        bucket = by_day.setdefault(
            key, {"assistant": 0, "content": 0, "search": 0, "insights": 0, "automation": 0}
        )
        bucket[row.feature] = bucket.get(row.feature, 0) + row.tokens_in + row.tokens_out

    order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    usage_by_day = [{"day": d, **by_day[d]} for d in order if d in by_day]

    cost_rows = (
        AIUsageLog.objects.filter(created_at__gte=month_start)
        .values("feature")
        .annotate(total=Sum("cost_kes"))
    )
    palette = {
        "assistant": "#172554",
        "content": "#10b981",
        "search": "#8b5cf6",
        "insights": "#f59e0b",
        "automation": "#0891b2",
    }
    cost_by_feature = [
        {
            "name": r["feature"].title(),
            "value": round(float(r["total"] or 0), 2),
            "color": palette.get(r["feature"], "#94a3b8"),
        }
        for r in cost_rows
    ]

    cfg = AISettings.get_solo()
    budget = float(cfg.monthly_budget_kes or 0)
    budget_used_pct = int(round((cost / budget) * 100)) if budget else 0

    return Response(
        {
            "assistantStatus": "Active" if cfg.enabled else "Inactive",
            "activeAutomations": AIAutomation.objects.filter(status="Active").count(),
            "totalAutomations": AIAutomation.objects.count(),
            "automationsEnabled": AIAutomation.objects.filter(is_enabled=True).count(),
            "tokensThisMonth": tokens,
            "estimatedCostKes": round(cost, 2),
            "monthlyBudgetKes": budget,
            "budgetUsedPct": budget_used_pct,
            "activeAlerts": AIAlert.objects.filter(
                is_dismissed=False, acknowledged_at__isnull=True
            ).count(),
            "activeInsights": AIInsight.objects.filter(is_dismissed=False).count(),
            "usageByDay": usage_by_day,
            "costByFeature": cost_by_feature,
        }
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def digest(request):
    now = timezone.now()
    today = now.date()
    yesterday = today - timedelta(days=1)

    Order = None
    revenue_today = revenue_yesterday = 0.0
    orders_today = 0
    try:
        from checkout.models import Order as OrderModel  # type: ignore

        Order = OrderModel
    except Exception:  # noqa: BLE001
        try:
            from orders.models import Order as OrderModel  # type: ignore

            Order = OrderModel
        except Exception:  # noqa: BLE001
            Order = None

    if Order is not None:
        total_field = next(
            (f for f in ("total", "grand_total", "amount") if f in {x.name for x in Order._meta.get_fields()}),
            None,
        )
        created_field = "created_at" if "created_at" in {x.name for x in Order._meta.get_fields()} else None
        if total_field and created_field:
            agg_today = Order.objects.filter(**{f"{created_field}__date": today}).aggregate(
                rev=Sum(total_field)
            )
            agg_yday = Order.objects.filter(**{f"{created_field}__date": yesterday}).aggregate(
                rev=Sum(total_field)
            )
            revenue_today = float(agg_today["rev"] or 0)
            revenue_yesterday = float(agg_yday["rev"] or 0)
            orders_today = Order.objects.filter(**{f"{created_field}__date": today}).count()

    delta = 0.0
    if revenue_yesterday > 0:
        delta = round(((revenue_today - revenue_yesterday) / revenue_yesterday) * 100, 1)

    high_alerts = AIAlert.objects.filter(
        severity="high", is_dismissed=False, acknowledged_at__isnull=True
    ).count()
    medium_alerts = AIAlert.objects.filter(
        severity="medium", is_dismissed=False, acknowledged_at__isnull=True
    ).count()

    return Response(
        {
            "items": [
                {
                    "label": "Revenue today",
                    "value": f"KES {revenue_today:,.0f}",
                    "delta": delta,
                    "tone": "emerald" if delta >= 0 else "rose",
                },
                {
                    "label": "Orders today",
                    "value": str(orders_today),
                    "tone": "blue",
                },
                {
                    "label": "Critical alerts",
                    "value": str(high_alerts),
                    "tone": "rose" if high_alerts else "slate",
                },
                {
                    "label": "Warnings",
                    "value": str(medium_alerts),
                    "tone": "amber" if medium_alerts else "slate",
                },
            ],
            "generatedAt": now.isoformat(),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([*ConversationPermissions])
def conversations(request):
    if request.method == "GET":
        qs = (
            AIConversation.objects.filter(user=request.user)
            .exclude(status="archived")
            .order_by("-is_pinned", "-updated_at")
        )
        return Response(AIConversationSerializer(qs, many=True).data)

    ser = AIConversationCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    conv = AIConversation.objects.create(
        user=request.user,
        title=data.get("title") or "New chat",
        origin_path=data.get("origin_path", "") or "",
        origin_module=data.get("origin_module", "") or "",
        model=data.get("model", "") or "",
    )
    _audit(request, "chat", args={"conversation_id": conv.pk})
    return Response(AIConversationSerializer(conv).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([*ConversationPermissions])
def conversation_detail(request, pk: int):
    conv = get_object_or_404(AIConversation, pk=pk)
    if not IsConversationOwner().has_object_permission(request, None, conv):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(AIConversationDetailSerializer(conv).data)

    if request.method == "DELETE":
        conv.delete()
        _audit(request, "conversation_clear", args={"conversation_id": pk})
        return Response(status=status.HTTP_204_NO_CONTENT)

    ser = AIConversationUpdateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    for k, v in ser.validated_data.items():
        setattr(conv, k, v)
    conv.save()
    return Response(AIConversationSerializer(conv).data)


@api_view(["POST"])
@permission_classes([*ConversationPermissions])
def conversation_rename(request, pk: int):
    conv = get_object_or_404(AIConversation, pk=pk)
    if not IsConversationOwner().has_object_permission(request, None, conv):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    title = (request.data or {}).get("title") or ""
    if not title.strip():
        return Response({"detail": "title is required."}, status=status.HTTP_400_BAD_REQUEST)
    conv.title = title.strip()[:255]
    conv.save(update_fields=["title", "updated_at"])
    return Response(AIConversationSerializer(conv).data)


@api_view(["POST"])
@permission_classes([*ConversationPermissions])
def conversation_toggle_pin(request, pk: int):
    conv = get_object_or_404(AIConversation, pk=pk)
    if not IsConversationOwner().has_object_permission(request, None, conv):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    conv.is_pinned = not conv.is_pinned
    conv.save(update_fields=["is_pinned", "updated_at"])
    return Response(AIConversationSerializer(conv).data)


@api_view(["GET"])
@permission_classes([*ConversationPermissions])
def conversation_export(request, pk: int):
    conv = get_object_or_404(AIConversation, pk=pk)
    if not IsConversationOwner().has_object_permission(request, None, conv):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    if not CanExportAIData().has_permission(request, None):
        return Response(
            {"detail": "You do not have permission to export AI data."},
            status=status.HTTP_403_FORBIDDEN,
        )

    lines = [
        f"# AI Copilot — {conv.title}",
        f"_Exported {timezone.now().strftime('%Y-%m-%d %H:%M')}_",
        "",
    ]
    for m in conv.messages.all():
        who = {"user": "You", "assistant": "Copilot", "system": "System", "tool": "Tool"}.get(
            m.role, m.role
        )
        lines.append(f"### {who} · {m.created_at.strftime('%H:%M')}")
        if m.content:
            lines.append(m.content)
        if m.chart:
            lines.append(f"_[chart: {m.chart.get('type', '?')}]_")
        if m.table:
            headers = m.table.get("headers", [])
            rows = m.table.get("rows", [])
            if headers:
                lines.append("| " + " | ".join(str(h) for h in headers) + " |")
                lines.append("|" + "|".join("---" for _ in headers) + "|")
                for r in rows:
                    lines.append("| " + " | ".join(str(c) for c in r) + " |")
        if m.link:
            lines.append(f"[{m.link.get('label', 'link')}]({m.link.get('href', '#')})")
        lines.append("")

    _audit(request, "export", args={"conversation_id": pk})
    body = "\n".join(lines)
    return Response(
        {
            "content": body,
            "filename": f"ai-conversation-{conv.pk}.md",
            "mimeType": "text/markdown",
        }
    )


@api_view(["GET", "POST"])
@permission_classes([*ChatPermissions])
def conversation_messages(request, pk: int):
    conv = get_object_or_404(AIConversation, pk=pk)
    if not IsConversationOwner().has_object_permission(request, None, conv):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(AIMessageSerializer(conv.messages.all(), many=True).data)

    disabled = _require_enabled()
    if disabled:
        return disabled

    ser = AIMessageCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    content = ser.validated_data["content"].strip()
    context = ser.validated_data.get("context", {})

    user_msg = AIMessage.objects.create(conversation=conv, role="user", content=content)

    if conv.messages.filter(role="user").count() == 1:
        conv.title = content[:60]
        conv.message_count = conv.messages.count()
        conv.save(update_fields=["title", "message_count", "updated_at"])

    last_message_id = None
    for event in stream_assistant_reply(conv, user_msg, context=context, user=request.user):
        if event.get("type") == "done":
            last_message_id = event.get("messageId")
        if event.get("type") == "error":
            return Response({"detail": event["message"]}, status=status.HTTP_502_BAD_GATEWAY)

    msg = conv.messages.filter(pk=last_message_id).first() or conv.messages.last()
    return Response(AIMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAdminUser, IsAIAssistantEnabled])
@renderer_classes([EventStreamRenderer])
def conversation_stream(request, pk: int):
    conv = get_object_or_404(AIConversation, pk=pk)
    if not IsConversationOwner().has_object_permission(request, None, conv):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    disabled = _require_enabled()
    if disabled:
        return disabled

    ser = AIMessageCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    content = ser.validated_data["content"].strip()
    context = dict(ser.validated_data.get("context", {}) or {})

    incoming_attachments = ser.validated_data.get("attachments", []) or []
    if incoming_attachments:
        context["attachments"] = incoming_attachments

    user_msg = AIMessage.objects.create(conversation=conv, role="user", content=content)
    if conv.messages.filter(role="user").count() == 1:
        conv.title = content[:60]
        conv.message_count = conv.messages.count()
        conv.save(update_fields=["title", "message_count", "updated_at"])

    def event_stream():
        try:
            for event in stream_assistant_reply(
                conv,
                user_msg,
                context=context,
                user=request.user,
            ):
                yield _sse(event)
        except Exception as exc:  # noqa: BLE001
            yield _sse({"type": "error", "message": str(exc)})

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@api_view(["POST"])
@permission_classes([*ChatPermissions])
def message_feedback(request, pk: int):
    msg = get_object_or_404(AIMessage, pk=pk)
    if not IsConversationOwner().has_object_permission(request, None, msg.conversation):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    ser = AIMessageFeedbackSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    feedback = ser.validated_data["feedback"]

    _audit(
        request,
        "chat",
        args={"message_id": pk, "feedback": feedback},
    )
    return Response({"messageId": pk, "feedback": feedback})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def message_tool_calls(request, pk: int):
    msg = get_object_or_404(AIMessage, pk=pk)
    if not IsConversationOwner().has_object_permission(request, None, msg.conversation):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(AIToolCallSerializer(msg.tool_calls.all(), many=True).data)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def alerts(request):
    qs = AIAlert.objects.filter(is_dismissed=False)
    if not request.user.is_superuser:
        qs = qs.filter(Q(owner__isnull=True) | Q(owner=request.user))
    severity = request.query_params.get("severity")
    if severity and severity != "all":
        qs = qs.filter(severity=severity)
    category = request.query_params.get("category")
    if category and category != "all":
        qs = qs.filter(category=category)
    include_snoozed = request.query_params.get("include_snoozed") == "1"
    if not include_snoozed:
        qs = qs.filter(Q(snoozed_until__isnull=True) | Q(snoozed_until__lte=timezone.now()))
    return Response(AIAlertSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAdminUser, CanManageAlerts])
def dismiss_alert(request, pk: int):
    ser = AIAlertDismissSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    AIAlert.objects.filter(pk=pk).update(
        is_dismissed=True,
        dismissed_at=timezone.now(),
        dismissed_by=request.user,
    )
    _audit(request, "alert_dismiss", args={"alert_id": pk, **ser.validated_data})
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAdminUser, CanManageAlerts])
def acknowledge_alert(request, pk: int):
    AIAlert.objects.filter(pk=pk).update(acknowledged_at=timezone.now())
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAdminUser, CanManageAlerts])
def snooze_alert(request, pk: int):
    ser = AIAlertSnoozeSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    until = timezone.now() + timedelta(minutes=ser.validated_data["minutes"])
    AIAlert.objects.filter(pk=pk).update(snoozed_until=until)
    return Response({"snoozedUntil": until.isoformat()})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def insights(request):
    qs = AIInsight.objects.filter(is_dismissed=False)
    if not request.user.is_superuser:
        qs = qs.filter(Q(owner__isnull=True) | Q(owner=request.user))
    category = request.query_params.get("category")
    if category and category != "all":
        qs = qs.filter(category=category)
    return Response(AIInsightSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAdminUser, CanManageInsights])
def dismiss_insight(request, pk: int):
    AIInsight.objects.filter(pk=pk).update(
        is_dismissed=True,
        dismissed_at=timezone.now(),
        dismissed_by=request.user,
    )
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAdminUser, CanManageInsights])
def execute_insight(request, pk: int):
    ins = get_object_or_404(AIInsight, pk=pk)

    ser = AIInsightExecuteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    redirect = ins.href
    if ins.action and ins.action.get("kind"):
        pass

    AIInsight.objects.filter(pk=pk).update(
        viewed_at=ins.viewed_at or timezone.now(),
        executed_at=timezone.now(),
    )
    _audit(request, "insight_execute", args={"insight_id": pk, **ser.validated_data})
    return Response({"redirect": redirect})


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser, CanManageAutomations])
def automations(request):
    if request.method == "GET":
        qs = (
            AIAutomation.objects.all()
            .prefetch_related(
                Prefetch(
                    "executions",
                    queryset=AIAutomationRun.objects.order_by("-started_at")[:5],
                    to_attr="_prefetched_runs",
                )
            )
        )
        status_filter = request.query_params.get("status")
        if status_filter and status_filter != "all":
            qs = qs.filter(status=status_filter)
        kind = request.query_params.get("kind")
        if kind and kind != "all":
            qs = qs.filter(kind=kind)
        return Response(AIAutomationSerializer(qs, many=True).data)

    ser = AIAutomationCreateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data
    auto = AIAutomation.objects.create(
        created_by=request.user,
        owner=request.user,
        **data,
    )
    _audit(request, "automation_toggle", args={"automation_id": auto.pk, "action": "create"})
    return Response(AIAutomationSerializer(auto).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAdminUser, CanManageAutomations])
def automation_detail(request, pk: int):
    auto = get_object_or_404(AIAutomation, pk=pk)

    if request.method == "GET":
        return Response(AIAutomationSerializer(auto).data)

    if request.method == "DELETE":
        auto.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    ser = AIAutomationUpdateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    for k, v in ser.validated_data.items():
        setattr(auto, k, v)
    auto.save()
    _audit(request, "automation_toggle", args={"automation_id": auto.pk, "action": "update"})
    return Response(AIAutomationSerializer(auto).data)


@api_view(["POST"])
@permission_classes([IsAdminUser, CanToggleAutomations])
def automation_status(request, pk: int):
    auto = get_object_or_404(AIAutomation, pk=pk)
    ser = AIAutomationStatusSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    auto.status = ser.validated_data["status"]
    if "is_enabled" in ser.validated_data:
        auto.is_enabled = ser.validated_data["is_enabled"]
    else:
        auto.is_enabled = auto.status == "Active"
    auto.save(update_fields=["status", "is_enabled", "updated_at"])

    _audit(
        request,
        "automation_toggle",
        args={"automation_id": auto.pk, "status": auto.status, "enabled": auto.is_enabled},
    )
    return Response(AIAutomationSerializer(auto).data)


@api_view(["GET"])
@permission_classes([IsAdminUser, CanViewAutomationRuns])
def automation_runs(request, pk: int):
    auto = get_object_or_404(AIAutomation, pk=pk)
    qs = auto.executions.all()
    status_filter = request.query_params.get("status")
    if status_filter and status_filter != "all":
        qs = qs.filter(status=status_filter)
    limit = int(request.query_params.get("limit") or 50)
    return Response(AIAutomationRunSerializer(qs[:limit], many=True).data)


@api_view(["POST"])
@permission_classes([IsAdminUser, CanRunAutomations])
def automation_run_now(request, pk: int):
    auto = get_object_or_404(AIAutomation, pk=pk)

    ser = AIAutomationRunRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    dry_run = ser.validated_data.get("dry_run", False)

    run = AIAutomationRun.objects.create(
        automation=auto,
        status="running",
        triggered_by="manual",
        triggered_by_user=request.user,
        started_at=timezone.now(),
    )

    try:
        result = run_automation(
            auto, dry_run=dry_run, params=ser.validated_data.get("params", {})
        )
        run.status = "success"
        run.summary = str(result.get("summary", ""))[:255]
        run.output = result.get("output", {}) or {}
        run.items_affected = int(result.get("items_affected", 0) or 0)
    except Exception as exc:  # noqa: BLE001
        run.status = "failed"
        run.error_message = str(exc)[:2000]

    run.finished_at = timezone.now()
    run.duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)
    run.save()

    auto.runs = (auto.runs or 0) + 1
    if run.status == "failed":
        auto.runs_failed = (auto.runs_failed or 0) + 1
    auto.last_run_at = run.finished_at
    auto.last_run_status = run.status
    auto.last_error = run.error_message if run.status == "failed" else ""
    total = auto.runs or 1
    auto.success_rate = round(((total - (auto.runs_failed or 0)) / total) * 100, 2)
    auto.save(
        update_fields=[
            "runs",
            "runs_failed",
            "last_run_at",
            "last_run_status",
            "last_error",
            "success_rate",
            "updated_at",
        ]
    )

    _audit(
        request,
        "automation_run",
        args={"automation_id": auto.pk, "run_id": run.pk, "dry_run": dry_run},
        result_size=run.items_affected,
    )

    if request.query_params.get("format") == "summary":
        return Response(
            {
                "id": run.pk,
                "status": run.status,
                "summary": run.summary,
                "itemsAffected": run.items_affected,
            }
        )

    return Response(AIAutomationRunSerializer(run).data, status=status.HTTP_201_CREATED)


AUTOMATION_TEMPLATES = [
    {"name": "Order Confirmation", "kind": "custom", "trigger": "Order placed", "action": "Send WhatsApp confirmation"},
    {"name": "Shipping Update", "kind": "custom", "trigger": "Order status → Shipped", "action": "Send WhatsApp tracking link"},
    {"name": "Delivery Confirmation", "kind": "custom", "trigger": "Order status → Delivered", "action": "Send WhatsApp thank-you + review request"},
    {"name": "Abandoned Cart Recovery", "kind": "abandoned_cart", "trigger": "Cart abandoned for 1 hour", "action": "Send WhatsApp reminder"},
    {"name": "Payment Reminder", "kind": "pending_order", "trigger": "Order unpaid for 24 hours", "action": "Send WhatsApp payment link"},
    {"name": "Welcome Message", "kind": "custom", "trigger": "First message from new customer", "action": "Send welcome + catalog link"},
    {"name": "Low Stock Alert", "kind": "low_stock", "trigger": "Stock below threshold", "action": "Notify admin team"},
    {"name": "VIP Customer Alert", "kind": "custom", "trigger": "Customer total spend > KES 50,000", "action": "Tag as VIP + notify admin"},
    {"name": "Creator Commission Due", "kind": "custom", "trigger": "Creator sales logged", "action": "Notify finance team"},
    {"name": "Daily Sales Summary", "kind": "sales_summary", "trigger": "Every day at 20:00", "action": "Email summary to owner"},
    {"name": "Newsletter Performance", "kind": "newsletter_perf", "trigger": "24h after newsletter send", "action": "Report open + click rate"},
    {"name": "Unusual Sales Spike", "kind": "unusual_change", "trigger": "Sales > 3x 7-day average", "action": "Notify admin team"},
    {"name": "Failed Payment Follow-up", "kind": "failed_payment", "trigger": "Payment failed", "action": "Notify customer + admin"},
    {"name": "Return Request Notification", "kind": "return_refund", "trigger": "Return requested", "action": "Notify customer + admin"},
    {"name": "Low-Rated Review Alert", "kind": "review_alert", "trigger": "Review with rating ≤ 3", "action": "Notify admin team"},
    {"name": "Churn Win-Back", "kind": "churn_win_back", "trigger": "Customer inactive for 90 days", "action": "Send WhatsApp win-back offer"},
]


@api_view(["GET"])
@permission_classes([IsAdminUser])
def automation_templates(request):
    return Response(AUTOMATION_TEMPLATES)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def tool_schemas(request):
    return Response(tool_manifest())


@api_view(["POST"])
@permission_classes([IsAdminUser, IsAIAssistantEnabled])
def tool_preview(request):
    name = (request.data or {}).get("name")
    args = (request.data or {}).get("args") or {}
    if not name:
        return Response({"detail": "name is required."}, status=status.HTTP_400_BAD_REQUEST)
    result = execute_tool(name, args, user=request.user)
    _audit(
        request,
        "tool_call",
        tool=str(name),
        args=args,
        result_size=len(result.get("items") or []),
    )
    return Response(result)


@api_view(["POST"])
@permission_classes([*ActionPreviewPermissions])
def action_preview(request):
    ser = AIActionPreviewSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    action = {
        "id": f"pending-{data['tool']}",
        "tool": data["tool"],
        "title": data["title"],
        "description": data.get("description", ""),
        "params": data.get("params") or {},
        "confirmLabel": data.get("confirm_label") or "Confirm",
        "cancelLabel": data.get("cancel_label") or "Cancel",
        "destructive": bool(data.get("destructive")),
        "preview": data.get("preview") or [],
    }
    _audit(
        request,
        "tool_call",
        tool=f"preview:{data['tool']}",
        args=data.get("params") or {},
        is_verified=True,
    )
    return Response(action)


@api_view(["POST"])
@permission_classes([*ActionExecutePermissions])
def action_execute(request):
    ser = AIActionExecuteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    tool_name = data["tool"]
    params = data.get("params") or {}
    confirmed = bool(data.get("confirm"))

    settings_row = AISettings.get_solo()
    if not settings_row.allow_write_actions:
        return Response(
            {"detail": "AI write actions are disabled."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if settings_row.require_confirmation_for_destructive and not confirmed:
        return Response(
            {"detail": "This action requires explicit confirmation."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        from .services import execute_action_tool  # type: ignore

        result = execute_action_tool(tool_name, params, user=request.user)
        success = bool(result.get("success"))
        message = result.get("summary") or result.get("message") or ""
    except Exception as exc:  # noqa: BLE001
        success = False
        message = str(exc)
        result = {"success": False, "summary": message}

    _audit(
        request,
        "write" if success else "destructive",
        tool=tool_name,
        args=params,
        was_confirmed=confirmed,
        is_verified=success,
    )

    return Response(
        {
            "success": success,
            "message": message,
            "result": result,
        },
        status=status.HTTP_200_OK if success else status.HTTP_400_BAD_REQUEST,
    )


@api_view(["POST"])
@permission_classes([IsAdminUser, IsAIAssistantEnabled])
def content_generate(request):
    ser = AIContentGenerateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    Product = None
    try:
        from products.models import Product as ProductModel  # type: ignore

        Product = ProductModel.objects.filter(pk=data["product_id"]).first()
    except Exception:  # noqa: BLE001
        try:
            from catalog.models import Product as ProductModel  # type: ignore

            Product = ProductModel.objects.filter(pk=data["product_id"]).first()
        except Exception:  # noqa: BLE001
            Product = None

    product_name = getattr(Product, "name", f"Product {data['product_id']}")
    try:
        payload = generate_content(
            product_name=product_name,
            content_type=data["content_type"],
            tone=data["tone"],
            language=data["language"],
            length=data["length"],
            user=request.user,
        )
    except Exception as exc:  # noqa: BLE001
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
    return Response(payload)


@api_view(["POST"])
@permission_classes([IsAdminUser, IsAIAssistantEnabled])
def content_bulk(request):
    ser = AIContentBulkSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    job_id = f"bulk-{timezone.now().timestamp():.0f}"
    return Response({"jobId": job_id, "count": len(ser.validated_data["product_ids"])})


@api_view(["GET", "PATCH"])
@permission_classes([IsAdminUser])
def search_config(request):
    cfg = AISettings.get_solo()
    if request.method == "GET":
        return Response(
            {
                "enabled": cfg.enabled,
                "natural_language": True,
                "personalized": True,
                "explain": False,
                "cross_sell": True,
            }
        )
    return Response({"detail": "ok"})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def search_analytics(request):
    return Response(
        {
            "top_searches": [],
            "zero_result_searches": [],
            "ai_conversions": 0,
            "search_to_cart_rate": 0,
        }
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def search_data_quality(request):
    return Response(
        {
            "attribute_completeness": 72,
            "content_quality": 81,
            "aeo_keywords": 148,
        }
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAdminUser])
def settings_view(request):
    cfg = AISettings.get_solo()
    if request.method == "GET":
        return Response(AISettingsSerializer(cfg).data)

    if not CanEditAISettings().has_permission(request, None):
        return Response(
            {"detail": "You do not have permission to change AI settings."},
            status=status.HTTP_403_FORBIDDEN,
        )

    ser = AISettingsUpdateSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = dict(ser.validated_data)

    api_key = data.pop("api_key", None)
    if api_key is not None:
        cfg.api_key = api_key

    for key, value in data.items():
        setattr(cfg, key, value)

    cfg.updated_by = request.user
    cfg.save()
    _audit(request, "settings_update", args={k: str(v)[:60] for k, v in data.items()})
    return Response(AISettingsSerializer(cfg).data)


@api_view(["POST"])
@permission_classes([IsAdminUser, CanEditAISettings])
def settings_disable(request):
    cfg = AISettings.get_solo()
    cfg.enabled = False
    cfg.updated_by = request.user
    cfg.save(update_fields=["enabled", "updated_by", "updated_at"])
    _audit(request, "settings_update", args={"enabled": False})
    return Response(AISettingsSerializer(cfg).data)


@api_view(["GET"])
@permission_classes([IsAdminUser, CanViewAIUsage])
def usage(request):
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    qs = AIUsageLog.objects.filter(created_at__gte=month_start)
    tokens = sum(r.tokens_in + r.tokens_out for r in qs)
    cost = sum(r.cost_kes for r in qs)
    days = max(1, (now - month_start).days or 1)

    by_day: dict[str, dict[str, int]] = {}
    for row in AIUsageLog.objects.filter(created_at__gte=now - timedelta(days=7)):
        key = row.created_at.strftime("%a")
        bucket = by_day.setdefault(
            key, {"assistant": 0, "content": 0, "search": 0, "insights": 0, "automation": 0}
        )
        bucket[row.feature] = bucket.get(row.feature, 0) + row.tokens_in + row.tokens_out

    order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    usage_by_day = [{"day": d, **by_day[d]} for d in order if d in by_day]

    cost_rows = qs.values("feature").annotate(total=Sum("cost_kes"))
    palette = {
        "assistant": "#172554",
        "content": "#10b981",
        "search": "#8b5cf6",
        "insights": "#f59e0b",
        "automation": "#0891b2",
    }
    cost_by_feature = [
        {
            "name": r["feature"].title(),
            "value": round(float(r["total"] or 0), 2),
            "color": palette.get(r["feature"], "#94a3b8"),
        }
        for r in cost_rows
    ]

    assistant_tokens = sum(
        r.tokens_in + r.tokens_out for r in qs if r.feature == "assistant"
    )
    share = int(round((assistant_tokens / tokens) * 100)) if tokens else 0

    return Response(
        {
            "tokensThisMonth": tokens,
            "estimatedCostKes": round(cost, 2),
            "dailyAverage": int(tokens / days),
            "assistantShare": share,
            "usageByDay": usage_by_day,
            "costByFeature": cost_by_feature,
        }
    )


@api_view(["GET"])
@permission_classes([IsAdminUser, CanViewAIUsage])
def usage_recent(request):
    qs = AIUsageLog.objects.order_by("-created_at")[:50]
    return Response(AIUsageSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAdminUser, CanViewAIAuditLog])
def audit_log(request):
    qs = AIAuditLog.objects.all()
    action = request.query_params.get("action")
    if action and action != "all":
        qs = qs.filter(action=action)
    user_id = request.query_params.get("user")
    if user_id:
        qs = qs.filter(user_id=user_id)
    limit = int(request.query_params.get("limit") or 100)
    return Response(AIAuditLogSerializer(qs[:limit], many=True).data)