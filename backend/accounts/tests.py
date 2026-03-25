from django.test import TestCase
from django.core import mail

# Create your tests here.
from rest_framework.test import APITestCase

from accounts.models import User
from professionals.models import ProfessionalProfile


class RegistrationTests(APITestCase):
    def test_register_practitioner_creates_user_profile_and_token(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "first_name": "Sam",
                "last_name": "Brest",
                "business_name": "Cabinet Sam Brest",
                "email": "sam@example.com",
                "password": "secret1234",
                "password_confirmation": "secret1234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email="sam@example.com").exists())

        user = User.objects.get(email="sam@example.com")
        profile = ProfessionalProfile.objects.get(user=user)

        self.assertEqual(profile.business_name, "Cabinet Sam Brest")
        self.assertEqual(profile.slug, "cabinet-sam-brest")
        self.assertFalse(profile.onboarding_completed)
        self.assertEqual(profile.onboarding_step, ProfessionalProfile.OnboardingStep.WELCOME)
        self.assertFalse(profile.is_public)
        self.assertIn("token", response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Bienvenue dans NUADYX", mail.outbox[0].subject)

    def test_register_practitioner_rejects_mismatched_passwords(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "first_name": "Sam",
                "last_name": "Brest",
                "business_name": "Cabinet Sam Brest",
                "email": "sam2@example.com",
                "password": "secret1234",
                "password_confirmation": "other1234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
