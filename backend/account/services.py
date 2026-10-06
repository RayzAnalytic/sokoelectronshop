"""
account/services.py

Cross-cutting helpers for the customer account area.

Two rules that every function in this module obeys:

  1. Every function that takes a `user` guards against `user is None`.
     Guest orders flow through several of these code paths (via the
     claim-guest-orders signal), and the caller shouldn't have to
     null-check at every site.

  2. Every state change that involves more than one row is wrapped in
     a transaction. Address default promotion, order cancellation, and
     receipt confirmation all mutate multiple rows — a partial write
     would leave the data inconsistent.

SETTINGS AWARENESS
==================
    This module reads from the cached settings bundle in three places:

      * `reviews.reviews_enabled`     — gates the review prompt on
                                        delivered orders and short-
                                        circuits `get_pending_reviews`

      * `notifications.email_enabled` — documented for the future
                                        outbound pass (see below)

      * `notifications.whatsapp_enabled` — same

    Read through `_settings()` with a fallback to "on" so management
    commands, tests, and the first migration never crash.

Notification architecture:

  `notify()` is the single entry point for in-app notification writes.
  Every other helper in this file (typed per event) calls into it. No
  code outside this module should touch `Notification.objects.create`.

  Notifications carry a `dedup_key` — a deterministic string like
  `"order:ORD-20260101-ABCD:shipped"` — that makes delivery idempotent.
  Retried webhooks, admin double-clicks, and status replays all resolve
  to the same row. The key lives in a dedicated indexed column, not in
  the metadata JSON, so the lookup is O(log n) rather than a scan.

  CHANNEL PREFERENCES (current state):
    In-app notification rows are ALWAYS written, regardless of the
    shop's channel settings. That is deliberate: the customer's bell
    badge and the notifications page should show every event that
    happened to their account, whether or not the shop also fired an
    outbound email or WhatsApp about it.

    The `notifications.email_enabled` and `notifications.whatsapp_enabled`
    settings gate OUTBOUND delivery, not in-app recording. Wiring that
    gate into `notify()` is a future pass — when it lands, `notify()`
    will:

      1. Write the in-app row (unchanged)
      2. If `email_enabled` and the user has an email — queue an email
      3. If `whatsapp_enabled` and the user has a phone — queue WhatsApp

    Both helpers `_email_enabled()` and `_whatsapp_enabled()` are
    declared here today so the wiring can drop in without a signature
    change.

Review moderation:

  The admin Reviews page (`dashboard.reviews`) calls into the review
  functions at the bottom of this file. Every moderation action goes
  through a service function — the view is a thin wrapper. That keeps
  the side effects (customer notification, product rating recompute)
  in one place and prevents an admin view from silently skipping them.

  When `reviews.reviews_enabled` is False:

    * The storefront review submission path is gated upstream (in
      `catalog.services.get_reviews_for_product`), so no new pending
      reviews arrive.
    * `moderate_review` refuses to publish — a shop with reviews off
      should not be able to flip a stale pending row live. The caller
      gets a clear ValueError instead of a silent no-op.
    * Existing published reviews remain on the storefront (they were
      approved before the setting was turned off). If the shop owner
      wants them gone, that's a separate "purge reviews" action —
      not the flag's job.

AUTOMATIONS (AI & Automations page):

  One event is exported from this module:

      customer.became_vip — fired by `check_vip_promotion(user)` when
                            a customer's lifetime spend crosses
                            `VIP_THRESHOLD_KES`.

  HOW TO WIRE IT:

      # checkout/services.py — inside transition_payment's SUCCESS branch,
      # right after `_fire_event("order.paid", {...})`:

      try:
          from account.services import check_vip_promotion
          check_vip_promotion(payment.order.user)
      except Exception:
          logger.exception(
              "VIP promotion check failed for order %s",
              payment.order.reference,
          )
"""

import logging
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import Address, Notification, Review, ReviewReply, WishlistItem

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# Settings helpers — safe during migrations / cold boot
#
# Every read routes through `_settings()` which returns the cached
# bundle or None. When None, the caller falls back to "on" for every
# boolean — this preserves the pre-settings behavior so management
# commands and tests that don't load the app registry still work.
# ═══════════════════════════════════════════════════════════════════════════
def _settings():
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


def _reviews_enabled() -> bool:
    """
    Storefront reviews flag. Read by `get_pending_reviews`,
    `notify_order_delivered`, and `moderate_review`.
    """
    s = _settings()
    return bool(s['reviews'].reviews_enabled) if s else True


def _email_enabled() -> bool:
    """
    Email channel flag. Not read today — declared so the future
    outbound pass has a single place to consult it.
    """
    s = _settings()
    return bool(s['notifs'].email_enabled) if s else True


def _whatsapp_enabled() -> bool:
    """
    WhatsApp channel flag. Not read today — declared so the future
    outbound pass has a single place to consult it.
    """
    s = _settings()
    return bool(s['notifs'].whatsapp_enabled) if s else True


# ═══════════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════════

# Lifetime spend (KES) at which a customer becomes a VIP. Matches the
# "VIP Customer Alert" pre-built template's trigger description on the
# AI & Automations page. Change here and the template row's description
# will need a matching update.
#
# Not currently a Settings-page field. If it becomes one, add a
# `_vip_threshold()` helper at the top and swap this reference — every
# caller reads through this constant today, so nothing else changes.
VIP_THRESHOLD_KES = Decimal("50000")


# ═══════════════════════════════════════════════════════════════════════════
# Automation dispatch (best-effort side effect)
# ═══════════════════════════════════════════════════════════════════════════
def _fire_event(event_name: str, payload: dict) -> None:
    """
    Hand an event to the AI automations dispatcher. Never raises.
    """
    try:
        from dashboard.aiandautomations.services.automations import dispatch
        dispatch(event_name, payload)
    except Exception:
        logger.exception(
            "Automation dispatch failed for event %s", event_name,
        )


def check_vip_promotion(user) -> bool:
    """
    Fire `customer.became_vip` if the user's lifetime spend has just
    crossed `VIP_THRESHOLD_KES`.

    Stateless: fires whenever the customer's current lifetime spend is
    at or above the threshold. The dispatcher's own deduplication (or
    the automation's conditions) is the right place to silence repeat
    alerts.

    Which orders count
    ------------------
    Only orders where `payment_status == PAID`. Unpaid or refunded
    orders do not contribute to lifetime spend.

    `Order.total` is summed, not `Payment.amount` — an order is the
    customer-facing unit and the sum is stable across partial payments.

    Returns True if the event was fired, False otherwise. Never raises.
    """
    if user is None:
        return False

    try:
        from checkout.models import Order
    except Exception:
        return False

    try:
        agg = (
            Order.objects
            .filter(
                user=user,
                payment_status=Order.PaymentStatus.PAID,
            )
            .aggregate(total=Sum("total"))
        )
        lifetime_spend = agg["total"] or Decimal("0")

        if lifetime_spend < VIP_THRESHOLD_KES:
            return False

        _fire_event(
            "customer.became_vip",
            {
                "customer_id": user.pk,
                "total_spend": float(lifetime_spend),
                "threshold": float(VIP_THRESHOLD_KES),
            },
        )
        return True

    except Exception:
        logger.exception(
            "check_vip_promotion failed for user %s", user.pk,
        )
        return False


# ═══════════════════════════════════════════════════════════════════════════
# Internal helpers
# ═══════════════════════════════════════════════════════════════════════════
def _to_decimal(value, default: str = "0") -> Decimal:
    """
    Coerce a string / number / None into a Decimal.
    """
    if value is None or value == "":
        return Decimal(default)
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


# ═══════════════════════════════════════════════════════════════════════════
# Notifications — generic
# ═══════════════════════════════════════════════════════════════════════════
def notify(user, *, type, title, body="", href="", metadata=None,
           dedup_key=""):
    """
    Create an in-app notification. Idempotent when `dedup_key` is supplied.

    Single entry point so future channels (email, SMS, push) can attach
    here without touching call sites.

    CHANNEL GATING
    --------------
    The `notifications.email_enabled` and `notifications.whatsapp_enabled`
    settings do NOT gate the in-app row this function writes. Every
    notification lands in the customer's bell list regardless of the
    shop's outbound channel preferences — the customer should always be
    able to see what happened to their account.

    Outbound delivery (the email and WhatsApp sends that mirror each
    notification) is gated downstream by those settings. That pass is
    not wired yet; when it lands, it will hook in right here after the
    `Notification.objects.create()` call, using `_email_enabled()` and
    `_whatsapp_enabled()` to decide which outbound channels fire.

    `dedup_key` is a deterministic string. When supplied, a prior
    notification with the same key for the same user is returned
    instead of a new one being created.
    """
    if user is None:
        return None

    if dedup_key:
        existing = Notification.objects.filter(
            user=user,
            dedup_key=dedup_key,
        ).first()
        if existing:
            return existing

    return Notification.objects.create(
        user=user,
        type=type,
        title=title,
        body=body,
        href=href,
        metadata=metadata or {},
        dedup_key=dedup_key or "",
    )


def unread_count(user):
    """Cheap count for the sidebar bell badge and the overview page."""
    if user is None:
        return 0
    return Notification.objects.filter(user=user, is_read=False).count()


def mark_notification_read(notification):
    """Idempotent — sets `read_at` only the first time."""
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
    return notification


def mark_all_read(user):
    """Bulk mark-read. Returns the number of rows touched."""
    if user is None:
        return 0
    return Notification.objects.filter(
        user=user, is_read=False,
    ).update(is_read=True, read_at=timezone.now())


# ═══════════════════════════════════════════════════════════════════════════
# Notifications — order lifecycle
# ═══════════════════════════════════════════════════════════════════════════
def notify_order_placed(user, order):
    """Fires when a new Order row is created."""
    if user is None:
        return None
    return notify(
        user,
        type=Notification.Type.ORDER,
        title=f"Order {order.reference} received",
        body="We've received your order and will confirm it shortly.",
        href=f"/pages/account/orders?ref={order.reference}",
        metadata={"order_reference": order.reference},
        dedup_key=f"order:{order.reference}:placed",
    )


def notify_order_shipped(user, order):
    """
    Fires when the order moves to SHIPPED.

    Caller-side gate: `checkout.services.change_order_status` only calls
    this when `notifications.notify_on_shipped` is True. This function
    does not re-check the flag — one gate, one place.
    """
    if user is None:
        return None
    courier = order.courier or ""
    tracking = order.tracking_number or ""
    body = "Your order is on the way."
    if courier:
        body = f"Handed to {courier}."
    return notify(
        user,
        type=Notification.Type.SHIPPING,
        title=f"Order {order.reference} shipped",
        body=body,
        href=f"/pages/account/orders?ref={order.reference}",
        metadata={
            "order_reference": order.reference,
            "courier": courier,
            "tracking_number": tracking,
        },
        dedup_key=f"order:{order.reference}:shipped",
    )


def notify_order_delivered(user, order):
    """
    Fires the delivery notification and (when reviews are on) the
    review prompt.

    REVIEW PROMPT GATE
    ------------------
    The `reviews.reviews_enabled` setting decides whether the customer
    sees "leave a review" nudge. When the shop owner has turned reviews
    off, asking for one is confusing — the customer navigates to a
    review form that refuses submission.

    The delivered notification itself always fires. Delivery happened;
    the customer should know.
    """
    if user is None:
        return None

    delivered = notify(
        user,
        type=Notification.Type.SHIPPING,
        title=f"Order {order.reference} delivered",
        body="We hope you love it. Tap to see the details.",
        href=f"/pages/account/orders?ref={order.reference}",
        metadata={"order_reference": order.reference},
        dedup_key=f"order:{order.reference}:delivered",
    )

    # Review prompt — only when reviews are enabled shop-wide.
    if _reviews_enabled():
        first_item = order.items.first()
        product_name = first_item.name if first_item else "your purchase"
        product_ids = list(order.items.values_list("product_id", flat=True))

        notify(
            user,
            type=Notification.Type.REVIEW,
            title=f"How was your {product_name}?",
            body="Leave a review and help other shoppers decide.",
            href=f"/pages/account/reviews?order={order.reference}",
            metadata={
                "order_reference": order.reference,
                "product_ids": product_ids,
            },
            dedup_key=f"order:{order.reference}:review_prompt",
        )

    return delivered


def notify_order_cancelled(user, order, reason=""):
    """
    Fires when the order moves to CANCELLED.

    Caller-side gate: `checkout.services.change_order_status` only calls
    this when `notifications.notify_on_cancelled` is True.
    """
    if user is None:
        return None
    return notify(
        user,
        type=Notification.Type.ORDER,
        title=f"Order {order.reference} cancelled",
        body=reason or "Your order was cancelled. No charge was made.",
        href=f"/pages/account/orders?ref={order.reference}",
        metadata={"order_reference": order.reference},
        dedup_key=f"order:{order.reference}:cancelled",
    )


def notify_review_moderated(user, review):
    """
    Fires when a review flips to PUBLISHED or REJECTED.

    Skips silently when the shop has reviews disabled — an admin action
    that only takes effect because someone bypassed the setting does
    not deserve to notify the customer.
    """
    if user is None:
        return None

    if not _reviews_enabled():
        return None

    if review.status == Review.Status.PUBLISHED:
        title = "Your review is live"
        body = f"Your review of {review.product_name} is now published."
    elif review.status == Review.Status.REJECTED:
        title = "Your review needs changes"
        body = (
            review.rejection_reason
            or "Please review our guidelines and resubmit."
        )
    else:
        return None

    return notify(
        user,
        type=Notification.Type.REVIEW,
        title=title,
        body=body,
        href="/pages/account/reviews",
        metadata={
            "review_id": review.id,
            "product_id": review.product_id,
        },
        dedup_key=f"review:{review.id}:{review.status}",
    )


# ═══════════════════════════════════════════════════════════════════════════
# Order lifecycle — customer-initiated transitions
# ═══════════════════════════════════════════════════════════════════════════
@transaction.atomic
def reject_order(user, reference, reason=""):
    """
    Customer cancels an order that has not yet shipped.

    Allowed only while status is PENDING, CONFIRMED, or PROCESSING.
    Once SHIPPED, the customer must go through returns instead.

    Idempotent. Returns the updated Order. Raises ValueError with a
    customer-safe message when the transition is not allowed.
    """
    from checkout.models import Order
    from checkout.services import change_order_status

    order = (
        Order.objects
        .select_for_update()
        .filter(user=user, reference=reference)
        .first()
    )
    if not order:
        raise ValueError("Order not found.")

    allowed = {
        Order.Status.PENDING,
        Order.Status.CONFIRMED,
        Order.Status.PROCESSING,
    }
    if order.status not in allowed:
        if order.status == Order.Status.CANCELLED:
            return order
        raise ValueError(
            "This order has already shipped and cannot be cancelled. "
            "Please request a return after delivery."
        )

    reason_clean = (reason or "").strip()

    return change_order_status(
        order,
        Order.Status.CANCELLED,
        actor=user,
        actor_label="Customer",
        note=reason_clean or "Cancelled by customer.",
    )


@transaction.atomic
def claim_order_received(user, reference):
    """
    Customer confirms receipt of a shipped order.

    Moves SHIPPED → DELIVERED. Idempotent.

    For COD orders, delivery implies payment collected. The payment
    status flips to PAID before the fulfillment transition.

    Returns the updated Order. Raises ValueError with a customer-safe
    message when the transition is not allowed.
    """
    from checkout.models import Order
    from checkout.services import change_order_status

    order = (
        Order.objects
        .select_for_update()
        .filter(user=user, reference=reference)
        .first()
    )
    if not order:
        raise ValueError("Order not found.")

    if order.status == Order.Status.DELIVERED:
        return order

    if order.status != Order.Status.SHIPPED:
        raise ValueError(
            "You can only confirm receipt after the order has shipped."
        )

    if (
        order.payment_method == Order.PaymentMethod.COD
        and order.payment_status == Order.PaymentStatus.UNPAID
    ):
        order.payment_status = Order.PaymentStatus.PAID
        order.save(update_fields=["payment_status"])

    return change_order_status(
        order,
        Order.Status.DELIVERED,
        actor=user,
        actor_label="Customer",
        note="Receipt confirmed by customer.",
    )


# ═══════════════════════════════════════════════════════════════════════════
# Addresses
# ═══════════════════════════════════════════════════════════════════════════
@transaction.atomic
def adopt_address_from_checkout(user, data):
    """
    Create the user's first address from checkout data if they have none.
    """
    if user is None:
        return None

    if Address.objects.filter(user=user).exists():
        return None

    return Address.objects.create(
        user=user,
        label="Home",
        full_name=data.get("full_name", "")[:255],
        phone=data.get("phone", "")[:32],
        street=data["street"][:255],
        town=data["town"][:120],
        county=data["county"][:120],
        postal_code=(data.get("postal_code") or "")[:20],
        is_default=True,
    )


def sync_phone_from_checkout(user, phone):
    """
    Backfill `user.phone` from checkout data if it's empty.
    """
    if user is None or not phone:
        return False
    if getattr(user, "phone", None):
        return False
    user.phone = phone[:32]
    user.save(update_fields=["phone"])
    return True


# ═══════════════════════════════════════════════════════════════════════════
# Reviews — customer-facing helpers
# ═══════════════════════════════════════════════════════════════════════════
def verify_purchase(user, product_id):
    """
    True if the user has a DELIVERED order containing this product.
    """
    if user is None or not product_id:
        return False
    try:
        from checkout.models import Order, OrderItem
    except Exception:
        return False

    return OrderItem.objects.filter(
        order__user=user,
        order__status=Order.Status.DELIVERED,
        product_id=product_id,
    ).exists()


def get_pending_reviews(user):
    """
    Delivered OrderItems the user hasn't reviewed yet.

    Returns a list of dicts shaped for `PendingReviewItemSerializer`.

    REVIEWS-DISABLED GATE
    ---------------------
    Returns an empty list when `reviews.reviews_enabled` is off. The
    customer dashboard should not surface a "leave a review" panel
    when the shop isn't accepting reviews — the form is unreachable
    and the prompt is confusing.

    Deduped by `product_id`. `delivered_at` reads from the DELIVERED
    `OrderStatusEvent`, not `order.updated_at` (which bumps on any save).

    No payment filter — COD orders stay UNPAID in the DB even after
    delivery, and a delivered order is a delivered order regardless of
    how the money moved.
    """
    if user is None:
        return []

    if not _reviews_enabled():
        return []

    try:
        from checkout.models import Order, OrderItem, OrderStatusEvent
    except Exception:
        return []

    reviewed_ids = set(
        Review.objects.filter(user=user).values_list("product_id", flat=True)
    )

    delivered_items = (
        OrderItem.objects
        .filter(
            order__user=user,
            order__status=Order.Status.DELIVERED,
        )
        .exclude(product_id="")
        .exclude(product_id__in=reviewed_ids)
        .select_related("order")
        .order_by("-order__updated_at")
    )

    order_ids = {item.order_id for item in delivered_items}
    delivered_at_by_order = dict(
        OrderStatusEvent.objects
        .filter(
            order_id__in=order_ids,
            to_status=Order.Status.DELIVERED,
        )
        .values_list("order_id", "created_at")
    )

    seen = set()
    out = []
    for item in delivered_items:
        if item.product_id in seen:
            continue
        seen.add(item.product_id)
        out.append({
            "order_reference": item.order.reference,
            "delivered_at": delivered_at_by_order.get(item.order_id),
            "product_id": item.product_id,
            "product_name": item.name,
            "product_image": item.image_url or "",
            "product_brand": item.brand or "",
            "quantity": item.quantity,
        })

    return out


# ═══════════════════════════════════════════════════════════════════════════
# Reviews — moderation (admin)
# ═══════════════════════════════════════════════════════════════════════════
def recompute_product_rating(product_id: str) -> None:
    """
    Recompute `Product.rating_avg` and `Product.review_count` from the
    set of PUBLISHED reviews for a product.

    Failure is logged, not raised.
    """
    try:
        from django.db.models import Avg, Count

        from catalog.models import Product
    except Exception:
        logger.exception("Cannot recompute rating for %s", product_id)
        return

    try:
        stats = (
            Review.objects
            .filter(
                product_id=product_id,
                status=Review.Status.PUBLISHED,
            )
            .aggregate(
                avg=Avg("rating"),
                count=Count("id"),
            )
        )

        avg = stats["avg"]
        count = stats["count"] or 0

        if avg is None:
            avg_q = Decimal("0")
        else:
            avg_q = (
                Decimal(str(avg)).quantize(Decimal("0.01"))
                if not isinstance(avg, Decimal)
                else avg.quantize(Decimal("0.01"))
            )

        Product.objects.filter(pk=product_id).update(
            rating_avg=avg_q,
            review_count=count,
        )
    except Exception:
        logger.exception(
            "Failed to recompute rating for product %s", product_id,
        )


@transaction.atomic
def moderate_review(review, action, *, moderator, reason=""):
    """
    Approve or reject a review.

    REFUSES WHEN REVIEWS ARE DISABLED
    ---------------------------------
    When `reviews.reviews_enabled` is off, approving would publish a
    review on a storefront that hides its review section. The customer
    would never see the notification's "your review is live" link land
    anywhere meaningful. Raise `ValueError` so the admin gets a clear
    message instead of a silent no-op.

    Rejecting is still allowed when reviews are off — an admin cleaning
    up a stale pending queue should not be blocked.

    Idempotent. Returns the updated Review.
    """
    if action not in ("approved", "rejected"):
        raise ValueError(f"Unknown moderation action: {action!r}")

    if action == "approved" and not _reviews_enabled():
        raise ValueError(
            "Reviews are disabled in Settings → Store. "
            "Enable them before approving."
        )

    old_status = review.status
    new_status = (
        Review.Status.PUBLISHED if action == "approved" else Review.Status.REJECTED
    )

    if old_status == new_status:
        review.moderated_at = timezone.now()
        review.moderated_by = moderator
        if action == "rejected":
            review.rejection_reason = (reason or "")[:255]
        review.save(update_fields=[
            "moderated_at", "moderated_by", "rejection_reason", "updated_at",
        ])
        return review

    review.status = new_status
    review.moderated_at = timezone.now()
    review.moderated_by = moderator
    if action == "rejected":
        review.rejection_reason = (reason or "")[:255]
    else:
        review.rejection_reason = ""

    review.save(update_fields=[
        "status", "moderated_at", "moderated_by",
        "rejection_reason", "updated_at",
    ])

    recompute_product_rating(review.product_id)

    try:
        notify_review_moderated(review.user, review)
    except Exception:
        logger.exception(
            "Failed to notify customer for review moderation %s", review.pk,
        )

    return review


@transaction.atomic
def flag_review(review, *, reason, actor):
    """
    Set the moderation flag on a review. Idempotent.
    """
    review.flag_status = Review.FlagStatus.FLAGGED
    review.flag_reason = (reason or "Flagged by admin")[:255]
    review.flagged_at = timezone.now()
    review.flagged_by = actor
    review.save(update_fields=[
        "flag_status", "flag_reason", "flagged_at", "flagged_by", "updated_at",
    ])
    return review


@transaction.atomic
def resolve_review_flag(review, *, actor):
    """
    Mark a flag as resolved.
    """
    review.flag_status = Review.FlagStatus.RESOLVED
    review.save(update_fields=["flag_status", "updated_at"])
    return review


@transaction.atomic
def add_review_reply(review, *, text, author):
    """
    Append a staff reply to a review.
    """
    return ReviewReply.objects.create(
        review=review,
        author=author if getattr(author, "pk", None) else None,
        text=(text or "").strip(),
    )


def increment_helpful(review):
    """
    Bump the helpful counter by one. Uses `F()` so concurrent calls
    don't race.
    """
    from django.db.models import F

    Review.objects.filter(pk=review.pk).update(
        helpful_count=F("helpful_count") + 1,
    )
    review.refresh_from_db(fields=["helpful_count"])
    return review


@transaction.atomic
def delete_review(review):
    """
    Hard delete a review and recompute the parent product's rating.
    """
    product_id = review.product_id
    review.delete()
    recompute_product_rating(product_id)


# ═══════════════════════════════════════════════════════════════════════════
# Wishlist
# ═══════════════════════════════════════════════════════════════════════════
def wishlist_count(user):
    """Count for the overview page's Wishlist Items stat card."""
    if user is None:
        return 0
    return WishlistItem.objects.filter(user=user).count()


def wishlist_variant_ids_for(user) -> set[str]:
    """
    Set of variant_ids the user has in their wishlist.
    """
    if user is None or not user.is_authenticated:
        return set()
    return set(
        WishlistItem.objects
        .filter(user=user)
        .values_list("variant_id", flat=True)
    )


def bulk_merge_wishlist(user, items: list[dict]) -> int:
    """
    Merge a batch of guest wishlist items into the user's account.
    Idempotent. Returns the number of NEW items added.
    """
    if user is None or not user.is_authenticated:
        return 0

    existing_variant_ids = wishlist_variant_ids_for(user)
    to_create = []

    for item in items:
        variant_id = str(item.get("variant_id", "")).strip()
        if not variant_id or variant_id in existing_variant_ids:
            continue

        compare_at_raw = item.get("compare_at_price")
        compare_at_price = (
            _to_decimal(compare_at_raw) if compare_at_raw not in (None, "") else None
        )

        to_create.append(
            WishlistItem(
                user=user,
                product_id=str(item.get("product_id", ""))[:64],
                variant_id=variant_id[:64],
                product_name=str(item.get("product_name", ""))[:255],
                product_slug=str(item.get("product_slug", ""))[:255],
                product_brand=str(item.get("product_brand", ""))[:120],
                product_image=str(item.get("product_image", ""))[:500],
                variant_name=str(item.get("variant_name", ""))[:120],
                variant_image=str(item.get("variant_image", ""))[:500],
                unit_price=_to_decimal(item.get("unit_price")),
                compare_at_price=compare_at_price,
                stock=item.get("stock", WishlistItem.Stock.IN),
                stock_count=int(item.get("stock_count") or 0),
                discount_percent=int(item.get("discount_percent") or 0),
                rating=_to_decimal(item.get("rating")),
                review_count=int(item.get("review_count") or 0),
            )
        )
        existing_variant_ids.add(variant_id)

    if to_create:
        WishlistItem.objects.bulk_create(
            to_create, ignore_conflicts=True,
        )
    return len(to_create)


# ═══════════════════════════════════════════════════════════════════════════
# Overview — one-shot aggregation
# ═══════════════════════════════════════════════════════════════════════════
def overview_stats(user):
    """
    Everything the Overview page's stat cards + recent-orders list need.

    `pending_reviews` is automatically 0 when reviews are disabled,
    because `get_pending_reviews()` short-circuits.
    """
    if user is None:
        return {
            "total_orders": 0,
            "in_transit": 0,
            "pending": 0,
            "wishlist_count": 0,
            "unread_notifications": 0,
            "pending_reviews": 0,
        }

    try:
        from checkout.models import Order
    except Exception:
        return {
            "total_orders": 0,
            "in_transit": 0,
            "pending": 0,
            "wishlist_count": wishlist_count(user),
            "unread_notifications": unread_count(user),
            "pending_reviews": 0,
        }

    base = Order.objects.filter(user=user).exclude(
        status__in=[Order.Status.CANCELLED, Order.Status.FAILED],
    )

    total_orders = base.count()

    pending = base.filter(
        status__in=[
            Order.Status.PENDING,
            Order.Status.CONFIRMED,
            Order.Status.PROCESSING,
        ],
    ).count()

    in_transit = base.filter(status=Order.Status.SHIPPED).count()

    pending_reviews = len(get_pending_reviews(user))

    return {
        "total_orders": total_orders,
        "in_transit": in_transit,
        "pending": pending,
        "wishlist_count": wishlist_count(user),
        "unread_notifications": unread_count(user),
        "pending_reviews": pending_reviews,
    }