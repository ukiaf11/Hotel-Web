from django.contrib import admin

from .models import FoodItem, MenuCategory

admin.site.register(MenuCategory)


@admin.register(FoodItem)
class FoodItemAdmin(admin.ModelAdmin):
    list_display = ("name", "hotel", "category", "price", "is_available", "is_custom_order")
    list_filter = ("category", "is_available", "is_custom_order")
    search_fields = ("name",)
