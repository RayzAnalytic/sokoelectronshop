from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    PasswordResetToken,
    Role,
    Status,
    User,
    UserInvite,
)


# ══════════════════════════════════════════════════════════════════════════
# Inlines
# ══════════════════════════════════════════════════════════════════════════

class UserInviteInline(admin.TabularInline):
    """
    Show invites this user has sent, on the sender's detail page.

    Read-only — invites are created through the admin invite UI, not
    by hand in the Django admin. This is purely a convenience for
    auditing "who invited whom".
    """
    model = UserInvite
    fk_name = "invited_by"
    extra = 0
    can_delete = False
    show_change_link = True
    fields = ("email", "role", "status", "created_at", "expires_at", "accepted_at")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


# ══════════════════════════════════════════════════════════════════════════
# User
# ══════════════════════════════════════════════════════════════════════════

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Admin for the custom User model.

    BaseUserAdmin is written for Django's stock User (username-based).
    Since our USERNAME_FIELD is `email`, we override every fieldset,
    ordering, and lookup so the admin doesn't fall back to `username`
    (which doesn't exist here — it would raise FieldError on load).
    """

    ordering = ("-date_joined",)
    list_display = (
        "email",
        "full_name",
        "role_badge",
        "status_badge",
        "phone",
        "is_email_verified",
        "is_staff",
    )
    list_filter = ("role", "status", "is_email_verified", "is_staff", "is_active")
    search_fields = ("email", "first_name", "last_name", "phone")
    readonly_fields = ("last_login", "date_joined", "email_verified_at", "google_sub")
    list_per_page = 50
    date_hierarchy = "date_joined"
    inlines = (UserInviteInline,)

    # ── Detail view layout ──
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal", {"fields": ("first_name", "last_name", "phone")}),
        (
            "Access",
            {
                "fields": (
                    "role",
                    "status",
                    "is_email_verified",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (
            "Communication preferences",
            {
                "fields": (
                    "whatsapp_updates",
                    "email_promotions",
                    "sms_promotions",
                    "newsletter",
                ),
            },
        ),
        ("Google OAuth", {"fields": ("google_sub",)}),
        ("Invited by", {"fields": ("invited_by",)}),
        ("Account deletion", {"fields": ("deletion_requested_at",)}),
        ("Dates", {"fields": ("last_login", "date_joined", "email_verified_at")}),
    )

    # ── Add-user form ──
    # Keep `role` and `status` in the create form so seeded admin/staff
    # accounts can be made through the panel without a shell.
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "phone",
                    "password1",
                    "password2",
                    "role",
                    "status",
                    "is_staff",
                ),
            },
        ),
    )

    # ── Custom actions ──
    actions = ("mark_email_verified", "suspend_accounts", "reactivate_accounts")

    # ── Display helpers ──
    @admin.display(description="Name", ordering="first_name")
    def full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or "—"

    @admin.display(description="Role", ordering="role")
    def role_badge(self, obj):
        colors = {
            Role.OWNER: "#7c3aed",
            Role.STAFF: "#0ea5e9",
            Role.CUSTOMER: "#64748b",
        }
        return format_html(
            '<span style="display:inline-block;padding:2px 8px;border-radius:4px;'
            'font-size:11px;font-weight:600;color:#fff;background:{};">{}</span>',
            colors.get(obj.role, "#64748b"),
            obj.get_role_display(),
        )

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        colors = {
            Status.ACTIVE: "#16a34a",
            Status.SUSPENDED: "#dc2626",
            Status.PENDING: "#f59e0b",
        }
        return format_html(
            '<span style="display:inline-block;padding:2px 8px;border-radius:4px;'
            'font-size:11px;font-weight:600;color:#fff;background:{};">{}</span>',
            colors.get(obj.status, "#64748b"),
            obj.get_status_display(),
        )

    # ── Actions ──
    @admin.action(description="Mark selected users as email-verified")
    def mark_email_verified(self, request, queryset):
        updated = queryset.update(
            is_email_verified=True,
            email_verified_at=timezone.now(),
        )
        self.message_user(request, f"{updated} user(s) marked as verified.")

    @admin.action(description="Suspend selected accounts")
    def suspend_accounts(self, request, queryset):
        # Never suspend yourself out of the panel.
        updated = queryset.exclude(pk=request.user.pk).update(
            status=Status.SUSPENDED,
        )
        self.message_user(request, f"{updated} account(s) suspended.")

    @admin.action(description="Reactivate selected accounts")
    def reactivate_accounts(self, request, queryset):
        updated = queryset.update(status=Status.ACTIVE, is_active=True)
        self.message_user(request, f"{updated} account(s) reactivated.")

    # ── Guard rails ──
    def get_readonly_fields(self, request, obj=None):
        """
        Once a user exists, don't let an admin flip `email` — changing
        the identifier underneath Google OAuth / password reset links
        causes confusing failures. Use the profile flow instead.
        """
        fields = list(super().get_readonly_fields(request, obj))
        if obj is not None and "email" not in fields:
            fields.append("email")
        return fields

    def has_delete_permission(self, request, obj=None):
        # Soft-delete via `deletion_requested_at` is the intended path;
        # hard deletes would cascade across orders and audit history.
        if obj is not None and obj.pk == request.user.pk:
            return False
        return super().has_delete_permission(request, obj)


# ══════════════════════════════════════════════════════════════════════════
# Staff invites
# ══════════════════════════════════════════════════════════════════════════

@admin.register(UserInvite)
class UserInviteAdmin(admin.ModelAdmin):
    """
    Admin for the staff-invite table.

    Read-only by design:
      * Creation should go through the app's invite UI (which sends the
        email, logs the inviter, and enforces the "no existing account"
        rule). An invite row created by hand in Django admin would have
        a token but no email ever sent — a broken invite.
      * Deletion is disabled. Invites are cancelled (status=CANCELLED)
        so the audit trail survives.

    What admins *can* do here:
      * Filter and search invites.
      * Bulk-cancel pending invites via the action.
      * Copy a pending invite's accept URL (via the "invite_url"
        column) to manually hand to a person if the email got lost.
    """

    list_display = (
        "email",
        "role_badge",
        "status_badge",
        "invited_by",
        "created_at",
        "expires_at",
        "accepted_by",
    )
    list_filter = ("role", "status")
    search_fields = ("email", "invited_name", "invited_by__email")
    readonly_fields = (
        "token",
        "invite_url",
        "created_at",
        "expires_at",
        "accepted_at",
        "cancelled_at",
        "accepted_by",
    )
    list_per_page = 50
    date_hierarchy = "created_at"
    actions = ("cancel_invites",)

    # ── Read-only guards ──
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        # Allow viewing the detail page but not editing fields (they're
        # all readonly above). Bulk actions still work.
        return True

    # ── Display helpers ──
    @admin.display(description="Role", ordering="role")
    def role_badge(self, obj):
        colors = {Role.OWNER: "#7c3aed", Role.STAFF: "#0ea5e9"}
        return format_html(
            '<span style="display:inline-block;padding:2px 8px;border-radius:4px;'
            'font-size:11px;font-weight:600;color:#fff;background:{};">{}</span>',
            colors.get(obj.role, "#64748b"),
            obj.get_role_display(),
        )

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        colors = {
            UserInvite.Status.PENDING: "#f59e0b",
            UserInvite.Status.ACCEPTED: "#16a34a",
            UserInvite.Status.CANCELLED: "#64748b",
            UserInvite.Status.EXPIRED: "#dc2626",
        }
        return format_html(
            '<span style="display:inline-block;padding:2px 8px;border-radius:4px;'
            'font-size:11px;font-weight:600;color:#fff;background:{};">{}</span>',
            colors.get(obj.status, "#64748b"),
            obj.get_status_display(),
        )

    @admin.display(description="Accept URL")
    def invite_url(self, obj):
        """
        Manually-recoverable accept link. Shown on the detail page so
        an operator can copy/paste it if the invite email got lost —
        without regenerating the token (which would invalidate the
        original email link).
        """
        from django.conf import settings
        if not obj.token:
            return "—"
        url = f"{settings.FRONTEND_URL}/auth/staff/register?token={obj.token}"
        return format_html(
            '<a href="{0}" target="_blank" rel="noreferrer">{0}</a>',
            url,
        )

    # ── Actions ──
    @admin.action(description="Cancel selected pending invites")
    def cancel_invites(self, request, queryset):
        updated = queryset.filter(
            status=UserInvite.Status.PENDING,
        ).update(
            status=UserInvite.Status.CANCELLED,
            cancelled_at=timezone.now(),
        )
        self.message_user(request, f"{updated} invite(s) cancelled.")


# ══════════════════════════════════════════════════════════════════════════
# Password reset tokens
# ══════════════════════════════════════════════════════════════════════════

@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    """
    Admin for password-reset tokens.

    Mostly a forensic view — you use it to answer questions like:
      * "Was there a reset requested for this account?"
      * "Which IP requested the reset?"
      * "Did the user actually use the token, or is it still live?"

    Read-only. Tokens are created by the forgot-password view and
    consumed by the reset-password view or the login signal. Nothing
    in the admin should mutate them.

    What admins *can* do here:
      * Search by email, token, or IP.
      * Bulk-invalidate pending tokens via the action — useful if you
        suspect a leaked link.
    """

    list_display = (
        "user_email",
        "token_preview",
        "state_badge",
        "requested_ip",
        "created_at",
        "expires_at",
        "used_at",
    )
    list_filter = ("used_at",)
    search_fields = ("user__email", "token", "requested_ip")
    readonly_fields = (
        "user",
        "token",
        "created_at",
        "expires_at",
        "used_at",
        "requested_ip",
    )
    list_per_page = 50
    date_hierarchy = "created_at"
    actions = ("invalidate_tokens",)

    # ── Read-only guards ──
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return True  # view-only; all fields are readonly

    # ── Display helpers ──
    @admin.display(description="User", ordering="user__email")
    def user_email(self, obj):
        return obj.user.email if obj.user else "—"

    @admin.display(description="Token")
    def token_preview(self, obj):
        if not obj.token:
            return "—"
        # Show first 8 chars only — full token is visible on the detail page.
        return f"{obj.token[:8]}…"

    @admin.display(description="State")
    def state_badge(self, obj):
        if obj.used_at:
            label, color = "Used", "#64748b"
        elif obj.is_expired:
            label, color = "Expired", "#dc2626"
        else:
            label, color = "Active", "#f59e0b"
        return format_html(
            '<span style="display:inline-block;padding:2px 8px;border-radius:4px;'
            'font-size:11px;font-weight:600;color:#fff;background:{};">{}</span>',
            color, label,
        )

    # ── Actions ──
    @admin.action(description="Invalidate selected active tokens")
    def invalidate_tokens(self, request, queryset):
        updated = queryset.filter(used_at__isnull=True).update(
            used_at=timezone.now(),
        )
        self.message_user(request, f"{updated} token(s) invalidated.")


# ══════════════════════════════════════════════════════════════════════════
# Branding — admin site header
# ══════════════════════════════════════════════════════════════════════════
# These show up in the tab title and the header bar. Setting them keeps
# the Django admin visually aligned with the storefront instead of
# showing "Django administration".

admin.site.site_header = "Shop admin"
admin.site.site_title = "Shop admin"
admin.site.index_title = "Manage your shop"