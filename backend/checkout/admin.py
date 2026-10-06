"""
checkout/admin.py

Admin registrations for the checkout app.

AUTH MODEL:
    Checkout accepts BOTH guest and authenticated orders.

      * Signed-in customer → `Order.user` is set at creation time.
      * Guest customer     → `Order.user` is NULL. The order is
                             claimable on login via the
                             `user_logged_in` signal, matching on
                             `contact_email` OR `contact_phone`.

    `customer_display` renders the email + a "guest" tag for unowned
    orders. That tag is not legacy — it's the actual state of any
    order placed by an anonymous visitor between placement and their
    first login.

STATUS CHANGES MUST GO THROUGH THE SERVICE:
    Every admin action that changes `Order.status` calls
    `change_order_status()` — never a bulk `.update()`. That service:

      * Updates the field
      * Writes an `OrderStatusEvent` (the timeline)
      * Fires the customer notification on the transitions that
        matter (shipped, delivered, cancelled)
      * Triggers any inventory side-effects (release on cancel, when
        inventory lands)

    A bulk update skips all of that and leaves the audit trail
    silently broken. It's tempting because it's one SQL statement
    instead of a loop; it's wrong because it bypasses business rules.

Cart admin notes:

  * Cart is viewable and searchable, but not creatable or editable
    by hand. The row is auto-created on first item add via
    `get_or_create_cart`; every mutation goes through the service
    layer so variant uniqueness, snapshot refresh, and stock rules
    stay enforced.

  * CartItem lives as a read-only inline under Cart. An item without
    a cart is meaningless, so there is no standalone registration.
"""

from decimal import Decimal

from django.contrib import admin, messages
from django.db import transaction
from django.utils.html import format_html

from .models import (
    Cart,
    CartItem,
    Coupon,
    MpesaCallbackLog,
    Order,
    OrderItem,
    OrderStatusEvent,
    Payment,
)
from .services import change_order_status, transition_payment


# ═════════════════════════════════════════════════════════════════════════════
# Order
# ═════════════════════════════════════════════════════════════════════════════
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = (
        "product_id", "name", "brand",
        "unit_price", "quantity", "image_url",
    )
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        # Order items are snapshots — created atomically with the
        # order from the checkout payload. Editing them post-hoc would
        # desync the totals from `Order.snapshot`.
        return False


class OrderStatusEventInline(admin.TabularInline):
    """
    Read-only timeline, shown on the order detail page.

    Events are appended exclusively by `change_order_status()`. No
    admin path creates or edits one — if you need to annotate a
    transition, put the note in the action that triggered it, and it
    lands here automatically.
    """
    model = OrderStatusEvent
    extra = 0
    can_delete = False
    fields = (
        "created_at", "from_status", "to_status",
        "actor_label", "note",
    )
    readonly_fields = fields
    ordering = ("-created_at",)

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "customer_display",
        "payment_method",
        "total",
        "payment_status",
        "status",
        "delivery_method",
        "created_at",
    )
    list_filter = (
        "status",
        "payment_status",
        "payment_method",
        "delivery_method",
        "created_at",
    )
    search_fields = (
        "reference",
        "user__email",
        "user__phone",
        "contact_email",
        "contact_phone",
        "coupon_code",
        "courier",
        "tracking_number",
    )
    readonly_fields = (
        "reference",
        "snapshot",
        "client_total",
        "subtotal",
        "discount",
        "shipping",
        "tax",
        "total",
        "payment_method",
        "contact_email",
        "contact_phone",
        "created_at",
        "updated_at",
        "successful_payment_link",
        "latest_payment_link",
    )
    inlines = [OrderItemInline, OrderStatusEventInline]
    date_hierarchy = "created_at"
    list_select_related = ("user",)

    fieldsets = (
        ("Identity", {
            "fields": (
                "reference",
                "user",
                "contact_email",
                "contact_phone",
                "created_at",
                "updated_at",
            ),
        }),
        ("Status", {
            "fields": (
                "status",
                "payment_status",
                "payment_method",
            ),
        }),
        ("Delivery", {
            "fields": (
                "delivery_method",
                "estimated_delivery",
                "courier",
                "tracking_number",
            ),
        }),
        ("Notes", {
            "fields": (
                "notes",           # customer's checkout note
                "internal_notes",  # admin-only, never shown to customer
            ),
        }),
        ("Pricing", {
            "fields": (
                "subtotal",
                "discount",
                "coupon_code",
                "shipping",
                "tax",
                "total",
                "client_total",
            ),
        }),
        ("Payment traces", {
            "fields": (
                "successful_payment_link",
                "latest_payment_link",
            ),
        }),
        ("Frozen snapshot", {
            "classes": ("collapse",),
            "fields": ("snapshot",),
        }),
    )

    # ── Display helpers ───────────────────────────────────────────────
    @admin.display(description="Customer", ordering="user__email")
    def customer_display(self, obj):
        if obj.user_id:
            return obj.user.email
        # Unclaimed guest order. The claim happens on the customer's
        # first login/register, matching on contact_email or
        # contact_phone. Until then, `contact_email` is the only
        # durable identifier.
        if obj.contact_email:
            return f"{obj.contact_email} (guest)"
        return "—"

    @admin.display(description="Successful payment")
    def successful_payment_link(self, obj):
        payment = obj.successful_payment
        if not payment:
            return "—"
        url = f"/admin/checkout/payment/{payment.pk}/change/"
        return format_html(
            '<a href="{}">{}</a> — {} — receipt {}',
            url,
            str(payment.pk)[:8],
            payment.amount,
            payment.mpesa_receipt_number or "n/a",
        )

    @admin.display(description="Latest payment")
    def latest_payment_link(self, obj):
        payment = obj.latest_payment
        if not payment:
            return "— (COD order, or no attempt yet)"
        url = f"/admin/checkout/payment/{payment.pk}/change/"
        return format_html(
            '<a href="{}">{}</a> — {} — {}',
            url,
            str(payment.pk)[:8],
            payment.status,
            payment.amount,
        )

    # ── Bulk actions ──────────────────────────────────────────────────
    #
    # Every action below routes through `change_order_status()`. That
    # means each one writes a timeline event, fires the matching
    # customer notification, and (when inventory lands) triggers the
    # right reservation release/commit. A bulk `.update()` would skip
    # all three. The per-order loop is intentional.
    #
    # All actions take the acting admin as `actor` so the timeline
    # attributes the change correctly.
    actions = [
        "mark_processing",
        "mark_shipped",
        "mark_delivered",
        "mark_cancelled",
    ]

    def _actor_label(self, request) -> str:
        """
        Display string for the timeline. `get_username()` is more
        stable than `get_full_name()` for an audit log, since
        full_name can be edited by the user later.
        """
        return request.user.get_username() or "admin"

    @admin.action(description="Mark as PROCESSING")
    def mark_processing(self, request, queryset):
        actor_label = self._actor_label(request)
        count = 0
        for order in queryset.filter(
            status__in=(Order.Status.PENDING, Order.Status.CONFIRMED)
        ):
            change_order_status(
                order,
                Order.Status.PROCESSING,
                actor=request.user,
                actor_label=actor_label,
                note="Marked processing via admin action.",
            )
            count += 1
        self.message_user(
            request,
            f"Marked {count} order(s) as PROCESSING.",
            messages.SUCCESS,
        )

    @admin.action(description="Mark as SHIPPED")
    def mark_shipped(self, request, queryset):
        actor_label = self._actor_label(request)
        count = 0
        for order in queryset.filter(status=Order.Status.PROCESSING):
            change_order_status(
                order,
                Order.Status.SHIPPED,
                actor=request.user,
                actor_label=actor_label,
                note="Shipped via admin action.",
            )
            count += 1
        self.message_user(
            request,
            f"Marked {count} order(s) as SHIPPED.",
            messages.SUCCESS,
        )

    @admin.action(description="Mark as DELIVERED")
    def mark_delivered(self, request, queryset):
        actor_label = self._actor_label(request)
        count = 0
        for order in queryset.filter(status=Order.Status.SHIPPED):
            change_order_status(
                order,
                Order.Status.DELIVERED,
                actor=request.user,
                actor_label=actor_label,
                note="Delivered via admin action.",
            )
            count += 1
        self.message_user(
            request,
            f"Marked {count} order(s) as DELIVERED.",
            messages.SUCCESS,
        )

    @admin.action(description="Cancel selected orders")
    def mark_cancelled(self, request, queryset):
        """
        Cancels every non-terminal order in the selection.

        Triggers the customer cancellation notification AND — once
        inventory integration is wired — the reservation release for
        any stock the order was holding.
        """
        actor_label = self._actor_label(request)
        count = 0
        for order in queryset.exclude(
            status__in=(
                Order.Status.DELIVERED,
                Order.Status.RETURNED,
                Order.Status.CANCELLED,
                Order.Status.FAILED,
            )
        ):
            change_order_status(
                order,
                Order.Status.CANCELLED,
                actor=request.user,
                actor_label=actor_label,
                note="Cancelled via admin action.",
            )
            count += 1
        self.message_user(
            request,
            f"Cancelled {count} order(s).",
            messages.WARNING,
        )


# ═════════════════════════════════════════════════════════════════════════════
# Payment
# ═════════════════════════════════════════════════════════════════════════════
@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "short_id",
        "order",
        "status",
        "amount",
        "phone_number",
        "mpesa_receipt_number",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "order__reference",
        "phone_number",
        "mpesa_receipt_number",
        "checkout_request_id",
        "merchant_request_id",
    )
    readonly_fields = (
        "id",
        "order",
        "amount",
        "phone_number",
        "idempotency_key",
        "merchant_request_id",
        "checkout_request_id",
        "mpesa_receipt_number",
        "result_code",
        "result_description",
        "created_at",
        "updated_at",
    )
    list_select_related = ("order",)
    date_hierarchy = "created_at"
    actions = ["force_success"]

    @admin.display(description="ID", ordering="id")
    def short_id(self, obj):
        return str(obj.id)[:8]

    @admin.action(
        description="Force payment to SUCCESS (manual override)",
        permissions=["change"],
    )
    def force_success(self, request, queryset):
        """
        Manual override for a payment Safaricom completed but whose
        callback never arrived. Routes through `transition_payment`
        so the parent Order's status flips and the customer
        notification fires.

        Each payment is locked inside its own transaction so this
        cannot race the callback view (which takes the same lock).
        Without the lock, an admin clicking "Force SUCCESS" at the
        same moment the callback lands could fire two notifications
        and double-write the timeline.
        """
        actor = request.user.get_username() or "unknown"
        count = 0

        for payment_id in queryset.values_list("pk", flat=True):
            with transaction.atomic():
                payment = (
                    Payment.objects
                    .select_for_update()
                    .select_related("order")
                    .get(pk=payment_id)
                )
                if payment.status in Payment.TERMINAL_STATUSES:
                    continue
                transition_payment(
                    payment,
                    Payment.Status.SUCCESS,
                    result_code=0,
                    result_description=f"MANUAL OVERRIDE by {actor}",
                )
                count += 1

        if count:
            self.message_user(
                request,
                f"Forced {count} payment(s) to SUCCESS.",
                messages.WARNING,
            )
        else:
            self.message_user(
                request,
                "No eligible payments — all selected are already terminal.",
                messages.INFO,
            )


# ═════════════════════════════════════════════════════════════════════════════
# Order status timeline (standalone — cross-order auditing)
# ═════════════════════════════════════════════════════════════════════════════
@admin.register(OrderStatusEvent)
class OrderStatusEventAdmin(admin.ModelAdmin):
    """
    Cross-order view of the status timeline.

    The same events show on the order detail page as an inline. This
    standalone registration exists so you can answer questions like
    "which orders moved to CANCELLED in the last 7 days?" without
    opening each order individually.
    """
    list_display = (
        "created_at",
        "order",
        "from_status",
        "to_status",
        "actor_label",
        "short_note",
    )
    list_filter = ("to_status", "created_at")
    search_fields = (
        "order__reference",
        "actor_label",
        "note",
    )
    readonly_fields = (
        "order",
        "from_status",
        "to_status",
        "actor",
        "actor_label",
        "note",
        "created_at",
    )
    list_select_related = ("order", "actor")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    @admin.display(description="Note")
    def short_note(self, obj):
        if not obj.note:
            return "—"
        return obj.note[:80] + ("…" if len(obj.note) > 80 else "")

    def has_add_permission(self, request):
        # Events are written exclusively by `change_order_status`.
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        # The timeline is an immutable audit log.
        return False


# ═════════════════════════════════════════════════════════════════════════════
# Coupon
# ═════════════════════════════════════════════════════════════════════════════
@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "percent_off",
        "active",
        "usage_display",
        "valid_to",
        "min_subtotal",
    )
    list_filter = ("active",)
    search_fields = ("code",)
    readonly_fields = ("used_count",)
    ordering = ("code",)
    actions = ["reset_usage"]

    fieldsets = (
        ("Identity", {
            "fields": ("code", "percent_off", "active"),
        }),
        ("Limits", {
            "fields": (
                "max_uses",
                "used_count",
                "min_subtotal",
            ),
        }),
        ("Validity window", {
            "fields": ("valid_from", "valid_to"),
        }),
    )

    @admin.display(description="Usage")
    def usage_display(self, obj):
        if obj.max_uses is None:
            return f"{obj.used_count} (unlimited)"
        return f"{obj.used_count} / {obj.max_uses}"

    @admin.action(description="Reset used_count to zero")
    def reset_usage(self, request, queryset):
        count = queryset.update(used_count=0)
        self.message_user(
            request,
            f"Reset used_count on {count} coupon(s).",
            messages.WARNING,
        )


# ═════════════════════════════════════════════════════════════════════════════
# Cart
# ═════════════════════════════════════════════════════════════════════════════
class CartItemInline(admin.TabularInline):
    """
    Cart items render as a read-only inline under Cart.

    Read-only because the customer owns this data — staff should not
    be able to silently change a price or bump a quantity. If a cart
    needs correction, do it through the service layer so variant
    uniqueness, snapshot refresh, and stock rules stay enforced.
    """
    model = CartItem
    extra = 0
    can_delete = False
    fields = (
        "product_id",
        "variant_id",
        "name",
        "brand",
        "unit_price",
        "quantity",
        "stock",
        "added_at",
    )
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    """
    Read-only view of a customer's live cart.

    Every field is in `readonly_fields`, so Django renders the detail
    page without an editable input. Change permission stays True so
    the changelist renders row links normally — the fields being
    readonly is what makes this a viewer, not `has_change_permission
    = False`, which would also hide the changelist link for anyone
    without an explicit view permission.
    """
    list_display = (
        "user",
        "item_count_display",
        "total_units_display",
        "subtotal_display",
        "updated_at",
    )
    search_fields = ("user__email", "user__phone")
    readonly_fields = (
        "user",
        "created_at",
        "updated_at",
        "item_count_display",
        "total_units_display",
        "subtotal_display",
    )
    inlines = [CartItemInline]
    list_select_related = ("user",)
    date_hierarchy = "updated_at"

    fieldsets = (
        ("Owner", {
            "fields": ("user",),
        }),
        ("Summary", {
            "fields": (
                "item_count_display",
                "total_units_display",
                "subtotal_display",
            ),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    # ── Display helpers ───────────────────────────────────────────────
    @admin.display(description="Items")
    def item_count_display(self, obj):
        return obj.items.count()

    @admin.display(description="Units")
    def total_units_display(self, obj):
        return obj.total_units

    @admin.display(description="Subtotal")
    def subtotal_display(self, obj):
        total = sum(
            (item.unit_price * item.quantity for item in obj.items.all()),
            start=Decimal("0"),
        )
        return f"KES {total:,.2f}" if total else "—"

    # ── Permissions ───────────────────────────────────────────────────
    def has_add_permission(self, request):
        # Carts are auto-created on first item add via
        # `get_or_create_cart`. Fabricating one by hand would risk a
        # Cart with no owner, which the OneToOne forbids anyway.
        return False

    def has_delete_permission(self, request, obj=None):
        # Cleanup is legitimate — an abandoned cart can be removed.
        # This is the only mutation admin is allowed on a Cart.
        return True


# ═════════════════════════════════════════════════════════════════════════════
# M-Pesa callback log
# ═════════════════════════════════════════════════════════════════════════════
@admin.register(MpesaCallbackLog)
class MpesaCallbackLogAdmin(admin.ModelAdmin):
    list_display = (
        "checkout_request_id",
        "processed",
        "created_at",
    )
    list_filter = ("processed", "created_at")
    search_fields = ("checkout_request_id",)
    readonly_fields = (
        "body",
        "checkout_request_id",
        "processed",
        "created_at",
    )
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        # Callbacks are created by Safaricom, never by hand.
        return False

    def has_change_permission(self, request, obj=None):
        # Read-only. `processed` is flipped by the callback view, not
        # by staff — editing it here would desync the flag from the
        # actual processing state.
        return False

    def has_delete_permission(self, request, obj=None):
        # Deletion happens via the retention sweep task
        # (`sweep_stale_callback_logs`). Blocking manual deletes keeps
        # the retention policy in one place.
        return False