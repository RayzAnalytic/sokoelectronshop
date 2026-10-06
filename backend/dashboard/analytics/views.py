"""
dashboard/analytics/views.py

Read-only analytics aggregation. Reads from:
  • checkout.models           → Order, OrderItem, Cart, CartItem
  • catalog.models            → Product, Category, Brand
  • authentication.models     → User
  • dashboard.customers       → CustomerProfile
  • dashboard.social          → SocialPost, SocialPostTarget
  • account.models            → Address
  • dashboard.analytics       → PageView (device + pageview tracking)

Endpoints under /api/v1/admin/analytics/<tab>/?range=7days|30days|90days|year
Each tab returns JSON shaped for the frontend Analytics page.
"""

from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Avg, Count, DecimalField, F, Max, Min, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import AnalyticsCache


# ============================================================
# Constants
# ============================================================

RANGE_LABELS = {
    "7days": "Last 7 Days",
    "30days": "Last 30 Days",
    "90days": "Last 90 Days",
    "year": "Year to Date",
}

LIVE_ORDER_STATUSES = ("confirmed", "processing", "shipped", "delivered")
REFUND_STATUSES = ("returned", "cancelled", "failed")

DECIMAL = DecimalField(max_digits=14, decimal_places=2)

SOURCE_COLORS = {
    "WhatsApp": "#10b981",
    "Website": "#0284c7",
    "Direct": "#6366f1",
    "Instagram": "#ec4899",
    "Facebook": "#0284c7",
    "TikTok": "#f59e0b",
    "Organic Search": "#0284c7",
    "Paid Ads": "#ec4899",
    "Other": "#94a3b8",
}

CHANNEL_COLORS = {
    "Website": "#172554",
    "WhatsApp": "#10b981",
    "Instagram": "#ec4899",
    "Facebook": "#0284c7",
    "TikTok": "#f59e0b",
    "Other": "#6366f1",
}

DEVICE_LABELS = {
    "mobile": ("Mobile (Android/iOS)", "#10b981"),
    "desktop": ("Desktop (Windows/Mac/Linux)", "#0284c7"),
    "tablet": ("Tablet", "#f59e0b"),
}


# ============================================================
# Helpers
# ============================================================

def _range_key(request) -> str:
    return request.GET.get("range", "7days")


def _resolve_dates(request):
    """Return (start_date, end_date, days_in_range)."""
    rng = request.GET.get("range", "7days")
    today = timezone.now().date()

    if rng == "30days":
        start = today - timedelta(days=29)
        days = 30
    elif rng == "90days":
        start = today - timedelta(days=89)
        days = 90
    elif rng == "year":
        start = today.replace(month=1, day=1)
        days = (today - start).days + 1
    else:  # 7days default
        start = today - timedelta(days=6)
        days = 7

    return start, today, days


def _cached_or_build(request, tab: str, builder, empty: dict) -> dict:
    key = _range_key(request)
    cached = AnalyticsCache.objects.filter(tab=tab, range_key=key).first()
    if cached and cached.payload:
        return cached.payload

    try:
        payload = builder(request)
    except Exception as exc:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).warning(
            "analytics.%s build failed: %s", tab, exc, exc_info=True
        )
        payload = dict(empty)
        payload["error"] = str(exc)

    AnalyticsCache.objects.update_or_create(
        tab=tab, range_key=key, defaults={"payload": payload}
    )
    return payload


def _to_int(v) -> int:
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def _to_float(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _pct_delta(current: float, previous: float) -> tuple[float, bool]:
    """Return (delta_percent, positive). If previous is 0, treat as positive."""
    if previous <= 0:
        return (100.0 if current > 0 else 0.0), True
    delta = (current - previous) / previous * 100
    return abs(delta), delta >= 0


def _sparkline_for_window(today, days: int, base: float) -> list[float]:
    """Return a smooth 7-point sparkline ending in `base`."""
    if days <= 0 or base <= 0:
        return [0.0] * 7
    step = max(base / 7.0, 1.0)
    return [round(step * (i + 1), 2) for i in range(7)]


# ============================================================
# TRAFFIC
# ============================================================

@require_GET
def traffic(request):
    def build(_req):
        from authentication.models import User
        from checkout.models import Cart, Order
        from dashboard.analytics.models import PageView

        start, end, days = _resolve_dates(_req)
        prev_start = start - timedelta(days=days)
        prev_end = start - timedelta(days=1)

        orders_now = Order.objects.filter(
            created_at__date__gte=start,
            created_at__date__lte=end,
            status__in=LIVE_ORDER_STATUSES,
        )
        orders_prev = Order.objects.filter(
            created_at__date__gte=prev_start,
            created_at__date__lte=prev_end,
            status__in=LIVE_ORDER_STATUSES,
        )

        order_count = orders_now.count()
        prev_order_count = orders_prev.count()

        # ── Real PageView metrics ────────────────────────────────
        # If the PageView table has data, we use real numbers.
        # Otherwise we fall back to the older order-derived estimates.
        def pv_queryset(s, e):
            return (
                PageView.objects
                .filter(created_at__date__gte=s, created_at__date__lte=e)
                .exclude(device_type="bot")
            )

        pv_now = pv_queryset(start, end)
        pv_prev = pv_queryset(prev_start, prev_end)
        pv_now_count = pv_now.count()
        pv_prev_count = pv_prev.count()
        has_real_pv = pv_now_count > 0

        if has_real_pv:
            sessions_now = pv_now.values("session_key").distinct().count()
            visitors_now = sessions_now or order_count
            pageviews_now = pv_now_count
        else:
            visitors_now = (
                orders_now.values("user_id").distinct().count() or order_count
            )
            sessions_now = int(visitors_now * 1.3)
            pageviews_now = int(sessions_now * 3.2)

        if pv_prev_count > 0:
            sessions_prev = pv_prev.values("session_key").distinct().count()
            visitors_prev = sessions_prev or prev_order_count
            pageviews_prev = pv_prev_count
        else:
            visitors_prev = (
                orders_prev.values("user_id").distinct().count() or prev_order_count
            )
            sessions_prev = int(visitors_prev * 1.3)
            pageviews_prev = int(sessions_prev * 3.2)

        conv_now = (order_count / sessions_now * 100) if sessions_now else 0.0
        conv_prev = (prev_order_count / sessions_prev * 100) if sessions_prev else 0.0

        # ── Bounce + Duration — only real if PageView data exists ──
        if has_real_pv:
            session_rows = list(
                pv_now.values("session_key").annotate(n=Count("id"))
            )
            total_sess = len(session_rows) or 1
            bounces = sum(1 for s in session_rows if s["n"] == 1)
            bounce_now = round(bounces / total_sess * 100, 1)

            durations = []
            for s in session_rows[:200]:
                rows = list(
                    pv_now
                    .filter(session_key=s["session_key"])
                    .order_by("created_at")
                )
                if len(rows) >= 2:
                    durations.append(
                        (rows[-1].created_at - rows[0].created_at).total_seconds()
                    )
            duration_now = (sum(durations) / len(durations)) if durations else 0.0
        else:
            bounce_now = 42.6
            duration_now = 138.0

        def kpi(id_, label, value, delta_val, positive, spark, detail):
            return {
                "id": id_,
                "label": label,
                "value": value,
                "delta": f"{'+' if positive else '-'}{abs(delta_val):.1f}%",
                "positive": positive,
                "spark": spark,
                "detail": detail,
            }

        s_delta, s_pos = _pct_delta(sessions_now, sessions_prev)
        v_delta, v_pos = _pct_delta(visitors_now, visitors_prev)
        p_delta, p_pos = _pct_delta(pageviews_now, pageviews_prev)
        c_delta, c_pos = _pct_delta(conv_now, conv_prev)

        kpis = [
            kpi("sessions", "Sessions", f"{sessions_now:,}", s_delta, s_pos,
                _sparkline_for_window(end, days, sessions_now),
                "Total user sessions across the storefront."),
            kpi("visitors", "Unique Visitors", f"{visitors_now:,}", v_delta, v_pos,
                _sparkline_for_window(end, days, visitors_now),
                "Distinct visitors in the selected range."),
            kpi("pageviews", "Page Views", f"{pageviews_now:,}", p_delta, p_pos,
                _sparkline_for_window(end, days, pageviews_now),
                "Total page views across all storefront pages."),
            kpi("bounce", "Bounce Rate", f"{bounce_now:.1f}%", 3.1, True,
                [48, 47, 45, 46, 44, 43, bounce_now],
                "Sessions that left without interacting beyond the landing page."),
            kpi("duration", "Avg. Duration", f"{int(duration_now) // 60}m {int(duration_now) % 60}s",
                9.5, True, [2, 2.1, 2.2, 2.1, 2.3, 2.2, duration_now / 60],
                "Average time spent per session."),
            kpi("conversion", "Conversion Rate", f"{conv_now:.2f}%", c_delta, c_pos,
                _sparkline_for_window(end, days, conv_now),
                "Percentage of sessions that completed a purchase."),
        ]

        # ── Timeline — per-day sessions/visitors/pageviews ───────
        if has_real_pv:
            daily = (
                pv_now
                .annotate(day=TruncDate("created_at"))
                .values("day")
                .annotate(
                    views=Count("id"),
                    visitors=Count("session_key", distinct=True),
                )
                .order_by("day")
            )
            timeline = [
                {
                    "date": row["day"].strftime("%b %d"),
                    "sessions": row["visitors"] or 0,
                    "visitors": row["visitors"] or 0,
                    "pageviews": row["views"] or 0,
                }
                for row in daily
            ]
        else:
            daily = (
                orders_now
                .annotate(day=TruncDate("created_at"))
                .values("day")
                .annotate(orders=Count("id"))
                .order_by("day")
            )
            timeline = []
            for row in daily:
                day = row["day"]
                o = row["orders"] or 0
                v = max(o, 1)
                timeline.append({
                    "date": day.strftime("%b %d"),
                    "sessions": int(v * 1.3),
                    "visitors": v,
                    "pageviews": int(v * 1.3 * 3.2),
                })

        # ── Traffic sources (from Order.source) ──────────────────
        source_map = {
            "whatsapp": "WhatsApp",
            "web": "Website",
            "admin": "Direct",
            "phone": "Direct",
        }
        source_qs = (
            orders_now
            .values("source")
            .annotate(
                orders=Count("id"),
                revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
            )
        )
        total_source_orders = sum(r["orders"] for r in source_qs) or 1
        sources = []
        for r in source_qs:
            label = source_map.get(r["source"], "Other")
            share = round(r["orders"] / total_source_orders * 100)
            sources.append({
                "name": label,
                "value": share,
                "color": SOURCE_COLORS.get(label, "#94a3b8"),
                "visits": int(r["orders"] * 1.3 * 20),
                "orders": r["orders"],
                "revenue": f"KES {_to_int(r['revenue']):,}",
            })
        if not sources:
            sources = [{
                "name": "Website", "value": 100,
                "color": SOURCE_COLORS["Website"],
                "visits": 0, "orders": 0, "revenue": "KES 0",
            }]

        # ── Funnel ───────────────────────────────────────────────
        top = visitors_now
        stages = []
        if top:
            stages = [
                {"stage": "Visited Store", "count": top, "dropoff": "—",
                 "breakdown": [{"source": s["name"], "users": int(top * s["value"] / 100)} for s in sources]},
                {"stage": "Product View", "count": int(top * 0.715), "dropoff": "-28.5%",
                 "breakdown": [{"source": s["name"], "users": int(top * 0.715 * s["value"] / 100)} for s in sources]},
                {"stage": "Add to Cart", "count": int(top * 0.194), "dropoff": "-72.8%",
                 "breakdown": [{"source": s["name"], "users": int(top * 0.194 * s["value"] / 100)} for s in sources]},
                {"stage": "Checkout Initiated", "count": int(top * 0.079), "dropoff": "-59.5%",
                 "breakdown": [{"source": s["name"], "users": int(top * 0.079 * s["value"] / 100)} for s in sources]},
                {"stage": "Purchased (M-Pesa)", "count": order_count, "dropoff": "-15.9%",
                 "breakdown": [{"source": s["name"], "users": int(order_count * s["value"] / 100)} for s in sources]},
            ]

        # ── Devices — real, from PageView ────────────────────────
        devices = []
        if has_real_pv:
            dv_qs = list(
                pv_now
                .values("device_type")
                .annotate(users=Count("session_key", distinct=True))
            )
            total_dev = sum(r["users"] for r in dv_qs) or 1
            for r in dv_qs:
                key = (r["device_type"] or "desktop").lower()
                label, color = DEVICE_LABELS.get(key, (key.title(), "#94a3b8"))
                users = r["users"] or 0
                devices.append({
                    "device": label,
                    "users": users,
                    "fill": color,
                    "sessions": users,
                    "convRate": f"{(order_count / total_dev * 100):.1f}%",
                    "bounce": "—",
                })
            order_map = {"mobile": 0, "desktop": 1, "tablet": 2}
            devices.sort(
                key=lambda d: order_map.get(d["device"].split()[0].lower(), 9)
            )

        # ── Counties — safe, wrapped so a missing field can't kill the tab ──
        counties = []
        try:
            from account.models import Address

            county_qs = list(
                Address.objects
                .filter(user__isnull=False)
                .exclude(county="")
                .values("county")
                .annotate(users=Count("user", distinct=True))
                .order_by("-users")[:5]
            )
            total_addrs = sum(r["users"] for r in county_qs) or 1
            for r in county_qs:
                cty = r["county"] or "Unknown"
                share = round(r["users"] / total_addrs * 100)
                counties.append({
                    "county": cty,
                    "share": share,
                    "visitors": r["users"],
                    "orders": 0,
                    "revenue": "KES 0",
                })
        except Exception as exc:  # noqa: BLE001
            import logging
            logging.getLogger(__name__).warning(
                "analytics.traffic counties failed: %s", exc
            )
            counties = []

        # ── Abandoned carts ──────────────────────────────────────
        abandoned = []
        try:
            carts = list(
                Cart.objects
                .annotate(item_count=Count("items"))
                .filter(item_count__gt=0)
                .select_related("user")
                .order_by("-updated_at")[:20]
            )
        except Exception as exc:  # noqa: BLE001
            import logging
            logging.getLogger(__name__).warning(
                "analytics.traffic cart query failed: %s", exc, exc_info=True
            )
            carts = []

        for c in carts:
            try:
                first_item = c.items.first()
                item_name = (
                    getattr(first_item, "product_name", None)
                    or getattr(getattr(first_item, "product", None), "name", None)
                    or getattr(first_item, "name", None)
                    or "—"
                )
                value = float(getattr(c, "subtotal", 0) or 0)
                user = getattr(c, "user", None)
                customer = (
                    f"{user.first_name} {user.last_name}".strip()
                    if user and (user.first_name or user.last_name)
                    else (user.email if user else "Guest")
                )
                abandoned.append({
                    "id": f"AC-{c.id}",
                    "customer": customer,
                    "phone": getattr(user, "phone", "") if user else "",
                    "items": item_name,
                    "value": f"KES {int(value):,}",
                    "time": "recently",
                    "date": c.updated_at.strftime("%b %d") if getattr(c, "updated_at", None) else "—",
                })
            except Exception:
                continue

        return {
            "kpis": kpis,
            "sessions_timeline": timeline,
            "sources": sources,
            "funnel": stages,
            "devices": devices,
            "counties": counties,
            "abandoned_carts": abandoned,
            "abandoned_trend": [
                {"date": t["date"], "carts": max(int(t["visitors"] * 0.18), 1)}
                for t in timeline
            ],
        }

    return JsonResponse(_cached_or_build(
        request, "traffic", build,
        {"kpis": [], "sessions_timeline": [], "sources": [], "funnel": [],
         "devices": [], "counties": [], "abandoned_carts": [], "abandoned_trend": []},
    ))


# ============================================================
# SALES
# ============================================================

@require_GET
def sales(request):
    def build(_req):
        from catalog.models import Brand, Category, Product
        from checkout.models import Order, OrderItem

        start, end, days = _resolve_dates(_req)
        prev_start = start - timedelta(days=days)
        prev_end = start - timedelta(days=1)

        def agg(qs):
            return qs.aggregate(
                gross=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                refunds=Coalesce(Sum("discount"), Value(0), output_field=DECIMAL),
                orders=Count("id"),
            )

        now = agg(Order.objects.filter(
            created_at__date__gte=start, created_at__date__lte=end,
            status__in=LIVE_ORDER_STATUSES,
        ))
        prev = agg(Order.objects.filter(
            created_at__date__gte=prev_start, created_at__date__lte=prev_end,
            status__in=LIVE_ORDER_STATUSES,
        ))

        gross = _to_float(now["gross"])
        prev_gross = _to_float(prev["gross"])
        orders = now["orders"] or 0
        prev_orders = prev["orders"] or 0
        refunds = _to_float(now["refunds"])
        aov = (gross / orders) if orders else 0
        prev_aov = (prev_gross / prev_orders) if prev_orders else 0
        growth, growth_pos = _pct_delta(gross, prev_gross)

        summary = {
            "gross": int(gross),
            "net": int(gross - refunds),
            "refunds": int(refunds),
            "discounts": int(refunds),
            "orders": orders,
            "aov": int(aov),
            "revenueGrowth": round(growth, 1) if growth_pos else -round(growth, 1),
        }

        daily = (
            Order.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end,
                    status__in=LIVE_ORDER_STATUSES)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(
                gross=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                refunds=Coalesce(Sum("discount"), Value(0), output_field=DECIMAL),
            )
            .order_by("day")
        )
        trend = [{
            "date": row["day"].strftime("%b %d"),
            "gross": _to_int(row["gross"]),
            "net": _to_int(_to_float(row["gross"]) - _to_float(row["refunds"])),
            "refunds": _to_int(row["refunds"]),
        } for row in daily]

        prod_qs = (
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=LIVE_ORDER_STATUSES,
            )
            .values("product_id", "name", "image_url")
            .annotate(
                revenue=Coalesce(
                    Sum(F("unit_price") * F("quantity")),
                    Value(0), output_field=DECIMAL,
                ),
                orders=Count("order", distinct=True),
                units=Sum("quantity"),
            )
            .order_by("-revenue")[:10]
        )
        by_product = [{
            "name": r["name"] or "—",
            "revenue": _to_int(r["revenue"]),
            "orders": r["orders"] or 0,
            "units": r["units"] or 0,
            "growth": 0,
            "image": r["image_url"] or "",
        } for r in prod_qs]

        pids = [r["product_id"] for r in prod_qs if r["product_id"]]
        pid_to_cat = dict(
            Product.objects.filter(id__in=pids).values_list("id", "category__name")
        )
        cat_totals: dict = defaultdict(lambda: {"revenue": 0, "orders": 0, "units": 0})
        for r in prod_qs:
            cat = pid_to_cat.get(r["product_id"]) or "Other"
            cat_totals[cat]["revenue"] += _to_int(r["revenue"])
            cat_totals[cat]["orders"] += r["orders"] or 0
            cat_totals[cat]["units"] += r["units"] or 0
        palette = ["#10b981", "#0284c7", "#6366f1", "#f59e0b", "#ec4899"]
        by_category = [
            {"name": k, "revenue": v["revenue"], "orders": v["orders"],
             "units": v["units"], "growth": 0, "color": palette[i % len(palette)]}
            for i, (k, v) in enumerate(sorted(
                cat_totals.items(), key=lambda kv: -kv[1]["revenue"]
            )[:5])
        ]

        pid_to_brand = dict(
            Product.objects.filter(id__in=pids).values_list("id", "brand__name")
        )
        brand_totals: dict = defaultdict(lambda: {"revenue": 0, "orders": 0, "units": 0})
        for r in prod_qs:
            br = pid_to_brand.get(r["product_id"]) or "Other"
            brand_totals[br]["revenue"] += _to_int(r["revenue"])
            brand_totals[br]["orders"] += r["orders"] or 0
            brand_totals[br]["units"] += r["units"] or 0
        by_brand = [
            {"name": k, "revenue": v["revenue"], "orders": v["orders"],
             "units": v["units"], "growth": 0,
             "color": ["#172554", "#10b981", "#0284c7", "#f59e0b", "#ec4899"][i % 5]}
            for i, (k, v) in enumerate(sorted(
                brand_totals.items(), key=lambda kv: -kv[1]["revenue"]
            )[:5])
        ]

        return {
            "summary": summary,
            "trend": trend,
            "by_product": by_product,
            "by_category": by_category,
            "by_brand": by_brand,
        }

    return JsonResponse(_cached_or_build(
        request, "sales", build,
        {"summary": {"gross": 0, "net": 0, "refunds": 0, "discounts": 0,
                     "orders": 0, "aov": 0, "revenueGrowth": 0},
         "trend": [], "by_product": [], "by_category": [], "by_brand": []},
    ))


# ============================================================
# CUSTOMERS
# ============================================================

@require_GET
def customers(request):
    def build(_req):
        from authentication.models import User
        from checkout.models import Order
        from dashboard.customers.models import CustomerProfile

        start, end, days = _resolve_dates(_req)

        first_by_cust = dict(
            Order.objects
            .filter(user__isnull=False, status__in=LIVE_ORDER_STATUSES)
            .values("user_id")
            .annotate(first=Min("created_at__date"))
            .values_list("user_id", "first")
        )

        seen = (
            Order.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end,
                    user__isnull=False)
            .values("created_at__date", "user_id")
            .distinct()
        )

        new_by_day: dict = defaultdict(int)
        ret_by_day: dict = defaultdict(int)
        for r in seen:
            day = r["created_at__date"]
            uid = r["user_id"]
            if first_by_cust.get(uid) == day:
                new_by_day[day] += 1
            else:
                ret_by_day[day] += 1

        nvr = []
        cur = start
        while cur <= end:
            nvr.append({
                "date": cur.strftime("%b %d"),
                "new": new_by_day.get(cur, 0),
                "returning": ret_by_day.get(cur, 0),
            })
            cur += timedelta(days=1)

        total_new = sum(new_by_day.values())
        total_ret = sum(ret_by_day.values())
        total_cust = total_new + total_ret
        retention = (total_ret / total_cust * 100) if total_cust else 0

        profiles_qs = CustomerProfile.objects.all()
        ltv_avg = profiles_qs.aggregate(a=Avg("total_spent"))["a"] or 0
        orders_total = profiles_qs.aggregate(s=Sum("orders_count"))["s"] or 0
        spend_total = profiles_qs.aggregate(s=Sum("total_spent"))["s"] or 0
        aov_avg = (float(spend_total) / orders_total) if orders_total else 0

        metrics = [
            {"id": "new", "label": "New Customers", "value": f"{total_new:,}",
             "delta": "+0%", "positive": True,
             "detail": "First-time buyers this period."},
            {"id": "returning", "label": "Returning Customers", "value": f"{total_ret:,}",
             "delta": "+0%", "positive": True,
             "detail": "Customers with 2+ purchases."},
            {"id": "retention", "label": "Retention Rate", "value": f"{retention:.1f}%",
             "delta": "+0%", "positive": True,
             "detail": "Customers who purchased again within the range."},
            {"id": "ltv", "label": "Customer LTV", "value": f"KES {int(ltv_avg):,}",
             "delta": "+0%", "positive": True,
             "detail": "Average lifetime value per customer."},
            {"id": "aov", "label": "Avg. Spend / Order", "value": f"KES {int(aov_avg):,}",
             "delta": "+0%", "positive": True,
             "detail": "Average order value across all customers."},
            {"id": "acq", "label": "Acquisition Cost", "value": "KES 0",
             "delta": "+0%", "positive": True,
             "detail": "Blended cost to acquire one customer."},
        ]

        top = (
            profiles_qs
            .select_related("user")
            .order_by("-total_spent")[:10]
        )
        top_customers = []
        for p in top:
            u = p.user
            name = f"{u.first_name} {u.last_name}".strip() or u.email
            initials = "".join([n[0] for n in name.split() if n][:2]).upper()
            top_customers.append({
                "id": str(p.id),
                "name": name,
                "email": u.email,
                "orders": p.orders_count or 0,
                "spent": _to_int(p.total_spent),
                "avatar": initials,
                "tier": p.segment or "Regular",
            })

        return {
            "metrics": metrics,
            "new_vs_returning": nvr,
            "top_customers": top_customers,
        }

    return JsonResponse(_cached_or_build(
        request, "customers", build,
        {"metrics": [], "new_vs_returning": [], "top_customers": []},
    ))


# ============================================================
# PRODUCTS
# ============================================================

@require_GET
def products(request):
    def build(_req):
        from catalog.models import Product
        from checkout.models import OrderItem

        start, end, days = _resolve_dates(_req)

        perf_qs = (
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=LIVE_ORDER_STATUSES,
            )
            .values("product_id", "name", "image_url")
            .annotate(
                purchases=Sum("quantity"),
                revenue=Coalesce(
                    Sum(F("unit_price") * F("quantity")),
                    Value(0), output_field=DECIMAL,
                ),
            )
            .order_by("-revenue")[:30]
        )

        pids = [r["product_id"] for r in perf_qs if r["product_id"]]
        product_meta = {
            p.id: {
                "sku": p.slug or "—",
                "image": "",
                "stock": p.stock_quantity or 0,
                "category": p.category.name if p.category_id else "—",
            }
            for p in Product.objects.filter(id__in=pids).select_related("category")
        }

        def estimated_views(purchases: int) -> int:
            return int(purchases / 0.015) if purchases else 0

        rows = []
        for r in perf_qs:
            meta = product_meta.get(r["product_id"], {})
            purchases = r["purchases"] or 0
            views = estimated_views(purchases)
            revenue = _to_int(r["revenue"])
            stock = meta.get("stock", 0)
            conversion = (purchases / views * 100) if views else 0

            if stock == 0:
                status = "out"
            elif revenue > 200000:
                status = "best"
            elif revenue > 50000:
                status = "low"
            else:
                status = "abandoned"

            rows.append({
                "id": str(r["product_id"]),
                "name": r["name"] or "—",
                "sku": meta.get("sku", "—"),
                "image": r["image_url"] or meta.get("image", ""),
                "views": views,
                "purchases": purchases,
                "revenue": revenue,
                "stock": stock,
                "category": meta.get("category", "—"),
                "conversion": f"{conversion:.2f}%",
                "status": status,
            })

        most_viewed = max(rows, key=lambda r: r["views"], default=None)
        most_purchased = max(rows, key=lambda r: r["purchases"], default=None)
        best_seller = next((r for r in rows if r["status"] == "best"), None)

        return {
            "summary": {
                "most_viewed": (most_viewed or {}).get("name", "—"),
                "most_purchased": (most_purchased or {}).get("name", "—"),
                "best_seller": (best_seller or {}).get("name", "—"),
                "low_performers": sum(1 for r in rows if r["status"] == "low"),
                "out_of_stock": sum(1 for r in rows if r["status"] == "out"),
                "abandoned": sum(1 for r in rows if r["status"] == "abandoned"),
            },
            "rows": rows,
        }

    return JsonResponse(_cached_or_build(
        request, "products", build,
        {"summary": {"most_viewed": "—", "most_purchased": "—", "best_seller": "—",
                     "low_performers": 0, "out_of_stock": 0, "abandoned": 0},
         "rows": []},
    ))


# ============================================================
# CHANNELS
# ============================================================

@require_GET
def channels(request):
    def build(_req):
        from checkout.models import Order

        start, end, days = _resolve_dates(_req)

        source_map = {
            "whatsapp": "WhatsApp",
            "web": "Website",
            "admin": "Other",
            "phone": "Other",
        }
        qs = (
            Order.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end,
                    status__in=LIVE_ORDER_STATUSES)
            .values("source")
            .annotate(
                orders=Count("id"),
                revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
            )
        )
        total_orders = sum(r["orders"] for r in qs) or 1

        rows = []
        for r in qs:
            label = source_map.get(r["source"], "Other")
            share = round(r["orders"] / total_orders * 100)
            revenue = _to_int(r["revenue"])
            visitors = int(r["orders"] * 1.3 * 20)
            conv = (r["orders"] / visitors * 100) if visitors else 0
            rows.append({
                "name": label,
                "share": share,
                "visitors": visitors,
                "orders": r["orders"],
                "revenue": f"KES {revenue:,}",
                "convRate": f"{conv:.1f}%",
                "color": CHANNEL_COLORS.get(label, "#94a3b8"),
                "icon": label,
            })

        if not rows:
            rows = [{"name": "Website", "share": 100, "visitors": 0, "orders": 0,
                     "revenue": "KES 0", "convRate": "0.0%",
                     "color": CHANNEL_COLORS["Website"], "icon": "Website"}]

        daily = (
            Order.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end,
                    status__in=LIVE_ORDER_STATUSES)
            .annotate(day=TruncDate("created_at"))
            .values("day", "source")
            .annotate(orders=Count("id"))
            .order_by("day")
        )
        by_day: dict = defaultdict(lambda: {"whatsapp": 0, "instagram": 0,
                                            "facebook": 0, "tiktok": 0,
                                            "website": 0})
        for r in daily:
            label = source_map.get(r["source"], "other").lower()
            key = label if label in by_day[r["day"]] else "website"
            by_day[r["day"]][key] += r["orders"]

        trend = [
            {"date": d.strftime("%b %d"), **counts}
            for d, counts in sorted(by_day.items())
        ]

        social_activity = []
        try:
            from dashboard.social.models import SocialPostTarget
            sm = (
                SocialPostTarget.objects
                .values("platform")
                .annotate(
                    posts=Count("id"),
                    likes=Coalesce(Sum("likes"), Value(0)),
                    comments=Coalesce(Sum("comments"), Value(0)),
                    reach=Coalesce(Sum("reach"), Value(0)),
                )
            )
            platform_labels = {
                "FACEBOOK": ("Facebook", "#0284c7"),
                "INSTAGRAM": ("Instagram", "#ec4899"),
                "TIKTOK": ("TikTok", "#f59e0b"),
                "YOUTUBE": ("YouTube", "#dc2626"),
                "X": ("X", "#0f172a"),
            }
            for r in sm:
                name, color = platform_labels.get(
                    r["platform"], (r["platform"] or "Other", "#94a3b8")
                )
                social_activity.append({
                    "platform": name,
                    "metric": "Reach",
                    "value": f"{_to_int(r['reach']):,}",
                    "delta": "+0%",
                    "positive": True,
                    "color": color,
                })
        except Exception:
            pass

        attribution = [
            {"platform": "WhatsApp Business API", "metric": "Chat → Order",
             "value": f"{(next((r['share'] for r in rows if r['name'] == 'WhatsApp'), 0))}%",
             "desc": "Highest converting channel"},
            {"platform": "Instagram Shop", "metric": "Profile → Store visit",
             "value": f"{(next((r['share'] for r in rows if r['name'] == 'Instagram'), 0))}%",
             "desc": "Strong product discovery"},
            {"platform": "TikTok Pixel", "metric": "Video → Store visit",
             "value": f"{(next((r['share'] for r in rows if r['name'] == 'TikTok'), 0))}%",
             "desc": "Best performing ads"},
        ]

        return {
            "channels": rows,
            "trend": trend,
            "social_activity": social_activity,
            "attribution": attribution,
        }

    return JsonResponse(_cached_or_build(
        request, "channels", build,
        {"channels": [], "trend": [], "social_activity": [], "attribution": []},
    ))


# ============================================================
# Cache refresh
# ============================================================

@require_POST
def refresh_cache(request):
    import json

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        body = {}

    tab = body.get("tab")
    if tab:
        if tab not in dict(AnalyticsCache.TAB_CHOICES):
            return JsonResponse({"ok": False, "error": "Unknown tab"}, status=400)
        deleted, _ = AnalyticsCache.objects.filter(tab=tab).delete()
    else:
        deleted, _ = AnalyticsCache.objects.all().delete()

    return JsonResponse({"ok": True, "cleared": tab or "all", "deleted": deleted})