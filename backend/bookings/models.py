from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.core.validators import MinValueValidator

from common.models import TimeStampedUUIDModel
from professionals.models import ProfessionalProfile
from services.models import MassageService


class AvailabilitySlot(TimeStampedUUIDModel):
    class SlotType(models.TextChoices):
        OPEN = "open", "Créneau réservable"
        BLOCKED = "blocked", "Plage bloquée"

    professional = models.ForeignKey(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="availability_slots",
    )
    service = models.ForeignKey(
        MassageService,
        on_delete=models.CASCADE,
        related_name="availability_slots",
        null=True,
        blank=True,
    )
    start_at = models.DateTimeField("début")
    end_at = models.DateTimeField("fin")
    slot_type = models.CharField(
        "type de créneau",
        max_length=20,
        choices=SlotType.choices,
        default=SlotType.OPEN,
    )
    label = models.CharField("libellé", max_length=120, blank=True)
    is_active = models.BooleanField("actif", default=True)

    class Meta:
        verbose_name = "créneau disponible"
        verbose_name_plural = "créneaux disponibles"
        ordering = ("start_at",)
        indexes = [
            models.Index(fields=("professional", "start_at")),
            models.Index(fields=("professional", "slot_type", "is_active")),
        ]

    def __str__(self) -> str:
        return f"{self.professional.business_name} — {self.start_at} → {self.end_at}"

    def clean(self):
        if self.end_at <= self.start_at:
            raise ValidationError("La fin doit être après le début.")

        overlapping = AvailabilitySlot.objects.filter(
            professional=self.professional,
            is_active=True,
            start_at__lt=self.end_at,
            end_at__gt=self.start_at,
        ).exclude(pk=self.pk)

        if overlapping.exists():
            raise ValidationError("Ce créneau chevauche déjà un autre créneau.")

        if self.service and self.service.professional_id != self.professional_id:
            raise ValidationError("Le service sélectionné n'appartient pas à ce professionnel.")

        if self.slot_type == self.SlotType.BLOCKED and self.service_id:
            raise ValidationError("Une plage bloquée ne peut pas être liée à une prestation.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Booking(TimeStampedUUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        CONFIRMED = "confirmed", "Confirmée"
        CANCELED = "canceled", "Annulée"

    class PaymentStatus(models.TextChoices):
        NONE_REQUIRED = "none_required", "Aucun paiement demandé"
        PAYMENT_REQUIRED = "payment_required", "Paiement demandé"
        DEPOSIT_REQUIRED = "deposit_required", "Acompte attendu"
        PAYMENT_PENDING = "payment_pending", "Paiement en attente"
        PAYMENT_AUTHORIZED = "payment_authorized", "Autorisation enregistrée"
        PAYMENT_CAPTURED = "payment_captured", "Paiement capturé"
        PARTIALLY_REFUNDED = "partially_refunded", "Remboursement partiel"
        REFUNDED = "refunded", "Remboursé"
        CANCELED = "canceled", "Annulé"

    class PayoutStatus(models.TextChoices):
        NOT_APPLICABLE = "not_applicable", "Aucun versement plateforme"
        PAYOUT_PENDING = "payout_pending", "Versement en attente"
        PAYOUT_READY = "payout_ready", "Versement libérable"
        PAYOUT_RELEASED = "payout_released", "Versement envoyé"
        PAYOUT_BLOCKED = "payout_blocked", "Versement bloqué"

    class FulfillmentStatus(models.TextChoices):
        SCHEDULED = "scheduled", "Planifié"
        CLIENT_ARRIVED = "client_arrived", "Client arrivé"
        IN_PROGRESS = "in_progress", "Prestation commencée"
        COMPLETED_BY_PRACTITIONER = "completed_by_practitioner", "Terminée par le praticien"
        COMPLETED_VALIDATED_BY_CLIENT = "completed_validated_by_client", "Validée par le client"
        DISPUTED = "disputed", "Signalée"
        AUTO_COMPLETED = "auto_completed", "Validée automatiquement"

    class PaymentCollectionMethod(models.TextChoices):
        NONE = "none", "Aucun règlement à la réservation"
        PLATFORM = "platform", "Plateforme"
        ON_SITE = "on_site", "Sur place"

    class PaymentChannel(models.TextChoices):
        NONE = "none", "Non précisé"
        PLATFORM = "platform", "Plateforme"
        CASH = "cash", "Espèces"
        BANK_TRANSFER = "bank_transfer", "Virement"
        CARD_READER = "card_reader", "Terminal"
        OTHER = "other", "Autre"

    class ActorRole(models.TextChoices):
        CLIENT = "client", "Client"
        PRACTITIONER = "practitioner", "Praticien"
        PLATFORM = "platform", "Plateforme"
        SYSTEM = "system", "Système"

    class RefundDecisionSource(models.TextChoices):
        NONE = "none", "Aucune décision"
        AUTOMATIC_POLICY = "automatic_policy", "Politique automatique"
        MANUAL_PRACTITIONER = "manual_practitioner", "Décision praticien"
        SUPPORT = "support", "Support"

    professional = models.ForeignKey(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    service = models.ForeignKey(
        MassageService,
        on_delete=models.PROTECT,
        related_name="bookings",
    )
    slot = models.ForeignKey(
        AvailabilitySlot,
        on_delete=models.PROTECT,
        related_name="bookings",
    )

    client_first_name = models.CharField("prénom", max_length=120)
    client_last_name = models.CharField("nom", max_length=120)
    client_email = models.EmailField("email")
    client_phone = models.CharField("téléphone", max_length=30, blank=True)
    client_note = models.TextField("note client", blank=True)

    status = models.CharField(
        "statut",
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    payment_status = models.CharField(
        "statut de règlement",
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.NONE_REQUIRED,
    )
    payment_mode = models.CharField(
        "mode de règlement appliqué",
        max_length=20,
        choices=ProfessionalProfile.ReservationPaymentMode.choices,
        default=ProfessionalProfile.ReservationPaymentMode.NONE,
    )
    payment_collection_method = models.CharField(
        "mode d'encaissement",
        max_length=20,
        choices=PaymentCollectionMethod.choices,
        default=PaymentCollectionMethod.NONE,
    )
    payment_channel = models.CharField(
        "canal d'encaissement",
        max_length=20,
        choices=PaymentChannel.choices,
        default=PaymentChannel.NONE,
    )
    payout_status = models.CharField(
        "statut de versement praticien",
        max_length=20,
        choices=PayoutStatus.choices,
        default=PayoutStatus.NOT_APPLICABLE,
    )
    fulfillment_status = models.CharField(
        "statut de prestation",
        max_length=40,
        choices=FulfillmentStatus.choices,
        default=FulfillmentStatus.SCHEDULED,
    )
    total_price_eur = models.DecimalField(
        "prix total",
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    amount_due_now_eur = models.DecimalField(
        "montant demandé maintenant",
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    amount_received_eur = models.DecimalField(
        "montant reçu",
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    amount_remaining_eur = models.DecimalField(
        "reste à régler",
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    amount_refunded_eur = models.DecimalField(
        "montant remboursé",
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    platform_fee_eur = models.DecimalField(
        "commission plateforme",
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    payout_amount_eur = models.DecimalField(
        "montant à reverser",
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    cancellation_notice_hours = models.PositiveIntegerField(
        "annulation sans frais jusqu'à",
        default=24,
    )
    keep_payment_after_deadline = models.BooleanField(
        "conserver le règlement après le délai",
        default=True,
    )
    payment_message = models.CharField(
        "message affiché au client",
        max_length=220,
        blank=True,
    )
    trust_exemption_applied = models.BooleanField(
        "exemption accordée à un client de confiance",
        default=False,
    )
    payment_due_expires_at = models.DateTimeField(
        "date limite du règlement demandé",
        null=True,
        blank=True,
    )
    payment_authorized_at = models.DateTimeField(
        "autorisation de règlement reçue le",
        null=True,
        blank=True,
    )
    payment_captured_at = models.DateTimeField(
        "règlement capturé le",
        null=True,
        blank=True,
    )
    payout_ready_at = models.DateTimeField(
        "versement libérable le",
        null=True,
        blank=True,
    )
    payout_released_at = models.DateTimeField(
        "versement envoyé le",
        null=True,
        blank=True,
    )
    service_validation_requested_at = models.DateTimeField(
        "validation client demandée le",
        null=True,
        blank=True,
    )
    client_arrived_at = models.DateTimeField("client arrivé le", null=True, blank=True)
    service_started_at = models.DateTimeField("prestation commencée le", null=True, blank=True)
    service_completed_at = models.DateTimeField("prestation terminée le", null=True, blank=True)
    client_validated_at = models.DateTimeField("prestation validée par le client le", null=True, blank=True)
    auto_completed_at = models.DateTimeField("validation automatique le", null=True, blank=True)
    issue_opened_at = models.DateTimeField("signalement ouvert le", null=True, blank=True)
    issue_opened_by_role = models.CharField(
        "signalement ouvert par",
        max_length=20,
        choices=ActorRole.choices,
        default=ActorRole.SYSTEM,
    )
    issue_reason = models.CharField("motif du signalement", max_length=220, blank=True)
    client_no_show_at = models.DateTimeField("absence client signalée le", null=True, blank=True)
    practitioner_no_show_at = models.DateTimeField("absence praticien signalée le", null=True, blank=True)
    canceled_by_role = models.CharField(
        "annulé par",
        max_length=20,
        choices=ActorRole.choices,
        default=ActorRole.SYSTEM,
    )
    cancellation_reason = models.CharField("raison d'annulation", max_length=220, blank=True)
    refund_decision_source = models.CharField(
        "source de la décision de remboursement",
        max_length=30,
        choices=RefundDecisionSource.choices,
        default=RefundDecisionSource.NONE,
    )
    provider_payment_intent_id = models.CharField(
        "identifiant PaymentIntent",
        max_length=120,
        blank=True,
    )
    provider_checkout_session_id = models.CharField(
        "identifiant Checkout Session",
        max_length=120,
        blank=True,
    )
    provider_charge_id = models.CharField("identifiant charge", max_length=120, blank=True)
    provider_transfer_id = models.CharField("identifiant transfert", max_length=120, blank=True)
    provider_refund_id = models.CharField("identifiant remboursement", max_length=120, blank=True)
    provider_payout_id = models.CharField("identifiant versement", max_length=120, blank=True)
    payout_blocked_reason = models.CharField("raison blocage versement", max_length=220, blank=True)

    class Meta:
        verbose_name = "réservation"
        verbose_name_plural = "réservations"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("slot",),
                condition=Q(status__in=("pending", "confirmed")),
                name="unique_active_booking_per_slot",
            )
        ]

    def __str__(self) -> str:
        return f"{self.client_first_name} {self.client_last_name} — {self.service.title}"

    def clean(self):
        if self.slot.professional_id != self.professional_id:
            raise ValidationError("Le créneau n'appartient pas à ce professionnel.")

        if self.service.professional_id != self.professional_id:
            raise ValidationError("Le service n'appartient pas à ce professionnel.")

        if self.slot.service_id and self.slot.service_id != self.service_id:
            raise ValidationError("Ce créneau est lié à un autre service.")

        if not self.slot.is_active or self.slot.slot_type != AvailabilitySlot.SlotType.OPEN:
            raise ValidationError("Ce créneau ne peut pas être réservé.")

        active_booking_exists = Booking.objects.filter(
            slot=self.slot,
            status__in=(self.Status.PENDING, self.Status.CONFIRMED),
        ).exclude(pk=self.pk)

        if active_booking_exists.exists():
            raise ValidationError("Ce créneau est déjà réservé.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class TrustedClient(TimeStampedUUIDModel):
    professional = models.ForeignKey(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="trusted_clients",
    )
    first_name = models.CharField("prénom", max_length=120)
    last_name = models.CharField("nom", max_length=120, blank=True)
    email = models.EmailField("email")
    waive_deposit = models.BooleanField("peut réserver sans acompte", default=True)
    allow_pay_on_site = models.BooleanField("peut régler sur place", default=True)
    notes = models.TextField("notes internes", blank=True)
    is_active = models.BooleanField("actif", default=True)

    class Meta:
        verbose_name = "client de confiance"
        verbose_name_plural = "clients de confiance"
        constraints = [
            models.UniqueConstraint(
                fields=("professional", "email"),
                name="unique_trusted_client_email_per_professional",
            )
        ]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.email


class BookingPayment(TimeStampedUUIDModel):
    class Kind(models.TextChoices):
        DEPOSIT = "deposit", "Acompte"
        FULL = "full", "Paiement total"
        REFUND = "refund", "Remboursement"
        MANUAL_COLLECTION = "manual_collection", "Règlement enregistré"
        PAYOUT = "payout", "Versement praticien"

    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        REQUIRES_ACTION = "requires_action", "Action requise"
        AUTHORIZED = "authorized", "Autorisé"
        CAPTURED = "captured", "Capturé"
        PARTIALLY_REFUNDED = "partially_refunded", "Partiellement remboursé"
        REFUNDED = "refunded", "Remboursé"
        RELEASED = "released", "Versé"
        FAILED = "failed", "Échoué"
        CANCELED = "canceled", "Annulé"

    class Provider(models.TextChoices):
        STRIPE_CONNECT = "stripe_connect", "Stripe Connect"
        MANUAL = "manual", "Enregistrement manuel"
        SYSTEM = "system", "Système"

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    kind = models.CharField(
        "type de règlement",
        max_length=20,
        choices=Kind.choices,
    )
    status = models.CharField(
        "statut",
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    provider = models.CharField(
        "prestataire",
        max_length=30,
        choices=Provider.choices,
        default=Provider.STRIPE_CONNECT,
    )
    amount_eur = models.DecimalField(
        "montant",
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    currency = models.CharField("devise", max_length=3, default="eur")
    provider_reference = models.CharField("référence prestataire", max_length=120, blank=True)
    provider_payment_intent_id = models.CharField(max_length=120, blank=True)
    provider_checkout_session_id = models.CharField(max_length=120, blank=True)
    provider_charge_id = models.CharField(max_length=120, blank=True)
    provider_transfer_id = models.CharField(max_length=120, blank=True)
    provider_refund_id = models.CharField(max_length=120, blank=True)
    provider_payout_id = models.CharField(max_length=120, blank=True)
    idempotency_key = models.CharField(max_length=120, blank=True, null=True, unique=True)
    is_live_mode = models.BooleanField(default=False)
    recorded_by_role = models.CharField(
        max_length=20,
        choices=Booking.ActorRole.choices,
        default=Booking.ActorRole.SYSTEM,
    )
    raw_provider_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "règlement de réservation"
        verbose_name_plural = "règlements de réservation"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.booking_id} — {self.kind} — {self.amount_eur} €"


class BookingEventLog(TimeStampedUUIDModel):
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name="event_logs",
    )
    actor_role = models.CharField(
        max_length=20,
        choices=Booking.ActorRole.choices,
        default=Booking.ActorRole.SYSTEM,
    )
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="booking_events",
    )
    event_type = models.CharField(max_length=80)
    message = models.CharField(max_length=220)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "événement de réservation"
        verbose_name_plural = "événements de réservation"
        ordering = ("-created_at",)


class PaymentWebhookEventLog(TimeStampedUUIDModel):
    class ProcessingStatus(models.TextChoices):
        RECEIVED = "received", "Reçu"
        PROCESSED = "processed", "Traité"
        FAILED = "failed", "Échoué"
        IGNORED = "ignored", "Ignoré"

    provider = models.CharField(max_length=30, choices=BookingPayment.Provider.choices)
    provider_event_id = models.CharField(max_length=120, unique=True)
    event_type = models.CharField(max_length=120)
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.RECEIVED,
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="webhook_events",
    )
    payload = models.JSONField(default=dict, blank=True)
    signature_valid = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        verbose_name = "journal webhook paiement"
        verbose_name_plural = "journaux webhook paiement"
        ordering = ("-created_at",)
