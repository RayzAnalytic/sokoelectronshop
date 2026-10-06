# dashboard/users/admin.py

from django.contrib import admin

from .models import (
    InviteStatus,
    ModulePermission,
    Role,
    StaffInvite,
    StaffProfile,
    UserStatus,
)


# ─────────────────────────────────────────────────────────────
# STAFF PROFILE
# ─────────────────────────────────────────────────────────────

@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    """
    Django-admin view of staff accounts.

    Note on `last_login_at`:
        The model field was dropped — Django's `auth.User.last_login`
        already tracks this and duplicating it invites drift. The
        admin reads through to `user.last_login` via the `last_login`
        method below.
    """
    list_display = (
        'name',
        'get_email',
        'role',
        'status',
        'department',
        'last_login',
    )
    list_filter = ('role', 'status', 'department')
    search_fields = ('name', 'user__email')
    readonly_fields = ('user', 'last_login')
    ordering = ('-user__date_joined',)

    @admin.display(description='Email', ordering='user__email')
    def get_email(self, obj):
        return obj.user.email

    @admin.display(description='Last login', ordering='user__last_login')
    def last_login(self, obj):
        """
        Read through to the auth User. Guarded with `obj.user_id` so a
        profile row that somehow lost its user doesn't blow up the
        admin list.
        """
        return obj.user.last_login if obj.user_id else None


# ─────────────────────────────────────────────────────────────
# ROLE
# ─────────────────────────────────────────────────────────────

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'scope', 'is_customer')
    list_filter = ('is_customer',)
    search_fields = ('name',)


# ─────────────────────────────────────────────────────────────
# MODULE PERMISSION
# ─────────────────────────────────────────────────────────────

@admin.register(ModulePermission)
class ModulePermissionAdmin(admin.ModelAdmin):
    list_display = ('module', 'group', 'role', 'granted')
    list_filter = ('group', 'role', 'granted')
    search_fields = ('module',)
    ordering = ('group', 'module', 'role')


# ─────────────────────────────────────────────────────────────
# STAFF INVITE
# ─────────────────────────────────────────────────────────────

@admin.register(StaffInvite)
class StaffInviteAdmin(admin.ModelAdmin):
    """
    Read-mostly view of staff invites.

    `status` is the lifecycle column — Pending / Accepted / Cancelled /
    Expired. `is_valid` isn't a real field, so it isn't in list_display
    (it's a Python property and calling it in a list column would fire
    a query per row on the model's `expires_at` check).
    """
    list_display = (
        'email',
        'name',
        'role',
        'department',
        'status',
        'invited_by',
        'created_at',
        'expires_at',
    )
    list_filter = ('status', 'role', 'department')
    search_fields = ('email', 'name')
    readonly_fields = (
        'id',
        'token',
        'status',
        'created_at',
        'accepted_at',
        'accepted_by',
        'cancelled_at',
    )
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    fieldsets = (
        (None, {
            'fields': (
                'id',
                'email',
                'name',
                'role',
                'department',
                'message',
            ),
        }),
        ('Lifecycle', {
            'fields': (
                'status',
                'token',
                'expires_at',
                'created_at',
                'accepted_at',
                'accepted_by',
                'cancelled_at',
            ),
        }),
        ('Audit', {
            'fields': ('invited_by',),
        }),
    )