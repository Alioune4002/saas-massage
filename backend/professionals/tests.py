from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from directory.models import ImportedProfile, PractitionerClaim, RemovalRequest, SourceRegistry
from professionals.models import DirectoryInterestLead, ProfessionalProfile
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
        source = SourceRegistry.objects.create(
            name="Source publique legacy",
            source_type=SourceRegistry.SourceType.MANUAL_CSV,
            legal_status=SourceRegistry.LegalStatus.APPROVED,
            is_active=True,
            can_contact_imported_profiles=True,
        )
        self.imported_profile = ImportedProfile.objects.create(
            source=source,
            external_id="legacy-1",
            public_name="Atelier Bien-Être Nantes",
            business_name="Atelier Bien-Être Nantes",
            city="Nantes",
            region="Bretagne",
            email_public="atelier@example.com",
            service_tags_json=["deep_tissue"],
            import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
            is_public=True,
            publishable_minimum_ok=True,
            contact_allowed_based_on_source_policy=True,
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
        self.assertEqual(response.json()[0]["slug"], self.imported_profile.slug)

    def test_claim_request_endpoint_creates_trace(self):
        response = self.client.post(
            f"/api/directory/candidates/{self.imported_profile.slug}/claim/",
            {
                "claimant_name": "Alioune Seck",
                "claimant_email": "alioune@example.com",
                "claimant_phone": "0600000000",
                "message": "Je suis ce praticien.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        claim = PractitionerClaim.objects.get(imported_profile=self.imported_profile)
        self.assertEqual(claim.email, "alioune@example.com")
        self.assertIn("Alioune Seck", claim.decision_notes)

    def test_removal_request_endpoint_marks_candidate(self):
        response = self.client.post(
            f"/api/directory/candidates/{self.imported_profile.slug}/remove/",
            {
                "requester_name": "Alioune Seck",
                "requester_email": "alioune@example.com",
                "reason": "Merci de retirer cette fiche.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.imported_profile.refresh_from_db()
        self.assertTrue(self.imported_profile.removal_requested)
        self.assertEqual(
            RemovalRequest.objects.filter(imported_profile=self.imported_profile).count(),
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
