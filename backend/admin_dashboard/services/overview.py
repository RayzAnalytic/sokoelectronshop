from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta

from admin_dashboard.models.orders import Order
from admin_dashboard.models.customers import CustomerProfile
from admin_dashboard.models.products import Product


def get_dashboard_stats():
    today = timezone.now().date()
    last_30 = today - timedelta(days=30)

    return {
        'total_orders': Order.objects.count(),
        'orders_last_30_days': Order.objects.filter(created_at__date__gte=last_30).count(),
        'total_revenue': Order.objects.filter(payment_status='PAID').aggregate(Sum('total'))['total__sum'] or 0,
        'revenue_last_30_days': Order.objects.filter(
            payment_status='PAID', created_at__date__gte=last_30
        ).aggregate(Sum('total'))['total__sum'] or 0,
        'total_customers': CustomerProfile.objects.count(),
        'total_products': Product.objects.filter(is_deleted=False).count(),
        'low_stock_products': Product.objects.filter(
            stock_quantity__lte=5, is_deleted=False, is_active=True
        ).count(),
    }