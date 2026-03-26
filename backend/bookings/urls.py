from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ProfessionalAgendaView,
    ProfessionalAvailabilityViewSet,
    ProfessionalBookingViewSet,
    ProfessionalPaymentConnectView,
    ProfessionalPaymentOverviewView,
    ProfessionalTrustedClientViewSet,
    PublicAvailabilityListView,
    PublicBookingCreateView,
    PublicBookingIncidentView,
    PublicBookingResendVerificationView,
    PublicBookingTestPaymentConfirmView,
    PublicBookingThreadView,
    PublicBookingValidateServiceView,
    PublicBookingVerifyEmailView,
    StripeWebhookView,
)

router = DefaultRouter()
router.register(
    "dashboard/availabilities",
    ProfessionalAvailabilityViewSet,
    basename="dashboard-availabilities",
)
router.register(
    "dashboard/bookings",
    ProfessionalBookingViewSet,
    basename="dashboard-bookings",
)
router.register(
    "dashboard/trusted-clients",
    ProfessionalTrustedClientViewSet,
    basename="dashboard-trusted-clients",
)

urlpatterns = [
    path("availabilities/", PublicAvailabilityListView.as_view(), name="public-availabilities"),
    path("bookings/", PublicBookingCreateView.as_view(), name="public-bookings-create"),
    path("bookings/verify-email/", PublicBookingVerifyEmailView.as_view(), name="public-bookings-verify-email"),
    path("bookings/resend-verification/", PublicBookingResendVerificationView.as_view(), name="public-bookings-resend-verification"),
    path("bookings/<uuid:booking_id>/payment-test/confirm/", PublicBookingTestPaymentConfirmView.as_view(), name="public-bookings-payment-test-confirm"),
    path("bookings/<uuid:booking_id>/validate-service/", PublicBookingValidateServiceView.as_view(), name="public-bookings-validate-service"),
    path("bookings/<uuid:booking_id>/thread/", PublicBookingThreadView.as_view(), name="public-bookings-thread"),
    path("bookings/<uuid:booking_id>/incident/", PublicBookingIncidentView.as_view(), name="public-bookings-incident"),
    path("dashboard/agenda/", ProfessionalAgendaView.as_view(), name="dashboard-agenda"),
    path("dashboard/payments/overview/", ProfessionalPaymentOverviewView.as_view(), name="dashboard-payments-overview"),
    path("dashboard/payments/connect-account/", ProfessionalPaymentConnectView.as_view(), name="dashboard-payments-connect-account"),
    path("payments/webhooks/stripe/", StripeWebhookView.as_view(), name="stripe-webhooks"),
    path("", include(router.urls)),
]
