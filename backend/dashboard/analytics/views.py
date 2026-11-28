from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.db.models import Avg, Count, DecimalField, F, Max, Min, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import AnalyticsCache

RANGE_LABELS = {
    "7days": "Last 7 Days",
    "30days": "Last 30 Days",
    "90days": "Last 90 Days",
    "year": "Year to Date",
}

LIVE_ORDER_STATUSES = ("CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED")
REFUND_STATUSES = ("RETURNED", "CANCELLED", "FAILED")
CACHE_TTL_SECONDS = 300

DECIMAL = DecimalField(max_digits=14, decimal_places=2)

SOURCE_COLORS = {
    "WhatsApp": "#10b981",
    "Website": "#0284c7",
    "Direct": "#6366f1",
    "Instagram": "#ec4899",
    "Facebook": "#0284c7",
    "TikTok": "#f59e0b",
    "YouTube": "#dc2626",
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
    "YouTube": "#dc2626",
    "Other": "#6366f1",
}

DEVICE_LABELS = {
    "mobile": ("Mobile (Android/iOS)", "#10b981"),
    "desktop": ("Desktop (Windows/Mac/Linux)", "#0284c7"),
    "tablet": ("Tablet", "#f59e0b"),
}


def _range_key(request) -> str:
    today_iso = timezone.localdate().isoformat()
    rng = request.GET.get("range", "7days")
    return f"{today_iso}:{rng}"


def _resolve_dates(request):
    rng = request.GET.get("range", "7days")
    today = timezone.localdate()
    if rng == "30days":
        start = today - timedelta(days=29)
        days = 30
    elif rng == "90days":
        start = today - timedelta(days=89)
        days = 90
    elif rng == "year":
        start = today.replace(month=1, day=1)
        days = max(1, (today - start).days + 1)
    else:
        start = today - timedelta(days=6)
        days = 7
    return start, today, days


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
    cached = AnalyticsCache.objects.filter(tab=tab, range_key=key, updated_at__gte=cutoff).first()
    if cached and cached.payload:
        return cached.payload
    try:
        payload = builder(request)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "analytics.%s build failed: %s", tab, exc, exc_info=True
        )
        payload = dict(empty)
        payload["error"] = str(exc)
        return payload
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
    if previous <= 0:
        return (100.0 if current > 0 else 0.0), True
    delta = (current - previous) / previous * 100
    return abs(delta), delta >= 0


def _fmt_delta(current: float, previous: float, lower_is_better: bool = False) -> dict:
    d, up = _pct_delta(current, previous)
    pos = (not up) if lower_is_better and previous > 0 and current != previous else up
    if current == previous == 0:
        pos = True
    return {"delta": f"{'+' if up else '-'}{d:.1f}%", "positive": pos}


def _tail7(series: list) -> list[float]:
    out = list(series[-7:]) if series else []
    while len(out) < 7:
        out.insert(0, 0.0)
    return [round(float(v or 0), 2) for v in out]


def _daily_counts(qs, date_range, field="created_at") -> list[float]:
    rows = {
        r["day"]: float(r["n"] or 0)
        for r in qs.annotate(day=TruncDate(field)).values("day").annotate(n=Count("id"))
    }
    return [rows.get(d, 0.0) for d in date_range]


def _absolutize(url: str, request=None) -> str:
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if not url.startswith("/"):
        url = "/" + url
    if request is not None:
        try:
            return request.build_absolute_uri(url)
        except Exception:
            pass
    site = getattr(settings, "SITE_URL", None)
    return f"{site.rstrip('/')}{url}" if site else url


def _image_url(obj, request=None) -> str:
    if obj is None:
        return ""

    for attr in ("image", "logo", "thumbnail", "image_url", "featured_image", "cover"):
        val = getattr(obj, attr, None)
        if not val:
            continue
        try:
            url = val.url
        except (ValueError, AttributeError):
            url = val if isinstance(val, str) else ""
        if url:
            return _absolutize(url, request)

    images = getattr(obj, "images", None)
    if images is not None and hasattr(images, "all"):
        try:
            qs = images.all()
            if hasattr(images.model, "is_primary"):
                qs = qs.order_by("-is_primary", "sort_order", "id")
            elif hasattr(images.model, "sort_order"):
                qs = qs.order_by("sort_order", "id")
            first = qs.first()
            if first is not None:
                for attr in ("image", "external_url", "file", "photo", "url"):
                    val = getattr(first, attr, None)
                    if not val:
                        continue
                    try:
                        url = val.url
                    except (ValueError, AttributeError):
                        url = val if isinstance(val, str) else ""
                    if url:
                        return _absolutize(url, request)
        except Exception:
            pass

    return ""


def _bounce_and_duration(pv_qs, session_rows, date_range):
    total_sess = len(session_rows) or 1
    bounces = sum(1 for s in session_rows if s["n"] == 1)
    bounce_now = round(bounces / total_sess * 100, 1)

    durations = []
    daily_durations = defaultdict(list)
    for s in session_rows[:200]:
        rows = list(
            pv_qs.filter(session_key=s["session_key"]).order_by("created_at")
        )
        if len(rows) >= 2:
            dur = (rows[-1].created_at - rows[0].created_at).total_seconds()
            durations.append(dur)
            daily_durations[timezone.localtime(rows[0].created_at).date()].append(dur)
    duration_now = (sum(durations) / len(durations)) if durations else 0.0

    session_first_day = dict(
        pv_qs.values("session_key")
        .annotate(first=Min("created_at__date"))
        .values_list("session_key", "first")
    )
    daily_stats = defaultdict(lambda: {"total": 0, "bounced": 0})
    for s in session_rows:
        day = session_first_day.get(s["session_key"])
        if day is None:
            continue
        daily_stats[day]["total"] += 1
        if s["n"] == 1:
            daily_stats[day]["bounced"] += 1

    bounce_series_full = []
    for d in date_range:
        stats = daily_stats.get(d)
        if stats and stats["total"] > 0:
            bounce_series_full.append(round(stats["bounced"] / stats["total"] * 100, 1))
        else:
            bounce_series_full.append(0.0)

    duration_series_full = []
    for d in date_range:
        vals = daily_durations.get(d, [])
        duration_series_full.append(
            round((sum(vals) / len(vals)) / 60, 1) if vals else 0.0
        )

    return bounce_now, duration_now, bounce_series_full, duration_series_full


def _cart_abandonment(start, end, order_count):
    from checkout.models import Cart, CartItem
    try:
        carts_qs = (
            Cart.objects
            .filter(updated_at__date__gte=start, updated_at__date__lte=end)
            .annotate(item_count=Count("items"))
            .filter(item_count__gt=0)
        )
        n_carts = carts_qs.count()
        if not n_carts:
            return {"rate": 0.0, "potential_lost": 0}

        cart_ids = list(carts_qs.values_list("id", flat=True))
        lost = (
            CartItem.objects
            .filter(cart_id__in=cart_ids)
            .aggregate(
                t=Coalesce(
                    Sum(F("unit_price") * F("quantity")),
                    Value(0),
                    output_field=DECIMAL,
                )
            )["t"] or 0
        )

        denom = n_carts + order_count
        rate = round(n_carts / denom * 100, 1) if denom else 0.0
        return {"rate": rate, "potential_lost": int(lost)}
    except Exception:
        return {"rate": 0.0, "potential_lost": 0}


def _abandoned_carts_payload(start, end, request):
    from checkout.models import Cart

    try:
        carts = list(
            Cart.objects
            .filter(updated_at__date__gte=start, updated_at__date__lte=end)
            .annotate(item_count=Count("items"))
            .filter(item_count__gt=0)
            .select_related("user")
            .prefetch_related("items")
            .order_by("-updated_at")[:50]
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "analytics.abandoned_carts query failed: %s", exc, exc_info=True
        )
        return []

    out = []
    for c in carts:
        try:
            items = list(c.items.all())
            if not items:
                continue

            names = []
            images = []
            total_value = 0.0

            for it in items:
                item_name = (
                    getattr(it, "name", None)
                    or getattr(getattr(it, "product", None), "name", None)
                    or "—"
                )
                names.append(item_name)

                qty = _to_int(getattr(it, "quantity", 0)) or 0
                unit = _to_float(getattr(it, "unit_price", 0)) or 0.0
                total_value += unit * max(qty, 1)

                raw_img = getattr(it, "image", None) or ""
                img = _absolutize(raw_img, request) if raw_img else ""
                if img:
                    images.append(img)

            extra = max(0, len(items) - 3)
            summary = ", ".join(names[:3])
            if extra:
                summary = f"{summary} +{extra} more"

            user = getattr(c, "user", None)
            if user and (getattr(user, "first_name", "") or getattr(user, "last_name", "")):
                customer = f"{user.first_name} {user.last_name}".strip()
            elif user and getattr(user, "email", ""):
                customer = user.email
            else:
                customer = "Guest"

            phone = getattr(user, "phone", "") if user else ""
            updated = timezone.localtime(c.updated_at) if getattr(c, "updated_at", None) else None

            out.append({
                "id": f"AC-{c.id}",
                "cart_id": c.id,
                "customer": customer or "Guest",
                "phone": phone,
                "items": summary or "—",
                "item_count": len(items),
                "item_names": names[:3],
                "images": images[:3],
                "value_raw": int(total_value),
                "value": f"KES {int(total_value):,}",
                "time": updated.strftime("%H:%M") if updated else "—",
                "date": updated.strftime("%b %d") if updated else "—",
                "iso_date": updated.date().isoformat() if updated else None,
                "user_id": user.id if user else None,
                "email": getattr(user, "email", "") if user else "",
                "abandoned_at": (
                    c.abandoned_at.isoformat()
                    if getattr(c, "abandoned_at", None) else None
                ),
            })
        except Exception:
            continue

    return out


def _refunds_total_for_range(start, end) -> float:
    total = 0.0
    try:
        from dashboard.returns.models import Refund
        total += _to_float(
            Refund.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end)
            .exclude(status__iexact="failed")
            .aggregate(t=Coalesce(Sum("amount"), Value(0), output_field=DECIMAL))["t"]
        )
    except Exception:
        pass
    if total == 0.0:
        try:
            from checkout.models import Order
            total += _to_float(
                Order.objects
                .filter(created_at__date__gte=start, created_at__date__lte=end, status="RETURNED")
                .aggregate(t=Coalesce(Sum("total"), Value(0), output_field=DECIMAL))["t"]
            )
        except Exception:
            pass
    return total


@require_GET
def traffic(request):
    def build(_req):
        from checkout.models import Cart, Order
        from dashboard.analytics.models import PageView

        start, end, days = _resolve_dates(_req)
        prev_start = start - timedelta(days=days)
        prev_end = start - timedelta(days=1)
        date_range = _date_range_days(start, end)

        all_orders_now = Order.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
        orders_now = all_orders_now.filter(status__in=LIVE_ORDER_STATUSES)
        orders_prev = Order.objects.filter(
            created_at__date__gte=prev_start,
            created_at__date__lte=prev_end,
            status__in=LIVE_ORDER_STATUSES,
        )
        order_count = orders_now.count()
        prev_order_count = orders_prev.count()

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
            non_empty_sess = pv_now.exclude(session_key="").values("session_key").distinct().count()
            sessions_now = non_empty_sess or max(1, pv_now.values("user_id").distinct().count())
            visitors_now = max(sessions_now, order_count)
            pageviews_now = pv_now_count
        else:
            distinct_users = orders_now.exclude(user_id=None).values("user_id").distinct().count()
            visitors_now = max(distinct_users, order_count)
            sessions_now = visitors_now
            pageviews_now = 0

        if pv_prev_count > 0:
            non_empty_prev = pv_prev.exclude(session_key="").values("session_key").distinct().count()
            sessions_prev = non_empty_prev or max(1, pv_prev.values("user_id").distinct().count())
            visitors_prev = max(sessions_prev, prev_order_count)
            pageviews_prev = pv_prev_count
        else:
            distinct_users_prev = orders_prev.exclude(user_id=None).values("user_id").distinct().count()
            visitors_prev = max(distinct_users_prev, prev_order_count)
            sessions_prev = visitors_prev
            pageviews_prev = 0

        conv_now = (order_count / sessions_now * 100) if sessions_now else 0.0
        conv_prev = (prev_order_count / sessions_prev * 100) if sessions_prev else 0.0

        bounce_now = 0.0
        duration_now = 0.0
        bounce_prev = 0.0
        duration_prev = 0.0
        bounce_series_full = []
        duration_series_full = []

        if has_real_pv:
            session_rows = list(pv_now.exclude(session_key="").values("session_key").annotate(n=Count("id")))
            if session_rows:
                bounce_now, duration_now, bounce_series_full, duration_series_full = (
                    _bounce_and_duration(pv_now, session_rows, date_range)
                )

        if pv_prev_count > 0:
            prev_session_rows = list(pv_prev.exclude(session_key="").values("session_key").annotate(n=Count("id")))
            if prev_session_rows:
                prev_date_range = _date_range_days(prev_start, prev_end)
                bounce_prev, duration_prev, _, _ = (
                    _bounce_and_duration(pv_prev, prev_session_rows, prev_date_range)
                )

        if bounce_prev > 0:
            bounce_delta = abs((bounce_now - bounce_prev) / bounce_prev * 100)
            bounce_positive = bounce_now <= bounce_prev
        else:
            bounce_delta = 0.0
            bounce_positive = True

        if duration_prev > 0:
            duration_delta = abs((duration_now - duration_prev) / duration_prev * 100)
            duration_positive = duration_now >= duration_prev
        else:
            duration_delta = 0.0
            duration_positive = True

        bounce_series = _tail7(bounce_series_full) if has_real_pv else [0.0] * 7
        duration_series = _tail7(duration_series_full) if has_real_pv else [0.0] * 7

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

        bounce_value = f"{bounce_now:.1f}%" if has_real_pv else "—"
        duration_value = (
            f"{int(duration_now) // 60}m {int(duration_now) % 60}s"
            if has_real_pv and duration_now > 0 else "—"
        )

        daily_pv_spark = _tail7(_daily_counts(pv_now, date_range)) if has_real_pv else _tail7(_daily_counts(orders_now, date_range))
        daily_ord_spark = _tail7(_daily_counts(orders_now, date_range))

        kpis = [
            kpi("sessions", "Sessions", f"{sessions_now:,}", s_delta, s_pos,
                daily_pv_spark, "Total user sessions across the storefront."),
            kpi("visitors", "Unique Visitors", f"{visitors_now:,}", v_delta, v_pos,
                daily_pv_spark, "Distinct visitors in the selected range."),
            kpi("pageviews", "Page Views", f"{pageviews_now:,}", p_delta, p_pos,
                daily_pv_spark, "Total page views across all storefront pages."),
            kpi("bounce", "Bounce Rate", bounce_value, bounce_delta, bounce_positive,
                bounce_series, "Sessions that left without interacting beyond the landing page."),
            kpi("duration", "Avg. Duration", duration_value, duration_delta, duration_positive,
                duration_series, "Average time spent per session."),
            kpi("conversion", "Conversion Rate", f"{conv_now:.2f}%", c_delta, c_pos,
                daily_ord_spark, "Percentage of sessions that completed a purchase."),
        ]

        if has_real_pv:
            daily = (
                pv_now.annotate(day=TruncDate("created_at"))
                .values("day")
                .annotate(views=Count("id"), visitors=Count("session_key", distinct=True))
                .order_by("day")
            )
            pv_by_day = {row["day"]: row for row in daily}
            timeline = []
            for d in date_range:
                row = pv_by_day.get(d)
                vis = (row["visitors"] if row else 0) or 0
                timeline.append({
                    "date": d.strftime("%b %d"),
                    "sessions": vis,
                    "visitors": vis,
                    "pageviews": (row["views"] if row else 0) or 0,
                })
        else:
            daily = (
                orders_now.annotate(day=TruncDate("created_at"))
                .values("day").annotate(orders=Count("id")).order_by("day")
            )
            ord_by_day = {row["day"]: row for row in daily}
            timeline = []
            for d in date_range:
                row = ord_by_day.get(d)
                o = (row["orders"] if row else 0) or 0
                timeline.append({
                    "date": d.strftime("%b %d"),
                    "sessions": o,
                    "visitors": o,
                    "pageviews": 0,
                })

        source_map = {
            "whatsapp": "WhatsApp", "web": "Website", "app": "App",
            "api": "API", "admin": "Direct", "in_store": "In Store", "phone": "Direct",
        }
        source_qs = (
            orders_now.values("source").annotate(
                orders=Count("id"),
                revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
            )
        )
        totals_by_label = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
        for r in source_qs:
            label = source_map.get(r["source"], "Other")
            totals_by_label[label]["orders"] += r["orders"] or 0
            totals_by_label[label]["revenue"] += _to_float(r["revenue"])

        total_source_orders = sum(t["orders"] for t in totals_by_label.values()) or 1

        sources = []
        for label, t in totals_by_label.items():
            share = round(t["orders"] / total_source_orders * 100)
            sources.append({
                "name": label,
                "value": share,
                "color": SOURCE_COLORS.get(label, "#94a3b8"),
                "visits": t["orders"],
                "orders": t["orders"],
                "revenue": f"KES {_to_int(t['revenue']):,}",
            })
        if not sources:
            sources = [{
                "name": "Website", "value": 100,
                "color": SOURCE_COLORS["Website"],
                "visits": 0, "orders": 0, "revenue": "KES 0",
            }]

        # Real Funnel from PageView + Cart + Order
        active_carts_cnt = (
            Cart.objects
            .filter(updated_at__date__gte=start, updated_at__date__lte=end)
            .annotate(ic=Count("items"))
            .filter(ic__gt=0)
            .count()
        )
        checkout_cnt = max(order_count, all_orders_now.count())
        add_to_cart_cnt = max(checkout_cnt, active_carts_cnt + checkout_cnt)
        if has_real_pv:
            pv_prod = pv_now.filter(Q(path__icontains="/product") | Q(path__icontains="/shop")).values("session_key").distinct().count()
            prod_view_cnt = max(add_to_cart_cnt, pv_prod)
            visited_cnt = max(prod_view_cnt, visitors_now)
        else:
            prod_view_cnt = add_to_cart_cnt
            visited_cnt = max(prod_view_cnt, visitors_now)

        def _drop(cur_n: int, prev_n: int) -> str:
            if prev_n <= 0:
                return "—"
            pct = (cur_n - prev_n) / prev_n * 100
            return f"{pct:.1f}%"

        stages = []
        if visited_cnt > 0:
            stages = [
                {"stage": "Visited Store", "count": visited_cnt, "dropoff": "—",
                 "breakdown": [{"source": s["name"], "users": int(visited_cnt * s["value"] / 100)} for s in sources]},
                {"stage": "Product View", "count": prod_view_cnt, "dropoff": _drop(prod_view_cnt, visited_cnt),
                 "breakdown": [{"source": s["name"], "users": int(prod_view_cnt * s["value"] / 100)} for s in sources]},
                {"stage": "Add to Cart", "count": add_to_cart_cnt, "dropoff": _drop(add_to_cart_cnt, prod_view_cnt),
                 "breakdown": [{"source": s["name"], "users": int(add_to_cart_cnt * s["value"] / 100)} for s in sources]},
                {"stage": "Checkout Initiated", "count": checkout_cnt, "dropoff": _drop(checkout_cnt, add_to_cart_cnt),
                 "breakdown": [{"source": s["name"], "users": int(checkout_cnt * s["value"] / 100)} for s in sources]},
                {"stage": "Purchased", "count": order_count, "dropoff": _drop(order_count, checkout_cnt),
                 "breakdown": [{"source": s["name"], "users": int(order_count * s["value"] / 100)} for s in sources]},
            ]

        devices = []
        if has_real_pv:
            dv_qs = list(
                pv_now.values("device_type")
                .annotate(users=Count("session_key", distinct=True), views=Count("id"))
            )
            total_dev = sum((r["users"] or r["views"]) for r in dv_qs) or 1
            for r in dv_qs:
                key = (r["device_type"] or "desktop").lower()
                label, color = DEVICE_LABELS.get(key, (key.title(), "#94a3b8"))
                users = r["users"] or r["views"] or 0
                devices.append({
                    "device": label,
                    "users": users,
                    "fill": color,
                    "sessions": users,
                    "convRate": f"{(order_count / total_dev * 100):.1f}%",
                    "bounce": "—",
                })
            order_map = {"mobile": 0, "desktop": 1, "tablet": 2}
            devices.sort(key=lambda d: order_map.get(d["device"].split()[0].lower(), 9))

        counties = []
        try:
            ord_county_qs = list(
                orders_now.exclude(address_county="")
                .values("address_county")
                .annotate(
                    orders=Count("id"),
                    revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
                    visitors=Count("user", distinct=True),
                )
                .order_by("-orders")[:5]
            )
            if ord_county_qs:
                tot_c = sum(r["orders"] for r in ord_county_qs) or 1
                for r in ord_county_qs:
                    counties.append({
                        "county": r["address_county"],
                        "share": round(r["orders"] / tot_c * 100),
                        "visitors": r["visitors"] or r["orders"],
                        "orders": r["orders"],
                        "revenue": f"KES {_to_int(r['revenue']):,}",
                    })
            else:
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
                    counties.append({
                        "county": cty,
                        "share": round(r["users"] / total_addrs * 100),
                        "visitors": r["users"],
                        "orders": 0,
                        "revenue": "KES 0",
                    })
        except Exception:
            counties = []

        abandoned = _abandoned_carts_payload(start, end, _req)
        cart_abandonment = _cart_abandonment(start, end, order_count)

        trend_by_day = defaultdict(int)
        for c in abandoned:
            if c.get("iso_date"):
                trend_by_day[c["iso_date"]] += 1
        abandoned_trend = [
            {
                "date": d.strftime("%b %d"),
                "carts": trend_by_day.get(d.isoformat(), 0),
                "iso_date": d.isoformat(),
            }
            for d in date_range
        ]

        return {
            "kpis": kpis,
            "sessions_timeline": timeline,
            "sources": sources,
            "funnel": stages,
            "devices": devices,
            "counties": counties,
            "abandoned_carts": abandoned,
            "abandoned_trend": abandoned_trend,
            "cart_abandonment": cart_abandonment,
        }

    return JsonResponse(_cached_or_build(
        request, "traffic", build,
        {"kpis": [], "sessions_timeline": [], "sources": [], "funnel": [],
         "devices": [], "counties": [], "abandoned_carts": [], "abandoned_trend": [],
         "cart_abandonment": {"rate": 0.0, "potential_lost": 0}},
    ))


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
                discounts=Coalesce(Sum("discount"), Value(0), output_field=DECIMAL),
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
        discounts = _to_float(now["discounts"])
        refunds = _refunds_total_for_range(start, end)
        prev_refunds = _refunds_total_for_range(prev_start, prev_end)
        net = max(0.0, gross - refunds)
        prev_net = max(0.0, prev_gross - prev_refunds)

        aov = (gross / orders) if orders else 0.0
        prev_aov = (prev_gross / prev_orders) if prev_orders else 0.0
        growth, growth_pos = _pct_delta(gross, prev_gross)

        summary = {
            "gross": int(gross),
            "net": int(net),
            "refunds": int(refunds),
            "discounts": int(discounts),
            "orders": orders,
            "aov": int(aov),
            "revenueGrowth": round(growth, 1) if growth_pos else -round(growth, 1),
            "deltas": {
                "gross": _fmt_delta(gross, prev_gross),
                "net": _fmt_delta(net, prev_net),
                "refunds": _fmt_delta(refunds, prev_refunds, lower_is_better=True),
                "orders": _fmt_delta(orders, prev_orders),
                "aov": _fmt_delta(aov, prev_aov),
                "revenueGrowth": {"delta": f"{'+' if growth_pos else '-'}{round(growth, 1)}%", "positive": growth_pos},
            },
        }

        daily = (
            Order.objects
            .filter(created_at__date__gte=start, created_at__date__lte=end,
                    status__in=LIVE_ORDER_STATUSES)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(
                gross=Coalesce(Sum("total"), Value(0), output_field=DECIMAL),
            )
            .order_by("day")
        )
        ord_by_day = {row["day"]: row for row in daily}
        ref_by_day = {
            row["day"]: _to_int(row["r"])
            for row in Order.objects.filter(
                created_at__date__gte=start, created_at__date__lte=end,
                status__in=REFUND_STATUSES,
            ).annotate(day=TruncDate("created_at")).values("day").annotate(
                r=Coalesce(Sum("total"), Value(0), output_field=DECIMAL)
            )
        }
        trend = []
        for d in _date_range_days(start, end):
            row = ord_by_day.get(d)
            g = _to_int(row["gross"]) if row else 0
            r = ref_by_day.get(d, 0)
            trend.append({
                "date": d.strftime("%b %d"),
                "gross": g,
                "net": max(0, g - r),
                "refunds": r,
            })

        all_items_now = list(
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=LIVE_ORDER_STATUSES,
            )
            .values("product_id", "name")
            .annotate(
                revenue=Coalesce(Sum(F("unit_price") * F("quantity")), Value(0), output_field=DECIMAL),
                orders=Count("order", distinct=True),
                units=Sum("quantity"),
            )
            .order_by("-revenue")
        )
        prev_items_rev = dict(
            OrderItem.objects
            .filter(
                order__created_at__date__gte=prev_start,
                order__created_at__date__lte=prev_end,
                order__status__in=LIVE_ORDER_STATUSES,
            )
            .values("product_id")
            .annotate(rev=Coalesce(Sum(F("unit_price") * F("quantity")), Value(0), output_field=DECIMAL))
            .values_list("product_id", "rev")
        )

        pids = [r["product_id"] for r in all_items_now if r["product_id"]]
        product_meta = {
            p.id: {
                "image": _image_url(p, _req),
                "category_name": p.category.name if p.category_id else None,
                "brand_name": p.brand.name if p.brand_id else None,
            }
            for p in Product.objects.filter(id__in=pids).select_related("category", "brand")
        }

        by_product = []
        for r in all_items_now[:10]:
            meta = product_meta.get(r["product_id"], {})
            cur_r = _to_float(r["revenue"])
            prv_r = _to_float(prev_items_rev.get(r["product_id"], 0))
            gd, gp = _pct_delta(cur_r, prv_r)
            by_product.append({
                "name": r["name"] or "—",
                "revenue": _to_int(cur_r),
                "orders": r["orders"] or 0,
                "units": r["units"] or 0,
                "growth": round(gd, 1) if gp else -round(gd, 1),
                "image": meta.get("image") or "",
            })

        cat_totals = defaultdict(lambda: {"revenue": 0, "orders": 0, "units": 0})
        brand_totals = defaultdict(lambda: {"revenue": 0, "orders": 0, "units": 0})
        for r in all_items_now:
            meta = product_meta.get(r["product_id"], {})
            cat = meta.get("category_name") or "Other"
            cat_totals[cat]["revenue"] += _to_int(r["revenue"])
            cat_totals[cat]["orders"] += r["orders"] or 0
            cat_totals[cat]["units"] += r["units"] or 0
            br = meta.get("brand_name") or "Other"
            brand_totals[br]["revenue"] += _to_int(r["revenue"])
            brand_totals[br]["orders"] += r["orders"] or 0
            brand_totals[br]["units"] += r["units"] or 0

        cat_objs = {c.name: c for c in Category.objects.filter(name__in=cat_totals.keys())}
        palette = ["#10b981", "#0284c7", "#6366f1", "#f59e0b", "#ec4899"]
        by_category = [
            {
                "name": k,
                "revenue": v["revenue"],
                "orders": v["orders"],
                "units": v["units"],
                "growth": 0,
                "color": palette[i % len(palette)],
                "image": _image_url(cat_objs.get(k), _req),
            }
            for i, (k, v) in enumerate(sorted(
                cat_totals.items(), key=lambda kv: -kv[1]["revenue"]
            )[:5])
        ]

        brand_objs = {b.name: b for b in Brand.objects.filter(name__in=brand_totals.keys())}
        by_brand = [
            {
                "name": k,
                "revenue": v["revenue"],
                "orders": v["orders"],
                "units": v["units"],
                "growth": 0,
                "color": ["#172554", "#10b981", "#0284c7", "#f59e0b", "#ec4899"][i % 5],
                "image": _image_url(brand_objs.get(k), _req),
            }
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


@require_GET
def customers(request):
    def build(_req):
        from checkout.models import Order
        from dashboard.customers.models import CustomerProfile

        start, end, days = _resolve_dates(_req)
        prev_start = start - timedelta(days=days)
        prev_end = start - timedelta(days=1)

        first_by_cust = dict(
            Order.objects
            .filter(user__isnull=False, status__in=LIVE_ORDER_STATUSES)
            .values("user_id")
            .annotate(first=Min("created_at__date"))
            .values_list("user_id", "first")
        )

        def split_new_ret(s, e):
            seen = (
                Order.objects
                .filter(created_at__date__gte=s, created_at__date__lte=e, user__isnull=False)
                .values("created_at__date", "user_id")
                .distinct()
            )
            n_day = defaultdict(int)
            r_day = defaultdict(int)
            for r in seen:
                day = r["created_at__date"]
                uid = r["user_id"]
                if first_by_cust.get(uid) == day:
                    n_day[day] += 1
                else:
                    r_day[day] += 1
            return n_day, r_day

        new_by_day, ret_by_day = split_new_ret(start, end)
        prev_new_day, prev_ret_day = split_new_ret(prev_start, prev_end)

        nvr = []
        for d in _date_range_days(start, end):
            nvr.append({
                "date": d.strftime("%b %d"),
                "new": new_by_day.get(d, 0),
                "returning": ret_by_day.get(d, 0),
            })

        total_new = sum(new_by_day.values())
        total_ret = sum(ret_by_day.values())
        total_cust = total_new + total_ret
        retention = (total_ret / total_cust * 100) if total_cust else 0.0

        prev_new = sum(prev_new_day.values())
        prev_ret = sum(prev_ret_day.values())
        prev_tot = prev_new + prev_ret
        prev_ret_rate = (prev_ret / prev_tot * 100) if prev_tot else 0.0

        profiles_qs = CustomerProfile.objects.all()
        ltv_avg = profiles_qs.aggregate(a=Avg("total_spent"))["a"] or 0
        orders_total = profiles_qs.aggregate(s=Sum("orders_count"))["s"] or 0
        spend_total = profiles_qs.aggregate(s=Sum("total_spent"))["s"] or 0
        aov_avg = (float(spend_total) / orders_total) if orders_total else 0.0

        marketing_spend = 0.0
        try:
            from dashboard.social.models import SocialCampaign
            marketing_spend += _to_float(
                SocialCampaign.objects.filter(start_date__lte=end, end_date__gte=start)
                .aggregate(s=Coalesce(Sum("actual_spend"), Value(0), output_field=DECIMAL))["s"]
            )
        except Exception:
            pass
        try:
            from dashboard.whatsapp.models import WhatsAppMessagingCost
            marketing_spend += _to_float(
                WhatsAppMessagingCost.objects.filter(date__gte=start, date__lte=end)
                .aggregate(s=Coalesce(Sum("cost"), Value(0), output_field=DECIMAL))["s"]
            )
        except Exception:
            pass
        cac = int(marketing_spend / total_new) if total_new > 0 and marketing_spend > 0 else 0

        d_new = _fmt_delta(total_new, prev_new)
        d_ret = _fmt_delta(total_ret, prev_ret)
        d_rate = _fmt_delta(retention, prev_ret_rate)

        metrics = [
            {"id": "new", "label": "New Customers", "value": f"{total_new:,}",
             "delta": d_new["delta"], "positive": d_new["positive"],
             "detail": "First-time buyers this period."},
            {"id": "returning", "label": "Returning Customers", "value": f"{total_ret:,}",
             "delta": d_ret["delta"], "positive": d_ret["positive"],
             "detail": "Customers with 2+ purchases."},
            {"id": "retention", "label": "Retention Rate", "value": f"{retention:.1f}%",
             "delta": d_rate["delta"], "positive": d_rate["positive"],
             "detail": "Customers who purchased again within the range."},
            {"id": "ltv", "label": "Customer LTV", "value": f"KES {int(ltv_avg):,}",
             "delta": "+0.0%", "positive": True,
             "detail": "Average lifetime value per customer."},
            {"id": "aov", "label": "Avg. Spend / Order", "value": f"KES {int(aov_avg):,}",
             "delta": "+0.0%", "positive": True,
             "detail": "Average order value across all customers."},
            {"id": "acq", "label": "Acquisition Cost", "value": f"KES {cac:,}",
             "delta": "+0.0%", "positive": True,
             "detail": "Blended campaign & messaging spend per new buyer."},
        ]

        top = profiles_qs.select_related("user").order_by("-total_spent")[:10]
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


@require_GET
def products(request):
    def build(_req):
        from catalog.models import Product
        from checkout.models import OrderItem

        start, end, _days = _resolve_dates(_req)

        perf_qs = (
            OrderItem.objects
            .filter(
                order__created_at__date__gte=start,
                order__created_at__date__lte=end,
                order__status__in=LIVE_ORDER_STATUSES,
            )
            .values("product_id", "name")
            .annotate(
                purchases=Sum("quantity"),
                revenue=Coalesce(Sum(F("unit_price") * F("quantity")), Value(0), output_field=DECIMAL),
            )
            .order_by("-revenue")[:30]
        )

        pids = [r["product_id"] for r in perf_qs if r["product_id"]]
        product_meta = {
            p.id: {
                "sku": p.slug or "—",
                "image": _image_url(p, _req),
                "stock": p.stock_quantity or 0,
                "views": getattr(p, "views_count", 0) or 0,
                "category": p.category.name if p.category_id else "—",
            }
            for p in Product.objects.filter(id__in=pids).select_related("category")
        }

        rows = []
        for r in perf_qs:
            meta = product_meta.get(r["product_id"], {})
            purchases = r["purchases"] or 0
            views = max(meta.get("views", 0), purchases)
            revenue = _to_int(r["revenue"])
            stock = meta.get("stock", 0)
            conversion = (purchases / views * 100) if views else 0.0

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
                "image": meta.get("image") or "",
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
        best_seller = next((r for r in rows if r["status"] == "best"), None) or most_purchased

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


@require_GET
def channels(request):
    def build(_req):
        from checkout.models import Order

        start, end, _days = _resolve_dates(_req)

        source_map = {
            "whatsapp": "WhatsApp", "web": "Website", "app": "App",
            "api": "API", "admin": "Other", "in_store": "Other", "phone": "Other",
            "instagram": "Instagram", "facebook": "Facebook", "tiktok": "TikTok", "youtube": "YouTube",
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

        totals_by_label = defaultdict(lambda: {"orders": 0, "revenue": 0.0, "visits": 0})
        for r in qs:
            label = source_map.get((r["source"] or "").lower(), "Other")
            totals_by_label[label]["orders"] += r["orders"] or 0
            totals_by_label[label]["revenue"] += _to_float(r["revenue"])

        # Include Direct / TikTok Shop orders
        try:
            from dashboard.direct_orders.models import DirectOrder
            do_qs = (
                DirectOrder.objects
                .filter(created_at__date__gte=start, created_at__date__lte=end)
                .exclude(status__in=("CANCELLED", "cancelled", "FAILED", "failed", "RETURNED", "returned"))
                .values("source")
                .annotate(orders=Count("id"), revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL))
            )
            for r in do_qs:
                src = (r["source"] or "tiktok").lower()
                label = source_map.get(src, "TikTok" if "tiktok" in src else "Other")
                totals_by_label[label]["orders"] += r["orders"] or 0
                totals_by_label[label]["revenue"] += _to_float(r["revenue"])
        except Exception:
            pass

        # Include WhatsApp Commerce orders
        try:
            from dashboard.whatsapp.models import WhatsAppOrder
            wa_agg = (
                WhatsAppOrder.objects
                .filter(created_at__date__gte=start, created_at__date__lte=end)
                .exclude(status__in=("CANCELLED", "cancelled", "FAILED", "failed"))
                .aggregate(orders=Count("id"), revenue=Coalesce(Sum("total"), Value(0), output_field=DECIMAL))
            )
            if wa_agg["orders"]:
                totals_by_label["WhatsApp"]["orders"] += wa_agg["orders"]
                totals_by_label["WhatsApp"]["revenue"] += _to_float(wa_agg["revenue"])
        except Exception:
            pass

        # Include Social attribution visits & orders
        social_visits = defaultdict(int)
        social_orders = defaultdict(int)
        social_rev = defaultdict(float)
        try:
            from dashboard.social.models import AttributionEventType, SocialAttributionEvent
            attr_qs = SocialAttributionEvent.objects.filter(
                occurred_at__date__gte=start, occurred_at__date__lte=end
            )
            for r in attr_qs.values("platform", "event_type").annotate(
                cnt=Count("id"),
                rev=Coalesce(Sum("revenue"), Value(0), output_field=DECIMAL),
            ):
                label = source_map.get((r["platform"] or "").lower(), (r["platform"] or "Other").title())
                if r["event_type"] == AttributionEventType.VISIT:
                    social_visits[label] += r["cnt"] or 0
                elif r["event_type"] == AttributionEventType.ORDER:
                    social_orders[label] += r["cnt"] or 0
                    social_rev[label] += _to_float(r["rev"])
        except Exception:
            pass

        for lbl, vcnt in social_visits.items():
            totals_by_label[lbl]["visits"] += vcnt
        for lbl, ocnt in social_orders.items():
            if totals_by_label[lbl]["orders"] == 0:
                totals_by_label[lbl]["orders"] += ocnt
                totals_by_label[lbl]["revenue"] += social_rev[lbl]

        total_orders = sum(t["orders"] for t in totals_by_label.values()) or 1

        rows = []
        for label, t in sorted(totals_by_label.items(), key=lambda kv: -kv[1]["orders"]):
            share = round(t["orders"] / total_orders * 100)
            revenue = _to_int(t["revenue"])
            visitors = t["visits"] or t["orders"]
            conv = (t["orders"] / visitors * 100) if visitors else 0.0
            rows.append({
                "name": label,
                "share": share,
                "visitors": visitors,
                "orders": t["orders"],
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

        trend_key = {
            "WhatsApp": "whatsapp", "Website": "website", "Instagram": "instagram",
            "Facebook": "facebook", "TikTok": "tiktok",
        }

        by_day = {
            d: {"whatsapp": 0, "instagram": 0, "facebook": 0,
                "tiktok": 0, "website": 0, "other": 0}
            for d in _date_range_days(start, end)
        }
        for r in daily:
            label = source_map.get((r["source"] or "").lower(), "Other")
            key = trend_key.get(label, "other")
            if r["day"] in by_day:
                by_day[r["day"]][key] += r["orders"]

        trend = [
            {"date": d.strftime("%b %d"), **counts}
            for d, counts in sorted(by_day.items())
        ]

        social_activity = []
        try:
            from dashboard.social.models import SocialAccount, SocialPlatformDailyMetric, SocialScheduledPost
            sm = (
                SocialPlatformDailyMetric.objects
                .filter(date__gte=start, date__lte=end)
                .values("platform")
                .annotate(
                    reach=Coalesce(Sum("reach"), Value(0)),
                    engagement=Coalesce(Sum("engagement"), Value(0)),
                    views=Coalesce(Sum("views"), Value(0)),
                )
            )
            by_plat = {r["platform"]: r for r in sm}
            if not by_plat:
                for r in (
                    SocialScheduledPost.objects
                    .filter(published_at__date__gte=start, published_at__date__lte=end)
                    .values("platform")
                    .annotate(
                        reach=Coalesce(Sum("reach"), Value(0)),
                        engagement=Coalesce(Sum("likes"), Value(0)) + Coalesce(Sum("comments"), Value(0)),
                        views=Coalesce(Sum("views"), Value(0)),
                    )
                ):
                    by_plat[r["platform"]] = r

            platform_labels = {
                "facebook": ("Facebook", "#0284c7"),
                "instagram": ("Instagram", "#ec4899"),
                "tiktok": ("TikTok", "#f59e0b"),
                "youtube": ("YouTube", "#dc2626"),
            }
            for acc in SocialAccount.objects.filter(status="connected"):
                key = (acc.platform or "").lower()
                name, color = platform_labels.get(key, (acc.platform.title(), "#94a3b8"))
                m = by_plat.get(key, {})
                metric_val = _to_int(m.get("reach") or m.get("views") or acc.followers or 0)
                metric_lbl = "Reach" if m.get("reach") else ("Views" if m.get("views") else "Followers")
                social_activity.append({
                    "platform": name,
                    "metric": f"{acc.display_name or acc.username or name} · {metric_lbl}",
                    "value": f"{metric_val:,}",
                    "delta": f"{_to_int(m.get('engagement', 0)):,} eng",
                    "positive": True,
                    "color": color,
                })
        except Exception:
            pass

        attribution = [
            {"platform": "WhatsApp Business API", "metric": "Chat → Order",
             "value": f"{(next((r['share'] for r in rows if r['name'] == 'WhatsApp'), 0))}%",
             "desc": "Direct & WhatsApp commerce share"},
            {"platform": "Instagram Shop", "metric": "Profile → Store visit",
             "value": f"{social_visits.get('Instagram', 0):,} visits · {social_orders.get('Instagram', 0)} orders",
             "desc": "Tracked social attribution"},
            {"platform": "TikTok Shop / Pixel", "metric": "Video → Store order",
             "value": f"{(next((r['orders'] for r in rows if r['name'] == 'TikTok'), 0))} orders",
             "desc": "Direct & video attribution"},
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
