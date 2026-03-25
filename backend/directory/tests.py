from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from directory.models import ImportedProfile, PractitionerClaim, SourceImportJob, SourceRegistry
from directory.services import execute_import_job
from professionals.models import ProfessionalProfile


class DirectoryImportTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@nuadyx.test",
            username="admin",
            password="testpass123",
            role=User.Role.ADMIN,
        )
        self.source = SourceRegistry.objects.create(
            name="CSV validé",
            source_type=SourceRegistry.SourceType.MANUAL_CSV,
            legal_status=SourceRegistry.LegalStatus.APPROVED,
            is_active=True,
        )

    def test_csv_import_creates_imported_profile(self):
        job = SourceImportJob.objects.create(
            source=self.source,
            trigger_type=SourceImportJob.TriggerType.MANUAL,
            created_by=self.admin,
        )
        payload = "external_id,public_name,business_name,city,email_public\n1,Ana Zen,Ana Zen Massage,Quimper,ana@example.com\n"
        result = execute_import_job(job=job, payload=payload)

        self.assertEqual(result.total_created, 1)
        profile = ImportedProfile.objects.get(source=self.source, external_id="1")
        self.assertEqual(profile.city, "Quimper")
        self.assertTrue(profile.publishable_minimum_ok)


class DirectoryClaimTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.source = SourceRegistry.objects.create(
            name="CSV claim",
            source_type=SourceRegistry.SourceType.MANUAL_CSV,
            legal_status=SourceRegistry.LegalStatus.APPROVED,
            is_active=True,
        )
        self.imported_profile = ImportedProfile.objects.create(
            source=self.source,
            external_id="claim-1",
            public_name="Aline Calme",
            business_name="Aline Calme Massage",
            city="Brest",
            email_public="aline@example.com",
            import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
            is_public=True,
            publishable_minimum_ok=True,
        )
        self.claim = PractitionerClaim.objects.create(
            imported_profile=self.imported_profile,
            email="aline@example.com",
        )

    def test_public_claim_verify_and_complete_onboarding(self):
        verify_response = self.client.post(
            "/api/public/claim/verify",
            {"token": self.claim.token},
            format="json",
        )
        self.assertEqual(verify_response.status_code, 200)

        complete_response = self.client.post(
            "/api/public/claim/complete-onboarding",
            {
                "token": self.claim.token,
                "email": "aline@example.com",
                "password": "testpass123",
                "password_confirmation": "testpass123",
                "first_name": "Aline",
                "last_name": "Calme",
                "business_name": "Aline Calme Massage",
                "accepted_documents": ["cgu", "cgv", "contrat-praticien", "confidentialite"],
            },
            format="json",
        )
        self.assertEqual(complete_response.status_code, 200)

        professional_profile = ProfessionalProfile.objects.get(user__email="aline@example.com")
        self.imported_profile.refresh_from_db()
        self.assertEqual(
            professional_profile.acquisition_source,
            ProfessionalProfile.AcquisitionSource.IMPORTED_CLAIMED,
        )
        self.assertEqual(self.imported_profile.import_status, ImportedProfile.ImportStatus.CLAIMED)


class DirectoryPublicViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        source = SourceRegistry.objects.create(
            name="Vue publique",
            source_type=SourceRegistry.SourceType.MANUAL_CSV,
            legal_status=SourceRegistry.LegalStatus.APPROVED,
            is_active=True,
        )
        ImportedProfile.objects.create(
            source=source,
            external_id="pub-1",
            public_name="Marine Détente",
            business_name="Marine Détente",
            city="Nantes",
            email_public="marine@example.com",
            import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
            is_public=True,
            publishable_minimum_ok=True,
        )

    def test_public_listing_endpoint_returns_imported_profiles(self):
        response = self.client.get("/api/public/directory-listings")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["listing_kind"], "unclaimed")
