from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from .legal import COOKIE_CONSENT_VERSION, LEGAL_DOCUMENTS
from .models import (
    AdminAnnouncement,
    CookieConsentRecord,
    LegalAcceptanceRecord,
    PageViewEvent,
    PlatformMessage,
)


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


class AdminUserSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)
    role = serializers.CharField()
    admin_role = serializers.CharField(allow_blank=True, required=False)
    is_active = serializers.BooleanField()
    professional_slug = serializers.CharField(allow_blank=True)
    professional_name = serializers.CharField(allow_blank=True)
    city = serializers.CharField(allow_blank=True, required=False)
    bookings_count = serializers.IntegerField(required=False)
    average_rating = serializers.DecimalField(max_digits=4, decimal_places=2, required=False)
    incidents_count = serializers.IntegerField(required=False)
    payments_total_eur = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    public_profile_url = serializers.CharField(allow_blank=True, required=False)
    is_public_profile = serializers.BooleanField(required=False)
    verification_badge_status = serializers.CharField(allow_blank=True, required=False)
    profile_visibility_score = serializers.IntegerField(required=False)
    payment_account_status = serializers.CharField(allow_blank=True, required=False)
    date_joined = serializers.DateTimeField()


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("is_active", "admin_role")


class PageViewEventCreateSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=255)
    page_group = serializers.CharField(max_length=80, required=False, allow_blank=True)
    city_slug = serializers.CharField(max_length=170, required=False, allow_blank=True)
    referrer = serializers.CharField(max_length=255, required=False, allow_blank=True)
    session_key = serializers.CharField(max_length=120, required=False, allow_blank=True)
    metadata = serializers.JSONField(required=False)

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user if getattr(request.user, "is_authenticated", False) else None
        visitor_type = PageViewEvent.VisitorType.ANONYMOUS
        if user:
            visitor_type = (
                PageViewEvent.VisitorType.ADMIN
                if getattr(user, "role", "") == "admin"
                else PageViewEvent.VisitorType.PROFESSIONAL
            )
        return PageViewEvent.objects.create(
            user=user,
            visitor_type=visitor_type,
            path=validated_data["path"][:255],
            page_group=validated_data.get("page_group", "")[:80],
            city_slug=validated_data.get("city_slug", "")[:170],
            referrer=validated_data.get("referrer", "")[:255],
            session_key=validated_data.get("session_key", "")[:120],
            metadata=validated_data.get("metadata", {}),
            occurred_at=timezone.now(),
        )


class PlatformMessageSerializer(serializers.ModelSerializer):
    recipient_email = serializers.EmailField(source="recipient_user.email", read_only=True)
    recipient_name = serializers.SerializerMethodField()
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = PlatformMessage
        fields = (
            "id",
            "recipient_user",
            "recipient_email",
            "recipient_name",
            "category",
            "title",
            "body",
            "display_mode",
            "reply_allowed",
            "is_read",
            "is_active",
            "sent_at",
            "read_at",
            "created_by",
            "created_by_email",
            "metadata",
            "created_at",
        )
        read_only_fields = (
            "id",
            "recipient_email",
            "recipient_name",
            "is_read",
            "sent_at",
            "read_at",
            "created_by_email",
            "created_at",
        )

    def get_recipient_name(self, obj):
        full_name = f"{obj.recipient_user.first_name} {obj.recipient_user.last_name}".strip()
        return full_name or obj.recipient_user.email


class MyPlatformMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformMessage
        fields = (
            "id",
            "category",
            "title",
            "body",
            "display_mode",
            "reply_allowed",
            "is_read",
            "is_active",
            "sent_at",
            "read_at",
        )
        read_only_fields = fields


class AdminAnnouncementSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = AdminAnnouncement
        fields = (
            "id",
            "title",
            "body",
            "audience_role",
            "display_mode",
            "is_active",
            "starts_at",
            "ends_at",
            "created_by",
            "created_by_email",
            "metadata",
            "created_at",
        )
        read_only_fields = ("id", "created_by_email", "created_at")
