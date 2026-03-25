from django.contrib import admin

from .models import (
    AuditLog,
    ContactCampaign,
    ContactMessageLog,
    ImportedProfile,
    PractitionerClaim,
    RemovalRequest,
    SourceImportJob,
    SourceRegistry,
)


@admin.register(SourceRegistry)
class SourceRegistryAdmin(admin.ModelAdmin):
    list_display = ("name", "source_type", "legal_status", "is_active", "default_visibility_mode", "requires_manual_review_before_publish")
    list_filter = ("source_type", "legal_status", "is_active", "default_visibility_mode")
    search_fields = ("name", "base_url")


@admin.register(SourceImportJob)
class SourceImportJobAdmin(admin.ModelAdmin):
    list_display = ("source", "trigger_type", "status", "total_seen", "total_created", "total_updated", "total_skipped", "created_at")
    list_filter = ("status", "trigger_type", "source")
    search_fields = ("source__name",)


@admin.register(ImportedProfile)
class ImportedProfileAdmin(admin.ModelAdmin):
    list_display = ("public_name", "city", "source", "import_status", "claimable", "is_public", "confidence_score")
    list_filter = ("import_status", "claimable", "is_public", "source")
    search_fields = ("public_name", "business_name", "city", "external_id", "slug")


@admin.register(PractitionerClaim)
class PractitionerClaimAdmin(admin.ModelAdmin):
    list_display = ("imported_profile", "email", "status", "verification_method", "sent_at", "expires_at")
    list_filter = ("status", "verification_method")
    search_fields = ("email", "imported_profile__public_name", "token")


@admin.register(RemovalRequest)
class RemovalRequestAdmin(admin.ModelAdmin):
    list_display = ("requester_email", "imported_profile", "status", "created_at", "resolved_at")
    list_filter = ("status",)
    search_fields = ("requester_email", "requester_name", "imported_profile__public_name")


@admin.register(ContactCampaign)
class ContactCampaignAdmin(admin.ModelAdmin):
    list_display = ("name", "campaign_type", "status", "total_targets", "total_sent", "total_failed", "created_at")
    list_filter = ("campaign_type", "status")
    search_fields = ("name", "email_template_key")


@admin.register(ContactMessageLog)
class ContactMessageLogAdmin(admin.ModelAdmin):
    list_display = ("to_email", "template_key", "status", "sent_at", "created_at")
    list_filter = ("template_key", "status")
    search_fields = ("to_email", "provider_message_id")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "object_type", "object_id", "actor", "created_at")
    list_filter = ("action", "object_type")
    search_fields = ("action", "object_type", "object_id", "actor__email")
