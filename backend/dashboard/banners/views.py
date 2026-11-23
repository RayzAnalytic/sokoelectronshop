from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import F, Max, Q, Sum
from rest_framework import status as http
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from .models import Banner, Placement, Status
from .serializers import BannerAdminSerializer, BannerSerializer


class BannerAdminViewSet(ModelViewSet):
    serializer_class = BannerAdminSerializer
    queryset = Banner.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params

        if q := p.get('q'):
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(headline__icontains=q)
                | Q(badge__icontains=q)
            )

        placement = p.get('placement')
        if placement and placement != 'ALL':
            qs = qs.filter(placement=placement)

        status = p.get('status')
        if status and status != 'ALL':
            qs = qs.filter(status=status)

        sort = p.get('sort', 'order')
        if sort == 'recent':
            return qs.order_by('-updated_at')
        if sort == 'name':
            return qs.order_by('name')
        if sort == 'ctr':
            return qs.order_by(F('clicks').desc(nulls_last=True))
        return qs.order_by('order', 'id')

    @action(
        detail=False,
        methods=['post'],
        url_path='uploads',
        parser_classes=[MultiPartParser, FormParser],
    )
    def uploads(self, request):
        f = request.FILES.get('file')
        kind = request.data.get('kind', 'desktop')

        if not f:
            return Response(
                {'detail': 'No file provided.'},
                status=http.HTTP_400_BAD_REQUEST,
            )
        if not (f.content_type or '').startswith('image/'):
            return Response(
                {'detail': 'Only image files are allowed.'},
                status=http.HTTP_400_BAD_REQUEST,
            )
        if f.size > 15 * 1024 * 1024:
            return Response(
                {'detail': 'Image is too large (max 15 MB).'},
                status=http.HTTP_400_BAD_REQUEST,
            )

        path = default_storage.save(f'banners/{kind}/{f.name}', f)

        url = default_storage.url(path)
        if not url.startswith(('http://', 'https://')):
            url = request.build_absolute_uri(url)

        if not settings.DEBUG and ('localhost' in url or '127.0.0.1' in url):
            url = f"{settings.MEDIA_URL_ABSOLUTE}{path}"

        return Response(
            {'url': url},
            status=http.HTTP_201_CREATED,
        )

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

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        b = self.get_object()

        if b.status == Status.ACTIVE:
            b.status = Status.DRAFT
        else:
            if b.placement == Placement.HOME_HERO:
                live_count = (
                    Banner.objects.filter(
                        placement=Placement.HOME_HERO,
                        status__in=[Status.ACTIVE, Status.SCHEDULED],
                    )
                    .exclude(pk=b.pk)
                    .count()
                )
                if live_count >= Banner.MAX_HERO_SLIDES:
                    return Response(
                        {
                            'detail': (
                                f'Maximum {Banner.MAX_HERO_SLIDES} hero slides '
                                'may be active or scheduled at once.'
                            )
                        },
                        status=http.HTTP_400_BAD_REQUEST,
                    )
            b.status = Status.ACTIVE

        b.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(b).data)

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


class HeroSlidesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Banner.objects.hero()
        data = BannerSerializer(qs, many=True).data

        for row in data:
            for field in ('desktop_image', 'tablet_image', 'mobile_image'):
                val = row.get(field) or ''
                if not val:
                    continue

                if 'localhost' in val or '127.0.0.1' in val:
                    marker = '/media/'
                    if marker in val:
                        path = val.split(marker, 1)[1]
                        row[field] = f"{settings.MEDIA_URL}{path}"
                        continue

                if not val.startswith(('http://', 'https://', 'data:')):
                    row[field] = request.build_absolute_uri(val)

        return Response(data)


class BannerTrackView(APIView):
    permission_classes = [AllowAny]

    EVENT_FIELD = {
        'impression': 'impressions',
        'click': 'clicks',
        'conversion': 'conversions',
    }

    def post(self, request, pk, event):
        field = self.EVENT_FIELD.get(event)
        if not field:
            return Response(
                {'detail': 'Unknown event'},
                status=http.HTTP_400_BAD_REQUEST,
            )

        updated = Banner.objects.filter(pk=pk).update(**{field: F(field) + 1})
        if not updated:
            return Response(
                {'detail': 'Not found'},
                status=http.HTTP_404_NOT_FOUND,
            )
        return Response({'ok': True})