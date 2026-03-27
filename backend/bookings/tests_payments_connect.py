from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from professionals.models import PractitionerVerification, ProfessionalProfile

from .payments.stripe_connect import StripeConnectError


class PaymentConnectErrorHandlingTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            username="stripe-pro",
            email="stripe-pro@example.com",
            password="secret1234",
            role="professional",
        )
        self.profile = ProfessionalProfile.objects.create(
            user=user,
            business_name="Cabinet Stripe",
            slug="cabinet-stripe",
            city="Quimper",
        )
        self.client = APIClient()
        self.client.force_authenticate(user)

    @override_settings(
        NUADYX_STRIPE_SECRET_KEY="sk_test_123",
        NUADYX_STRIPE_PUBLISHABLE_KEY="pk_test_123",
        NUADYX_STRIPE_WEBHOOK_SECRET="whsec_test_123",
        FRONTEND_APP_URL="https://www.nuadyx.com",
    )
    @patch("bookings.views.create_account_link", side_effect=StripeConnectError("Stripe down"))
    @patch("bookings.views.create_connected_account", return_value={"id": "acct_test_failure"})
    def test_connect_account_returns_400_instead_of_500_when_stripe_fails(
        self,
        _create_account,
        _create_link,
    ):
        response = self.client.post("/api/dashboard/payments/connect-account/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("payment_account", response.data)

    def test_verification_update_accepts_simple_multipart_payload(self):
        response = self.client.patch(
            "/api/dashboard/verification/",
            {
                "siren": "123456789",
                "siret": "12345678900012",
                "beneficiary_name": "Alioune Test",
                "iban_last4": "1234",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        verification = PractitionerVerification.objects.get(
            professional=self.profile
        )
        self.assertEqual(verification.siren, "123456789")
        self.assertEqual(verification.beneficiary_name, "Alioune Test")
