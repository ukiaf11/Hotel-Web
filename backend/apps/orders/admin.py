from django.contrib import admin

from .models import Order, OrderItem, Review


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "hotel", "buyer", "status", "delivery_type", "scheduled_date", "total_amount")
    list_filter = ("status", "delivery_type")
    inlines = [OrderItemInline]


admin.site.register(Review)
