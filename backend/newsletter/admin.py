# newsletter/admin.py
import csv

from django.contrib import admin, messages
from django.http import HttpResponse
from django.utils import timezone

from .models import Subscriber, SubscriberList


# ─────────────────────────────────────────────────────────────────────────────
# Inlines
# ─────────────────────────────────────────────────────────────────────────────
class SubscriberListMembershipInline(admin.TabularInline):
    """
    Shows which lists a subscriber belongs to, right on the change page.
    extra=0 so we don't render empty rows. The through-table is auto-
    generated (M2M without through=), so read-only is the honest setting
    unless you want the admin to manage membership from here too.
    """
    model = SubscriberList.subscribers.through
    extra = 0
    verbose_name = "List membership"
    verbose_name_plural = "List memberships"


# ─────────────────────────────────────────────────────────────────────────────
# Subscriber
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(Subscriber)
class SubscriberAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "name",
        "is_active",
        "source",
        "tag_list",
        "subscribed_at",
        "unsubscribed_at",
    )
    list_filter = ("is_active", "source", "subscribed_at")
    search_fields = ("email", "name")
    ordering = ("-subscribed_at",)
    date_hierarchy = "subscribed_at"
    list_per_page = 50

    readonly_fields = (
        "id",
        "unsubscribe_token",
        "subscribed_at",
        "unsubscribed_at",
        "created_at",
        "updated_at",
    )

    actions = (
        "deactivate_selected",
        "reactivate_selected",
        "export_as_csv",
    )

    fieldsets = (
        (None, {
            "fields": ("email", "name", "is_active", "source", "tags")
        }),
        ("Metadata", {
            "fields": (
                "ip_address",
                "unsubscribe_token",
                "subscribed_at",
                "unsubscribed_at",
                "created_at",
                "updated_at",
            ),
            "classes": ("collapse",),
        }),
    )

    inlines = (SubscriberListMembershipInline,)

    # ── Columns ───────────────────────────────────────────────

    @admin.display(description="Tags")
    def tag_list(self, obj: Subscriber) -> str:
        """Renders tags as a comma-joined string in the changelist."""
        if not obj.tags:
            return "—"
        return ", ".join(str(t) for t in obj.tags)

    # ── Actions ───────────────────────────────────────────────

    @admin.action(description="Mark selected as unsubscribed")
    def deactivate_selected(self, request, queryset):
        now = timezone.now()
        # Queryset.update() bypasses auto_now, so updated_at must be set
        # explicitly — otherwise the audit column lies.
        updated = queryset.filter(is_active=True).update(
            is_active=False,
            unsubscribed_at=now,
            updated_at=now,
        )
        self.message_user(
            request,
            f"{updated} subscriber(s) marked inactive.",
            messages.SUCCESS,
        )

    @admin.action(description="Reactivate selected subscribers")
    def reactivate_selected(self, request, queryset):
        now = timezone.now()
        updated = queryset.filter(is_active=False).update(
            is_active=True,
            unsubscribed_at=None,
            subscribed_at=now,
            updated_at=now,
        )
        self.message_user(
            request,
            f"{updated} subscriber(s) reactivated.",
            messages.SUCCESS,
        )

    @admin.action(description="Export selected as CSV")
    def export_as_csv(self, request, queryset):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="subscribers-{timezone.now():%Y%m%d}.csv"'
        )

        writer = csv.writer(response)
        writer.writerow([
            "email", "name", "status", "source", "tags",
            "subscribed_at", "unsubscribed_at",
        ])
        for sub in queryset.iterator():
            writer.writerow([
                sub.email,
                sub.name,
                "Subscribed" if sub.is_active else "Unsubscribed",
                sub.source,
                "|".join(str(t) for t in (sub.tags or [])),
                sub.subscribed_at.isoformat() if sub.subscribed_at else "",
                sub.unsubscribed_at.isoformat() if sub.unsubscribed_at else "",
            ])

        self.message_user(
            request,
            f"Exported {queryset.count()} subscriber(s).",
            messages.SUCCESS,
        )
        return response


# ─────────────────────────────────────────────────────────────────────────────
# SubscriberList
# ─────────────────────────────────────────────────────────────────────────────
@admin.register(SubscriberList)
class SubscriberListAdmin(admin.ModelAdmin):
    list_display = ("name", "active_count", "created_at")
    search_fields = ("name", "description")
    ordering = ("name",)
    readonly_fields = ("created_at",)
    filter_horizontal = ("subscribers",)

    fieldsets = (
        (None, {
            "fields": ("name", "description", "color")
        }),
        ("Membership", {
            "fields": ("subscribers",),
            "classes": ("collapse",),
        }),
        ("Metadata", {
            "fields": ("created_at",),
            "classes": ("collapse",),
        }),
    )

    @admin.display(description="Active subscribers")
    def active_count(self, obj: SubscriberList) -> int:
        return obj.active_count