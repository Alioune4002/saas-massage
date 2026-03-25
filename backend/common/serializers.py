from django.utils import timezone
from rest_framework import serializers

from .legal import COOKIE_CONSENT_VERSION, LEGAL_DOCUMENTS
from .models import CookieConsentRecord, LegalAcceptanceRecord


class RuntimeConfigSerializer(serializers.Serializer):
    features = serializers.DictField(child=serializers.BooleanField())
    cookie_consent_version = serializers.CharField()
    legal_documents = serializers.DictField()


class CookieConsentRecordSerializer(serializers.Serializer):
    session_key = serializers.CharField(max_length=120, required=False, allow_blank=True)
    source = serializers.ChoiceField(
        choices=CookieConsentRecord.Source.choices,
        default=CookieConsentRecord.Source.BANNER,
    )
    necessary = serializers.BooleanField(default=True)
    analytics = serializers.BooleanField(default=False)
    advertising = serializers.BooleanField(default=False)
    support = serializers.BooleanField(default=False)
    evidence = serializers.JSONField(required=False)
    revoke = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if not attrs.get("necessary", True):
            raise serializers.ValidationError(
                {"necessary": "Les cookies strictement nécessaires restent actifs."}
            )
        attrs["consent_version"] = COOKIE_CONSENT_VERSION
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        consent = CookieConsentRecord.objects.create(
            user=request.user if request.user.is_authenticated else None,
            consent_version=validated_data["consent_version"],
            source=validated_data["source"],
            session_key=validated_data.get("session_key", ""),
            necessary=True,
            analytics=validated_data["analytics"],
            advertising=validated_data["advertising"],
            support=validated_data["support"],
            accepted_at=timezone.now(),
            revoked_at=timezone.now() if validated_data.get("revoke") else None,
            ip_hash=self.context["ip_hash"],
            user_agent_hash=self.context["user_agent_hash"],
            evidence=validated_data.get("evidence", {}),
        )
        return consent


class LegalAcceptanceSerializer(serializers.Serializer):
    document_slug = serializers.ChoiceField(choices=tuple(LEGAL_DOCUMENTS.keys()))
    document_version = serializers.CharField(max_length=40)
    source = serializers.ChoiceField(
        choices=LegalAcceptanceRecord.Source.choices,
        default=LegalAcceptanceRecord.Source.REGISTRATION,
    )
    metadata = serializers.JSONField(required=False)

    def validate(self, attrs):
        expected_version = LEGAL_DOCUMENTS[attrs["document_slug"]]["version"]
        if attrs["document_version"] != expected_version:
            raise serializers.ValidationError(
                {
                    "document_version": (
                        f"La version attendue pour {attrs['document_slug']} est {expected_version}."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user if request.user.is_authenticated else None
        return LegalAcceptanceRecord.objects.create(
            user=user,
            email_snapshot=getattr(user, "email", "") or request.data.get("email", ""),
            document_slug=validated_data["document_slug"],
            document_version=validated_data["document_version"],
            source=validated_data["source"],
            accepted_at=timezone.now(),
            ip_hash=self.context["ip_hash"],
            user_agent_hash=self.context["user_agent_hash"],
            metadata=validated_data.get("metadata", {}),
        )
