from django.utils import timezone
from django.db import transaction
from rest_framework import serializers

from professionals.models import ProfessionalProfile
from services.models import MassageService
from .models import AvailabilitySlot, Booking, BookingPayment, TrustedClient
from .payments import (
    create_checkout_for_booking,
    calculate_booking_payment_terms,
    evaluate_post_service_release,
    get_trusted_client_for_booking,
    get_public_payment_summary,
    mark_booking_payment_pending,
    record_booking_payment_request,
)


class PublicAvailabilitySerializer(serializers.ModelSerializer):
    service_title = serializers.CharField(source="service.title", read_only=True)

    class Meta:
        model = AvailabilitySlot
        fields = (
            "id",
            "start_at",
            "end_at",
            "service",
            "service_title",
        )


class PublicBookingCreateSerializer(serializers.Serializer):
    professional_slug = serializers.SlugField()
    service_id = serializers.UUIDField()
    slot_id = serializers.UUIDField()
    client_first_name = serializers.CharField(max_length=120)
    client_last_name = serializers.CharField(max_length=120)
    client_email = serializers.EmailField()
    client_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    client_note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        professional_slug = attrs["professional_slug"]
        service_id = attrs["service_id"]
        slot_id = attrs["slot_id"]

        try:
            professional = ProfessionalProfile.objects.get(
                slug=professional_slug,
                is_public=True,
                accepts_online_booking=True,
            )
        except ProfessionalProfile.DoesNotExist:
            raise serializers.ValidationError("Professionnel introuvable.")

        try:
            service = MassageService.objects.get(
                id=service_id,
                professional=professional,
                is_active=True,
            )
        except MassageService.DoesNotExist:
            raise serializers.ValidationError("Service introuvable.")

        try:
            slot = AvailabilitySlot.objects.select_related("professional", "service").get(
                id=slot_id,
                professional=professional,
                is_active=True,
                slot_type=AvailabilitySlot.SlotType.OPEN,
            )
        except AvailabilitySlot.DoesNotExist:
            raise serializers.ValidationError("Créneau introuvable.")

        if slot.start_at <= timezone.now():
            raise serializers.ValidationError("Ce créneau n'est plus réservable.")

        if slot.bookings.filter(
            status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED)
        ).exists():
            raise serializers.ValidationError("Ce créneau est déjà réservé.")

        if slot.service_id and slot.service_id != service.id:
            raise serializers.ValidationError("Ce créneau ne correspond pas à ce service.")

        trusted_client = get_trusted_client_for_booking(
            professional=professional,
            client_email=attrs["client_email"],
        )

        payment_terms = get_public_payment_summary(
            professional=professional,
            total_price=service.price_eur,
            trusted_client=trusted_client,
        )

        attrs["professional"] = professional
        attrs["service"] = service
        attrs["slot"] = slot
        attrs["payment_terms"] = payment_terms
        attrs["trusted_client"] = trusted_client
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        slot = AvailabilitySlot.objects.select_for_update().get(id=validated_data["slot"].id)

        if slot.bookings.select_for_update().filter(
            status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED)
        ).exists():
            raise serializers.ValidationError("Ce créneau vient d'être réservé.")

        booking = Booking.objects.create(
            professional=validated_data["professional"],
            service=validated_data["service"],
            slot=slot,
            client_first_name=validated_data["client_first_name"],
            client_last_name=validated_data["client_last_name"],
            client_email=validated_data["client_email"],
            client_phone=validated_data.get("client_phone", ""),
            client_note=validated_data.get("client_note", ""),
            status=Booking.Status.PENDING,
            **calculate_booking_payment_terms(
                professional=validated_data["professional"],
                total_price=validated_data["service"].price_eur,
                trusted_client=validated_data.get("trusted_client"),
            ),
        )
        payment_request = record_booking_payment_request(booking)
        self.context["payment_request"] = payment_request
        return booking


class PublicBookingCreatedSerializer(serializers.ModelSerializer):
    service_title = serializers.CharField(source="service.title", read_only=True)
    professional_name = serializers.CharField(source="professional.business_name", read_only=True)
    start_at = serializers.DateTimeField(source="slot.start_at", read_only=True)
    end_at = serializers.DateTimeField(source="slot.end_at", read_only=True)
    cancellation_policy_summary = serializers.SerializerMethodField()
    payment_requires_action = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "status",
            "payment_status",
            "payment_mode",
            "service_title",
            "professional_name",
            "start_at",
            "end_at",
            "total_price_eur",
            "amount_due_now_eur",
            "amount_received_eur",
            "amount_remaining_eur",
            "payment_message",
            "cancellation_policy_summary",
            "payment_requires_action",
            "client_first_name",
            "client_last_name",
            "client_email",
        )

    def get_cancellation_policy_summary(self, obj):
        return get_public_payment_summary(
            professional=obj.professional,
            total_price=obj.total_price_eur,
        )["cancellation_summary"]

    def get_payment_requires_action(self, obj):
        return obj.payment_status in {
            Booking.PaymentStatus.PAYMENT_REQUIRED,
            Booking.PaymentStatus.DEPOSIT_REQUIRED,
            Booking.PaymentStatus.PAYMENT_PENDING,
            Booking.PaymentStatus.PAYMENT_AUTHORIZED,
        }


class ProfessionalAvailabilitySerializer(serializers.ModelSerializer):
    service_title = serializers.CharField(source="service.title", read_only=True)
    booking_status = serializers.SerializerMethodField()
    booking_client_name = serializers.SerializerMethodField()
    agenda_state = serializers.SerializerMethodField()

    class Meta:
        model = AvailabilitySlot
        fields = (
            "id",
            "service",
            "service_title",
            "start_at",
            "end_at",
            "slot_type",
            "label",
            "is_active",
            "booking_status",
            "booking_client_name",
            "agenda_state",
        )
        read_only_fields = ("service_title", "booking_status", "booking_client_name", "agenda_state")

    def create(self, validated_data):
        validated_data["professional"] = self.context["professional"]
        return super().create(validated_data)

    def validate(self, attrs):
        professional = self.context["professional"]
        service = attrs.get("service")

        if service and service.professional_id != professional.id:
            raise serializers.ValidationError("Service invalide pour ce professionnel.")

        slot_type = attrs.get("slot_type", getattr(self.instance, "slot_type", AvailabilitySlot.SlotType.OPEN))
        if slot_type == AvailabilitySlot.SlotType.BLOCKED and service:
            raise serializers.ValidationError("Une plage bloquée ne peut pas être liée à une prestation.")

        if self.instance:
            active_booking_exists = self.instance.bookings.filter(
                status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED)
            ).exists()
            immutable_fields = ("start_at", "end_at", "service", "slot_type")
            changes_touch_reserved_time = any(field in attrs for field in immutable_fields)

            if active_booking_exists and (changes_touch_reserved_time or attrs.get("is_active") is False):
                raise serializers.ValidationError(
                    "Ce créneau comporte déjà un rendez-vous. Annulez d'abord la réservation pour le modifier."
                )

        return attrs

    def get_booking_status(self, obj):
        booking = self._get_active_booking(obj)
        return booking.status if booking else ""

    def get_booking_client_name(self, obj):
        booking = self._get_active_booking(obj)
        if not booking:
            return ""
        return f"{booking.client_first_name} {booking.client_last_name}".strip()

    def get_agenda_state(self, obj):
        if not obj.is_active:
            return "inactive"
        if obj.slot_type == AvailabilitySlot.SlotType.BLOCKED:
            return "blocked"
        booking = self._get_active_booking(obj)
        if not booking:
            return "free"
        return booking.status

    def _get_active_booking(self, obj):
        if hasattr(obj, "_prefetched_active_booking"):
            return obj._prefetched_active_booking
        booking = obj.bookings.filter(
            status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED)
        ).order_by("-created_at").first()
        obj._prefetched_active_booking = booking
        return booking


class ProfessionalBookingSerializer(serializers.ModelSerializer):
    service_title = serializers.CharField(source="service.title", read_only=True)
    start_at = serializers.DateTimeField(source="slot.start_at", read_only=True)
    end_at = serializers.DateTimeField(source="slot.end_at", read_only=True)
    payment_summary = serializers.SerializerMethodField()
    payout_summary = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "status",
            "payment_status",
            "payment_mode",
            "payment_collection_method",
            "payment_channel",
            "payout_status",
            "fulfillment_status",
            "service",
            "service_title",
            "slot",
            "start_at",
            "end_at",
            "client_first_name",
            "client_last_name",
            "client_email",
            "client_phone",
            "client_note",
            "total_price_eur",
            "amount_due_now_eur",
            "amount_received_eur",
            "amount_remaining_eur",
            "amount_refunded_eur",
            "platform_fee_eur",
            "payout_amount_eur",
            "payment_message",
            "payment_due_expires_at",
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
            "issue_opened_by_role",
            "issue_reason",
            "client_no_show_at",
            "practitioner_no_show_at",
            "canceled_by_role",
            "cancellation_reason",
            "refund_decision_source",
            "trust_exemption_applied",
            "provider_checkout_session_id",
            "created_at",
            "payment_summary",
            "payout_summary",
            "timeline",
        )
        read_only_fields = (
            "service_title",
            "start_at",
            "end_at",
            "client_first_name",
            "client_last_name",
            "client_email",
            "client_phone",
            "client_note",
            "created_at",
            "payment_summary",
            "payout_summary",
            "timeline",
        )

    def get_payment_summary(self, obj):
        if obj.payment_status == Booking.PaymentStatus.NONE_REQUIRED:
            return "Aucun paiement demandé · règlement sur place"
        if obj.payment_status == Booking.PaymentStatus.DEPOSIT_REQUIRED:
            return f"Acompte demandé · {obj.amount_due_now_eur} € à sécuriser"
        if obj.payment_status == Booking.PaymentStatus.PAYMENT_REQUIRED:
            return f"Règlement demandé · {obj.amount_due_now_eur} € à sécuriser"
        if obj.payment_status == Booking.PaymentStatus.PAYMENT_PENDING:
            return "Paiement en attente de confirmation par le prestataire de paiement"
        if obj.payment_status == Booking.PaymentStatus.PAYMENT_AUTHORIZED:
            return "Autorisation enregistrée · capture en cours de confirmation"
        if obj.payment_status == Booking.PaymentStatus.PAYMENT_CAPTURED:
            if obj.amount_remaining_eur > 0:
                return f"{obj.amount_received_eur} € sécurisés · {obj.amount_remaining_eur} € restants"
            return f"{obj.amount_received_eur} € sécurisés · rien à régler sur place"
        if obj.payment_status == Booking.PaymentStatus.PARTIALLY_REFUNDED:
            return f"{obj.amount_refunded_eur} € remboursés · {obj.amount_received_eur} € conservés"
        if obj.payment_status == Booking.PaymentStatus.REFUNDED:
            return f"{obj.amount_refunded_eur} € remboursés"
        if obj.payment_status == Booking.PaymentStatus.CANCELED:
            return "Aucun règlement conservé"
        return "Règlement en attente"

    def get_payout_summary(self, obj):
        if obj.payout_status == Booking.PayoutStatus.NOT_APPLICABLE:
            return "Aucun versement plateforme à prévoir"
        if obj.payout_status == Booking.PayoutStatus.PAYOUT_PENDING:
            return "Versement en attente de validation de prestation"
        if obj.payout_status == Booking.PayoutStatus.PAYOUT_READY:
            return "Versement prêt à être envoyé"
        if obj.payout_status == Booking.PayoutStatus.PAYOUT_RELEASED:
            return f"Versement envoyé · {obj.payout_amount_eur} €"
        return obj.payout_blocked_reason or "Versement temporairement bloqué"

    def get_timeline(self, obj):
        events = obj.event_logs.order_by("-created_at")[:6]
        return [
            {
                "id": str(event.id),
                "created_at": event.created_at,
                "event_type": event.event_type,
                "message": event.message,
                "actor_role": event.actor_role,
            }
            for event in events
        ]


class AgendaBookingSummarySerializer(serializers.ModelSerializer):
    service_title = serializers.CharField(source="service.title", read_only=True)
    start_at = serializers.DateTimeField(source="slot.start_at", read_only=True)
    end_at = serializers.DateTimeField(source="slot.end_at", read_only=True)
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "status",
            "service_title",
            "start_at",
            "end_at",
            "client_name",
        )

    def get_client_name(self, obj):
        return f"{obj.client_first_name} {obj.client_last_name}".strip()


class AgendaTimelineItemSerializer(serializers.ModelSerializer):
    service_title = serializers.CharField(source="service.title", read_only=True)
    agenda_state = serializers.SerializerMethodField()
    booking = serializers.SerializerMethodField()

    class Meta:
        model = AvailabilitySlot
        fields = (
            "id",
            "start_at",
            "end_at",
            "slot_type",
            "label",
            "service",
            "service_title",
            "agenda_state",
            "booking",
        )

    def get_agenda_state(self, obj):
        if not obj.is_active:
            return "inactive"
        if obj.slot_type == AvailabilitySlot.SlotType.BLOCKED:
            return "blocked"
        booking = self._get_active_booking(obj)
        if booking:
            return booking.status
        return "free"

    def get_booking(self, obj):
        booking = self._get_active_booking(obj)
        if not booking:
            return None
        return AgendaBookingSummarySerializer(booking).data

    def _get_active_booking(self, obj):
        if hasattr(obj, "_prefetched_active_booking"):
            return obj._prefetched_active_booking

        booking = obj.bookings.filter(
            status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED)
        ).order_by("-created_at").first()
        obj._prefetched_active_booking = booking
        return booking


class ProfessionalAgendaSerializer(serializers.Serializer):
    date = serializers.DateField()
    overview = serializers.DictField()
    timeline = AgendaTimelineItemSerializer(many=True)
    upcoming_bookings = AgendaBookingSummarySerializer(many=True)
    recent_cancellations = AgendaBookingSummarySerializer(many=True)


class TrustedClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrustedClient
        fields = (
            "id",
            "first_name",
            "last_name",
            "email",
            "waive_deposit",
            "allow_pay_on_site",
            "notes",
            "is_active",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def create(self, validated_data):
        return TrustedClient.objects.create(
            professional=self.context["professional"],
            **validated_data,
        )


class ManualPaymentSerializer(serializers.Serializer):
    payment_channel = serializers.ChoiceField(choices=Booking.PaymentChannel.choices)


class BookingLifecycleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = (
            "id",
            "status",
            "payment_status",
            "payout_status",
            "fulfillment_status",
            "client_arrived_at",
            "service_started_at",
            "service_completed_at",
            "client_validated_at",
            "auto_completed_at",
            "issue_opened_at",
            "issue_opened_by_role",
            "issue_reason",
            "client_no_show_at",
            "practitioner_no_show_at",
            "payment_captured_at",
            "payout_ready_at",
            "payout_released_at",
        )


class BookingPaymentMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingPayment
        fields = (
            "id",
            "kind",
            "status",
            "provider",
            "amount_eur",
            "currency",
            "created_at",
        )


class PaymentOverviewSerializer(serializers.Serializer):
    collected_platform_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    collected_off_platform_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    deposits_captured_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    remaining_to_collect_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    refunded_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    payouts_pending_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    payouts_released_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    by_channel = serializers.ListField()
    recent_movements = BookingPaymentMovementSerializer(many=True)
