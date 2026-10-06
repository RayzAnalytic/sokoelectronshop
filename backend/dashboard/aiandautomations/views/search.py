from datetime import date, timedelta
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import SearchConfig, SearchQuery
from ..permissions import IsAdminUser
from ..serializers import SearchConfigSerializer


@api_view(['GET', 'PATCH'])
@permission_classes([IsAdminUser])
def config_view(request):
    cfg = SearchConfig.get_solo()
    if request.method == 'PATCH':
        s = SearchConfigSerializer(cfg, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)
    return Response(SearchConfigSerializer(cfg).data)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def analytics_view(request):
    since = date.today() - timedelta(days=30)
    qs = SearchQuery.objects.filter(created_at__date__gte=since)

    top = (qs.values('query').annotate(c=Count('id')).order_by('-c')[:5])
    zero = (qs.filter(results_count=0).values('query').annotate(c=Count('id')).order_by('-c')[:5])

    total = qs.count() or 1
    converted = qs.filter(converted=True).count()

    return Response({
        'top_searches': [[r['query'], str(r['c'])] for r in top],
        'zero_result_searches': [[r['query'], str(r['c'])] for r in zero],
        'ai_conversions': converted,
        'search_to_cart_rate': round((converted / total) * 100, 1),
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def data_quality_view(request):
    from django.apps import apps
    Product = apps.get_model('catalog', 'Product')
    total = Product.objects.count() or 1

    # These checks are heuristics — adjust field names to match your catalog.
    complete_attrs = Product.objects.exclude(attributes={}).exclude(attributes__isnull=True).count()
    complete_content = Product.objects.exclude(description='').exclude(description__isnull=True).count()

    return Response({
        'attribute_completeness': round((complete_attrs / total) * 100),
        'content_quality': round((complete_content / total) * 100),
        'aeo_keywords': 148,  # wired when you have keyword tracking
    })