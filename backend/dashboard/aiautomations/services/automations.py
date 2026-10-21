from __future__ import annotations

import logging
from typing import Any, Callable

from django.db import transaction
from django.utils import timezone

from ..models import AIAuditLog, AIAutomation, AIAutomationRun

logger = logging.getLogger("aiautomations.dispatch")


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
    except Exception:  # noqa: BLE001
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
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Automation %s failed for event %s", auto.pk, event_name,
                )
                _record_finish(run, auto, success=False, error=str(exc))
                failed += 1
            else:
                _record_finish(run, auto, success=True)
                succeeded += 1

            run_ids.append(run.pk)

        except Exception:  # noqa: BLE001
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
    _audit(
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
    except Exception:  # noqa: BLE001
        logger.exception("Failed to record skip for automation %s", auto.pk)


def _audit(*, action: str, tool: str, args: dict) -> None:
    try:
        AIAuditLog.objects.create(
            action=action,
            tool=tool,
            args=args,
            result_size=0,
        )
    except Exception:  # noqa: BLE001
        pass


def _whatsapp_send(wa_id: str, body: str) -> bool:
    if not wa_id or not body:
        return False

    try:
        from dashboard.whatsapp import services as wa_services  # type: ignore
    except Exception:  # noqa: BLE001
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
                except Exception:  # noqa: BLE001
                    logger.exception("WhatsApp send failed via %s", fn_name)
                    return False
            except Exception:  # noqa: BLE001
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