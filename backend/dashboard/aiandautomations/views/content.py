from django.apps import apps
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import ContentDraft, BulkJob
from ..permissions import IsAdminUser
from ..serializers import ContentDraftSerializer
from ..services import content as content_svc
from ..tasks import run_bulk_content


def _product_ctx(pid):
    Product = apps.get_model('catalog', 'Product')
    p = Product.objects.filter(pk=pid).first()
    if not p:
        return None
    return {
        'title': getattr(p, 'title', ''),
        'description': getattr(p, 'description', ''),
        'price': str(getattr(p, 'price', '')),
        'attributes': getattr(p, 'attributes', {}),
    }


@api_view(['POST'])
@permission_classes([IsAdminUser])
def generate_view(request):
    data = request.data or {}
    pid = data.get('product_id')
    ctx = _product_ctx(pid)
    if not ctx:
        return Response({'detail': 'product not found'}, status=404)

    out = content_svc.generate(
        ctx,
        content_type=data.get('content_type', 'Product Description'),
        tone=data.get('tone', 'Professional'),
        language=data.get('language', 'English'),
        length=data.get('length', 'Medium'),
    )
    return Response(out)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def bulk_view(request):
    data = request.data or {}
    job = BulkJob.objects.create(
        product_ids=data.get('product_ids') or [],
        content_type=data.get('content_type', 'Product Description'),
        tone=data.get('tone', 'Professional'),
        language=data.get('language', 'English'),
        length=data.get('length', 'Medium'),
    )
    run_bulk_content.delay(job.pk)
    return Response({'jobId': job.pk})


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def drafts_view(request):
    if request.method == 'GET':
        pid = request.query_params.get('product_id')
        qs = ContentDraft.objects.all()
        if pid:
            qs = qs.filter(product_id=pid)
        return Response(ContentDraftSerializer(qs[:100], many=True).data)

    s = ContentDraftSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data, status=201)