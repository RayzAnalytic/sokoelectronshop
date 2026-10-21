import logging

from django.db.models import Avg, Count, F
from django.utils import timezone

from account.models import Review, ReviewReply

logger = logging.getLogger(__name__)


def recompute_product_rating(product_id: str) -> None:
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


def _notify_moderation(review: Review, action: str, reason: str = "") -> None:
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


def moderate_review(
    review: Review,
    action: str,
    *,
    moderator,
    reason: str = "",
) -> Review:
    if action not in ("approved", "rejected"):
        raise ValueError(f"Unknown moderation action: {action!r}")

    old_status = review.status
    new_status = (
        Review.Status.PUBLISHED if action == "approved" else Review.Status.REJECTED
    )

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

    recompute_product_rating(review.product_id)

    _notify_moderation(review, action, reason=reason)

    return review


def flag_review(
    review: Review,
    *,
    reason: str,
    actor,
) -> Review:
    review.flag_status = "flagged"
    review.flag_reason = (reason or "Flagged by admin")[:500]
    review.flagged_at = timezone.now()
    review.flagged_by = actor
    review.save(update_fields=[
        "flag_status", "flag_reason", "flagged_at", "flagged_by", "updated_at",
    ])
    return review


def resolve_review_flag(review: Review, *, actor) -> Review:
    review.flag_status = "resolved"
    review.save(update_fields=["flag_status", "updated_at"])
    return review


def add_review_reply(
    review: Review,
    *,
    text: str,
    author,
) -> ReviewReply:
    return ReviewReply.objects.create(
        review=review,
        author=author if getattr(author, "pk", None) else None,
        text=text.strip(),
    )


def increment_helpful(review: Review) -> Review:
    Review.objects.filter(pk=review.pk).update(
        helpful_count=F("helpful_count") + 1,
    )
    review.refresh_from_db(fields=["helpful_count"])
    return review


def delete_review(review: Review) -> None:
    product_id = review.product_id
    review.delete()
    recompute_product_rating(product_id)