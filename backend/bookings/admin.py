from django.contrib import admin

from .models import (
    AvailabilitySlot,
    Booking,
    BookingEventLog,
    BookingPayment,
    PaymentWebhookEventLog,
    TrustedClient,
)


@admin.register(AvailabilitySlot)
class AvailabilitySlotAdmin(admin.ModelAdmin):
    list_display = ("professional", "service", "start_at", "end_at", "is_active")
    list_filter = ("is_active", "professional")
    search_fields = ("professional__business_name", "service__title")
    ordering = ("start_at",)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "client_first_name",
        "client_last_name",
        "professional",
        "service",
        "status",
        "payment_status",
        "payout_status",
        "fulfillment_status",
        "created_at",
    )
    list_filter = ("status", "payment_status", "payout_status", "fulfillment_status", "professional")
    search_fields = (
        "client_first_name",
        "client_last_name",
        "client_email",
        "service__title",
        "professional__business_name",
        "provider_payment_intent_id",
        "provider_charge_id",
        "provider_transfer_id",
    )
    ordering = ("-created_at",)
    readonly_fields = (
        "provider_payment_intent_id",
        "provider_checkout_session_id",
        "provider_charge_id",
        "provider_transfer_id",
        "provider_refund_id",
        "provider_payout_id",
        "payment_authorized_at",
        "payment_captured_at",
        "payout_ready_at",
        "payout_released_at",
        "service_validation_requested_at",
        "client_arrived_at",
        "service_started_at",
        "service_completed_at",
        "client_validated_at",
        "auto_completed_at",
        "issue_opened_at",
        "client_no_show_at",
        "practitioner_no_show_at",
    )


@admin.register(BookingPayment)
class BookingPaymentAdmin(admin.ModelAdmin):
    list_display = ("booking", "kind", "status", "provider", "amount_eur", "created_at")
    list_filter = ("kind", "status", "provider")
    search_fields = ("booking__client_email", "provider_payment_intent_id", "provider_checkout_session_id", "provider_charge_id", "provider_transfer_id", "provider_refund_id")
    ordering = ("-created_at",)
    readonly_fields = ("raw_provider_payload",)


@admin.register(TrustedClient)
class TrustedClientAdmin(admin.ModelAdmin):
    list_display = ("email", "professional", "waive_deposit", "allow_pay_on_site", "is_active")
    list_filter = ("waive_deposit", "allow_pay_on_site", "is_active")
    search_fields = ("email", "first_name", "last_name", "professional__business_name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(BookingEventLog)
class BookingEventLogAdmin(admin.ModelAdmin):
    list_display = ("booking", "event_type", "actor_role", "created_at")
    list_filter = ("actor_role", "event_type")
    search_fields = ("booking__client_email", "message", "event_type")
    ordering = ("-created_at",)
    readonly_fields = ("metadata",)


@admin.register(PaymentWebhookEventLog)
class PaymentWebhookEventLogAdmin(admin.ModelAdmin):
    list_display = ("provider_event_id", "provider", "event_type", "processing_status", "processed_at")
    list_filter = ("provider", "processing_status")
    search_fields = ("provider_event_id", "event_type", "booking__client_email")
    ordering = ("-created_at",)
    readonly_fields = ("payload",)
