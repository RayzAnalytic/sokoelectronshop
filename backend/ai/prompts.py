"""
System prompt + shop policy text + chip rules.

Policies live here (not in a model) because they change rarely and the
shop owner edits them through code review. Promote to a model only if
non-developers need to edit them.
"""

SHOP_NAME = "Myelectronicshop"


SYSTEM_PROMPT = """You are a friendly, concise shopping assistant for {shop_name}, an electronics store in Kenya.

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
""".format(shop_name=SHOP_NAME)


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
        "support@myshop.co.ke or call the store during opening hours."
    ),
}


# Descriptions surfaced to the LLM when tools are registered. Kept here so
# the wording (which shapes how the model uses each tool) lives next to the
# rules that reference it.
TOOL_DESCRIPTIONS = {
    "search_products": (
        "Search the live catalog for products matching a free-text query. "
        "Optional filters: category, brand, min_price, max_price, in_stock. "
        "Returns a list of product summaries."
    ),
    "get_product": (
        "Fetch the full detail of a single product by id — price, stock, "
        "specs, images, description."
    ),
    "list_categories": (
        "List all active product categories."
    ),
    "list_brands": (
        "List all active brands."
    ),
    "get_shop_policies": (
        "Return the shop's payment, delivery, returns, warranty, store, and "
        "contact policies. Call this before answering any policy question."
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
    "search_products":      ["Show more", "Filter by price", "Delivery info"],
    "get_product":          ["More like this", "Delivery info", "Returns"],
    "list_categories":      ["Show me laptops", "Best sellers", "Payment info"],
    "list_brands":          ["Show more", "Filter by price", "Best sellers"],
    "get_shop_policies":    ["Delivery info", "Payment info", "Returns"],
    "get_my_orders":        ["Track another order", "Delivery info", "Contact support"],
    "get_my_order_detail":  ["Delivery info", "Contact support", "Returns"],
}

DEFAULT_CHIPS = [
    "Show me laptops",
    "Best sellers",
    "Delivery info",
    "Payment info",
]


def format_policy(topic: str) -> str:
    """
    Return a single policy sentence for the given topic, or an empty string
    if the topic is unknown. Used by the `get_shop_policies` tool when the
    caller asks about one specific area.
    """
    return POLICIES.get((topic or "").strip().lower(), "")


def all_policies() -> str:
    """
    Return every policy as one block, labelled by topic. Used when the
    customer asks a general policy question without naming a topic.
    """
    return "\n\n".join(
        f"{topic.title()}:\n{text}" for topic, text in POLICIES.items()
    )