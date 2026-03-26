from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from common.models import LegalAcceptanceRecord
from directory.models import (
    ContactCampaign,
    ImportedProfile,
    PractitionerClaim,
    RemovalRequest,
    SourceImportJob,
    SourceRegistry,
)
from professionals.models import DirectoryInterestLead, LocationIndex, ProfessionalProfile


class DirectoryEndToEndFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.public_client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@nuadyx.test",
            username="admin",
            password="testpass123",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(self.admin)

    def test_full_source_import_review_publish_claim_flow(self):
        source_response = self.client.post(
            "/api/admin/sources",
            {
                "name": "Annuaire CSV Quimper",
                "base_url": "https://example.test",
                "source_type": "manual_csv",
                "legal_status": "approved",
                "is_active": True,
                "requires_manual_review_before_publish": True,
                "can_contact_imported_profiles": True,
                "default_visibility_mode": "private_draft",
            },
            format="json",
        )
        self.assertEqual(source_response.status_code, 201)
        source_id = source_response.data["id"]

        dry_run_file = SimpleUploadedFile(
            "praticiens.csv",
            (
                "external_id,public_name,business_name,city,email_public,service_tags_json\n"
                'csv-1,Ana Zen,Ana Zen Massage,Quimper,ana@example.com,"relaxant|deep_tissue"\n'
            ).encode("utf-8"),
            content_type="text/csv",
        )
        dry_run_response = self.client.post(
            f"/api/admin/sources/{source_id}/run-import",
            {
                "file": dry_run_file,
                "dry_run": "true",
            },
        )
        self.assertEqual(dry_run_response.status_code, 200)
        self.assertTrue(dry_run_response.data["dry_run"])
        self.assertEqual(dry_run_response.data["summary"]["total_created"], 1)
        self.assertFalse(ImportedProfile.objects.filter(source_id=source_id).exists())
        dry_run_job = SourceImportJob.objects.get(pk=dry_run_response.data["job_id"])
        self.assertEqual(dry_run_job.status, SourceImportJob.Status.CANCELLED)

        real_file = SimpleUploadedFile(
            "praticiens.csv",
            (
                "external_id,public_name,business_name,city,email_public,service_tags_json\n"
                'csv-1,Ana Zen,Ana Zen Massage,Quimper,ana@example.com,"relaxant|deep_tissue"\n'
            ).encode("utf-8"),
            content_type="text/csv",
        )
        import_response = self.client.post(
            f"/api/admin/sources/{source_id}/run-import",
            {
                "file": real_file,
                "dry_run": "false",
            },
        )
        self.assertEqual(import_response.status_code, 200)
        imported_profile = ImportedProfile.objects.get(source_id=source_id, external_id="csv-1")
        self.assertEqual(imported_profile.import_status, ImportedProfile.ImportStatus.PENDING_REVIEW)
        self.assertFalse(imported_profile.is_public)

        review_response = self.client.get(
            "/api/admin/imported-profiles",
            {"import_status": "pending_review"},
        )
        self.assertEqual(review_response.status_code, 200)
        self.assertEqual(len(review_response.data), 1)
        self.assertEqual(review_response.data[0]["id"], str(imported_profile.id))

        approve_response = self.client.post(
            "/api/admin/imported-profiles/bulk-action",
            {
                "ids": [str(imported_profile.id)],
                "action": "approve_internal",
            },
            format="json",
        )
        self.assertEqual(approve_response.status_code, 200)
        imported_profile.refresh_from_db()
        self.assertEqual(imported_profile.import_status, ImportedProfile.ImportStatus.APPROVED_INTERNAL)

        publish_response = self.client.post(
            "/api/admin/imported-profiles/bulk-action",
            {
                "ids": [str(imported_profile.id)],
                "action": "publish_unclaimed",
            },
            format="json",
        )
        self.assertEqual(publish_response.status_code, 200)
        imported_profile.refresh_from_db()
        self.assertEqual(imported_profile.import_status, ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED)
        self.assertTrue(imported_profile.is_public)

        public_detail_response = self.public_client.get(f"/api/public/practitioners/{imported_profile.slug}")
        self.assertEqual(public_detail_response.status_code, 200)
        self.assertEqual(public_detail_response.data["kind"], "unclaimed")

        request_claim_response = self.public_client.post(
            f"/api/public/imported-profiles/{imported_profile.id}/request-claim",
            {"email": "ana@example.com"},
            format="json",
        )
        self.assertEqual(request_claim_response.status_code, 200)
        claim = PractitionerClaim.objects.get(imported_profile=imported_profile, email="ana@example.com")
        self.assertEqual(claim.status, PractitionerClaim.Status.SENT)

        verify_response = self.public_client.post(
            "/api/public/claim/verify",
            {"token": claim.token},
            format="json",
        )
        self.assertEqual(verify_response.status_code, 200)
        claim.refresh_from_db()
        self.assertEqual(claim.status, PractitionerClaim.Status.VERIFIED)

        complete_response = self.public_client.post(
            "/api/public/claim/complete-onboarding",
            {
                "token": claim.token,
                "email": "ana@example.com",
                "password": "testpass123",
                "password_confirmation": "testpass123",
                "first_name": "Ana",
                "last_name": "Zen",
                "business_name": "Ana Zen Massage",
                "accepted_documents": ["cgu", "cgv", "contrat-praticien", "confidentialite"],
            },
            format="json",
        )
        self.assertEqual(complete_response.status_code, 200)
        imported_profile.refresh_from_db()
        claim.refresh_from_db()
        professional_profile = ProfessionalProfile.objects.get(user__email="ana@example.com")

        self.assertEqual(imported_profile.import_status, ImportedProfile.ImportStatus.CLAIMED)
        self.assertFalse(imported_profile.is_public)
        self.assertFalse(imported_profile.claimable)
        self.assertEqual(claim.status, PractitionerClaim.Status.APPROVED)
        self.assertEqual(professional_profile.imported_profile_origin_id, imported_profile.id)
        self.assertTrue(professional_profile.profile_claimed_from_import)
        self.assertEqual(
            professional_profile.acquisition_source,
            ProfessionalProfile.AcquisitionSource.IMPORTED_CLAIMED,
        )
        self.assertEqual(
            LegalAcceptanceRecord.objects.filter(user=professional_profile.user).count(),
            4,
        )

        linked_response = self.public_client.get(f"/api/public/practitioners/{professional_profile.slug}")
        self.assertEqual(linked_response.status_code, 404)

        practitioner_client = APIClient()
        practitioner_client.credentials(HTTP_AUTHORIZATION=f"Token {complete_response.data['token']}")
        dashboard_response = practitioner_client.get("/api/dashboard/profile/")
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(dashboard_response.data["slug"], professional_profile.slug)


class DirectoryPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@nuadyx.test",
            username="admin",
            password="testpass123",
            role=User.Role.ADMIN,
        )
        self.professional_user = User.objects.create_user(
            email="pro@nuadyx.test",
            username="pro",
            password="testpass123",
            role=User.Role.PROFESSIONAL,
        )
        ProfessionalProfile.objects.create(
            user=self.professional_user,
            business_name="Profil Pro",
            slug="profil-pro",
            city="Quimper",
        )
        self.source = SourceRegistry.objects.create(
            name="Source review",
            source_type=SourceRegistry.SourceType.MANUAL_CSV,
            legal_status=SourceRegistry.LegalStatus.APPROVED,
            is_active=True,
            can_contact_imported_profiles=True,
        )

    def test_admin_endpoints_reject_anonymous_and_professional(self):
        anonymous_response = self.client.get("/api/admin/sources")
        self.assertIn(anonymous_response.status_code, {401, 403})

        self.client.force_authenticate(self.professional_user)
        professional_response = self.client.get("/api/admin/sources")
        self.assertEqual(professional_response.status_code, 403)

        self.client.force_authenticate(self.admin)
        admin_response = self.client.get("/api/admin/sources")
        self.assertEqual(admin_response.status_code, 200)

    def test_large_campaign_requires_real_super_admin_permission(self):
        self.client.force_authenticate(self.admin)
        for index in range(26):
            ImportedProfile.objects.create(
                source=self.source,
                external_id=f"campaign-{index}",
                public_name=f"Profil {index}",
                business_name=f"Profil {index}",
                city="Brest",
                email_public=f"profil-{index}@example.com",
                import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
                is_public=True,
                publishable_minimum_ok=True,
                contact_allowed_based_on_source_policy=True,
            )

        campaign_response = self.client.post(
            "/api/admin/contact-campaigns",
            {
                "name": "Campagne large",
                "campaign_type": "claim_invite",
                "status": "ready",
                "email_template_key": "claim_invite",
                "audience_filter_json": {},
            },
            format="json",
        )
        self.assertEqual(campaign_response.status_code, 201)

        send_response = self.client.post(
            f"/api/admin/contact-campaigns/{campaign_response.data['id']}/send"
        )
        self.assertEqual(send_response.status_code, 400)


class DirectoryLocationFilteringTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin-locations@nuadyx.test",
            username="admin-locations",
            password="testpass123",
            role=User.Role.ADMIN,
        )
        self.source = SourceRegistry.objects.create(
            name="Location source",
            source_type=SourceRegistry.SourceType.MANUAL_CSV,
            legal_status=SourceRegistry.LegalStatus.APPROVED,
            is_active=True,
            can_contact_imported_profiles=True,
        )
        user = User.objects.create_user(
            email="quimper@nuadyx.test",
            username="quimper",
            password="testpass123",
            role=User.Role.PROFESSIONAL,
        )
        self.quimper = ProfessionalProfile.objects.create(
            user=user,
            business_name="Cabinet Quimper",
            slug="cabinet-quimper",
            city="Quimper",
            is_public=True,
        )
        other_user = User.objects.create_user(
            email="rennes@nuadyx.test",
            username="rennes",
            password="testpass123",
            role=User.Role.PROFESSIONAL,
        )
        self.rennes = ProfessionalProfile.objects.create(
            user=other_user,
            business_name="Cabinet Rennes",
            slug="cabinet-rennes",
            city="Rennes",
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
            priority=40,
        )
        LocationIndex.objects.create(
            location_type=LocationIndex.LocationType.DEPARTMENT,
            label="Finistère (29)",
            department_code="29",
            department_name="Finistère",
            region="Bretagne",
            slug="finistere-29",
            priority=30,
        )

    def test_public_directory_listings_filter_by_department_slug(self):
        response = self.client.get(
            "/api/public/directory-listings",
            {"location_type": "department", "location_slug": "finistere-29"},
        )

        self.assertEqual(response.status_code, 200)
        slugs = {item["slug"] for item in response.data}
        self.assertIn(self.quimper.slug, slugs)
        self.assertNotIn(self.rennes.slug, slugs)

    def test_admin_can_read_acquisition_coverage_and_suggestions(self):
        self.client.force_authenticate(self.admin)
        DirectoryInterestLead.objects.create(
            kind="suggest_practitioner",
            full_name="Alioune Seck",
            email="alioune@example.com",
            city="Quimper",
            practitioner_name="Cabinet Breizh",
            source_page="/annuaire",
        )
        ImportedProfile.objects.create(
            source=self.source,
            external_id="coverage-1",
            public_name="Cabinet Breizh",
            business_name="Cabinet Breizh",
            city="Quimper",
            email_public="breizh@example.com",
            import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
            is_public=True,
            publishable_minimum_ok=True,
            contact_allowed_based_on_source_policy=True,
        )

        coverage_response = self.client.get("/api/admin/acquisition/coverage")
        suggestions_response = self.client.get("/api/admin/acquisition/suggestions")
        campaigns_response = self.client.get("/api/admin/contact-campaigns")

        self.assertEqual(coverage_response.status_code, 200)
        self.assertEqual(suggestions_response.status_code, 200)
        self.assertEqual(campaigns_response.status_code, 200)
        self.assertEqual(suggestions_response.data[0]["city"], "Quimper")

    def test_bulk_claim_invite_is_blocked_when_source_cannot_be_contacted(self):
        self.client.force_authenticate(self.admin)
        restricted_source = SourceRegistry.objects.create(
            name="Source sans contact",
            source_type=SourceRegistry.SourceType.MANUAL_CSV,
            legal_status=SourceRegistry.LegalStatus.APPROVED,
            is_active=True,
            can_contact_imported_profiles=False,
        )
        imported_profile = ImportedProfile.objects.create(
            source=restricted_source,
            external_id="restricted-1",
            public_name="Profil sans contact",
            business_name="Profil sans contact",
            city="Lyon",
            email_public="nocontact@example.com",
            import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
            is_public=True,
            publishable_minimum_ok=True,
            contact_allowed_based_on_source_policy=False,
        )

        response = self.client.post(
            "/api/admin/imported-profiles/bulk-action",
            {
                "ids": [str(imported_profile.id)],
                "action": "send_claim_invite",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated"], 0)
        self.assertEqual(PractitionerClaim.objects.filter(imported_profile=imported_profile).count(), 0)

    def test_authenticated_admin_cannot_complete_public_claim_onboarding(self):
        imported_profile = ImportedProfile.objects.create(
            source=self.source,
            external_id="admin-claim-1",
            public_name="Claim Admin",
            business_name="Claim Admin",
            city="Paris",
            publishable_minimum_ok=True,
            import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
            is_public=True,
        )
        claim = PractitionerClaim.objects.create(
            imported_profile=imported_profile,
            email="claim-admin@example.com",
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/public/claim/complete-onboarding",
            {
                "token": claim.token,
                "business_name": "Claim Admin",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("compte praticien", str(response.data))


class DirectoryDataConsistencyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.source = SourceRegistry.objects.create(
            name="Consistency source",
            source_type=SourceRegistry.SourceType.MANUAL_CSV,
            legal_status=SourceRegistry.LegalStatus.APPROVED,
            is_active=True,
        )

    def test_slug_uniqueness_against_existing_professional_profile(self):
        user = User.objects.create_user(
            email="pro@nuadyx.test",
            username="pro",
            password="testpass123",
            role=User.Role.PROFESSIONAL,
        )
        ProfessionalProfile.objects.create(
            user=user,
            business_name="Ana Zen Massage",
            slug="ana-zen-massage",
            city="Quimper",
        )

        imported_profile = ImportedProfile.objects.create(
            source=self.source,
            external_id="ana-1",
            public_name="Ana Zen Massage",
            business_name="Ana Zen Massage",
            city="Quimper",
            publishable_minimum_ok=True,
        )
        self.assertNotEqual(imported_profile.slug, "ana-zen-massage")
        self.assertTrue(imported_profile.slug.startswith("ana-zen-massage"))

    def test_expired_claim_token_returns_410(self):
        imported_profile = ImportedProfile.objects.create(
            source=self.source,
            external_id="expired-1",
            public_name="Profil expiré",
            business_name="Profil expiré",
            city="Brest",
            publishable_minimum_ok=True,
        )
        claim = PractitionerClaim.objects.create(
            imported_profile=imported_profile,
            email="expired@example.com",
            expires_at=timezone.now() - timedelta(hours=1),
        )
        response = self.client.post(
            "/api/public/claim/verify",
            {"token": claim.token},
            format="json",
        )
        self.assertEqual(response.status_code, 410)
        claim.refresh_from_db()
        self.assertEqual(claim.status, PractitionerClaim.Status.EXPIRED)

    def test_existing_email_blocks_public_claim_completion(self):
        User.objects.create_user(
            email="existing@example.com",
            username="existing@example.com",
            password="testpass123",
            role=User.Role.PROFESSIONAL,
        )
        imported_profile = ImportedProfile.objects.create(
            source=self.source,
            external_id="existing-1",
            public_name="Profil existant",
            business_name="Profil existant",
            city="Rennes",
            publishable_minimum_ok=True,
            import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
            is_public=True,
        )
        claim = PractitionerClaim.objects.create(
            imported_profile=imported_profile,
            email="existing@example.com",
        )
        response = self.client.post(
            "/api/public/claim/complete-onboarding",
            {
                "token": claim.token,
                "email": "existing@example.com",
                "password": "testpass123",
                "password_confirmation": "testpass123",
                "accepted_documents": ["cgu", "cgv", "contrat-praticien", "confidentialite"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Un compte existe déjà", str(response.data["email"]))

    def test_public_removal_request_marks_profile(self):
        imported_profile = ImportedProfile.objects.create(
            source=self.source,
            external_id="remove-1",
            public_name="Profil à retirer",
            business_name="Profil à retirer",
            city="Nantes",
            publishable_minimum_ok=True,
            import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
            is_public=True,
        )
        response = self.client.post(
            "/api/public/removal-request",
            {
                "slug_or_id": imported_profile.slug,
                "requester_email": "remove@example.com",
                "requester_name": "Removal Test",
                "reason": "Merci de supprimer.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        imported_profile.refresh_from_db()
        self.assertTrue(imported_profile.removal_requested)
        self.assertEqual(
            RemovalRequest.objects.filter(imported_profile=imported_profile).count(),
            1,
        )
