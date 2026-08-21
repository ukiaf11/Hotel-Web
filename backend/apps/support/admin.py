from django.contrib import admin

from .models import FAQ, SupportTicket, TicketMessage

admin.site.register(FAQ)
admin.site.register(TicketMessage)


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "user", "status", "updated_at")
    list_filter = ("status",)
