from django.contrib import admin

from .models import MassageService


@admin.register(MassageService)
class MassageServiceAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "professional",
        "duration_minutes",
        "price_eur",
        "is_active",
        "sort_order",
    )
    list_filter = ("is_active", "professional")
    search_fields = ("title", "short_description", "professional__business_name")
    ordering = ("professional", "sort_order", "duration_minutes")