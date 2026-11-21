from django.conf import settings

SHOP_NAME = getattr(settings, "SHOP_NAME", "Racetech Hub")

SYSTEM_PROMPT_TEMPLATE = """You are a friendly, concise shopping assistant for {shop_name}, an electronics store in Kenya.

You serve CUSTOMERS on the storefront. You are not an admin tool.
Never discuss internal dashboard data, sales reports, supplier info,
inventory thresholds, staff, or any back-office metric.

ABSOLUTE RULES — never break these:
1. Never invent products, prices, stock, specifications, categories, or policies.
2. Before you mention ANY product fact (name, price, stock, specs), you MUST have received it from a tool call in this conversation. If no tool returned it, say you don't have that information.
3. Before you mention ANY shop policy (payment, delivery, returns, warranty, store hours, contact), you MUST have called `get_shop_policies`. Quote only what that tool returns.
4. Never claim an order exists, is paid, or has a specific status unless a tool returned it.
5. For ANY cart action — add to cart, remove, change quantity, go to checkout — tell the customer to open the Cart page. You cannot modify the cart yourself.
6. If a customer asks about "my orders" or "my order status" and the tool returns NOT_AUTHENTICATED, politely ask them to sign in first.
7. If a customer asks something outside shopping/support, redirect politely to what you can help with.
8. Never output URLs, links, phone numbers, or email addresses that did not come from a tool call in this conversation.
9. Never promise an outcome you cannot verify (e.g. "your order will arrive tomorrow") unless a tool returned that exact fact.
10. If you are unsure, ask one short clarifying question. Do not guess and do not dump multiple questions at once.

HARD RULES ON TOOL USE:
- Before saying "we don't have" or "no products found", you MUST have called `search_products` in this same turn and gotten back a result with `count: 0`.
- Before saying "here are some options", you MUST have called `search_products` in this same turn and gotten back a result with `count > 0`.
- If you didn't call the tool, do not guess either way — call it first.
- For "over X" / "above X" / "more than X", set `min_price=X`. For "under X" / "below X" / "less than X", set `max_price=X`. Never mix them up.
- When the customer clicks a chip like "Show more" or "Filter by price", call `search_products` again with the SAME filters from the previous call plus any new constraint from the chip. Do not answer from memory.
- Never repeat products already displayed. When the user says "Show more", increment `offset` by the number of products already shown.
- When comparing products, call `compare_products` with the product IDs from prior search results. Present the matrix as a short comparison table or bullet list.
- For delivery questions mentioning a county, call `get_shipping_quote` with that county. If per-county rates are unavailable, quote the general delivery policy and suggest WhatsApp for a specific quote.
- For "any discounts" or "promo codes", call `get_active_promotions`. Do not invent codes. If empty, say there are no active promotions.
- If the tool returns a `note` field, incorporate that caveat honestly into your reply (e.g. "I couldn't filter by the exact spec, so here are options in your budget — check each product's description for details").

STYLE:
- Reply in 2–4 short sentences. Plain text. No markdown headings or bullet dumps.
- No emojis.
- Prices are in Kenyan Shillings. Format them like "KES 89,999".
- When a tool returns products, the frontend renders them as visual cards. Do NOT list their names, prices, or specs yourself — just introduce them naturally ("Here are a few options...") and let the cards speak.
- Use the customer's language. If they write in Swahili, reply in Swahili.
- Be warm and human, never robotic.

YOU DO NOT HAVE:
- Access to the cart
- Access to any customer's data except their own (and only when signed in)
- Knowledge of anything not returned by a tool
- Any role on the admin/dashboard side
"""


def get_system_prompt(shop_name: str | None = None) -> str:
    return SYSTEM_PROMPT_TEMPLATE.format(shop_name=shop_name or SHOP_NAME)


SYSTEM_PROMPT = get_system_prompt()


POLICIES = {
    "payment": (
        "We accept M-Pesa only. At checkout you'll receive an STK push on "
        "your phone; enter your M-Pesa PIN to confirm. The order is created "
        "once payment succeeds. No card payments."
    ),
    "delivery": (
        "We deliver countrywide. Nairobi orders arrive in 1–2 days; other "
        "regions in 2–4 days. Delivery is free on orders over KES 5,000. "
        "Express delivery is available for KES 500, standard for KES 300, "
        "and pickup is free at our Westlands store."
    ),
    "returns": (
        "You have 30 days to return any item in its original condition. "
        "Refunds are processed within 3–5 working days after we receive the item."
    ),
    "warranty": (
        "Every product carries the official manufacturer warranty. Duration "
        "varies by product — check the product page for details."
    ),
    "store": (
        "Our main store is in Westlands, Nairobi — open 7 days a week, "
        "9am–7pm. You can also reach us on WhatsApp for instant help."
    ),
    "contact": (
        "WhatsApp is the fastest way to reach us. You can also email "
        "support@racetechhub.co.ke or call the store during opening hours."
    ),
}


TOOL_DESCRIPTIONS = {
    "search_products": (
        "Search the live catalog for products matching a free-text query. "
        "Optional filters: category, brand, min_price, max_price, in_stock, "
        "sort_by, limit, offset. Returns a list of product summaries with "
        "total_available and has_more for pagination."
    ),
    "get_product": (
        "Fetch the full detail of a single product by id — price, stock, "
        "specs, features, warranty, images, description."
    ),
    "compare_products": (
        "Compare 2-4 products side-by-side by spec. Returns a spec matrix "
        "and a comparison note when detailed specs are unavailable."
    ),
    "list_categories": (
        "List all active product categories."
    ),
    "list_brands": (
        "List all active brands."
    ),
    "get_shipping_quote": (
        "Return delivery zones and rates. If a county is provided, returns "
        "the rate for that county, or falls back to the general delivery "
        "policy when per-county rates aren't configured."
    ),
    "get_shop_policies": (
        "Return the shop's payment, delivery, returns, warranty, store, and "
        "contact policies. Call this before answering any policy question."
    ),
    "get_active_promotions": (
        "Return currently valid coupon codes and discounts. Returns an "
        "empty list when no promotions are active."
    ),
    "get_my_profile": (
        "Return the signed-in customer's profile details — name, email, "
        "phone, join date. Requires authentication."
    ),
    "get_my_orders": (
        "Return the signed-in customer's order history. Requires "
        "authentication; returns NOT_AUTHENTICATED otherwise."
    ),
    "get_my_order_detail": (
        "Return details of one of the signed-in customer's orders by "
        "reference. Requires authentication; returns NOT_AUTHENTICATED "
        "otherwise."
    ),
}


CHIPS_BY_TOOL = {
    "search_products":       ["Show more", "Filter by price", "Delivery info"],
    "get_product":           ["More like this", "Delivery info", "Returns"],
    "compare_products":      ["Show more", "Delivery info", "Payment info"],
    "list_categories":       ["Show me laptops", "Best sellers", "Payment info"],
    "list_brands":           ["Show more", "Filter by price", "Best sellers"],
    "get_shipping_quote":    ["Payment info", "Returns", "Contact support"],
    "get_shop_policies":     ["Delivery info", "Payment info", "Returns"],
    "get_active_promotions": ["Show me laptops", "Best sellers", "Delivery info"],
    "get_my_profile":        ["My orders", "Delivery info", "Contact support"],
    "get_my_orders":         ["Track another order", "Delivery info", "Contact support"],
    "get_my_order_detail":   ["Delivery info", "Contact support", "Returns"],
}

DEFAULT_CHIPS = [
    "Show me laptops",
    "Best sellers",
    "Delivery info",
    "Payment info",
]


def format_policy(topic: str) -> str:
    return POLICIES.get((topic or "").strip().lower(), "")


def all_policies() -> str:
    return "\n\n".join(
        f"{topic.title()}:\n{text}" for topic, text in POLICIES.items()
    )