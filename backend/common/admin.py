from django.contrib import admin

from .models import (
    AdminAnnouncement,
    CookieConsentRecord,
    LegalAcceptanceRecord,
    PlatformMessage,
)


@admin.register(LegalAcceptanceRecord)
class LegalAcceptanceRecordAdmin(admin.ModelAdmin):
    list_display = (
        "document_slug",
        "document_version",
        "email_snapshot",
        "source",
        "accepted_at",
    )
    list_filter = ("document_slug", "document_version", "source")
    search_fields = ("email_snapshot", "user__email", "document_slug")
    readonly_fields = (
        "accepted_at",
        "ip_hash",
        "user_agent_hash",
        "metadata",
        "created_at",
        "updated_at",
    )


@admin.register(CookieConsentRecord)
class CookieConsentRecordAdmin(admin.ModelAdmin):
    list_display = (
        "consent_version",
        "user",
        "session_key",
        "analytics",
        "advertising",
        "support",
        "accepted_at",
        "revoked_at",
    )
    list_filter = (
        "consent_version",
        "analytics",
        "advertising",
        "support",
        "source",
    )
    search_fields = ("user__email", "session_key")
    readonly_fields = (
        "accepted_at",
        "revoked_at",
        "ip_hash",
        "user_agent_hash",
        "evidence",
        "created_at",
        "updated_at",
    )


@admin.register(PlatformMessage)
class PlatformMessageAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "recipient_user",
        "category",
        "display_mode",
        "is_read",
        "is_active",
        "sent_at",
    )
    list_filter = ("category", "display_mode", "is_read", "is_active")
    search_fields = ("title", "body", "recipient_user__email", "created_by__email")
    readonly_fields = ("sent_at", "read_at", "metadata", "created_at", "updated_at")


@admin.register(AdminAnnouncement)
class AdminAnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "audience_role", "display_mode", "is_active", "starts_at", "ends_at")
    list_filter = ("audience_role", "display_mode", "is_active")
    search_fields = ("title", "body", "created_by__email")
    readonly_fields = ("metadata", "created_at", "updated_at")
