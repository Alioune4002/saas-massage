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

    @override_settings(
        NUADYX_STRIPE_SECRET_KEY="sk_test_123",
        NUADYX_STRIPE_PUBLISHABLE_KEY="pk_test_123",
        NUADYX_STRIPE_WEBHOOK_SECRET="whsec_test_123",
        FRONTEND_APP_URL="https://www.nuadyx.com",
    )
    @patch(
        "bookings.views.create_account_link",
        side_effect=StripeConnectError("Invalid URL for return_url"),
    )
    @patch("bookings.views.create_connected_account", return_value={"id": "acct_test_failure"})
    def test_connect_account_returns_actionable_message_for_invalid_frontend_url(
        self,
        _create_account,
        _create_link,
    ):
        response = self.client.post("/api/dashboard/payments/connect-account/")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["payment_account"],
            "La configuration de retour Stripe n’est pas valide. Le support NUADYX doit finaliser l’URL publique du site.",
        )

    @override_settings(
        NUADYX_STRIPE_SECRET_KEY="sk_test_123",
        NUADYX_STRIPE_PUBLISHABLE_KEY="pk_test_123",
        NUADYX_STRIPE_WEBHOOK_SECRET="whsec_test_123",
        FRONTEND_APP_URL="https://www.nuadyx.com",
    )
    @patch(
        "bookings.views.create_account_link",
        side_effect=[
            StripeConnectError("No such account: 'acct_stale_123'"),
            {"url": "https://connect.stripe.test/onboarding"},
        ],
    )
    @patch(
        "bookings.views.create_connected_account",
        side_effect=[{"id": "acct_stale_123"}, {"id": "acct_fresh_123"}],
    )
    def test_connect_account_recreates_missing_stripe_account_once(
        self,
        create_account_mock,
        create_link_mock,
    ):
        response = self.client.post("/api/dashboard/payments/connect-account/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["url"], "https://connect.stripe.test/onboarding")
        self.assertEqual(create_account_mock.call_count, 2)
        self.assertEqual(create_link_mock.call_count, 2)

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
