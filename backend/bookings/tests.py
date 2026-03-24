import hashlib
import hmac
import json
from io import StringIO
from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from accounts.models import User
from professionals.models import ProfessionalPaymentAccount, ProfessionalProfile
from services.models import MassageService

from .models import AvailabilitySlot, Booking, BookingPayment, PaymentWebhookEventLog
from .payments import (
    apply_cancellation_payment_outcome,
    audit_and_optionally_fix_booking_anomalies,
    calculate_booking_payment_terms,
    expire_stale_payment_holds,
    generate_client_action_token,
    mark_booking_payment_captured,
    mark_booking_service_completed,
    process_overdue_service_validations,
    process_releasable_payouts,
    record_booking_payment_request,
    validate_client_service_completion,
)


class BookingLogicTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="pro@example.com",
            username="pro",
            password="secret123",
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Nuadyx",
            slug="cabinet-nuadyx",
            is_public=True,
            accepts_online_booking=True,
        )
        self.service = MassageService.objects.create(
            professional=self.profile,
            title="Massage relaxant",
            short_description="Séance de détente profonde",
            duration_minutes=60,
            price_eur="90.00",
        )
        self.start_at = timezone.now() + timedelta(days=1)
        self.end_at = self.start_at + timedelta(hours=1)

    def test_overlapping_slots_are_rejected(self):
        AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=self.start_at,
            end_at=self.end_at,
        )

        with self.assertRaises(ValidationError):
            AvailabilitySlot.objects.create(
                professional=self.profile,
                start_at=self.start_at + timedelta(minutes=30),
                end_at=self.end_at + timedelta(minutes=30),
            )

    def test_only_one_active_booking_per_slot(self):
        slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=self.start_at,
            end_at=self.end_at,
        )

        Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Alice",
            client_last_name="Martin",
            client_email="alice@example.com",
            status=Booking.Status.PENDING,
        )

        with self.assertRaises(ValidationError):
            Booking.objects.create(
                professional=self.profile,
                service=self.service,
                slot=slot,
                client_first_name="Bob",
                client_last_name="Durand",
                client_email="bob@example.com",
                status=Booking.Status.CONFIRMED,
            )

    def test_canceled_booking_frees_slot_for_new_request(self):
        slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=self.start_at,
            end_at=self.end_at,
        )

        booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Alice",
            client_last_name="Martin",
            client_email="alice@example.com",
            status=Booking.Status.PENDING,
        )
        booking.status = Booking.Status.CANCELED
        booking.save()

        replacement = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Bob",
            client_last_name="Durand",
            client_email="bob@example.com",
            status=Booking.Status.PENDING,
        )

        self.assertEqual(replacement.slot_id, slot.id)


class BookingPaymentLogicTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="pro-payments@example.com",
            username="pro-payments",
            password="secret123",
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Nuadyx",
            slug="cabinet-nuadyx-payments",
            is_public=True,
            accepts_online_booking=True,
        )
        self.service = MassageService.objects.create(
            professional=self.profile,
            title="Massage signature",
            short_description="Séance profonde et sur mesure",
            duration_minutes=90,
            price_eur="120.00",
        )

    def test_no_payment_mode_keeps_full_amount_for_on_site_payment(self):
        terms = calculate_booking_payment_terms(
            professional=self.profile,
            total_price=self.service.price_eur,
        )

        self.assertEqual(terms["payment_status"], Booking.PaymentStatus.NONE_REQUIRED)
        self.assertEqual(terms["amount_due_now_eur"], Decimal("0.00"))
        self.assertEqual(terms["amount_received_eur"], Decimal("0.00"))
        self.assertEqual(terms["amount_remaining_eur"], Decimal("120.00"))

    def test_fixed_deposit_is_calculated_correctly(self):
        self.profile.reservation_payment_mode = ProfessionalProfile.ReservationPaymentMode.DEPOSIT
        self.profile.deposit_value_type = ProfessionalProfile.DepositValueType.FIXED
        self.profile.deposit_value = Decimal("35.00")
        self.profile.save()

        terms = calculate_booking_payment_terms(
            professional=self.profile,
            total_price=self.service.price_eur,
        )

        self.assertEqual(terms["payment_status"], Booking.PaymentStatus.DEPOSIT_REQUIRED)
        self.assertEqual(terms["amount_due_now_eur"], Decimal("35.00"))
        self.assertEqual(terms["amount_received_eur"], Decimal("0.00"))
        self.assertEqual(terms["amount_remaining_eur"], Decimal("85.00"))

    def test_percentage_deposit_is_calculated_correctly(self):
        self.profile.reservation_payment_mode = ProfessionalProfile.ReservationPaymentMode.DEPOSIT
        self.profile.deposit_value_type = ProfessionalProfile.DepositValueType.PERCENTAGE
        self.profile.deposit_value = Decimal("30.00")
        self.profile.save()

        terms = calculate_booking_payment_terms(
            professional=self.profile,
            total_price=self.service.price_eur,
        )

        self.assertEqual(terms["payment_status"], Booking.PaymentStatus.DEPOSIT_REQUIRED)
        self.assertEqual(terms["amount_due_now_eur"], Decimal("36.00"))
        self.assertEqual(terms["amount_received_eur"], Decimal("0.00"))
        self.assertEqual(terms["amount_remaining_eur"], Decimal("84.00"))

    def test_full_payment_mode_marks_booking_as_payment_required(self):
        self.profile.reservation_payment_mode = ProfessionalProfile.ReservationPaymentMode.FULL
        self.profile.save()

        terms = calculate_booking_payment_terms(
            professional=self.profile,
            total_price=self.service.price_eur,
        )

        self.assertEqual(terms["payment_status"], Booking.PaymentStatus.PAYMENT_REQUIRED)
        self.assertEqual(terms["amount_due_now_eur"], Decimal("120.00"))
        self.assertEqual(terms["amount_received_eur"], Decimal("0.00"))
        self.assertEqual(terms["amount_remaining_eur"], Decimal("0.00"))

    def test_cancel_before_deadline_refunds_deposit(self):
        self.profile.reservation_payment_mode = ProfessionalProfile.ReservationPaymentMode.DEPOSIT
        self.profile.deposit_value_type = ProfessionalProfile.DepositValueType.FIXED
        self.profile.deposit_value = Decimal("30.00")
        self.profile.free_cancellation_notice_hours = 24
        self.profile.keep_payment_after_deadline = True
        self.profile.save()

        slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + timedelta(days=2),
            end_at=timezone.now() + timedelta(days=2, minutes=90),
        )
        booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Lina",
            client_last_name="Martin",
            client_email="lina@example.com",
            status=Booking.Status.PENDING,
            **calculate_booking_payment_terms(
                professional=self.profile,
                total_price=self.service.price_eur,
            ),
        )
        record_booking_payment_request(booking)
        updated_booking = mark_booking_payment_captured(booking, payment_intent_id="pi_test", charge_id="ch_test")
        updated_booking = apply_cancellation_payment_outcome(
            booking=updated_booking,
            initiated_by=Booking.ActorRole.CLIENT,
        )

        self.assertEqual(updated_booking.payment_status, Booking.PaymentStatus.REFUNDED)
        self.assertEqual(updated_booking.amount_refunded_eur, Decimal("30.00"))
        self.assertEqual(updated_booking.amount_received_eur, Decimal("0.00"))
        self.assertEqual(updated_booking.amount_remaining_eur, Decimal("0.00"))
        self.assertEqual(booking.payments.count(), 2)

    def test_cancel_after_deadline_keeps_deposit(self):
        self.profile.reservation_payment_mode = ProfessionalProfile.ReservationPaymentMode.DEPOSIT
        self.profile.deposit_value_type = ProfessionalProfile.DepositValueType.FIXED
        self.profile.deposit_value = Decimal("30.00")
        self.profile.free_cancellation_notice_hours = 24
        self.profile.keep_payment_after_deadline = True
        self.profile.save()

        slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + timedelta(hours=2),
            end_at=timezone.now() + timedelta(hours=3, minutes=30),
        )
        booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Lina",
            client_last_name="Martin",
            client_email="lina@example.com",
            status=Booking.Status.PENDING,
            **calculate_booking_payment_terms(
                professional=self.profile,
                total_price=self.service.price_eur,
            ),
        )
        record_booking_payment_request(booking)
        updated_booking = mark_booking_payment_captured(booking, payment_intent_id="pi_test", charge_id="ch_test")
        updated_booking = apply_cancellation_payment_outcome(
            booking=updated_booking,
            initiated_by=Booking.ActorRole.CLIENT,
        )

        self.assertEqual(updated_booking.payment_status, Booking.PaymentStatus.PAYMENT_CAPTURED)
        self.assertEqual(updated_booking.amount_refunded_eur, Decimal("0.00"))
        self.assertEqual(updated_booking.amount_received_eur, Decimal("30.00"))
        self.assertEqual(updated_booking.amount_remaining_eur, Decimal("0.00"))
        self.assertEqual(booking.payments.count(), 1)

    def test_payment_capture_is_idempotent(self):
        self.profile.reservation_payment_mode = ProfessionalProfile.ReservationPaymentMode.DEPOSIT
        self.profile.deposit_value_type = ProfessionalProfile.DepositValueType.FIXED
        self.profile.deposit_value = Decimal("30.00")
        self.profile.save()

        slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + timedelta(days=1),
            end_at=timezone.now() + timedelta(days=1, minutes=90),
        )
        booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Lina",
            client_last_name="Martin",
            client_email="lina@example.com",
            status=Booking.Status.PENDING,
            **calculate_booking_payment_terms(
                professional=self.profile,
                total_price=self.service.price_eur,
            ),
        )
        record_booking_payment_request(booking)

        mark_booking_payment_captured(booking, payment_intent_id="pi_test", charge_id="ch_test")
        booking.refresh_from_db()
        first_captured_at = booking.payment_captured_at
        mark_booking_payment_captured(booking, payment_intent_id="pi_test", charge_id="ch_test")
        booking.refresh_from_db()

        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PAYMENT_CAPTURED)
        self.assertEqual(booking.amount_received_eur, Decimal("30.00"))
        self.assertEqual(booking.payment_captured_at, first_captured_at)

    def test_client_validation_cannot_run_twice(self):
        slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + timedelta(days=1),
            end_at=timezone.now() + timedelta(days=1, minutes=90),
        )
        booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Lina",
            client_last_name="Martin",
            client_email="lina@example.com",
            status=Booking.Status.CONFIRMED,
            payment_status=Booking.PaymentStatus.NONE_REQUIRED,
            fulfillment_status=Booking.FulfillmentStatus.IN_PROGRESS,
        )
        booking = mark_booking_service_completed(booking=booking)
        validate_client_service_completion(booking=booking)

        booking.refresh_from_db()
        with self.assertRaises(Exception) as exc_info:
            validate_client_service_completion(booking=booking)
        self.assertIn("déjà été validée", str(exc_info.exception))


class BookingCommunicationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="pro@example.com",
            username="pro",
            password="secret123",
            role=User.Role.PROFESSIONAL,
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Nuadyx",
            slug="cabinet-nuadyx",
            is_public=True,
            accepts_online_booking=True,
        )
        self.service = MassageService.objects.create(
            professional=self.profile,
            title="Massage relaxant",
            short_description="Séance de détente profonde",
            duration_minutes=60,
            price_eur="90.00",
        )
        self.slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + timedelta(days=1),
            end_at=timezone.now() + timedelta(days=1, hours=1),
        )
        self.token = Token.objects.create(user=self.user)

    def test_public_booking_sends_email_to_practitioner(self):
        response = self.client.post(
            "/api/bookings/",
            {
                "professional_slug": self.profile.slug,
                "service_id": str(self.service.id),
                "slot_id": str(self.slot.id),
                "client_first_name": "Alice",
                "client_last_name": "Martin",
                "client_email": "alice@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 2)
        self.assertIn("Nouvelle demande de rendez-vous", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, [self.user.email])

    def test_confirm_and_cancel_send_client_emails(self):
        booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=self.slot,
            client_first_name="Alice",
            client_last_name="Martin",
            client_email="alice@example.com",
            status=Booking.Status.PENDING,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        confirm_response = self.client.post(
            f"/api/dashboard/bookings/{booking.id}/confirm/",
            format="json",
        )
        cancel_response = self.client.post(
            f"/api/dashboard/bookings/{booking.id}/cancel/",
            format="json",
        )

        self.assertEqual(confirm_response.status_code, 200)
        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        self.assertIn("est confirmé", mail.outbox[0].subject)
        self.assertIn("a été annulé", mail.outbox[1].subject)

    def test_public_booking_returns_pending_payment_when_acompte_is_requested(self):
        self.profile.reservation_payment_mode = ProfessionalProfile.ReservationPaymentMode.DEPOSIT
        self.profile.deposit_value_type = ProfessionalProfile.DepositValueType.FIXED
        self.profile.deposit_value = Decimal("30.00")
        self.profile.save()

        successful_response = self.client.post(
            "/api/bookings/",
            {
                "professional_slug": self.profile.slug,
                "service_id": str(self.service.id),
                "slot_id": str(self.slot.id),
                "client_first_name": "Alice",
                "client_last_name": "Martin",
                "client_email": "alice@example.com",
            },
            format="json",
        )

        self.assertEqual(successful_response.status_code, 201)
        self.assertEqual(successful_response.data["payment_status"], Booking.PaymentStatus.PAYMENT_PENDING)
        self.assertEqual(successful_response.data["amount_received_eur"], "0.00")
        self.assertEqual(successful_response.data["amount_remaining_eur"], "60.00")
        self.assertTrue(successful_response.data["checkout_url"])


@override_settings(
    NUADYX_STRIPE_SECRET_KEY="sk_test_123",
    NUADYX_STRIPE_PUBLISHABLE_KEY="pk_test_123",
    NUADYX_STRIPE_WEBHOOK_SECRET="whsec_test_123",
)
class StripeWebhookHardeningTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="stripe-pro@example.com",
            username="stripe-pro",
            password="secret123",
            role=User.Role.PROFESSIONAL,
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Nuadyx",
            slug="cabinet-stripe",
            is_public=True,
            accepts_online_booking=True,
            reservation_payment_mode=ProfessionalProfile.ReservationPaymentMode.DEPOSIT,
            deposit_value_type=ProfessionalProfile.DepositValueType.FIXED,
            deposit_value=Decimal("30.00"),
        )
        self.service = MassageService.objects.create(
            professional=self.profile,
            title="Massage signature",
            short_description="Séance profonde",
            duration_minutes=60,
            price_eur="90.00",
        )
        self.slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + timedelta(days=2),
            end_at=timezone.now() + timedelta(days=2, hours=1),
        )
        self.booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=self.slot,
            client_first_name="Alice",
            client_last_name="Martin",
            client_email="alice@example.com",
            status=Booking.Status.PENDING,
            **calculate_booking_payment_terms(
                professional=self.profile,
                total_price=self.service.price_eur,
            ),
        )
        record_booking_payment_request(self.booking)

    def _signature(self, payload: bytes) -> str:
        timestamp = str(int(timezone.now().timestamp()))
        signed_payload = f"{timestamp}.{payload.decode()}".encode()
        digest = hmac.new(
            b"whsec_test_123",
            signed_payload,
            hashlib.sha256,
        ).hexdigest()
        return f"t={timestamp},v1={digest}"

    def test_duplicate_webhook_is_ignored_after_first_processing(self):
        event = {
            "id": "evt_123",
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_123",
                    "latest_charge": "ch_123",
                    "metadata": {"booking_id": str(self.booking.id)},
                }
            },
        }
        payload = json.dumps(event).encode()
        signature = self._signature(payload)

        first = self.client.post(
            "/api/payments/webhooks/stripe/",
            data=payload,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=signature,
        )
        second = self.client.post(
            "/api/payments/webhooks/stripe/",
            data=payload,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=signature,
        )

        self.booking.refresh_from_db()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(self.booking.payment_status, Booking.PaymentStatus.PAYMENT_CAPTURED)
        self.assertEqual(PaymentWebhookEventLog.objects.count(), 1)


class PublicServiceValidationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="validation-pro@example.com",
            username="validation-pro",
            password="secret123",
            role=User.Role.PROFESSIONAL,
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Nuadyx",
            slug="cabinet-validation",
            is_public=True,
            accepts_online_booking=True,
        )
        self.service = MassageService.objects.create(
            professional=self.profile,
            title="Massage signature",
            short_description="Séance profonde",
            duration_minutes=60,
            price_eur="90.00",
        )
        self.slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + timedelta(days=1),
            end_at=timezone.now() + timedelta(days=1, hours=1),
        )
        self.booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=self.slot,
            client_first_name="Alice",
            client_last_name="Martin",
            client_email="alice@example.com",
            status=Booking.Status.CONFIRMED,
            fulfillment_status=Booking.FulfillmentStatus.IN_PROGRESS,
        )
        self.booking = mark_booking_service_completed(booking=self.booking)
        self.token = generate_client_action_token(
            booking=self.booking,
            purpose="service-validation",
        )

    def test_client_can_report_issue_and_block_payout(self):
        response = self.client.post(
            f"/api/bookings/{self.booking.id}/validate-service/",
            {"token": self.token, "action": "report_issue", "reason": "La séance n’a pas eu lieu."},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.fulfillment_status, Booking.FulfillmentStatus.DISPUTED)
        self.assertEqual(self.booking.payout_status, Booking.PayoutStatus.PAYOUT_BLOCKED)


class BookingMaintenanceCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ops@example.com",
            username="ops-pro",
            password="secret123",
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Ops",
            slug="cabinet-ops",
            is_public=True,
            accepts_online_booking=True,
        )
        self.service = MassageService.objects.create(
            professional=self.profile,
            title="Massage signature",
            short_description="Séance profonde",
            duration_minutes=60,
            price_eur="90.00",
        )

    def test_command_expires_stale_payments(self):
        slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + timedelta(days=1),
            end_at=timezone.now() + timedelta(days=1, hours=1),
        )
        booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Alice",
            client_last_name="Martin",
            client_email="alice@example.com",
            status=Booking.Status.PENDING,
            payment_status=Booking.PaymentStatus.PAYMENT_PENDING,
            payment_collection_method=Booking.PaymentCollectionMethod.PLATFORM,
            payment_due_expires_at=timezone.now() - timedelta(minutes=5),
        )

        out = StringIO()
        call_command("run_booking_maintenance", "--expire-payments", stdout=out)

        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELED)
        self.assertIn("Paiements expirés", out.getvalue())

    def test_command_auto_validates_and_prepares_payout(self):
        slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() - timedelta(days=3),
            end_at=timezone.now() - timedelta(days=3, hours=-1),
        )
        booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Alice",
            client_last_name="Martin",
            client_email="alice@example.com",
            status=Booking.Status.CONFIRMED,
            payment_status=Booking.PaymentStatus.PAYMENT_CAPTURED,
            payment_collection_method=Booking.PaymentCollectionMethod.PLATFORM,
            payout_status=Booking.PayoutStatus.PAYOUT_PENDING,
            fulfillment_status=Booking.FulfillmentStatus.COMPLETED_BY_PRACTITIONER,
            amount_due_now_eur=Decimal("30.00"),
            amount_received_eur=Decimal("30.00"),
            payout_amount_eur=Decimal("27.00"),
            service_validation_requested_at=timezone.now() - timedelta(days=3),
        )
        ProfessionalPaymentAccount.objects.create(
            professional=self.profile,
            stripe_account_id="acct_test_ready",
            charges_enabled=True,
            payouts_enabled=True,
            onboarding_status=ProfessionalPaymentAccount.OnboardingStatus.ACTIVE,
        )

        call_command("run_booking_maintenance", "--auto-validate-services", "--release-payouts")

        booking.refresh_from_db()
        self.assertIn(
            booking.fulfillment_status,
            {
                Booking.FulfillmentStatus.AUTO_COMPLETED,
                Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
            },
        )
        self.assertIn(
            booking.payout_status,
            {
                Booking.PayoutStatus.PAYOUT_READY,
                Booking.PayoutStatus.PAYOUT_RELEASED,
            },
        )

    def test_command_can_fix_simple_anomalies(self):
        slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + timedelta(days=1),
            end_at=timezone.now() + timedelta(days=1, hours=1),
        )
        booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=slot,
            client_first_name="Alice",
            client_last_name="Martin",
            client_email="alice@example.com",
            status=Booking.Status.CONFIRMED,
            fulfillment_status=Booking.FulfillmentStatus.DISPUTED,
            payout_status=Booking.PayoutStatus.PAYOUT_PENDING,
        )

        call_command("run_booking_maintenance", "--audit-anomalies", "--fix-anomalies")

        booking.refresh_from_db()
        self.assertEqual(booking.payout_status, Booking.PayoutStatus.PAYOUT_BLOCKED)


@override_settings(
    NUADYX_STRIPE_SECRET_KEY="",
    NUADYX_STRIPE_PUBLISHABLE_KEY="",
    NUADYX_STRIPE_WEBHOOK_SECRET="",
)
class StripeWebhookConfigurationTests(APITestCase):
    def test_webhook_returns_503_when_not_configured(self):
        response = self.client.post(
            "/api/payments/webhooks/stripe/",
            data=b"{}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 503)
