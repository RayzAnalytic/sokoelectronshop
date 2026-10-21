from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Callable, Iterable

from django.apps import apps
from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone

logger = logging.getLogger(__name__)

_MODEL_CACHE: dict[tuple[str, ...], type | None] = {}


def _find_model(*candidates: str) -> type | None:
    key = tuple(candidates)
    if key in _MODEL_CACHE:
        return _MODEL_CACHE[key]
    for path in candidates:
        app_label, _, model_name = path.rpartition(".")
        if not app_label:
            continue
        try:
            model = apps.get_model(app_label, model_name)
            _MODEL_CACHE[key] = model
            return model
        except LookupError:
            continue
    wanted = {c.rpartition(".")[2].lower() for c in candidates if c}
    for model in apps.get_models():
        if model.__name__.lower() in wanted:
            _MODEL_CACHE[key] = model
            return model
    _MODEL_CACHE[key] = None
    return None


def _order_model():
    return _find_model("checkout.Order", "orders.Order", "sales.Order")


def _order_item_model():
    return _find_model("checkout.OrderItem", "orders.OrderItem", "sales.OrderItem")


def _product_model():
    return _find_model("catalog.Product", "products.Product")


def _category_model():
    return _find_model("catalog.Category", "products.Category")


def _brand_model():
    return _find_model("catalog.Brand", "products.Brand")


def _discount_model():
    return _find_model("catalog.Discount", "marketing.Discount", "discounts.Discount")


def _payment_model():
    return _find_model(
        "checkout.Payment",
        "payments.Payment",
        "checkout.MpesaCallbackLog",
        "checkout.ReconciliationLog",
    )


def _transaction_model():
    return _find_model(
        "checkout.Transaction",
        "payments.Transaction",
        "checkout.MpesaCallbackLog",
    )


def _review_model():
    return _find_model("account.Review", "reviews.Review")


def _supplier_model():
    return _find_model("dashboard_suppliers.Supplier", "suppliers.Supplier")


def _shipment_model():
    return _find_model("shipping.Shipment", "shipping.ShipmentModel")


def _subscriber_model():
    return _find_model("newsletter.Subscriber", "newsletter.SubscriberModel")


def _campaign_model():
    return _find_model("newsletter.Campaign", "marketing.Campaign")


def _customer_model():
    return _find_model("authentication.User", "accounts.User", "users.User")


def _customer_queryset():
    User = _customer_model()
    if User is None:
        return None
    qs = User.objects.all()
    names = _fields(User)
    if "role" in names:
        try:
            qs = qs.filter(role__iexact="CUSTOMER")
        except Exception:  # noqa: BLE001
            pass
    return qs


def _staff_model():
    return _find_model(
        "dashboard_users.StaffProfile",
        "users.StaffProfile",
        "accounts.StaffProfile",
    )


def _return_model():
    return _find_model(
        "checkout.ReturnRequest",
        "checkout.Return",
        "returns.ReturnRequest",
        "returns.Return",
        "orders.ReturnRequest",
    )


def _refund_model():
    return _find_model(
        "checkout.Refund",
        "returns.Refund",
        "payments.Refund",
    )


def _whatsapp_conversation_model():
    return _find_model("whatsapp.WhatsAppConversation", "whatsapp.Conversation")


def _whatsapp_message_model():
    return _find_model("whatsapp.WhatsAppMessage", "whatsapp.Message")


def _whatsapp_contact_model():
    return _find_model("whatsapp.WhatsAppContact", "whatsapp.Contact")


def _whatsapp_broadcast_model():
    return _find_model("whatsapp.WhatsAppBroadcast", "whatsapp.Broadcast")


def _whatsapp_template_model():
    return _find_model("whatsapp.WhatsAppTemplate", "whatsapp.Template")


def _social_post_model():
    return _find_model("social.SocialPost", "socialmedia.SocialPost")


def _social_account_model():
    return _find_model("social.SocialAccount", "socialmedia.SocialAccount")


def _banner_model():
    return _find_model("banners.Banner", "marketing.Banner")


def _tiktok_order_model():
    return _find_model(
        "social.TikTokOrder",
        "tiktok.TikTokOrder",
        "marketing.TikTokOrder",
    )


def _tiktok_video_model():
    return _find_model(
        "social.TikTokVideo",
        "tiktok.TikTokVideo",
        "marketing.TikTokVideo",
    )


def _report_model():
    return _find_model(
        "analytics.Report",
        "reports.Report",
    )


def _notification_model():
    return _find_model("account.Notification", "notifications.Notification")


def _audit_entry_model():
    return _find_model("dashboard.AuditLog", "core.AuditLog", "audit.AuditLog")


def _settings_model():
    return _find_model("core.Setting", "core.StoreSetting", "settings.Setting")


def _fields(model) -> set[str]:
    return {f.name for f in model._meta.get_fields()}


def _first_field(model, names: Iterable[str]) -> str | None:
    have = _fields(model)
    return next((n for n in names if n in have), None)


def _mask(value: str, enabled: bool = True) -> str:
    if not enabled or not value:
        return value or ""
    if "@" in value:
        name, _, domain = value.partition("@")
        return f"{name[:2]}***@{domain}"
    return f"{value[:3]}***{value[-2:]}" if len(value) > 5 else "***"


def _masking_enabled() -> bool:
    try:
        from .models import AISettings
        return AISettings.get_solo().masking
    except Exception:  # noqa: BLE001
        return True


def _safe_float(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _safe_int(v) -> int:
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def _day_label(dt) -> str:
    return dt.strftime("%a") if dt else "?"


def _date_label(dt) -> str:
    return dt.strftime("%Y-%m-%d") if dt else ""


def _empty(note: str, link: dict | None = None) -> dict:
    out: dict[str, Any] = {"items": [], "note": note}
    if link:
        out["link"] = link
    return out


def _audit(tool: str, args: dict | None, result: dict, user=None) -> None:
    try:
        from .models import AIAuditLog
        AIAuditLog.objects.create(
            user=user if getattr(user, "is_authenticated", False) else None,
            action="tool_call",
            tool=tool,
            args=args or {},
            result_size=len(result.get("items") or []),
            is_verified=True,
        )
    except Exception:  # noqa: BLE001
        pass


def tool_diagnose_models() -> dict:
    provider = "unknown"
    model = "unknown"
    base_url = "unknown"
    try:
        from . import services  # noqa: F401
        cfg = services._provider_config(services._active_provider())
        provider = cfg.get("provider", "unknown")
        model = cfg.get("model", "unknown")
        base_url = cfg.get("base_url", "unknown")
    except Exception:  # noqa: BLE001
        pass

    rows: list[dict[str, Any]] = [
        {"app": "AI provider", "models": [f"{provider} · {model}"]},
        {"app": "AI base_url", "models": [base_url]},
    ]

    for app in apps.get_app_configs():
        models = sorted(m.__name__ for m in app.get_models())
        if models:
            rows.append({"app": app.label, "models": models})

    return {
        "items": rows,
        "table": {
            "headers": ["App", "Models"],
            "rows": [[r["app"], ", ".join(r["models"])] for r in rows],
        },
        "summary": f"{len(rows)} apps discoverable.",
    }


def tool_daily_digest() -> dict:
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    Order = _order_model()
    revenue_today = revenue_yesterday = orders_today = 0
    if Order is not None and "created_at" in _fields(Order):
        total_field = _first_field(Order, ("total", "grand_total", "amount"))
        if total_field:
            agg_today = Order.objects.filter(created_at__date=today).aggregate(
                rev=Sum(total_field), cnt=Count("pk")
            )
            agg_yday = Order.objects.filter(created_at__date=yesterday).aggregate(
                rev=Sum(total_field)
            )
            revenue_today = _safe_float(agg_today["rev"])
            revenue_yesterday = _safe_float(agg_yday["rev"])
            orders_today = _safe_int(agg_today["cnt"])

    delta = 0.0
    if revenue_yesterday > 0:
        delta = round(((revenue_today - revenue_yesterday) / revenue_yesterday) * 100, 1)

    rows = [
        {"metric": "Revenue today", "value": f"KES {revenue_today:,.0f}", "delta": delta},
        {"metric": "Orders today", "value": str(orders_today)},
    ]

    return {
        "items": rows,
        "table": {
            "headers": ["Metric", "Value", "Δ vs yesterday"],
            "rows": [[r["metric"], r["value"], f"{r.get('delta', 0):+.1f}%"] for r in rows],
        },
        "link": {"label": "Open Overview", "href": "/admin"},
        "summary": (
            f"Today: KES {revenue_today:,.0f} ({delta:+.1f}% vs yesterday), "
            f"{orders_today} orders."
        ),
    }


def tool_revenue_trend(days: int = 7, chart_type: str = "line", compare: bool = False) -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")

    names = _fields(Order)
    if "created_at" not in names:
        return _empty("Order is missing created_at.")
    total_field = _first_field(Order, ("total", "grand_total", "amount"))
    if total_field is None:
        return _empty("Order is missing total/amount.")

    start = timezone.now() - timedelta(days=days)
    buckets: dict[str, dict[str, float]] = {}
    for o in Order.objects.filter(created_at__gte=start):
        day = _day_label(o.created_at)
        b = buckets.setdefault(day, {"revenue": 0.0, "orders": 0})
        b["revenue"] += _safe_float(getattr(o, total_field, 0))
        b["orders"] += 1

    order_days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    rows = [{"day": d, **buckets[d]} for d in order_days if d in buckets]
    total = sum(r["revenue"] for r in rows)

    ctype = chart_type if chart_type in ("line", "area") else "line"
    series = [{"key": "revenue", "label": "Revenue", "color": "#172554"}]

    if compare:
        prev_start = start - timedelta(days=days)
        prev_buckets: dict[str, float] = {}
        for o in Order.objects.filter(created_at__gte=prev_start, created_at__lt=start):
            day = _day_label(o.created_at)
            prev_buckets[day] = prev_buckets.get(day, 0.0) + _safe_float(getattr(o, total_field, 0))
        for r in rows:
            r["previous"] = round(prev_buckets.get(r["day"], 0.0), 2)
        series.append({"key": "previous", "label": "Previous period", "color": "#94a3b8"})

    return {
        "items": rows,
        "chart": {
            "type": ctype,
            "data": rows,
            "xKey": "day",
            "series": series,
        },
        "link": {"label": "Open Analytics", "href": "/admin/analytics"},
        "summary": f"Revenue over {days} days: KES {total:,.0f}.",
    }


def tool_revenue_by_channel(days: int = 30) -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")
    names = _fields(Order)
    channel_field = _first_field(Order, ("channel", "source", "origin"))
    total_field = _first_field(Order, ("total", "grand_total", "amount"))
    if channel_field is None or total_field is None:
        return _empty("Order lacks channel or total field.")

    cutoff = timezone.now() - timedelta(days=days)
    agg = (
        Order.objects.filter(created_at__gte=cutoff)
        .values(channel_field)
        .annotate(revenue=Sum(total_field), count=Count("pk"))
        .order_by("-revenue")
    )
    rows = [
        {
            "channel": str(r[channel_field] or "unknown"),
            "revenue": _safe_float(r["revenue"]),
            "orders": _safe_int(r["count"]),
        }
        for r in agg
    ]
    return {
        "items": rows,
        "chart": {
            "type": "bar",
            "data": rows,
            "xKey": "channel",
            "series": [{"key": "revenue", "label": "Revenue", "color": "#172554"}],
        },
        "link": {"label": "Open Analytics", "href": "/admin/analytics"},
        "summary": f"Revenue by channel over {days} days.",
    }


def tool_unpaid_orders(hours: int = 24, limit: int = 20) -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")

    names = _fields(Order)
    cutoff = timezone.now() - timedelta(hours=hours)
    qs = Order.objects.all()
    if "created_at" in names:
        qs = qs.filter(created_at__lte=cutoff)
    if "payment_status" in names:
        qs = qs.filter(payment_status__in=["unpaid", "pending", "failed"])
    elif "is_paid" in names:
        qs = qs.filter(is_paid=False)

    total_field = _first_field(Order, ("total", "grand_total", "amount"))
    items = [
        {
            "id": str(o.pk),
            "reference": getattr(o, "reference", getattr(o, "number", str(o.pk))),
            "amount": _safe_float(getattr(o, total_field, 0)) if total_field else 0.0,
        }
        for o in qs[:limit]
    ]
    return {
        "items": items,
        "table": {
            "headers": ["Order", "Amount"],
            "rows": [[i["reference"], f"KES {i['amount']:,.0f}"] for i in items],
        },
        "link": {"label": "Open Orders", "href": "/admin/orders"},
        "summary": f"{len(items)} orders unpaid for over {hours}h.",
    }


def tool_orders_by_status(status: str = "pending", limit: int = 20) -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")

    names = _fields(Order)
    qs = Order.objects.all()
    if "status" in names:
        qs = qs.filter(status__iexact=status)

    total_field = _first_field(Order, ("total", "grand_total", "amount"))
    items = [
        {
            "id": str(o.pk),
            "reference": getattr(o, "reference", getattr(o, "number", str(o.pk))),
            "status": getattr(o, "status", status),
            "total": _safe_float(getattr(o, total_field, 0)) if total_field else 0.0,
        }
        for o in qs[:limit]
    ]
    return {
        "items": items,
        "table": {
            "headers": ["Order", "Status", "Amount"],
            "rows": [[i["reference"], i["status"], f"KES {i['total']:,.0f}"] for i in items],
        },
        "link": {"label": "Open Orders", "href": "/admin/orders"},
        "summary": f"{len(items)} orders with status '{status}'.",
    }


def tool_orders_breakdown(days: int = 30) -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")

    names = _fields(Order)
    qs = Order.objects.all()
    if "created_at" in names:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))

    counts: dict[str, int] = {}
    for o in qs:
        key = str(getattr(o, "status", "unknown") or "unknown").lower()
        counts[key] = counts.get(key, 0) + 1

    rows = [{"status": k.title(), "count": v} for k, v in counts.items()]
    return {
        "items": rows,
        "chart": {
            "type": "doughnut",
            "data": rows,
            "xKey": "status",
            "series": [{"key": "count", "label": "Orders", "color": "#172554"}],
        },
        "link": {"label": "Open Orders", "href": "/admin/orders"},
        "summary": f"{sum(counts.values())} orders in the last {days} days.",
    }


def tool_orders_past_delivery(limit: int = 20) -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")
    names = _fields(Order)
    eta_field = _first_field(Order, ("expected_delivery_at", "expected_delivery", "eta"))
    if eta_field is None:
        return _empty("Order has no expected_delivery field.")
    qs = Order.objects.filter(**{f"{eta_field}__lt": timezone.now()})
    status_field = _first_field(Order, ("status", "fulfillment_status"))
    if status_field:
        qs = qs.exclude(**{f"{status_field}__iexact": "delivered"})

    items = [
        {
            "id": str(o.pk),
            "reference": getattr(o, "reference", str(o.pk)),
            "status": getattr(o, "status", ""),
            "eta": getattr(o, eta_field, None).isoformat() if getattr(o, eta_field, None) else "",
        }
        for o in qs[:limit]
    ]
    return {
        "items": items,
        "table": {
            "headers": ["Order", "Status", "Expected"],
            "rows": [[i["reference"], i["status"], i["eta"][:16]] for i in items],
        },
        "link": {"label": "Open Orders", "href": "/admin/orders"},
        "summary": f"{len(items)} orders past their expected delivery date.",
    }


def tool_order_detail(order_id: str) -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")
    try:
        order = Order.objects.get(pk=order_id)
    except Order.DoesNotExist:
        return _empty(f"Order {order_id} not found.")
    except Exception as exc:  # noqa: BLE001
        return _empty(f"Could not load order: {exc}")

    names = _fields(Order)
    rows = []
    for field in (
        "reference", "number", "status", "payment_status", "total",
        "subtotal", "shipping_cost", "created_at", "customer_email",
        "channel", "fulfillment_status",
    ):
        if field in names:
            value = getattr(order, field, None)
            if field == "customer_email" and value:
                value = _mask(str(value), _masking_enabled())
            rows.append({"field": field, "value": str(value)})

    return {
        "items": rows,
        "table": {
            "headers": ["Field", "Value"],
            "rows": [[r["field"], r["value"]] for r in rows],
        },
        "link": {"label": "Open Order", "href": f"/admin/orders/{order_id}"},
        "summary": f"Order {getattr(order, 'reference', order_id)} loaded.",
    }


def tool_transaction_reconciliation(days: int = 7) -> dict:
    Txn = _transaction_model()
    if Txn is None:
        return _empty("Transaction model not discoverable.")
    names = _fields(Txn)
    qs = Txn.objects.all()
    if "created_at" in names:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))

    status_field = _first_field(Txn, ("status", "state", "result_code"))
    amount_field = _first_field(Txn, ("amount", "total", "value"))
    counts: dict[str, int] = {}
    totals: dict[str, float] = {}
    for t in qs:
        key = str(getattr(t, status_field, "unknown") or "unknown").lower() if status_field else "unknown"
        counts[key] = counts.get(key, 0) + 1
        totals[key] = totals.get(key, 0.0) + (_safe_float(getattr(t, amount_field, 0)) if amount_field else 0.0)

    rows = [
        {"status": k.title(), "count": counts[k], "amount": round(totals.get(k, 0.0), 2)}
        for k in counts
    ]
    return {
        "items": rows,
        "table": {
            "headers": ["Status", "Count", "Amount"],
            "rows": [[r["status"], str(r["count"]), f"KES {r['amount']:,.0f}"] for r in rows],
        },
        "link": {"label": "Open Transactions", "href": "/admin/transactions"},
        "summary": f"{sum(counts.values())} transactions in {days} days.",
    }


def tool_low_stock_products(limit: int = 20, threshold_override: int | None = None) -> dict:
    Product = _product_model()
    if Product is None:
        return _empty("Product model not discoverable.")

    stock_field = _first_field(Product, ("stock", "stock_quantity", "quantity"))
    if not stock_field:
        return _empty("Product has no stock field.")

    threshold_field = _first_field(Product, ("low_stock_threshold", "reorder_point"))
    price_field = _first_field(Product, ("price", "unit_price", "cost"))

    items: list[dict[str, Any]] = []
    for p in Product.objects.all()[:1000]:
        stock = _safe_int(getattr(p, stock_field, 0))
        threshold = threshold_override or (
            _safe_int(getattr(p, threshold_field, 5)) if threshold_field else 5
        )
        if stock <= threshold:
            items.append({
                "id": str(p.pk),
                "name": getattr(p, "name", str(p)),
                "stock": stock,
                "threshold": threshold,
                "status": "Out of stock" if stock == 0 else "Low",
                "price": _safe_float(getattr(p, price_field, 0)) if price_field else 0.0,
            })
    items.sort(key=lambda x: (x["stock"], x["name"]))
    items = items[:limit]

    return {
        "items": items,
        "chart": {
            "type": "bar",
            "data": [{"name": i["name"][:20], "stock": i["stock"], "threshold": i["threshold"]} for i in items],
            "xKey": "name",
            "series": [
                {"key": "stock", "label": "Stock", "color": "#172554"},
                {"key": "threshold", "label": "Threshold", "color": "#f59e0b"},
            ],
        },
        "table": {
            "headers": ["Product", "Stock", "Threshold", "Status"],
            "rows": [[i["name"], str(i["stock"]), str(i["threshold"]), i["status"]] for i in items],
        },
        "link": {"label": "Open Inventory", "href": "/admin/inventory"},
        "summary": f"{len(items)} products below threshold.",
    }


def tool_best_selling_products(days: int = 30, limit: int = 10) -> dict:
    OrderItem = _order_item_model()
    if OrderItem is None:
        return _empty("OrderItem model not discoverable.")

    names = _fields(OrderItem)
    qty_field = _first_field(OrderItem, ("quantity", "qty", "count"))
    product_field = _first_field(OrderItem, ("product", "product_id"))
    if not qty_field or not product_field:
        return _empty("OrderItem is missing quantity/product.")

    cutoff = timezone.now() - timedelta(days=days)
    qs = OrderItem.objects.all()
    if "created_at" in names:
        qs = qs.filter(created_at__gte=cutoff)

    totals: dict[str, dict[str, Any]] = {}
    for it in qs:
        pid = str(getattr(it, product_field, ""))
        if not pid:
            continue
        product = getattr(it, "product", None)
        name = getattr(product, "name", pid) if product else pid
        entry = totals.setdefault(pid, {"name": name, "sold": 0})
        entry["sold"] += _safe_int(getattr(it, qty_field, 0))

    rows = sorted(totals.values(), key=lambda x: x["sold"], reverse=True)[:limit]
    return {
        "items": rows,
        "chart": {
            "type": "bar",
            "data": [{"name": r["name"][:20], "sold": r["sold"]} for r in rows],
            "xKey": "name",
            "series": [{"key": "sold", "label": "Units sold", "color": "#10b981"}],
        },
        "link": {"label": "Open Products", "href": "/admin/products"},
        "summary": f"Top {len(rows)} products over {days} days.",
    }


def tool_slow_moving_products(days: int = 30, limit: int = 15) -> dict:
    Product = _product_model()
    OrderItem = _order_item_model()
    if Product is None or OrderItem is None:
        return _empty("Product or OrderItem not discoverable.")

    qty_field = _first_field(OrderItem, ("quantity", "qty", "count"))
    product_field = _first_field(OrderItem, ("product", "product_id"))
    if not qty_field or not product_field:
        return _empty("OrderItem missing quantity/product.")

    cutoff = timezone.now() - timedelta(days=days)
    qs = OrderItem.objects.filter(created_at__gte=cutoff) if "created_at" in _fields(OrderItem) else OrderItem.objects.all()
    sold: dict[str, int] = {}
    for it in qs:
        pid = str(getattr(it, product_field, ""))
        sold[pid] = sold.get(pid, 0) + _safe_int(getattr(it, qty_field, 0))

    rows: list[dict[str, Any]] = []
    for p in Product.objects.all()[:1000]:
        pid = str(p.pk)
        qty = sold.get(pid, 0)
        if qty <= 1:
            rows.append({"id": pid, "name": getattr(p, "name", pid), "sold": qty})

    rows.sort(key=lambda x: x["sold"])
    rows = rows[:limit]
    return {
        "items": rows,
        "table": {
            "headers": ["Product", "Units sold"],
            "rows": [[r["name"], str(r["sold"])] for r in rows],
        },
        "link": {"label": "Open Products", "href": "/admin/products"},
        "summary": f"{len(rows)} slow movers in the last {days} days.",
    }


def tool_inventory_value() -> dict:
    Product = _product_model()
    if Product is None:
        return _empty("Product model not discoverable.")

    stock_field = _first_field(Product, ("stock", "stock_quantity", "quantity"))
    if not stock_field:
        return _empty("Product has no stock field.")

    price_field = _first_field(Product, ("price", "cost", "unit_price"))
    total_units = 0
    total_value = 0.0
    out_of_stock = 0
    for p in Product.objects.all()[:5000]:
        qty = _safe_int(getattr(p, stock_field, 0))
        total_units += qty
        if qty == 0:
            out_of_stock += 1
        if price_field:
            total_value += qty * _safe_float(getattr(p, price_field, 0))

    return {
        "items": [{"units": total_units, "value": total_value, "out_of_stock": out_of_stock}],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [
                ["Total units", f"{total_units:,}"],
                ["Inventory value", f"KES {total_value:,.0f}"],
                ["Out of stock", str(out_of_stock)],
            ],
        },
        "link": {"label": "Open Inventory", "href": "/admin/inventory"},
        "summary": f"{total_units:,} units on hand worth KES {total_value:,.0f}.",
    }


def tool_products_by_category() -> dict:
    Product = _product_model()
    Category = _category_model()
    if Product is None or Category is None:
        return _empty("Product or Category model not discoverable.")

    cat_field = _first_field(Product, ("category", "category_id"))
    if not cat_field:
        return _empty("Product has no category field.")

    counts = (
        Product.objects.values(cat_field)
        .annotate(count=Count("pk"))
        .order_by("-count")
    )
    cat_ids = [r[cat_field] for r in counts if r[cat_field] is not None]
    names_map = {str(c.pk): getattr(c, "name", str(c.pk)) for c in Category.objects.filter(pk__in=cat_ids)}

    rows = []
    for r in counts:
        cid = r[cat_field]
        label = names_map.get(str(cid), str(cid) if cid else "Uncategorised")
        rows.append({"category": label, "products": _safe_int(r["count"])})

    return {
        "items": rows,
        "chart": {
            "type": "bar",
            "data": rows[:12],
            "xKey": "category",
            "series": [{"key": "products", "label": "Products", "color": "#8b5cf6"}],
        },
        "link": {"label": "Open Categories", "href": "/admin/categories"},
        "summary": f"{len(rows)} categories with products.",
    }


def tool_brands_summary() -> dict:
    Brand = _brand_model()
    Product = _product_model()
    if Brand is None:
        return _empty("Brand model not discoverable.")

    rows = []
    for b in Brand.objects.all()[:50]:
        count = 0
        if Product is not None and "brand" in _fields(Product):
            try:
                count = Product.objects.filter(brand=b).count()
            except Exception:  # noqa: BLE001
                count = 0
        rows.append({"id": str(b.pk), "name": getattr(b, "name", str(b)), "products": count})
    rows.sort(key=lambda x: x["products"], reverse=True)

    return {
        "items": rows,
        "chart": {
            "type": "bar",
            "data": rows[:12],
            "xKey": "name",
            "series": [{"key": "products", "label": "Products", "color": "#0891b2"}],
        },
        "link": {"label": "Open Brands", "href": "/admin/brands"},
        "summary": f"{len(rows)} brands with product counts.",
    }


def tool_discounts_summary(days: int = 30) -> dict:
    Discount = _discount_model()
    if Discount is None:
        return _empty("Discount model not discoverable.")
    names = _fields(Discount)
    qs = Discount.objects.all()
    if "is_active" in names:
        qs_active = qs.filter(is_active=True).count()
    elif "status" in names:
        qs_active = qs.filter(status__iexact="active").count()
    else:
        qs_active = qs.count()

    used_field = _first_field(Discount, ("used_count", "times_used", "usage_count"))
    top = []
    if used_field:
        top = [
            {
                "id": str(d.pk),
                "code": getattr(d, "code", str(d.pk)),
                "used": _safe_int(getattr(d, used_field, 0)),
            }
            for d in qs.order_by(f"-{used_field}")[:10]
        ]

    return {
        "items": top or [{"active": qs_active, "total": qs.count()}],
        "table": {
            "headers": ["Code", "Uses"],
            "rows": [[t["code"], str(t["used"])] for t in top],
        } if top else {
            "headers": ["Metric", "Value"],
            "rows": [["Active discounts", str(qs_active)], ["Total", str(qs.count())]],
        },
        "link": {"label": "Open Discounts", "href": "/admin/discounts"},
        "summary": f"{qs.count()} discounts ({qs_active} active).",
    }


def tool_top_customers(limit: int = 10) -> dict:
    qs = _customer_queryset()
    if qs is None:
        return _empty("Customer model not discoverable.")

    User = _customer_model()
    names = _fields(User)
    order_field = _first_field(User, ("total_spent", "lifetime_value", "total_spend"))
    if order_field:
        qs = qs.order_by(f"-{order_field}")

    mask = _masking_enabled()
    items = []
    for c in qs[:limit]:
        raw_name = (
            getattr(c, "full_name", None)
            or getattr(c, "name", None)
            or getattr(c, "email", str(c))
        )
        items.append({
            "id": str(c.pk),
            "name": _mask(str(raw_name), mask) if mask else str(raw_name),
            "orders": getattr(c, "order_count", 0),
            "lifetime_value": _safe_float(getattr(c, order_field, 0) if order_field else 0),
        })

    return {
        "items": items,
        "table": {
            "headers": ["Customer", "Orders", "Lifetime Value"],
            "rows": [[i["name"], str(i["orders"]), f"KES {i['lifetime_value']:,.0f}"] for i in items],
        },
        "link": {"label": "Open Customers", "href": "/admin/customers"},
        "summary": f"Top {len(items)} customers by spend.",
    }


def tool_customer_count(active_days: int = 30) -> dict:
    qs = _customer_queryset()
    if qs is None:
        return _empty("Customer model not discoverable.")

    User = _customer_model()
    names = _fields(User)
    total = qs.count()
    active = 0
    for field in ("last_order_at", "last_login", "updated_at"):
        if field in names:
            active = qs.filter(
                **{f"{field}__gte": timezone.now() - timedelta(days=active_days)}
            ).count()
            break

    return {
        "items": [{"total": total, "active": active}],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [
                ["Total customers", str(total)],
                [f"Active ({active_days}d)", str(active)],
            ],
        },
        "link": {"label": "Open Customers", "href": "/admin/customers"},
        "summary": f"{total} total customers, {active} active in {active_days} days.",
    }


def tool_churn_risk(limit: int = 15) -> dict:
    qs = _customer_queryset()
    if qs is None:
        return _empty("Customer model not discoverable.")
    User = _customer_model()
    names = _fields(User)
    last_field = _first_field(User, ("last_order_at", "last_login", "updated_at"))
    if last_field is None:
        return _empty("No activity field on User model.")

    cutoff = timezone.now() - timedelta(days=90)
    qs = qs.filter(**{f"{last_field}__lt": cutoff}).order_by(f"{last_field}")
    mask = _masking_enabled()
    items = []
    for c in qs[:limit]:
        raw_name = (
            getattr(c, "full_name", None)
            or getattr(c, "name", None)
            or getattr(c, "email", str(c))
        )
        last = getattr(c, last_field, None)
        items.append({
            "id": str(c.pk),
            "name": _mask(str(raw_name), mask) if mask else str(raw_name),
            "last_active": last.isoformat() if last else "",
        })
    return {
        "items": items,
        "table": {
            "headers": ["Customer", "Last activity"],
            "rows": [[i["name"], i["last_active"][:10]] for i in items],
        },
        "link": {"label": "Open Customers", "href": "/admin/customers"},
        "summary": f"{len(items)} customers at churn risk.",
    }


def tool_failed_payments(hours: int = 24) -> dict:
    Payment = _payment_model()
    if Payment is None:
        return _empty("Payment model not discoverable.")

    names = _fields(Payment)
    qs = Payment.objects.all()
    if "status" in names:
        qs = qs.filter(status__in=["failed", "declined", "timeout"])
    if "created_at" in names:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(hours=hours))

    items = [
        {
            "id": str(p.pk),
            "reference": getattr(p, "reference", str(p.pk)),
            "amount": _safe_float(getattr(p, "amount", 0)),
            "status": getattr(p, "status", "failed"),
        }
        for p in qs[:20]
    ]
    return {
        "items": items,
        "table": {
            "headers": ["Reference", "Amount", "Status"],
            "rows": [[i["reference"], f"KES {i['amount']:,.0f}", i["status"]] for i in items],
        },
        "link": {"label": "Review Payments", "href": "/admin/payments"},
        "summary": f"{len(items)} failed payments in the last {hours}h.",
    }


def tool_payment_failure_rate(days: int = 7) -> dict:
    Payment = _payment_model()
    if Payment is None:
        return _empty("Payment model not discoverable.")
    names = _fields(Payment)
    if "status" not in names:
        return _empty("Payment has no status field.")
    cutoff = timezone.now() - timedelta(days=days)
    qs = Payment.objects.filter(created_at__gte=cutoff) if "created_at" in names else Payment.objects.all()
    total = qs.count()
    failed = qs.filter(status__in=["failed", "declined", "timeout"]).count()
    rate = round((failed / total * 100), 2) if total else 0.0
    return {
        "items": [{"total": total, "failed": failed, "rate": rate}],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [
                ["Total payments", str(total)],
                ["Failed", str(failed)],
                ["Failure rate", f"{rate}%"],
            ],
        },
        "link": {"label": "Open Payments", "href": "/admin/payments"},
        "summary": f"{rate}% failure rate over {days} days.",
    }


def tool_pending_returns(limit: int = 20) -> dict:
    Return = _return_model()
    if Return is None:
        return _empty("No return/refund model exists on this instance yet.")
    names = _fields(Return)
    qs = Return.objects.all()
    if "status" in names:
        qs = qs.filter(status__in=["pending", "requested", "awaiting"])
    items = [
        {
            "id": str(r.pk),
            "reference": getattr(r, "reference", str(r.pk)),
            "status": getattr(r, "status", "pending"),
        }
        for r in qs[:limit]
    ]
    return {
        "items": items,
        "table": {
            "headers": ["Return", "Status"],
            "rows": [[i["reference"], i["status"]] for i in items],
        },
        "link": {"label": "Review Returns", "href": "/admin/returnsrefunds"},
        "summary": f"{len(items)} returns pending approval.",
    }


def tool_refund_reasons(days: int = 30) -> dict:
    Return = _return_model()
    if Return is None:
        return _empty("No return model exists on this instance yet.")
    names = _fields(Return)
    reason_field = _first_field(Return, ("reason", "return_reason", "reason_code"))
    if reason_field is None:
        return _empty("Return model has no reason field.")
    qs = Return.objects.all()
    if "created_at" in names:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))
    counts = (
        qs.values(reason_field)
        .annotate(count=Count("pk"))
        .order_by("-count")
    )
    rows = [{"reason": str(r[reason_field] or "unknown"), "count": _safe_int(r["count"])} for r in counts]
    return {
        "items": rows,
        "chart": {
            "type": "bar",
            "data": rows[:10],
            "xKey": "reason",
            "series": [{"key": "count", "label": "Returns", "color": "#ef4444"}],
        },
        "link": {"label": "Open Returns", "href": "/admin/returnsrefunds"},
        "summary": f"Top refund reasons over {days} days.",
    }


def tool_supplier_breakdown(limit: int = 15) -> dict:
    Supplier = _supplier_model()
    Product = _product_model()
    if Supplier is None:
        return _empty("Supplier model not discoverable.")

    rows = []
    for s in Supplier.objects.all()[:limit]:
        count = 0
        if Product is not None and "supplier" in _fields(Product):
            try:
                count = Product.objects.filter(supplier=s).count()
            except Exception:  # noqa: BLE001
                count = 0
        rows.append({"id": str(s.pk), "name": getattr(s, "name", str(s)), "products": count})

    rows.sort(key=lambda x: x["products"], reverse=True)
    return {
        "items": rows,
        "chart": {
            "type": "bar",
            "data": [{"name": r["name"][:20], "products": r["products"]} for r in rows],
            "xKey": "name",
            "series": [{"key": "products", "label": "Products", "color": "#0891b2"}],
        },
        "link": {"label": "Open Suppliers", "href": "/admin/suppliers"},
        "summary": f"{len(rows)} suppliers ranked by product count.",
    }


def tool_shipping_delays(limit: int = 20) -> dict:
    Shipment = _shipment_model()
    if Shipment is None:
        return _empty("Shipment model not discoverable.")
    names = _fields(Shipment)
    qs = Shipment.objects.all()
    for field in ("expected_delivery_at", "expected_delivery", "eta"):
        if field in names:
            qs = qs.filter(**{f"{field}__lt": timezone.now()})
            break
    items = [
        {
            "id": str(s.pk),
            "reference": getattr(s, "reference", getattr(s, "tracking_number", str(s.pk))),
            "status": getattr(s, "status", ""),
        }
        for s in qs[:limit]
    ]
    return {
        "items": items,
        "table": {
            "headers": ["Shipment", "Status"],
            "rows": [[i["reference"], i["status"]] for i in items],
        },
        "link": {"label": "Open Shipping", "href": "/admin/shipping"},
        "summary": f"{len(items)} shipments past expected delivery.",
    }


def tool_carrier_performance(days: int = 30) -> dict:
    Shipment = _shipment_model()
    if Shipment is None:
        return _empty("Shipment model not discoverable.")
    names = _fields(Shipment)
    carrier_field = _first_field(Shipment, ("carrier", "courier", "provider"))
    if carrier_field is None:
        return _empty("Shipment has no carrier field.")
    qs = Shipment.objects.all()
    if "created_at" in names:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))

    status_field = _first_field(Shipment, ("status", "state"))
    rows_map: dict[str, dict[str, int]] = {}
    for s in qs:
        key = str(getattr(s, carrier_field, "unknown") or "unknown")
        entry = rows_map.setdefault(key, {"total": 0, "delivered": 0, "delayed": 0})
        entry["total"] += 1
        status = str(getattr(s, status_field, "") or "").lower() if status_field else ""
        if status == "delivered":
            entry["delivered"] += 1
        elif status in ("delayed", "late"):
            entry["delayed"] += 1

    rows = []
    for name, counts in rows_map.items():
        on_time = round((counts["delivered"] / counts["total"]) * 100, 1) if counts["total"] else 0.0
        rows.append({"carrier": name, "on_time_pct": on_time, "total": counts["total"]})
    rows.sort(key=lambda r: r["on_time_pct"], reverse=True)

    return {
        "items": rows,
        "chart": {
            "type": "bar",
            "data": rows,
            "xKey": "carrier",
            "series": [{"key": "on_time_pct", "label": "On-time %", "color": "#10b981"}],
        },
        "link": {"label": "Open Shipping", "href": "/admin/shipping"},
        "summary": f"{len(rows)} carriers ranked by on-time delivery.",
    }


def tool_low_rated_reviews(threshold: int = 3, limit: int = 20) -> dict:
    Review = _review_model()
    if Review is None:
        return _empty("Review model not discoverable.")
    names = _fields(Review)
    qs = Review.objects.all()
    if "rating" in names:
        qs = qs.filter(rating__lte=threshold)
    mask = _masking_enabled()
    items = []
    for r in qs[:limit]:
        author = getattr(r, "customer_name", getattr(r, "author", ""))
        items.append({
            "id": str(r.pk),
            "rating": getattr(r, "rating", 0),
            "author": _mask(author, mask) if author else "",
        })
    return {
        "items": items,
        "table": {
            "headers": ["Author", "Rating"],
            "rows": [[i["author"], str(i["rating"])] for i in items],
        },
        "link": {"label": "Open Reviews", "href": "/admin/reviews"},
        "summary": f"{len(items)} reviews at or below {threshold} stars.",
    }


def tool_review_sentiment(days: int = 30) -> dict:
    Review = _review_model()
    if Review is None:
        return _empty("Review model not discoverable.")
    names = _fields(Review)
    qs = Review.objects.all()
    if "created_at" in names:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))
    if "rating" not in names:
        return _empty("Review has no rating field.")
    avg = qs.aggregate(a=Avg("rating"))["a"]
    total = qs.count()
    positive = qs.filter(rating__gte=4).count()
    negative = qs.filter(rating__lte=2).count()
    return {
        "items": [{
            "avg": round(_safe_float(avg), 2),
            "total": total,
            "positive": positive,
            "negative": negative,
        }],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [
                ["Avg rating", str(round(_safe_float(avg), 2))],
                ["Total", str(total)],
                ["Positive (4+)", str(positive)],
                ["Negative (≤2)", str(negative)],
            ],
        },
        "link": {"label": "Open Reviews", "href": "/admin/reviews"},
        "summary": f"Avg rating {round(_safe_float(avg), 2)} over {total} reviews.",
    }


def tool_newsletter_stats() -> dict:
    Subscriber = _subscriber_model()
    if Subscriber is None:
        return _empty("Subscriber model not discoverable.")
    names = _fields(Subscriber)
    total = Subscriber.objects.count()
    active = 0
    if "is_active" in names:
        active = Subscriber.objects.filter(is_active=True).count()
    return {
        "items": [{"total": total, "active": active}],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [["Total subscribers", str(total)], ["Active", str(active)]],
        },
        "link": {"label": "Open Newsletter", "href": "/admin/newsletter"},
        "summary": f"{total} subscribers ({active} active).",
    }


def tool_campaign_performance(days: int = 30) -> dict:
    Campaign = _campaign_model()
    if Campaign is None:
        return _empty("Campaign model not discoverable.")
    names = _fields(Campaign)
    qs = Campaign.objects.all()
    if "created_at" in names:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))
    name_field = _first_field(Campaign, ("name", "title", "subject"))
    sent_field = _first_field(Campaign, ("sent_count", "recipients", "total_sent"))
    rows = []
    for c in qs[:20]:
        rows.append({
            "id": str(c.pk),
            "name": str(getattr(c, name_field, str(c.pk))) if name_field else str(c.pk),
            "sent": _safe_int(getattr(c, sent_field, 0)) if sent_field else 0,
        })
    rows.sort(key=lambda x: x["sent"], reverse=True)
    return {
        "items": rows,
        "table": {
            "headers": ["Campaign", "Sent"],
            "rows": [[r["name"], str(r["sent"])] for r in rows],
        },
        "link": {"label": "Open Campaigns", "href": "/admin/campaigns"},
        "summary": f"{len(rows)} campaigns in the last {days} days.",
    }


def tool_whatsapp_inbox_summary() -> dict:
    Conversation = _whatsapp_conversation_model()
    if Conversation is None:
        return _empty("WhatsApp Conversation model not discoverable.")
    names = _fields(Conversation)
    total = Conversation.objects.count()
    open_count = 0
    for field in ("status", "state"):
        if field in names:
            open_count = Conversation.objects.filter(**{f"{field}__iexact": "OPEN"}).count()
            break
    unread = 0
    for field in ("unread_count", "unread_messages"):
        if field in names:
            agg = Conversation.objects.aggregate(total=Sum(field))
            unread = int(agg["total"] or 0)
            break
    rows = [
        {"metric": "Total conversations", "value": total},
        {"metric": "Open", "value": open_count},
        {"metric": "Unread messages", "value": unread},
    ]
    return {
        "items": rows,
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [[r["metric"], str(r["value"])] for r in rows],
        },
        "link": {"label": "Open WhatsApp Inbox", "href": "/admin/whatsapp"},
        "summary": (
            f"{total} conversations, {open_count} open"
            + (f", {unread} unread messages" if unread else "")
            + "."
        ),
    }


def tool_whatsapp_recent_messages(limit: int = 15) -> dict:
    Message = _whatsapp_message_model()
    if Message is None:
        return _empty("WhatsApp Message model not discoverable.")
    names = _fields(Message)
    qs = Message.objects.all()
    for field in ("direction", "kind"):
        if field in names:
            qs = qs.filter(**{f"{field}__iexact": "IN"})
            break
    ordering = next((f for f in ("created_at", "timestamp", "sent_at") if f in names), None)
    if ordering:
        qs = qs.order_by(f"-{ordering}")
    mask = _masking_enabled()
    items = []
    for m in qs[:limit]:
        body = getattr(m, "body", getattr(m, "text", getattr(m, "content", "")))
        sender = getattr(m, "contact_name", getattr(m, "from_number", getattr(m, "from_field", "")))
        items.append({
            "id": str(m.pk),
            "from": _mask(str(sender), mask) if mask else str(sender),
            "body": (str(body)[:120] + "…") if body and len(str(body)) > 120 else str(body or ""),
            "time": (
                getattr(m, ordering).isoformat()
                if ordering and getattr(m, ordering, None)
                else ""
            ),
        })
    return {
        "items": items,
        "table": {
            "headers": ["From", "Message", "Time"],
            "rows": [[i["from"], i["body"], i["time"][:16]] for i in items],
        },
        "link": {"label": "Open WhatsApp Inbox", "href": "/admin/whatsapp"},
        "summary": f"{len(items)} recent inbound WhatsApp messages.",
    }


def tool_whatsapp_broadcast_summary() -> dict:
    Broadcast = _whatsapp_broadcast_model()
    if Broadcast is None:
        return _empty("WhatsApp Broadcast model not discoverable.")
    names = _fields(Broadcast)
    total = Broadcast.objects.count()
    sent = scheduled = draft = 0
    for field in ("status", "state"):
        if field in names:
            sent = Broadcast.objects.filter(**{f"{field}__iexact": "SENT"}).count()
            scheduled = Broadcast.objects.filter(**{f"{field}__iexact": "SCHEDULED"}).count()
            draft = Broadcast.objects.filter(**{f"{field}__iexact": "DRAFT"}).count()
            break
    rows = [
        {"metric": "Total broadcasts", "value": total},
        {"metric": "Sent", "value": sent},
        {"metric": "Scheduled", "value": scheduled},
        {"metric": "Draft", "value": draft},
    ]
    return {
        "items": rows,
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [[r["metric"], str(r["value"])] for r in rows],
        },
        "link": {"label": "Open WhatsApp", "href": "/admin/whatsapp"},
        "summary": f"{total} broadcasts ({sent} sent, {scheduled} scheduled).",
    }


def tool_social_summary() -> dict:
    Post = _social_post_model()
    if Post is None:
        return _empty("Social Post model not discoverable.")
    names = _fields(Post)
    total = Post.objects.count()
    scheduled = published = 0
    for field in ("status", "state"):
        if field in names:
            scheduled = Post.objects.filter(**{f"{field}__iexact": "scheduled"}).count()
            published = Post.objects.filter(**{f"{field}__iexact": "published"}).count()
            break
    rows = [
        {"metric": "Total posts", "value": total},
        {"metric": "Scheduled", "value": scheduled},
        {"metric": "Published", "value": published},
    ]
    return {
        "items": rows,
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [[r["metric"], str(r["value"])] for r in rows],
        },
        "link": {"label": "Open Social", "href": "/admin/social"},
        "summary": f"{total} social posts ({scheduled} scheduled, {published} published).",
    }


def tool_banner_summary() -> dict:
    Banner = _banner_model()
    if Banner is None:
        return _empty("Banner model not discoverable.")
    names = _fields(Banner)
    total = Banner.objects.count()
    active = 0
    for field in ("is_active", "active"):
        if field in names:
            active = Banner.objects.filter(**{field: True}).count()
            break
    rows = [
        {"metric": "Total banners", "value": total},
        {"metric": "Active", "value": active},
    ]
    return {
        "items": rows,
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [[r["metric"], str(r["value"])] for r in rows],
        },
        "link": {"label": "Open Banners", "href": "/admin/banner"},
        "summary": f"{total} banners ({active} active).",
    }


def tool_tiktok_summary(days: int = 30) -> dict:
    Order = _tiktok_order_model()
    Video = _tiktok_video_model()
    if Order is None and Video is None:
        return _empty("TikTok models not discoverable.")

    order_count = 0
    order_revenue = 0.0
    if Order is not None:
        names = _fields(Order)
        qs = Order.objects.all()
        if "created_at" in names:
            qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))
        order_count = qs.count()
        amount_field = _first_field(Order, ("total", "amount", "grand_total"))
        if amount_field:
            agg = qs.aggregate(s=Sum(amount_field))
            order_revenue = _safe_float(agg["s"])

    video_count = 0
    if Video is not None:
        video_count = Video.objects.count()

    return {
        "items": [{
            "orders": order_count,
            "revenue": order_revenue,
            "videos": video_count,
        }],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [
                ["TikTok orders", str(order_count)],
                ["Revenue", f"KES {order_revenue:,.0f}"],
                ["Videos", str(video_count)],
            ],
        },
        "link": {"label": "Open TikTok", "href": "/admin/tiktok"},
        "summary": f"{order_count} TikTok orders, KES {order_revenue:,.0f}, {video_count} videos.",
    }


def tool_users_permission_audit() -> dict:
    User = _customer_model()
    if User is None:
        return _empty("User model not discoverable.")
    staff = User.objects.filter(is_staff=True)
    total = staff.count()
    superusers = staff.filter(is_superuser=True).count()
    inactive = staff.filter(is_active=False).count()
    return {
        "items": [{"total": total, "superusers": superusers, "inactive": inactive}],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [
                ["Staff accounts", str(total)],
                ["Superusers", str(superusers)],
                ["Inactive staff", str(inactive)],
            ],
        },
        "link": {"label": "Open Users", "href": "/admin/users"},
        "summary": f"{total} staff, {superusers} superusers, {inactive} inactive.",
    }


def tool_settings_drift() -> dict:
    Settings = _settings_model()
    if Settings is None:
        return _empty("Settings model not discoverable.")
    qs = Settings.objects.all()
    updated_field = _first_field(Settings, ("updated_at", "modified_at"))
    recent = 0
    if updated_field:
        recent = qs.filter(**{f"{updated_field}__gte": timezone.now() - timedelta(days=7)}).count()
    return {
        "items": [{"total": qs.count(), "recent": recent}],
        "table": {
            "headers": ["Metric", "Value"],
            "rows": [
                ["Settings", str(qs.count())],
                ["Changed (7d)", str(recent)],
            ],
        },
        "link": {"label": "Open Settings", "href": "/admin/settings"},
        "summary": f"{recent} settings changed in the last 7 days.",
    }


def tool_attention_summary() -> dict:
    results: list[dict[str, Any]] = []

    Product = _product_model()
    if Product is not None:
        stock_field = _first_field(Product, ("stock", "stock_quantity", "quantity"))
        threshold_field = _first_field(Product, ("low_stock_threshold", "reorder_point"))
        if stock_field:
            low = 0
            for p in Product.objects.all()[:1000]:
                qty = _safe_int(getattr(p, stock_field, 0))
                threshold = _safe_int(getattr(p, threshold_field, 5)) if threshold_field else 5
                if qty <= threshold:
                    low += 1
            if low:
                results.append({"item": "Low-stock products", "count": low, "href": "/admin/inventory"})

    Order = _order_model()
    if Order is not None:
        names = _fields(Order)
        unpaid = 0
        if "payment_status" in names:
            unpaid = Order.objects.filter(payment_status__in=["unpaid", "pending", "failed"]).count()
        elif "is_paid" in names:
            unpaid = Order.objects.filter(is_paid=False).count()
        if unpaid:
            results.append({"item": "Unpaid orders", "count": unpaid, "href": "/admin/orders"})

    Payment = _payment_model()
    if Payment is not None:
        names = _fields(Payment)
        failed = 0
        for field in ("status", "result_code", "state"):
            if field in names:
                try:
                    failed = Payment.objects.filter(**{f"{field}__iexact": "failed"}).count()
                except Exception:  # noqa: BLE001
                    pass
                break
        if failed:
            results.append({"item": "Failed payments", "count": failed, "href": "/admin/payments"})

    Conversation = _whatsapp_conversation_model()
    if Conversation is not None:
        names = _fields(Conversation)
        open_count = 0
        for field in ("status", "state"):
            if field in names:
                open_count = Conversation.objects.filter(**{f"{field}__iexact": "OPEN"}).count()
                break
        if open_count:
            results.append({"item": "Open WhatsApp chats", "count": open_count, "href": "/admin/whatsapp"})

    Review = _review_model()
    if Review is not None:
        names = _fields(Review)
        pending = 0
        for field in ("status", "state"):
            if field in names:
                pending = Review.objects.filter(**{f"{field}__iexact": "pending"}).count()
                break
        if pending:
            results.append({"item": "Reviews awaiting moderation", "count": pending, "href": "/admin/reviews"})

    Return = _return_model()
    if Return is not None and "status" in _fields(Return):
        pending_returns = Return.objects.filter(status__in=["pending", "requested", "awaiting"]).count()
        if pending_returns:
            results.append({"item": "Pending returns", "count": pending_returns, "href": "/admin/returnsrefunds"})

    results.sort(key=lambda x: x["count"], reverse=True)

    if not results:
        return {
            "items": [],
            "summary": "Nothing needs your attention right now — everything looks caught up.",
        }

    return {
        "items": results,
        "table": {
            "headers": ["Item", "Count"],
            "rows": [[r["item"], str(r["count"])] for r in results],
        },
        "link": {"label": "Open Overview", "href": "/admin"},
        "summary": (
            f"{len(results)} item(s) need attention. "
            + " · ".join(f"{r['item']}: {r['count']}" for r in results[:3])
        ),
    }


def tool_anomalies(days: int = 7) -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")
    names = _fields(Order)
    total_field = _first_field(Order, ("total", "grand_total", "amount"))
    if "created_at" not in names or total_field is None:
        return _empty("Order missing created_at or total.")

    cutoff = timezone.now() - timedelta(days=days)
    daily: dict[str, float] = {}
    for o in Order.objects.filter(created_at__gte=cutoff):
        day = _date_label(o.created_at)
        daily[day] = daily.get(day, 0.0) + _safe_float(getattr(o, total_field, 0))

    values = list(daily.values())
    if not values:
        return _empty("No orders in the selected window.")
    avg = sum(values) / len(values)

    anomalies = []
    for day, rev in daily.items():
        if avg and abs(rev - avg) / avg > 0.3:
            anomalies.append({
                "date": day,
                "revenue": round(rev, 2),
                "avg": round(avg, 2),
                "delta_pct": round(((rev - avg) / avg) * 100, 1),
            })
    anomalies.sort(key=lambda r: r["date"])
    return {
        "items": anomalies,
        "table": {
            "headers": ["Date", "Revenue", "Avg", "Δ"],
            "rows": [[a["date"], f"KES {a['revenue']:,.0f}", f"KES {a['avg']:,.0f}", f"{a['delta_pct']:+.1f}%"] for a in anomalies],
        },
        "link": {"label": "Open Analytics", "href": "/admin/analytics"},
        "summary": f"{len(anomalies)} anomalies over {days} days.",
    }


def tool_navigate(page: str, filters: dict | None = None) -> dict:
    path = page if page.startswith("/admin") else f"/admin/{page.lstrip('/')}"
    return {
        "items": [],
        "link": {"label": f"Open {path}", "href": path},
        "filters": filters or {},
        "summary": f"Navigation target: {path}",
    }


def tool_draft_whatsapp_broadcast(audience: str = "all", tone: str = "friendly", offer: str = "") -> dict:
    audience_text = {
        "all": "our customers",
        "vip": "our VIP customers",
        "inactive": "customers who haven't ordered in a while",
        "new": "new customers",
    }.get(audience, audience)

    offer_line = f" {offer}" if offer else ""
    body = (
        f"Hi {audience_text}! 👋\n\n"
        f"We have something special for you today.{offer_line}\n\n"
        f"Shop now and enjoy fast delivery. Reply STOP to opt out."
    )

    return {
        "items": [],
        "actions": [
            {
                "id": "draft-broadcast",
                "tool": "send_whatsapp_broadcast",
                "title": "Send WhatsApp broadcast",
                "description": f"Send the drafted message to {audience_text}.",
                "params": {"audience": audience, "message": body},
                "preview": [
                    {"label": "Audience", "value": audience_text},
                    {"label": "Tone", "value": tone},
                ],
                "destructive": True,
            },
        ],
        "link": {"label": "Open WhatsApp", "href": "/admin/whatsapp"},
        "summary": body,
    }


def tool_draft_product_description(product_id: str, tone: str = "professional") -> dict:
    Product = _product_model()
    if Product is None:
        return _empty("Product model not discoverable.")
    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return _empty(f"Product {product_id} not found.")
    name = getattr(product, "name", str(product_id))
    return {
        "items": [],
        "summary": (
            f"Drafted description for **{name}** ({tone}):\n\n"
            f"Discover the {name} — carefully designed for quality and value. "
            "Crafted with the finest materials to deliver a premium experience "
            "every time. Order yours today."
        ),
        "link": {"label": "Open Product", "href": f"/admin/products/{product_id}"},
    }


def tool_draft_review_reply(review_id: str) -> dict:
    Review = _review_model()
    if Review is None:
        return _empty("Review model not discoverable.")
    try:
        review = Review.objects.get(pk=review_id)
    except Review.DoesNotExist:
        return _empty(f"Review {review_id} not found.")
    body = getattr(review, "body", getattr(review, "comment", ""))
    return {
        "items": [],
        "summary": (
            "Thanks so much for your feedback — we're sorry to hear about your "
            "experience and would love to make it right. Our team will reach out shortly."
        ),
        "actions": [
            {
                "id": "post-reply",
                "tool": "post_review_reply",
                "title": "Post reply to review",
                "description": f"Reply publicly to review {review_id}.",
                "params": {"review_id": review_id},
                "destructive": False,
            },
        ],
        "link": {"label": "Open Review", "href": f"/admin/reviews/{review_id}"},
        "summary_meta": {"review_excerpt": str(body)[:160]},
    }


def tool_preview_refund(order_id: str) -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")
    try:
        order = Order.objects.get(pk=order_id)
    except Order.DoesNotExist:
        return _empty(f"Order {order_id} not found.")
    total_field = _first_field(Order, ("total", "grand_total", "amount"))
    amount = _safe_float(getattr(order, total_field, 0)) if total_field else 0.0
    reference = getattr(order, "reference", order_id)
    return {
        "items": [],
        "actions": [
            {
                "id": "refund-order",
                "tool": "refund_order",
                "title": f"Refund order {reference}",
                "description": f"Refund KES {amount:,.0f} to the original payment method.",
                "params": {"order_id": str(order_id)},
                "preview": [
                    {"label": "Order", "value": str(reference)},
                    {"label": "Amount", "value": f"KES {amount:,.0f}"},
                ],
                "destructive": True,
            },
        ],
        "link": {"label": "Open Order", "href": f"/admin/orders/{order_id}"},
        "summary": f"Refund preview for {reference}: KES {amount:,.0f}.",
    }


def tool_preview_order_status_change(order_id: str, new_status: str = "fulfilled") -> dict:
    Order = _order_model()
    if Order is None:
        return _empty("Order model not discoverable.")
    try:
        order = Order.objects.get(pk=order_id)
    except Order.DoesNotExist:
        return _empty(f"Order {order_id} not found.")
    reference = getattr(order, "reference", order_id)
    current = getattr(order, "status", "")
    return {
        "items": [],
        "actions": [
            {
                "id": "update-order-status",
                "tool": "update_order_status",
                "title": f"Set order {reference} to {new_status}",
                "description": f"Change order status from '{current}' to '{new_status}'.",
                "params": {"order_id": str(order_id), "status": new_status},
                "preview": [
                    {"label": "Order", "value": str(reference)},
                    {"label": "From", "value": str(current)},
                    {"label": "To", "value": str(new_status)},
                ],
                "destructive": False,
            },
        ],
        "link": {"label": "Open Order", "href": f"/admin/orders/{order_id}"},
        "summary": f"Order {reference} status: {current} → {new_status}.",
    }


def tool_preview_create_discount(code: str, percent: float, days: int = 7) -> dict:
    return {
        "items": [],
        "actions": [
            {
                "id": "create-discount",
                "tool": "create_discount",
                "title": f"Create {percent}% discount · {code}",
                "description": f"Create a discount code '{code}' valid for {days} days.",
                "params": {"code": code, "percent": percent, "days": days},
                "preview": [
                    {"label": "Code", "value": code},
                    {"label": "Percent", "value": f"{percent}%"},
                    {"label": "Valid for", "value": f"{days} days"},
                ],
                "destructive": False,
            },
        ],
        "link": {"label": "Open Discounts", "href": "/admin/discounts"},
        "summary": f"Discount preview: {code} · {percent}% off for {days} days.",
    }


TOOL_REGISTRY: dict[str, Callable[..., dict]] = {
    "diagnose_models": tool_diagnose_models,
    "get_daily_digest": tool_daily_digest,
    "get_revenue_trend": tool_revenue_trend,
    "get_revenue_by_channel": tool_revenue_by_channel,
    "get_unpaid_orders": tool_unpaid_orders,
    "get_orders_by_status": tool_orders_by_status,
    "get_orders_breakdown": tool_orders_breakdown,
    "get_orders_past_delivery": tool_orders_past_delivery,
    "get_order_detail": tool_order_detail,
    "get_transaction_reconciliation": tool_transaction_reconciliation,
    "get_low_stock_products": tool_low_stock_products,
    "get_best_selling_products": tool_best_selling_products,
    "get_slow_moving_products": tool_slow_moving_products,
    "get_inventory_value": tool_inventory_value,
    "get_products_by_category": tool_products_by_category,
    "get_brands_summary": tool_brands_summary,
    "get_discounts_summary": tool_discounts_summary,
    "get_top_customers": tool_top_customers,
    "get_customer_count": tool_customer_count,
    "get_churn_risk": tool_churn_risk,
    "get_failed_payments": tool_failed_payments,
    "get_payment_failure_rate": tool_payment_failure_rate,
    "get_pending_returns": tool_pending_returns,
    "get_refund_reasons": tool_refund_reasons,
    "get_supplier_breakdown": tool_supplier_breakdown,
    "get_shipping_delays": tool_shipping_delays,
    "get_carrier_performance": tool_carrier_performance,
    "get_low_rated_reviews": tool_low_rated_reviews,
    "get_review_sentiment": tool_review_sentiment,
    "get_newsletter_stats": tool_newsletter_stats,
    "get_campaign_performance": tool_campaign_performance,
    "get_whatsapp_inbox_summary": tool_whatsapp_inbox_summary,
    "get_whatsapp_recent_messages": tool_whatsapp_recent_messages,
    "get_whatsapp_broadcast_summary": tool_whatsapp_broadcast_summary,
    "get_social_summary": tool_social_summary,
    "get_banner_summary": tool_banner_summary,
    "get_tiktok_summary": tool_tiktok_summary,
    "get_users_permission_audit": tool_users_permission_audit,
    "get_settings_drift": tool_settings_drift,
    "get_attention_summary": tool_attention_summary,
    "get_anomalies": tool_anomalies,
    "navigate_to": tool_navigate,
    "draft_whatsapp_broadcast": tool_draft_whatsapp_broadcast,
    "draft_product_description": tool_draft_product_description,
    "draft_review_reply": tool_draft_review_reply,
    "preview_refund": tool_preview_refund,
    "preview_order_status_change": tool_preview_order_status_change,
    "preview_create_discount": tool_preview_create_discount,
}


TOOL_SCHEMAS: list[dict] = [
    {"type": "function", "function": {
        "name": "diagnose_models",
        "description": "List every installed Django app and its models, plus the active provider.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_daily_digest",
        "description": "Today's snapshot — revenue, orders, and delta vs yesterday.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_revenue_trend",
        "description": "Daily revenue and order counts for the last N days.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 7},
            "chart_type": {"type": "string", "enum": ["line", "area"]},
            "compare": {"type": "boolean", "default": False},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_revenue_by_channel",
        "description": "Revenue grouped by sales channel over the last N days.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_unpaid_orders",
        "description": "Orders that are unpaid for more than N hours.",
        "parameters": {"type": "object", "properties": {
            "hours": {"type": "integer", "default": 24},
            "limit": {"type": "integer", "default": 20},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_orders_by_status",
        "description": "List orders filtered by status.",
        "parameters": {"type": "object", "properties": {
            "status": {"type": "string"},
            "limit": {"type": "integer", "default": 20},
        }, "required": ["status"]},
    }},
    {"type": "function", "function": {
        "name": "get_orders_breakdown",
        "description": "Order counts grouped by status over the last N days.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_orders_past_delivery",
        "description": "Orders past their expected delivery date.",
        "parameters": {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 20},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_order_detail",
        "description": "Load a single order's fields.",
        "parameters": {"type": "object", "properties": {
            "order_id": {"type": "string"},
        }, "required": ["order_id"]},
    }},
    {"type": "function", "function": {
        "name": "get_transaction_reconciliation",
        "description": "Counts and totals of transactions by status.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 7},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_low_stock_products",
        "description": "Products at or below their stock threshold.",
        "parameters": {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 20},
            "threshold_override": {"type": "integer"},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_best_selling_products",
        "description": "Best-selling products by units sold.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
            "limit": {"type": "integer", "default": 10},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_slow_moving_products",
        "description": "Products with very few or zero sales — dead stock candidates.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
            "limit": {"type": "integer", "default": 15},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_inventory_value",
        "description": "Total units on hand, inventory value, and out-of-stock count.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_products_by_category",
        "description": "Number of products per category.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_brands_summary",
        "description": "Brands ranked by product count.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_discounts_summary",
        "description": "Active and total discount codes with usage leaders.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_top_customers",
        "description": "Top customers by lifetime value or total spend.",
        "parameters": {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 10},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_customer_count",
        "description": "Total customers and active customers in the last N days.",
        "parameters": {"type": "object", "properties": {
            "active_days": {"type": "integer", "default": 30},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_churn_risk",
        "description": "Customers inactive for 90+ days (churn risk).",
        "parameters": {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 15},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_failed_payments",
        "description": "Failed or timed-out payments in the last N hours.",
        "parameters": {"type": "object", "properties": {
            "hours": {"type": "integer", "default": 24},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_payment_failure_rate",
        "description": "Payment failure rate over the last N days.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 7},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_pending_returns",
        "description": "Return requests awaiting approval.",
        "parameters": {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 20},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_refund_reasons",
        "description": "Top refund and return reasons.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_supplier_breakdown",
        "description": "Suppliers ranked by number of products supplied.",
        "parameters": {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 15},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_shipping_delays",
        "description": "Shipments past their expected delivery date.",
        "parameters": {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 20},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_carrier_performance",
        "description": "Carrier on-time delivery ranking.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_low_rated_reviews",
        "description": "Reviews at or below the given star rating.",
        "parameters": {"type": "object", "properties": {
            "threshold": {"type": "integer", "default": 3},
            "limit": {"type": "integer", "default": 20},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_review_sentiment",
        "description": "Aggregate review sentiment stats (avg rating, positive vs negative).",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_newsletter_stats",
        "description": "Newsletter subscriber totals and active count.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_campaign_performance",
        "description": "Campaign performance and send counts.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_whatsapp_inbox_summary",
        "description": "WhatsApp conversation and unread-message counts.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_whatsapp_recent_messages",
        "description": "Most recent inbound WhatsApp messages.",
        "parameters": {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 15},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_whatsapp_broadcast_summary",
        "description": "WhatsApp broadcast campaign counts by status.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_social_summary",
        "description": "Counts of scheduled and published social posts.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_banner_summary",
        "description": "Total and active banner count.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_tiktok_summary",
        "description": "TikTok orders, revenue and video count.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 30},
        }},
    }},
    {"type": "function", "function": {
        "name": "get_users_permission_audit",
        "description": "Staff account counts and permission audit summary.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_settings_drift",
        "description": "Number of setting changes in the last 7 days.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_attention_summary",
        "description": "Aggregate every attention-worthy count across all modules.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_anomalies",
        "description": "Days in the last N where revenue deviated >30% from the mean.",
        "parameters": {"type": "object", "properties": {
            "days": {"type": "integer", "default": 7},
        }},
    }},
    {"type": "function", "function": {
        "name": "navigate_to",
        "description": "Return a deep-link the UI can navigate to.",
        "parameters": {"type": "object", "properties": {
            "page": {"type": "string"},
            "filters": {"type": "object"},
        }, "required": ["page"]},
    }},
    {"type": "function", "function": {
        "name": "draft_whatsapp_broadcast",
        "description": "Draft a WhatsApp broadcast. Returns a preview + action for confirmation.",
        "parameters": {"type": "object", "properties": {
            "audience": {"type": "string", "enum": ["all", "vip", "inactive", "new"]},
            "tone": {"type": "string", "default": "friendly"},
            "offer": {"type": "string"},
        }},
    }},
    {"type": "function", "function": {
        "name": "draft_product_description",
        "description": "Draft a product description for the given product id.",
        "parameters": {"type": "object", "properties": {
            "product_id": {"type": "string"},
            "tone": {"type": "string", "default": "professional"},
        }, "required": ["product_id"]},
    }},
    {"type": "function", "function": {
        "name": "draft_review_reply",
        "description": "Draft a reply to a customer review, with a post-action preview.",
        "parameters": {"type": "object", "properties": {
            "review_id": {"type": "string"},
        }, "required": ["review_id"]},
    }},
    {"type": "function", "function": {
        "name": "preview_refund",
        "description": "Preview a refund action for an order. Requires user confirmation to execute.",
        "parameters": {"type": "object", "properties": {
            "order_id": {"type": "string"},
        }, "required": ["order_id"]},
    }},
    {"type": "function", "function": {
        "name": "preview_order_status_change",
        "description": "Preview an order status change action.",
        "parameters": {"type": "object", "properties": {
            "order_id": {"type": "string"},
            "new_status": {"type": "string", "default": "fulfilled"},
        }, "required": ["order_id"]},
    }},
    {"type": "function", "function": {
        "name": "preview_create_discount",
        "description": "Preview creating a discount code.",
        "parameters": {"type": "object", "properties": {
            "code": {"type": "string"},
            "percent": {"type": "number"},
            "days": {"type": "integer", "default": 7},
        }, "required": ["code", "percent"]},
    }},
]


def execute_tool(name: str, args: dict | None = None, user=None) -> dict:
    fn = TOOL_REGISTRY.get(name)
    if fn is None:
        result = {"items": [], "note": f"unknown tool: {name}"}
        _audit(name, args, result, user=user)
        return result
    try:
        result = fn(**(args or {}))
        _audit(name, args, result, user=user)
        return result
    except Exception as exc:  # noqa: BLE001
        logger.exception("Tool %s failed", name)
        result = {"items": [], "note": f"tool error: {exc}"}
        _audit(name, args, result, user=user)
        return result


def get_tool(name: str) -> Callable[..., dict] | None:
    return TOOL_REGISTRY.get(name)


def list_tools() -> list[str]:
    return sorted(TOOL_REGISTRY.keys())


def tool_manifest() -> dict:
    return {
        "tools": TOOL_SCHEMAS,
        "count": len(TOOL_SCHEMAS),
        "names": list_tools(),
    }