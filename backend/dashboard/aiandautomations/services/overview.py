from django.db.models import Count

from ..models import AISettings, Automation, AutomationStatus, UsageEvent
from .usage import monthly_summary


def build_overview():
    s = AISettings.get_solo()
    usage = monthly_summary()

    active = Automation.objects.filter(status=AutomationStatus.ACTIVE).count()
    total = Automation.objects.count()

    return {
        'assistant_status': 'Active' if s.enabled else 'Inactive',
        'active_automations': active,
        'total_automations': total,
        'tokens_this_month': usage['tokens_this_month'],
        'estimated_cost_kes': usage['estimated_cost_kes'],
        'usage_by_day': usage['usage_by_day'],
        'cost_by_feature': usage['cost_by_feature'],
    }