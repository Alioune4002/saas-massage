from django.contrib import admin

from .models import Review, ReviewInvitation


@admin.register(ReviewInvitation)
class ReviewInvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "professional", "source", "sent_at", "expires_at", "used_at", "usage_count")
    list_filter = ("source", "used_at", "sent_at")
    search_fields = ("email", "first_name", "last_name", "professional__business_name")
    readonly_fields = ("token_hash", "usage_count")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("author_name", "professional", "rating", "status", "verification_type", "published_at", "flagged_at")
    list_filter = ("status", "verification_type", "rating")
    search_fields = ("author_name", "comment", "professional__business_name", "invited_customer_email")
    readonly_fields = ("moderation_flags", "submitted_from_ip_hash", "submitted_from_user_agent_hash")
