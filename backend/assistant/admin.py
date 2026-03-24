from django.contrib import admin

from .models import ProfessionalAssistantProfile


@admin.register(ProfessionalAssistantProfile)
class ProfessionalAssistantProfileAdmin(admin.ModelAdmin):
    list_display = (
        "professional",
        "assistant_enabled",
        "response_tone",
        "public_assistant_enabled",
        "updated_at",
    )
    search_fields = ("professional__business_name", "professional__slug")
    list_filter = ("assistant_enabled", "response_tone", "public_assistant_enabled")
