"""
account/views/wishlist.py

Wishlist endpoints. All require authentication — guests keep their
wishlist in localStorage on the client and merge it into the account
after login via `WishlistBulkAddView`.

Endpoints:

    GET    /account/wishlist/                            — list
    POST   /account/wishlist/                            — add or refresh
    POST   /account/wishlist/check-batch/                — batch membership check
    POST   /account/wishlist/bulk-add/                   — merge guest list
    GET    /account/wishlist/check/?variant_id=...       — single check
    DELETE /account/wishlist/<id>/                       — remove by row id
    DELETE /account/wishlist/by-variant/<variant_id>/    — remove by variant
    DELETE /account/wishlist/clear/                      — remove all

SNAPSHOT REFRESH
────────────────
POST /wishlist/ is idempotent on `variant_id`:

  * If no row exists for this (user, variant_id), one is created. 201.
  * If a row already exists, its snapshot fields — price, stock,
    rating, review count, discount, product metadata — are overwritten
    with the values from this request. 200.

Refreshing on re-add is what makes the "save for later, come back
later, product has changed" path work. Every field the serializer
accepts must land in the `defaults` dict of `update_or_create`, or the
refresh silently drops it. That was the original bug this rewrite
fixes — five snapshot fields (stock, stock_count, discount_percent,
rating, review_count) were validated and discarded.

WHY BOTH `<id>/` AND `by-variant/<variant_id>/` EXIST
─────────────────────────────────────────────────────
The heart button on a product card knows a `variant_id` and nothing
else — so its toggle-off path targets `by-variant/`. The wishlist page
has the full row (it fetched the list), so its trash icon could use
either. Both endpoints exist so a caller is never forced to convert
between the two identities.
"""

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import WishlistItem
from ..serializers import (
    WishlistAddSerializer,
    WishlistBatchAddSerializer,
    WishlistBatchCheckSerializer,
    WishlistCheckSerializer,
    WishlistItemSerializer,
)
from ..services import bulk_merge_wishlist


# ─────────────────────────────────────────────────────────────────────────────
# List / add
# ─────────────────────────────────────────────────────────────────────────────
class WishlistListCreateView(APIView):
    """
    GET  /api/v1/account/wishlist/   → list the user's saved items
    POST /api/v1/account/wishlist/   → add or refresh an item

    POST is idempotent on `variant_id`. If the item already exists, the
    row is refreshed with the latest snapshot data (price, stock,
    rating, review count, discount, product metadata) and returned
    with 200 instead of 201. This is what makes the heart button safe
    to click twice and what keeps a re-saved item from showing stale
    data.

    Race handling:
        Two concurrent POSTs with the same (user, variant_id) can both
        pass `update_or_create`'s internal SELECT-not-found check and
        both attempt an INSERT. The second INSERT hits the unique
        constraint and raises `IntegrityError`. The except block
        resolves it by reading the row the first writer committed.

        The narrow `filter(...).first()` — rather than `.get()` — lets
        us re-raise if the row genuinely can't be found, which means
        the IntegrityError was NOT the concurrent-insert case and
        should propagate.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = WishlistItem.objects.filter(user=request.user)
        return Response(WishlistItemSerializer(qs, many=True).data)

    def post(self, request):
        ser = WishlistAddSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        # Every field the serializer accepts must land in `defaults`.
        # Omitting a field makes the "refresh snapshot on re-add"
        # contract silently false for that field.
        defaults = {
            "product_id": data["product_id"],
            "product_name": data["product_name"],
            "product_slug": data.get("product_slug", ""),
            "product_brand": data.get("product_brand", ""),
            "product_image": data.get("product_image", ""),
            "variant_name": data.get("variant_name", ""),
            "variant_image": data.get("variant_image", ""),
            "unit_price": data["unit_price"],
            "compare_at_price": data.get("compare_at_price"),
            # Snapshot catalog state — these were previously omitted,
            # which meant a re-add never refreshed them.
            "stock": data.get("stock", WishlistItem.Stock.IN),
            "stock_count": data.get("stock_count", 0),
            "discount_percent": data.get("discount_percent", 0),
            "rating": data.get("rating", 0),
            "review_count": data.get("review_count", 0),
        }

        try:
            with transaction.atomic():
                item, created = WishlistItem.objects.update_or_create(
                    user=request.user,
                    variant_id=data["variant_id"],
                    defaults=defaults,
                )
        except IntegrityError:
            # Concurrent insert with the same (user, variant_id) — the
            # unique constraint fired on the loser of the race. Read
            # the row the winner committed.
            #
            # If the row is genuinely missing, the IntegrityError was
            # not a race and should propagate — swallowing it here
            # would hide an unrelated data problem.
            item = (
                WishlistItem.objects
                .filter(user=request.user, variant_id=data["variant_id"])
                .first()
            )
            if item is None:
                raise
            created = False

        return Response(
            WishlistItemSerializer(item).data,
            status=(
                status.HTTP_201_CREATED if created else status.HTTP_200_OK
            ),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Single check
# ─────────────────────────────────────────────────────────────────────────────
class WishlistCheckView(APIView):
    """
    GET /api/v1/account/wishlist/check/?variant_id=...

    Returns `{ in_wishlist: bool, wishlist_item_id: int | null }`.
    Called by the product detail page when it renders, and by the heart
    button after a variant switch.

    An empty `variant_id` returns `{ in_wishlist: false, ... }` rather
    than a 400 — the caller asked a valid question whose answer is
    "nothing to check", and a 400 would make the frontend branch for
    a case that isn't really an error.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        variant_id = request.query_params.get("variant_id", "").strip()
        if not variant_id:
            return Response(
                {"in_wishlist": False, "wishlist_item_id": None}
            )

        item = (
            WishlistItem.objects
            .filter(user=request.user, variant_id=variant_id)
            .only("id")
            .first()
        )

        return Response(
            WishlistCheckSerializer(
                {
                    "in_wishlist": item is not None,
                    "wishlist_item_id": item.pk if item else None,
                }
            ).data
        )


# ─────────────────────────────────────────────────────────────────────────────
# Batch check
# ─────────────────────────────────────────────────────────────────────────────
class WishlistBatchCheckView(APIView):
    """
    POST /api/v1/account/wishlist/check-batch/

    Body: { "variant_ids": ["v1", "v2", "v3"] }

    Response: { "in_wishlist": { "v1": true, "v2": false, "v3": true } }

    One request for a whole listing page. Replaces N individual
    `check/` calls. Bounded to 200 variants per request so a malicious
    caller can't ask Postgres to scan a huge list.

    The response dict includes an entry for every variant_id in the
    request — missing keys would force the frontend to default them
    anyway. `false` is the correct default for "not in this user's
    wishlist".
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = WishlistBatchCheckSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        variant_ids = ser.validated_data["variant_ids"]

        if not variant_ids:
            return Response({"in_wishlist": {}})

        found = set(
            WishlistItem.objects
            .filter(user=request.user, variant_id__in=variant_ids)
            .values_list("variant_id", flat=True)
        )

        return Response(
            {"in_wishlist": {v: v in found for v in variant_ids}}
        )


# ─────────────────────────────────────────────────────────────────────────────
# Bulk add (guest → signed-in merge)
# ─────────────────────────────────────────────────────────────────────────────
class WishlistBulkAddView(APIView):
    """
    POST /api/v1/account/wishlist/bulk-add/

    Body: { "items": [ { ...WishlistAdd shape... }, ... ] }

    Called once after login/register to promote a guest's localStorage
    wishlist into the server-side one. Idempotent — items already in the
    user's wishlist are silently skipped (no duplicate, no error).

    Returns `{ added, skipped }`. `skipped` currently counts both
    already-saved variants and entries with a blank `variant_id`
    (malformed rows). The frontend treats both the same — it just
    reports a merge summary — so the conflation is acceptable today.
    If that changes, `bulk_merge_wishlist` should be extended to
    return the two counts separately.

    Throttled: `wishlist_bulk_add` — the payload is capped at 200 items
    per request, but nothing else stops a scripted caller from firing
    many requests. Register the rate in
    `settings.REST_FRAMEWORK.DEFAULT_THROTTLE_RATES`:

        "wishlist_bulk_add": "20/hour"
    """

    permission_classes = [IsAuthenticated]
    throttle_scope = "wishlist_bulk_add"

    def post(self, request):
        ser = WishlistBatchAddSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        items = ser.validated_data["items"]

        added = bulk_merge_wishlist(request.user, items)
        return Response(
            {"added": added, "skipped": len(items) - added},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Remove by row id
# ─────────────────────────────────────────────────────────────────────────────
class WishlistDetailView(APIView):
    """
    DELETE /api/v1/account/wishlist/<id>/

    Ownership-scoped: `get_object_or_404` filters by `user=request.user`,
    so a customer cannot delete another customer's row even if they
    guess the id. A 404 is returned for either "not found" or "not
    yours" — the response shape is identical, so the caller can't
    distinguish the two.
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        item = get_object_or_404(
            WishlistItem, pk=pk, user=request.user
        )
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Remove by variant id
# ─────────────────────────────────────────────────────────────────────────────
class WishlistByVariantView(APIView):
    """
    DELETE /api/v1/account/wishlist/by-variant/<variant_id>/

    The heart button knows a variant id, not the server row id — so the
    toggle-off path uses this endpoint. Idempotent: deleting something
    that isn't there returns 204 as well, so the client doesn't have to
    branch on the response.
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request, variant_id):
        WishlistItem.objects.filter(
            user=request.user, variant_id=variant_id
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Clear all
# ─────────────────────────────────────────────────────────────────────────────
class WishlistClearView(APIView):
    """
    DELETE /api/v1/account/wishlist/clear/

    Wipes the user's wishlist and returns the number of rows deleted.
    The `deleted` count is what the frontend's success toast reads.

    Not currently wired to any UI — the wishlist page has no "clear
    all" button — but kept for parity with the notifications API and
    because it costs almost nothing to expose.
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request):
        deleted, _ = WishlistItem.objects.filter(
            user=request.user
        ).delete()
        return Response({"deleted": deleted})