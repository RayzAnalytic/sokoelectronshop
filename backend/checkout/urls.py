"""
checkout/urls.py

Mounted at /api/v1/checkout/ in config/urls.py.

Route grouping:

    config/, validate-coupon/    — read-only pricing probes
    payment-methods/              — enabled methods (settings-driven)  ← NEW
    orders/                       — COD order creation (guest + auth)
    payments/                     — M-Pesa STK, poll, cancel, by-reference
    cart/                         — server-side cart (auth only)
    mpesa/callback/, mpesa/timeout/ — Safaricom webhooks (public)

Route ordering matters for the payments block:
    Literal routes (`stk-push/`, `by-reference/<ref>/`) are listed
    BEFORE the generic `<uuid:pk>/` route. Django resolves top-down,
    and `<uuid:...>` would reject the literal strings anyway — but
    the explicit ordering documents the routing intent so a future
    edit can't accidentally reorder them and break URL resolution.

MPESA URLS MUST MATCH SETTINGS:
    `mpesa/callback/` and `mpesa/timeout/` produce the full paths

        {BACKEND_PUBLIC_URL}/api/v1/checkout/mpesa/callback/
        {BACKEND_PUBLIC_URL}/api/v1/checkout/mpesa/timeout/

    These must match `settings.MPESA_CALLBACK_URL` and
    `settings.MPESA_TIMEOUT_URL` character-for-character, including
    the trailing slash. A mismatch means Safaricom POSTs to a 404 and
    the payment stays PROCESSING until the sweep times it out.

SETTINGS-DRIVEN ROUTES:
    `config/` and `payment-methods/` read from the cached settings
    bundle so the frontend sees the shop's current rules. When the
    shop owner toggles M-Pesa off, or changes the free-shipping
    threshold, the next fetch of either endpoint reflects the change
    immediately — no server restart, no client redeploy.
"""

from django.urls import path

from . import views

app_name = "checkout"

urlpatterns = [
    # ── Config + coupon ────────────────────────────────────────────────
    # Read-only pricing probes. `config/` returns the full checkout
    # configuration (counties, fees, tax, checkout rules, currency);
    # `validate-coupon/` is a POST-only coupon check that returns a
    # `valid: bool` envelope rather than an HTTP error for invalid
    # codes — the frontend renders the message inline.
    path("config/", views.CheckoutConfigView.as_view(), name="config"),
    path(
        "validate-coupon/",
        views.CouponValidateView.as_view(),
        name="validate-coupon",
    ),

    # ── Payment methods (settings-driven) ─────────────────────────────
    # Returns ONLY the methods the shop owner has enabled in
    # Settings → Store → Payments. The cart page calls this once on
    # mount and renders exactly what the shop supports — no hardcoded
    # method list on the client.
    #
    # Also exposes the shop's min/max order bounds and flat transaction
    # fee so the cart page can disable checkout below the minimum or
    # warn above the maximum before the customer submits.
    path(
        "payment-methods/",
        views.PaymentMethodsView.as_view(),
        name="payment-methods",
    ),

    # ── Orders (COD path) ──────────────────────────────────────────────
    # Creates an Order without initiating payment. Used by the
    # pay-on-delivery option on the checkout page. Returns a minimal
    # response with the server-generated `reference` that the success
    # page then uses as `/pages/order-success/<reference>`.
    #
    # The service layer enforces `checkout.allow_guest_checkout` and
    # `checkout.require_phone` here. When guest checkout is disabled,
    # anonymous callers receive a 400 with a customer-readable message
    # — not a 403 or a redirect. The frontend shows the message inline.
    path(
        "orders/",
        views.OrderCreateView.as_view(),
        name="order-create",
    ),

    # ── Payments ───────────────────────────────────────────────────────
    # `stk-push` and `by-reference` are listed before the generic
    # `<uuid:pk>` route. Django tries patterns top-down, and while the
    # `uuid` converter would reject literal strings like "stk-push" on
    # its own, keeping the specific routes first makes the routing
    # intent obvious to anyone reading this file.
    #
    # `stk-push/` — the service enforces `payments.mpesa_enabled`.
    # When M-Pesa is disabled, the response is 400 code=checkout_error
    # with the message "M-Pesa is currently unavailable. Please choose
    # Cash on Delivery." The frontend hides the button anyway (via
    # `payment-methods/`), but the API gate is the source of truth.
    path(
        "payments/stk-push/",
        views.StkPushView.as_view(),
        name="stk-push",
    ),
    path(
        "payments/by-reference/<str:reference>/",
        views.PaymentByReferenceView.as_view(),
        name="payment-by-reference",
    ),
    path(
        "payments/<uuid:pk>/",
        views.PaymentDetailView.as_view(),
        name="payment-detail",
    ),
    path(
        "payments/<uuid:pk>/cancel/",
        views.PaymentCancelView.as_view(),
        name="payment-cancel",
    ),

    # ── Cart (authenticated) ───────────────────────────────────────────
    # Anonymous carts live in the browser (Zustand / localStorage).
    # After login, the frontend calls `cart-merge` once and clears its
    # local store. After that, the backend is authoritative.
    #
    # Route ordering:
    #   * `cart/` and `cart/items/` are literals.
    #   * `cart/items/<int:item_id>/` uses an int converter, so a
    #     literal like "items" can never match it.
    #   * `cart/merge/` is a literal and does NOT collide with
    #     `cart/items/...`.
    #
    # NOTE on `cart/items/<int:item_id>/`:
    #   A single view (`CartItemDetailView`) handles both PATCH
    #   (set quantity) and DELETE (remove line). Django routes by path,
    #   not by method, and does NOT fall through to the next pattern
    #   when a view returns 405 — so splitting these into two views on
    #   the same path would leave DELETE unreachable.
    path(
        "cart/",
        views.CartView.as_view(),
        name="cart",
    ),
    path(
        "cart/items/",
        views.CartItemAddView.as_view(),
        name="cart-item-add",
    ),
    path(
        "cart/items/<int:item_id>/",
        views.CartItemDetailView.as_view(),
        name="cart-item-detail",
    ),
    path(
        "cart/merge/",
        views.CartMergeView.as_view(),
        name="cart-merge",
    ),

    # ── M-Pesa callbacks (public — Safaricom cannot hold a session) ────
    path(
        "mpesa/callback/",
        views.MpesaCallbackView.as_view(),
        name="mpesa-callback",
    ),
    path(
        "mpesa/timeout/",
        views.MpesaTimeoutView.as_view(),
        name="mpesa-timeout",
    ),
]