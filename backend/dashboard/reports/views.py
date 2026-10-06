"""
dashboard/reports/views.py

Read-only aggregation across the shop. Reads from:
  • checkout.models        → Order, OrderItem, Payment, Coupon
  • catalog.models         → Product, Category, Brand, Discount
  • authentication.models  → User
  • dashboard.customers    → CustomerProfile
  • dashboard.settings     → TaxSettings, MpesaTransaction
  • dashboard.shipping     → Shipment, ShippingMethod, CourierConfig
  • dashboard.social       → SocialPost, SocialPostTarget
  • dashboard.inventory    → StockMovement
"""

from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Avg, Count, DecimalField, F, Max, Min, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import ReportCache, ReportExportLog


# ============================================================
# Shared constants
# ============================================================

RANGE_LABELS = {
    "today": "Today",
    "yesterday": "Yesterday",
    "7days": "Last 7 Days",
    "30days": "Last 30 Days",
    "this_month": "This Month",
    "last_month": "Last Month",
    "custom": "Custom Range",
}

# checkout.Order.status choices
LIVE_ORDER_STATUSES = ("confirmed", "processing", "shipped", "delivered")
REFUND_ORDER_STATUSES = ("returned", "cancelled", "failed")

# checkout.Payment.status choices
PAYMENT_SUCCESS = "SUCCESS"

DECIMAL = DecimalField(max_digits=14, decimal_places=2)


# ============================================================
# Helpers
# ============================================================

def _range_key(request) -> str:
    rng = request.GET.get("range", "7days")
    if rng == "custom":
        start = request.GET.get("start", "")
        end = request.GET.get("end", "")
        return f"custom:{start}..{end}"
    return rng


def _resolve_dates(request):
    rng = request.GET.get("range", "7days")
    today = timezone.now().date()

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
        except ValueError:
            start = end = today
    else:
        start, end = today - timedelta(days=6), today

    return start, end


def _cached_or_build(request, tab: str, builder, empty: dict) -> dict:
    """Cache-first; on build failure return empty + error string (not 500)."""
    key = _range_key(request)
    cached = ReportCache.objects.filter(tab=tab, range_key=key).first()
    if cached and cached.payload:
        return cached.payload

    try:
        payload = builder(request)
    except Exception as exc:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).warning(
            "reports.%s build failed: %s", tab, exc, exc_info=True
        )
        payload = dict(empty)
        payload["range_label"] = RANGE_LABELS.get(request.GET.get("range", "7days"))
        payload["error"] = str(exc)

    ReportCache.objects.update_or_create(
        tab=tab, range_key=key, defaults={"payload": payload}
    )
    return payload


def _to_int(v) -> int:
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def _fmt_date(d) -> str:
    if not d:
        return "—"
    return d.strftime("%b %d, %Y")


def _humanize_delta(dt) -> str:
    if not dt:
        return "—"
    secs = int((timezone.now() - dt).total_seconds())
    if secs < 60:
        return f"{secs}s ago"
    if secs < 3600:
        return f"{secs // 60} mins ago"
    if secs < 86400:
        return f"{secs // 3600} hours ago"
    return f"{secs // 86400} days ago"


# ============================================================
# SALES — checkout.Order + OrderItem + catalog.Product
# ============================================================

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

        # Top category per day.
        # OrderItem.product_id is a CharField → catalog.Product.id is a CharField.
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

        rows = []
        for r in daily:
            day = r["day"]
            revenue = float(r["revenue"] or 0)
            orders_count = r["orders"] or 0
            rows.append({
                "date": day.strftime("%b %d"),
                "revenue": _to_int(revenue),
                "orders": orders_count,
                "aov": _to_int(revenue / orders_count) if orders_count else 0,
                "topCategory": top_cat_by_day.get(day, "—"),
                "refunds": refunds_by_day.get(day, 0),
            })

        return {
            "range_label": RANGE_LABELS.get(_req.GET.get("range", "7days")),
            "daily": rows,
        }

    return JsonResponse(
        _cached_or_build(request, "sales", build, {"daily": []}),
    )


# ============================================================
# ORDERS — checkout.Order + OrderItem
# ============================================================

@require_GET
def orders(request):
    def build(_req):
        from checkout.models import Order

        start, end = _resolve_dates(_req)

        qs = (
            Order.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end)
            .select_related("user")
            .order_by("-created_at")[:500]
        )

        rows = []
        for o in qs:
            if o.user:
                customer = (
                    f"{o.user.first_name} {o.user.last_name}".strip()
                    or o.user.email
                )
            else:
                customer = o.contact_email or "Guest"

            rows.append({
                "id": o.reference or f"#{o.pk}",
                "date": _fmt_date(o.created_at),
                "customer": customer,
                "items": o.items.count(),
                "total": _to_int(o.total),
                "status": (o.status or "").title(),
                "payment": o.get_payment_method_display(),
                "channel": o.get_source_display(),
            })

        return {
            "range_label": RANGE_LABELS.get(_req.GET.get("range", "7days")),
            "rows": rows,
        }

    return JsonResponse(
        _cached_or_build(request, "orders", build, {"rows": []}),
    )


# ============================================================
# CUSTOMERS — authentication.User + CustomerProfile
# ============================================================

@require_GET
def customers(request):
    def build(_req):
        from checkout.models import Order
        from dashboard.customers.models import CustomerProfile

        start, end = _resolve_dates(_req)

        # First order date per customer
        first_by_cust = dict(
            Order.objects
            .filter(user__isnull=False, status__in=LIVE_ORDER_STATUSES)
            .values("user_id")
            .annotate(first=Min("created_at__date"))
            .values_list("user_id", "first")
        )

        # Distinct (day, user) pairs inside the range
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
        cur = start
        while cur <= end:
            nvr.append({
                "date": cur.strftime("%b %d"),
                "newCust": new_by_day.get(cur, 0),
                "returning": ret_by_day.get(cur, 0),
            })
            cur += timedelta(days=1)

        # Top buyers from the pre-computed CustomerProfile
        profiles = (
            CustomerProfile.objects
            .select_related("user")
            .order_by("-total_spent")[:10]
        )

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
                "county": "—",
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


# ============================================================
# PRODUCTS — OrderItem + catalog.Product
# ============================================================

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

        returns_by_pid = dict(
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=REFUND_ORDER_STATUSES,
            )
            .values("product_id")
            .annotate(returns=Count("id"))
            .values_list("product_id", "returns")
        )

        rows = []
        for r in rows_qs:
            meta = prod_meta.get(r["product_id"], {})
            revenue = float(r["revenue"] or 0)
            rows.append({
                "product": r["name"] or "—",
                "sku": meta.get("sku", "—"),
                "qty": r["qty"] or 0,
                "revenue": _to_int(revenue),
                "returns": returns_by_pid.get(r["product_id"], 0),
                "net": _to_int(revenue),
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


# ============================================================
# INVENTORY — catalog.Product
# ============================================================

@require_GET
def inventory(request):
    def build(_req):
        from catalog.models import Product

        qs = Product.objects.select_related("category").filter(is_active=True)

        total_skus = qs.count()
        low = critical = out = 0
        rows = []

        for p in qs.order_by("stock_quantity")[:200]:
            on_hand = p.stock_quantity or 0
            reserved = 0
            available = on_hand
            reorder = p.low_stock_threshold or 0

            if on_hand <= 0:
                status = "Out"
                out += 1
            elif reorder and on_hand <= reorder * 0.5:
                status = "Critical"
                critical += 1
            elif reorder and on_hand <= reorder:
                status = "Low"
                low += 1
            else:
                status = "In Stock"

            rows.append({
                "product": p.name,
                "sku": p.slug or "—",
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


# ============================================================
# PAYMENTS — checkout.Payment
# ============================================================

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

        # M-Pesa STK Push: checkout_request_id is populated
        stk = agg(
            base.filter(method="MPESA").exclude(checkout_request_id="")
        )
        stk["method"] = "M-Pesa STK Push"
        stk["provider"] = "Safaricom"

        # M-Pesa C2B: no checkout_request_id but has an M-Pesa receipt
        c2b = agg(
            base
            .filter(method="MPESA", checkout_request_id="")
            .exclude(mpesa_receipt_number="")
        )
        c2b["method"] = "M-Pesa C2B Paybill"
        c2b["provider"] = "Safaricom"

        # Cash on Delivery
        cod = agg(base.filter(method="COD"))
        cod["method"] = "Cash on Delivery"
        cod["provider"] = "—"

        streams = [s for s in (stk, c2b, cod) if s["transactions"] > 0]

        palette = ["#10b981", "#059669", "#047857", "#065f46"]
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


# ============================================================
# TAXES — checkout.Order + dashboard.settings.TaxSettings
# ============================================================

@require_GET
def taxes(request):
    def build(_req):
        from checkout.models import Order
        from dashboard.settings.models import TaxSettings

        tax = TaxSettings.objects.first()
        vat_rate = float(getattr(tax, "vat_rate", 0.16) or 0.16)

        today = timezone.now().date()
        month_start = today.replace(day=1)
        periods = []

        # Weekly buckets for the current month
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

        # Previous full month
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
        periods.append({
            "period": f"{prev_start.strftime('%B %Y')} (Full)",
            "taxableSales": _to_int(taxable),
            "vat16": _to_int(vat),
            "net": _to_int(taxable - vat),
            "dueDate": _fmt_date(prev_end + timedelta(days=20)),
            "status": "Filed",
        })

        return {"rows": periods}

    return JsonResponse(
        _cached_or_build(request, "taxes", build, {"rows": []}),
    )


# ============================================================
# SHIPPING — dashboard.shipping.Shipment
# ============================================================

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
            lambda: {"shipments": 0, "delivered": 0, "in_transit": 0, "failed": 0, "cost": 0.0}
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
            rows.append({
                "carrier": carrier,
                "shipments": shipments,
                "delivered": delivered,
                "inTransit": g["in_transit"],
                "failed": g["failed"],
                "avgDays": 0.0,
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


# ============================================================
# DISCOUNTS — catalog.Discount + checkout.Order
# ============================================================

@require_GET
def discounts(request):
    def build(_req):
        from catalog.models import Discount
        from checkout.models import Order

        today = timezone.now().date()
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


# ============================================================
# SOCIAL — dashboard.social.SocialPost + SocialPostTarget
# ============================================================

@require_GET
def social(request):
    def build(_req):
        from dashboard.social.models import SocialPost, SocialPostTarget

        start, end = _resolve_dates(_req)

        base = SocialPost.objects.filter(
            created_at__date__gte=start, created_at__date__lte=end,
        )
        targets = SocialPostTarget.objects.filter(
            post__created_at__date__gte=start,
            post__created_at__date__lte=end,
        )

        total_views = targets.aggregate(v=Coalesce(Sum("reach"), Value(0)))["v"] or 0

        summary = {
            "videos": base.count(),
            "views": _to_int(total_views),
            "orders": 0,
            "revenue": 0,
            "changes": {"videos": "+0", "views": "+0%", "orders": "+0%", "revenue": "+0%"},
        }

        # One row per post; metrics aggregated across its targets
        video_rows = []
        for p in base.order_by("-created_at")[:50]:
            post_targets = list(p.targets.all())
            views = sum(t.reach or 0 for t in post_targets)
            likes = sum(t.likes or 0 for t in post_targets)
            comments = sum(t.comments or 0 for t in post_targets)

            platform = (
                post_targets[0].get_platform_display() if post_targets else "—"
            )

            video_rows.append({
                "id": str(p.pk),
                "title": (p.caption or "")[:80] or f"Post #{p.pk}",
                "product": p.product_tag or "—",
                "sku": "—",
                "category": "—",
                "platform": platform,
                "videoType": "Demo",
                "published": _fmt_date(
                    (p.published_at or p.created_at).date()
                ),
                "duration": "0:00",
                "views": views,
                "likes": likes,
                "comments": comments,
                "clicks": 0,
                "orders": 0,
                "revenue": 0,
                "conversionRate": "0.00%",
                "ctr": "0.00%",
                "spend": 0,
                "roas": "—",
            })

        # Platform summary
        platform_qs = (
            targets
            .values("platform")
            .annotate(
                videos=Count("post", distinct=True),
                views=Coalesce(Sum("reach"), Value(0)),
            )
        )
        platforms = [
            {
                "platform": (p["platform"] or "").title(),
                "videos": p["videos"],
                "views": _to_int(p["views"]),
                "clicks": 0,
                "orders": 0,
                "revenue": 0,
                "spend": 0,
                "roas": "—",
                "convRate": "0.00%",
            }
            for p in platform_qs
        ]

        # Daily funnel
        funnel_qs = (
            targets
            .annotate(day=TruncDate("post__created_at"))
            .values("day")
            .annotate(views=Coalesce(Sum("reach"), Value(0)))
            .order_by("day")
        )
        funnel = [
            {
                "date": f["day"].strftime("%b %d"),
                "views": _to_int(f["views"]),
                "clicks": 0,
                "orders": 0,
                "revenue": 0,
            }
            for f in funnel_qs
        ]

        return {
            "summary": summary,
            "funnel": funnel,
            "videos": video_rows,
            "platforms": platforms,
            "product_perf": [],
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


# ============================================================
# EXPORT + CACHE REFRESH
# ============================================================

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

    return JsonResponse({
        "ok": True,
        "id": entry.id,
        "filename": f"report-{tab}-{range_key}.{fmt.lower()}",
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