from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from professionals.models import ProfessionalProfile

from .models import ProfessionalAssistantProfile


class PublicAssistantTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            username="assistant-pro",
            email="assistant-pro@example.com",
            password="secret1234",
            role="professional",
        )
        self.profile = ProfessionalProfile.objects.create(
            user=user,
            business_name="Cabinet Assistant",
            slug="cabinet-assistant",
            city="Quimper",
            is_public=True,
            bio="Massage bien-être à Quimper.",
            public_headline="Séances sur rendez-vous",
            service_area="Quimper et alentours",
        )
        self.assistant = ProfessionalAssistantProfile.objects.create(
            professional=self.profile,
            assistant_enabled=True,
            public_assistant_enabled=True,
            welcome_message="Bonjour, je peux vous aider à comprendre les soins et la réservation.",
            practice_information="Accueil en cabinet sur rendez-vous.",
            booking_policy="Réservation en ligne avec vérification email.",
            contact_information="Vous pouvez poser vos questions pratiques ici.",
            faq_items=[
                {
                    "question": "Comment réserver ?",
                    "answer": "Choisissez une prestation, un créneau puis confirmez votre email.",
                }
            ],
        )
        self.client = APIClient()

    def test_public_assistant_is_available_when_enabled_for_public_profile(self):
        response = self.client.get(f"/api/assistant/{self.profile.slug}/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["assistant_enabled"])
        self.assertTrue(response.data["public_assistant_enabled"])
        self.assertGreaterEqual(len(response.data["starter_questions"]), 1)

    def test_public_assistant_answer_endpoint_returns_response(self):
        response = self.client.post(
            f"/api/assistant/{self.profile.slug}/",
            {"question": "Comment réserver une séance ?"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("answer", response.data)
        self.assertTrue(response.data["answer"])

    def test_public_assistant_is_hidden_when_public_visibility_is_disabled(self):
        self.assistant.public_assistant_enabled = False
        self.assistant.save(update_fields=["public_assistant_enabled"])

        response = self.client.get(f"/api/assistant/{self.profile.slug}/")

        self.assertEqual(response.status_code, 403)
