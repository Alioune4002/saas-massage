import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.db import transaction
from rest_framework import serializers

from professionals.models import ProfessionalProfile
from services.models import MassageService
from .models import (
    AvailabilitySlot,
    Booking,
    BookingEmailVerification,
    BookingMessage,
    BookingPayment,
    BookingThread,
    GuestBookingIdentity,
    IncidentReport,
    TrustedClient,
)
from .payments import (
    create_checkout_for_booking,
    calculate_booking_payment_terms,
    evaluate_post_service_release,
    generate_client_action_token,
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


class PublicBookingIntentSerializer(serializers.Serializer):
    professional_slug = serializers.SlugField()
    service_id = serializers.UUIDField()
    slot_id = serializers.UUIDField()
    client_first_name = serializers.CharField(max_length=120)
    client_last_name = serializers.CharField(max_length=120)
    client_email = serializers.EmailField()
    client_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    client_note = serializers.CharField(required=False, allow_blank=True)
    accept_cgu = serializers.BooleanField()
    accept_cgv = serializers.BooleanField()
    accept_cancellation_policy = serializers.BooleanField()

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

        if not attrs["accept_cgu"] or not attrs["accept_cgv"] or not attrs["accept_cancellation_policy"]:
            raise serializers.ValidationError(
                "Vous devez accepter les CGU, les CGV et la politique d’annulation pour continuer."
            )

        attrs["professional"] = professional
        attrs["service"] = service
        attrs["slot"] = slot
        attrs["payment_terms"] = payment_terms
        attrs["trusted_client"] = trusted_client
        return attrs

    def create(self, validated_data):
        return GuestBookingIdentity.objects.create(
            professional=validated_data["professional"],
            service=validated_data["service"],
            slot=validated_data["slot"],
            client_first_name=validated_data["client_first_name"],
            client_last_name=validated_data["client_last_name"],
            client_email=validated_data["client_email"],
            client_phone=validated_data.get("client_phone", ""),
            client_note=validated_data.get("client_note", ""),
            consent_cgu=validated_data["accept_cgu"],
            consent_cgv=validated_data["accept_cgv"],
            consent_cancellation_policy=validated_data["accept_cancellation_policy"],
            consented_at=timezone.now(),
            consent_version=self.context.get("consent_version", "2026-03-26"),
            consent_snapshot_json={
                "accept_cgu": validated_data["accept_cgu"],
                "accept_cgv": validated_data["accept_cgv"],
                "accept_cancellation_policy": validated_data["accept_cancellation_policy"],
            },
        )


class PublicBookingEmailVerificationSerializer(serializers.Serializer):
    guest_identity_id = serializers.UUIDField()
    code = serializers.CharField(max_length=12)

    def validate(self, attrs):
        try:
            guest_identity = GuestBookingIdentity.objects.select_related(
                "professional",
                "service",
                "slot",
            ).get(id=attrs["guest_identity_id"])
        except GuestBookingIdentity.DoesNotExist as exc:
            raise serializers.ValidationError("Demande de réservation introuvable.") from exc

        verification_window_minutes = int(
            getattr(settings, "NUADYX_GUEST_BOOKING_HOLD_MINUTES", 30)
        )
        if guest_identity.created_at <= timezone.now() - timedelta(minutes=verification_window_minutes):
            guest_identity.verification_status = GuestBookingIdentity.VerificationStatus.EXPIRED
            guest_identity.save(update_fields=["verification_status", "updated_at"])
            raise serializers.ValidationError("Cette demande a expiré. Recommencez votre réservation.")

        verification = guest_identity.email_verifications.order_by("-created_at").first()
        if not verification:
            raise serializers.ValidationError("Aucune vérification en attente pour cette réservation.")
        if verification.status in {
            BookingEmailVerification.Status.EXPIRED,
            BookingEmailVerification.Status.BLOCKED,
        }:
            raise serializers.ValidationError("Le code n’est plus valide. Demandez-en un nouveau.")
        if verification.expires_at <= timezone.now():
            verification.status = BookingEmailVerification.Status.EXPIRED
            verification.save(update_fields=["status", "updated_at"])
            guest_identity.verification_status = GuestBookingIdentity.VerificationStatus.EXPIRED
            guest_identity.save(update_fields=["verification_status", "updated_at"])
            raise serializers.ValidationError("Le code a expiré. Demandez-en un nouveau.")

        normalized_code = attrs["code"].strip()
        expected_hash = hashlib.sha256(normalized_code.encode()).hexdigest()
        if expected_hash != verification.code_hash:
            verification.attempts_count += 1
            if verification.attempts_count >= verification.max_attempts:
                verification.status = BookingEmailVerification.Status.BLOCKED
                guest_identity.verification_status = GuestBookingIdentity.VerificationStatus.BLOCKED
                guest_identity.save(update_fields=["verification_status", "updated_at"])
            verification.save(update_fields=["attempts_count", "status", "updated_at"])
            raise serializers.ValidationError("Le code saisi est incorrect.")

        attrs["guest_identity"] = guest_identity
        attrs["verification"] = verification
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        guest_identity: GuestBookingIdentity = validated_data["guest_identity"]
        verification: BookingEmailVerification = validated_data["verification"]

        if guest_identity.booking_id:
            return guest_identity.booking

        slot = AvailabilitySlot.objects.select_for_update().get(id=guest_identity.slot_id)
        if slot.bookings.select_for_update().filter(
            status__in=(Booking.Status.PENDING, Booking.Status.CONFIRMED)
        ).exists():
            raise serializers.ValidationError("Ce créneau n’est plus disponible.")

        trusted_client = get_trusted_client_for_booking(
            professional=guest_identity.professional,
            client_email=guest_identity.client_email,
        )
        booking = Booking.objects.create(
            professional=guest_identity.professional,
            service=guest_identity.service,
            slot=slot,
            client_first_name=guest_identity.client_first_name,
            client_last_name=guest_identity.client_last_name,
            client_email=guest_identity.client_email,
            client_phone=guest_identity.client_phone,
            client_note=guest_identity.client_note,
            guest_identity=guest_identity,
            status=Booking.Status.PENDING,
            **calculate_booking_payment_terms(
                professional=guest_identity.professional,
                total_price=guest_identity.service.price_eur,
                trusted_client=trusted_client,
            ),
        )
        BookingThread.objects.create(booking=booking)
        payment_request = record_booking_payment_request(booking)
        verification.status = BookingEmailVerification.Status.VERIFIED
        verification.verified_at = timezone.now()
        verification.save(update_fields=["status", "verified_at", "updated_at"])
        guest_identity.booking = booking
        guest_identity.verification_status = GuestBookingIdentity.VerificationStatus.COMPLETED
        guest_identity.email_verified_at = timezone.now()
        guest_identity.save(
            update_fields=[
                "booking",
                "verification_status",
                "email_verified_at",
                "updated_at",
            ]
        )
        self.context["payment_request"] = payment_request
        return booking


class PublicBookingVerificationStatusSerializer(serializers.ModelSerializer):
    masked_email = serializers.SerializerMethodField()
    expires_at = serializers.SerializerMethodField()

    class Meta:
        model = GuestBookingIdentity
        fields = (
            "id",
            "verification_status",
            "masked_email",
            "expires_at",
            "verification_resend_count",
        )

    def get_masked_email(self, obj):
        email = obj.client_email
        local, _, domain = email.partition("@")
        if len(local) <= 2:
            local = f"{local[:1]}***"
        else:
            local = f"{local[:2]}***"
        return f"{local}@{domain}"

    def get_expires_at(self, obj):
        verification = obj.email_verifications.order_by("-created_at").first()
        return verification.expires_at if verification else None


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


class BookingMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingMessage
        fields = (
            "id",
            "sender_role",
            "guest_email",
            "body",
            "contains_external_link",
            "is_flagged",
            "created_at",
        )
        read_only_fields = (
            "id",
            "sender_role",
            "guest_email",
            "contains_external_link",
            "is_flagged",
            "created_at",
        )


class IncidentReportSerializer(serializers.ModelSerializer):
    evidences_count = serializers.SerializerMethodField()

    class Meta:
        model = IncidentReport
        fields = (
            "id",
            "reporter_type",
            "reported_party_type",
            "category",
            "description",
            "status",
            "severity",
            "payout_frozen",
            "admin_notes",
            "resolution",
            "resolved_at",
            "created_at",
            "evidences_count",
        )
        read_only_fields = fields

    def get_evidences_count(self, obj):
        return obj.evidences.count()


class ProfessionalBookingSerializer(serializers.ModelSerializer):
    service_title = serializers.CharField(source="service.title", read_only=True)
    start_at = serializers.DateTimeField(source="slot.start_at", read_only=True)
    end_at = serializers.DateTimeField(source="slot.end_at", read_only=True)
    payment_summary = serializers.SerializerMethodField()
    payout_summary = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()
    incidents = IncidentReportSerializer(many=True, read_only=True)
    thread_messages = serializers.SerializerMethodField()

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
            "incidents",
            "thread_messages",
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
            "incidents",
            "thread_messages",
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

    def get_thread_messages(self, obj):
        thread = getattr(obj, "thread", None)
        if not thread:
            return []
        messages = thread.messages.order_by("created_at")[:20]
        return BookingMessageSerializer(messages, many=True).data


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
