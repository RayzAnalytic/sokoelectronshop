from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Callable, Generator

from django.db import transaction
from django.utils import timezone

from .models import (
    AIAuditLog,
    AIAutomation,
    AIAutomationRun,
    AIConversation,
    AIMessage,
    AISettings,
    AIToolCall,
    AIUsageLog,
)
from .tools import TOOL_SCHEMAS, execute_tool

logger = logging.getLogger(__name__)

BASE_SYSTEM_PROMPT = """\
You are the AI Copilot for a Kenyan e-commerce admin dashboard.

Rules:
  • You are READ-ONLY. Never claim to change data unless you successfully called a write tool.
  • Only use numbers returned by tools. Never invent figures.
  • If a tool result says "note" or "missing_data", surface that honestly.
  • When the user asks about WhatsApp, social, banners, discounts, orders,
    products, customers, payments, shipping, reviews, or newsletter data —
    CALL the matching tool. Do not say "I don't have a tool for that"
    until you have actually tried.
  • For "what needs my attention today?" or similar, call
    `get_attention_summary` first.
  • If a tool reports that a model is missing, call `diagnose_models` once
    and explain what is actually installed, then suggest the closest
    available alternative.
  • Currency is Kenyan Shillings (KES). Format as "KES 12,400".
  • Keep answers short — 1 to 3 sentences, then any table or chart hints.
  • When you have a chartable result, prefer calling a tool over guessing.
  • End with a clear next step or a link to the relevant admin page.
  • If the user's question is ambiguous, ask one clarifying question.
  • Never reveal customer emails or phone numbers. They are already masked.
"""

RATE_INPUT_KES_PER_M = 18.0
RATE_OUTPUT_KES_PER_M = 40.0

CHARS_PER_TOKEN = 4

DEFAULT_MAX_TOKENS = 1024
DEFAULT_TEMPERATURE = 0.3

NON_STREAMING_MODELS = ("gpt-oss", "qwen3", "moonshot", "compound", "deepseek-r1")


EVENT_TO_TRIGGER: dict[str, str] = {
    "order.placed": "Order placed",
    "order.paid": "Order paid",
    "order.shipped": "Order status → Shipped",
    "order.delivered": "Order status → Delivered",
    "order.cancelled": "Order status → Cancelled",
    "order.unpaid": "Order unpaid for 24 hours",
    "customer.first_message": "First message from new customer",
    "customer.vip": "Customer total spend > KES 50,000",
    "cart.abandoned": "Cart abandoned for 1 hour",
    "stock.low": "Stock below threshold",
    "stock.out": "Stock depleted",
    "stock.below_threshold": "Stock below threshold",
    "payment.failed": "Payment failed",
    "payment.refunded": "Refund issued",
    "newsletter.sent": "Newsletter sent",
    "creator.sales_logged": "Creator sales logged",
    "sales.daily_summary": "Daily sales summary",
    "sales.spike": "Sales > 3x 7-day average",
    "sales.drop": "Sales < 50% 7-day average",
    "return.requested": "Return requested",
    "return.approved": "Return approved",
    "return.rejected": "Return rejected",
    "review.created": "Review created",
    "review.low_rating": "Review with rating ≤ 3",
    "customer.signup": "Customer signed up",
    "customer.churn_risk": "Customer inactive for 90 days",
    "discount.redeemed": "Discount redeemed",
    "whatsapp.message_received": "WhatsApp message received",
    "whatsapp.broadcast_sent": "WhatsApp broadcast sent",
    "banner.published": "Banner published",
    "tiktok.order_received": "TikTok order received",
    "user.created": "Staff account created",
    "settings.changed": "Settings changed",
}


class GroqUnavailable(RuntimeError):
    pass


def _http_error_body(exc: Exception) -> str:
    try:
        response = getattr(exc, "response", None)
        if response is None:
            return ""
        body = getattr(response, "text", None)
        if body:
            return str(body)[:2000]
        if hasattr(response, "json"):
            try:
                return json.dumps(response.json())[:2000]
            except Exception:
                return ""
    except Exception:
        pass
    return ""


def _supports_streaming(model: str) -> bool:
    model_lower = (model or "").lower()
    return not any(b in model_lower for b in NON_STREAMING_MODELS)


def _client():
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise GroqUnavailable(
            "The `openai` package is not installed. Run: pip install openai"
        ) from exc

    cfg = AISettings.get_solo()
    provider = (cfg.provider or "").lower()

    api_key = cfg.resolved_api_key()
    if not api_key:
        raise GroqUnavailable(
            f"{provider or 'AI'} API key is not configured. "
            f"Add it in admin → AI Settings or set the matching env var."
        )

    base_url = cfg.resolved_base_url()

    default_headers: dict[str, str] | None = None
    if provider == "openrouter":
        from django.conf import settings

        referer = getattr(settings, "OPENROUTER_HTTP_REFERER", "") or ""
        title = getattr(settings, "OPENROUTER_X_TITLE", "") or "Myshop Admin"
        default_headers = {"X-Title": title}
        if referer:
            default_headers["HTTP-Referer"] = referer

    client = OpenAI(
        api_key=api_key,
        base_url=base_url or "https://api.groq.com/openai/v1",
        default_headers=default_headers,
    )
    return client, cfg


def _client_with_model():
    client, cfg = _client()
    return client, cfg.model


def _effective_system_prompt(cfg: AISettings, context: dict | None) -> str:
    parts = [BASE_SYSTEM_PROMPT]
    if cfg.system_prompt:
        parts.append(cfg.system_prompt.strip())
    if context:
        parts.append(
            f"\nCurrent admin page: {context.get('label', 'Admin')} "
            f"({context.get('path', '/admin')}) — {context.get('description', '')}"
        )
    return "\n\n".join(parts)


def _allowed_tools(cfg: AISettings) -> list[dict]:
    allowed = set(cfg.allowed_modules or [])
    if not allowed:
        return TOOL_SCHEMAS
    out = []
    for schema in TOOL_SCHEMAS:
        module = (schema.get("function") or {}).get("x-module")
        if module is None or module in allowed:
            out.append(schema)
    return out


def _temperature(cfg: AISettings, default: float = DEFAULT_TEMPERATURE) -> float:
    return float(cfg.temperature) if cfg.temperature is not None else default


def _max_tokens(cfg: AISettings, default: int = DEFAULT_MAX_TOKENS) -> int:
    return int(cfg.max_output_tokens) or default


def _is_groq(cfg: AISettings) -> bool:
    provider = (cfg.provider or "").lower()
    base_url = (cfg.resolved_base_url() or "").lower()
    return "groq" in provider or "api.groq.com" in base_url


def _apply_groq_tool_safety(kwargs: dict[str, Any], cfg: AISettings) -> dict[str, Any]:
    if not _is_groq(cfg):
        return kwargs
    out = dict(kwargs)
    existing = out.get("extra_body")
    merged: dict[str, Any] = dict(existing) if isinstance(existing, dict) else {}
    merged["disable_tool_validation"] = True
    out["extra_body"] = merged
    return out


def _mask_payload(payload: Any, cfg: AISettings, extra_fields: set[str] | None = None) -> Any:
    if not cfg.masking:
        return payload

    mask_names = {
        "email",
        "phone",
        "customer_email",
        "customer_phone",
        "phone_number",
        "msisdn",
        "wa_id",
        "card_number",
        "cvv",
    }
    mask_names |= {str(f).lower() for f in (cfg.mask_fields or [])}
    if extra_fields:
        mask_names |= {f.lower() for f in extra_fields}

    def _mask_value(v: str) -> str:
        if not v:
            return v
        if "@" in v:
            name, _, domain = v.partition("@")
            return f"{name[:2]}***@{domain}"
        return f"{v[:3]}***{v[-2:]}" if len(v) > 5 else "***"

    def _walk(node: Any) -> Any:
        if isinstance(node, dict):
            return {
                k: (_mask_value(str(v)) if isinstance(v, str) and k.lower() in mask_names else _walk(v))
                for k, v in node.items()
            }
        if isinstance(node, list):
            return [_walk(x) for x in node]
        return node

    return _walk(payload)


def _compute_cost(tokens_in: int, tokens_out: int) -> float:
    return round(
        tokens_in / 1_000_000 * RATE_INPUT_KES_PER_M
        + tokens_out / 1_000_000 * RATE_OUTPUT_KES_PER_M,
        4,
    )


def _log_usage(
    feature: str,
    model: str,
    tokens_in: int,
    tokens_out: int,
    *,
    provider: str = "",
    user=None,
    conversation: AIConversation | None = None,
    request_id: str = "",
    latency_ms: int = 0,
    cache_hit: bool = False,
) -> None:
    try:
        AIUsageLog.objects.create(
            feature=feature,
            provider=provider,
            model=model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_kes=_compute_cost(tokens_in, tokens_out),
            user=user if getattr(user, "is_authenticated", False) else None,
            conversation=conversation,
            request_id=request_id[:64],
            latency_ms=latency_ms,
            cache_hit=cache_hit,
        )
    except Exception:
        logger.exception("Failed to write AI usage log")


def _audit(
    user,
    action: str,
    tool: str = "",
    args: dict | None = None,
    result_size: int = 0,
    *,
    request_id: str = "",
    is_verified: bool = True,
    was_confirmed: bool = False,
) -> None:
    try:
        AIAuditLog.objects.create(
            user=user if getattr(user, "is_authenticated", False) else None,
            action=action,
            tool=tool,
            args=args or {},
            result_size=result_size,
            request_id=request_id[:64],
            is_verified=is_verified,
            was_confirmed=was_confirmed,
        )
    except Exception:
        logger.exception("Failed to write AI audit log")


def _audit_automation(*, action: str, tool: str, args: dict) -> None:
    try:
        AIAuditLog.objects.create(
            action=action,
            tool=tool,
            args=args,
            result_size=0,
        )
    except Exception:
        pass


def _update_conversation_rollup(conversation: AIConversation, msg: AIMessage) -> None:
    try:
        conversation.total_tokens_in = (conversation.total_tokens_in or 0) + (msg.tokens_in or 0)
        conversation.total_tokens_out = (conversation.total_tokens_out or 0) + (msg.tokens_out or 0)
        conversation.total_cost_kes = round(
            (conversation.total_cost_kes or 0.0)
            + _compute_cost(msg.tokens_in or 0, msg.tokens_out or 0),
            4,
        )
        conversation.message_count = conversation.messages.count()
        conversation.save(update_fields=[
            "total_tokens_in",
            "total_tokens_out",
            "total_cost_kes",
            "message_count",
            "updated_at",
        ])
    except Exception:
        logger.exception("Failed to update conversation rollup")


def _history(conversation: AIConversation, limit: int = 20) -> list[dict]:
    qs = conversation.messages.exclude(role="tool").order_by("-created_at")[:limit]
    msgs = list(reversed(qs))
    return [{"role": m.role, "content": m.content} for m in msgs if m.content]


def _fail_message(msg: AIMessage, error: str, partial: str = "") -> None:
    try:
        msg.status = "error"
        msg.content = partial or msg.content or ""
        msg.error_message = error[:2000]
        msg.save(update_fields=["status", "content", "error_message"])
    except Exception:
        logger.exception("Failed to mark message as errored")


def stream_assistant_reply(
    conversation: AIConversation,
    user_message: AIMessage,
    *,
    context: dict | None = None,
    user=None,
) -> Generator[dict, None, None]:
    started = time.monotonic()
    request_id = uuid.uuid4().hex[:16]

    try:
        client, cfg = _client()
    except GroqUnavailable as exc:
        yield {"type": "error", "message": str(exc)}
        return

    if not cfg.streaming_enabled:
        yield {"type": "error", "message": "Streaming is disabled."}
        return

    assistant_msg = AIMessage.objects.create(
        conversation=conversation,
        role="assistant",
        status="streaming",
        content="",
        model=cfg.model,
    )

    messages: list[dict] = [
        {"role": "system", "content": _effective_system_prompt(cfg, context)},
        *_history(conversation),
        {"role": "user", "content": user_message.content},
    ]

    tools = _allowed_tools(cfg)
    supports_stream = _supports_streaming(cfg.model)

    pass1_kwargs: dict[str, Any] = {
        "model": cfg.model,
        "messages": messages,
        "max_tokens": _max_tokens(cfg),
        "temperature": _temperature(cfg),
    }
    if tools:
        pass1_kwargs["tools"] = tools
        pass1_kwargs["tool_choice"] = "auto"
    pass1_kwargs = _apply_groq_tool_safety(pass1_kwargs, cfg)

    try:
        first = client.chat.completions.create(**pass1_kwargs)
    except Exception as exc:
        body = _http_error_body(exc)
        logger.error(
            "AI provider call 1 failed (%s/%s) status=%s body=%s",
            cfg.provider, cfg.model,
            getattr(getattr(exc, "response", None), "status_code", "?"),
            body,
        )
        _fail_message(assistant_msg, f"AI provider error: {exc}")
        _audit(user, "assistant_reply", result_size=0,
               request_id=request_id, is_verified=False)
        yield {"type": "error", "message": f"AI provider error: {exc}"}
        return

    choice = first.choices[0].message
    tokens_in = getattr(first.usage, "prompt_tokens", 0) or 0
    tokens_out = getattr(first.usage, "completion_tokens", 0) or 0

    meta: dict[str, Any] = {}
    data_sources: set[str] = set()
    missing_data: set[str] = set()
    tools_were_called = False

    if choice.tool_calls:
        tools_were_called = True
        messages.append({
            "role": "assistant",
            "content": choice.content,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments or "{}",
                    },
                }
                for tc in choice.tool_calls
            ],
        })

        for tc in choice.tool_calls:
            t_tool = time.monotonic()
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            result = execute_tool(tc.function.name, args)
            duration_ms = int((time.monotonic() - t_tool) * 1000)
            row_count = len(result.get("items") or [])

            masked = _mask_payload(result, cfg)

            try:
                AIToolCall.objects.create(
                    message=assistant_msg,
                    tool_name=tc.function.name,
                    arguments=args,
                    result_summary=str(result.get("summary", ""))[:255],
                    result_payload=masked,
                    row_count=row_count,
                    duration_ms=duration_ms,
                    status="ok" if "note" not in result else "error",
                    error_message=str(result.get("note", ""))[:2000],
                )
            except Exception:
                logger.exception("Failed to write tool call row")

            if result.get("note"):
                missing_data.add(str(result["note"])[:120])
            for key in ("data_sources", "sources"):
                for s in result.get(key) or []:
                    data_sources.add(str(s))
            if result.get("summary"):
                data_sources.add(tc.function.name)

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(masked)[:6000],
            })

            for key in ("chart", "table", "link"):
                if result.get(key):
                    meta[key] = result[key]
            if result.get("link") and "quickReplies" not in meta:
                meta["quickReplies"] = ["Show me more", "Open the full report"]

            _audit(
                user,
                "tool_call",
                tc.function.name,
                args,
                row_count,
                request_id=request_id,
                is_verified=not result.get("note"),
            )

    buffer: list[str] = []
    pass2_kwargs: dict[str, Any] = {
        "model": cfg.model,
        "messages": messages,
        "max_tokens": _max_tokens(cfg),
        "temperature": _temperature(cfg, default=0.4),
    }
    if not tools_were_called and tools:
        pass2_kwargs["tools"] = tools
        pass2_kwargs["tool_choice"] = "auto"
    else:
        if _is_groq(cfg):
            pass2_kwargs["tools"] = []
            pass2_kwargs["tool_choice"] = "none"
    pass2_kwargs = _apply_groq_tool_safety(pass2_kwargs, cfg)

    if supports_stream:
        try:
            stream = client.chat.completions.create(**{**pass2_kwargs, "stream": True})
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    buffer.append(delta)
                    yield {"type": "token", "text": delta}
        except Exception as exc:
            body = _http_error_body(exc)
            logger.error(
                "AI stream failed (%s/%s) status=%s body=%s",
                cfg.provider, cfg.model,
                getattr(getattr(exc, "response", None), "status_code", "?"),
                body,
            )

            try:
                fallback_kwargs = {**pass2_kwargs, "stream": False}
                fallback_kwargs = _apply_groq_tool_safety(fallback_kwargs, cfg)
                completion = client.chat.completions.create(**fallback_kwargs)
                content_fallback = completion.choices[0].message.content or ""
                if content_fallback:
                    buffer.append(content_fallback)
                    yield {"type": "token", "text": content_fallback}
            except Exception as fb_exc:
                fb_body = _http_error_body(fb_exc)
                logger.error(
                    "Non-streaming fallback also failed (%s/%s) status=%s body=%s",
                    cfg.provider, cfg.model,
                    getattr(getattr(fb_exc, "response", None), "status_code", "?"),
                    fb_body,
                )
                _fail_message(
                    assistant_msg,
                    f"Stream failed: {exc} | Fallback failed: {fb_exc}",
                    partial="".join(buffer),
                )
                yield {
                    "type": "error",
                    "message": (
                        f"AI failed. stream: {exc} | fallback: {fb_exc} "
                        f"| stream_body: {body[:300]} | fb_body: {fb_body[:300]}"
                    ),
                }
                return
    else:
        logger.info(
            "Model %s is in NON_STREAMING_MODELS — using non-streaming directly",
            cfg.model,
        )
        try:
            non_stream_kwargs = {**pass2_kwargs, "stream": False}
            completion = client.chat.completions.create(**non_stream_kwargs)
            content_direct = completion.choices[0].message.content or ""
            if content_direct:
                buffer.append(content_direct)
                yield {"type": "token", "text": content_direct}
        except Exception as exc:
            body = _http_error_body(exc)
            logger.error(
                "AI non-streaming (forced) failed (%s/%s) status=%s body=%s",
                cfg.provider, cfg.model,
                getattr(getattr(exc, "response", None), "status_code", "?"),
                body,
            )
            _fail_message(
                assistant_msg,
                f"AI failed: {exc} | body: {body[:500]}",
                partial="".join(buffer),
            )
            yield {
                "type": "error",
                "message": f"AI failed: {exc} | body: {body[:500]}",
            }
            return

    content = "".join(buffer).strip()

    if content:
        tokens_out += max(1, len(content) // CHARS_PER_TOKEN)
        try:
            prompt_chars = sum(len(str(m.get("content") or "")) for m in messages)
            tokens_in += max(1, prompt_chars // CHARS_PER_TOKEN)
        except Exception:
            pass

    latency_ms = int((time.monotonic() - started) * 1000)

    assistant_msg.content = content
    assistant_msg.status = "ok"
    assistant_msg.chart = meta.get("chart")
    assistant_msg.table = meta.get("table")
    assistant_msg.link = meta.get("link")
    assistant_msg.quick_replies = meta.get("quickReplies")
    assistant_msg.tokens_in = tokens_in
    assistant_msg.tokens_out = tokens_out
    assistant_msg.latency_ms = latency_ms
    assistant_msg.is_verified = not missing_data
    assistant_msg.data_sources = sorted(data_sources)
    assistant_msg.missing_data = sorted(missing_data)
    assistant_msg.save()

    _update_conversation_rollup(conversation, assistant_msg)
    _log_usage(
        "assistant",
        cfg.model,
        tokens_in,
        tokens_out,
        provider=cfg.provider,
        user=user,
        conversation=conversation,
        request_id=request_id,
        latency_ms=latency_ms,
    )
    _audit(
        user,
        "assistant_reply",
        result_size=len(content),
        request_id=request_id,
        is_verified=not missing_data,
    )

    if meta:
        yield {"type": "meta", **meta}
    yield {
        "type": "done",
        "messageId": assistant_msg.pk,
        "timestamp": timezone.localtime(assistant_msg.created_at).strftime("%H:%M"),
    }


CONTENT_PROMPTS = {
    "Product Description": "Write a product description with 3–5 benefit-led bullets. End with a call to action.",
    "TikTok Caption": "Write a punchy TikTok caption under 150 characters with 5 relevant hashtags.",
    "WhatsApp Broadcast": "Write a short promotional WhatsApp message under 60 words with an emoji and a clear CTA.",
    "Social Media Post": "Write a Facebook/Instagram caption with a hook and a CTA.",
    "SEO Meta Description": "Write a 155-character SEO meta description.",
    "Product Title": "Write a keyword-rich TikTok-style product title under 60 characters.",
}


def generate_content(
    *,
    product_name: str,
    content_type: str,
    tone: str,
    language: str,
    length: str,
    user=None,
) -> dict:
    client, cfg = _client()
    started = time.monotonic()
    request_id = uuid.uuid4().hex[:16]

    instruction = CONTENT_PROMPTS.get(content_type, "Write marketing copy for this product.")
    user_prompt = (
        f"Product: {product_name}\n"
        f"Content type: {content_type}\n"
        f"Tone: {tone}\n"
        f"Language: {language}\n"
        f"Length: {length}\n\n"
        f"{instruction}\n"
        f"Return only the final copy, no preamble."
    )

    try:
        resp = client.chat.completions.create(
            model=cfg.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior e-commerce copywriter for a Kenyan store.",
                },
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=min(_max_tokens(cfg, default=600), 1200),
            temperature=_temperature(cfg, default=0.6),
            extra_body={"disable_tool_validation": True} if _is_groq(cfg) else None,
        )
    except Exception as exc:
        logger.error(
            "Content generation failed (%s/%s) body=%s",
            cfg.provider, cfg.model, _http_error_body(exc),
        )
        raise RuntimeError(f"Content generation failed: {exc}") from exc

    body = resp.choices[0].message.content or ""
    tokens_in = getattr(resp.usage, "prompt_tokens", 0) or 0
    tokens_out = getattr(resp.usage, "completion_tokens", 0) or 0
    latency_ms = int((time.monotonic() - started) * 1000)

    _log_usage(
        "content",
        cfg.model,
        tokens_in,
        tokens_out,
        provider=cfg.provider,
        user=user,
        request_id=request_id,
        latency_ms=latency_ms,
    )
    _audit(
        user,
        "content_generate",
        content_type,
        {"product": product_name},
        len(body),
        request_id=request_id,
    )

    return {
        "body": body.strip(),
        "content_type": content_type,
        "tone": tone,
        "language": language,
        "length": length,
        "model": cfg.model,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
    }


def dispatch(
    event_name: str,
    payload: dict | None = None,
    *,
    dedupe_key: str | None = None,
) -> int:
    result = dispatch_detailed(event_name, payload or {}, dedupe_key=dedupe_key)
    return result["fired"]


def dispatch_detailed(
    event_name: str,
    payload: dict,
    *,
    dedupe_key: str | None = None,
) -> dict[str, Any]:
    trigger = EVENT_TO_TRIGGER.get(event_name)
    if not trigger:
        logger.debug("No trigger mapping for event %s", event_name)
        return {
            "fired": 0,
            "succeeded": 0,
            "failed": 0,
            "skipped": 0,
            "run_ids": [],
            "note": f"unknown event: {event_name}",
        }

    try:
        automations = list(
            AIAutomation.objects.filter(
                trigger=trigger,
                status="Active",
                is_enabled=True,
            )
        )
    except Exception:
        logger.exception("Failed to load automations for event %s", event_name)
        return {
            "fired": 0,
            "succeeded": 0,
            "failed": 0,
            "skipped": 0,
            "run_ids": [],
            "note": "load failed",
        }

    succeeded = 0
    failed = 0
    skipped = 0
    run_ids: list[int] = []

    for auto in automations:
        try:
            verdict = _can_run(auto)
            if verdict is not None:
                skipped += 1
                _record_skip(auto, event_name, payload, reason=verdict)
                continue

            run = _record_start(auto, event_name, payload, dedupe_key=dedupe_key)

            try:
                _execute_action(auto, event_name, payload)
            except Exception as exc:
                logger.exception(
                    "Automation %s failed for event %s", auto.pk, event_name,
                )
                _record_finish(run, auto, success=False, error=str(exc))
                failed += 1
            else:
                _record_finish(run, auto, success=True)
                succeeded += 1

            run_ids.append(run.pk)

        except Exception:
            logger.exception(
                "Dispatcher loop error for automation %s (event %s)",
                auto.pk, event_name,
            )
            failed += 1

    fired = succeeded + failed
    logger.info(
        "Dispatched event %s → fired=%d ok=%d err=%d skipped=%d",
        event_name, fired, succeeded, failed, skipped,
    )

    return {
        "fired": fired,
        "succeeded": succeeded,
        "failed": failed,
        "skipped": skipped,
        "run_ids": run_ids,
    }


def _can_run(auto: AIAutomation) -> str | None:
    now = timezone.now()

    if auto.requires_approval:
        return "requires_approval"

    if auto.cooldown_minutes and auto.last_run_at:
        delta = (now - auto.last_run_at).total_seconds() / 60.0
        if delta < auto.cooldown_minutes:
            return f"cooldown ({int(delta)}m < {auto.cooldown_minutes}m)"

    if auto.max_runs_per_day:
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_runs = auto.executions.filter(started_at__gte=day_start).count()
        if today_runs >= auto.max_runs_per_day:
            return f"daily cap reached ({today_runs}/{auto.max_runs_per_day})"

    return None


def _record_start(
    auto: AIAutomation,
    event_name: str,
    payload: dict,
    *,
    dedupe_key: str | None,
) -> AIAutomationRun:
    request_id = dedupe_key or f"{event_name}:{auto.pk}:{timezone.now().timestamp():.0f}"
    run = AIAutomationRun.objects.create(
        automation=auto,
        status="running",
        triggered_by="event",
        started_at=timezone.now(),
        request_id=request_id[:64],
        output={"event": event_name, "payload_keys": sorted(payload.keys())},
    )
    _audit_automation(
        action="automation_run",
        tool=auto.kind or "custom",
        args={"automation_id": auto.pk, "event": event_name, "run_id": run.pk},
    )
    return run


def _record_finish(
    run: AIAutomationRun,
    auto: AIAutomation,
    *,
    success: bool,
    error: str = "",
) -> None:
    now = timezone.now()
    run.finished_at = now
    run.duration_ms = int((now - run.started_at).total_seconds() * 1000)
    if success:
        run.status = "success"
        run.summary = run.summary or "Completed"
    else:
        run.status = "failed"
        run.error_message = (error or "")[:2000]
    run.save()

    with transaction.atomic():
        fresh = AIAutomation.objects.select_for_update().get(pk=auto.pk)
        fresh.runs = (fresh.runs or 0) + 1
        if not success:
            fresh.runs_failed = (fresh.runs_failed or 0) + 1
        fresh.last_run_at = now
        fresh.last_run_status = run.status
        fresh.last_error = run.error_message if not success else ""
        total = fresh.runs or 1
        fresh.success_rate = round(((total - (fresh.runs_failed or 0)) / total) * 100, 2)
        fresh.save(update_fields=[
            "runs",
            "runs_failed",
            "last_run_at",
            "last_run_status",
            "last_error",
            "success_rate",
            "updated_at",
        ])


def _record_skip(
    auto: AIAutomation,
    event_name: str,
    payload: dict,
    *,
    reason: str,
) -> None:
    try:
        AIAutomationRun.objects.create(
            automation=auto,
            status="skipped",
            triggered_by="event",
            started_at=timezone.now(),
            finished_at=timezone.now(),
            summary=f"Skipped: {reason}"[:255],
            output={"event": event_name, "reason": reason},
        )
    except Exception:
        logger.exception("Failed to record skip for automation %s", auto.pk)


def _whatsapp_send(wa_id: str, body: str) -> bool:
    if not wa_id or not body:
        return False

    try:
        from dashboard.whatsapp import services as wa_services
    except Exception:
        logger.info(
            "WhatsApp services module not importable — message skipped "
            "(to=%s, len=%d)", wa_id, len(body),
        )
        return False

    for fn_name in ("send_text", "send_whatsapp_text", "send_message"):
        fn = getattr(wa_services, fn_name, None)
        if callable(fn):
            try:
                fn(wa_id, body)
                return True
            except TypeError:
                try:
                    fn(to=wa_id, body=body)
                    return True
                except Exception:
                    logger.exception("WhatsApp send failed via %s", fn_name)
                    return False
            except Exception:
                logger.exception("WhatsApp send failed via %s", fn_name)
                return False

    logger.info("No usable WhatsApp send function found in dashboard.whatsapp.services")
    return False


KIND_HANDLERS: dict[str, Callable[[AIAutomation, dict, str], None]] = {}


def register_handler(kind: str):
    def _decorator(fn: Callable[[AIAutomation, dict, str], None]):
        KIND_HANDLERS[kind] = fn
        return fn
    return _decorator


def _execute_action(auto: AIAutomation, event_name: str, payload: dict) -> None:
    handler = KIND_HANDLERS.get(auto.kind or "")
    if handler is not None:
        handler(auto, payload, event_name)
        return

    action = (auto.action or "").strip().lower()

    if "whatsapp" in action and "send" in action:
        _send_whatsapp(auto, payload)
    elif "notify" in action or "alert" in action:
        _notify_admin(auto, payload)
    elif "tag" in action:
        _tag_contact(auto, payload)
    elif "email" in action:
        _send_email(auto, payload)
    elif "report" in action or "summary" in action:
        _send_summary(auto, payload)
    else:
        logger.info(
            "Automation %s (kind=%r) has no handler for action %r — recorded as no-op",
            auto.pk, auto.kind, auto.action,
        )


@register_handler("low_stock")
def _handle_low_stock(auto: AIAutomation, payload: dict, event_name: str) -> None:
    threshold = (auto.trigger_config or {}).get("threshold", 5)

    products = payload.get("products")
    if not products and payload.get("product_id"):
        products = [{
            "name": payload.get("name") or f"product #{payload['product_id']}",
            "stock": payload.get("stock", 0),
            "threshold": payload.get("threshold", threshold),
        }]

    if not products:
        logger.info("low_stock handler: no products in payload")
        return

    lines = [
        f"• {p.get('name', '?')} — {p.get('stock', 0)} left "
        f"(threshold {p.get('threshold', threshold)})"
        for p in products[:10]
    ]
    body = "Low stock alert:\n" + "\n".join(lines)
    to = (auto.action_config or {}).get("to_wa_id")
    if to:
        _whatsapp_send(to, body)


@register_handler("abandoned_cart")
def _handle_abandoned_cart(auto: AIAutomation, payload: dict, event_name: str) -> None:
    wa_id = payload.get("wa_id")
    if not wa_id:
        logger.info("abandoned_cart handler: no wa_id — skipped")
        return

    template = (auto.action_config or {}).get("template")
    name = payload.get("profile_name") or "there"
    cart_url = payload.get("cart_url") or "/cart"

    body = template or (
        f"Hi {name}, you left something in your cart. "
        f"Tap to finish up: {cart_url}"
    )
    body = body.replace("{name}", name).replace("{cart_url}", cart_url)
    _whatsapp_send(wa_id, body)


@register_handler("pending_order")
def _handle_pending_order(auto: AIAutomation, payload: dict, event_name: str) -> None:
    wa_id = payload.get("wa_id")
    reference = payload.get("reference", "")
    if not wa_id:
        return

    template = (auto.action_config or {}).get("template")
    body = template or f"Reminder: your order {reference} is still awaiting payment. Reply here for help."
    body = body.replace("{reference}", reference)
    _whatsapp_send(wa_id, body)


@register_handler("failed_payment")
def _handle_failed_payment(auto: AIAutomation, payload: dict, event_name: str) -> None:
    wa_id = payload.get("wa_id")
    reference = payload.get("reference", "")
    if wa_id:
        _whatsapp_send(
            wa_id,
            f"Your payment for order {reference} didn't go through. Please try again.",
        )

    admin_to = (auto.action_config or {}).get("to_wa_id")
    if admin_to:
        _whatsapp_send(admin_to, f"Payment failed for order {reference}.")


@register_handler("return_refund")
def _handle_return_refund(auto: AIAutomation, payload: dict, event_name: str) -> None:
    wa_id = payload.get("wa_id")
    status = payload.get("status", "updated")
    reference = payload.get("reference", "")
    if not wa_id:
        return
    _whatsapp_send(wa_id, f"Your return {reference} is now {status}.")


@register_handler("sales_summary")
def _handle_sales_summary(auto: AIAutomation, payload: dict, event_name: str) -> None:
    to = (auto.action_config or {}).get("to_wa_id")
    if not to:
        logger.info("sales_summary handler: no `to_wa_id` configured")
        return
    revenue = payload.get("revenue", 0)
    orders = payload.get("orders", 0)
    body = f"Sales summary: KES {revenue:,.0f} across {orders} orders."
    _whatsapp_send(to, body)


@register_handler("newsletter_perf")
def _handle_newsletter_perf(auto: AIAutomation, payload: dict, event_name: str) -> None:
    to = (auto.action_config or {}).get("to_wa_id")
    if not to:
        return
    opened = payload.get("open_rate", 0)
    clicked = payload.get("click_rate", 0)
    _whatsapp_send(to, f"Newsletter report — open {opened}%, click {clicked}%.")


@register_handler("unusual_change")
def _handle_unusual_change(auto: AIAutomation, payload: dict, event_name: str) -> None:
    to = (auto.action_config or {}).get("to_wa_id")
    if not to:
        return
    metric = payload.get("metric", "metric")
    value = payload.get("value", "?")
    _whatsapp_send(to, f"Unusual {metric} detected: {value}.")


@register_handler("custom")
def _handle_custom(auto: AIAutomation, payload: dict, event_name: str) -> None:
    action = (auto.action or "").strip().lower()
    if "whatsapp" in action:
        _send_whatsapp(auto, payload)
    elif "email" in action:
        _send_email(auto, payload)
    elif "notify" in action or "alert" in action:
        _notify_admin(auto, payload)
    elif "tag" in action:
        _tag_contact(auto, payload)
    else:
        logger.info("custom automation %s: no handler for %r", auto.pk, auto.action)


@register_handler("review_alert")
def _handle_review_alert(auto: AIAutomation, payload: dict, event_name: str) -> None:
    to = (auto.action_config or {}).get("to_wa_id")
    if not to:
        return
    rating = payload.get("rating", "?")
    product = payload.get("product_name", "a product")
    _whatsapp_send(to, f"New {rating}★ review on {product}. Review needed.")


@register_handler("churn_win_back")
def _handle_churn_win_back(auto: AIAutomation, payload: dict, event_name: str) -> None:
    wa_id = payload.get("wa_id")
    if not wa_id:
        return
    template = (auto.action_config or {}).get("template")
    name = payload.get("profile_name") or "there"
    body = template or (
        f"Hi {name}, we miss you! Here's 10% off your next order — "
        f"use code WELCOME10 at checkout."
    )
    body = body.replace("{name}", name)
    _whatsapp_send(wa_id, body)


def _send_whatsapp(auto: AIAutomation, payload: dict) -> None:
    wa_id = payload.get("wa_id")
    if not wa_id:
        logger.info("Automation %s: no wa_id in payload — skipped", auto.pk)
        return

    template = (auto.action_config or {}).get("template")
    name = payload.get("profile_name") or "there"
    body = template or (
        f"Hi {name}, thanks for reaching out! "
        f"Reply here and we'll help right away."
    )
    body = body.replace("{name}", name)
    _whatsapp_send(wa_id, body)


def _send_email(auto: AIAutomation, payload: dict) -> None:
    to = (auto.action_config or {}).get("to_email") or payload.get("email")
    if not to:
        logger.info("Automation %s: no email destination — skipped", auto.pk)
        return
    logger.info("Email would be sent to %s for automation %s", to, auto.pk)


def _notify_admin(auto: AIAutomation, payload: dict) -> None:
    logger.info("Admin notify for automation %s: %s", auto.pk, payload)


def _tag_contact(auto: AIAutomation, payload: dict) -> None:
    contact_id = payload.get("contact_id")
    if not contact_id:
        return
    tag = (auto.action_config or {}).get("tag", "auto")
    logger.info("Tag contact %s with %s via automation %s", contact_id, tag, auto.pk)


def _send_summary(auto: AIAutomation, payload: dict) -> None:
    if (auto.action_config or {}).get("to_wa_id"):
        _handle_sales_summary(auto, payload, "sales.summary")
    else:
        logger.info("Summary automation %s: no destination configured", auto.pk)


def _event_for_kind(kind: str) -> str:
    return {
        "low_stock": "stock.low",
        "abandoned_cart": "cart.abandoned",
        "pending_order": "order.unpaid",
        "failed_payment": "payment.failed",
        "return_refund": "return.requested",
        "sales_summary": "sales.daily_summary",
        "newsletter_perf": "newsletter.sent",
        "unusual_change": "sales.spike",
    }.get(kind, "order.placed")


def run_automation(
    automation,
    *,
    dry_run: bool = False,
    params: dict | None = None,
) -> dict:
    started = time.monotonic()
    params = params or {}

    if dry_run:
        return {
            "summary": f"Dry run for {automation.name}",
            "items_affected": 0,
            "output": {"dry_run": True, "kind": automation.kind},
        }

    try:
        event_name = _event_for_kind(automation.kind)
        payload = {**params, "automation_id": automation.pk}

        result = dispatch_detailed(event_name, payload)
        duration_ms = int((time.monotonic() - started) * 1000)

        return {
            "summary": (
                f"{result['succeeded']} succeeded, "
                f"{result['failed']} failed, "
                f"{result['skipped']} skipped"
            ),
            "items_affected": result["fired"],
            "output": {
                "run_ids": result["run_ids"],
                "duration_ms": duration_ms,
                "event": event_name,
            },
        }
    except Exception as exc:
        logger.exception("run_automation failed for %s", automation.pk)
        return {
            "summary": "Run failed",
            "items_affected": 0,
            "error": str(exc),
            "output": {"error": str(exc)},
        }