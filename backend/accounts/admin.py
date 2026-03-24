from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "username", "role", "is_active", "is_staff", "date_joined")
    list_filter = ("role", "is_active", "is_staff", "is_superuser")
    ordering = ("-date_joined",)
    search_fields = ("email", "username", "first_name", "last_name")

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Métier", {"fields": ("role",)}),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Métier", {"fields": ("email", "role")}),
    )