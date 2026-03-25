import hashlib

from django.conf import settings
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .legal import COOKIE_CONSENT_VERSION, LEGAL_DOCUMENTS
from .serializers import (
    CookieConsentRecordSerializer,
    LegalAcceptanceSerializer,
    RuntimeConfigSerializer,
)


def _request_hashes(request):
    client_ip = (
        request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        or request.META.get("REMOTE_ADDR", "")
    )
    user_agent = request.META.get("HTTP_USER_AGENT", "")
    return {
        "ip_hash": hashlib.sha256(client_ip.encode()).hexdigest() if client_ip else "",
        "user_agent_hash": (
            hashlib.sha256(user_agent.encode()).hexdigest() if user_agent else ""
        ),
    }


class RuntimeConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        serializer = RuntimeConfigSerializer(
            data={
                "features": {
                    "cookie_consent": getattr(
                        settings, "NUADYX_FEATURE_COOKIE_CONSENT", True
                    ),
                    "practitioner_verification": getattr(
                        settings, "NUADYX_FEATURE_PRACTITIONER_VERIFICATION", True
                    ),
                    "review_replies": getattr(
                        settings, "NUADYX_FEATURE_REVIEW_REPLIES", True
                    ),
                },
                "cookie_consent_version": COOKIE_CONSENT_VERSION,
                "legal_documents": LEGAL_DOCUMENTS,
            }
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class CookieConsentCreateView(generics.CreateAPIView):
    serializer_class = CookieConsentRecordSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(_request_hashes(self.request))
        return context


class LegalAcceptanceCreateView(generics.CreateAPIView):
    serializer_class = LegalAcceptanceSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(_request_hashes(self.request))
        return context
