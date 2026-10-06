from django.contrib import admin

from .models import StockMovement


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("created_at", "product_id", "quantity_delta", "reason", "reference", "actor")
    list_filter = ("reason", "created_at")
    search_fields = ("product_id", "reference", "notes")
    readonly_fields = (
        "product_id", "quantity_delta", "reason",
        "reference", "notes", "actor", "created_at",
    )
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        # The ledger is append-only from the app, not from admin.
        return False

    def has_change_permission(self, request, obj=None):
        # Nothing on a movement is editable — it's a historical fact.
        return False