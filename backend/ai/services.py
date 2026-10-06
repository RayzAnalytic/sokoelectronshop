"""
Tool-calling orchestration over the existing catalog/checkout services.

Everything the model learns about products, policies, or orders comes
through one of the tool functions in this module. Nothing is duplicated
from other apps.

Provider support:
  Set AI_PROVIDER in .env to one of: "groq", "gemini", "xai", "openrouter".
  All four expose an OpenAI-compatible endpoint, so the same openai SDK
  works against all of them. The only differences are the base URL, the
  API key env var, and the model string.
"""
import json
import logging
import os

from django.conf import settings

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


# ═════════════════════════════════════════════════════════════════════════════
# Typed exceptions — the view maps these to HTTP status codes
# ═════════════════════════════════════════════════════════════════════════════
class AIConfigurationError(RuntimeError):
    """The AI app is missing a required setting (e.g. API key)."""


class AIRateLimitError(RuntimeError):
    """The provider rejected the request because of a quota or rate limit."""


class AIProviderUnavailableError(RuntimeError):
    """The provider returned an error or the connection failed."""


# ═════════════════════════════════════════════════════════════════════════════
# Provider registry
#
# Each entry maps a provider name to the base URL, API-key env var, and
# the default model string. Override any of them via .env without touching
# this file.
# ═════════════════════════════════════════════════════════════════════════════
PROVIDERS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "key_env": "GROQ_API_KEY",
        # llama-3.3-70b-versatile was retired by Groq in Aug 2026.
        # openai/gpt-oss-120b is the current free-tier replacement.       # ← FIXED
        "default_model": "openai/gpt-oss-120b",
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "key_env": "GEMINI_API_KEY",
        "default_model": "gemini-2.5-flash",
    },
    "xai": {
        "base_url": "https://api.x.ai/v1",
        "key_env": "XAI_API_KEY",
        "default_model": "grok-2-latest",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "key_env": "OPENROUTER_API_KEY",
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
    base_url = getattr(settings, "AI_BASE_URL", "") or cfg["base_url"]
    model = getattr(settings, "AI_MODEL", "") or cfg["default_model"]
    key = getattr(settings, cfg["key_env"], "") or os.getenv(cfg["key_env"], "")
    return {"base_url": base_url, "model": model, "key": key, "key_env": cfg["key_env"]}


# ═════════════════════════════════════════════════════════════════════════════
# LLM client
# ═════════════════════════════════════════════════════════════════════════════
def _get_client():
    """Lazy import so the openai package isn't required at module load."""
    from openai import OpenAI

    provider = _active_provider()
    cfg = _provider_config(provider)

    if not cfg["key"]:
        raise AIConfigurationError(
            f"{cfg['key_env']} is not configured for provider {provider!r}. "
            f"Add it to your .env file."
        )

    return OpenAI(api_key=cfg["key"], base_url=cfg["base_url"])


def call_model(messages: list[dict], tools: list[dict]):
    """
    Single call into the configured LLM provider.

    Translates the OpenAI SDK's exceptions into the app's typed errors
    so the view can respond with the right HTTP status code.
    """
    from openai import RateLimitError, APIError, APIConnectionError

    client = _get_client()
    provider = _active_provider()
    cfg = _provider_config(provider)

    kwargs = {
        "model": cfg["model"],
        "messages": messages,
        "tools": tools or None,
        "tool_choice": "auto" if tools else None,
        "temperature": 0.3,
        "max_tokens": 600,
    }

    # OpenRouter requires a Referer header on some free-tier calls.
    if provider == "openrouter":
        kwargs["extra_headers"] = {
            "HTTP-Referer": getattr(settings, "FRONTEND_URL", "http://localhost:3000"),
            "X-Title": "Myshop AI Assistant",
        }

    try:
        return client.chat.completions.create(**kwargs)
    except RateLimitError as exc:
        logger.warning("AI provider rate limit (%s): %s", provider, exc)
        raise AIRateLimitError(
            "The assistant is receiving too many requests right now. "
            "Please wait a moment and try again."
        ) from exc
    except APIConnectionError as exc:
        logger.warning("AI provider connection error (%s): %s", provider, exc)
        raise AIProviderUnavailableError(
            "The assistant is temporarily unreachable. Please try again."
        ) from exc
    except APIError as exc:
        logger.error("AI provider API error (%s): %s", provider, exc)
        raise AIProviderUnavailableError(
            "The assistant is temporarily unavailable. Please try again shortly."
        ) from exc


# ═════════════════════════════════════════════════════════════════════════════
# Tool schemas
# ═════════════════════════════════════════════════════════════════════════════
def build_tool_schemas(is_authenticated: bool) -> list[dict]:
    tools = [
        {
            "type": "function",
            "function": {
                "name": "search_products",
                "description": (
                    "Search the live product catalog. Use this for any "
                    "request about products, prices, brands, categories, "
                    "stock, or recommendations."
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
                        "limit": {"type": "integer", "minimum": 1, "maximum": 8},
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
    ]

    if is_authenticated:
        tools.extend([
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
                            "limit": {"type": "integer", "minimum": 1, "maximum": 10},
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


# ═════════════════════════════════════════════════════════════════════════════
# Tool executors
# ═════════════════════════════════════════════════════════════════════════════
def _product_card(product: Product, request=None) -> dict:
    """Minimal card the frontend can render directly."""
    image_url = ""
    first = product.images.first()
    if first and first.image:
        image_url = first.image.url
        if request is not None:
            image_url = request.build_absolute_uri(image_url)

    return {
        "id": product.id,
        "name": product.name,
        "brand": product.brand.name,
        "category": product.category.name,
        "price": str(product.price),
        "compareAtPrice": (
            str(product.compare_at_price) if product.compare_at_price else None
        ),
        "images": [image_url] if image_url else [],
        "stock": product.stock_status,
        "url": f"/pages/products?open={product.id}",
    }


def _serialize_product_list(qs, limit: int, request=None) -> dict:
    products = list(qs[:limit])
    return {
        "count": len(products),
        "products": [_product_card(p, request=request) for p in products],
    }


def tool_search_products(args: dict, request) -> dict:
    limit = min(int(args.get("limit") or 5), 8)

    qs = catalog_services.get_products(
        search=args.get("query"),
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

    result = _serialize_product_list(qs, limit, request=request)
    if result["count"] == 0:
        result["message"] = "No products matched those filters."
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


def tool_get_shop_policies(args: dict, request) -> dict:
    topic = args.get("topic") or "all"
    if topic == "all":
        return {"policies": POLICIES}
    if topic not in POLICIES:
        return {"error": "UNKNOWN_TOPIC", "available": list(POLICIES.keys())}
    return {"topic": topic, "policy": POLICIES[topic]}


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
    "search_products":     tool_search_products,
    "get_product":         tool_get_product,
    "list_categories":     tool_list_categories,
    "list_brands":         tool_list_brands,
    "get_shop_policies":   tool_get_shop_policies,
    "get_my_orders":       tool_get_my_orders,
    "get_my_order_detail": tool_get_my_order_detail,
}


def execute_tool(name: str, args: dict, request) -> dict:
    executor = TOOL_EXECUTORS.get(name)
    if not executor:
        return {"error": "UNKNOWN_TOOL", "name": name}
    try:
        return executor(args, request)
    except Exception as exc:  # noqa: BLE001
        logger.exception("AI tool %s failed: %s", name, exc)
        return {"error": "TOOL_ERROR", "name": name}


# ═════════════════════════════════════════════════════════════════════════════
# Session + history
# ═════════════════════════════════════════════════════════════════════════════
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


# ═════════════════════════════════════════════════════════════════════════════
# Main entry point
# ═════════════════════════════════════════════════════════════════════════════
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
                    collected_products_by_id[p["id"]] = p
                    if p["id"] not in collected_product_ids:
                        collected_product_ids.append(p["id"])
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