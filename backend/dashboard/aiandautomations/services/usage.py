from datetime import date, timedelta
from django.db.models import Sum
from django.db.models.functions import TruncDate

from ..models import UsageEvent


# Groq pricing approximations (KES / 1M tokens). Update as needed.
GROQ_RATES = {
    'assistant': {'in': 40.0, 'out': 120.0},   # per 1M tokens
    'content':   {'in': 40.0, 'out': 120.0},
    'search':    {'in': 40.0, 'out': 120.0},
}


def record_usage(feature: str, tokens_in: int, tokens_out: int):
    rates = GROQ_RATES.get(feature, GROQ_RATES['assistant'])
    cost = (tokens_in / 1_000_000) * rates['in'] + (tokens_out / 1_000_000) * rates['out']
    UsageEvent.objects.create(
        feature=feature,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_kes=cost,
        day=date.today(),
    )


def monthly_summary():
    today = date.today()
    start = today.replace(day=1)

    qs = UsageEvent.objects.filter(day__gte=start)
    totals = qs.aggregate(
        t_in=Sum('tokens_in'),
        t_out=Sum('tokens_out'),
        cost=Sum('cost_kes'),
    )
    tokens = (totals['t_in'] or 0) + (totals['t_out'] or 0)
    cost = float(totals['cost'] or 0)

    daily_qs = (
        qs.annotate(day_only=TruncDate('created_at'))
        .values('day_only', 'feature')
        .annotate(tokens=Sum('tokens_in') + Sum('tokens_out'))
    )
    buckets = {}
    for row in daily_qs:
        d = row['day_only'].strftime('%a')[:3]
        buckets.setdefault(d, {'day': d, 'assistant': 0, 'content': 0, 'search': 0})
        buckets[d][row['feature']] = row['tokens'] or 0

    ordered_days = []
    for i in range(6, -1, -1):
        d = (today - timedelta(days=i)).strftime('%a')[:3]
        ordered_days.append(buckets.get(d, {'day': d, 'assistant': 0, 'content': 0, 'search': 0}))

    feature_costs = {
        row['feature']: float(row['cost'] or 0)
        for row in qs.values('feature').annotate(cost=Sum('cost_kes'))
    }
    color_map = {'assistant': '#172554', 'content': '#10b981', 'search': '#8b5cf6'}
    cost_by_feature = [
        {'name': k.title(), 'value': round(v), 'color': color_map.get(k, '#94a3b8')}
        for k, v in feature_costs.items()
    ]

    days_active = max(1, (today - start).days + 1)
    return {
        'tokens_this_month': tokens,
        'estimated_cost_kes': round(cost),
        'daily_average': tokens // days_active,
        'assistant_share': int(
            ((feature_costs.get('assistant', 0) / cost) * 100) if cost else 0
        ),
        'usage_by_day': ordered_days,
        'cost_by_feature': cost_by_feature or [
            {'name': 'Assistant', 'value': 0, 'color': '#172554'},
        ],
    }