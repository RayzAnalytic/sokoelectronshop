from django.db.models import Count
from django.shortcuts import get_object_or_404

from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.models import Order
from ..serializers import OrderDetailSerializer, OrderListSerializer


class OrderListView(APIView):
    def get(self, request):
        qs = (
            Order.objects.filter(user=request.user)
            .annotate(item_count=Count("items"))
            .order_by("-created_at")
        )
        return Response(OrderListSerializer(qs, many=True).data)


class OrderDetailView(APIView):
    def get(self, request, reference):
        order = get_object_or_404(
            Order.objects.prefetch_related("items"),
            reference=reference,
            user=request.user,
        )
        return Response(OrderDetailSerializer(order).data)