from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Avg, Count, DecimalField, F, Max, Min, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import ReportCache, ReportExportLog


RANGE_LABELS = {
    "today": "Today",
    "yesterday": "Yesterday",
    "7days": "Last 7 Days",
    "30days": "Last 30 Days",
    "this_month": "This Month",
    "last_month": "Last Month",
    "custom": "Custom Range",
}

LIVE_ORDER_STATUSES = ("CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED")
REFUND_ORDER_STATUSES = ("RETURNED", "CANCELLED", "FAILED")
PAYMENT_SUCCESS = "SUCCESS"
CACHE_TTL_SECONDS = 300

DECIMAL = DecimalField(max_digits=14, decimal_places=2)


def _range_key(request) -> str:
    today_iso = timezone.localdate().isoformat()
    rng = request.GET.get("range", "7days")
    if rng == "custom":
        start = request.GET.get("start", "")
        end = request.GET.get("end", "")
        return f"{today_iso}:custom:{start}..{end}"
    return f"{today_iso}:{rng}"


def _resolve_dates(request):
    rng = request.GET.get("range", "7days")
    today = timezone.localdate()

    if rng == "today":
        start = end = today
    elif rng == "yesterday":
        start = end = today - timedelta(days=1)
    elif rng == "7days":
        start, end = today - timedelta(days=6), today
    elif rng == "30days":
        start, end = today - timedelta(days=29), today
    elif rng == "this_month":
        start, end = today.replace(day=1), today
    elif rng == "last_month":
        first_this = today.replace(day=1)
        end = first_this - timedelta(days=1)
        start = end.replace(day=1)
    elif rng == "custom":
        try:
            start = datetime.strptime(request.GET.get("start", ""), "%Y-%m-%d").date()
            end = datetime.strptime(request.GET.get("end", ""), "%Y-%m-%d").date()
            if end < start:
                start, end = end, start
        except ValueError:
            start = end = today
    else:
        start, end = today - timedelta(days=6), today

    return start, end


def _date_range_days(start, end):
    out = []
    cur = start
    while cur <= end:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def _cached_or_build(request, tab: str, builder, empty: dict) -> dict:
    key = _range_key(request)
    cutoff = timezone.now() - timedelta(seconds=CACHE_TTL_SECONDS)
    cached = ReportCache.objects.filter(tab=tab, range_key=key, updated_at__gte=cutoff).first()
    if cached and cached.payload:
        return cached.payload

    try:
        payload = builder(request)
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning(
            "reports.%s build failed: %s", tab, exc, exc_info=True
        )
        payload = dict(empty)
        payload["range_label"] = RANGE_LABELS.get(request.GET.get("range", "7days"))
        payload["error"] = str(exc)
        return payload

    ReportCache.objects.update_or_create(
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


def _fmt_date(d) -> str:
    if not d:
        return "—"
    if hasattr(d, "tzinfo") and d.tzinfo is not None:
        d = timezone.localtime(d)
    return d.strftime("%b %d, %Y")


def _humanize_delta(dt) -> str:
    if not dt:
        return "—"
    secs = max(0, int((timezone.now() - dt).total_seconds()))
    if secs < 60:
        return f"{secs}s ago"
    if secs < 3600:
        return f"{secs // 60} mins ago"
    if secs < 86400:
        return f"{secs // 3600} hours ago"
    return f"{secs // 86400} days ago"


def _fmt_pct_change(cur: float, prev: float, is_count: bool = False) -> str:
    if is_count:
        diff = int(cur - prev)
        return f"+{diff}" if diff >= 0 else str(diff)
    if prev <= 0:
        return "+100%" if cur > 0 else "+0%"
    pct = (cur - prev) / prev * 100
    return f"{'+' if pct >= 0 else ''}{pct:.1f}%"


@require_GET
def sales(request):
    def build(_req):
        from catalog.models import Product
        from checkout.models import Order, OrderItem

        start, end = _resolve_dates(_req)

        daily = (
            Order.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end)
            .filter(status__in=LIVE_ORDER_STATUSES)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(
                revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                orders=Count("id"),
            )
            .order_by("day")
        )

        refunds_by_day = {
            r["day"]: r["refunds"]
            for r in (
                Order.objects
                .filter(created_at__date__gte=start, created_at__date__lte=end)
                .filter(status__in=REFUND_ORDER_STATUSES)
                .annotate(day=TruncDate("created_at"))
                .values("day")
                .annotate(refunds=Count("id"))
            )
        }

        item_rows = (
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=LIVE_ORDER_STATUSES,
            )
            .annotate(day=TruncDate("order__created_at"))
            .values("day", "product_id")
            .annotate(qty=Sum("quantity"))
        )

        pids = {r["product_id"] for r in item_rows if r["product_id"]}
        pid_to_cat = dict(
            Product.objects
            .filter(id__in=pids)
            .values_list("id", "category__name")
        )

        cat_qty: dict = defaultdict(lambda: defaultdict(int))
        for r in item_rows:
            cat = pid_to_cat.get(r["product_id"])
            if cat:
                cat_qty[r["day"]][cat] += r["qty"] or 0

        top_cat_by_day = {
            day: max(cats.items(), key=lambda kv: kv[1])[0]
            for day, cats in cat_qty.items() if cats
        }

        by_day = {r["day"]: r for r in daily}
        rows = []
        for d in _date_range_days(start, end):
            r = by_day.get(d)
            revenue = float(r["revenue"] or 0) if r else 0.0
            orders_count = (r["orders"] or 0) if r else 0
            rows.append({
                "date": d.strftime("%b %d"),
                "revenue": _to_int(revenue),
                "orders": orders_count,
                "aov": _to_int(revenue / orders_count) if orders_count else 0,
                "topCategory": top_cat_by_day.get(d, "—"),
                "refunds": refunds_by_day.get(d, 0),
            })

        return {
            "range_label": RANGE_LABELS.get(_req.GET.get("range", "7days")),
            "daily": rows,
        }

    return JsonResponse(
        _cached_or_build(request, "sales", build, {"daily": []}),
    )


@require_GET
def orders(request):
    def build(_req):
        from checkout.models import Order

        start, end = _resolve_dates(_req)

        qs = (
            Order.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end)
            .select_related("user")
            .prefetch_related("items")
            .order_by("-created_at")[:500]
        )

        combined = []
        for o in qs:
            if o.user:
                customer = (
                    f"{o.user.first_name} {o.user.last_name}".strip()
                    or o.user.email
                )
            else:
                customer = o.full_name or o.contact_email or "Guest"

            combined.append((
                o.created_at,
                {
                    "id": o.reference or f"#{o.pk}",
                    "date": _fmt_date(o.created_at),
                    "customer": customer,
                    "items": o.items.count(),
                    "total": _to_int(o.total),
                    "status": (o.status or "").title(),
                    "payment": o.get_payment_method_display(),
                    "channel": o.get_source_display(),
                },
            ))

        # Include Direct / TikTok Shop orders
        try:
            from dashboard.direct_orders.models import DirectOrder
            dqs = (
                DirectOrder.objects
                .filter(created_at__date__gte=start, created_at__date__lte=end)
                .prefetch_related("items")
                .order_by("-created_at")[:200]
            )
            for d in dqs:
                combined.append((
                    d.created_at,
                    {
                        "id": d.reference or f"DIR-{d.pk}",
                        "date": _fmt_date(d.created_at),
                        "customer": d.customer_name or d.customer_email or "Direct Customer",
                        "items": d.items.count(),
                        "total": _to_int(d.total),
                        "status": (d.status or "").title(),
                        "payment": (d.payment_method or "—").title(),
                        "channel": (d.source or "Direct").title(),
                    },
                ))
        except Exception:
            pass

        combined.sort(key=lambda pair: pair[0], reverse=True)
        rows = [row for _, row in combined[:500]]

        return {
            "range_label": RANGE_LABELS.get(_req.GET.get("range", "7days")),
            "rows": rows,
        }

    return JsonResponse(
        _cached_or_build(request, "orders", build, {"rows": []}),
    )


@require_GET
def customers(request):
    def build(_req):
        from account.models import Address
        from checkout.models import Order
        from dashboard.customers.models import CustomerProfile

        start, end = _resolve_dates(_req)

        first_by_cust = dict(
            Order.objects
            .filter(user__isnull=False, status__in=LIVE_ORDER_STATUSES)
            .values("user_id")
            .annotate(first=Min("created_at__date"))
            .values_list("user_id", "first")
        )

        seen = (
            Order.objects
            .filter(
                created_at__date__gte=start,
                created_at__date__lte=end,
                user__isnull=False,
            )
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
        for d in _date_range_days(start, end):
            nvr.append({
                "date": d.strftime("%b %d"),
                "newCust": new_by_day.get(d, 0),
                "returning": ret_by_day.get(d, 0),
            })

        profiles = list(
            CustomerProfile.objects
            .select_related("user")
            .order_by("-total_spent")[:10]
        )
        uids = [p.user_id for p in profiles if p.user_id]
        county_by_uid: dict = {}
        for addr in Address.objects.filter(user_id__in=uids).exclude(county="").order_by("-is_default", "-updated_at"):
            county_by_uid.setdefault(addr.user_id, addr.county)

        top_buyers = []
        for p in profiles:
            u = p.user
            name = f"{u.first_name} {u.last_name}".strip() or u.email
            orders_count = p.orders_count or 0
            spent = float(p.total_spent or 0)
            top_buyers.append({
                "customer": name,
                "email": u.email,
                "phone": u.phone or "—",
                "orders": orders_count,
                "spent": _to_int(spent),
                "aov": _to_int(spent / orders_count) if orders_count else 0,
                "lastOrder": _fmt_date(p.last_order_date),
                "county": county_by_uid.get(u.id, "—"),
            })

        return {
            "range_label": RANGE_LABELS.get(_req.GET.get("range", "7days")),
            "new_vs_returning": nvr,
            "top_buyers": top_buyers,
        }

    return JsonResponse(
        _cached_or_build(
            request, "customers", build,
            {"new_vs_returning": [], "top_buyers": []},
        ),
    )


@require_GET
def products(request):
    def build(_req):
        from catalog.models import Product
        from checkout.models import OrderItem

        start, end = _resolve_dates(_req)

        rows_qs = (
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=LIVE_ORDER_STATUSES,
            )
            .values("product_id", "name")
            .annotate(
                qty=Sum("quantity"),
                revenue=Coalesce(
                    Sum(F("unit_price") * F("quantity")),
                    Value(0), output_field=DECIMAL,
                ),
                last_sold=Max("order__created_at"),
            )
            .order_by("-revenue")[:50]
        )

        pids = [r["product_id"] for r in rows_qs if r["product_id"]]
        prod_meta = {
            p.id: {
                "sku": p.slug or "—",
                "category": p.category.name if p.category_id else "—",
            }
            for p in Product.objects.filter(id__in=pids).select_related("category")
        }

        returns_qs = (
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=REFUND_ORDER_STATUSES,
            )
            .values("product_id")
            .annotate(
                returns=Coalesce(Sum("quantity"), Value(0)),
                ret_amt=Coalesce(Sum(F("unit_price") * F("quantity")), Value(0), output_field=DECIMAL),
            )
        )
        returns_by_pid = {r["product_id"]: r for r in returns_qs}

        rows = []
        for r in rows_qs:
            meta = prod_meta.get(r["product_id"], {})
            revenue = float(r["revenue"] or 0)
            ret = returns_by_pid.get(r["product_id"], {})
            ret_cnt = _to_int(ret.get("returns", 0))
            ret_val = float(ret.get("ret_amt", 0) or 0)
            rows.append({
                "product": r["name"] or "—",
                "sku": meta.get("sku", "—"),
                "qty": r["qty"] or 0,
                "revenue": _to_int(revenue),
                "returns": ret_cnt,
                "net": _to_int(max(0.0, revenue - ret_val)),
                "category": meta.get("category", "—"),
                "lastSold": _humanize_delta(r["last_sold"]),
            })

        return {
            "range_label": RANGE_LABELS.get(_req.GET.get("range", "7days")),
            "rows": rows,
        }

    return JsonResponse(
        _cached_or_build(request, "products", build, {"rows": []}),
    )


@require_GET
def inventory(request):
    def build(_req):
        from catalog.models import Product
        from checkout.models import OrderItem

        qs = Product.objects.select_related("category").filter(is_active=True)

        reserved_by_pid = dict(
            OrderItem.objects
            .filter(order__status__in=("PENDING", "CONFIRMED", "PROCESSING"))
            .values("product_id")
            .annotate(q=Coalesce(Sum("quantity"), Value(0)))
            .values_list("product_id", "q")
        )

        total_skus = qs.count()
        low = critical = out = 0
        rows = []

        for p in qs.order_by("stock_quantity"):
            on_hand = p.stock_quantity or 0
            reserved = _to_int(reserved_by_pid.get(p.id, 0))
            available = max(0, on_hand - reserved)
            reorder = p.low_stock_threshold or 0

            if available <= 0:
                status = "Out"
                out += 1
            elif reorder and available <= reorder * 0.5:
                status = "Critical"
                critical += 1
            elif reorder and available <= reorder:
                status = "Low"
                low += 1
            else:
                status = "In Stock"

            rows.append({
                "product": p.name,
                "sku": p.sku or p.slug or f"SKU-{p.id}",
                "warehouse": "Main Warehouse",
                "onHand": on_hand,
                "reserved": reserved,
                "available": available,
                "reorderPoint": reorder,
                "status": status,
                "value": _to_int(float(p.price or 0) * on_hand),
            })

        return {
            "counts": {
                "total_skus": total_skus,
                "low": low,
                "critical": critical,
                "out": out,
            },
            "rows": rows,
        }

    return JsonResponse(
        _cached_or_build(
            request, "inventory", build,
            {"counts": {"total_skus": 0, "low": 0, "critical": 0, "out": 0}, "rows": []},
        ),
    )


@require_GET
def payments(request):
    def build(_req):
        from checkout.models import Payment

        start, end = _resolve_dates(_req)

        base = Payment.objects.filter(
            created_at__date__gte=start, created_at__date__lte=end,
        )

        def agg(qs) -> dict:
            total = qs.count()
            success = qs.filter(status=PAYMENT_SUCCESS)
            sc = success.count()

            volume = success.aggregate(
                v=Coalesce(Sum("amount"), Value(0), output_field=DECIMAL),
            )["v"] or 0
            fees = success.aggregate(
                v=Coalesce(Sum("fee"), Value(0), output_field=DECIMAL),
            )["v"] or 0

            volume_f = float(volume)
            fees_f = float(fees)
            rate = (sc / total * 100) if total else 0.0

            return {
                "transactions": sc,
                "volume": _to_int(volume_f),
                "fees": _to_int(fees_f),
                "net": _to_int(volume_f - fees_f),
                "successRate": f"{rate:.1f}%",
            }

        stk = agg(base.filter(method="MPS").exclude(checkout_request_id=""))
        stk["method"] = "M-Pesa STK Push"
        stk["provider"] = "Safaricom"

        c2b = agg(base.filter(method="MPS", checkout_request_id="").exclude(mpesa_receipt_number=""))
        c2b["method"] = "M-Pesa C2B Paybill"
        c2b["provider"] = "Safaricom"

        cod = agg(base.filter(method="COD"))
        cod["method"] = "Cash on Delivery"
        cod["provider"] = "—"

        other = agg(base.exclude(method__in=("MPS", "COD")))
        other["method"] = "Card / Other"
        other["provider"] = "Gateway"

        streams = [s for s in (stk, c2b, cod, other) if s["transactions"] > 0]

        palette = ["#10b981", "#059669", "#0284c7", "#172554"]
        share = [
            {"name": s["method"], "value": s["volume"], "color": palette[i % len(palette)]}
            for i, s in enumerate(streams)
        ]

        return {
            "range_label": RANGE_LABELS.get(_req.GET.get("range", "7days")),
            "streams": streams,
            "share": share,
        }

    return JsonResponse(
        _cached_or_build(request, "payments", build, {"streams": [], "share": []}),
    )


@require_GET
def taxes(request):
    def build(_req):
        from checkout.models import Order
        from dashboard.settings.models import TaxSettings

        tax = TaxSettings.objects.first()
        raw_rate = float(getattr(tax, "vat_rate", 0.16) or 0.16)
        vat_rate = (raw_rate / 100.0) if raw_rate > 1 else raw_rate

        today = timezone.localdate()
        month_start = today.replace(day=1)
        periods = []

        cur = month_start
        week_no = 1
        while cur <= today:
            wk_end = min(cur + timedelta(days=6), today)
            agg = (
                Order.objects
                .filter(created_at__date__gte=cur, created_at__date__lte=wk_end)
                .filter(status__in=LIVE_ORDER_STATUSES)
                .aggregate(total=Coalesce(Sum("total"), Value(0), output_field=DECIMAL))
            )
            taxable = float(agg["total"] or 0)
            vat = taxable * vat_rate / (1 + vat_rate) if vat_rate else 0.0
            periods.append({
                "period": f"{month_start.strftime('%B %Y')} (W{week_no})",
                "taxableSales": _to_int(taxable),
                "vat16": _to_int(vat),
                "net": _to_int(taxable - vat),
                "dueDate": _fmt_date(wk_end + timedelta(days=20)),
                "status": "Due",
            })
            cur = wk_end + timedelta(days=1)
            week_no += 1

        first_this = today.replace(day=1)
        prev_end = first_this - timedelta(days=1)
        prev_start = prev_end.replace(day=1)
        agg = (
            Order.objects
            .filter(created_at__date__gte=prev_start, created_at__date__lte=prev_end)
            .filter(status__in=LIVE_ORDER_STATUSES)
            .aggregate(total=Coalesce(Sum("total"), Value(0), output_field=DECIMAL))
        )
        taxable = float(agg["total"] or 0)
        vat = taxable * vat_rate / (1 + vat_rate) if vat_rate else 0.0
        due_dt = prev_end + timedelta(days=20)
        periods.append({
            "period": f"{prev_start.strftime('%B %Y')} (Full)",
            "taxableSales": _to_int(taxable),
            "vat16": _to_int(vat),
            "net": _to_int(taxable - vat),
            "dueDate": _fmt_date(due_dt),
            "status": "Filed" if taxable == 0 else ("Overdue" if due_dt < today else "Due"),
        })

        return {"rows": periods}

    return JsonResponse(
        _cached_or_build(request, "taxes", build, {"rows": []}),
    )


@require_GET
def shipping(request):
    def build(_req):
        from dashboard.shipping.models import Shipment

        start, end = _resolve_dates(_req)

        base = (
            Shipment.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end)
            .select_related("provider", "method")
        )

        totals = {
            "shipments": base.count(),
            "delivered": base.filter(status="Delivered").count(),
            "in_transit": base.filter(
                status__in=["Picked Up", "In Transit", "Out for Delivery"]
            ).count(),
            "failed": base.filter(status__in=["Failed", "Returned"]).count(),
        }

        groups: dict = defaultdict(
            lambda: {"shipments": 0, "delivered": 0, "in_transit": 0, "failed": 0, "cost": 0.0, "days": []}
        )

        for s in base:
            carrier = (
                (s.provider.name if s.provider_id else None)
                or (s.method.name if s.method_id else None)
                or "Unknown"
            )
            g = groups[carrier]
            g["shipments"] += 1
            if s.status == "Delivered":
                g["delivered"] += 1
                if s.updated_at and s.created_at and s.updated_at >= s.created_at:
                    g["days"].append((s.updated_at - s.created_at).total_seconds() / 86400.0)
            elif s.status in ("Picked Up", "In Transit", "Out for Delivery"):
                g["in_transit"] += 1
            elif s.status in ("Failed", "Returned"):
                g["failed"] += 1
            if s.method_id:
                g["cost"] += float(s.method.default_price or 0)

        rows = []
        for carrier, g in groups.items():
            shipments = g["shipments"] or 0
            delivered = g["delivered"] or 0
            on_time = (delivered / shipments * 100) if shipments else 0.0
            avg_days = round(sum(g["days"]) / len(g["days"]), 1) if g["days"] else 0.0
            rows.append({
                "carrier": carrier,
                "shipments": shipments,
                "delivered": delivered,
                "inTransit": g["in_transit"],
                "failed": g["failed"],
                "avgDays": avg_days,
                "cost": _to_int(g["cost"]),
                "onTimeRate": f"{on_time:.1f}%",
            })
        rows.sort(key=lambda r: -r["shipments"])

        return {"totals": totals, "rows": rows}

    return JsonResponse(
        _cached_or_build(
            request, "shipping", build,
            {"totals": {"shipments": 0, "delivered": 0, "in_transit": 0, "failed": 0}, "rows": []},
        ),
    )


@require_GET
def discounts(request):
    def build(_req):
        from catalog.models import Discount
        from checkout.models import Order

        today = timezone.localdate()
        qs = Discount.objects.all().order_by("-created_at")[:50]

        codes = [d.code for d in qs]
        agg_rows = (
            Order.objects
            .filter(coupon_code__in=codes, status__in=LIVE_ORDER_STATUSES)
            .values("coupon_code")
            .annotate(
                revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                discount_given=Coalesce(Sum("discount"), Value(0), output_field=DECIMAL),
            )
        )
        revenue_by_code = {r["coupon_code"]: float(r["revenue"] or 0) for r in agg_rows}
        discount_by_code = {r["coupon_code"]: float(r["discount_given"] or 0) for r in agg_rows}

        rows = []
        for d in qs:
            rev = revenue_by_code.get(d.code, 0.0)
            disc = discount_by_code.get(d.code, 0.0)
            roi = (rev / disc) if disc else 0.0

            if d.status_override == "Draft":
                status = "Scheduled"
            elif d.status_override == "Paused":
                status = "Expired"
            elif d.end_date and d.end_date.date() < today:
                status = "Expired"
            elif d.start_date and d.start_date.date() > today:
                status = "Scheduled"
            else:
                status = "Active"

            rows.append({
                "code": d.code,
                "type": f"{d.type} {d.value}".strip(),
                "uses": d.usage_count or 0,
                "discountGiven": _to_int(disc),
                "revenue": _to_int(rev),
                "roi": f"{roi:.1f}x" if roi else "—",
                "status": status,
            })

        return {"rows": rows}

    return JsonResponse(
        _cached_or_build(request, "discounts", build, {"rows": []}),
    )


@require_GET
def social(request):
    def build(_req):
        from dashboard.social.models import (
            AttributionEventType,
            PublishStatus,
            SocialAttributionEvent,
            SocialCampaign,
            SocialScheduledPost,
        )

        start, end = _resolve_dates(_req)
        days = max(1, (end - start).days + 1)
        prev_start = start - timedelta(days=days)
        prev_end = start - timedelta(days=1)

        def _plat_name(raw: str) -> str:
            low = (raw or "").lower()
            return {
                "tiktok": "TikTok",
                "instagram": "Instagram",
                "youtube": "YouTube",
                "facebook": "Facebook",
                "whatsapp": "WhatsApp",
            }.get(low, "Instagram")

        def _video_type(ct: str) -> str:
            low = (ct or "").lower()
            if "review" in low:
                return "Review"
            if "tutorial" in low:
                return "Tutorial"
            if "unbox" in low:
                return "Unboxing"
            if "compar" in low:
                return "Comparison"
            return "Demo"

        posts = list(
            SocialScheduledPost.objects
            .filter(
                Q(published_at__date__gte=start, published_at__date__lte=end)
                | Q(published_at__isnull=True, created_at__date__gte=start, created_at__date__lte=end)
            )
            .filter(status=PublishStatus.PUBLISHED)
            .select_related("content", "campaign")
            .order_by("-published_at", "-created_at")[:50]
        )
        prev_posts = SocialScheduledPost.objects.filter(
            status=PublishStatus.PUBLISHED,
            published_at__date__gte=prev_start,
            published_at__date__lte=prev_end,
        )

        attr_now = SocialAttributionEvent.objects.filter(occurred_at__date__gte=start, occurred_at__date__lte=end)
        attr_prev = SocialAttributionEvent.objects.filter(occurred_at__date__gte=prev_start, occurred_at__date__lte=prev_end)

        total_views = sum((p.views or p.reach or p.impressions or 0) for p in posts)
        prev_views = _to_int(
            prev_posts.aggregate(v=Coalesce(Sum("views"), Value(0)))["v"]
            or prev_posts.aggregate(r=Coalesce(Sum("reach"), Value(0)))["r"]
        )

        orders_now = attr_now.filter(event_type=AttributionEventType.ORDER).values("order_id").distinct().count()
        rev_now = _to_float(
            attr_now.filter(event_type=AttributionEventType.ORDER).aggregate(r=Coalesce(Sum("revenue"), Value(0), output_field=DECIMAL))["r"]
        )
        orders_prev = attr_prev.filter(event_type=AttributionEventType.ORDER).values("order_id").distinct().count()
        rev_prev = _to_float(
            attr_prev.filter(event_type=AttributionEventType.ORDER).aggregate(r=Coalesce(Sum("revenue"), Value(0), output_field=DECIMAL))["r"]
        )

        # Fallback to post-level attributed counts if no SocialAttributionEvent rows
        if orders_now == 0:
            orders_now = sum((p.attributed_orders or 0) for p in posts)
        if rev_now == 0:
            rev_now = sum(float(p.attributed_revenue or 0) for p in posts)

        video_rows = []
        plat_agg = defaultdict(lambda: {"videos": 0, "views": 0, "clicks": 0, "orders": 0, "revenue": 0.0, "spend": 0.0})
        prod_agg = defaultdict(lambda: {"product": "—", "sku": "—", "category": "—", "videos": 0, "views": 0, "orders": 0, "revenue": 0.0, "best_views": -1, "best_platform": "Instagram"})
        funnel_day = defaultdict(lambda: {"views": 0, "clicks": 0, "orders": 0, "revenue": 0.0})

        for p in posts:
            views = _to_int(p.views or p.reach or p.impressions or 0)
            clicks = _to_int(p.link_clicks or 0)
            orders = _to_int(p.attributed_orders or 0)
            rev = float(p.attributed_revenue or 0)
            plat = _plat_name(p.platform)
            spend = float(p.campaign.actual_spend or 0) if p.campaign_id and p.campaign else 0.0
            conv = (orders / clicks * 100) if clicks else ((orders / views * 100) if views else 0.0)
            ctr = (clicks / views * 100) if views else 0.0

            pub_dt = (p.published_at or p.created_at)
            pub_d = timezone.localtime(pub_dt).date() if pub_dt else start

            funnel_day[pub_d]["views"] += views
            funnel_day[pub_d]["clicks"] += clicks
            funnel_day[pub_d]["orders"] += orders
            funnel_day[pub_d]["revenue"] += rev

            plat_agg[plat]["videos"] += 1
            plat_agg[plat]["views"] += views
            plat_agg[plat]["clicks"] += clicks
            plat_agg[plat]["orders"] += orders
            plat_agg[plat]["revenue"] += rev

            video_rows.append({
                "id": str(p.pk),
                "title": (p.content_title or p.caption or f"Post #{p.pk}")[:80],
                "product": p.content.title[:40] if p.content_id and p.content else "—",
                "sku": "—",
                "category": (p.content.category.name if (p.content_id and p.content and p.content.category_id) else "—"),
                "platform": plat,
                "videoType": _video_type(p.content_type),
                "published": _fmt_date(pub_dt),
                "duration": "0:00",
                "views": views,
                "likes": _to_int(p.likes or 0),
                "comments": _to_int(p.comments or 0),
                "clicks": clicks,
                "orders": orders,
                "revenue": _to_int(rev),
                "conversionRate": f"{conv:.2f}%",
                "ctr": f"{ctr:.2f}%",
                "spend": _to_int(spend),
                "roas": f"{(rev / spend):.1f}x" if spend > 0 and rev > 0 else "—",
            })

        # Also include direct_orders ContentPost (TikTok Shop content) if present
        try:
            from dashboard.direct_orders.models import ContentPost
            for cp in ContentPost.objects.filter(created_at__date__gte=start, created_at__date__lte=end).order_by("-created_at")[:30]:
                views = _to_int(cp.views)
                orders = _to_int(cp.orders_attributed)
                rev = float(cp.revenue_attributed or 0)
                plat = _plat_name(cp.platform)
                total_views += views
                pub_d = timezone.localtime(cp.created_at).date()
                funnel_day[pub_d]["views"] += views
                funnel_day[pub_d]["orders"] += orders
                funnel_day[pub_d]["revenue"] += rev
                plat_agg[plat]["videos"] += 1
                plat_agg[plat]["views"] += views
                plat_agg[plat]["orders"] += orders
                plat_agg[plat]["revenue"] += rev
                video_rows.append({
                    "id": f"cp-{cp.pk}",
                    "title": (cp.title or cp.caption or f"Content #{cp.pk}")[:80],
                    "product": "—",
                    "sku": "—",
                    "category": "—",
                    "platform": plat,
                    "videoType": _video_type(cp.content_type),
                    "published": _fmt_date(cp.created_at),
                    "duration": "0:00",
                    "views": views,
                    "likes": _to_int(cp.likes),
                    "comments": _to_int(cp.comments),
                    "clicks": 0,
                    "orders": orders,
                    "revenue": _to_int(rev),
                    "conversionRate": f"{(orders / views * 100):.2f}%" if views else "0.00%",
                    "ctr": "0.00%",
                    "spend": 0,
                    "roas": "—",
                })
        except Exception:
            pass

        # Include SocialAttributionEvent daily clicks/orders/products
        for ev in attr_now:
            ev_d = timezone.localtime(ev.occurred_at).date()
            plat = _plat_name(ev.platform)
            if ev.event_type == AttributionEventType.VISIT:
                funnel_day[ev_d]["clicks"] += 1
                plat_agg[plat]["clicks"] += 1
            elif ev.event_type == AttributionEventType.ORDER:
                rev_v = float(ev.revenue or 0)
                funnel_day[ev_d]["orders"] += 1
                funnel_day[ev_d]["revenue"] += rev_v
                plat_agg[plat]["orders"] += 1
                plat_agg[plat]["revenue"] += rev_v
                if ev.product_id:
                    b = prod_agg[str(ev.product_id)]
                    b["product"] = str(ev.product_id)
                    b["sku"] = str(ev.product_id)
                    b["orders"] += 1
                    b["revenue"] += rev_v

        summary = {
            "videos": len(video_rows),
            "views": _to_int(total_views),
            "orders": orders_now,
            "revenue": _to_int(rev_now),
            "changes": {
                "videos": _fmt_pct_change(len(video_rows), prev_posts.count(), is_count=True),
                "views": _fmt_pct_change(total_views, prev_views),
                "orders": _fmt_pct_change(orders_now, orders_prev),
                "revenue": _fmt_pct_change(rev_now, rev_prev),
            },
        }

        platforms = []
        for plat, st in sorted(plat_agg.items(), key=lambda kv: -kv[1]["views"]):
            conv = (st["orders"] / st["views"] * 100) if st["views"] else 0.0
            platforms.append({
                "platform": plat,
                "videos": st["videos"],
                "views": st["views"],
                "clicks": st["clicks"],
                "orders": st["orders"],
                "revenue": _to_int(st["revenue"]),
                "spend": _to_int(st["spend"]),
                "roas": f"{(st['revenue'] / st['spend']):.1f}x" if st["spend"] > 0 else "—",
                "convRate": f"{conv:.2f}%",
            })

        funnel = []
        for d in _date_range_days(start, end):
            f = funnel_day.get(d, {})
            funnel.append({
                "date": d.strftime("%b %d"),
                "views": _to_int(f.get("views", 0)),
                "clicks": _to_int(f.get("clicks", 0)),
                "orders": _to_int(f.get("orders", 0)),
                "revenue": _to_int(f.get("revenue", 0)),
            })

        product_perf = [
            {
                "product": b["product"],
                "sku": b["sku"],
                "category": b["category"],
                "videos": b["videos"],
                "views": b["views"],
                "orders": b["orders"],
                "revenue": _to_int(b["revenue"]),
                "bestPlatform": b["best_platform"],
                "avgConvRate": "0.00%",
            }
            for b in sorted(prod_agg.values(), key=lambda x: -x["revenue"])[:10]
        ]

        return {
            "summary": summary,
            "funnel": funnel,
            "videos": video_rows,
            "platforms": platforms,
            "product_perf": product_perf,
        }

    return JsonResponse(
        _cached_or_build(
            request, "social", build,
            {
                "summary": {
                    "videos": 0, "views": 0, "orders": 0, "revenue": 0,
                    "changes": {"videos": "+0", "views": "+0%", "orders": "+0%", "revenue": "+0%"},
                },
                "funnel": [], "videos": [], "platforms": [], "product_perf": [],
            },
        ),
    )


@require_POST
def log_export(request):
    import json

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "Invalid JSON"}, status=400)

    tab = body.get("tab")
    fmt = body.get("format")
    range_key = body.get("range", "7days")

    if tab not in dict(ReportCache.TAB_CHOICES):
        return JsonResponse({"ok": False, "error": "Unknown tab"}, status=400)
    if fmt not in dict(ReportExportLog.FORMAT_CHOICES):
        return JsonResponse({"ok": False, "error": "Unknown format"}, status=400)

    entry = ReportExportLog.objects.create(
        tab=tab,
        range_key=range_key,
        fmt=fmt,
        user=request.user if request.user.is_authenticated else None,
    )

    ext = "xlsx" if fmt == "Excel" else fmt.lower()
    return JsonResponse({
        "ok": True,
        "id": entry.id,
        "filename": f"report-{tab}-{range_key}.{ext}",
    })


@require_POST
def refresh_cache(request):
    import json

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        body = {}

    tab = body.get("tab")
    if tab:
        if tab not in dict(ReportCache.TAB_CHOICES):
            return JsonResponse({"ok": False, "error": "Unknown tab"}, status=400)
        deleted, _ = ReportCache.objects.filter(tab=tab).delete()
    else:
        deleted, _ = ReportCache.objects.all().delete()

    return JsonResponse({"ok": True, "cleared": tab or "all", "deleted": deleted})
