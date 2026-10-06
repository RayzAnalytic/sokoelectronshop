# discounts/services.py

"""
Business logic for the dashboard discounts API.

Pure Python — no HTTP, no serializers, no request objects. Views call
these functions; tests call them directly. All enum translation lives
in serializers.py; all persistence lives in catalog.models.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from catalog.models import (
    Category,
    Discount,
    DiscountSource,
    DiscountType,
    AppliesTo,
    Product,
)


# ═════════════════════════════════════════════════════════════════════════════
# Resolvers — React form values → model instances
# ═════════════════════════════════════════════════════════════════════════════
def resolve_categories(names: list[str] | None) -> list[Category]:
    """
    Category NAMES → Category instances.

    The React form sends `['TVs', 'Laptops']`. The M2M wants PKs. This
    is the only place the translation happens.

    Unknown or inactive names are silently skipped — the frontend may
    have a stale list. The write serializer validates the resulting
    count against the input count when it matters.
    """
    if not names:
        return []
    return list(Category.objects.filter(name__in=names, is_active=True))


def resolve_products(names: list[str] | None) -> list[Product]:
    """
    Product NAMES → Product instances.

    Same pattern as `resolve_categories`. The React stub sends product
    names; the M2M wants IDs.
    """
    if not names:
        return []
    return list(Product.objects.filter(name__in=names, is_active=True))


# ═════════════════════════════════════════════════════════════════════════════
# Status transitions
# ═════════════════════════════════════════════════════════════════════════════
def pause_discount(discount: Discount) -> Discount:
    """
    Freeze a discount regardless of its date window.

    Sets `status_override = 'Paused'`. The model's `status` property
    checks `status_override` first, so a paused discount reads as
    Paused even if the date window says Active.
    """
    if discount.status_override == "Paused":
        return discount
    discount.status_override = "Paused"
    discount.save(update_fields=["status_override", "updated_at"])
    return discount


def resume_discount(discount: Discount) -> Discount:
    """
    Clear the pause. Status reverts to date-driven.
    """
    if discount.status_override != "Paused":
        return discount
    discount.status_override = ""
    discount.save(update_fields=["status_override", "updated_at"])
    return discount


# ═════════════════════════════════════════════════════════════════════════════
# Duplicate
# ═════════════════════════════════════════════════════════════════════════════
@transaction.atomic
def duplicate_discount(discount: Discount, *, user=None) -> Discount:
    """
    Clone a discount with a `-COPY` code suffix and reset counters.

    The clone:
      * `status_override = 'Draft'` — never goes live accidentally
      * `usage_count = 0`
      * `display_on_deals_page = False` — safe default, admin must opt in
      * M2M links copied
      * `created_by` set to the requesting user

    `code` gets `-COPY` appended. If that collides (unlikely), the
    IntegrityError propagates and the caller should generate a new code.
    """
    clone = Discount.objects.create(
        code=f"{discount.code}-COPY",
        description=discount.description,
        type=discount.type,
        value=discount.value,
        min_order=discount.min_order,
        max_cap=discount.max_cap,
        usage_limit=discount.usage_limit,
        per_customer=discount.per_customer,
        usage_count=0,
        start_date=discount.start_date,
        end_date=discount.end_date,
        applies_to=discount.applies_to,
        eligibility=discount.eligibility,
        target_audience=discount.target_audience,
        source=DiscountSource.MANUAL,
        is_automatic=discount.is_automatic,
        is_clearance=False,
        expires_when_sold_out=discount.expires_when_sold_out,
        created_by=user if user and user.is_authenticated else None,
        is_most_deal=False,
        image=discount.image,
        display_on_deals_page=False,
        promotion_type=discount.promotion_type,
        deal_title=f"{discount.deal_title} (copy)" if discount.deal_title else "",
        badge_text=discount.badge_text,
        priority=discount.priority,
        channels=list(discount.channels or []),
        tiktok_video=discount.tiktok_video,
        status_override="Draft",
    )
    clone.linked_products.set(discount.linked_products.all())
    clone.linked_categories.set(discount.linked_categories.all())
    return clone


# ═════════════════════════════════════════════════════════════════════════════
# Slow stock / clearance
# ═════════════════════════════════════════════════════════════════════════════
def get_slow_moving_candidates(*, min_days=90, max_sales=5, min_stock=10):
    """
    Products eligible for clearance: listed a long time, barely sold,
    still in stock, and NOT already under an active clearance discount.

    The exclusion stops ops from double-discounting a product that
    already has a clearance running.
    """
    slow = (
        Product.objects.active()
        .slow_moving(min_days=min_days, max_sales=max_sales, min_stock=min_stock)
        .select_related("brand", "category")
        .order_by("sales_count", "-stock_quantity", "created_at")
    )

    active_clearance_product_ids = set(
        Discount.objects
        .clearance()
        .active()
        .values_list("linked_products__id", flat=True)
    )

    if active_clearance_product_ids:
        slow = slow.exclude(id__in=active_clearance_product_ids)

    return slow


@transaction.atomic
def apply_bulk_clearance(
    *,
    product_ids: list[str],
    percent_off: int,
    user=None,
    expires_when_sold_out: bool = True,
    title: str | None = None,
) -> Discount:
    """
    Create one automatic clearance discount linked to N slow-moving
    products.

    Called by the "Clear Slow Stock" wizard. The resulting discount:
      * `is_automatic=True`   → applies without a code
      * `is_clearance=True`   → "Clearance" badge on the storefront
      * `source=CLEARANCE`    → shows up in the clearance filter
      * `end_date=None`       → runs until stock runs out
      * `applies_to=SPECIFIC_PRODUCTS`, linked to chosen products

    `code` is `CLEAR-<YYYYMMDDHHMMSS>` so the admin table has something
    readable. Uniqueness is guaranteed by the timestamp at second
    resolution plus a random suffix.
    """
    import uuid

    if not product_ids:
        raise ValueError("At least one product_id is required.")
    if not (1 <= percent_off <= 90):
        raise ValueError("percent_off must be between 1 and 90.")

    products = list(Product.objects.filter(id__in=product_ids, is_active=True))
    if not products:
        raise ValueError("None of the given product_ids matched active products.")

    suffix = timezone.now().strftime("%Y%m%d%H%M%S")
    short = uuid.uuid4().hex[:4].upper()
    code = f"CLEAR-{suffix}-{short}"

    if title is None:
        title = (
            f"Clearance — {len(products)} product"
            f"{'s' if len(products) != 1 else ''}"
        )

    discount = Discount.objects.create(
        code=code,
        description=f"Automatic clearance: {percent_off}% off slow-moving stock.",
        type=DiscountType.PERCENTAGE,
        value=f"{percent_off}%",
        min_order=0,
        max_cap=0,
        usage_limit=0,        # unlimited while stock lasts
        per_customer=0,       # 0 = no per-customer cap
        start_date=timezone.now(),
        end_date=None,        # open-ended
        applies_to=AppliesTo.SPECIFIC_PRODUCTS,
        eligibility="All Customers",
        target_audience="All People & Customers",
        source=DiscountSource.CLEARANCE,
        is_automatic=True,
        is_clearance=True,
        expires_when_sold_out=expires_when_sold_out,
        created_by=user if user and user.is_authenticated else None,
        is_most_deal=False,
        image="",
        display_on_deals_page=True,
        deal_title=title,
        badge_text=f"{percent_off}% OFF",
        priority=3,
        channels=["Website"],
    )
    discount.linked_products.set(products)
    return discount


# ═════════════════════════════════════════════════════════════════════════════
# Analytics
# ═════════════════════════════════════════════════════════════════════════════
def build_analytics(*, window_days: int = 30) -> dict:
    """
    Aggregates for the Analytics tab.

    Currently returns shape-correct STATIC data plus a few real counts.
    When `checkout.Order` starts recording `discount_code` and
    `discount_amount`, swap the placeholders for real aggregations —
    the JSON shape stays the same, so the frontend doesn't change.
    """
    active_count = Discount.objects.active().count()
    total_redemptions = sum(Discount.objects.values_list("usage_count", flat=True))

    # Placeholder math until orders record discount amounts.
    assumed_aov = Decimal("1540")
    revenue = Decimal(total_redemptions) * assumed_aov
    discount_given = revenue * Decimal("0.12")

    return {
        "kpis": {
            "total_discounts_given": float(discount_given),
            "total_redemptions": total_redemptions,
            "revenue_from_discounts": float(revenue),
            "aov_discounted": float(assumed_aov),
            "aov_regular": float(assumed_aov),
            "active_discounts": active_count,
        },
        "redemptions_over_time": [
            {"day": "Mon", "redemptions": 12},
            {"day": "Tue", "redemptions": 18},
            {"day": "Wed", "redemptions": 15},
            {"day": "Thu", "redemptions": 24},
            {"day": "Fri", "redemptions": 38},
            {"day": "Sat", "redemptions": 47},
            {"day": "Sun", "redemptions": 28},
        ],
        "revenue_by_discount": [
            {"name": "SAVE10", "revenue": 367500},
            {"name": "FREESHIP", "revenue": 283500},
            {"name": "VIP15", "revenue": 201000},
            {"name": "TVWEEK15", "revenue": 142800},
            {"name": "BUY2GET1", "revenue": 89600},
        ],
        "type_breakdown": [
            {"name": "Percentage", "value": 412, "color": "#172554"},
            {"name": "Fixed", "value": 189, "color": "#10b981"},
            {"name": "Free Ship", "value": 189, "color": "#8b5cf6"},
            {"name": "BOGO", "value": 34, "color": "#f59e0b"},
        ],
        "channel_breakdown": [
            {"name": "Website", "value": 540, "color": "#172554"},
            {"name": "WhatsApp", "value": 210, "color": "#10b981"},
            {"name": "TikTok", "value": 74, "color": "#ec4899"},
        ],
        "top_discounts": [
            {"code": "SAVE10", "type": "10% off", "redemptions": 245,
             "revenue": 367500, "discount_given": 36750, "roi": 10.0},
            {"code": "FREESHIP", "type": "Free shipping", "redemptions": 189,
             "revenue": 283500, "discount_given": 18900, "roi": 15.0},
            {"code": "VIP15", "type": "15% off", "redemptions": 67,
             "revenue": 201000, "discount_given": 30150, "roi": 6.7},
        ],
    }


# ═════════════════════════════════════════════════════════════════════════════
# Rules metadata (static for now)
# ═════════════════════════════════════════════════════════════════════════════
def get_rules_metadata() -> dict:
    """
    Static metadata for the Rules tab. Becomes real once a rule engine
    exists. Returns the shape the frontend already renders.
    """
    return {
        "conditions": [
            {"name": "Cart Value", "example": "Cart ≥ KES 5,000"},
            {"name": "Product Quantity", "example": "Quantity ≥ 3"},
            {"name": "Product Category", "example": 'Category = "Accessories"'},
            {"name": "Specific Product", "example": "Product ID = 123"},
            {"name": "Customer Tag", "example": 'Tag = "VIP"'},
            {"name": "Customer Order Count", "example": "Orders ≤ 1 (first order)"},
            {"name": "Customer Total Spent", "example": "Total spent ≥ KES 50,000"},
            {"name": "Day of Week", "example": "Day = Friday"},
            {"name": "Time of Day", "example": "Time between 6 PM–10 PM"},
            {"name": "Channel", "example": "Channel = WhatsApp"},
        ],
        "actions": [
            {"name": "Create Adjustment", "example": "-15% on order total"},
            {"name": "Free Shipping", "example": "Shipping = KES 0"},
            {"name": "Add Gift Item", "example": 'Add "Sample Sachet"'},
            {"name": "Send Notification", "example": 'Send "Promo applied!"'},
        ],
    }