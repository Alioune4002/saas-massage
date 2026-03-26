from datetime import timedelta
from tempfile import NamedTemporaryFile

from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from bookings.models import AvailabilitySlot, Booking
from directory.models import ImportedProfile, PractitionerClaim, RemovalRequest, SourceRegistry
from professionals.models import (
    ContactPrivateNote,
    DirectoryInterestLead,
    FavoritePractitioner,
    GuestFavoriteCollection,
    LocationIndex,
    PractitionerContact,
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


class FavoriteAndLocationTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            username="pro-fav",
            email="pro-fav@example.com",
            password="secret1234",
        )
        self.profile = ProfessionalProfile.objects.create(
            user=user,
            business_name="Maison Zen Brest",
            slug="maison-zen-brest",
            city="Brest",
            is_public=True,
        )
        LocationIndex.objects.create(
            location_type=LocationIndex.LocationType.CITY,
            label="Quimper",
            city="Quimper",
            postal_code="29000",
            department_code="29",
            department_name="Finistère",
            region="Bretagne",
            slug="quimper",
            priority=20,
        )
        LocationIndex.objects.create(
            location_type=LocationIndex.LocationType.POSTAL_CODE,
            label="29000",
            postal_code="29000",
            department_code="29",
            department_name="Finistère",
            region="Bretagne",
            slug="29000",
            priority=18,
        )
        LocationIndex.objects.create(
            location_type=LocationIndex.LocationType.DEPARTMENT,
            label="Finistère (29)",
            department_code="29",
            department_name="Finistère",
            region="Bretagne",
            slug="finistere-29",
            priority=16,
        )
        LocationIndex.objects.create(
            location_type=LocationIndex.LocationType.REGION,
            label="Bretagne",
            region="Bretagne",
            slug="bretagne",
            priority=14,
        )
        self.client = APIClient()

    def test_guest_can_add_list_and_remove_favorites(self):
        add_response = self.client.post(
            "/api/public/favorites",
            {"professional_slug": self.profile.slug},
            format="json",
        )

        self.assertEqual(add_response.status_code, 201)
        token = add_response.data["collection_token"]
        self.assertTrue(
            FavoritePractitioner.objects.filter(professional=self.profile).exists()
        )

        list_response = self.client.get(
            "/api/public/favorites",
            HTTP_X_GUEST_FAVORITES_TOKEN=token,
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data["favorites"]), 1)

        remove_response = self.client.delete(
            f"/api/public/favorites/{self.profile.slug}",
            HTTP_X_GUEST_FAVORITES_TOKEN=token,
        )
        self.assertEqual(remove_response.status_code, 204)
        self.assertFalse(FavoritePractitioner.objects.exists())

    def test_location_suggestions_support_city_query(self):
        response = self.client.get("/api/public/location-suggestions?q=quimp")

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["label"], "Quimper")

    def test_location_suggestions_support_region_and_default_queries(self):
        region_response = self.client.get("/api/public/location-suggestions?q=breta")

        self.assertEqual(region_response.status_code, 200)
        self.assertTrue(any(item["kind"] == "region" for item in region_response.data))

        default_response = self.client.get("/api/public/location-suggestions")
        self.assertEqual(default_response.status_code, 200)
        self.assertGreaterEqual(len(default_response.data), 1)


class LocationIndexCommandTests(TestCase):
    def test_command_loads_cities_postal_codes_departments_and_regions(self):
        with NamedTemporaryFile("w+", suffix=".csv", encoding="utf-8", delete=False) as handle:
            handle.write(
                "code_commune_INSEE,nom_commune_postal,code_postal,libelle_acheminement,ligne_5,latitude,longitude,code_commune,article,nom_commune,nom_commune_complet,code_departement,nom_departement,code_region,nom_region\n"
            )
            handle.write(
                "29019,QUIMPER,29000,QUIMPER,,48.0,-4.1,19,,Quimper,Quimper,29,Finistère,53,Bretagne\n"
            )
            handle.write(
                "93066,SAINT DENIS,93200,SAINT DENIS,,48.9,2.35,66,,Saint-Denis,Saint-Denis,93,Seine-Saint-Denis,11,Île-de-France\n"
            )
            handle.write(
                "97411,SAINT DENIS,97400,SAINT DENIS,,20.8,55.4,11,,Saint-Denis,Saint-Denis,974,La Réunion,04,La Réunion\n"
            )
            handle.flush()

            call_command("load_fr_location_index", csv_path=handle.name, replace=True)

        self.assertTrue(
            LocationIndex.objects.filter(
                location_type=LocationIndex.LocationType.CITY,
                slug="quimper",
                city="Quimper",
            ).exists()
        )
        self.assertTrue(
            LocationIndex.objects.filter(
                location_type=LocationIndex.LocationType.CITY,
                slug="saint-denis-93",
            ).exists()
        )
        self.assertTrue(
            LocationIndex.objects.filter(
                location_type=LocationIndex.LocationType.CITY,
                slug="saint-denis-974",
            ).exists()
        )
        self.assertTrue(
            LocationIndex.objects.filter(
                location_type=LocationIndex.LocationType.DEPARTMENT,
                slug="finistere-29",
            ).exists()
        )
        self.assertTrue(
            LocationIndex.objects.filter(
                location_type=LocationIndex.LocationType.REGION,
                slug="bretagne",
            ).exists()
        )


class PractitionerContactsTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="pro-contact",
            email="pro-contact@example.com",
            password="secret1234",
            role="professional",
        )
        self.profile = ProfessionalProfile.objects.create(
            user=self.user,
            business_name="Cabinet Contact",
            slug="cabinet-contact",
            city="Quimper",
            is_public=True,
        )
        self.service = MassageService.objects.create(
            professional=self.profile,
            title="Massage sur mesure",
            short_description="Personnalisé",
            full_description="Une séance adaptée.",
            service_category="relaxant",
            duration_minutes=60,
            price_eur="80.00",
        )
        start_at = timezone.now() + timedelta(days=2)
        self.slot = AvailabilitySlot.objects.create(
            professional=self.profile,
            service=self.service,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
        )
        self.booking = Booking.objects.create(
            professional=self.profile,
            service=self.service,
            slot=self.slot,
            client_first_name="Alioune",
            client_last_name="Seck",
            client_email="client@example.com",
            client_phone="0600000000",
            status=Booking.Status.CONFIRMED,
            fulfillment_status=Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_practitioner_contacts_endpoint_returns_segmented_contact(self):
        response = self.client.get("/api/dashboard/contacts/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["email"], "client@example.com")
        self.assertIn(response.data[0]["segment"], {"active", "loyal"})

    def test_practitioner_can_update_private_note_and_tags(self):
        list_response = self.client.get("/api/dashboard/contacts/")
        contact_id = list_response.data[0]["id"]

        update_response = self.client.patch(
            f"/api/dashboard/contacts/{contact_id}/",
            {
                "private_note": "Cliente très régulière le midi.",
                "tag_labels": ["fidèle", "pause midi"],
                "is_trusted": True,
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, 200)
        contact = PractitionerContact.objects.get(pk=contact_id)
        self.assertTrue(contact.is_trusted)
        self.assertEqual(contact.tags.count(), 2)
        self.assertEqual(contact.private_note.content, "Cliente très régulière le midi.")
