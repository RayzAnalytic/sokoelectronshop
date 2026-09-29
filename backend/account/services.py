from django.utils import timezone

from .models import Address, Notification, WishlistItem


# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────
def notify(user, *, type, title, body="", href="", metadata=None):
    """Create a notification. Single entry point so future channels
    (email, SMS, push) can attach here without touching call sites.

    Called from `checkout.services.transition_payment` on payment success
    and failure. The `href` is a frontend path the notification links to.
    """
    return Notification.objects.create(
        user=user,
        type=type,
        title=title,
        body=body,
        href=href,
        metadata=metadata or {},
    )


def unread_count(user):
    """Cheap count for the sidebar bell badge and the overview page."""
    return Notification.objects.filter(user=user, is_read=False).count()


def mark_notification_read(notification):
    """Idempotent — sets `read_at` only the first time."""
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
    return notification


# ─────────────────────────────────────────────────────────────────────────────
# Addresses
# ─────────────────────────────────────────────────────────────────────────────
def adopt_address_from_checkout(user, data):
    """Create the user's first address from checkout data if they have none.

    Called from `checkout.services.process_checkout` when a new account is
    created mid-checkout. Idempotent — does nothing if the user already has
    an address (in which case the checkout flow must not touch their book).

    `data` is a flat dict:
        {
          "full_name": "...",
          "phone": "...",
          "street": "...",
          "town": "...",
          "county": "...",
          "postal_code": "...",  # optional
        }
    """
    if Address.objects.filter(user=user).exists():
        return None

    return Address.objects.create(
        user=user,
        label="Home",
        full_name=data.get("full_name", ""),
        phone=data.get("phone", ""),
        street=data["street"],
        town=data["town"],
        county=data["county"],
        postal_code=data.get("postal_code", "") or "",
        is_default=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Reviews
# ─────────────────────────────────────────────────────────────────────────────
def verify_purchase(user, product_id):
    """True if the user has an order containing this product_id.

    Uses a lazy import so this module can be loaded without the checkout
    app being installed. If checkout isn't available, returns False — the
    review is still created, just without the "verified purchase" badge.
    """
    try:
        from checkout.models import OrderItem
    except Exception:
        return False

    return OrderItem.objects.filter(
        order__user=user,
        product_id=product_id,
    ).exists()


# ─────────────────────────────────────────────────────────────────────────────
# Wishlist
# ─────────────────────────────────────────────────────────────────────────────
def wishlist_count(user):
    """Count for the overview page's Wishlist Items stat card."""
    return WishlistItem.objects.filter(user=user).count()