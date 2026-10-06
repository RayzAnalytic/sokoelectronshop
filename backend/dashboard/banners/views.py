from django.db.models import F, Max, Q, Sum
from django.utils import timezone
from rest_framework import status as http
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from .models import Banner, Placement, Status
from .serializers import BannerSerializer


# ─────────────────────────────────────────────────────────────────────────────
# Admin — powers /dashboard/banners
# ─────────────────────────────────────────────────────────────────────────────
class BannerAdminViewSet(ModelViewSet):
    """
    Full CRUD for banners plus:
      POST   /api/dashboard/banners/{id}/duplicate/
      POST   /api/dashboard/banners/{id}/toggle/
      GET    /api/dashboard/banners/stats/
      POST   /api/dashboard/banners/reset/
    """

    serializer_class = BannerSerializer
    queryset = Banner.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params

        # ?q=search
        if q := p.get('q'):
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(headline__icontains=q)
                | Q(badge__icontains=q)
            )

        # ?placement=HOME_HERO|CATEGORY_HERO|PROMO_STRIP|ALL
        placement = p.get('placement')
        if placement and placement != 'ALL':
            qs = qs.filter(placement=placement)

        # ?status=ACTIVE|SCHEDULED|DRAFT|EXPIRED|ALL
        status = p.get('status')
        if status and status != 'ALL':
            qs = qs.filter(status=status)

        # ?sort=order|recent|name|ctr
        sort = p.get('sort', 'order')
        if sort == 'recent':
            return qs.order_by('-updated_at')
        if sort == 'name':
            return qs.order_by('name')
        if sort == 'ctr':
            return qs.order_by(F('clicks').desc(nulls_last=True))
        return qs.order_by('order', 'id')

    # ── POST /api/dashboard/banners/{id}/duplicate/ ───────────────────────
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        src = self.get_object()
        next_order = (Banner.objects.aggregate(m=Max('order'))['m'] or 0) + 1

        copy = Banner.objects.create(
            name=f'{src.name} (copy)',
            placement=src.placement,
            order=next_order,
            badge=src.badge,
            headline=src.headline,
            description=src.description,
            desktop_image=src.desktop_image,
            tablet_image=src.tablet_image,
            mobile_image=src.mobile_image,
            primary_cta_text=src.primary_cta_text,
            primary_cta_href=src.primary_cta_href,
            secondary_cta_text=src.secondary_cta_text,
            secondary_cta_href=src.secondary_cta_href,
            text_alignment=src.text_alignment,
            overlay_style=src.overlay_style,
            overlay_opacity=src.overlay_opacity,
            status=Status.DRAFT,
        )
        return Response(
            self.get_serializer(copy).data, status=http.HTTP_201_CREATED
        )

    # ── POST /api/dashboard/banners/{id}/toggle/ ──────────────────────────
    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        b = self.get_object()
        b.status = Status.DRAFT if b.status == Status.ACTIVE else Status.ACTIVE
        b.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(b).data)

    # ── GET /api/dashboard/banners/stats/ ─────────────────────────────────
    @action(detail=False, methods=['get'])
    def stats(self, request):
        agg = Banner.objects.aggregate(
            impressions=Sum('impressions'),
            clicks=Sum('clicks'),
            conversions=Sum('conversions'),
        )
        return Response({
            'active': Banner.objects.filter(status=Status.ACTIVE).count(),
            'total': Banner.objects.count(),
            'impressions': agg['impressions'] or 0,
            'clicks': agg['clicks'] or 0,
            'conversions': agg['conversions'] or 0,
        })

    # ── POST /api/dashboard/banners/reset/ ────────────────────────────────
    @action(detail=False, methods=['post'])
    def reset(self, request):
        from .management.commands.seed_banners import seed
        Banner.objects.all().delete()
        seed()
        return Response({'ok': True, 'count': Banner.objects.count()})


# ─────────────────────────────────────────────────────────────────────────────
# Public — powers <Hero />
# ─────────────────────────────────────────────────────────────────────────────
def _live_window_q(now):
    """
    (start_at is null OR start_at <= now) AND (end_at is null OR end_at > now)
    """
    return (
        (Q(start_at__isnull=True) | Q(start_at__lte=now))
        & (Q(end_at__isnull=True) | Q(end_at__gt=now))
    )


class HeroSlidesView(APIView):
    """
    GET /api/banners/hero/
    Mirrors activeHeroSlides() in lib/bannerStore.ts:
      placement = HOME_HERO, status = ACTIVE, within schedule, sorted by order.
    """

    def get(self, request):
        now = timezone.now()
        qs = (
            Banner.objects
            .filter(placement=Placement.HOME_HERO, status=Status.ACTIVE)
            .filter(_live_window_q(now))
            .order_by('order', 'id')
        )
        return Response(BannerSerializer(qs, many=True).data)


class BannerTrackView(APIView):
    """
    POST /api/banners/<id>/track/<impression|click|conversion>/
    Atomic counter bump — safe for concurrent calls.
    """

    EVENT_FIELD = {
        'impression': 'impressions',
        'click': 'clicks',
        'conversion': 'conversions',
    }

    def post(self, request, pk, event):
        field = self.EVENT_FIELD.get(event)
        if not field:
            return Response(
                {'detail': 'Unknown event'}, status=http.HTTP_400_BAD_REQUEST
            )

        updated = Banner.objects.filter(pk=pk).update(**{field: F(field) + 1})
        if not updated:
            return Response(
                {'detail': 'Not found'}, status=http.HTTP_404_NOT_FOUND
            )
        return Response({'ok': True})