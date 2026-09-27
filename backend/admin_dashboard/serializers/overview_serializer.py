# admin_dashboard/serializers/overview_serializer.py
from rest_framework import serializers


class DashboardStatsSerializer(serializers.Serializer):
    total_orders = serializers.IntegerField()
    orders_last_30_days = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    revenue_last_30_days = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_customers = serializers.IntegerField()
    total_products = serializers.IntegerField()
    low_stock_products = serializers.IntegerField()
