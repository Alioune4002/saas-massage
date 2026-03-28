from rest_framework.test import APITestCase

from accounts.models import User
from common.models import PlatformMessage
from professionals.models import ProfessionalProfile


class AdminSupportAndAnalyticsApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin-support@example.com",
            username="admin-support",
            password="Password123!",
            role=User.Role.ADMIN,
            admin_role=User.AdminRole.ADMIN,
        )
        self.practitioner = User.objects.create_user(
            email="pro-support@example.com",
            username="pro-support",
            password="Password123!",
            role=User.Role.PROFESSIONAL,
            first_name="Nora",
            last_name="Martin",
        )
        ProfessionalProfile.objects.create(
            user=self.practitioner,
            business_name="Cabinet Nora",
            slug="cabinet-nora",
            is_public=True,
            accepts_online_booking=True,
        )

    def test_admin_can_send_platform_message_and_recipient_can_list_it(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/admin/support/messages",
            {
                "recipient_user": str(self.practitioner.id),
                "category": "support",
                "title": "Vérification de profil",
                "body": "Merci de compléter votre présentation.",
                "display_mode": "notice",
                "reply_allowed": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(PlatformMessage.objects.count(), 1)

        self.client.force_authenticate(self.practitioner)
        inbox_response = self.client.get("/api/me/platform-messages")
        self.assertEqual(inbox_response.status_code, 200)
        self.assertEqual(inbox_response.data["messages"][0]["title"], "Vérification de profil")

    def test_professional_cannot_access_admin_analytics(self):
        self.client.force_authenticate(self.practitioner)
        response = self.client.get("/api/admin/analytics/overview")
        self.assertEqual(response.status_code, 403)

    def test_admin_can_access_admin_analytics(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/admin/analytics/overview")
        self.assertEqual(response.status_code, 200)
        self.assertIn("kpis", response.data)

    def test_professional_cannot_access_admin_users(self):
        self.client.force_authenticate(self.practitioner)
        response = self.client.get("/api/admin/users")
        self.assertEqual(response.status_code, 403)

    def test_admin_can_suspend_and_reactivate_user_with_bulk_action(self):
        self.client.force_authenticate(self.admin)

        suspend_response = self.client.post(
            "/api/admin/users/bulk-action",
            {
                "ids": [str(self.practitioner.id)],
                "action": "suspend",
            },
            format="json",
        )
        self.assertEqual(suspend_response.status_code, 200)
        self.practitioner.refresh_from_db()
        self.assertFalse(self.practitioner.is_active)

        reactivate_response = self.client.post(
            "/api/admin/users/bulk-action",
            {
                "ids": [str(self.practitioner.id)],
                "action": "reactivate",
            },
            format="json",
        )
        self.assertEqual(reactivate_response.status_code, 200)
        self.practitioner.refresh_from_db()
        self.assertTrue(self.practitioner.is_active)

    def test_superuser_can_access_admin_users_even_without_role_admin(self):
        superuser = User.objects.create_superuser(
            email="root-admin@example.com",
            username="root-admin",
            password="Password123!",
        )
        self.client.force_authenticate(superuser)

        response = self.client.get("/api/admin/users")

        self.assertEqual(response.status_code, 200)
