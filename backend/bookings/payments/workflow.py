from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from professionals.models import ProfessionalPaymentAccount, ProfessionalProfile

from ..models import (
    Booking,
    BookingEventLog,
    BookingPayment,
    BookingThread,
    IncidentReport,
    RiskRegisterEntry,
    TrustedClient,
)
from .stripe_connect import (
    StripeConnectError,
    create_checkout_session,
    create_internal_test_checkout_stub,
    create_refund,
    create_transfer,
    get_stripe_connect_config,
)

ZERO_EUR = Decimal("0.00")
logger = logging.getLogger(__name__)


def quantize_eur(value: Decimal | str | int | float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _payment_hold_minutes() -> int:
    return int(getattr(settings, "NUADYX_PAYMENT_HOLD_MINUTES", 30))


def _auto_release_hours() -> int:
    return int(getattr(settings, "NUADYX_AUTO_RELEASE_AFTER_HOURS", 48))


def _platform_fee_rate() -> Decimal:
    return Decimal(str(getattr(settings, "NUADYX_PLATFORM_FEE_RATE", "0.10")))


def _platform_default_deposit_percentage() -> Decimal:
    return Decimal(str(getattr(settings, "NUADYX_DEFAULT_DEPOSIT_PERCENTAGE", "30.00")))


def _platform_min_deposit_percentage() -> Decimal:
    return Decimal(str(getattr(settings, "NUADYX_MIN_DEPOSIT_PERCENTAGE", "20.00")))


def _platform_max_deposit_percentage() -> Decimal:
    return Decimal(str(getattr(settings, "NUADYX_MAX_DEPOSIT_PERCENTAGE", "50.00")))


def _unverified_practitioner_max_deposit_percentage() -> Decimal:
    return Decimal(
        str(
            getattr(
                settings,
                "NUADYX_UNVERIFIED_PRACTITIONER_MAX_DEPOSIT_PERCENTAGE",
                "20.00",
            )
        )
    )


def _full_refund_notice_hours() -> int:
    return int(getattr(settings, "NUADYX_FULL_REFUND_NOTICE_HOURS", 48))


def _partial_refund_notice_hours() -> int:
    return int(getattr(settings, "NUADYX_PARTIAL_REFUND_NOTICE_HOURS", 24))


def _partial_refund_rate() -> Decimal:
    return Decimal(str(getattr(settings, "NUADYX_PARTIAL_REFUND_RATE", "0.50")))


def _is_practitioner_verified_for_payments(professional: ProfessionalProfile) -> bool:
    verification = getattr(professional, "verification", None)
    return bool(verification and verification.badge_is_active)


def _is_full_payment_allowed(professional: ProfessionalProfile) -> bool:
    if not getattr(settings, "NUADYX_REQUIRE_VERIFIED_PRACTITIONER_FOR_FULL_PAYMENT", True):
        return True
    return _is_practitioner_verified_for_payments(professional)


def _effective_deposit_cap_percentage(professional: ProfessionalProfile) -> Decimal:
    if _is_practitioner_verified_for_payments(professional):
        return _platform_max_deposit_percentage()
    return min(
        _platform_max_deposit_percentage(),
        _unverified_practitioner_max_deposit_percentage(),
    )


def compute_platform_fee_eur(amount_eur: Decimal) -> Decimal:
    if amount_eur <= ZERO_EUR:
        return ZERO_EUR
    return quantize_eur(amount_eur * _platform_fee_rate())


def get_practitioner_payment_readiness(professional: ProfessionalProfile) -> tuple[bool, str]:
    config = get_stripe_connect_config()
    payment_account = getattr(professional, "payment_account", None)
    if not payment_account or payment_account.onboarding_status != ProfessionalPaymentAccount.OnboardingStatus.ACTIVE:
        return False, "Le praticien n'est pas encore prêt pour l'encaissement en ligne."
    if not payment_account.details_submitted or not payment_account.charges_enabled or not payment_account.payouts_enabled:
        return False, "Le compte de paiement du praticien n'est pas encore totalement activé."

    risk_entry = (
        RiskRegisterEntry.objects.filter(
            subject_type=RiskRegisterEntry.SubjectType.PRACTITIONER,
            professional=professional,
            is_active=True,
        )
        .order_by("-created_at")
        .first()
    )
    if risk_entry and (
        risk_entry.risk_level in {RiskRegisterEntry.RiskLevel.HIGH, RiskRegisterEntry.RiskLevel.BLOCKED}
        or risk_entry.practitioner_trust_status
        in {
            RiskRegisterEntry.PractitionerTrustStatus.RESTRICTED,
            RiskRegisterEntry.PractitionerTrustStatus.SUSPENDED,
        }
    ):
        return False, "Le paiement en ligne est temporairement suspendu pour ce praticien."

    if not config.enabled and config.internal_test_mode:
        return True, ""
    if not config.enabled:
        return False, "Le paiement en ligne n'est pas disponible pour le moment."

    return True, ""


def _latest_checkout_payment(booking: Booking):
    return (
        booking.payments.filter(
            kind__in=(BookingPayment.Kind.DEPOSIT, BookingPayment.Kind.FULL)
        )
        .order_by("-created_at")
        .first()
    )


def _assert_not_canceled(booking: Booking):
    if booking.status == Booking.Status.CANCELED:
        raise ValidationError("Cette réservation est déjà annulée.")


def _assert_confirmed_booking(booking: Booking):
    _assert_not_canceled(booking)
    if booking.status != Booking.Status.CONFIRMED:
        raise ValidationError("Cette action est disponible après confirmation du rendez-vous.")


def get_trusted_client_for_booking(*, professional: ProfessionalProfile, client_email: str):
    if not client_email:
        return None
    return (
        TrustedClient.objects.filter(
            professional=professional,
            email__iexact=client_email,
            is_active=True,
        )
        .order_by("-created_at")
        .first()
    )


def calculate_booking_payment_terms(*, professional: ProfessionalProfile, total_price: Decimal, trusted_client: TrustedClient | None = None):
    total = quantize_eur(total_price)
    payment_mode = professional.reservation_payment_mode
    payment_ready, payment_readiness_reason = get_practitioner_payment_readiness(professional)
    full_payment_allowed = _is_full_payment_allowed(professional)
    effective_deposit_cap = _effective_deposit_cap_percentage(professional)
    trust_exemption_applied = bool(
        trusted_client
        and trusted_client.is_active
        and (trusted_client.waive_deposit or trusted_client.allow_pay_on_site)
        and payment_mode in {
            ProfessionalProfile.ReservationPaymentMode.DEPOSIT,
            ProfessionalProfile.ReservationPaymentMode.FULL,
        }
    )
    if payment_mode == ProfessionalProfile.ReservationPaymentMode.FULL and not full_payment_allowed:
        payment_ready = False
        payment_readiness_reason = (
            "Le paiement total à la réservation est réservé aux praticiens vérifiés."
        )

    if (
        payment_mode == ProfessionalProfile.ReservationPaymentMode.NONE
        or trust_exemption_applied
        or not payment_ready
    ):
        effective_payment_mode = (
            ProfessionalProfile.ReservationPaymentMode.NONE
            if (trust_exemption_applied or not payment_ready)
            else payment_mode
        )
        return {
            "payment_mode": effective_payment_mode,
            "payment_status": Booking.PaymentStatus.NONE_REQUIRED,
            "payment_collection_method": Booking.PaymentCollectionMethod.ON_SITE,
            "payment_channel": Booking.PaymentChannel.NONE,
            "payout_status": Booking.PayoutStatus.NOT_APPLICABLE,
            "total_price_eur": total,
            "amount_due_now_eur": ZERO_EUR,
            "amount_received_eur": ZERO_EUR,
            "amount_remaining_eur": total,
            "amount_refunded_eur": ZERO_EUR,
            "platform_fee_eur": ZERO_EUR,
            "payout_amount_eur": ZERO_EUR,
            "cancellation_notice_hours": professional.free_cancellation_notice_hours,
            "keep_payment_after_deadline": professional.keep_payment_after_deadline,
            "payment_message": payment_readiness_reason or professional.payment_message,
            "trust_exemption_applied": trust_exemption_applied,
            "payment_due_expires_at": None,
        }

    if payment_mode == ProfessionalProfile.ReservationPaymentMode.FULL:
        due_now = total
        status = Booking.PaymentStatus.PAYMENT_REQUIRED
    else:
        if professional.deposit_value_type == ProfessionalProfile.DepositValueType.PERCENTAGE:
            bounded_percentage = min(
                effective_deposit_cap,
                max(
                    _platform_min_deposit_percentage(),
                    professional.deposit_value or _platform_default_deposit_percentage(),
                ),
            )
            due_now = quantize_eur(total * bounded_percentage / Decimal("100"))
        else:
            max_deposit_amount = quantize_eur(total * effective_deposit_cap / Decimal("100"))
            due_now = min(max_deposit_amount, quantize_eur(professional.deposit_value))
        due_now = min(total, max(ZERO_EUR, due_now))
        status = Booking.PaymentStatus.DEPOSIT_REQUIRED

    remaining = max(ZERO_EUR, total - due_now)
    fee = compute_platform_fee_eur(due_now)

    return {
        "payment_mode": payment_mode,
        "payment_status": status,
        "payment_collection_method": Booking.PaymentCollectionMethod.PLATFORM,
        "payment_channel": Booking.PaymentChannel.NONE,
        "payout_status": Booking.PayoutStatus.PAYOUT_PENDING,
        "total_price_eur": total,
        "amount_due_now_eur": due_now,
        "amount_received_eur": ZERO_EUR,
        "amount_remaining_eur": remaining,
        "amount_refunded_eur": ZERO_EUR,
        "platform_fee_eur": fee,
        "payout_amount_eur": max(ZERO_EUR, due_now - fee),
        "cancellation_notice_hours": professional.free_cancellation_notice_hours,
        "keep_payment_after_deadline": professional.keep_payment_after_deadline,
        "payment_message": professional.payment_message,
        "trust_exemption_applied": False,
        "payment_due_expires_at": timezone.now() + timedelta(minutes=_payment_hold_minutes()),
    }


def record_booking_event(*, booking: Booking, actor_role: str, event_type: str, message: str, actor_user=None, metadata: dict | None = None):
    BookingEventLog.objects.create(
        booking=booking,
        actor_role=actor_role,
        actor_user=actor_user,
        event_type=event_type,
        message=message,
        metadata=metadata or {},
    )


def expire_stale_payment_holds(*, now=None) -> int:
    reference_time = now or timezone.now()
    stale_bookings = Booking.objects.filter(
        status=Booking.Status.PENDING,
        payment_status__in=(
            Booking.PaymentStatus.DEPOSIT_REQUIRED,
            Booking.PaymentStatus.PAYMENT_REQUIRED,
            Booking.PaymentStatus.PAYMENT_PENDING,
            Booking.PaymentStatus.PAYMENT_AUTHORIZED,
        ),
        payment_due_expires_at__lt=reference_time,
    )
    expired_count = 0
    for booking in stale_bookings:
        booking.status = Booking.Status.CANCELED
        booking.payment_status = Booking.PaymentStatus.CANCELED
        booking.canceled_by_role = Booking.ActorRole.SYSTEM
        booking.cancellation_reason = "Le règlement demandé n'a pas été finalisé dans le délai prévu."
        booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
        booking.payout_blocked_reason = "Demande de règlement expirée."
        booking.save(
            update_fields=[
                "status",
                "payment_status",
                "canceled_by_role",
                "cancellation_reason",
                "payout_status",
                "payout_blocked_reason",
                "updated_at",
            ]
        )
        record_booking_event(
            booking=booking,
            actor_role=Booking.ActorRole.SYSTEM,
            event_type="payment.expired",
            message="Le délai pour finaliser le règlement est dépassé.",
        )
        logger.info(
            "booking.payment.expired",
            extra={"booking_id": str(booking.id), "professional_id": str(booking.professional_id)},
        )
        expired_count += 1
    return expired_count


def record_booking_payment_request(booking: Booking):
    if booking.amount_due_now_eur <= ZERO_EUR:
        return None

    existing_payment = _latest_checkout_payment(booking)
    if existing_payment and existing_payment.status in {
        BookingPayment.Status.PENDING,
        BookingPayment.Status.REQUIRES_ACTION,
        BookingPayment.Status.AUTHORIZED,
        BookingPayment.Status.CAPTURED,
    }:
        return existing_payment

    payment_kind = (
        BookingPayment.Kind.FULL
        if booking.payment_mode == ProfessionalProfile.ReservationPaymentMode.FULL
        else BookingPayment.Kind.DEPOSIT
    )
    idempotency_key = f"booking-{booking.id}-checkout"
    payment = BookingPayment.objects.create(
        booking=booking,
        kind=payment_kind,
        status=BookingPayment.Status.PENDING,
        provider=BookingPayment.Provider.STRIPE_CONNECT,
        amount_eur=booking.amount_due_now_eur,
        currency="eur",
        idempotency_key=idempotency_key,
        recorded_by_role=Booking.ActorRole.SYSTEM,
    )
    record_booking_event(
        booking=booking,
        actor_role=Booking.ActorRole.SYSTEM,
        event_type="payment.requested",
        message="Un règlement a été demandé pour sécuriser ce rendez-vous.",
        metadata={"amount_due_now_eur": str(booking.amount_due_now_eur)},
    )
    return payment


def mark_booking_payment_pending(booking: Booking, *, checkout_session_id: str = "", payment_intent_id: str = "", payload: dict | None = None):
    _assert_not_canceled(booking)
    if booking.payment_status == Booking.PaymentStatus.PAYMENT_CAPTURED:
        return booking

    booking.payment_status = Booking.PaymentStatus.PAYMENT_PENDING
    booking.provider_checkout_session_id = checkout_session_id or booking.provider_checkout_session_id
    booking.provider_payment_intent_id = payment_intent_id or booking.provider_payment_intent_id
    booking.save(
        update_fields=[
            "payment_status",
            "provider_checkout_session_id",
            "provider_payment_intent_id",
            "updated_at",
        ]
    )

    payment = _latest_checkout_payment(booking)
    if payment:
        payment.status = BookingPayment.Status.REQUIRES_ACTION
        payment.provider_checkout_session_id = checkout_session_id or payment.provider_checkout_session_id
        payment.provider_payment_intent_id = payment_intent_id or payment.provider_payment_intent_id
        if payload:
            payment.raw_provider_payload = payload
        payment.save(
            update_fields=[
                "status",
                "provider_checkout_session_id",
                "provider_payment_intent_id",
                "raw_provider_payload",
                "updated_at",
            ]
        )
    return booking


def mark_booking_payment_authorized(booking: Booking, *, payment_intent_id: str = "", charge_id: str = "", payload: dict | None = None):
    if booking.payment_status in {
        Booking.PaymentStatus.PAYMENT_CAPTURED,
        Booking.PaymentStatus.REFUNDED,
        Booking.PaymentStatus.PARTIALLY_REFUNDED,
        Booking.PaymentStatus.CANCELED,
    }:
        return booking

    if booking.payment_status == Booking.PaymentStatus.PAYMENT_AUTHORIZED:
        return booking

    booking.payment_status = Booking.PaymentStatus.PAYMENT_AUTHORIZED
    booking.payment_authorized_at = timezone.now()
    booking.provider_payment_intent_id = payment_intent_id or booking.provider_payment_intent_id
    booking.provider_charge_id = charge_id or booking.provider_charge_id
    booking.save(
        update_fields=[
            "payment_status",
            "payment_authorized_at",
            "provider_payment_intent_id",
            "provider_charge_id",
            "updated_at",
        ]
    )

    payment = _latest_checkout_payment(booking)
    if payment:
        payment.status = BookingPayment.Status.AUTHORIZED
        payment.provider_payment_intent_id = booking.provider_payment_intent_id
        payment.provider_charge_id = booking.provider_charge_id
        if payload:
            payment.raw_provider_payload = payload
        payment.save(
            update_fields=[
                "status",
                "provider_payment_intent_id",
                "provider_charge_id",
                "raw_provider_payload",
                "updated_at",
            ]
        )

    record_booking_event(
        booking=booking,
        actor_role=Booking.ActorRole.SYSTEM,
        event_type="payment.authorized",
        message="Le règlement a été autorisé par le prestataire de paiement.",
    )
    return booking


def mark_booking_payment_captured(booking: Booking, *, payment_intent_id: str = "", charge_id: str = "", payload: dict | None = None):
    if booking.payment_status in {
        Booking.PaymentStatus.PAYMENT_CAPTURED,
        Booking.PaymentStatus.REFUNDED,
        Booking.PaymentStatus.PARTIALLY_REFUNDED,
        Booking.PaymentStatus.CANCELED,
    }:
        return booking

    booking.payment_status = Booking.PaymentStatus.PAYMENT_CAPTURED
    booking.amount_received_eur = booking.amount_due_now_eur
    booking.payment_channel = Booking.PaymentChannel.PLATFORM
    booking.payment_captured_at = timezone.now()
    booking.payment_due_expires_at = None
    booking.provider_payment_intent_id = payment_intent_id or booking.provider_payment_intent_id
    booking.provider_charge_id = charge_id or booking.provider_charge_id
    booking.payout_status = Booking.PayoutStatus.PAYOUT_PENDING
    booking.save(
        update_fields=[
            "payment_status",
            "amount_received_eur",
            "payment_channel",
            "payment_captured_at",
            "payment_due_expires_at",
            "provider_payment_intent_id",
            "provider_charge_id",
            "payout_status",
            "updated_at",
        ]
    )

    payment = _latest_checkout_payment(booking)
    if payment:
        payment.status = BookingPayment.Status.CAPTURED
        payment.provider_payment_intent_id = booking.provider_payment_intent_id
        payment.provider_charge_id = booking.provider_charge_id
        if payload:
            payment.raw_provider_payload = payload
        payment.save(
            update_fields=[
                "status",
                "provider_payment_intent_id",
                "provider_charge_id",
                "raw_provider_payload",
                "updated_at",
            ]
        )

    record_booking_event(
        booking=booking,
        actor_role=Booking.ActorRole.SYSTEM,
        event_type="payment.captured",
        message="Le règlement a été capturé sur la plateforme.",
    )
    logger.info(
        "booking.payment.captured",
        extra={
            "booking_id": str(booking.id),
            "payment_intent_id": booking.provider_payment_intent_id,
            "charge_id": booking.provider_charge_id,
        },
    )
    return booking


def create_checkout_for_booking(*, booking: Booking, success_url: str, cancel_url: str):
    _assert_not_canceled(booking)
    if booking.amount_due_now_eur <= ZERO_EUR:
        raise ValidationError("Aucun règlement n'est demandé pour cette réservation.")

    if booking.payment_status == Booking.PaymentStatus.PAYMENT_CAPTURED:
        raise ValidationError("Le règlement a déjà été sécurisé pour cette réservation.")

    payment = _latest_checkout_payment(booking) or record_booking_payment_request(booking)
    if not payment:
        return None

    if payment.status in {BookingPayment.Status.REQUIRES_ACTION, BookingPayment.Status.AUTHORIZED}:
        raw_payload = payment.raw_provider_payload or {}
        if raw_payload.get("url"):
            return raw_payload
        raise ValidationError("Un règlement est déjà en cours pour cette réservation.")

    config = get_stripe_connect_config()
    if config.enabled:
        session = create_checkout_session(
            booking=booking,
            success_url=success_url,
            cancel_url=cancel_url,
            idempotency_key=payment.idempotency_key or f"booking-{booking.id}-checkout",
        )
    elif config.internal_test_mode:
        session = create_internal_test_checkout_stub(
            booking=booking,
            success_url=success_url,
        )
    else:
        raise StripeConnectError(
            "Le règlement en ligne n'est pas encore disponible pour ce praticien."
        )

    mark_booking_payment_pending(
        booking,
        checkout_session_id=session.get("id", ""),
        payment_intent_id=session.get("payment_intent", ""),
        payload=session,
    )
    return session


def record_manual_payment(*, booking: Booking, channel: str, actor_user=None):
    _assert_not_canceled(booking)
    if booking.amount_remaining_eur <= ZERO_EUR:
        raise ValidationError("Aucun montant restant n'est à enregistrer sur cette réservation.")

    manual_amount = booking.amount_remaining_eur or booking.total_price_eur
    booking.amount_received_eur = quantize_eur(booking.amount_received_eur + manual_amount)
    booking.amount_remaining_eur = ZERO_EUR
    booking.payment_status = Booking.PaymentStatus.PAYMENT_CAPTURED
    booking.payment_collection_method = (
        Booking.PaymentCollectionMethod.ON_SITE
        if booking.payment_collection_method == Booking.PaymentCollectionMethod.NONE
        else booking.payment_collection_method
    )
    booking.payment_channel = channel
    booking.save(
        update_fields=[
            "amount_received_eur",
            "amount_remaining_eur",
            "payment_status",
            "payment_collection_method",
            "payment_channel",
            "updated_at",
        ]
    )
    BookingPayment.objects.create(
        booking=booking,
        kind=BookingPayment.Kind.MANUAL_COLLECTION,
        status=BookingPayment.Status.CAPTURED,
        provider=BookingPayment.Provider.MANUAL,
        amount_eur=manual_amount,
        currency="eur",
        recorded_by_role=Booking.ActorRole.PRACTITIONER,
    )
    record_booking_event(
        booking=booking,
        actor_role=Booking.ActorRole.PRACTITIONER,
        actor_user=actor_user,
        event_type="payment.manual_recorded",
        message="Un règlement a été enregistré sur place.",
        metadata={"channel": channel, "amount_eur": str(manual_amount)},
    )
    return booking


def apply_cancellation_payment_outcome(*, booking: Booking, initiated_by: str, reason: str = "", actor_user=None, refund_decision_source: str = Booking.RefundDecisionSource.AUTOMATIC_POLICY):
    booking.canceled_by_role = initiated_by
    booking.cancellation_reason = reason

    if booking.amount_received_eur <= ZERO_EUR:
        booking.payment_status = Booking.PaymentStatus.CANCELED
        booking.amount_remaining_eur = ZERO_EUR
        booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED if booking.payment_collection_method == Booking.PaymentCollectionMethod.PLATFORM else Booking.PayoutStatus.NOT_APPLICABLE
        booking.payout_blocked_reason = "Réservation annulée avant encaissement."
        return booking

    now = timezone.now()
    full_refund_limit = booking.slot.start_at - timedelta(hours=_full_refund_notice_hours())
    partial_refund_limit = booking.slot.start_at - timedelta(hours=_partial_refund_notice_hours())

    if initiated_by in {Booking.ActorRole.PRACTITIONER, Booking.ActorRole.PLATFORM}:
        refund_amount = booking.amount_received_eur
    elif now <= full_refund_limit or not booking.keep_payment_after_deadline:
        refund_amount = booking.amount_received_eur
    elif now <= partial_refund_limit:
        refund_amount = quantize_eur(booking.amount_received_eur * _partial_refund_rate())
    else:
        refund_amount = ZERO_EUR

    if refund_amount > ZERO_EUR:
        latest_platform_payment = booking.payments.filter(
            provider=BookingPayment.Provider.STRIPE_CONNECT,
            status__in=(BookingPayment.Status.AUTHORIZED, BookingPayment.Status.CAPTURED),
        ).order_by("-created_at").first()

        refund_provider = (
            BookingPayment.Provider.STRIPE_CONNECT
            if booking.payment_collection_method == Booking.PaymentCollectionMethod.PLATFORM
            else BookingPayment.Provider.MANUAL
        )

        if booking.payment_collection_method == Booking.PaymentCollectionMethod.PLATFORM and get_stripe_connect_config().enabled:
            if not latest_platform_payment or not booking.provider_charge_id:
                booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
                booking.payout_blocked_reason = "Remboursement à vérifier manuellement auprès du support."
                record_booking_event(
                    booking=booking,
                    actor_role=initiated_by,
                    actor_user=actor_user,
                    event_type="payment.refund_pending_manual_review",
                    message="L'annulation est enregistrée, mais le remboursement doit être vérifié manuellement.",
                    metadata={"refund_amount_eur": str(refund_amount)},
                )
                return booking

            try:
                refund = create_refund(
                    charge_id=booking.provider_charge_id,
                    amount_eur=refund_amount,
                    idempotency_key=f"refund-{booking.id}",
                )
            except StripeConnectError as exc:
                booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
                booking.payout_blocked_reason = "Remboursement en attente de reprise manuelle."
                record_booking_event(
                    booking=booking,
                    actor_role=initiated_by,
                    actor_user=actor_user,
                    event_type="payment.refund_failed",
                    message="L'annulation est enregistrée, mais le remboursement n'a pas encore été confirmé.",
                    metadata={
                        "refund_amount_eur": str(refund_amount),
                        "provider_error": str(exc),
                    },
                )
                return booking

            booking.provider_refund_id = refund.get("id", booking.provider_refund_id)

        booking.amount_refunded_eur = quantize_eur(booking.amount_refunded_eur + refund_amount)
        booking.amount_received_eur = quantize_eur(max(ZERO_EUR, booking.amount_received_eur - refund_amount))
        booking.amount_remaining_eur = ZERO_EUR
        booking.payment_status = (
            Booking.PaymentStatus.REFUNDED
            if booking.amount_received_eur <= ZERO_EUR
            else Booking.PaymentStatus.PARTIALLY_REFUNDED
        )
        booking.refund_decision_source = refund_decision_source
        booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
        booking.payout_blocked_reason = "Remboursement décidé avant versement."
        booking.provider_refund_id = booking.provider_refund_id or f"pending_refund_{booking.id.hex[:12]}"

        existing_refund = booking.payments.filter(
            kind=BookingPayment.Kind.REFUND,
            amount_eur=refund_amount,
            provider_refund_id=booking.provider_refund_id,
        ).exists()
        if not existing_refund:
            BookingPayment.objects.create(
                booking=booking,
                kind=BookingPayment.Kind.REFUND,
                status=BookingPayment.Status.REFUNDED,
                provider=refund_provider,
                amount_eur=refund_amount,
                currency="eur",
                provider_refund_id=booking.provider_refund_id,
                recorded_by_role=initiated_by,
            )
        record_booking_event(
            booking=booking,
            actor_role=initiated_by,
            actor_user=actor_user,
            event_type=(
                "payment.refunded"
                if booking.payment_status == Booking.PaymentStatus.REFUNDED
                else "payment.partially_refunded"
            ),
            message=(
                "Le règlement a été remboursé."
                if booking.payment_status == Booking.PaymentStatus.REFUNDED
                else "Une partie du règlement a été remboursée."
            ),
            metadata={"refund_amount_eur": str(refund_amount)},
        )
        logger.info(
            "booking.payment.refunded",
            extra={
                "booking_id": str(booking.id),
                "refund_amount_eur": str(refund_amount),
                "refund_id": booking.provider_refund_id,
            },
        )
        return booking

    booking.amount_remaining_eur = ZERO_EUR
    booking.payment_status = Booking.PaymentStatus.PAYMENT_CAPTURED
    booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
    booking.payout_blocked_reason = "Annulation tardive : règlement conservé."
    record_booking_event(
        booking=booking,
        actor_role=initiated_by,
        actor_user=actor_user,
        event_type="payment.kept_after_deadline",
        message="Le règlement est conservé après le délai d'annulation.",
    )
    return booking


def mark_booking_as_arrived(*, booking: Booking, actor_user=None):
    _assert_confirmed_booking(booking)
    if booking.fulfillment_status != Booking.FulfillmentStatus.SCHEDULED:
        raise ValidationError("Le client ne peut être marqué comme arrivé qu'une seule fois.")
    booking.fulfillment_status = Booking.FulfillmentStatus.CLIENT_ARRIVED
    booking.client_arrived_at = timezone.now()
    booking.save(update_fields=["fulfillment_status", "client_arrived_at", "updated_at"])
    record_booking_event(
        booking=booking,
        actor_role=Booking.ActorRole.PRACTITIONER,
        actor_user=actor_user,
        event_type="fulfillment.client_arrived",
        message="Le client a été marqué comme arrivé.",
    )
    logger.info("booking.fulfillment.client_arrived", extra={"booking_id": str(booking.id)})
    return booking


def mark_booking_in_progress(*, booking: Booking, actor_user=None):
    _assert_confirmed_booking(booking)
    if booking.fulfillment_status != Booking.FulfillmentStatus.CLIENT_ARRIVED:
        raise ValidationError("La prestation peut démarrer une fois le client arrivé.")
    booking.fulfillment_status = Booking.FulfillmentStatus.IN_PROGRESS
    booking.service_started_at = timezone.now()
    booking.save(update_fields=["fulfillment_status", "service_started_at", "updated_at"])
    record_booking_event(
        booking=booking,
        actor_role=Booking.ActorRole.PRACTITIONER,
        actor_user=actor_user,
        event_type="fulfillment.started",
        message="La prestation a été marquée comme commencée.",
    )
    logger.info("booking.fulfillment.started", extra={"booking_id": str(booking.id)})
    return booking


def generate_client_action_token(*, booking: Booking, purpose: str) -> str:
    signer = signing.TimestampSigner(salt=f"nuadyx-{purpose}")
    return signer.sign(str(booking.id))


def verify_client_action_token(*, booking: Booking, purpose: str, token: str, max_age_hours: int = 168) -> bool:
    signer = signing.TimestampSigner(salt=f"nuadyx-{purpose}")
    try:
        unsigned = signer.unsign(token, max_age=max_age_hours * 3600)
    except signing.BadSignature:
        return False
    return unsigned == str(booking.id)


def mark_booking_service_completed(*, booking: Booking, actor_user=None):
    _assert_confirmed_booking(booking)
    if booking.fulfillment_status != Booking.FulfillmentStatus.IN_PROGRESS:
        raise ValidationError("La prestation doit être commencée avant d'être marquée comme terminée.")
    booking.fulfillment_status = Booking.FulfillmentStatus.COMPLETED_BY_PRACTITIONER
    booking.service_completed_at = timezone.now()
    booking.service_validation_requested_at = timezone.now()
    booking.save(
        update_fields=[
            "fulfillment_status",
            "service_completed_at",
            "service_validation_requested_at",
            "updated_at",
        ]
    )
    record_booking_event(
        booking=booking,
        actor_role=Booking.ActorRole.PRACTITIONER,
        actor_user=actor_user,
        event_type="fulfillment.completed_by_practitioner",
        message="La prestation a été marquée comme terminée. La validation client peut être demandée.",
    )
    logger.info("booking.fulfillment.completed_by_practitioner", extra={"booking_id": str(booking.id)})
    return booking


def report_booking_issue(*, booking: Booking, reason: str, actor_role: str, actor_user=None):
    _assert_not_canceled(booking)
    if booking.fulfillment_status in {
        Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
        Booking.FulfillmentStatus.AUTO_COMPLETED,
    }:
        raise ValidationError("Cette prestation a déjà été validée et ne peut plus être signalée.")

    if booking.fulfillment_status == Booking.FulfillmentStatus.DISPUTED:
        raise ValidationError("Un signalement est déjà ouvert sur cette réservation.")

    booking.fulfillment_status = Booking.FulfillmentStatus.DISPUTED
    booking.issue_opened_at = timezone.now()
    booking.issue_opened_by_role = actor_role
    booking.issue_reason = reason
    booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
    booking.payout_blocked_reason = "Versement bloqué en attendant l'examen du signalement."
    booking.save(
        update_fields=[
            "fulfillment_status",
            "issue_opened_at",
            "issue_opened_by_role",
            "issue_reason",
            "payout_status",
            "payout_blocked_reason",
            "updated_at",
        ]
    )
    record_booking_event(
        booking=booking,
        actor_role=actor_role,
        actor_user=actor_user,
        event_type="fulfillment.disputed",
        message="Un signalement a été ouvert sur cette réservation.",
        metadata={"reason": reason},
    )
    IncidentReport.objects.create(
        booking=booking,
        reporter_type=(
            IncidentReport.ReporterType.CLIENT
            if actor_role == Booking.ActorRole.CLIENT
            else IncidentReport.ReporterType.PRACTITIONER
        ),
        reported_party_type=(
            IncidentReport.ReportedPartyType.PRACTITIONER
            if actor_role == Booking.ActorRole.CLIENT
            else IncidentReport.ReportedPartyType.CLIENT
        ),
        category="post_service_issue",
        description=reason,
        severity=IncidentReport.Severity.HIGH,
        payout_frozen=True,
    )
    if actor_role == Booking.ActorRole.CLIENT:
        RiskRegisterEntry.objects.create(
            subject_type=RiskRegisterEntry.SubjectType.PRACTITIONER,
            professional=booking.professional,
            booking=booking,
            risk_level=RiskRegisterEntry.RiskLevel.MEDIUM,
            practitioner_trust_status=RiskRegisterEntry.PractitionerTrustStatus.WATCH,
            reason="Signalement client sur une prestation.",
            details=reason,
        )
    logger.warning(
        "booking.fulfillment.disputed",
        extra={"booking_id": str(booking.id), "actor_role": actor_role},
    )
    return booking


def mark_booking_no_show(*, booking: Booking, absent_role: str, actor_user=None, reason: str = ""):
    _assert_not_canceled(booking)
    if absent_role not in {Booking.ActorRole.CLIENT, Booking.ActorRole.PRACTITIONER}:
        raise ValidationError("Le rôle indiqué pour l'absence est invalide.")

    booking.status = Booking.Status.CANCELED
    booking.fulfillment_status = Booking.FulfillmentStatus.DISPUTED
    booking.issue_opened_at = timezone.now()
    booking.issue_opened_by_role = absent_role
    booking.issue_reason = reason or (
        "Le client a été signalé absent."
        if absent_role == Booking.ActorRole.CLIENT
        else "Le praticien a été signalé absent."
    )
    booking.canceled_by_role = absent_role
    booking.cancellation_reason = booking.issue_reason
    booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
    booking.payout_blocked_reason = "Versement bloqué en attendant l'examen de l'absence signalée."
    if absent_role == Booking.ActorRole.CLIENT:
        booking.client_no_show_at = timezone.now()
    else:
        booking.practitioner_no_show_at = timezone.now()
        booking = apply_cancellation_payment_outcome(
            booking=booking,
            initiated_by=Booking.ActorRole.PRACTITIONER,
            reason=booking.issue_reason,
            actor_user=actor_user,
            refund_decision_source=Booking.RefundDecisionSource.MANUAL_PRACTITIONER,
        )
    booking.save(
        update_fields=[
            "status",
            "fulfillment_status",
            "issue_opened_at",
            "issue_opened_by_role",
            "issue_reason",
            "canceled_by_role",
            "cancellation_reason",
            "payment_status",
            "amount_received_eur",
            "amount_remaining_eur",
            "amount_refunded_eur",
            "refund_decision_source",
            "provider_refund_id",
            "payout_status",
            "payout_blocked_reason",
            "client_no_show_at",
            "practitioner_no_show_at",
            "updated_at",
        ]
    )
    record_booking_event(
        booking=booking,
        actor_role=Booking.ActorRole.PRACTITIONER,
        actor_user=actor_user,
        event_type="booking.no_show",
        message=booking.issue_reason,
        metadata={"absent_role": absent_role},
    )
    IncidentReport.objects.create(
        booking=booking,
        reporter_type=IncidentReport.ReporterType.PRACTITIONER,
        reported_party_type=(
            IncidentReport.ReportedPartyType.CLIENT
            if absent_role == Booking.ActorRole.CLIENT
            else IncidentReport.ReportedPartyType.PRACTITIONER
        ),
        category=(
            "client_no_show"
            if absent_role == Booking.ActorRole.CLIENT
            else "practitioner_no_show"
        ),
        description=booking.issue_reason,
        severity=IncidentReport.Severity.HIGH,
        payout_frozen=True,
    )
    if absent_role == Booking.ActorRole.CLIENT:
        RiskRegisterEntry.objects.create(
            subject_type=RiskRegisterEntry.SubjectType.CLIENT_EMAIL,
            booking=booking,
            client_email=booking.client_email,
            client_phone=booking.client_phone,
            risk_level=RiskRegisterEntry.RiskLevel.MEDIUM,
            booking_restriction_status=RiskRegisterEntry.BookingRestrictionStatus.REVIEW_REQUIRED,
            reason="Absence client signalée.",
            details=booking.issue_reason,
        )
    else:
        RiskRegisterEntry.objects.create(
            subject_type=RiskRegisterEntry.SubjectType.PRACTITIONER,
            professional=booking.professional,
            booking=booking,
            risk_level=RiskRegisterEntry.RiskLevel.HIGH,
            practitioner_trust_status=RiskRegisterEntry.PractitionerTrustStatus.RESTRICTED,
            reason="Absence praticien signalée.",
            details=booking.issue_reason,
        )
    logger.warning(
        "booking.no_show.recorded",
        extra={"booking_id": str(booking.id), "absent_role": absent_role},
    )
    return booking


def _mark_payout_ready_or_release(booking: Booking):
    if booking.payout_status == Booking.PayoutStatus.PAYOUT_RELEASED:
        return booking

    if booking.payment_collection_method != Booking.PaymentCollectionMethod.PLATFORM:
        booking.payout_status = Booking.PayoutStatus.NOT_APPLICABLE
        return booking

    payment_account = getattr(booking.professional, "payment_account", None)
    if not payment_account or not payment_account.stripe_account_id:
        booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
        booking.payout_blocked_reason = "Compte de paiement praticien non connecté."
        return booking

    if not payment_account.charges_enabled or not payment_account.payouts_enabled:
        booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
        booking.payout_blocked_reason = "Le compte de paiement praticien n'est pas encore entièrement activé."
        return booking

    booking.payout_status = Booking.PayoutStatus.PAYOUT_READY
    booking.payout_ready_at = timezone.now()

    if get_stripe_connect_config().enabled and booking.payout_amount_eur > ZERO_EUR:
        if booking.provider_transfer_id:
            booking.payout_status = Booking.PayoutStatus.PAYOUT_RELEASED
            return booking
        try:
            transfer = create_transfer(
                stripe_account_id=payment_account.stripe_account_id,
                amount_eur=booking.payout_amount_eur,
                booking_id=str(booking.id),
                idempotency_key=f"transfer-{booking.id}",
            )
            booking.provider_transfer_id = transfer.get("id", booking.provider_transfer_id)
            booking.provider_payout_id = transfer.get("destination_payment", booking.provider_payout_id)
            booking.payout_status = Booking.PayoutStatus.PAYOUT_RELEASED
            booking.payout_released_at = timezone.now()
            BookingPayment.objects.create(
                booking=booking,
                kind=BookingPayment.Kind.PAYOUT,
                status=BookingPayment.Status.RELEASED,
                provider=BookingPayment.Provider.STRIPE_CONNECT,
                amount_eur=booking.payout_amount_eur,
                currency="eur",
                provider_transfer_id=booking.provider_transfer_id,
                provider_payout_id=booking.provider_payout_id,
                recorded_by_role=Booking.ActorRole.SYSTEM,
            )
        except StripeConnectError:
            booking.payout_status = Booking.PayoutStatus.PAYOUT_READY
    return booking


def validate_client_service_completion(*, booking: Booking, actor_role: str = Booking.ActorRole.CLIENT, actor_user=None, automatic: bool = False):
    if booking.fulfillment_status in {
        Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
        Booking.FulfillmentStatus.AUTO_COMPLETED,
    }:
        raise ValidationError("La prestation a déjà été validée.")

    if booking.fulfillment_status == Booking.FulfillmentStatus.DISPUTED:
        raise ValidationError("Cette réservation est en cours d'examen et ne peut pas être validée.")

    if booking.fulfillment_status != Booking.FulfillmentStatus.COMPLETED_BY_PRACTITIONER:
        raise ValidationError("La validation client est disponible après la fin déclarée de la prestation.")

    if automatic:
        booking.fulfillment_status = Booking.FulfillmentStatus.AUTO_COMPLETED
        booking.auto_completed_at = timezone.now()
    else:
        booking.fulfillment_status = Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT
        booking.client_validated_at = timezone.now()

    booking = _mark_payout_ready_or_release(booking)
    booking.save(
        update_fields=[
            "fulfillment_status",
            "auto_completed_at",
            "client_validated_at",
            "payout_status",
            "payout_ready_at",
            "payout_released_at",
            "provider_transfer_id",
            "provider_payout_id",
            "payout_blocked_reason",
            "updated_at",
        ]
    )
    record_booking_event(
        booking=booking,
        actor_role=actor_role,
        actor_user=actor_user,
        event_type="fulfillment.validated",
        message=(
            "La prestation a été validée automatiquement."
            if automatic
            else "La prestation a été validée par le client."
        ),
    )
    return booking


def evaluate_post_service_release(booking: Booking):
    if booking.fulfillment_status != Booking.FulfillmentStatus.COMPLETED_BY_PRACTITIONER:
        return booking

    reference_time = booking.service_validation_requested_at or booking.service_completed_at
    if not reference_time:
        return booking

    if timezone.now() < reference_time + timedelta(hours=_auto_release_hours()):
        return booking

    return validate_client_service_completion(booking=booking, actor_role=Booking.ActorRole.SYSTEM, automatic=True)


def reconcile_booking_payout(booking: Booking) -> Booking:
    if booking.payment_collection_method != Booking.PaymentCollectionMethod.PLATFORM:
        return booking
    if booking.fulfillment_status not in {
        Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
        Booking.FulfillmentStatus.AUTO_COMPLETED,
    }:
        return booking
    if booking.payout_status == Booking.PayoutStatus.PAYOUT_RELEASED:
        return booking

    previous_status = booking.payout_status
    booking = _mark_payout_ready_or_release(booking)
    booking.save(
        update_fields=[
            "payout_status",
            "payout_ready_at",
            "payout_released_at",
            "provider_transfer_id",
            "provider_payout_id",
            "payout_blocked_reason",
            "updated_at",
        ]
    )
    if booking.payout_status != previous_status:
        logger.info(
            "booking.payout.reconciled",
            extra={
                "booking_id": str(booking.id),
                "previous_status": previous_status,
                "new_status": booking.payout_status,
            },
        )
    return booking


def process_overdue_service_validations(*, now=None) -> int:
    reference_time = now or timezone.now()
    cutoff = reference_time - timedelta(hours=_auto_release_hours())
    bookings = Booking.objects.filter(
        fulfillment_status=Booking.FulfillmentStatus.COMPLETED_BY_PRACTITIONER,
        service_validation_requested_at__lte=cutoff,
    ).exclude(status=Booking.Status.CANCELED)
    processed = 0
    for booking in bookings:
        try:
            evaluate_post_service_release(booking)
            processed += 1
        except ValidationError:
            continue
    return processed


def process_releasable_payouts() -> int:
    bookings = Booking.objects.filter(
        payment_collection_method=Booking.PaymentCollectionMethod.PLATFORM,
        fulfillment_status__in=(
            Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
            Booking.FulfillmentStatus.AUTO_COMPLETED,
        ),
        payout_status__in=(
            Booking.PayoutStatus.PAYOUT_PENDING,
            Booking.PayoutStatus.PAYOUT_READY,
            Booking.PayoutStatus.PAYOUT_BLOCKED,
        ),
    ).exclude(status=Booking.Status.CANCELED)
    processed = 0
    for booking in bookings:
        previous_status = booking.payout_status
        reconcile_booking_payout(booking)
        if booking.payout_status != previous_status:
            processed += 1
    return processed


def audit_and_optionally_fix_booking_anomalies(*, fix=False, now=None) -> list[dict]:
    reference_time = now or timezone.now()
    anomalies: list[dict] = []
    bookings = Booking.objects.select_related("professional").all()
    for booking in bookings:
        if (
            booking.payment_collection_method == Booking.PaymentCollectionMethod.PLATFORM
            and booking.payment_status in {
                Booking.PaymentStatus.PAYMENT_REQUIRED,
                Booking.PaymentStatus.DEPOSIT_REQUIRED,
                Booking.PaymentStatus.PAYMENT_PENDING,
                Booking.PaymentStatus.PAYMENT_AUTHORIZED,
            }
            and not booking.payment_due_expires_at
        ):
            anomalies.append({"booking_id": str(booking.id), "issue": "missing_payment_due_expiry"})
            if fix:
                booking.payment_due_expires_at = reference_time + timedelta(minutes=_payment_hold_minutes())
                booking.save(update_fields=["payment_due_expires_at", "updated_at"])

        if (
            booking.fulfillment_status == Booking.FulfillmentStatus.DISPUTED
            and booking.payout_status != Booking.PayoutStatus.PAYOUT_BLOCKED
        ):
            anomalies.append({"booking_id": str(booking.id), "issue": "dispute_without_blocked_payout"})
            if fix:
                booking.payout_status = Booking.PayoutStatus.PAYOUT_BLOCKED
                booking.payout_blocked_reason = "Versement bloqué en attendant le traitement du signalement."
                booking.save(update_fields=["payout_status", "payout_blocked_reason", "updated_at"])

        if (
            booking.payout_status == Booking.PayoutStatus.PAYOUT_RELEASED
            and booking.payment_collection_method == Booking.PaymentCollectionMethod.PLATFORM
            and not booking.provider_transfer_id
        ):
            anomalies.append({"booking_id": str(booking.id), "issue": "released_payout_without_transfer_id"})

        if (
            booking.payment_status == Booking.PaymentStatus.REFUNDED
            and booking.amount_refunded_eur <= ZERO_EUR
        ):
            anomalies.append({"booking_id": str(booking.id), "issue": "refunded_without_refund_amount"})

    for anomaly in anomalies:
        logger.warning("booking.anomaly.detected", extra=anomaly)
    return anomalies


def get_public_payment_summary(*, professional: ProfessionalProfile, total_price: Decimal, trusted_client: TrustedClient | None = None):
    terms = calculate_booking_payment_terms(
        professional=professional,
        total_price=total_price,
        trusted_client=trusted_client,
    )
    payment_mode = terms["payment_mode"]

    if terms["trust_exemption_applied"]:
        title = "Réservation sans acompte pour ce client connu"
        description = "Ce rendez-vous peut être confirmé sans règlement immédiat."
    elif payment_mode == ProfessionalProfile.ReservationPaymentMode.NONE:
        title = "Aucun paiement demandé à la réservation"
        description = "Le règlement se fait directement avec le praticien."
    elif payment_mode == ProfessionalProfile.ReservationPaymentMode.FULL:
        title = "Règlement complet demandé à la réservation"
        description = "Le montant est sécurisé sur la plateforme avant la séance."
    else:
        title = "Acompte demandé pour réserver ce créneau"
        description = "L’acompte sécurise le créneau. Le reste éventuel se règle ensuite selon vos conditions."

    return {
        **terms,
        "payment_title": title,
        "payment_description": description,
        "cancellation_summary": build_cancellation_policy_summary(professional),
    }


def build_cancellation_policy_summary(professional: ProfessionalProfile):
    prefix = f"Annulation sans frais jusqu’à {professional.free_cancellation_notice_hours} h avant le rendez-vous."

    if professional.reservation_payment_mode == ProfessionalProfile.ReservationPaymentMode.NONE:
        return prefix

    if professional.keep_payment_after_deadline:
        if professional.reservation_payment_mode == ProfessionalProfile.ReservationPaymentMode.FULL:
            suffix = "Passé ce délai, le règlement peut être conservé selon les conditions annoncées."
        else:
            suffix = "Passé ce délai, l’acompte peut être conservé."
    else:
        suffix = "Passé ce délai, le remboursement est étudié selon la situation."

    return f"{prefix} {suffix}"
