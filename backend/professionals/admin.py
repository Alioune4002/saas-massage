from django.contrib import admin

from .models import (
    PractitionerVerification,
    PractitionerVerificationDecision,
    ProfessionalPaymentAccount,
    ProfessionalProfile,
)


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


class PractitionerVerificationDecisionInline(admin.TabularInline):
    model = PractitionerVerificationDecision
    extra = 0
    readonly_fields = ("from_status", "to_status", "reason", "decided_by", "created_at")
    can_delete = False


@admin.register(PractitionerVerification)
class PractitionerVerificationAdmin(admin.ModelAdmin):
    list_display = (
        "professional",
        "status",
        "siren",
        "siret",
        "verified_at",
        "expires_at",
    )
    list_filter = ("status",)
    search_fields = (
        "professional__business_name",
        "professional__user__email",
        "siren",
        "siret",
        "beneficiary_name",
    )
    readonly_fields = ("submitted_at", "reviewed_at", "verified_at", "created_at", "updated_at")
    inlines = [PractitionerVerificationDecisionInline]

    def save_model(self, request, obj, form, change):
        previous_status = None
        if change:
            previous_status = (
                PractitionerVerification.objects.filter(pk=obj.pk)
                .values_list("status", flat=True)
                .first()
            )

        if obj.status == PractitionerVerification.Status.IN_REVIEW and not obj.reviewed_at:
            from django.utils import timezone

            obj.reviewed_at = timezone.now()
        if obj.status == PractitionerVerification.Status.VERIFIED and not obj.verified_at:
            from django.utils import timezone

            obj.verified_at = timezone.now()

        super().save_model(request, obj, form, change)

        if previous_status != obj.status:
            PractitionerVerificationDecision.objects.create(
                verification=obj,
                decided_by=request.user,
                from_status=previous_status or "",
                to_status=obj.status,
                reason=obj.rejection_reason or "",
            )
