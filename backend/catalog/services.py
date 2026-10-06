# catalog/services.py

"""
Read-only query layer for the catalog app.

This module does not mutate anything — every function below returns a
queryset or a dict. Stock mutations live in `checkout.services` (sales
and returns) and `dashboard.inventory` (manual adjustments), and both
are responsible for calling `check_low_stock()` here after they write.

SETTINGS AWARENESS:
    Every product queryset now routes through `_apply_storefront_filters()`,
    which reads `InventorySettings` from the cached settings bundle and
    applies the shop owner's rules:

        hide_out_of_stock=True  + allow_backorders=False  → hide zero-stock
        hide_out_of_stock=True  + allow_backorders=True   → keep zero-stock
        hide_out_of_stock=False                            → keep everything

    The same helper also handles the `low_stock_threshold` fallback for
    products that don't set their own. Product-level thresholds still
    win; the setting is the store-wide default.

AUTOMATIONS:
    One event is exported from this module:

        stock.below_threshold   — fired by `check_low_stock(product_id)`

    `check_low_stock` is deliberately a standalone helper rather than
    something the query functions call inline — the `get_*` functions
    run on every page load, and firing events from them would be
    catastrophic.

    Callers:

        checkout.services._persist_order   (after stock decrement)
        checkout.services.change_order_status  (after RETURNED restock
                                                if the restock is partial)
        dashboard.inventory views          (after manual adjust)

    The helper is best-effort and never raises. An automation failure
    must not roll back the stock change that triggered it.
"""

from datetime import timedelta
from decimal import Decimal

from django.db import models
from django.db.models import Q
from django.utils import timezone

from .models import (
    Category,
    Brand,
    Product,
    Discount,
    AppliesTo,
    DiscountType,
    DiscountSource,
)

# Reviews live in the account app now. `account.Review.product_id` is an
# opaque CharField snapshot — there is no reverse FK from `catalog.Product`.
# Importing here is safe: `account/models.py` does not import from `catalog`.
from account.models import Review as AccountReview


# ═════════════════════════════════════════════════════════════════════════════
# Settings helper — safe to call during migrations / cold boot
# ═════════════════════════════════════════════════════════════════════════════
def _settings():
    """
    Return the cached settings bundle, or None if the settings app
    isn't ready yet (first migration, test setup, management commands).
    """
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


def _hide_out_of_stock() -> bool:
    s = _settings()
    return bool(s['inventory'].hide_out_of_stock) if s else False


def _allow_backorders() -> bool:
    s = _settings()
    return bool(s['inventory'].allow_backorders) if s else False


def _low_stock_threshold_default() -> int:
    """
    Store-wide fallback threshold. Used only by `check_low_stock()` when
    a product has no `low_stock_threshold` of its own.
    """
    s = _settings()
    return s['inventory'].low_stock_threshold if s else 5


def _apply_storefront_filters(qs):
    """
    Apply the shop owner's visibility rules to a product queryset.

    Every storefront queryset MUST route through this helper so the
    hide/backorder rules stay consistent across the products page,
    category page, best sellers, new arrivals, and deals grid.

    Rules:
        hide_out_of_stock=False                → keep everything
        hide_out_of_stock=True + backorders=on → keep zero-stock (they're
                                                  preorderable)
        hide_out_of_stock=True + backorders=off → drop zero-stock
    """
    if _hide_out_of_stock() and not _allow_backorders():
        qs = qs.filter(stock_quantity__gt=0)
    return qs


# ═════════════════════════════════════════════════════════════════════════════
# Automation dispatch (best-effort side effect)
# ═════════════════════════════════════════════════════════════════════════════
import logging

logger = logging.getLogger(__name__)


def _fire_event(event_name: str, payload: dict) -> None:
    """
    Hand an event to the AI automations dispatcher.

    Never raises. An automation failure must not roll back a stock
    change, a product edit, or anything else the caller was doing —
    the write is the important part; the automation is a side effect.

    Lazy import: `dashboard.aiandautomations` pulls in catalog,
    account, and checkout models at module load. A top-level import
    would risk a circular dependency the first time Django resolves
    the app registry.
    """
    try:
        from dashboard.aiandautomations.services.automations import dispatch
        dispatch(event_name, payload)
    except Exception:
        logger.exception(
            "Automation dispatch failed for event %s", event_name,
        )


def check_low_stock(product_id: str) -> bool:
    """
    Fire `stock.below_threshold` if the product is currently below its
    low-stock threshold.

    Threshold priority:
        1. The product's own `low_stock_threshold` (if > 0)
        2. The store-wide `inventory.low_stock_threshold` setting

    A zero/negative threshold on the product disables the check for
    that product — the escape hatch for digital goods and made-to-order
    items that shouldn't alert.

    Returns True if the event was fired, False otherwise. Never raises.
    """
    if not product_id:
        return False

    try:
        row = (
            Product.objects
            .filter(pk=product_id)
            .values("stock_quantity", "low_stock_threshold")
            .first()
        )
        if not row:
            return False

        # Product-level threshold wins; fall back to the store default.
        threshold = row["low_stock_threshold"] or _low_stock_threshold_default()

        # A product that explicitly sets threshold=0 has opted out.
        if row["low_stock_threshold"] == 0:
            return False

        if row["stock_quantity"] >= threshold:
            return False

        _fire_event(
            "stock.below_threshold",
            {
                "product_id": product_id,
                "stock": row["stock_quantity"],
                "threshold": threshold,
            },
        )
        return True

    except Exception:
        logger.exception(
            "check_low_stock failed for product %s", product_id,
        )
        return False


# ═════════════════════════════════════════════════════════════════════════════
# Shared — categories & brands
# ═════════════════════════════════════════════════════════════════════════════
def get_categories():
    """Active categories, sidebar ordering. No product counts."""
    return Category.objects.active().order_by("sort_order", "name")


def get_brands():
    return Brand.objects.filter(is_active=True).order_by("name")


def get_categories_with_counts():
    """
    Sidebar list — active categories, each annotated with `product_count`.
    Powers `CategorySerializer.productCount` and `itemCount`.
    """
    return (
        Category.objects.active()
        .with_product_counts()
        .order_by("sort_order", "name")
    )


# ═════════════════════════════════════════════════════════════════════════════
# Products page
# ═════════════════════════════════════════════════════════════════════════════
PRODUCT_PRICE_RANGES = {
    "0-10000":      (0, 10_000),
    "10000-50000":  (10_000, 50_000),
    "50000-100000": (50_000, 100_000),
    "100000-plus":  (100_000, None),
}

PRODUCT_SORT_MAP = {
    "featured":   ["-featured", "-created_at"],
    "price-low":  ["price"],
    "price-high": ["-price"],
    "rating":     ["-rating_avg", "-review_count"],
    "newest":     ["-created_at"],
}


def get_products(
    *,
    search=None,
    category=None,
    brand=None,
    price_range=None,
    stock=None,
    sort_by="featured",
):
    qs = Product.objects.active().with_relations()
    qs = _apply_storefront_filters(qs)

    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(brand__name__icontains=search)
            | Q(category__name__icontains=search)
        )

    if category and category != "All":
        qs = qs.filter(category__name__iexact=category)

    if brand and brand != "All":
        qs = qs.filter(brand__name__iexact=brand)

    if price_range and price_range != "All":
        lo, hi = PRODUCT_PRICE_RANGES.get(price_range, (None, None))
        if lo is not None:
            qs = qs.filter(price__gte=lo)
        if hi is not None:
            qs = qs.filter(price__lte=hi)

    if stock and stock != "All":
        if stock == Product.STOCK_OUT:
            qs = qs.filter(stock_quantity=0)
        elif stock == Product.STOCK_LOW:
            qs = qs.filter(
                stock_quantity__gt=0,
                stock_quantity__lte=models.F("low_stock_threshold"),
            )
        elif stock == Product.STOCK_IN:
            qs = qs.filter(stock_quantity__gt=models.F("low_stock_threshold"))

    return qs.order_by(*PRODUCT_SORT_MAP.get(sort_by, PRODUCT_SORT_MAP["featured"]))


def get_product_by_id(product_id: str):
    """
    Detail view fetch. We do NOT apply the hide filter here — a customer
    with a direct link should still see the product page (which will show
    "out of stock" or "pre-order"). The listing filter is a discoverability
    rule, not a content-access rule.
    """
    return (
        Product.objects.active()
        .with_relations()
        .filter(id=product_id)
        .first()
    )


def get_related_products(product: Product, limit: int = 6):
    qs = (
        Product.objects.active()
        .with_relations()
        .filter(Q(category=product.category) | Q(brand=product.brand))
        .exclude(id=product.id)
    )
    qs = _apply_storefront_filters(qs)
    return qs.order_by("-rating_avg", "-created_at")[:limit]


# ═════════════════════════════════════════════════════════════════════════════
# Category page
# ═════════════════════════════════════════════════════════════════════════════
CATEGORY_SORT_MAP = {
    "featured":   ["-featured", "-created_at"],
    "price-low":  ["price"],
    "price-high": ["-price"],
    "newest":     ["-created_at"],
    "rating":     ["-rating_avg", "-review_count"],
}


def get_category_by_slug(slug: str):
    return Category.objects.filter(slug=slug, is_active=True).first()


def get_products_for_category(
    category: Category,
    *,
    search: str | None = None,
    stock: str | None = None,
    sort_by: str = "featured",
):
    qs = (
        Product.objects.active()
        .with_relations()
        .filter(category=category)
    )
    qs = _apply_storefront_filters(qs)

    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(brand__name__icontains=search)
        )

    if stock == "in-stock":
        qs = qs.filter(stock_quantity__gt=models.F("low_stock_threshold"))
    elif stock == "low-stock":
        qs = qs.filter(
            stock_quantity__gt=0,
            stock_quantity__lte=models.F("low_stock_threshold"),
        )

    return qs.order_by(*CATEGORY_SORT_MAP.get(sort_by, CATEGORY_SORT_MAP["featured"]))


# ═════════════════════════════════════════════════════════════════════════════
# Best selling page
# ═════════════════════════════════════════════════════════════════════════════
BEST_SELLERS_LIMIT = 8

BEST_SELLER_PRICE_RANGES = {
    "under-5000":  (0, 5_000),
    "5000-20000":  (5_000, 20_000),
    "20000-50000": (20_000, 50_000),
    "over-50000":  (50_000, None),
}

BEST_SELLER_SORT_MAP = {
    "best-selling":   ["-sales_count", "-review_count", "-created_at"],
    "price-low-high": ["price"],
    "price-high-low": ["-price"],
    "rating":         ["-rating_avg", "-review_count"],
}


def get_best_sellers(*, limit=BEST_SELLERS_LIMIT):
    qs = Product.objects.active().with_relations()
    qs = _apply_storefront_filters(qs)
    return qs.order_by("-sales_count", "-review_count", "-created_at")[:limit]


def filter_best_sellers(
    *,
    search=None,
    category=None,
    brand=None,
    price_range=None,
    stock=None,
    sort_by="best-selling",
    limit=BEST_SELLERS_LIMIT,
):
    qs = Product.objects.active().with_relations()
    qs = _apply_storefront_filters(qs)

    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(brand__name__icontains=search)
            | Q(category__name__icontains=search)
        )

    if category and category != "All":
        qs = qs.filter(category__name__iexact=category)

    if brand and brand != "All":
        qs = qs.filter(brand__name__iexact=brand)

    if price_range and price_range != "All":
        lo, hi = BEST_SELLER_PRICE_RANGES.get(price_range, (None, None))
        if lo is not None:
            qs = qs.filter(price__gte=lo)
        if hi is not None:
            qs = qs.filter(price__lte=hi)

    if stock and stock != "All":
        if stock == Product.STOCK_OUT:
            qs = qs.filter(stock_quantity=0)
        elif stock == Product.STOCK_LOW:
            qs = qs.filter(
                stock_quantity__gt=0,
                stock_quantity__lte=models.F("low_stock_threshold"),
            )
        elif stock == Product.STOCK_IN:
            qs = qs.filter(stock_quantity__gt=models.F("low_stock_threshold"))

    qs = qs.order_by(*BEST_SELLER_SORT_MAP.get(sort_by, BEST_SELLER_SORT_MAP["best-selling"]))

    if limit:
        qs = qs[:limit]
    return qs


def get_best_seller_by_id(product_id: str):
    return (
        Product.objects.active()
        .with_relations()
        .filter(id=product_id)
        .first()
    )


def get_best_seller_related_products(product: Product, limit: int = 6):
    qs = (
        Product.objects.active()
        .with_relations()
        .filter(Q(category=product.category) | Q(brand=product.brand))
        .exclude(id=product.id)
    )
    qs = _apply_storefront_filters(qs)
    return qs.order_by("-sales_count", "-review_count", "-created_at")[:limit]


# ═════════════════════════════════════════════════════════════════════════════
# New arrivals page
# ═════════════════════════════════════════════════════════════════════════════
NEW_ARRIVALS_LIMIT = 8
NEW_ARRIVALS_WINDOW_DAYS = 90

NEW_ARRIVAL_SORT_MAP = {
    "newest":     ["-created_at"],
    "price-low":  ["price"],
    "price-high": ["-price"],
    "rating":     ["-rating_avg", "-review_count"],
}


def filter_new_arrivals(
    *,
    search=None,
    category=None,
    brand=None,
    min_price=None,
    max_price=None,
    stock=None,
    sort_by="newest",
    limit=NEW_ARRIVALS_LIMIT,
    window_days=NEW_ARRIVALS_WINDOW_DAYS,
):
    qs = Product.objects.active().with_relations()
    qs = _apply_storefront_filters(qs)

    if window_days:
        cutoff = timezone.now() - timedelta(days=window_days)
        qs = qs.filter(created_at__gte=cutoff)

    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(brand__name__icontains=search)
            | Q(description__icontains=search)
        )

    if category and category != "All":
        qs = qs.filter(category__name__iexact=category)

    if brand and brand != "All":
        qs = qs.filter(brand__name__iexact=brand)

    if min_price not in (None, "", "None"):
        qs = qs.filter(price__gte=min_price)

    if max_price not in (None, "", "None"):
        qs = qs.filter(price__lte=max_price)

    if stock and stock != "All":
        if stock == Product.STOCK_OUT:
            qs = qs.filter(stock_quantity=0)
        elif stock == Product.STOCK_LOW:
            qs = qs.filter(
                stock_quantity__gt=0,
                stock_quantity__lte=models.F("low_stock_threshold"),
            )
        elif stock == Product.STOCK_IN:
            qs = qs.filter(stock_quantity__gt=models.F("low_stock_threshold"))

    qs = qs.order_by(*NEW_ARRIVAL_SORT_MAP.get(sort_by, NEW_ARRIVAL_SORT_MAP["newest"]))

    if limit:
        qs = qs[:limit]
    return qs


def get_new_arrival_by_id(product_id: str):
    return (
        Product.objects.active()
        .with_relations()
        .filter(id=product_id)
        .first()
    )


# ═════════════════════════════════════════════════════════════════════════════
# Automatic discounts — used by `Product.effective_price`
# ═════════════════════════════════════════════════════════════════════════════
def get_best_automatic_discount_for_product(
    product: Product,
    at=None,
) -> Discount | None:
    """
    The best currently-active automatic discount for `product`, or None.

    "Best" = largest percent off. Ties broken by priority (higher first),
    then by start_date (more recent first).

    Clearance discounts that have opted in via `expires_when_sold_out`
    are skipped once stock hits zero — UNLESS the shop allows backorders,
    in which case the discount stays live because the product is still
    orderable as a preorder.
    """
    at = at or timezone.now()
    backorders = _allow_backorders()

    qs = (
        Discount.objects
        .automatic()
        .filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=at),
            start_date__lte=at,
        )
        .filter(
            models.Q(applies_to=AppliesTo.ALL_PRODUCTS)
            | models.Q(
                applies_to=AppliesTo.SPECIFIC_PRODUCTS,
                linked_products=product,
            )
            | models.Q(
                applies_to=AppliesTo.SPECIFIC_CATEGORIES,
                linked_categories=product.category_id,
            )
        )
        .distinct()
    )

    best: Discount | None = None
    best_pct = -1

    for discount in qs:
        # Clearance expires when sold out — unless backorders are on,
        # in which case the item is still orderable as a preorder.
        if (
            discount.expires_when_sold_out
            and product.stock_quantity == 0
            and not backorders
        ):
            continue
        pct = discount.percent_off_for(product.price)
        if pct > best_pct:
            best = discount
            best_pct = pct

    return best


# ═════════════════════════════════════════════════════════════════════════════
# Slow-stock helpers — used by the "Clear Slow Stock" admin workflow
# ═════════════════════════════════════════════════════════════════════════════
def get_slow_moving_products(
    *,
    min_days=90,
    max_sales=5,
    min_stock=10,
    limit=None,
):
    """
    Products that have been listed a long time, sold few units, and still
    have stock. This is the query behind the "Clear Slow Stock" wizard.
    """
    qs = (
        Product.objects.active()
        .slow_moving(min_days=min_days, max_sales=max_sales, min_stock=min_stock)
        .with_relations()
        .order_by("sales_count", "-stock_quantity", "created_at")
    )
    if limit:
        qs = qs[:limit]
    return qs


def get_products_without_active_clearance(*, min_days=90, max_sales=5, min_stock=10):
    """
    Slow movers that are NOT already under an active clearance discount.
    """
    slow = get_slow_moving_products(
        min_days=min_days, max_sales=max_sales, min_stock=min_stock,
    )
    cleared_ids = set(
        Discount.objects
        .clearance()
        .active()
        .values_list("linked_products__id", flat=True)
    )
    return slow.exclude(id__in=cleared_ids)


# ═════════════════════════════════════════════════════════════════════════════
# Special deals page
# ═════════════════════════════════════════════════════════════════════════════
SORT_FEATURED         = "Featured Deals"
SORT_BIGGEST_DISCOUNT = "Biggest Discount"
SORT_PRICE_LOW_HIGH   = "Price: Low to High"
SORT_PRICE_HIGH_LOW   = "Price: High to Low"
SORT_ENDING_SOON      = "Ending Soon"


def compute_status(discount: Discount) -> str:
    return discount.status


def discounted_price(discount: Discount, original_price) -> Decimal:
    return discount.price_for(Decimal(original_price))


def discount_percent(discount: Discount, original_price) -> int:
    return discount.percent_off_for(Decimal(original_price))


def resolve_applicable_products(discount: Discount):
    qs = Product.objects.active().with_relations()
    qs = _apply_storefront_filters(qs)

    if discount.applies_to == AppliesTo.ALL_PRODUCTS:
        return qs

    if discount.applies_to == AppliesTo.SPECIFIC_PRODUCTS:
        ids = list(discount.linked_products.values_list("id", flat=True))
        if not ids:
            return Product.objects.none()
        return qs.filter(id__in=ids)

    if discount.applies_to == AppliesTo.SPECIFIC_CATEGORIES:
        cat_ids = list(discount.linked_categories.values_list("id", flat=True))
        if not cat_ids:
            return Product.objects.none()
        return qs.filter(category_id__in=cat_ids)

    return Product.objects.none()


def product_matches_discount(product: Product, discount: Discount) -> bool:
    if discount.applies_to == AppliesTo.ALL_PRODUCTS:
        return True
    if discount.applies_to == AppliesTo.SPECIFIC_PRODUCTS:
        return discount.linked_products.filter(id=product.id).exists()
    if discount.applies_to == AppliesTo.SPECIFIC_CATEGORIES:
        return discount.linked_categories.filter(id=product.category_id).exists()
    return False


def build_deal_card(
    discount: Discount,
    product: Product,
    sale_price: Decimal,
    request=None,
) -> dict:
    """
    Build one deal card.

    `inStock` reflects the shop's backorder rule: when backorders are
    allowed, a zero-stock product still reports `inStock=True` so the
    frontend renders "Pre-order" instead of "Sold out".
    """
    images = list(product.images.all())
    primary_image = ""

    chosen = None
    if images:
        chosen = next((i for i in images if i.is_primary), images[0])

    if chosen is not None:
        if chosen.external_url:
            primary_image = chosen.external_url
        elif chosen.image:
            url = chosen.image.url
            if request is not None:
                url = request.build_absolute_uri(url)
            primary_image = url

    if not primary_image and discount.image:
        primary_image = discount.image

    features = [f.text for f in product.features.all()]
    specs = {s.key: s.value for s in product.specs.all()}

    backorders = _allow_backorders()
    in_stock = product.stock_quantity > 0 or backorders

    return {
        "id": f"{discount.id}__{product.id}",
        "productId": product.id,
        "discountCode": discount.code,
        "name": product.name,
        "brand": product.brand.name,
        "category": product.category.name,
        "price": str(sale_price),
        "originalPrice": str(product.price),
        "discountPct": discount_percent(discount, product.price),
        "inStock": in_stock,
        "stockCount": product.stock_quantity,
        "image": primary_image,
        "description": product.description,
        "features": features,
        "specs": specs,
        "startDate": discount.start_date,
        "endDate": discount.end_date,
        "promotionType": discount.promotion_type,
        "rating": str(product.rating_avg),
        "reviewCount": product.review_count,
        "isClearance": discount.is_clearance,
        "source": discount.source,
        "_priority": discount.priority,
    }


def _strip_internal(card: dict) -> dict:
    card.pop("_priority", None)
    return card


def get_active_discounts():
    return (
        Discount.objects.visible_on_deals_page()
        .active()
        .with_links()
        .order_by("-priority", "-created_at")
    )


def build_all_active_deal_cards(request=None) -> list[dict]:
    raw: list[dict] = []
    backorders = _allow_backorders()

    for discount in get_active_discounts():
        for product in resolve_applicable_products(discount):
            # Clearance expires when sold out — unless backorders are on,
            # in which case the preorder path keeps the card visible.
            if (
                discount.expires_when_sold_out
                and product.stock_quantity == 0
                and not backorders
            ):
                continue
            sale_price = discounted_price(discount, product.price)
            if sale_price >= product.price:
                continue
            raw.append(
                build_deal_card(discount, product, sale_price, request=request)
            )

    raw.sort(key=lambda c: c["discountPct"], reverse=True)
    seen: set[str] = set()
    unique: list[dict] = []
    for card in raw:
        if card["productId"] in seen:
            continue
        seen.add(card["productId"])
        unique.append(card)

    unique.sort(key=lambda c: c["_priority"], reverse=True)
    return [_strip_internal(c) for c in unique]


def filter_deal_cards(
    cards: list[dict],
    *,
    search: str | None = None,
    category: str | None = None,
    brand: str | None = None,
    min_price=None,
    max_price=None,
    availability: str | None = None,
    discount_level: str | None = None,
    sort_by: str = SORT_FEATURED,
) -> list[dict]:
    out = list(cards)

    if search:
        q = search.lower()
        out = [
            c for c in out
            if q in c["name"].lower()
            or q in c["brand"].lower()
            or q in c["category"].lower()
        ]

    if category and category != "All":
        out = [c for c in out if c["category"] == category]

    if brand and brand != "All":
        out = [c for c in out if c["brand"] == brand]

    if min_price not in (None, "", "None"):
        try:
            floor = Decimal(str(min_price))
            out = [c for c in out if Decimal(c["price"]) >= floor]
        except Exception:
            pass

    if max_price not in (None, "", "None"):
        try:
            ceil = Decimal(str(max_price))
            out = [c for c in out if Decimal(c["price"]) <= ceil]
        except Exception:
            pass

    if availability == "In Stock":
        out = [c for c in out if c["inStock"]]
    elif availability == "Out of Stock":
        out = [c for c in out if not c["inStock"]]

    if discount_level and discount_level != "All":
        try:
            threshold = int(discount_level)
            out = [c for c in out if c["discountPct"] >= threshold]
        except ValueError:
            pass

    if sort_by == SORT_BIGGEST_DISCOUNT:
        out.sort(key=lambda c: c["discountPct"], reverse=True)
    elif sort_by == SORT_PRICE_LOW_HIGH:
        out.sort(key=lambda c: Decimal(c["price"]))
    elif sort_by == SORT_PRICE_HIGH_LOW:
        out.sort(key=lambda c: Decimal(c["price"]), reverse=True)
    elif sort_by == SORT_ENDING_SOON:
        out.sort(key=lambda c: (c["endDate"] is None, c["endDate"] or timezone.now()))

    return out


def get_filtered_deal_cards(
    request=None,
    *,
    search=None, category=None, brand=None,
    min_price=None, max_price=None,
    availability=None, discount_level=None,
    sort_by=SORT_FEATURED,
) -> list[dict]:
    return filter_deal_cards(
        build_all_active_deal_cards(request=request),
        search=search, category=category, brand=brand,
        min_price=min_price, max_price=max_price,
        availability=availability, discount_level=discount_level,
        sort_by=sort_by,
    )


def get_deal_card_for_product(product_id: str, request=None) -> dict | None:
    product = (
        Product.objects.active().with_relations()
        .filter(id=product_id)
        .first()
    )
    if not product:
        return None

    backorders = _allow_backorders()
    best_card: dict | None = None

    for discount in get_active_discounts():
        if not product_matches_discount(product, discount):
            continue
        if (
            discount.expires_when_sold_out
            and product.stock_quantity == 0
            and not backorders
        ):
            continue
        sale_price = discounted_price(discount, product.price)
        if sale_price >= product.price:
            continue
        card = build_deal_card(discount, product, sale_price, request=request)
        if best_card is None or card["discountPct"] > best_card["discountPct"]:
            best_card = card

    return _strip_internal(best_card) if best_card else None


def get_deal_categories(request=None):
    cards = build_all_active_deal_cards(request=request)
    names = sorted({c["category"] for c in cards})
    return (
        Category.objects.filter(name__in=names, is_active=True)
        .order_by("sort_order", "name")
    )


def get_deal_brands(request=None):
    cards = build_all_active_deal_cards(request=request)
    names = sorted({c["brand"] for c in cards})
    return Brand.objects.filter(name__in=names, is_active=True).order_by("name")


# ═════════════════════════════════════════════════════════════════════════════
# Reviews — read-only from the catalog side
# ═════════════════════════════════════════════════════════════════════════════
def get_reviews_for_product(product: Product):
    """
    Published reviews for a product, newest first.

    Gated by `reviews.reviews_enabled` from Settings → Store. When the
    shop owner disables reviews, the storefront simply gets an empty
    queryset — no serializer change required, no frontend change needed.
    """
    if _settings() and not _settings()['reviews'].reviews_enabled:
        return AccountReview.objects.none()

    return (
        AccountReview.objects
        .filter(
            product_id=product.id,
            status=AccountReview.Status.PUBLISHED,
        )
        .select_related("user")
        .order_by("-created_at")
    )