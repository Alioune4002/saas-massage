from django.contrib import admin

from .models import Review, ReviewInvitation, ReviewModerationLog


@admin.register(ReviewInvitation)
class ReviewInvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "professional", "source", "sent_at", "expires_at", "used_at", "usage_count")
    list_filter = ("source", "used_at", "sent_at")
    search_fields = ("email", "first_name", "last_name", "professional__business_name")
    readonly_fields = ("token_hash", "usage_count")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("author_name", "professional", "rating", "status", "source", "verification_type", "published_at", "flagged_at")
    list_filter = ("status", "source", "verification_type", "rating")
    search_fields = ("author_name", "comment", "professional__business_name", "invited_customer_email")
    readonly_fields = (
        "experience_date",
        "moderation_flags",
        "submitted_from_ip_hash",
        "submitted_from_user_agent_hash",
        "practitioner_responded_at",
    )

    def save_model(self, request, obj, form, change):
        previous_status = None
        if change:
            previous_status = Review.objects.filter(pk=obj.pk).values_list("status", flat=True).first()

        super().save_model(request, obj, form, change)

        if previous_status != obj.status:
            action_map = {
                Review.Status.APPROVED: ReviewModerationLog.Action.APPROVED,
                Review.Status.REJECTED: ReviewModerationLog.Action.REJECTED,
                Review.Status.HIDDEN: ReviewModerationLog.Action.HIDDEN,
                Review.Status.PENDING: ReviewModerationLog.Action.FLAGGED,
            }
            ReviewModerationLog.objects.create(
                review=obj,
                action=action_map.get(obj.status, ReviewModerationLog.Action.APPROVED),
                operator=request.user,
                reason=obj.flag_reason,
                metadata={"from_status": previous_status or "", "to_status": obj.status},
            )


@admin.register(ReviewModerationLog)
class ReviewModerationLogAdmin(admin.ModelAdmin):
    list_display = ("review", "action", "operator", "reason", "created_at")
    list_filter = ("action",)
    search_fields = (
        "review__author_name",
        "review__professional__business_name",
        "reason",
        "operator__email",
    )
    readonly_fields = ("metadata", "created_at", "updated_at")
