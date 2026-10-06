from datetime import date, timedelta
from celery import shared_task
from django.utils import timezone

from .models import BulkJob, AISettings, ContentDraft, UsageEvent
from .services import content as content_svc
from .services.insights import generate_insights as _gen_insights
from .services.usage import monthly_summary


@shared_task
def run_bulk_content(job_id: str):
    job = BulkJob.objects.filter(pk=job_id).first()
    if not job:
        return
    job.status = 'running'
    job.save(update_fields=['status'])

    from django.apps import apps
    Product = apps.get_model('catalog', 'Product')
    results = []

    for pid in job.product_ids:
        p = Product.objects.filter(pk=pid).first()
        if not p:
            results.append({'product_id': pid, 'error': 'not found'})
            continue
        ctx = {
            'title': getattr(p, 'title', ''),
            'description': getattr(p, 'description', ''),
            'price': str(getattr(p, 'price', '')),
        }
        try:
            out = content_svc.generate(ctx, job.content_type, job.tone, job.language, job.length)
            draft = ContentDraft.objects.create(
                product_id=str(pid),
                content_type=job.content_type,
                tone=job.tone,
                language=job.language,
                length=job.length,
                body=out['body'],
            )
            results.append({'product_id': pid, 'draft_id': draft.pk, 'body': out['body']})
        except Exception as e:
            results.append({'product_id': pid, 'error': str(e)})

    job.results = results
    job.status = 'done'
    job.save(update_fields=['results', 'status'])


@shared_task
def generate_insights():
    """Nightly: regenerate insights from current data."""
    from .models import Insight
    Insight.objects.filter(dismissed_at__isnull=True).delete()
    _gen_insights()


@shared_task
def check_budget():
    """Every 30 min: notify if we're above 80% of budget."""
    s = AISettings.get_solo()
    if not s.budget_alert:
        return
    usage = monthly_summary()
    if s.monthly_budget_kes and usage['estimated_cost_kes'] >= 0.8 * float(s.monthly_budget_kes):
        from .models import AuditLog
        AuditLog.objects.create(
            action='ai.budget_alert',
            detail=usage,
        )


@shared_task
def prune_audit_log():
    s = AISettings.get_solo()
    cutoff = timezone.now() - timedelta(days=s.audit_retention_days)
    from .models import AuditLog
    AuditLog.objects.filter(created_at__lt=cutoff).delete()


@shared_task
def prune_usage():
    """Keep 180 days of usage events."""
    cutoff = date.today() - timedelta(days=180)
    UsageEvent.objects.filter(day__lt=cutoff).delete()