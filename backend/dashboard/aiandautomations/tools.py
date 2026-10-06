"""
Read-only tools the LLM can call.
Each tool is a plain function + a JSON schema, wired through SERVICES.
"""
from datetime import date, timedelta
from django.apps import apps as django_apps
from django.db.models import Sum, Count, F


def _order():
    return django_apps.get_model('checkout', 'Order')


def _product():
    return django_apps.get_model('catalog', 'Product')


def _customer():
    return django_apps.get_model('account', 'Customer')


# ── Tool implementations ────────────────────────────────────────────────

def sales_trend(start: str, end: str):
    """Returns daily revenue + order counts between two ISO dates."""
    Order = _order()
    rows = (
        Order.objects
        .filter(is_paid=True, created_at__date__gte=start, created_at__date__lte=end)
        .values('created_at__date')
        .annotate(revenue=Sum('total'), orders=Count('id'))
        .order_by('created_at__date')
    )
    return [
        {'date': str(r['created_at__date']), 'revenue': float(r['revenue'] or 0), 'orders': r['orders']}
        for r in rows
    ]


def low_stock_products(limit: int = 10):
    Product = _product()
    qs = Product.objects.filter(stock__lt=F('low_stock_threshold')).order_by('stock')[:limit]
    return [{'id': p.pk, 'title': getattr(p, 'title', str(p)), 'stock': p.stock,
             'threshold': p.low_stock_threshold} for p in qs]


def top_customers(limit: int = 10):
    Customer = _customer()
    qs = Customer.objects.order_by('-total_spend')[:limit]
    return [{'id': c.pk, 'name': getattr(c, 'name', str(c)),
             'total_spend': float(getattr(c, 'total_spend', 0))} for c in qs]


def unpaid_orders(limit: int = 20):
    Order = _order()
    qs = Order.objects.filter(is_paid=False).order_by('-created_at')[:limit]
    return [{'id': o.pk, 'total': float(o.total), 'created_at': str(o.created_at)} for o in qs]


def channel_breakdown(start: str, end: str):
    Order = _order()
    qs = (
        Order.objects
        .filter(is_paid=True, created_at__date__gte=start, created_at__date__lte=end)
        .values('channel')
        .annotate(revenue=Sum('total'), orders=Count('id'))
    )
    return [{'channel': r['channel'] or 'unknown',
             'revenue': float(r['revenue'] or 0), 'orders': r['orders']} for r in qs]


def average_order_value(start: str, end: str):
    Order = _order()
    qs = Order.objects.filter(is_paid=True, created_at__date__gte=start, created_at__date__lte=end)
    agg = qs.aggregate(total=Sum('total'), count=Count('id'))
    aov = (agg['total'] or 0) / (agg['count'] or 1)
    return {'aov': float(aov), 'orders': agg['count'] or 0}


def this_week_range():
    today = date.today()
    start = today - timedelta(days=7)
    return {'start': str(start), 'end': str(today)}


# ── Schema + dispatcher ─────────────────────────────────────────────────

TOOLS_SCHEMA = [
    {
        'type': 'function',
        'function': {
            'name': 'sales_trend',
            'description': 'Get daily revenue and order counts between two ISO dates (YYYY-MM-DD).',
            'parameters': {
                'type': 'object',
                'properties': {
                    'start': {'type': 'string'},
                    'end': {'type': 'string'},
                },
                'required': ['start', 'end'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'low_stock_products',
            'description': 'List products whose stock is below their low-stock threshold.',
            'parameters': {'type': 'object', 'properties': {'limit': {'type': 'integer', 'default': 10}}},
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'top_customers',
            'description': 'Return the top N customers by total lifetime spend.',
            'parameters': {'type': 'object', 'properties': {'limit': {'type': 'integer', 'default': 10}}},
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'unpaid_orders',
            'description': 'List orders that have not yet been paid.',
            'parameters': {'type': 'object', 'properties': {'limit': {'type': 'integer', 'default': 20}}},
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'channel_breakdown',
            'description': 'Revenue + orders per channel (tiktok, whatsapp, web) between two dates.',
            'parameters': {
                'type': 'object',
                'properties': {'start': {'type': 'string'}, 'end': {'type': 'string'}},
                'required': ['start', 'end'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'average_order_value',
            'description': 'Average order value between two ISO dates.',
            'parameters': {
                'type': 'object',
                'properties': {'start': {'type': 'string'}, 'end': {'type': 'string'}},
                'required': ['start', 'end'],
            },
        },
    },
]


DISPATCH = {
    'sales_trend': sales_trend,
    'low_stock_products': low_stock_products,
    'top_customers': top_customers,
    'unpaid_orders': unpaid_orders,
    'channel_breakdown': channel_breakdown,
    'average_order_value': average_order_value,
}


def run_tool(name: str, args: dict):
    fn = DISPATCH.get(name)
    if not fn:
        return {'error': f'unknown tool: {name}'}
    try:
        return fn(**args)
    except Exception as e:
        return {'error': str(e)}