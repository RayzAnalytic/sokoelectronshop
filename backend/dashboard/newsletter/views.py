# dashboard/newsletter/views.py

from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from newsletter.models import (
    Subscriber,
    SubscriberList,
    EmailTemplate,
    Campaign,
    CampaignRecipient,
)
# pyrefly: ignore [missing-import]
from newsletter.tasks import send_campaign
from newsletter.serializers_admin import (
    SubscriberAdminReadSerializer,
    SubscriberAdminWriteSerializer,
    SubscriberListAdminReadSerializer,
    SubscriberListAdminWriteSerializer,
    EmailTemplateAdminReadSerializer,
    EmailTemplateAdminWriteSerializer,
    CampaignAdminReadSerializer,
    CampaignStatusSerializer,
    CampaignRecipientAdminSerializer,
    SegmentSerializer,
    GrowthPointSerializer,
    CampaignPerformanceSerializer,
    AnalyticsSummarySerializer,
    CampaignImageUploadSerializer,
)


# ============================================================================
# HELPERS
# ============================================================================

def _pct(numerator, denominator) -> float:
    if not denominator:
        return 0.0
    return round((numerator or 0) / denominator * 100, 1)


def _month_cursor_start(now, months_back: int = 11):
    """
    Return the first day of the month that is `months_back` months before
    `now`, normalized to midnight and timezone-aware.
    """
    start = now.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0,
    )
    year = start.year
    month = start.month - months_back
    while month <= 0:
        month += 12
        year -= 1
    return start.replace(year=year, month=month)


def _advance_month(dt):
    """Return the first day of the next calendar month."""
    if dt.month == 12:
        return dt.replace(year=dt.year + 1, month=1)
    return dt.replace(month=dt.month + 1)


# ============================================================================
# SUBSCRIBERS
# ============================================================================

class SubscriberAdminViewSet(viewsets.ModelViewSet):
    """
    Admin management of newsletter subscribers.

    GET    /subscribers/                 — list (filters: status, source, list, search)
    POST   /subscribers/                 — create
    GET    /subscribers/<id>/            — retrieve
    PATCH  /subscribers/<id>/            — partial update
    PUT    /subscribers/<id>/            — full update
    DELETE /subscribers/<id>/            — delete
    GET    /subscribers/stats/           — dashboard counters
    POST   /subscribers/<id>/toggle-active/ — flip is_active
    """

    permission_classes = [IsAdminUser]
    lookup_field = "id"

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SubscriberAdminWriteSerializer
        return SubscriberAdminReadSerializer

    def get_queryset(self):
        qs = (
            Subscriber.objects
            .prefetch_related("lists")
            .order_by("-subscribed_at")
        )

        # The storefront sends status=active | status=unsubscribed.
        status_param = self.request.query_params.get("status")
        if status_param == "active":
            qs = qs.filter(is_active=True)
        elif status_param == "unsubscribed":
            qs = qs.filter(is_active=False)

        # Legacy boolean flag — kept for backwards compatibility.
        active = self.request.query_params.get("active")
        if active == "true":
            qs = qs.filter(is_active=True)
        elif active == "false":
            qs = qs.filter(is_active=False)

        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)

        list_id = self.request.query_params.get("list")
        if list_id:
            qs = qs.filter(lists__id=list_id)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(email__icontains=search) | Q(name__icontains=search)
            )

        return qs.distinct()

    @action(detail=False, methods=["get"])
    def stats(self, request):
        now = timezone.now()
        month_ago = now - timedelta(days=30)

        total = Subscriber.objects.count()
        active = Subscriber.objects.filter(is_active=True).count()
        unsubscribed = total - active
        new_this_month = Subscriber.objects.filter(
            subscribed_at__gte=month_ago
        ).count()

        # Churn = unsubscribed / total, as a percentage.
        churn_rate = _pct(unsubscribed, total)

        return Response({
            "total": total,
            "active": active,
            "unsubscribed": unsubscribed,
            "new_this_month": new_this_month,
            "churn_rate": churn_rate,
        })

    # ── FIXED: was `toggleActive` with url_path="toggleActive" ──
    # Renamed to `toggle_active` (Python convention) and url_path to
    # "toggle-active" so the route matches the frontend's
    # `/subscribers/<id>/toggle-active/` URL in admin-api.ts.
    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, id=None):
        subscriber = self.get_object()

        if subscriber.is_active:
            subscriber.mark_unsubscribed()
        else:
            subscriber.mark_subscribed(source=subscriber.source)

        # The frontend swaps the whole row in place, so return the full
        # serialized subscriber, not just a status flag.
        return Response(
            SubscriberAdminReadSerializer(
                subscriber, context=self.get_serializer_context()
            ).data
        )


# ============================================================================
# LISTS
# ============================================================================

class SubscriberListAdminViewSet(viewsets.ModelViewSet):
    """Admin management of manual subscriber lists."""

    permission_classes = [IsAdminUser]
    lookup_field = "id"

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SubscriberListAdminWriteSerializer
        return SubscriberListAdminReadSerializer

    def get_queryset(self):
        return (
            SubscriberList.objects
            .annotate(
                active_subscriber_count=Count(
                    "subscribers",
                    filter=Q(subscribers__is_active=True),
                    distinct=True,
                )
            )
            .order_by("name")
        )


# ============================================================================
# SEGMENTS
# ============================================================================

class SegmentListView(APIView):
    """
    Returns predefined newsletter segments.

    Shape matches the admin frontend's SegmentSerializer:
    { id, name, description, rules: [string], count, color }
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()

        active_count = Subscriber.objects.filter(is_active=True).count()
        inactive_count = Subscriber.objects.filter(is_active=False).count()
        new_count = Subscriber.objects.filter(
            is_active=True,
            subscribed_at__gte=now - timedelta(days=30),
        ).count()

        segments = [
            {
                "id": "all_active",
                "name": "All Active Subscribers",
                "description": "Every currently subscribed customer.",
                "rules": ["is_active = True"],
                "count": active_count,
                "color": "bg-blue-50 text-blue-950 border-blue-100",
            },
            {
                "id": "new_subscribers",
                "name": "New Subscribers",
                "description": "Subscribers added within the last 30 days.",
                "rules": ["is_active = True", "subscribed_at >= now - 30d"],
                "count": new_count,
                "color": "bg-emerald-50 text-emerald-700 border-emerald-100",
            },
            {
                "id": "inactive",
                "name": "Inactive Subscribers",
                "description": "Subscribers who have unsubscribed.",
                "rules": ["is_active = False"],
                "count": inactive_count,
                "color": "bg-rose-50 text-rose-700 border-rose-100",
            },
        ]

        return Response(segments)


# ============================================================================
# EMAIL TEMPLATES
# ============================================================================

class EmailTemplateAdminViewSet(viewsets.ModelViewSet):
    """Admin management of reusable email templates."""

    permission_classes = [IsAdminUser]
    lookup_field = "id"

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return EmailTemplateAdminWriteSerializer
        return EmailTemplateAdminReadSerializer

    def get_queryset(self):
        qs = EmailTemplate.objects.all().order_by("-updated_at")

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(subject__icontains=search)
            )

        return qs


# ============================================================================
# CAMPAIGNS
# ============================================================================

class CampaignAdminViewSet(viewsets.ModelViewSet):
    """
    Admin management of newsletter campaigns.

    Extra actions the storefront calls:
      POST /campaigns/<id>/send/       — queue and dispatch
      POST /campaigns/<id>/pause/      — pause mid-flight
      POST /campaigns/<id>/resume/     — resume a paused send
      GET  /campaigns/<id>/status/     — lightweight poll during a live send
      GET  /campaigns/<id>/recipients/ — per-recipient report
    """

    queryset = Campaign.objects.all()
    serializer_class = CampaignAdminReadSerializer
    permission_classes = [IsAdminUser]
    lookup_field = "id"

    def get_queryset(self):
        qs = (
            Campaign.objects
            .select_related("template", "created_by")
            .order_by("-created_at")
        )

        campaign_status = self.request.query_params.get("status")
        if campaign_status:
            qs = qs.filter(status=campaign_status)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(subject__icontains=search)
            )

        return qs

    def perform_create(self, serializer):
        # Default status is DRAFT; if scheduled_at is set, promote to SCHEDULED
        # so send_scheduled_campaigns picks it up.
        scheduled_at = serializer.validated_data.get("scheduled_at")
        initial_status = (
            Campaign.Status.SCHEDULED if scheduled_at
            else Campaign.Status.DRAFT
        )
        serializer.save(
            created_by=self.request.user,
            status=initial_status,
        )

    # ------------------------------------------------------------------
    # SEND
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"])
    def send(self, request, id=None):
        campaign = self.get_object()

        if campaign.status not in (
            Campaign.Status.DRAFT,
            Campaign.Status.SCHEDULED,
            Campaign.Status.PAUSED,
            Campaign.Status.FAILED,
        ):
            return Response(
                {
                    "detail": (
                        f"Campaign cannot be sent while its status is "
                        f"'{campaign.status}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        audience = self._resolve_audience(campaign)

        if not audience.exists():
            return Response(
                {"detail": "No active subscribers found for this campaign."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # On a fresh send, drop any stale recipients from a prior attempt.
        if campaign.status != Campaign.Status.PAUSED:
            campaign.recipients.all().delete()

        existing_emails = set(
            campaign.recipients.values_list("email", flat=True)
        )

        to_create = [
            CampaignRecipient(
                campaign=campaign,
                email=sub.email,
                subscriber=sub,
                status=CampaignRecipient.Status.QUEUED,
            )
            for sub in audience.iterator(chunk_size=500)
            if sub.email not in existing_emails
        ]

        if to_create:
            CampaignRecipient.objects.bulk_create(to_create, batch_size=500)

        campaign.recipient_count = campaign.recipients.count()
        campaign.sent_count = campaign.recipients.filter(
            status=CampaignRecipient.Status.SENT
        ).count()
        campaign.failed_count = campaign.recipients.filter(
            status=CampaignRecipient.Status.FAILED
        ).count()
        campaign.status = Campaign.Status.QUEUED
        campaign.save(
            update_fields=[
                "recipient_count",
                "sent_count",
                "failed_count",
                "status",
            ]
        )

        send_campaign.delay(campaign.id)

        # Return the full serialized campaign — the frontend replaces the
        # whole row via `setCampaigns((p) => p.map(x => x.id === updated.id ...))`.
        return Response(
            CampaignAdminReadSerializer(
                campaign, context=self.get_serializer_context()
            ).data
        )

    # ------------------------------------------------------------------
    # PAUSE
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"])
    def pause(self, request, id=None):
        campaign = self.get_object()

        if campaign.status not in (
            Campaign.Status.QUEUED,
            Campaign.Status.SENDING,
        ):
            return Response(
                {
                    "detail": (
                        f"Campaign cannot be paused while its status is "
                        f"'{campaign.status}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        campaign.status = Campaign.Status.PAUSED
        campaign.save(update_fields=["status"])

        return Response(
            CampaignAdminReadSerializer(
                campaign, context=self.get_serializer_context()
            ).data
        )

    # ------------------------------------------------------------------
    # RESUME
    # ------------------------------------------------------------------

    @action(detail=True, methods=["post"])
    def resume(self, request, id=None):
        campaign = self.get_object()

        if campaign.status != Campaign.Status.PAUSED:
            return Response(
                {
                    "detail": (
                        f"Campaign cannot be resumed while its status is "
                        f"'{campaign.status}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        campaign.status = Campaign.Status.QUEUED
        campaign.save(update_fields=["status"])

        send_campaign.delay(campaign.id)

        return Response(
            CampaignAdminReadSerializer(
                campaign, context=self.get_serializer_context()
            ).data
        )

    # ------------------------------------------------------------------
    # STATUS POLL
    # ------------------------------------------------------------------

    @action(detail=True, methods=["get"])
    def status(self, request, id=None):
        """Lightweight poll — the frontend hits this every 5 s while live."""
        campaign = self.get_object()
        return Response(
            CampaignStatusSerializer(
                campaign, context=self.get_serializer_context()
            ).data
        )

    # ------------------------------------------------------------------
    # RECIPIENTS
    # ------------------------------------------------------------------

    @action(detail=True, methods=["get"])
    def recipients(self, request, id=None):
        campaign = self.get_object()

        qs = (
            CampaignRecipient.objects
            .filter(campaign=campaign)
            .select_related("subscriber")
            .order_by("-sent_at", "-id")
        )

        recipient_status = request.query_params.get("status")
        if recipient_status:
            qs = qs.filter(status=recipient_status)

        # The frontend wraps this in `asArray(...)` and reads either
        # a bare list or { results: [...] } — return { results: [...] }.
        return Response({
            "campaign_id": campaign.id,
            "count": qs.count(),
            "results": CampaignRecipientAdminSerializer(
                qs, many=True, context=self.get_serializer_context()
            ).data,
        })

    # ------------------------------------------------------------------
    # AUDIENCE RESOLVER
    # ------------------------------------------------------------------

    def _resolve_audience(self, campaign):
        """Subscribers who should receive this campaign."""
        if campaign.audience_type == Campaign.AudienceType.LIST:
            if not campaign.audience_id:
                return Subscriber.objects.none()
            return Subscriber.objects.filter(
                is_active=True,
                lists__id=campaign.audience_id,
            ).distinct()

        if campaign.audience_type == Campaign.AudienceType.SEGMENT:
            segment_id = campaign.audience_id
            base = Subscriber.objects.filter(is_active=True)

            if segment_id == "new_subscribers":
                return base.filter(
                    subscribed_at__gte=timezone.now() - timedelta(days=30)
                )
            if segment_id == "inactive":
                # "Inactive" as a segment currently falls back to active —
                # sending to unsubscribed users would be a compliance issue.
                return base
            # all_active or unknown slug → everyone active.
            return base

        return Subscriber.objects.filter(is_active=True)


# ============================================================================
# ANALYTICS
# ============================================================================

class GrowthAnalyticsView(APIView):
    """
    Monthly subscriber growth for the last 12 months.

    Always returns exactly 12 rows — one per calendar month, oldest first —
    with 0 for months that had no signups. This gives the frontend chart a
    continuous x-axis and a line it can actually draw.

    A single data point produces a dot, not a line. Sparse early-stage data
    is the norm, so we pad here rather than making the chart guess.

    Shape matches the admin chart: [{ month, subscribers }]
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()

        # First day of the month 11 months ago → covers 12 buckets total.
        start = _month_cursor_start(now, months_back=11)

        # Aggregate real signups by month.
        rows = (
            Subscriber.objects
            .filter(subscribed_at__gte=start, is_active=True)
            .annotate(month=TruncMonth("subscribed_at"))
            .values("month")
            .annotate(subscribers=Count("id"))
        )

        # Index by (year, month) so we can fill gaps below.
        by_month = {
            (r["month"].year, r["month"].month): r["subscribers"]
            for r in rows
            if r["month"] is not None
        }

        # Walk forward from `start`, one calendar month at a time,
        # emitting every bucket. Missing months are 0.
        data = []
        cursor = start
        for _ in range(12):
            key = (cursor.year, cursor.month)
            data.append({
                "month": cursor.strftime("%b %Y"),
                "subscribers": by_month.get(key, 0),
            })
            cursor = _advance_month(cursor)

        return Response(data)


class CampaignPerformanceView(APIView):
    """
    Per-campaign open/click/bounce rates.

    Shape matches the admin chart: [{ name, open, click, bounce }]
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        # Only sent campaigns have meaningful rates.
        campaigns = (
            Campaign.objects
            .filter(status=Campaign.Status.SENT)
            .order_by("-sent_at")[:10]
        )

        data = [
            {
                "name": c.name[:24] or c.subject[:24],
                "open": _pct(c.open_count, c.recipient_count),
                "click": _pct(c.click_count, c.recipient_count),
                "bounce": _pct(c.bounce_count, c.recipient_count),
            }
            for c in campaigns
        ]

        return Response(data)


class AnalyticsSummaryView(APIView):
    """
    Headline newsletter metrics.

    Shape matches `AdminAnalyticsSummary`:
      { delivered_total, delivery_rate,
        avg_open_rate, avg_click_rate, avg_unsub_rate }
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        agg = Campaign.objects.aggregate(
            sent=Sum("sent_count"),
            opens=Sum("open_count"),
            clicks=Sum("click_count"),
            unsubs=Sum("unsubscribe_count"),
            recipients=Sum("recipient_count"),
        )

        sent = agg["sent"] or 0
        recipients = agg["recipients"] or 0

        delivered_total = sent
        delivery_rate = _pct(sent, recipients)
        avg_open_rate = _pct(agg["opens"] or 0, sent)
        avg_click_rate = _pct(agg["clicks"] or 0, sent)
        avg_unsub_rate = _pct(agg["unsubs"] or 0, sent)

        return Response({
            "delivered_total": delivered_total,
            "delivery_rate": delivery_rate,
            "avg_open_rate": avg_open_rate,
            "avg_click_rate": avg_click_rate,
            "avg_unsub_rate": avg_unsub_rate,
        })


# ============================================================================
# CAMPAIGN IMAGE UPLOAD
# ============================================================================

class CampaignImageUploadView(APIView):
    """
    Upload endpoint for campaign hero images.

    The storefront reads `{ url }` from the response.
    """

    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    MAX_SIZE = 5 * 1024 * 1024  # 5 MB

    def post(self, request):
        ser = CampaignImageUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        image = ser.validated_data["file"]

        if image.content_type not in self.ALLOWED_TYPES:
            return Response(
                {
                    "detail": (
                        "Unsupported image type. "
                        "Use JPEG, PNG, WebP, or GIF."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if image.size > self.MAX_SIZE:
            return Response(
                {"detail": "Image must be smaller than 5MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.core.files.storage import default_storage

        filename = default_storage.save(
            f"newsletter/campaigns/{image.name}",
            image,
        )
        url = default_storage.url(filename)

        return Response(
            {"url": url, "filename": filename},
            status=status.HTTP_201_CREATED,
        )