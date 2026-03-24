from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from bookings.models import AvailabilitySlot, Booking
from professionals.models import ProfessionalProfile
from services.models import MassageService

from .models import Review, ReviewInvitation


class ReviewInvitationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="pro-reviews@example.com",
            username="pro-reviews",
            password="secret123",
            role=User.Role.PROFESSIONAL,
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Nuadyx",
            slug="cabinet-reviews",
            is_public=True,
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_cannot_create_duplicate_active_invitation_for_same_email(self):
        payload = {
            "first_name": "Alice",
            "last_name": "Martin",
            "email": "alice@example.com",
            "source": "manual",
        }

        first = self.client.post("/api/dashboard/review-invitations/", payload, format="json")
        second = self.client.post("/api/dashboard/review-invitations/", payload, format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)


class ReviewSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="pro-reviews-2@example.com",
            username="pro-reviews-2",
            password="secret123",
            role=User.Role.PROFESSIONAL,
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Nuadyx",
            slug="cabinet-reviews-2",
            is_public=True,
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
        )

    def test_review_invitation_token_can_only_be_used_once(self):
        client = APIClient()
        raw_token, token_hash = ReviewInvitation.issue_token()
        invitation = ReviewInvitation.objects.create(
            professional=self.profile,
            booking=self.booking,
            first_name="Alice",
            last_name="Martin",
            email="alice@example.com",
            source=ReviewInvitation.Source.BOOKING,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(days=14),
        )

        first = client.post(
            "/api/reviews/submit/",
            {
                "token": raw_token,
                "author_name": "Alice",
                "rating": 5,
                "comment": "Très belle séance.",
            },
            format="json",
        )
        second = client.post(
            "/api/reviews/submit/",
            {
                "token": raw_token,
                "author_name": "Alice",
                "rating": 5,
                "comment": "Très belle séance.",
            },
            format="json",
        )

        invitation.refresh_from_db()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertTrue(invitation.used_at)
        self.assertEqual(invitation.usage_count, 1)
        self.assertEqual(Review.objects.count(), 1)

    def test_practitioner_can_flag_review_for_verification(self):
        review = Review.objects.create(
            professional=self.profile,
            booking=self.booking,
            invited_customer_email="alice@example.com",
            author_name="Alice",
            rating=3,
            comment="Avis à vérifier",
            status=Review.Status.PUBLISHED,
            verification_type=Review.VerificationType.BOOKED_ON_PLATFORM,
        )
        token = Token.objects.create(user=self.user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = client.post(
            f"/api/dashboard/reviews/{review.id}/flag/",
            {"reason": "Le commentaire contient des informations à vérifier."},
            format="json",
        )

        review.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(review.status, Review.Status.FLAGGED)
        self.assertTrue(review.flag_reason)


class ReviewTokenInfoTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="pro-reviews-3@example.com",
            username="pro-reviews-3",
            password="secret123",
            role=User.Role.PROFESSIONAL,
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Nuadyx",
            slug="cabinet-reviews-3",
            is_public=True,
        )

    def test_token_info_reports_expired_reason(self):
        raw_token, token_hash = ReviewInvitation.issue_token()
        ReviewInvitation.objects.create(
            professional=self.profile,
            first_name="Alice",
            last_name="Martin",
            email="alice@example.com",
            source=ReviewInvitation.Source.MANUAL,
            token_hash=token_hash,
            expires_at=timezone.now() - timedelta(days=1),
        )

        response = self.client.get(
            f"/api/reviews/token-info/?token={raw_token}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["valid"])
        self.assertEqual(response.data["reason"], "expired")
