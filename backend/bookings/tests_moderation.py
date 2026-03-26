from decimal import Decimal
import datetime as dt

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from bookings.models import AccountRestriction, AvailabilitySlot, Booking, IncidentReport
from professionals.models import ProfessionalPaymentAccount, ProfessionalProfile
from services.models import MassageService


class ModerationAndClientRestrictionTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin-moderation@example.com",
            username="admin-moderation",
            password="Password123!",
            role=User.Role.ADMIN,
        )
        self.practitioner_user = User.objects.create_user(
            email="pro-moderation@example.com",
            username="pro-moderation",
            password="Password123!",
            role=User.Role.PROFESSIONAL,
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.practitioner_user,
            business_name="Cabinet Modération",
            slug="cabinet-moderation",
            is_public=True,
            accepts_online_booking=True,
            reservation_payment_mode=ProfessionalProfile.ReservationPaymentMode.NONE,
        )
        ProfessionalPaymentAccount.objects.create(
            professional=self.profile,
            account_email=self.practitioner_user.email,
        )
        self.service = MassageService.objects.create(
            professional=self.profile,
            title="Massage Signature",
            short_description="Un soin test",
            duration_minutes=60,
            price_eur=Decimal("80.00"),
            is_active=True,
        )
        self.slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + dt.timedelta(days=3),
            end_at=timezone.now() + dt.timedelta(days=3, hours=1),
            is_active=True,
        )
        self.free_slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=timezone.now() + dt.timedelta(days=4),
            end_at=timezone.now() + dt.timedelta(days=4, hours=1),
            is_active=True,
        )
        self.booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=self.slot,
            client_first_name="Lina",
            client_last_name="Durand",
            client_email="client-risk@example.com",
            status=Booking.Status.CONFIRMED,
            total_price_eur=Decimal("80.00"),
            amount_due_now_eur=Decimal("0.00"),
            amount_remaining_eur=Decimal("80.00"),
        )
        self.incident = IncidentReport.objects.create(
            booking=self.booking,
            reporter_type=IncidentReport.ReporterType.CLIENT,
            reported_party_type=IncidentReport.ReportedPartyType.PRACTITIONER,
            category="praticien_absent",
            description="Le praticien ne s'est pas présenté au rendez-vous.",
            severity=IncidentReport.Severity.HIGH,
        )

    def test_admin_decision_creates_restriction(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/admin/moderation/incidents/{self.incident.id}/decide",
            {
                "decision_type": "suspend",
                "notes": "Suspension le temps de vérifier plusieurs signalements similaires.",
                "duration_days": 14,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.incident.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual(self.incident.status, IncidentReport.Status.RESOLVED)
        self.assertFalse(self.profile.accepts_online_booking)
        self.assertTrue(
            AccountRestriction.objects.filter(
                professional=self.profile,
                restriction_type=AccountRestriction.RestrictionType.ACCOUNT_SUSPENDED,
            ).exists()
        )

    def test_blocked_client_email_cannot_start_guest_booking(self):
        AccountRestriction.objects.create(
            subject_type=AccountRestriction.SubjectType.CLIENT_EMAIL,
            restriction_type=AccountRestriction.RestrictionType.BOOKING_BLOCKED,
            client_email="blocked-client@example.com",
            reason="No-show répétés",
        )
        response = self.client.post(
            "/api/bookings/",
            {
                "professional_slug": self.profile.slug,
                "service_id": str(self.service.id),
                "slot_id": str(self.free_slot.id),
                "client_first_name": "Client",
                "client_last_name": "Bloqué",
                "client_email": "blocked-client@example.com",
                "client_phone": "0600000000",
                "client_note": "",
                "accept_cgu": True,
                "accept_cgv": True,
                "accept_cancellation_policy": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("réservation", str(response.data).lower())
