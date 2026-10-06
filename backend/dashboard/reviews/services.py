"""
Business logic for review moderation.

Everything here writes to `account.Review` / `account.ReviewReply` and
fires the side effects (customer notification, product rating
recompute). The views are thin wrappers — validate, call one of these,
serialize the result.

Notifications go through `account.services.notify` so the delivery
channel (in-app only today) is centralized. If email notifications
are added later, they're added there, not here.
"""

import logging

from django.utils import timezone

from account.models import Review, ReviewReply

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Rating aggregation
# ─────────────────────────────────────────────────────────────────────────────
def recompute_product_rating(product_id: str) -> None:
    """
    Recompute `Product.rating_avg` and `Product.review_count` from the
    set of PUBLISHED reviews.

    Called after any moderation action that changes which reviews are
    visible. Never called on customer submission — a pending review
    shouldn't move the storefront's rating until an admin approves it.

    Failure is logged, not raised. A rating recompute failure must not
    block the moderation action that triggered it.
    """
    from django.db.models import Avg, Count

    from catalog.models import Product

    try:
        stats = (
            Review.objects
            .filter(
                product_id=product_id,
                status=Review.Status.PUBLISHED,
            )
            .aggregate(avg=Avg("rating"), count=Count("id"))
        )

        avg = stats["avg"] or 0
        count = stats["count"] or 0

        Product.objects.filter(pk=product_id).update(
            rating_avg=round(avg, 2),
            review_count=count,
        )
    except Exception:
        logger.exception(
            "Failed to recompute rating for product %s", product_id,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────
def _notify_moderation(review: Review, action: str, reason: str = "") -> None:
    """
    Fire the customer notification for a moderation decision.

    Best-effort. A notification failure never rolls back the status
    change — the moderation is the important part; the notification is
    a courtesy.
    """
    if not review.user_id:
        return

    try:
        from account.services import notify

        if action == "approved":
            notify(
                review.user,
                type="review",
                title="Your review was approved",
                body=f"Your review of {review.product_name} is now live.",
                href=f"/pages/products/{review.product_slug}" if review.product_slug else "",
                metadata={"review_id": review.pk},
            )
        elif action == "rejected":
            notify(
                review.user,
                type="review",
                title="Your review was not approved",
                body=reason or "Your review did not meet our content guidelines.",
                href="",
                metadata={"review_id": review.pk},
            )
    except Exception:
        logger.exception(
            "Failed to notify user %s for review moderation (%s)",
            review.user_id, action,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Moderation actions
# ─────────────────────────────────────────────────────────────────────────────
def moderate_review(
    review: Review,
    action: str,
    *,
    moderator,
    reason: str = "",
) -> Review:
    """
    Approve or reject a review.

    `action` is "approved" or "rejected". Any other value is a caller
    bug — raise rather than silently no-op.

    Idempotent in effect: re-approving an approved review is a no-op
    except for refreshing `moderated_at`. The notification is only
    fired on an actual state change.

    Also recomputes the product's rating if the transition affects
    which reviews are visible.
    """
    if action not in ("approved", "rejected"):
        raise ValueError(f"Unknown moderation action: {action!r}")

    old_status = review.status
    new_status = (
        Review.Status.PUBLISHED if action == "approved" else Review.Status.REJECTED
    )

    # Nothing to do — but still bump the moderator stamp so the audit
    # trail reflects the most recent decision.
    if old_status == new_status:
        review.moderated_at = timezone.now()
        review.moderated_by = moderator
        if action == "rejected":
            review.rejection_reason = reason[:500]
        review.save(update_fields=[
            "moderated_at", "moderated_by", "rejection_reason", "updated_at",
        ])
        return review

    review.status = new_status
    review.moderated_at = timezone.now()
    review.moderated_by = moderator
    if action == "rejected":
        review.rejection_reason = reason[:500]
    else:
        review.rejection_reason = ""

    review.save(update_fields=[
        "status", "moderated_at", "moderated_by",
        "rejection_reason", "updated_at",
    ])

    # A status change affects the storefront rating.
    recompute_product_rating(review.product_id)

    _notify_moderation(review, action, reason=reason)

    return review


def flag_review(
    review: Review,
    *,
    reason: str,
    actor,
) -> Review:
    """Set the flag on a review. Idempotent if already flagged."""
    review.flag_status = "flagged"
    review.flag_reason = (reason or "Flagged by admin")[:500]
    review.flagged_at = timezone.now()
    review.flagged_by = actor
    review.save(update_fields=[
        "flag_status", "flag_reason", "flagged_at", "flagged_by", "updated_at",
    ])
    return review


def resolve_review_flag(review: Review, *, actor) -> Review:
    """
    Mark a flag as resolved. The reason and actor are kept so the
    history shows who flagged it and who cleared it.
    """
    review.flag_status = "resolved"
    review.save(update_fields=["flag_status", "updated_at"])
    return review


def add_review_reply(
    review: Review,
    *,
    text: str,
    author,
) -> ReviewReply:
    """Append a staff reply to a review."""
    return ReviewReply.objects.create(
        review=review,
        author=author if getattr(author, "pk", None) else None,
        text=text.strip(),
    )


def increment_helpful(review: Review) -> Review:
    """
    Bump the helpful counter by one.

    Simple `F()`-based increment so concurrent calls don't race. No
    per-user tracking — an admin marking a review as helpful is a
    judgement call, not a vote.
    """
    from django.db.models import F

    Review.objects.filter(pk=review.pk).update(
        helpful_count=F("helpful_count") + 1,
    )
    review.refresh_from_db(fields=["helpful_count"])
    return review


def delete_review(review: Review) -> None:
    """
    Hard delete. Recomputes the product's rating afterward.
    """
    product_id = review.product_id
    review.delete()
    recompute_product_rating(product_id)