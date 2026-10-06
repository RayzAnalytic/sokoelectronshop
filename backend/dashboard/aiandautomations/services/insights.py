"""Generates Insights from real store data. Run nightly via Celery."""
from datetime import date, timedelta
from django.apps import apps as django_apps
from django.db.models import Sum, Count, F

from ..models import Insight


def _order():    return django_apps.get_model('checkout', 'Order')
def _product():  return django_apps.get_model('catalog', 'Product')
def _customer(): return django_apps.get_model('account', 'Customer')


def generate_insights():
    Order = _order()
    Product = _product()
    Customer = _customer()
    today = date.today()

    created = []

    # ── Sales: this week vs last week ──
    this_week_start = today - timedelta(days=7)
    last_week_start = today - timedelta(days=14)
    tw = Order.objects.filter(is_paid=True, created_at__date__gte=this_week_start).aggregate(r=Sum('total'))['r'] or 0
    lw = Order.objects.filter(is_paid=True, created_at__date__gte=last_week_start,
                              created_at__date__lt=this_week_start).aggregate(r=Sum('total'))['r'] or 0
    if lw:
        pct = round(((tw - lw) / lw) * 100, 1)
        if abs(pct) >= 5:
            created.append(Insight.objects.create(
                category='sales',
                priority='high' if abs(pct) >= 15 else 'medium',
                text=f'Revenue is {"up" if pct > 0 else "down"} {abs(pct)}% this week vs last week.',
                action_label='View revenue breakdown',
                action_link='/admin/analytics',
            ))

    # ── Inventory: low stock ──
    low = Product.objects.filter(stock__lt=F('low_stock_threshold')).count()
    if low:
        created.append(Insight.objects.create(
            category='inventory',
            priority='high' if low >= 3 else 'medium',
            text=f'{low} product{"s" if low != 1 else ""} running low. Restock before the weekend.',
            action_label='Restock now',
            action_link='/admin/products',
        ))

    # ── Customer: dormant ──
    cutoff = today - timedelta(days=90)
    dormant = Customer.objects.filter(last_order_at__lt=cutoff).count()
    if dormant >= 10:
        created.append(Insight.objects.create(
            category='customer',
            priority='medium',
            text=f'{dormant} customers haven\'t ordered in 90 days. Consider a re-engagement campaign.',
            action_label='Send re-engagement campaign',
            action_link='/admin/whatsapp/broadcasts',
        ))

    # ── Channel: best performer ──
    channels = (
        Order.objects.filter(is_paid=True, created_at__date__gte=this_week_start)
        .values('channel')
        .annotate(r=Sum('total'))
        .order_by('-r')[:2]
    )
    if len(channels) >= 2:
        top = channels[0]
        created.append(Insight.objects.create(
            category='channel',
            priority='low',
            text=f'{top["channel"] or "Web"} led revenue this week at KES {float(top["r"] or 0):,.0f}.',
            action_label='Review channel strategy',
            action_link='/admin/analytics',
        ))

    return created