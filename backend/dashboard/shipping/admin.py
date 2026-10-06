# dashboard/shipping/admin.py

"""
Django admin registrations. Minimal — the shop admin UI is the React
page, not Django admin. These are here so an engineer debugging a
specific row can find it without shell access.
"""

from django.contrib import admin

from .models import (
    CourierConfig,
    PickupLocation,
    Shipment,
    ShippingMethod,
    ShippingRate,
    ShippingZone,
)


class ShippingRateInline(admin.TabularInline):
    model = ShippingRate
    extra = 0


@admin.register(ShippingZone)
class ShippingZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "region", "county_count")
    search_fields = ("name", "region")
    inlines = [ShippingRateInline]

    @admin.display(description="Counties")
    def county_count(self, obj):
        return len(obj.counties or [])


@admin.register(ShippingMethod)
class ShippingMethodAdmin(admin.ModelAdmin):
    list_display = ("name", "default_price", "eta", "status")
    list_filter = ("status",)
    search_fields = ("name",)


@admin.register(PickupLocation)
class PickupLocationAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "county", "status")
    list_filter = ("type", "status", "county")
    search_fields = ("name", "address", "county")


@admin.register(CourierConfig)
class CourierConfigAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "enabled")
    list_filter = ("enabled",)
    search_fields = ("name", "slug")
    exclude = ("api_key",)  # set through the app's rotate flow, not here


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ("order", "status", "tracking_number", "provider", "updated_at")
    list_filter = ("status", "provider")
    search_fields = ("order__reference", "tracking_number")
    readonly_fields = ("created_at", "updated_at")