from django.urls import path

from .views import (
    CookieConsentCreateView,
    LegalAcceptanceCreateView,
    RuntimeConfigView,
)

urlpatterns = [
    path("runtime-config/", RuntimeConfigView.as_view(), name="runtime-config"),
    path("consents/cookies/", CookieConsentCreateView.as_view(), name="cookie-consent"),
    path("consents/legal/", LegalAcceptanceCreateView.as_view(), name="legal-acceptance"),
]
