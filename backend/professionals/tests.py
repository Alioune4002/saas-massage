from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from professionals.models import (
    DirectoryInterestLead,
    DirectoryProfileCandidate,
    DirectoryProfileClaimRequest,
    DirectoryProfileRemovalRequest,
    ProfessionalProfile,
)
from services.models import MassageService


class DirectoryListingTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            username="pro-one",
            email="pro-one@example.com",
            password="secret1234",
        )
        self.profile = ProfessionalProfile.objects.create(
            user=user,
            business_name="Cabinet Quimper Détente",
            slug="cabinet-quimper-detente",
            city="Quimper",
            is_public=True,
        )
        MassageService.objects.create(
            professional=self.profile,
            title="Massage relaxant",
            short_description="Détente profonde",
            full_description="Un massage relaxant enveloppant.",
            service_category="relaxant",
            duration_minutes=60,
            price_eur="90.00",
        )
        self.candidate = DirectoryProfileCandidate.objects.create(
            business_name="Atelier Bien-Être Nantes",
            slug="atelier-bien-etre-nantes",
            city="Nantes",
            status=DirectoryProfileCandidate.Status.PUBLISHED_UNCLAIMED,
            massage_categories=["deep_tissue"],
            source_label="Suggestion",
        )
        self.client = APIClient()

    def test_directory_listings_filter_by_city(self):
        response = self.client.get("/api/directory/listings/?city=Quimper")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["business_name"], self.profile.business_name)

    def test_directory_listings_filter_by_category(self):
        response = self.client.get("/api/directory/listings/?category=deep_tissue")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["listing_kind"], "unclaimed")

    def test_claim_request_endpoint_creates_trace(self):
        response = self.client.post(
            f"/api/directory/candidates/{self.candidate.slug}/claim/",
            {
                "claimant_name": "Alioune Seck",
                "claimant_email": "alioune@example.com",
                "claimant_phone": "0600000000",
                "message": "Je suis ce praticien.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            DirectoryProfileClaimRequest.objects.filter(candidate=self.candidate).count(),
            1,
        )

    def test_removal_request_endpoint_marks_candidate(self):
        response = self.client.post(
            f"/api/directory/candidates/{self.candidate.slug}/remove/",
            {
                "requester_name": "Alioune Seck",
                "requester_email": "alioune@example.com",
                "reason": "Merci de retirer cette fiche.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.candidate.refresh_from_db()
        self.assertIsNotNone(self.candidate.removal_requested_at)
        self.assertEqual(
            DirectoryProfileRemovalRequest.objects.filter(candidate=self.candidate).count(),
            1,
        )

    def test_interest_lead_endpoint_creates_record(self):
        response = self.client.post(
            "/api/directory/interests/",
            {
                "kind": "city_waitlist",
                "full_name": "Alioune Seck",
                "email": "alioune@example.com",
                "city": "Brest",
                "practitioner_name": "",
                "message": "Prévenez-moi quand l’annuaire ouvre ici.",
                "source_page": "/",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(DirectoryInterestLead.objects.count(), 1)
