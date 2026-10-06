# catalog/views/reviews.py
from rest_framework import generics, status
from rest_framework.response import Response

from account.models import Review as AccountReview

from catalog import services
from catalog.serializers import ReviewSerializer


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────
def _currency() -> str:
    """
    Read the shop's currency from the cached settings bundle.

    Fails safe to KES during migrations / cold boot so management
    commands and tests that touch views don't crash.
    """
    try:
        from dashboard.settings.services import get_settings_bundle
        return get_settings_bundle()['general'].currency
    except Exception:
        return 'KES'


def _attach_currency(response):
    """Add the shop currency header to any Response object."""
    response['X-Shop-Currency'] = _currency()
    return response


# ─────────────────────────────────────────────────────────────────────────────
# Product reviews — public, read-only
# ─────────────────────────────────────────────────────────────────────────────
class ProductReviewListView(generics.ListAPIView):
    """
    GET /api/catalog/products/<product_id>/reviews/

    (Note: previously named `ProductReviewListCreateView`. Renamed when
    the POST path moved to /api/v1/account/reviews/ — the catalog module
    is now read-only over reviews.)

    Public, read-only. Returns every PUBLISHED review for the product,
    newest first.

    The source model is `account.Review`, not the old `catalog.Review` —
    the latter was removed when the customer review write path moved to
    `/api/v1/account/reviews/`. Reviews need a User FK for ownership,
    moderation, and notification, and `catalog.Review` never had one.

    Settings awareness
    ------------------
    `reviews.reviews_enabled` from Settings → Store is honored inside
    `services.get_reviews_for_product()`. When the shop owner turns
    reviews off, this endpoint returns `[]` without any branching here —
    the service layer is the single source of truth for what reviews
    the storefront is allowed to see.

    The `status="published"` filter lives inside the service, not on the
    serializer. A pending or rejected review must never appear on the
    storefront — the moderation queue exists precisely to gate that, so
    the visibility rule can't be bypassed by a caller that forgets it.

    The POST method is intentionally absent. Customers submit reviews
    through `POST /api/v1/account/reviews/`, which uses
    `account.serializers.ReviewWriteSerializer` to handle order lookup,
    verified-purchase computation, and moderation state. Two write
    paths was one too many; the old one had no attribution and no
    moderation, so anything it created was unmoderatable.
    """

    serializer_class = ReviewSerializer
    pagination_class = None

    def get_product(self):
        return services.get_product_by_id(self.kwargs["product_id"])

    def get_queryset(self):
        product = self.get_product()
        if not product:
            # Empty queryset for the ListAPIView machinery — the `list()`
            # override below intercepts this case and returns a 404
            # before the response is built.
            return AccountReview.objects.none()
        return services.get_reviews_for_product(product)

    def list(self, request, *args, **kwargs):
        """
        Override `list` to return a clean 404 when the product doesn't
        exist.

        `ListAPIView`'s default behavior with an empty queryset is a
        200 with `[]` — which is indistinguishable from "product exists
        but has no reviews". The storefront needs to tell those apart:
        the first is a bug or a stale link, the second is a normal
        empty state.

        When reviews are disabled in Settings, the service returns an
        empty queryset but the product still exists — so this returns
        `200 []`, which is the correct behavior.
        """
        if not self.get_product():
            return Response(
                {"detail": "Product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return _attach_currency(super().list(request, *args, **kwargs))