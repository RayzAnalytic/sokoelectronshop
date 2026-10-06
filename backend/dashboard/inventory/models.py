"""
Inventory app.

One table today: `StockMovement`, an append-only ledger of every
stock change. Written by:

  * `checkout.services._persist_order`        → SALE, one per order line
  * `checkout.services.change_order_status`   → RETURN, on RETURNED
  * `dashboard.inventory.views` Adjust modal  → ADJUSTMENT / DAMAGE / etc.
  * `dashboard.suppliers` when a purchase is  → RESTOCK (future)

Nothing updates or deletes a row. Corrections are written as new,
offsetting movements — the ledger is the truth, and rewriting history
is not a thing.

Single-warehouse. `product_id` is a CharField (not a ForeignKey)
because `catalog.Product.id` is a string like `prod_abc123`. This
matches the convention on `OrderItem.product_id` and
`SupplierProduct.product_id`.
"""

from django.conf import settings
from django.db import models


class StockMovement(models.Model):
    class Reason(models.TextChoices):
        SALE = "sale", "Sale"
        RESTOCK = "restock", "Restock"
        ADJUSTMENT = "adjustment", "Adjustment"
        DAMAGE = "damage", "Damage"
        RETURN = "return", "Return"
        CORRECTION = "correction", "Correction"
        TRANSFER_IN = "transfer_in", "Transfer In"
        TRANSFER_OUT = "transfer_out", "Transfer Out"

    product_id = models.CharField(max_length=64, db_index=True)
    quantity_delta = models.IntegerField(
        help_text="Signed. +10 for a restock, -3 for a sale.",
    )
    reason = models.CharField(
        max_length=20,
        choices=Reason.choices,
        db_index=True,
    )
    reference = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        help_text="Order reference, PO number, or manual adjustment ID.",
    )
    notes = models.TextField(blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="stock_movements",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product_id", "-created_at"]),
            models.Index(fields=["reason", "-created_at"]),
        ]
        verbose_name = "Stock movement"
        verbose_name_plural = "Stock movements"

    def __str__(self):
        sign = "+" if self.quantity_delta >= 0 else ""
        return f"{self.product_id} {sign}{self.quantity_delta} ({self.reason})"