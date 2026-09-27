# catalog/views.py

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Category, Product
from .serializers import (
    CategoryReadSerializer,
    CategoryWriteSerializer,
    ProductReadSerializer,
    ProductWriteSerializer,
)


class CategoryListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user).order_by(
            "order", "name"
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CategoryWriteSerializer
        return CategoryReadSerializer


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return CategoryWriteSerializer
        return CategoryReadSerializer


class ProductListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Product.objects.filter(user=self.request.user)
            .prefetch_related("images")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProductWriteSerializer
        return ProductReadSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        return (
            Product.objects.filter(user=self.request.user)
            .prefetch_related("images")
        )

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ProductWriteSerializer
        return ProductReadSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
