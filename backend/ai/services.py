import json
import logging
import os

from django.apps import apps as django_apps
from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from catalog import services as catalog_services
from catalog.models import Category, Brand, Product
from checkout.models import Order
from .models import ChatSession, ChatMessage
from .prompts import (
    SYSTEM_PROMPT,
    POLICIES,
    CHIPS_BY_TOOL,
    DEFAULT_CHIPS,
)

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = getattr(settings, "AI_MAX_TOOL_ITERATIONS", 5)
HISTORY_TURNS = getattr(settings, "AI_HISTORY_TURNS", 6)


class AIConfigurationError(RuntimeError):
    pass


class AIRateLimitError(RuntimeError):
    pass


class AIProviderUnavailableError(RuntimeError):
    pass


PROVIDERS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "base_url_env": "GROQ_BASE_URL",
        "key_env": "GROQ_API_KEY",
        "model_env": "GROQ_MODEL",
        "default_model": "openai/gpt-oss-120b",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "base_url_env": "GEMINI_BASE_URL",
        "key_env": "GEMINI_API_KEY",
        "model_env": "GEMINI_MODEL",
        "default_model": "gemini-2.5-flash",
    },
    "xai": {
        "base_url": "https://api.x.ai/v1",
        "base_url_env": "XAI_BASE_URL",
        "key_env": "XAI_API_KEY",
        "model_env": "XAI_MODEL",
        "default_model": "grok-2-latest",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "base_url_env": "OPENROUTER_BASE_URL",
        "key_env": "OPENROUTER_API_KEY",
        "model_env": "OPENROUTER_MODEL",
        "default_model": "meta-llama/llama-3.3-70b-instruct:free",
    },
}


def _active_provider() -> str:
    name = (
        getattr(settings, "AI_PROVIDER", "")
        or os.getenv("AI_PROVIDER", "groq")
    ).lower()
    if name not in PROVIDERS:
        raise AIConfigurationError(
            f"Unknown AI_PROVIDER {name!r}. "
            f"Choose one of: {', '.join(PROVIDERS.keys())}."
        )
    return name


def _provider_config(provider: str) -> dict:
    cfg = PROVIDERS[provider]

    model = (
        os.getenv(cfg["model_env"], "")
        or getattr(settings, "AI_MODEL", "")
        or cfg["default_model"]
    )

    base_url = (
        os.getenv(cfg["base_url_env"], "")
        or getattr(settings, "AI_BASE_URL", "")
        or cfg["base_url"]
    )

    key = (
        getattr(settings, cfg["key_env"], "")
        or os.getenv(cfg["key_env"], "")
    )

    return {
        "base_url": base_url,
        "model": model,
        "key": key,
        "key_env": cfg["key_env"],
        "provider": provider,
    }


def _get_client():
    from openai import OpenAI

    cfg = _provider_config(_active_provider())

    if not cfg["key"]:
        raise AIConfigurationError(
            f"{cfg['key_env']} is not configured for provider "
            f"{cfg['provider']!r}. Add it to your .env file."
        )

    default_headers = None
    if cfg["provider"] == "openrouter":
        referer = getattr(settings, "OPENROUTER_HTTP_REFERER", "") or ""
        title = getattr(settings, "OPENROUTER_X_TITLE", "") or "Racetech Hub AI Assistant"
        default_headers = {"X-Title": title}
        if referer:
            default_headers["HTTP-Referer"] = referer

    return OpenAI(
        api_key=cfg["key"],
        base_url=cfg["base_url"],
        default_headers=default_headers,
    )


def call_model(messages: list[dict], tools: list[dict]):
    from openai import RateLimitError, APIError, APIConnectionError

    cfg = _provider_config(_active_provider())
    client = _get_client()

    logger.debug(
        "call_model → provider=%s model=%s tools=%d",
        cfg["provider"], cfg["model"], len(tools or []),
    )

    kwargs = {
        "model": cfg["model"],
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 1200,
        "parallel_tool_calls": False,
    }

    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    try:
        return client.chat.completions.create(**kwargs)
    except RateLimitError as exc:
        logger.warning("AI provider rate limit (%s): %s", cfg["provider"], exc)
        raise AIRateLimitError(
            "The assistant is receiving too many requests right now. "
            "Please wait a moment and try again."
        ) from exc
    except APIConnectionError as exc:
        logger.warning("AI provider connection error (%s): %s", cfg["provider"], exc)
        raise AIProviderUnavailableError(
            "The assistant is temporarily unreachable. Please try again."
        ) from exc
    except APIError as exc:
        logger.error(
            "AI provider API error (%s, model=%s): %s",
            cfg["provider"], cfg["model"], exc,
        )
        raise AIProviderUnavailableError(
            "The assistant is temporarily unavailable. Please try again shortly."
        ) from exc


def build_tool_schemas(is_authenticated: bool) -> list[dict]:
    tools = [
        {
            "type": "function",
            "function": {
                "name": "search_products",
                "description": (
                    "Search the live product catalog. Use this for any "
                    "request about products, prices, brands, categories, "
                    "stock, or recommendations. For 'over X' / 'above X' / "
                    "'more than X', set min_price=X. For 'under X' / "
                    "'below X' / 'less than X', set max_price=X."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "category": {"type": "string"},
                        "brand": {"type": "string"},
                        "min_price": {"type": "number"},
                        "max_price": {"type": "number"},
                        "in_stock_only": {"type": "boolean"},
                        "sort_by": {
                            "type": "string",
                            "enum": ["featured", "price-low", "price-high",
                                     "rating", "newest"],
                        },
                        "limit": {"type": "integer", "minimum": 1},
                        "offset": {"type": "integer", "minimum": 0},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_product",
                "description": (
                    "Fetch full details for one product by id, including "
                    "bullet features and technical specs."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {"product_id": {"type": "string"}},
                    "required": ["product_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "compare_products",
                "description": (
                    "Compare 2-4 products side-by-side by spec. Use when the "
                    "customer asks to compare models or see which is better."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "product_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 2,
                        },
                    },
                    "required": ["product_ids"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_categories",
                "description": "Return the list of active product categories.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_brands",
                "description": "Return the list of active product brands.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_shipping_quote",
                "description": (
                    "Return delivery information. If a county is provided, "
                    "returns rate for that county if available, otherwise "
                    "the general delivery policy."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {"county": {"type": "string"}},
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_shop_policies",
                "description": (
                    "Return the shop's official policy text. You MUST call "
                    "this before answering any question about payment, "
                    "delivery, returns, warranty, store, or contact."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "enum": ["payment", "delivery", "returns",
                                     "warranty", "store", "contact", "all"],
                        },
                    },
                    "required": ["topic"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_active_promotions",
                "description": (
                    "Return currently valid coupon codes and discounts."
                ),
                "parameters": {"type": "object", "properties": {}},
            },
        },
    ]

    if is_authenticated:
        tools.extend([
            {
                "type": "function",
                "function": {
                    "name": "get_my_profile",
                    "description": (
                        "Return the signed-in customer's profile details."
                    ),
                    "parameters": {"type": "object", "properties": {}},
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_my_orders",
                    "description": (
                        "Return the authenticated customer's own orders, "
                        "newest first."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status": {
                                "type": "string",
                                "enum": ["pending", "processing", "packed",
                                         "shipped", "delivered", "cancelled"],
                            },
                            "limit": {"type": "integer", "minimum": 1},
                        },
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_my_order_detail",
                    "description": (
                        "Return full detail for one of the authenticated "
                        "customer's orders by reference."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {"reference": {"type": "string"}},
                        "required": ["reference"],
                    },
                },
            },
        ])

    return tools


def _product_card(product: Product, request=None) -> dict:
    image_url = ""
    try:
        first = product.images.first()
        if first and getattr(first, "image", None):
            image_url = first.image.url
            if request is not None:
                image_url = request.build_absolute_uri(image_url)
    except Exception:
        image_url = ""

    brand_name = ""
    if getattr(product, "brand_id", None):
        try:
            brand_name = product.brand.name
        except Exception:
            brand_name = ""

    category_name = ""
    if getattr(product, "category_id", None):
        try:
            category_name = product.category.name
        except Exception:
            category_name = ""

    stock = getattr(product, "stock_status", "In Stock") or "In Stock"

    return {
        "id": product.id,
        "name": product.name,
        "brand": brand_name,
        "category": category_name,
        "price": str(product.price),
        "compareAtPrice": (
            str(product.compare_at_price) if product.compare_at_price else None
        ),
        "images": [image_url] if image_url else [],
        "stock": stock,
        "url": f"/pages/products?open={product.id}",
    }


def _serialize_product_list(qs, limit: int, offset: int = 0, request=None) -> dict:
    total = qs.count()
    products = list(qs[offset : offset + limit])
    return {
        "count": len(products),
        "total_available": total,
        "offset": offset,
        "has_more": offset + len(products) < total,
        "products": [_product_card(p, request=request) for p in products],
    }


def tool_search_products(args: dict, request) -> dict:
    limit = min(int(args.get("limit") or 5), 8)
    offset = max(int(args.get("offset") or 0), 0)

    def run_query(use_query: bool):
        qs = catalog_services.get_products(
            search=args.get("query") if use_query else None,
            category=args.get("category"),
            brand=args.get("brand"),
            stock="All",
            sort_by=args.get("sort_by") or "featured",
        )

        if args.get("min_price") is not None:
            qs = qs.filter(price__gte=args["min_price"])
        if args.get("max_price") is not None:
            qs = qs.filter(price__lte=args["max_price"])

        if args.get("in_stock_only"):
            qs = qs.exclude(stock_quantity=0)

        return qs

    qs = run_query(use_query=True)
    fell_back = False

    if qs.count() == 0 and args.get("query"):
        qs = run_query(use_query=False)
        fell_back = True

    result = _serialize_product_list(qs, limit, offset=offset, request=request)

    if fell_back and result["total_available"] > 0:
        result["note"] = (
            f'No exact match for "{args.get("query")}", but here are products '
            "that match the other filters (price, category). Tell the customer "
            "you couldn't filter by the exact spec and they should check each "
            "product's description for details."
        )
    elif result["count"] == 0 and offset == 0:
        result["message"] = "No products matched those filters."
    elif result["count"] == 0 and offset > 0:
        result["message"] = (
            f"No more results — all {result['total_available']} matches "
            "have been shown."
        )

    return result


def tool_get_product(args: dict, request) -> dict:
    product = catalog_services.get_product_by_id(args.get("product_id") or "")
    if not product:
        return {"error": "PRODUCT_NOT_FOUND"}

    return {
        "product": _product_card(product, request=request),
        "description": product.description,
        "features": [f.text for f in product.features.all()],
        "specs": {s.key: s.value for s in product.specs.all()},
        "rating": str(product.rating_avg),
        "reviewCount": product.review_count,
        "warranty_months": product.warranty_months,
        "return_window_days": product.return_window_days,
        "weight_kg": str(product.weight_kg) if product.weight_kg else None,
    }


def tool_compare_products(args: dict, request) -> dict:
    ids = (args.get("product_ids") or [])[:4]
    if len(ids) < 2:
        return {"error": "NEED_AT_LEAST_TWO_PRODUCTS"}

    items = []
    for pid in ids:
        p = catalog_services.get_product_by_id(str(pid))
        if not p:
            continue

        specs = {s.key: s.value for s in p.specs.all()}
        features = [f.text for f in p.features.all()]

        extras = {
            "Warranty": (
                f"{p.warranty_months} months"
                if p.warranty_months else "—"
            ),
            "Return window": (
                f"{p.return_window_days} days"
                if p.return_window_days else "—"
            ),
            "Weight": str(p.weight_kg) if p.weight_kg else "—",
            "Rating": (
                f"{p.rating_avg} / 5 ({p.review_count} reviews)"
                if p.review_count else "No reviews yet"
            ),
            "Stock": str(p.stock_quantity),
        }
        merged = {**extras, **specs}

        items.append({
            "product": _product_card(p, request=request),
            "specs": merged,
            "features": features,
        })

    if len(items) < 2:
        return {"error": "PRODUCTS_NOT_FOUND"}

    all_keys = set()
    for item in items:
        all_keys.update(item["specs"].keys())

    matrix = {
        key: {it["product"]["name"]: it["specs"].get(key, "—") for it in items}
        for key in sorted(all_keys)
    }

    return {
        "products": items,
        "spec_matrix": matrix,
        "comparison_note": (
            "Detailed product specs have not been populated yet. "
            "The matrix reflects basic attributes only."
            if not any(
                bool(it["specs"].keys() - {"Warranty", "Return window",
                                            "Weight", "Rating", "Stock"})
                for it in items
            )
            else None
        ),
    }


def tool_list_categories(args: dict, request) -> dict:
    return {
        "categories": [
            {"name": c.name, "slug": c.slug}
            for c in catalog_services.get_categories()
        ]
    }


def tool_list_brands(args: dict, request) -> dict:
    return {
        "brands": [
            {"name": b.name, "slug": b.slug}
            for b in catalog_services.get_brands()
        ]
    }


def tool_get_shipping_quote(args: dict, request) -> dict:
    county = (args.get("county") or "").strip()

    Zone = None
    for label in ("shipping", "dashboard.shipping", "dashboard_shipping"):
        try:
            Zone = django_apps.get_model(label, "Zone")
            break
        except LookupError:
            continue

    if Zone is None:
        return {
            "county": county or "all",
            "per_county_rates_available": False,
            "policy": POLICIES.get("delivery", ""),
            "note": (
                "Per-county shipping rates are not configured in this "
                "store yet. Quote the general delivery policy and suggest "
                "contacting support on WhatsApp for a specific county quote."
            ),
        }

    if not county:
        zones = Zone.objects.prefetch_related("rates")[:20]
        return {
            "zones": [
                {
                    "name": z.name,
                    "region": getattr(z, "region", ""),
                    "counties": getattr(z, "counties", ""),
                    "rates": [
                        {
                            "method": getattr(
                                r, "method_name", getattr(r, "method", "")
                            ),
                            "price": str(r.price),
                            "eta": getattr(r, "eta", ""),
                        }
                        for r in z.rates.all()
                    ],
                }
                for z in zones
            ]
        }

    zone = (
        Zone.objects.filter(counties__icontains=county)
        .prefetch_related("rates")
        .first()
    )
    if not zone:
        return {
            "county": county,
            "available": False,
            "message": f"No specific rate for {county}. Contact support for a quote.",
        }

    return {
        "county": county,
        "available": True,
        "zone": zone.name,
        "rates": [
            {
                "method": getattr(r, "method_name", getattr(r, "method", "")),
                "price": str(r.price),
                "eta": getattr(r, "eta", ""),
            }
            for r in zone.rates.all()
        ],
    }


def tool_get_shop_policies(args: dict, request) -> dict:
    topic = args.get("topic") or "all"
    if topic == "all":
        return {"policies": POLICIES}
    if topic not in POLICIES:
        return {"error": "UNKNOWN_TOPIC", "available": list(POLICIES.keys())}
    return {"topic": topic, "policy": POLICIES[topic]}


def tool_get_active_promotions(args: dict, request) -> dict:
    Coupon = None
    for label in ("checkout", "direct_orders", "campaigns"):
        try:
            Coupon = django_apps.get_model(label, "Coupon")
            break
        except LookupError:
            continue

    if Coupon is None:
        return {"promotions": [], "message": "No promotions configured."}

    now = timezone.now()
    qs = Coupon.objects.all()
    field_names = {f.name for f in Coupon._meta.get_fields()}

    for f in ("is_active", "active", "enabled"):
        if f in field_names:
            qs = qs.filter(**{f: True})
            break

    for f in ("expires_at", "valid_until", "end_date"):
        if f in field_names:
            qs = qs.filter(
                Q(**{f"{f}__isnull": True}) | Q(**{f"{f}__gte": now})
            )
            break

    coupons = qs.order_by("-id")[:10]

    promotions = []
    for c in coupons:
        code = getattr(c, "code", "") or getattr(c, "coupon_code", "")
        if not code:
            continue
        promotions.append({
            "code": code,
            "description": getattr(c, "description", ""),
            "percent_off": str(
                getattr(c, "percent_off", "")
                or getattr(c, "discount_percent", "")
                or getattr(c, "percentage", "")
            ),
            "min_order": str(
                getattr(c, "min_order", "")
                or getattr(c, "min_order_amount", "")
            ),
            "expires_at": (
                c.expires_at.isoformat()
                if hasattr(c, "expires_at") and getattr(c, "expires_at", None)
                else None
            ),
        })

    return {"promotions": promotions}


def tool_get_my_profile(args: dict, request) -> dict:
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return {"error": "NOT_AUTHENTICATED"}

    return {
        "first_name": getattr(user, "first_name", ""),
        "last_name": getattr(user, "last_name", ""),
        "email": getattr(user, "email", ""),
        "phone": getattr(user, "phone", ""),
        "date_joined": (
            user.date_joined.isoformat()
            if getattr(user, "date_joined", None)
            else ""
        ),
    }


def tool_get_my_orders(args: dict, request) -> dict:
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return {"error": "NOT_AUTHENTICATED"}

    limit = min(int(args.get("limit") or 5), 10)
    qs = Order.objects.filter(user=user).order_by("-created_at")
    if args.get("status"):
        qs = qs.filter(status=args["status"])

    return {
        "orders": [
            {
                "reference": o.reference,
                "status": o.status,
                "payment_status": getattr(o, "payment_status", ""),
                "total": str(getattr(o, "total", "")),
                "created_at": o.created_at.isoformat(),
            }
            for o in qs[:limit]
        ]
    }


def tool_get_my_order_detail(args: dict, request) -> dict:
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return {"error": "NOT_AUTHENTICATED"}

    reference = args.get("reference") or ""
    order = Order.objects.filter(user=user, reference=reference).first()
    if not order:
        return {"error": "ORDER_NOT_FOUND"}

    return {
        "reference": order.reference,
        "status": order.status,
        "payment_status": getattr(order, "payment_status", ""),
        "total": str(getattr(order, "total", "")),
        "courier": getattr(order, "courier", ""),
        "tracking_number": getattr(order, "tracking_number", ""),
        "created_at": order.created_at.isoformat(),
    }


TOOL_EXECUTORS = {
    "search_products":       tool_search_products,
    "get_product":           tool_get_product,
    "compare_products":      tool_compare_products,
    "list_categories":       tool_list_categories,
    "list_brands":           tool_list_brands,
    "get_shipping_quote":    tool_get_shipping_quote,
    "get_shop_policies":     tool_get_shop_policies,
    "get_active_promotions": tool_get_active_promotions,
    "get_my_profile":        tool_get_my_profile,
    "get_my_orders":         tool_get_my_orders,
    "get_my_order_detail":   tool_get_my_order_detail,
}


def execute_tool(name: str, args: dict, request) -> dict:
    executor = TOOL_EXECUTORS.get(name)
    if not executor:
        return {"error": "UNKNOWN_TOOL", "name": name}
    try:
        return executor(args, request)
    except Exception as exc:
        logger.exception("AI tool %s failed: %s", name, exc)
        return {"error": "TOOL_ERROR", "name": name}


def get_or_create_session(session_id, user) -> ChatSession:
    if session_id:
        session = ChatSession.objects.filter(id=session_id).first()
        if session:
            if user and user.is_authenticated and session.user_id is None:
                session.user = user
                session.save(update_fields=["user", "updated_at"])
            return session

    return ChatSession.objects.create(
        user=user if (user and user.is_authenticated) else None,
    )


def build_history(session: ChatSession) -> list[dict]:
    msgs = list(
        session.messages.order_by("-created_at")[: HISTORY_TURNS * 2]
    )
    msgs.reverse()
    return [{"role": m.role, "content": m.content} for m in msgs]


class ChatTurnResult:
    def __init__(self, session, text, products, chips, requires_auth):
        self.session = session
        self.text = text
        self.products = products
        self.chips = chips
        self.requires_auth = requires_auth


def _derive_chips(tools_called: list[str]) -> list[str]:
    seen: list[str] = []
    for name in tools_called:
        for chip in CHIPS_BY_TOOL.get(name, []):
            if chip not in seen:
                seen.append(chip)
    if not seen:
        seen = list(DEFAULT_CHIPS)
    return seen[:3]


def run_chat_turn(session: ChatSession, user_message: str, request) -> ChatTurnResult:
    is_authenticated = bool(
        request
        and getattr(request, "user", None)
        and request.user.is_authenticated
    )

    ChatMessage.objects.create(
        session=session, role=ChatMessage.ROLE_USER, content=user_message,
    )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(build_history(session))
    messages.append({"role": "user", "content": user_message})

    tools = build_tool_schemas(is_authenticated)

    collected_products_by_id: dict[str, dict] = {}
    collected_product_ids: list[str] = []
    tools_called: list[str] = []
    requires_auth = False
    final_text = ""

    for _ in range(MAX_TOOL_ITERATIONS):
        response = call_model(messages, tools)
        choice = response.choices[0].message
        tool_calls = getattr(choice, "tool_calls", None) or []

        if not tool_calls:
            final_text = (choice.content or "").strip()
            break

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
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            tools_called.append(name)
            result = execute_tool(name, args, request)

            if isinstance(result, dict) and result.get("error") == "NOT_AUTHENTICATED":
                requires_auth = True

            if isinstance(result, dict):
                for p in result.get("products", []) or []:
                    pid = p.get("id")
                    if pid:
                        collected_products_by_id[pid] = p
                        if pid not in collected_product_ids:
                            collected_product_ids.append(pid)
                single = result.get("product")
                if single and single.get("id"):
                    collected_products_by_id[single["id"]] = single
                    if single["id"] not in collected_product_ids:
                        collected_product_ids.append(single["id"])

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, default=str),
            })

    if not final_text:
        final_text = (
            "I'm having trouble finding that right now. "
            "Try rephrasing, or browse the catalog directly."
        )

    products = [collected_products_by_id[pid] for pid in collected_product_ids[:6]]

    ChatMessage.objects.create(
        session=session, role=ChatMessage.ROLE_ASSISTANT, content=final_text,
    )
    session.save(update_fields=["updated_at"])

    return ChatTurnResult(
        session=session,
        text=final_text,
        products=products,
        chips=_derive_chips(tools_called),
        requires_auth=requires_auth,
    )