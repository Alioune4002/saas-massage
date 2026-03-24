from django.contrib import admin

from .models import ProfessionalPaymentAccount, ProfessionalProfile


@admin.register(ProfessionalProfile)
class ProfessionalProfileAdmin(admin.ModelAdmin):
    list_display = ("business_name", "slug", "city", "is_public", "accepts_online_booking")
    list_filter = ("is_public", "accepts_online_booking", "city")
    search_fields = ("business_name", "slug", "city", "user__email", "user__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ProfessionalPaymentAccount)
class ProfessionalPaymentAccountAdmin(admin.ModelAdmin):
    list_display = (
        "professional",
        "provider",
        "onboarding_status",
        "charges_enabled",
        "payouts_enabled",
    )
    list_filter = ("provider", "onboarding_status", "charges_enabled", "payouts_enabled")
    search_fields = (
        "professional__business_name",
        "professional__user__email",
        "stripe_account_id",
    )
    readonly_fields = ("last_onboarding_link_requested_at",)
