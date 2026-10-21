from django.contrib import admin

from .models import (
    InviteStatus,
    ModulePermission,
    Role,
    StaffInvite,
    StaffProfile,
    UserStatus,
)


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
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
        return obj.user.last_login if obj.user_id else None


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'scope', 'is_customer')
    list_filter = ('is_customer',)
    search_fields = ('name',)


@admin.register(ModulePermission)
class ModulePermissionAdmin(admin.ModelAdmin):
    list_display = ('module', 'group', 'role', 'granted')
    list_filter = ('group', 'role', 'granted')
    search_fields = ('module',)
    ordering = ('group', 'module', 'role')


@admin.register(StaffInvite)
class StaffInviteAdmin(admin.ModelAdmin):
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