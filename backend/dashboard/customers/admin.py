from django.contrib import admin
from .models import CommunicationLog, CustomerNote, CustomerProfile, SupportTicket


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'segment', 'orders_count', 'total_spent', 'last_order_date')
    list_filter = ('segment',)
    search_fields = ('user__email', 'user__first_name', 'user__last_name')


@admin.register(CustomerNote)
class CustomerNoteAdmin(admin.ModelAdmin):
    list_display = ('user', 'author', 'created_at')
    search_fields = ('user__email', 'text')


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ('user', 'subject', 'status', 'priority', 'opened_at')
    list_filter = ('status', 'priority')


@admin.register(CommunicationLog)
class CommunicationLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'channel', 'direction', 'subject', 'created_at')
    list_filter = ('channel', 'direction')