from django.contrib import admin

from .models import Address, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "role", "hotel", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("email", "name")


admin.site.register(Address)
