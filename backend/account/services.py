import logging
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import Address, Notification, Review, ReviewReply, WishlistItem

logger = logging.getLogger(__name__)


def _settings():
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()
    except Exception:
        return None


def _reviews_enabled() -> bool:
    s = _settings()
    return bool(s['reviews'].reviews_enabled) if s else True


def _email_enabled() -> bool:
    s = _settings()
    return bool(s['notifs'].email_enabled) if s else True


def _whatsapp_enabled() -> bool:
    s = _settings()
    return bool(s['notifs'].whatsapp_enabled) if s else True


VIP_THRESHOLD_KES = Decimal("50000")


def _fire_event(event_name: str, payload: dict) -> None:
    try:
        from dashboard.aiautomations.services.automations import dispatch
        dispatch(event_name, payload)
    except Exception:
        logger.exception(
            "Automation dispatch failed for event %s", event_name,
        )


def check_vip_promotion(user) -> bool:
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


def _to_decimal(value, default: str = "0") -> Decimal:
    if value is None or value == "":
        return Decimal(default)
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def notify(user, *, type, title, body="", href="", metadata=None,
           dedup_key=""):
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
    if user is None:
        return 0
    return Notification.objects.filter(user=user, is_read=False).count()


def mark_notification_read(notification):
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
    return notification


def mark_all_read(user):
    if user is None:
        return 0
    return Notification.objects.filter(
        user=user, is_read=False,
    ).update(is_read=True, read_at=timezone.now())


def notify_order_placed(user, order):
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


@transaction.atomic
def reject_order(user, reference, reason=""):
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


@transaction.atomic
def adopt_address_from_checkout(user, data):
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
    if user is None or not phone:
        return False
    if getattr(user, "phone", None):
        return False
    user.phone = phone[:32]
    user.save(update_fields=["phone"])
    return True


def verify_purchase(user, product_id):
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


def recompute_product_rating(product_id: str) -> None:
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
    review.flag_status = Review.FlagStatus.RESOLVED
    review.save(update_fields=["flag_status", "updated_at"])
    return review


@transaction.atomic
def add_review_reply(review, *, text, author):
    return ReviewReply.objects.create(
        review=review,
        author=author if getattr(author, "pk", None) else None,
        text=(text or "").strip(),
    )


def increment_helpful(review):
    from django.db.models import F

    Review.objects.filter(pk=review.pk).update(
        helpful_count=F("helpful_count") + 1,
    )
    review.refresh_from_db(fields=["helpful_count"])
    return review


@transaction.atomic
def delete_review(review):
    product_id = review.product_id
    review.delete()
    recompute_product_rating(product_id)


def wishlist_count(user):
    if user is None:
        return 0
    return WishlistItem.objects.filter(user=user).count()


def wishlist_variant_ids_for(user) -> set[str]:
    if user is None or not user.is_authenticated:
        return set()
    return set(
        WishlistItem.objects
        .filter(user=user)
        .values_list("variant_id", flat=True)
    )


def bulk_merge_wishlist(user, items: list[dict]) -> int:
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


def overview_stats(user):
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