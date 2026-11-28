from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Avg, Count, DecimalField, F, Max, Min, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import OverviewCache


LIVE_ORDER_STATUSES = ("CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED")
REFUND_STATUSES = ("RETURNED", "CANCELLED", "FAILED")
PENDING_STATUSES = ("PENDING",)
FAILED_PAYMENT_STATUSES = ("FAILED", "CANCELLED", "TIMEOUT")
CACHE_TTL_SECONDS = 300

DECIMAL = DecimalField(max_digits=14, decimal_places=2)

BLUE = "#172554"
GREEN = "#059669"
RED = "#dc2626"
AMBER = "#d97706"
INDIGO = "#4f46e5"
VIOLET = "#7c3aed"
CYAN = "#0891b2"

PAYMENT_COLORS = {
    "M-Pesa": GREEN,
    "Card / Stripe": BLUE,
    "Airtel Money": AMBER,
    "Cash on Delivery": INDIGO,
    "Other": CYAN,
}

CATEGORY_PALETTE = [BLUE, INDIGO, VIOLET, CYAN, AMBER, RED, GREEN]


def _range_key(request) -> str:
    today_iso = timezone.localdate().isoformat()
    rng = request.GET.get("range", "7d")
    if rng == "custom":
        start = request.GET.get("start", "")
        end = request.GET.get("end", "")
        return f"{today_iso}:custom:{start}..{end}"
    return f"{today_iso}:{rng}"


def _resolve_dates(request):
    rng = request.GET.get("range", "7d")
    today = timezone.localdate()

    if rng == "today":
        start = end = today
        days = 1
    elif rng == "30d":
        start = today - timedelta(days=29)
        end = today
        days = 30
    elif rng == "90d":
        start = today - timedelta(days=89)
        end = today
        days = 90
    elif rng == "custom":
        try:
            start = datetime.strptime(request.GET.get("start", ""), "%Y-%m-%d").date()
            end = datetime.strptime(request.GET.get("end", ""), "%Y-%m-%d").date()
            if end < start:
                start, end = end, start
        except ValueError:
            start = end = today
        days = max(1, (end - start).days + 1)
    else:
        start = today - timedelta(days=6)
        end = today
        days = 7

    return start, end, days


def _abs_media_url(url: str) -> str:
    if not url:
        return ""

    url = str(url).strip()
    if not url:
        return ""

    if url.startswith("http://") or url.startswith("https://"):
        return url

    from django.conf import settings

    backend_base = getattr(settings, "BACKEND_PUBLIC_URL", "").rstrip("/")
    media_abs = getattr(settings, "MEDIA_URL_ABSOLUTE", "") or ""

    if url.startswith("/"):
        if backend_base:
            return f"{backend_base}{url}"
        return url

    base = media_abs or getattr(settings, "MEDIA_URL", "/media/")
    if not base.endswith("/"):
        base = base + "/"
    return f"{base}{url}"


def _primary_product_image_url(product) -> str:
    if product is None:
        return ""

    main = getattr(product, "image", None)
    if main:
        try:
            url = main.url if hasattr(main, "url") else str(main)
            if url:
                return _abs_media_url(url)
        except Exception:
            pass

    try:
        images = list(product.images.all())
    except Exception:
        return ""

    if not images:
        return ""

    primary = next(
        (i for i in images if getattr(i, "is_primary", False)),
        None,
    )
    if primary is None:
        try:
            images.sort(key=lambda i: getattr(i, "sort_order", 0) or 0)
        except Exception:
            pass
        primary = images[0]

    candidates = []
    for attr in ("image", "file", "url"):
        val = getattr(primary, attr, None)
        if not val:
            continue
        try:
            if hasattr(val, "url"):
                candidates.append(val.url)
            else:
                candidates.append(str(val))
        except Exception:
            continue

    if not candidates:
        return ""

    return _abs_media_url(candidates[0])


def _cached_or_build(request, builder, empty: dict) -> dict:
    key = _range_key(request)
    cutoff = timezone.now() - timedelta(seconds=CACHE_TTL_SECONDS)
    cached = OverviewCache.objects.filter(range_key=key, updated_at__gte=cutoff).first()
    if cached and cached.payload:
        return cached.payload

    try:
        payload = builder(request)
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning(
            "overview build failed: %s", exc, exc_info=True
        )
        payload = dict(empty)
        payload["error"] = str(exc)
        return payload

    OverviewCache.objects.update_or_create(
        range_key=key, defaults={"payload": payload}
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
    if previous <= 0:
        return (100.0 if current > 0 else 0.0), True
    delta = (current - previous) / previous * 100
    return abs(delta), delta >= 0


def _sparkline(queryset_values: list[float], fallback_points: int = 7) -> list[dict]:
    if not queryset_values:
        return [{"value": 0} for _ in range(fallback_points)]
    points = list(queryset_values)
    while len(points) < fallback_points:
        points.insert(0, 0)
    return [{"value": round(float(v), 2)} for v in points[-fallback_points:]]


def _group_daily(qs, field: str, start, end):
    rows = {
        r["day"]: r["total"]
        for r in (
            qs.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(
                total=Coalesce(Sum(field), Value(0), output_field=DECIMAL)
            )
        )
    }
    filled = []
    cur = start
    while cur <= end:
        filled.append(_to_float(rows.get(cur, 0)))
        cur += timedelta(days=1)
    return filled


def _group_daily_counts(qs, start, end):
    rows = {
        r["day"]: r["n"]
        for r in (
            qs.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(n=Count("id"))
        )
    }
    filled = []
    cur = start
    while cur <= end:
        filled.append(float(rows.get(cur, 0) or 0))
        cur += timedelta(days=1)
    return filled


def _order_number(o) -> str:
    for attr in ("order_number", "reference", "number", "code"):
        val = getattr(o, attr, None)
        if val:
            return str(val)
    return f"#{o.pk}"


def _build_module_summaries(start, end) -> list[dict]:
    summaries: list[dict] = []

    # 1. Direct / TikTok Shop Orders
    try:
        from dashboard.direct_orders.models import DirectOrder, Expense
        do_qs = DirectOrder.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
        do_live = do_qs.exclude(status__in=("CANCELLED", "cancelled", "FAILED", "failed", "RETURNED", "returned"))
        do_rev = _to_int(do_live.aggregate(t=Coalesce(Sum("total"), Value(0), output_field=DECIMAL))["t"])
        do_cnt = do_live.count()
        do_pending = DirectOrder.objects.filter(status__iregex=r"^(pending|new|unverified)$").count()
        summaries.append({
            "id": "direct_orders",
            "title": "Direct & TikTok",
            "metric": f"KES {do_rev:,}",
            "subtext": f"{do_cnt} orders · {do_pending} pending",
            "attention": do_pending,
            "href": "/admin/tiktok",
            "icon": "ShoppingCart",
        })
    except Exception:
        pass

    # 2. Returns & Refunds
    try:
        from dashboard.returns.models import Refund, ReturnRequest
        rr_open = ReturnRequest.objects.filter(status__in=("Pending", "Requested", "In Review", "Approved")).count()
        ref_amt = _to_int(
            Refund.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
            .aggregate(t=Coalesce(Sum("amount"), Value(0), output_field=DECIMAL))["t"]
        )
        summaries.append({
            "id": "returns",
            "title": "Returns & Refunds",
            "metric": f"{rr_open} open",
            "subtext": f"KES {ref_amt:,} refunded in range",
            "attention": rr_open,
            "href": "/admin/returnsrefunds",
            "icon": "RotateCcw",
        })
    except Exception:
        pass

    # 3. Shipping & Shipments
    try:
        from dashboard.shipping.models import Shipment
        sh_qs = Shipment.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
        in_transit = Shipment.objects.filter(status__in=("Picked Up", "In Transit", "Out for Delivery")).count()
        failed_sh = sh_qs.filter(status__in=("Failed", "Returned")).count()
        summaries.append({
            "id": "shipping",
            "title": "Shipping",
            "metric": f"{in_transit} in transit",
            "subtext": f"{sh_qs.count()} shipments · {failed_sh} failed",
            "attention": failed_sh,
            "href": "/admin/shipping",
            "icon": "Truck",
        })
    except Exception:
        pass

    # 4. Suppliers & Purchases
    try:
        from dashboard.suppliers.models import Purchase, Supplier
        active_sup = Supplier.objects.filter(status__iexact="active").count() or Supplier.objects.count()
        open_po = Purchase.objects.exclude(status__iexact="received").exclude(status__iexact="cancelled").count()
        summaries.append({
            "id": "suppliers",
            "title": "Suppliers",
            "metric": f"{active_sup} active",
            "subtext": f"{open_po} open purchase orders",
            "attention": 0,
            "href": "/admin/suppliers",
            "icon": "Package",
        })
    except Exception:
        pass

    # 5. WhatsApp Commerce & Inbox
    try:
        from dashboard.whatsapp.models import WhatsAppConversation, WhatsAppOrder
        wa_unread = WhatsAppConversation.objects.filter(unread_count__gt=0).count()
        wa_orders = WhatsAppOrder.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
        wa_rev = _to_int(wa_orders.aggregate(t=Coalesce(Sum("total"), Value(0), output_field=DECIMAL))["t"])
        summaries.append({
            "id": "whatsapp",
            "title": "WhatsApp",
            "metric": f"{wa_unread} unread",
            "subtext": f"{wa_orders.count()} orders · KES {wa_rev:,}",
            "attention": wa_unread,
            "href": "/admin/whatsapp",
            "icon": "MessageCircle",
        })
    except Exception:
        pass

    # 6. Social Media Channels
    try:
        from dashboard.social.models import SocialAccount, SocialInboxConversation, SocialScheduledPost
        sc_conn = SocialAccount.objects.filter(status="connected").count()
        sc_sched = SocialScheduledPost.objects.filter(status__in=("scheduled", "queued", "approved")).count()
        sc_unread = SocialInboxConversation.objects.filter(unread=True).count()
        summaries.append({
            "id": "social",
            "title": "Social Media",
            "metric": f"{sc_conn} connected",
            "subtext": f"{sc_sched} scheduled · {sc_unread} unread inbox",
            "attention": sc_unread,
            "href": "/admin/social",
            "icon": "Share2",
        })
    except Exception:
        pass

    # 7. Marketing (Campaigns, Discounts, Newsletter)
    try:
        from catalog.models import Discount
        from dashboard.campaigns.models import Campaign
        from newsletter.models import Subscriber
        active_camp = Campaign.objects.filter(status__in=("scheduled", "sending")).count()
        active_disc = Discount.objects.filter(
            Q(end_date__isnull=True) | Q(end_date__date__gte=timezone.localdate())
        ).exclude(status_override__in=("Draft", "Paused")).count()
        subs = Subscriber.objects.filter(is_active=True).count()
        summaries.append({
            "id": "marketing",
            "title": "Marketing",
            "metric": f"{active_disc} deals",
            "subtext": f"{active_camp} active campaigns · {subs:,} subscribers",
            "attention": 0,
            "href": "/admin/campaigns",
            "icon": "Tag",
        })
    except Exception:
        pass

    # 8. Reviews & Support Tickets
    try:
        from account.models import Review
        from dashboard.customers.models import SupportTicket
        pending_rev = Review.objects.filter(status__iexact="pending").count()
        open_tix = SupportTicket.objects.exclude(status__in=("Resolved", "Closed", "resolved", "closed")).count()
        summaries.append({
            "id": "support_reviews",
            "title": "Reviews & Support",
            "metric": f"{pending_rev} pending reviews",
            "subtext": f"{open_tix} open support tickets",
            "attention": pending_rev + open_tix,
            "href": "/admin/reviews",
            "icon": "Star",
        })
    except Exception:
        pass

    # 9. Analytics & Reports Quick Links
    try:
        from dashboard.aiautomations.models import AIAlert
        alerts_n = AIAlert.objects.filter(is_dismissed=False).count()
    except Exception:
        alerts_n = 0
    summaries.append({
        "id": "analytics_link",
        "title": "Analytics",
        "metric": "Traffic & Funnel",
        "subtext": f"{alerts_n} active AI alerts" if alerts_n else "Traffic, sales, products & channels",
        "attention": alerts_n,
        "href": "/admin/analytics",
        "icon": "TrendingUp",
    })
    summaries.append({
        "id": "reports_link",
        "title": "Reports",
        "metric": "10 Report Tabs",
        "subtext": "Sales, VAT, payouts, shipping & social",
        "attention": 0,
        "href": "/admin/reports",
        "icon": "FileText",
    })

    return summaries


@require_GET
def overview(request):
    def build(_req):
        from authentication.models import User
        from catalog.models import Category, Product
        from checkout.models import Order, OrderItem, Payment
        from dashboard.customers.models import CustomerProfile

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

        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        today_orders = Order.objects.filter(
            created_at__date=today,
            status__in=LIVE_ORDER_STATUSES,
        )
        yesterday_orders = Order.objects.filter(
            created_at__date=yesterday,
            status__in=LIVE_ORDER_STATUSES,
        )

        pending_orders = Order.objects.filter(status__in=PENDING_STATUSES)
        failed_payments = Order.objects.filter(
            payment_status__in=("FAILED", "PENDING", "UNPAID"),
        )

        def agg(qs):
            return qs.aggregate(
                revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                orders=Count("id"),
            )

        now = agg(orders_now)
        prev = agg(orders_prev)

        revenue_now = _to_float(now["revenue"])
        revenue_prev = _to_float(prev["revenue"])
        orders_count_now = now["orders"] or 0
        orders_count_prev = prev["orders"] or 0

        today_revenue = _to_float(
            today_orders.aggregate(
                r=Coalesce(Sum("total"), Value(0), output_field=DECIMAL)
            )["r"]
        )
        yesterday_revenue = _to_float(
            yesterday_orders.aggregate(
                r=Coalesce(Sum("total"), Value(0), output_field=DECIMAL)
            )["r"]
        )
        today_delta, today_pos = _pct_delta(today_revenue, yesterday_revenue)

        completed_now_qs = orders_now.filter(status="DELIVERED")
        completed_prev_qs = orders_prev.filter(status="DELIVERED")
        completed_now = completed_now_qs.count()
        completed_prev = completed_prev_qs.count()
        comp_delta, comp_pos = _pct_delta(completed_now, completed_prev)

        customers_total = User.objects.filter(
            role="CUSTOMER", is_active=True
        ).count()
        new_cust_now = User.objects.filter(
            role="CUSTOMER", is_active=True,
            date_joined__date__gte=start, date_joined__date__lte=end,
        ).count()
        new_cust_prev = User.objects.filter(
            role="CUSTOMER", is_active=True,
            date_joined__date__gte=prev_start, date_joined__date__lte=prev_end,
        ).count()
        cust_delta, cust_pos = _pct_delta(new_cust_now, new_cust_prev)

        products_total = Product.objects.filter(is_active=True).count()
        low_stock_count = Product.objects.filter(
            is_active=True,
            stock_quantity__lte=F("low_stock_threshold"),
        ).count()

        refunds_now_qs = Order.objects.filter(
            status__in=REFUND_STATUSES,
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
        refunds_prev_qs = Order.objects.filter(
            status__in=REFUND_STATUSES,
            created_at__date__gte=prev_start,
            created_at__date__lte=prev_end,
        )
        refunds_count = refunds_now_qs.count()
        refunds_prev_count = refunds_prev_qs.count()
        ref_delta, ref_pos = _pct_delta(refunds_count, refunds_prev_count)
        ref_pos = refunds_count <= refunds_prev_count

        failed_now_qs = failed_payments.filter(
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
        failed_prev_qs = failed_payments.filter(
            created_at__date__gte=prev_start,
            created_at__date__lte=prev_end,
        )
        failed_count = failed_now_qs.count()
        failed_prev_count = failed_prev_qs.count()
        fail_delta, _ = _pct_delta(failed_count, failed_prev_count)
        fail_pos = failed_count <= failed_prev_count

        rev_delta, rev_pos = _pct_delta(revenue_now, revenue_prev)
        ord_delta, ord_pos = _pct_delta(orders_count_now, orders_count_prev)

        daily_rev = _group_daily(orders_now, "total", start, end)
        daily_ord = _group_daily_counts(orders_now, start, end)
        daily_comp = _group_daily_counts(completed_now_qs, start, end)
        daily_ref = _group_daily_counts(refunds_now_qs, start, end)
        daily_fail = _group_daily_counts(failed_now_qs, start, end)
        daily_pending = _group_daily_counts(
            pending_orders.filter(created_at__date__gte=start, created_at__date__lte=end),
            start,
            end,
        )

        kpis = [
            {
                "id": "revenue",
                "title": "Total Revenue",
                "value": int(revenue_now),
                "prefix": "KES ",
                "suffix": "",
                "decimals": 0,
                "change": round(rev_delta, 1) if rev_pos else -round(rev_delta, 1),
                "isPositive": rev_pos,
                "sparklineData": _sparkline(daily_rev),
                "icon": "DollarSign",
            },
            {
                "id": "todayRevenue",
                "title": "Today's Revenue",
                "value": int(today_revenue),
                "prefix": "KES ",
                "suffix": "",
                "decimals": 0,
                "change": round(today_delta, 1) if today_pos else -round(today_delta, 1),
                "isPositive": today_pos,
                "sparklineData": _sparkline([yesterday_revenue, today_revenue], fallback_points=2),
                "icon": "Calendar",
            },
            {
                "id": "orders",
                "title": "Orders",
                "value": orders_count_now,
                "prefix": "",
                "suffix": "",
                "decimals": 0,
                "change": round(ord_delta, 1) if ord_pos else -round(ord_delta, 1),
                "isPositive": ord_pos,
                "sparklineData": _sparkline(daily_ord),
                "icon": "ShoppingCart",
            },
            {
                "id": "pending",
                "title": "Pending Orders",
                "value": pending_orders.count(),
                "prefix": "",
                "suffix": "",
                "decimals": 0,
                "change": 0.0,
                "isPositive": pending_orders.count() == 0,
                "sparklineData": _sparkline(daily_pending),
                "icon": "Clock",
            },
            {
                "id": "completed",
                "title": "Completed Orders",
                "value": completed_now,
                "prefix": "",
                "suffix": "",
                "decimals": 0,
                "change": round(comp_delta, 1) if comp_pos else -round(comp_delta, 1),
                "isPositive": comp_pos,
                "sparklineData": _sparkline(daily_comp),
                "icon": "CheckCircle2",
            },
            {
                "id": "customers",
                "title": "Customers",
                "value": customers_total,
                "prefix": "",
                "suffix": "",
                "decimals": 0,
                "change": round(cust_delta, 1) if cust_pos else -round(cust_delta, 1),
                "isPositive": cust_pos,
                "sparklineData": _sparkline([float(new_cust_prev), float(new_cust_now)], fallback_points=2),
                "icon": "Users",
            },
            {
                "id": "products",
                "title": "Products",
                "value": products_total,
                "prefix": "",
                "suffix": "",
                "decimals": 0,
                "change": 0.0,
                "isPositive": True,
                "sparklineData": _sparkline([float(products_total)], fallback_points=2),
                "icon": "Package",
            },
            {
                "id": "lowStock",
                "title": "Low Stock Products",
                "value": low_stock_count,
                "prefix": "",
                "suffix": "",
                "decimals": 0,
                "change": 0.0,
                "isPositive": low_stock_count == 0,
                "sparklineData": _sparkline([float(low_stock_count)], fallback_points=2),
                "icon": "AlertTriangle",
            },
            {
                "id": "refunds",
                "title": "Refunds / Cancelled",
                "value": refunds_count,
                "prefix": "",
                "suffix": "",
                "decimals": 0,
                "change": round(ref_delta, 1) if ref_pos else -round(ref_delta, 1),
                "isPositive": ref_pos,
                "sparklineData": _sparkline(daily_ref),
                "icon": "RotateCcw",
            },
            {
                "id": "failedPayments",
                "title": "Unpaid / Failed",
                "value": failed_count,
                "prefix": "",
                "suffix": "",
                "decimals": 0,
                "change": round(fail_delta, 1) if fail_pos else -round(fail_delta, 1),
                "isPositive": fail_pos,
                "sparklineData": _sparkline(daily_fail),
                "icon": "CreditCard",
            },
        ]

        def bucket_daily():
            rows = (
                orders_now
                .annotate(day=TruncDate("created_at"))
                .values("day")
                .annotate(
                    revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                    orders=Count("id"),
                )
            )
            by_day = {r["day"]: r for r in rows}
            out = []
            cur = start
            while cur <= end:
                r = by_day.get(cur)
                out.append({
                    "date": cur.strftime("%b %d"),
                    "revenue": _to_int(r["revenue"]) if r else 0,
                    "orders": (r["orders"] or 0) if r else 0,
                })
                cur += timedelta(days=1)
            return out

        def bucket_hourly():
            from django.db.models.functions import ExtractHour
            rows = (
                orders_now
                .annotate(hour=ExtractHour("created_at"))
                .values("hour")
                .annotate(
                    revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                    orders=Count("id"),
                )
                .order_by("hour")
            )
            slots = defaultdict(lambda: {"revenue": 0, "orders": 0})
            for r in rows:
                s_hr = (r["hour"] // 4) * 4
                slots[s_hr]["revenue"] += _to_int(r["revenue"])
                slots[s_hr]["orders"] += r["orders"] or 0
            out = []
            for slot in (0, 4, 8, 12, 16, 20):
                r = slots[slot]
                out.append({
                    "date": f"{slot:02d}:00",
                    "revenue": r["revenue"],
                    "orders": r["orders"],
                })
            return out

        def bucket_weekly():
            from django.db.models.functions import TruncWeek
            rows = (
                orders_now
                .annotate(week=TruncWeek("created_at"))
                .values("week")
                .annotate(
                    revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                    orders=Count("id"),
                )
            )
            by_week = {r["week"].date() if hasattr(r["week"], "date") else r["week"]: r for r in rows}
            n_weeks = max(1, (days + 6) // 7)
            first_monday = start - timedelta(days=start.weekday())
            out = []
            for i in range(n_weeks):
                wk = first_monday + timedelta(days=7 * i)
                r = by_week.get(wk)
                out.append({
                    "date": f"W{i + 1}",
                    "revenue": _to_int(r["revenue"]) if r else 0,
                    "orders": (r["orders"] or 0) if r else 0,
                })
            return out

        def bucket_monthly():
            from django.db.models.functions import TruncMonth
            rows = (
                orders_now
                .annotate(month=TruncMonth("created_at"))
                .values("month")
                .annotate(
                    revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                    orders=Count("id"),
                )
            )
            by_month = {r["month"].date() if hasattr(r["month"], "date") else r["month"]: r for r in rows}
            out = []
            cur = start.replace(day=1)
            while cur <= end:
                r = by_month.get(cur)
                out.append({
                    "date": cur.strftime("%b"),
                    "revenue": _to_int(r["revenue"]) if r else 0,
                    "orders": (r["orders"] or 0) if r else 0,
                })
                if cur.month == 12:
                    cur = cur.replace(year=cur.year + 1, month=1)
                else:
                    cur = cur.replace(month=cur.month + 1)
            return out

        if days <= 1:
            revenue_chart = bucket_hourly()
        elif days <= 14:
            revenue_chart = bucket_daily()
        elif days <= 60:
            revenue_chart = bucket_weekly()
        else:
            revenue_chart = bucket_monthly()

        status_qs = (
            Order.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end)
            .values("status")
            .annotate(n=Count("id"))
        )
        status_color = {
            "PENDING": AMBER,
            "CONFIRMED": BLUE,
            "PROCESSING": INDIGO,
            "SHIPPED": VIOLET,
            "DELIVERED": GREEN,
            "RETURNED": AMBER,
            "CANCELLED": RED,
            "FAILED": RED,
        }
        status_label = {
            "PENDING": "Pending",
            "CONFIRMED": "Confirmed",
            "PROCESSING": "Processing",
            "SHIPPED": "Shipped",
            "DELIVERED": "Delivered",
            "RETURNED": "Returned",
            "CANCELLED": "Cancelled",
            "FAILED": "Failed",
        }
        order_status = [
            {
                "name": status_label.get(r["status"], (r["status"] or "Unknown").title()),
                "value": r["n"] or 0,
                "color": status_color.get(r["status"], CYAN),
            }
            for r in status_qs
        ]

        def period_rows_day():
            rows = (
                orders_now
                .annotate(bucket=TruncDate("created_at"))
                .values("bucket")
                .annotate(
                    revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                    orders=Count("id"),
                )
            )
            by_day = {r["bucket"]: r for r in rows}
            out = []
            cur = start
            while cur <= end:
                r = by_day.get(cur)
                out.append({
                    "label": cur.strftime("%a"),
                    "revenue": _to_int(r["revenue"]) if r else 0,
                    "orders": (r["orders"] or 0) if r else 0,
                })
                cur += timedelta(days=1)
            return out

        def period_rows_bucket(trunc, fmt):
            rows = (
                orders_now
                .annotate(bucket=trunc("created_at"))
                .values("bucket")
                .annotate(
                    revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                    orders=Count("id"),
                )
                .order_by("bucket")
            )
            return [
                {
                    "label": r["bucket"].strftime(fmt),
                    "revenue": _to_int(r["revenue"]),
                    "orders": r["orders"] or 0,
                }
                for r in rows
            ]

        from django.db.models.functions import (
            TruncWeek as TW,
            TruncMonth as TM,
        )
        sales_by_period = {
            "Day": period_rows_day(),
            "Week": period_rows_bucket(TW, "W%V"),
            "Month": period_rows_bucket(TM, "%b"),
        }

        cat_totals = (
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=LIVE_ORDER_STATUSES,
            )
            .values("product_id")
            .annotate(
                revenue=Coalesce(
                    Sum(F("unit_price") * F("quantity")),
                    Value(0), output_field=DECIMAL,
                ),
                units=Sum("quantity"),
            )
            .order_by("-revenue")
        )
        pids = [r["product_id"] for r in cat_totals if r["product_id"]]
        pid_to_cat = dict(
            Product.objects.filter(id__in=pids).values_list("id", "category__name")
        )
        cat_agg: dict = defaultdict(lambda: {"revenue": 0, "products": set()})
        for r in cat_totals:
            cat = pid_to_cat.get(r["product_id"]) or "Other"
            cat_agg[cat]["revenue"] += _to_int(r["revenue"])
            if r["product_id"]:
                cat_agg[cat]["products"].add(r["product_id"])
        top_categories = [
            {
                "name": k,
                "revenue": v["revenue"],
                "products": len(v["products"]),
                "color": CATEGORY_PALETTE[i % len(CATEGORY_PALETTE)],
            }
            for i, (k, v) in enumerate(
                sorted(cat_agg.items(), key=lambda kv: -kv[1]["revenue"])[:5]
            )
        ]

        prod_qs = (
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=LIVE_ORDER_STATUSES,
            )
            .values("product_id")
            .annotate(
                sold=Sum("quantity"),
                revenue=Coalesce(
                    Sum(F("unit_price") * F("quantity")),
                    Value(0), output_field=DECIMAL,
                ),
            )
            .order_by("-revenue")[:5]
        )
        pids2 = [r["product_id"] for r in prod_qs if r["product_id"]]

        products_by_id = {
            str(p.id): p
            for p in (
                Product.objects
                .filter(id__in=pids2)
                .select_related("category")
                .prefetch_related("images")
            )
        }

        top_products = []
        for r in prod_qs:
            p = products_by_id.get(str(r["product_id"]))
            top_products.append({
                "id": str(r["product_id"]),
                "name": (p.name if p else "—"),
                "sku": (p.slug if p else "—") or "—",
                "sold": r["sold"] or 0,
                "revenue": _to_int(r["revenue"]),
                "image": _primary_product_image_url(p),
                "stock": (p.stock_quantity if p else 0) or 0,
                "category": (p.category.name if p and p.category_id else "—"),
            })

        recent_orders = []
        for o in (
            Order.objects
            .select_related("user")
            .order_by("-created_at")[:8]
        ):
            user = o.user if o.user_id else None
            name = (
                f"{user.first_name} {user.last_name}".strip()
                if user and (user.first_name or user.last_name)
                else (user.email if user else (o.full_name or o.contact_email or "Guest"))
            )
            recent_orders.append({
                "id": str(o.pk),
                "orderNumber": _order_number(o),
                "customer": name,
                "amount": _to_int(o.total),
                "status": (o.status or "").title(),
                "time": timezone.localtime(o.created_at).strftime("%b %d, %H:%M"),
            })

        recent_customers = []
        for c in (
            CustomerProfile.objects
            .select_related("user")
            .order_by("-created_at")[:5]
        ):
            u = c.user
            name = f"{u.first_name} {u.last_name}".strip() or u.email
            initials = "".join([n[0] for n in name.split() if n][:2]).upper()
            recent_customers.append({
                "id": str(c.pk),
                "name": name,
                "email": u.email,
                "orders": getattr(c, "orders_count", 0) or 0,
                "spent": _to_int(getattr(c, "total_spent", 0)),
                "joined": c.created_at.strftime("%b %d") if c.created_at else "—",
                "avatar": initials,
            })

        def payment_method_label(method: str) -> str:
            m = (method or "").upper()
            if m in ("MPS", "MPESA", "M-PESA"):
                return "M-Pesa"
            if m in ("STRIPE", "CARD"):
                return "Card / Stripe"
            if m in ("AIRTEL", "AIRTEL_MONEY"):
                return "Airtel Money"
            if m == "COD":
                return "Cash on Delivery"
            return (method or "Other").title()

        recent_transactions = []
        for p in (
            Payment.objects
            .select_related("order__user")
            .order_by("-created_at")[:6]
        ):
            user = p.order.user if (p.order_id and p.order.user_id) else None
            name = (
                f"{user.first_name} {user.last_name}".strip()
                if user and (user.first_name or user.last_name)
                else (user.email if user else "Guest")
            )
            label_map = {
                "SUCCESS": "Success",
                "PENDING": "Pending",
                "PROCESSING": "Pending",
                "FAILED": "Failed",
                "CANCELLED": "Failed",
                "TIMEOUT": "Failed",
                "REVERSED": "Refunded",
            }
            recent_transactions.append({
                "id": str(p.pk),
                "ref": p.mpesa_receipt_number or f"TXN-{str(p.pk)[:6].upper()}",
                "customer": name,
                "method": payment_method_label(p.method),
                "amount": _to_int(p.amount),
                "status": label_map.get(p.status, "Pending"),
                "time": timezone.localtime(p.created_at).strftime("%b %d, %H:%M"),
            })

        low_stock = []
        low_qs = (
            Product.objects
            .filter(
                is_active=True,
                stock_quantity__lte=F("low_stock_threshold"),
            )
            .select_related("category")
            .prefetch_related("images")
            .order_by("stock_quantity")[:6]
        )
        for p in low_qs:
            low_stock.append({
                "id": str(p.id),
                "name": p.name,
                "sku": p.slug or "—",
                "stock": p.stock_quantity or 0,
                "threshold": p.low_stock_threshold or 0,
                "category": p.category.name if p.category_id else "—",
                "image": _primary_product_image_url(p),
            })

        pm_qs = (
            Payment.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end, status="SUCCESS")
            .values("method")
            .annotate(
                total=Coalesce(Sum("amount"), Value(0), output_field=DECIMAL),
                n=Count("id"),
            )
        )
        grouped_pm: dict = defaultdict(lambda: {"amount": 0.0, "count": 0})
        for r in pm_qs:
            label = payment_method_label(r["method"])
            grouped_pm[label]["amount"] += _to_float(r["total"])
            grouped_pm[label]["count"] += r["n"] or 0

        total_pm = sum(v["amount"] for v in grouped_pm.values()) or 1
        payment_methods = [
            {
                "name": label,
                "amount": _to_int(v["amount"]),
                "percentage": round(v["amount"] / total_pm * 100),
                "color": PAYMENT_COLORS.get(label, CYAN),
            }
            for label, v in grouped_pm.items()
            if v["amount"] > 0 or v["count"] > 0
        ]

        return {
            "kpis": kpis,
            "revenue_chart": revenue_chart,
            "order_status": order_status,
            "sales_by_period": sales_by_period,
            "top_categories": top_categories,
            "top_products": top_products,
            "recent_orders": recent_orders,
            "recent_customers": recent_customers,
            "recent_transactions": recent_transactions,
            "low_stock": low_stock,
            "payment_methods": payment_methods,
            "module_summaries": _build_module_summaries(start, end),
        }

    return JsonResponse(_cached_or_build(request, build, {
        "kpis": [],
        "revenue_chart": [],
        "order_status": [],
        "sales_by_period": {"Day": [], "Week": [], "Month": []},
        "top_categories": [],
        "top_products": [],
        "recent_orders": [],
        "recent_customers": [],
        "recent_transactions": [],
        "low_stock": [],
        "payment_methods": [],
        "module_summaries": [],
    }))


@require_POST
def refresh_cache(request):
    import json

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        body = {}

    range_key = body.get("range")
    if range_key:
        deleted, _ = OverviewCache.objects.filter(
            Q(range_key=range_key) | Q(range_key__endswith=f":{range_key}")
        ).delete()
    else:
        deleted, _ = OverviewCache.objects.all().delete()

    return JsonResponse({"ok": True, "cleared": range_key or "all", "deleted": deleted})
