from django.contrib import admin

from .models import Hotel


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "place", "is_verified", "is_online", "has_delivery", "rating")
    list_filter = ("is_verified", "is_online", "has_delivery")
    search_fields = ("name", "place")
