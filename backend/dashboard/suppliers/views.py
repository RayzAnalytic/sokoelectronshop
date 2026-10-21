import logging

from django.db import transaction
from rest_framework import status as http_status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from catalog.models import Product

from .models import Purchase, Supplier, SupplierActivity, SupplierProduct
from .serializers import (
    PurchaseInputSerializer,
    SupplierProductInputSerializer,
    SupplierReadSerializer,
    SupplierWriteSerializer,
)

logger = logging.getLogger(__name__)


def _user_label(request) -> str:
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return "System"
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.email or f"User {user.pk}"


def _build_stock_map(suppliers) -> dict:
    if not suppliers:
        return {}

    product_ids = (
        SupplierProduct.objects
        .filter(supplier__in=suppliers)
        .values_list("product_id", flat=True)
        .distinct()
    )

    return dict(
        Product.objects
        .filter(pk__in=product_ids)
        .values_list("pk", "stock_quantity")
    )


class SupplierViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    queryset = (
        Supplier.objects
        .prefetch_related(
            "supplier_products",
            "purchases",
            "activity",
        )
        .all()
    )

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SupplierWriteSerializer
        return SupplierReadSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()

        if self.action in ("create", "update", "partial_update"):
            return ctx

        try:
            suppliers = list(self.get_queryset())
            ctx["product_stock_map"] = _build_stock_map(suppliers)
        except Exception:
            logger.exception(
                "Failed to build product_stock_map; falling back to per-row queries."
            )
            ctx["product_stock_map"] = None

        return ctx

    def _read_response(self, supplier: Supplier) -> Response:
        fresh = self.get_queryset().get(pk=supplier.pk)
        return Response(
            SupplierReadSerializer(
                fresh,
                context=self.get_serializer_context(),
            ).data
        )

    def create(self, request, *args, **kwargs):
        write = SupplierWriteSerializer(data=request.data)
        write.is_valid(raise_exception=True)

        with transaction.atomic():
            supplier = write.save()
            SupplierActivity.objects.create(
                supplier=supplier,
                kind=SupplierActivity.Kind.CREATED,
                description="Supplier created",
                user_label=_user_label(request),
            )

        return self._read_response(supplier)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        write = SupplierWriteSerializer(
            instance, data=request.data, partial=partial,
        )
        write.is_valid(raise_exception=True)

        with transaction.atomic():
            supplier = write.save()
            SupplierActivity.objects.create(
                supplier=supplier,
                kind=SupplierActivity.Kind.UPDATED,
                description="Supplier details updated",
                user_label=_user_label(request),
            )

        return self._read_response(supplier)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request, pk=None):
        supplier = self.get_object()
        with transaction.atomic():
            supplier.status = (
                Supplier.Status.INACTIVE
                if supplier.status == Supplier.Status.ACTIVE
                else Supplier.Status.ACTIVE
            )
            supplier.save(update_fields=["status", "updated_at"])
            SupplierActivity.objects.create(
                supplier=supplier,
                kind=SupplierActivity.Kind.UPDATED,
                description=f"Marked supplier as {supplier.status}",
                user_label=_user_label(request),
            )
        return self._read_response(supplier)

    @action(detail=True, methods=["post"], url_path="add-products")
    def add_products(self, request, pk=None):
        supplier = self.get_object()

        raw = request.data
        if isinstance(raw, dict):
            raw = raw.get("items", [])
        if not isinstance(raw, list):
            return Response(
                {"detail": "Expected an array of products."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        ser = SupplierProductInputSerializer(data=raw, many=True)
        ser.is_valid(raise_exception=True)

        created = 0
        with transaction.atomic():
            for entry in ser.validated_data:
                product_id = entry["productId"]
                _, was_created = SupplierProduct.objects.get_or_create(
                    supplier=supplier,
                    product_id=product_id,
                    defaults={
                        "product_name": entry["name"],
                        "product_sku": entry.get("sku") or "",
                        "product_image": entry.get("image") or "",
                        "product_category": entry.get("category") or "",
                        "supplier_sku": entry.get("supplierSku") or "",
                        "cost_price": entry.get("costPrice") or 0,
                        "min_order_qty": entry.get("minOrderQty") or 1,
                        "lead_time_days": entry.get("leadTimeDays") or 14,
                        "last_purchase_price": entry.get("lastPurchasePrice") or 0,
                        "last_purchase_date": entry.get("lastPurchaseDate"),
                    },
                )
                if was_created:
                    created += 1

            if created:
                SupplierActivity.objects.create(
                    supplier=supplier,
                    kind=SupplierActivity.Kind.PRODUCT_ADDED,
                    description=(
                        f"Added {created} product"
                        f"{'s' if created != 1 else ''} to supplier catalogue"
                    ),
                    user_label=_user_label(request),
                )

        return self._read_response(supplier)

    @action(
        detail=True,
        methods=["post"],
        url_path=r"remove-product/(?P<sp_id>[^/.]+)",
    )
    def remove_product(self, request, pk=None, sp_id=None):
        supplier = self.get_object()
        deleted, _ = SupplierProduct.objects.filter(
            pk=sp_id, supplier=supplier,
        ).delete()
        if not deleted:
            return Response(
                {"detail": "Product link not found."},
                status=http_status.HTTP_404_NOT_FOUND,
            )
        SupplierActivity.objects.create(
            supplier=supplier,
            kind=SupplierActivity.Kind.UPDATED,
            description="Unlinked a product from supplier catalogue",
            user_label=_user_label(request),
        )
        return self._read_response(supplier)

    @action(detail=True, methods=["post"], url_path="purchases")
    def record_purchase(self, request, pk=None):
        supplier = self.get_object()

        ser = PurchaseInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        with transaction.atomic():
            purchase = Purchase.objects.create(
                supplier=supplier, **ser.to_model_kwargs(),
            )
            SupplierActivity.objects.create(
                supplier=supplier,
                kind=SupplierActivity.Kind.PURCHASE_RECORDED,
                description=(
                    f"Recorded purchase {purchase.number} "
                    f"({purchase.total_qty} units)"
                ),
                user_label=_user_label(request),
            )

        return self._read_response(supplier)