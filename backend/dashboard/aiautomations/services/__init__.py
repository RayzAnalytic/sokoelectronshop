# ai/services/__init__.py

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Generator

from django.utils import timezone

from ..models import (
    AIAuditLog,
    AIConversation,
    AIMessage,
    AISettings,
    AIToolCall,
    AIUsageLog,
)
from ..tools import TOOL_SCHEMAS, execute_tool

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

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

# Rough provider rates (KES per 1M tokens). Adjust as needed.
# These are used to estimate cost for the admin Usage dashboard.
RATE_INPUT_KES_PER_M = 18.0
RATE_OUTPUT_KES_PER_M = 40.0

# Fallback estimate for streamed completions, where most providers do
# not report usage. English text averages ~4 characters per token.
CHARS_PER_TOKEN = 4

DEFAULT_MAX_TOKENS = 1024
DEFAULT_TEMPERATURE = 0.3


class GroqUnavailable(RuntimeError):
    """
    Raised when the AI provider cannot be reached or is misconfigured.

    The name is historical — this exception is now raised for every
    provider (Groq, OpenRouter, Gemini, xAI). Kept so existing callers
    that catch `GroqUnavailable` continue to work.
    """


# ═══════════════════════════════════════════════════════════════════════════
# PROVIDER CLIENT
#
# Every provider we support exposes an OpenAI-compatible
# `/chat/completions` endpoint, so we use the `openai` SDK for all of
# them. The only per-provider differences are:
#
#   • the API key env var  (resolved by `AISettings.resolved_api_key()`)
#   • the base URL         (resolved by `AISettings.resolved_base_url()`)
#   • the model string     (stored on the AISettings row)
#
# OpenRouter additionally wants attribution headers on each request;
# the other providers ignore them.
# ═══════════════════════════════════════════════════════════════════════════

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

    # OpenRouter wants attribution headers. They're ignored by the
    # other providers, so we only send them where they matter. Both
    # are optional — the request works without them.
    default_headers: dict[str, str] | None = None
    if provider == "openrouter":
        from django.conf import settings

        referer = getattr(settings, "OPENROUTER_HTTP_REFERER", "") or ""
        title = getattr(settings, "OPENROUTER_X_TITLE", "") or "Myshop Admin"
        default_headers = {"X-Title": title}
        if referer:
            default_headers["HTTP-Referer"] = referer

    return (
        OpenAI(
            api_key=api_key,
            base_url=base_url or "https://api.groq.com/openai/v1",
            default_headers=default_headers,
        ),
        cfg,
    )


# ═══════════════════════════════════════════════════════════════════════════
# SETTINGS-AWARE HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _effective_system_prompt(cfg: AISettings, context: dict | None) -> str:
    """Merge the base prompt, the admin's custom system prompt, and page context."""
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
    """
    Filter tool schemas by `AISettings.allowed_modules` if it's non-empty.
    Each tool schema is assumed to carry a `x-module` hint; if absent,
    the tool is always allowed.
    """
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


# ═══════════════════════════════════════════════════════════════════════════
# PII MASKING (belt-and-braces on top of tool-level masking)
# ═══════════════════════════════════════════════════════════════════════════

def _mask_payload(payload: Any, cfg: AISettings, extra_fields: set[str] | None = None) -> Any:
    """
    Recursively mask any field name in `cfg.mask_fields` or the built-in
    defaults. Only applies when `cfg.masking` is on.
    """
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


# ═══════════════════════════════════════════════════════════════════════════
# LOGGING HELPERS
# ═══════════════════════════════════════════════════════════════════════════

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
    except Exception:  # noqa: BLE001
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
    except Exception:  # noqa: BLE001
        logger.exception("Failed to write AI audit log")


def _update_conversation_rollup(conversation: AIConversation, msg: AIMessage) -> None:
    """Increment rollup counters on the parent conversation."""
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
    except Exception:  # noqa: BLE001
        logger.exception("Failed to update conversation rollup")


# ═══════════════════════════════════════════════════════════════════════════
# HISTORY
# ═══════════════════════════════════════════════════════════════════════════

def _history(conversation: AIConversation, limit: int = 20) -> list[dict]:
    qs = conversation.messages.exclude(role="tool").order_by("-created_at")[:limit]
    msgs = list(reversed(qs))
    return [{"role": m.role, "content": m.content} for m in msgs if m.content]


# ═══════════════════════════════════════════════════════════════════════════
# ASSISTANT — STREAMING
# ═══════════════════════════════════════════════════════════════════════════

def stream_assistant_reply(
    conversation: AIConversation,
    user_message: AIMessage,
    *,
    context: dict | None = None,
    user=None,
) -> Generator[dict, None, None]:
    """
    Yields SSE-ready dicts:
      {"type": "token",  "text": "..."}
      {"type": "meta",   "chart": ..., "table": ..., "link": ..., "quickReplies": ...}
      {"type": "done",   "messageId": ..., "timestamp": "..."}
      {"type": "error",  "message": "..."}
    """
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

    # Create the assistant message up front so tool traces can link to it,
    # and so the frontend can recover the message id on a mid-stream error.
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

    # ── Pass 1: decide whether tools are needed.
    #
    # We only send tool-related fields when we actually have tools to
    # offer. Sending `tool_choice: None` (Python None → JSON `null`)
    # makes Groq return:
    #   400 Only allowed string values for 'tool_choice' are
    #       [none, auto, required]
    # because the OpenAI SDK serialises `None` as JSON null, and Groq's
    # validator is strict. Omitting the keys entirely is the safest
    # cross-provider behaviour.
    pass1_kwargs: dict[str, Any] = {
        "model": cfg.model,
        "messages": messages,
        "max_tokens": _max_tokens(cfg),
        "temperature": _temperature(cfg),
    }
    if tools:
        pass1_kwargs["tools"] = tools
        pass1_kwargs["tool_choice"] = "auto"

    try:
        first = client.chat.completions.create(**pass1_kwargs)
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "AI provider call 1 failed (%s/%s)", cfg.provider, cfg.model,
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
            "content": choice.content or "",
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

            # Mask tool payload before we send it back to the model.
            masked = _mask_payload(result, cfg)

            # Record the tool call trace.
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
            except Exception:  # noqa: BLE001
                logger.exception("Failed to write tool call row")

            # Track provenance + missing data for the message.
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

            # Merge UI hints from the tool result.
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

    # ── Pass 2: stream the actual answer.
    #
    # When tools were called in pass 1, we deliberately do NOT pass the
    # `tools` list here. `tool_choice="none"` is advisory — some models
    # still emit a stray tool_call and the provider rejects the whole
    # stream with "Tool choice is none, but model called a tool".
    # Hiding the tool schemas makes that impossible.
    #
    # When no tools were called, we keep the tools available so the
    # model can still call one mid-answer.
    buffer: list[str] = []
    pass2_kwargs: dict[str, Any] = {
        "model": cfg.model,
        "messages": messages,
        "stream": True,
        "max_tokens": _max_tokens(cfg),
        "temperature": _temperature(cfg, default=0.4),
    }
    if not tools_were_called and tools:
        pass2_kwargs["tools"] = tools
        pass2_kwargs["tool_choice"] = "auto"

    try:
        stream = client.chat.completions.create(**pass2_kwargs)
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                buffer.append(delta)
                yield {"type": "token", "text": delta}
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "AI stream failed (%s/%s)", cfg.provider, cfg.model,
        )

        # ── Fallback: retry pass 2 without streaming.
        #
        # Streaming can fail for reasons other than a stray tool_call —
        # network blips, mid-stream timeouts, provider hiccups. Retry
        # once with `stream=False` so the user still gets the answer.
        try:
            fallback_kwargs = {**pass2_kwargs, "stream": False}
            fallback_kwargs.pop("tools", None)
            fallback_kwargs.pop("tool_choice", None)

            completion = client.chat.completions.create(**fallback_kwargs)
            content_fallback = completion.choices[0].message.content or ""
            if content_fallback:
                buffer.append(content_fallback)
                yield {"type": "token", "text": content_fallback}
        except Exception:  # noqa: BLE001
            logger.exception("Non-streaming fallback also failed")
            _fail_message(
                assistant_msg,
                f"Stream failed: {exc}",
                partial="".join(buffer),
            )
            yield {"type": "error", "message": f"Stream failed: {exc}"}
            return

    content = "".join(buffer).strip()

    # Estimate pass-2 token usage (most providers omit usage for streams).
    if content:
        tokens_out += max(1, len(content) // CHARS_PER_TOKEN)
        try:
            prompt_chars = sum(len(str(m.get("content") or "")) for m in messages)
            tokens_in += max(1, prompt_chars // CHARS_PER_TOKEN)
        except Exception:  # noqa: BLE001
            pass

    latency_ms = int((time.monotonic() - started) * 1000)

    # Finalise the assistant message.
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


def _fail_message(msg: AIMessage, error: str, partial: str = "") -> None:
    """Mark an in-flight assistant message as failed."""
    try:
        msg.status = "error"
        msg.content = partial or msg.content or ""
        msg.error_message = error[:2000]
        msg.save(update_fields=["status", "content", "error_message"])
    except Exception:  # noqa: BLE001
        logger.exception("Failed to mark message as errored")


# ═══════════════════════════════════════════════════════════════════════════
# CONTENT GENERATOR
# ═══════════════════════════════════════════════════════════════════════════

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
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "Content generation failed (%s/%s)", cfg.provider, cfg.model,
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


# ═══════════════════════════════════════════════════════════════════════════
# AUTOMATION — RUN NOW
# ═══════════════════════════════════════════════════════════════════════════

def run_automation(
    automation,
    *,
    dry_run: bool = False,
    params: dict | None = None,
) -> dict:
    """
    Execute one automation synchronously. Used by the Run Now API.

    Returns a dict with at least:
        {"summary": str, "items_affected": int, "output": dict}

    Never raises — failures are returned as {"summary": ..., "error": ...}
    so the caller can record a failed run without a try/except.
    """
    from .automations import dispatch_detailed  # local import avoids cycles

    started = time.monotonic()
    params = params or {}

    if dry_run:
        return {
            "summary": f"Dry run for {automation.name}",
            "items_affected": 0,
            "output": {"dry_run": True, "kind": automation.kind},
        }

    try:
        # Build a synthetic event so the same code path runs as for
        # scheduled/event-driven executions.
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
    except Exception as exc:  # noqa: BLE001
        logger.exception("run_automation failed for %s", automation.pk)
        return {
            "summary": "Run failed",
            "items_affected": 0,
            "error": str(exc),
            "output": {"error": str(exc)},
        }


def _event_for_kind(kind: str) -> str:
    """Reverse-map a kind to a representative event name."""
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


# ═══════════════════════════════════════════════════════════════════════════
# RE-EXPORTS
# ═══════════════════════════════════════════════════════════════════════════
# Convenience so callers can do `from dashboard.aiautomations.services import dispatch`
# without reaching into the submodule.

from .automations import dispatch, dispatch_detailed  # noqa: E402,F401