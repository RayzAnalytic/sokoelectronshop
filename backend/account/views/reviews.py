"""
account/views/reviews.py

Review endpoints. Every view requires authentication and scopes its
queries by `user=request.user`.

Endpoints:

    GET    /api/v1/account/reviews/                 — list my reviews
    POST   /api/v1/account/reviews/                 — create a review
    GET    /api/v1/account/reviews/pending/         — delivered items to review
    POST   /api/v1/account/reviews/uploads/         — image upload
    GET    /api/v1/account/reviews/<pk>/            — fetch one
    PATCH  /api/v1/account/reviews/<pk>/            — update
    DELETE /api/v1/account/reviews/<pk>/            — delete

SETTINGS AWARENESS
==================
    One setting gates this module: `reviews.reviews_enabled`.

    When the shop owner turns reviews off, the enforcement is:

      ENDPOINT             BEHAVIOR WHEN DISABLED
      ───────────────────  ──────────────────────────────────────
      GET  /reviews/       Allowed — read history
      GET  /reviews/<pk>/  Allowed — read history
      GET  /reviews/pending/  Returns [] (via the service gate
                              already wired in `get_pending_reviews`)
      POST /reviews/       400 — new submissions blocked
      PATCH /reviews/<pk>/ 400 — edits blocked
      POST /reviews/uploads/ 400 — uploads blocked
      DELETE /reviews/<pk>/ Allowed — customer data ownership

    WHY THE ASYMMETRY
    -----------------
    The gate is about *production*, not *access*. A customer should
    always be able to:

      * See the reviews they've written
      * Delete their own content (data ownership — see GDPR/Kenya
        DPA 2019)
      * Read a single review of theirs

    What the shop owner turns off is the *ability to submit new
    content*. Approving a new review requires `reviews.reviews_enabled`
    to be on (see `account.services.moderate_review`), so allowing a
    customer to submit one would create an orphaned PENDING row that
    can never go live. Better to refuse upfront with a clear message.

    Edits follow the same logic: an edit re-enters moderation, and
    moderation refuses approval when reviews are off. Refusing the
    edit at the door is clearer than accepting it and leaving the
    review stuck in PENDING forever.

    Uploads are gated for the same reason as creates — uploading an
    image destined for a review that can never be submitted wastes
    storage and produces a confusing UI when the submit fails.
    Refusing early at the upload step means the customer never gets
    to the point of a failed submit.

    The delete path is NOT gated. Removing one's own content is a
    fundamental right, not a shop feature.

Design notes
────────────

One-review-per-product is enforced by the model's unique constraint
(`user`, `product_id`). The create view checks explicitly first so the
customer gets a clean 400 rather than an IntegrityError.

The `ReviewWriteSerializer` owns the write logic — order lookup,
verified-purchase computation, immutable-field guard, status reset on
edit, and flag clearing on edit all live there. The views stay thin:
they validate, call `ser.save()`, and serialize the result.

Updates reset status to PENDING via the serializer's `update()`. A
moderator approved the previous version of the review, not this one;
re-moderation is the correct behaviour.

Service-layer `get_pending_reviews(user)` powers both this module's
"Awaiting Your Review" list and the account overview stat, so "what
counts as pending" has exactly one definition. That service also
honors `reviews.reviews_enabled` — see the settings block at the top
of `account/services.py`.

IMAGE UPLOADS
─────────────
Uploaded files land at `reviews/<user_id>/<sanitized_filename>` in the
active storage backend (filesystem in dev, S3 in production — see
`settings.STORAGES`).

Two-layer validation:
  1. Size cap (5 MB) — matches the frontend's advertised limit.
  2. Content verification — Pillow opens the file and rejects
     anything that isn't a real JPEG/PNG/WEBP image. The client's
     `Content-Type` header is NOT trusted; a spoofed header plus a
     non-image payload fails at the Pillow check.

Filenames are passed through Django's `get_valid_filename()` before
being composed into the storage path.

KNOWN DEBT: orphaned uploads.
    If a customer uploads 5 images but submits a review with 3, the
    other 2 files remain in storage indefinitely. A nightly sweep task
    should walk `reviews/<user>/` and delete files not referenced in
    any `Review.images` array. Not implemented yet.
"""

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.shortcuts import get_object_or_404
from django.utils.text import get_valid_filename

from PIL import Image, UnidentifiedImageError
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Review
from ..serializers import (
    PendingReviewItemSerializer,
    ReviewRowSerializer,
    ReviewWriteSerializer,
)
from ..services import get_pending_reviews


# ═════════════════════════════════════════════════════════════════════════════
# Settings helper — safe during migrations / cold boot
# ═════════════════════════════════════════════════════════════════════════════
def _reviews_enabled() -> bool:
    """
    Read `reviews.reviews_enabled` from the cached settings bundle.

    Fails safe to True during migrations, tests, and cold boot, so a
    management command touching these views doesn't accidentally see
    reviews as disabled.
    """
    try:
        from dashboard.settings.services import get_settings_bundle
        return bool(get_settings_bundle()['reviews'].reviews_enabled)
    except Exception:
        return True


def _reviews_disabled_response():
    """
    Uniform 400 response for every gated endpoint.

    The same message for creates, edits, and uploads so the frontend
    can render one error state. The frontend hides the review UI when
    reviews are off anyway (via `pending_reviews === 0`), but a direct
    API call still gets a clear message.
    """
    return Response(
        {
            "detail": (
                "Reviews are currently disabled on this shop. "
                "You can still view and delete your existing reviews."
            ),
            "code": "reviews_disabled",
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


# Shared cap between the size check and the docstring. If the frontend
# changes its advertised limit, update this in one place.
REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024
REVIEW_IMAGE_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


# ─────────────────────────────────────────────────────────────────────────────
# List / create
# ─────────────────────────────────────────────────────────────────────────────
class ReviewListCreateView(APIView):
    """
    GET  /api/v1/account/reviews/
    POST /api/v1/account/reviews/

    GET — always allowed. The customer sees their own review history
    even when the shop has reviews disabled.

    POST — gated on `reviews.reviews_enabled`. Submitting a new review
    to a shop that has turned reviews off would create a PENDING row
    that can never be approved (see `moderate_review`). Refusing at
    the door with a clear message is kinder than accepting the review
    and leaving it stuck.

    Response shape matches `lib/api.ts` ReviewRow.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Review.objects.filter(user=request.user)
        return Response(ReviewRowSerializer(qs, many=True).data)

    def post(self, request):
        # Gate: no new reviews when the shop has them off.
        if not _reviews_enabled():
            return _reviews_disabled_response()

        ser = ReviewWriteSerializer(
            data=request.data,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)

        # Explicit duplicate check before save. The model's unique
        # constraint would catch this anyway, but as an IntegrityError
        # (500) rather than a clean 400 with a useful message.
        product_id = ser.validated_data["product_id"]
        if Review.objects.filter(
            user=request.user, product_id=product_id
        ).exists():
            return Response(
                {"detail": "You've already reviewed this product."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        review = ser.save()

        return Response(
            ReviewRowSerializer(review).data,
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Detail — get / update / delete
# ─────────────────────────────────────────────────────────────────────────────
class ReviewDetailView(APIView):
    """
    GET    /api/v1/account/reviews/<pk>/
    PATCH  /api/v1/account/reviews/<pk>/
    DELETE /api/v1/account/reviews/<pk>/

    All ownership-scoped. A foreign id returns 404, not 403.

    GATING ASYMMETRY (documented)
    -----------------------------
    * GET    — always allowed. The customer owns this review and can
               always read it.
    * PATCH  — gated on `reviews.reviews_enabled`. An edit re-enters
               moderation, and moderation refuses approval when the
               shop has reviews off. Accepting the edit would leave
               the review stuck in PENDING forever — a confusing state
               the customer cannot resolve.
    * DELETE — always allowed. Removing one's own content is a data
               ownership right, not a shop feature. See GDPR and
               Kenya DPA 2019 Article 40 on erasure.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        review = get_object_or_404(Review, pk=pk, user=request.user)
        return Response(ReviewRowSerializer(review).data)

    def patch(self, request, pk):
        # Gate: no edits when the shop has reviews off. The customer
        # can still delete this review (see DELETE below).
        if not _reviews_enabled():
            return _reviews_disabled_response()

        review = get_object_or_404(Review, pk=pk, user=request.user)

        ser = ReviewWriteSerializer(
            review,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        review = ser.save()

        return Response(ReviewRowSerializer(review).data)

    def delete(self, request, pk):
        """
        Delete is NEVER gated.

        A customer must always be able to remove their own content,
        regardless of shop policy. This is a data-ownership guarantee,
        not a feature toggle.
        """
        review = get_object_or_404(Review, pk=pk, user=request.user)
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Pending — delivered items without a review
# ─────────────────────────────────────────────────────────────────────────────
class PendingReviewListView(APIView):
    """
    GET /api/v1/account/reviews/pending/

    Returns one row per product the customer has received but not yet
    reviewed. Powers the "Awaiting Your Review" section on the reviews
    page and the `pending_reviews` stat on the account dashboard.

    REVIEWS-DISABLED GATE
    ---------------------
    Returns `[]` when `reviews.reviews_enabled` is off. The gate lives
    inside `services.get_pending_reviews()` — this view is a
    pass-through. That keeps the definition of "what counts as
    pending" in one place, so the reviews page and the dashboard
    stat agree by construction.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = get_pending_reviews(request.user)
        return Response(
            PendingReviewItemSerializer(rows, many=True).data
        )


# ─────────────────────────────────────────────────────────────────────────────
# Image upload
# ─────────────────────────────────────────────────────────────────────────────
class ReviewImageUploadView(APIView):
    """
    POST /api/v1/account/reviews/uploads/

    Multipart upload of a single image. Returns `{ "url": "..." }` for
    the client to include in the review's `images` list.

    REVIEWS-DISABLED GATE
    ---------------------
    Refuses uploads when `reviews.reviews_enabled` is off. The image
    would be destined for a review the shop won't accept — accepting
    the upload wastes storage and produces a confusing UI where the
    submit step fails after the customer has already invested effort.

    Refusing at the upload step is the earliest point the gate can
    fire. The frontend hides the review form when reviews are off
    (via the pending-reviews gate), but a direct API call gets the
    same clear 400.

    Scoped to the authenticated user via the storage path —
    `reviews/<user_id>/<sanitized_filename>` — so two customers
    uploading `photo.jpg` don't collide.

    Validation, in order:

      1. Reviews are enabled (settings gate — cheapest check first).
      2. A file is present.
      3. Size <= 5 MB.
      4. Client-declared content type is JPEG/PNG/WEBP.
      5. Pillow opens the file successfully — authoritative.

    Throttled with `reviews_upload`:

        "reviews_upload": "30/hour"
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "reviews_upload"

    def post(self, request):
        # Gate first — cheapest check, and there's no point running
        # Pillow on a 5 MB upload for a shop that won't accept the
        # resulting review.
        if not _reviews_enabled():
            return _reviews_disabled_response()

        file = request.FILES.get("file")
        if not file:
            return Response(
                {"detail": "No file uploaded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.size > REVIEW_IMAGE_MAX_BYTES:
            mb = REVIEW_IMAGE_MAX_BYTES // (1024 * 1024)
            return Response(
                {"detail": f"Image must be under {mb} MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = (file.content_type or "").lower()
        if content_type not in REVIEW_IMAGE_ALLOWED_TYPES:
            return Response(
                {"detail": "Only JPG, PNG, or WEBP images are allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Authoritative content check. Read the bytes once, hand them
        # to both Pillow (verify) and storage (write). At 5 MB this is
        # well under any reasonable memory concern.
        raw = file.read()

        try:
            Image.open(ContentFile(raw)).verify()
        except (UnidentifiedImageError, OSError):
            return Response(
                {"detail": "The uploaded file is not a valid image."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        safe_name = get_valid_filename(file.name or "image")
        path = default_storage.save(
            f"reviews/{request.user.pk}/{safe_name}",
            ContentFile(raw),
        )
        url = default_storage.url(path)

        return Response({"url": url}, status=status.HTTP_201_CREATED)