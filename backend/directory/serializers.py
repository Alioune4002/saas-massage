from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from common.legal import LEGAL_DOCUMENTS, get_required_practitioner_registration_documents
from common.models import LegalAcceptanceRecord
from professionals.models import ProfessionalProfile
from professionals.serializers import PublicProfessionalSerializer

from .models import (
    AuditLog,
    ContactCampaign,
    ContactMessageLog,
    ImportedProfile,
    PractitionerClaim,
    RemovalRequest,
    SourceImportJob,
    SourceRegistry,
)

User = get_user_model()


class SourceRegistrySerializer(serializers.ModelSerializer):
    reviewed_by_email = serializers.SerializerMethodField()

    class Meta:
        model = SourceRegistry
        fields = (
            "id",
            "name",
            "base_url",
            "source_type",
            "is_active",
            "legal_status",
            "tos_url",
            "robots_url",
            "notes_internal",
            "import_policy_json",
            "allowed_fields_json",
            "requires_manual_review_before_publish",
            "can_contact_imported_profiles",
            "default_visibility_mode",
            "created_at",
            "updated_at",
            "reviewed_by",
            "reviewed_by_email",
            "reviewed_at",
        )

    def get_reviewed_by_email(self, obj):
        return getattr(obj.reviewed_by, "email", "")


class SourceImportJobSerializer(serializers.ModelSerializer):
    source_name = serializers.SerializerMethodField()
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = SourceImportJob
        fields = (
            "id",
            "source",
            "source_name",
            "trigger_type",
            "status",
            "started_at",
            "finished_at",
            "created_by",
            "created_by_email",
            "total_seen",
            "total_created",
            "total_updated",
            "total_skipped",
            "total_flagged",
            "error_log_text",
            "raw_report_json",
            "created_at",
            "updated_at",
        )

    def get_source_name(self, obj):
        return obj.source.name

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", "")


class ImportedProfileSerializer(serializers.ModelSerializer):
    source_name = serializers.SerializerMethodField()
    reviewed_by_email = serializers.SerializerMethodField()
    duplicate_signals = serializers.SerializerMethodField()

    class Meta:
        model = ImportedProfile
        fields = (
            "id",
            "source",
            "source_name",
            "source_job",
            "external_id",
            "source_url",
            "source_snapshot_json",
            "imported_at",
            "last_seen_at",
            "import_status",
            "dedupe_key",
            "confidence_score",
            "review_notes",
            "reviewed_by",
            "reviewed_by_email",
            "reviewed_at",
            "slug",
            "public_name",
            "business_name",
            "first_name",
            "last_name",
            "city",
            "postal_code",
            "region",
            "country",
            "phone_public",
            "email_public",
            "website_url",
            "instagram_url",
            "service_tags_json",
            "practice_modes_json",
            "bio_short",
            "address_public_text",
            "has_public_booking_link",
            "public_status_note",
            "contains_personal_data",
            "contact_allowed_based_on_source_policy",
            "publishable_minimum_ok",
            "removal_requested",
            "claimable",
            "is_public",
            "duplicate_signals",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {
            "source": {"required": False},
            "source_job": {"required": False, "allow_null": True},
            "slug": {"required": False},
            "dedupe_key": {"required": False},
            "confidence_score": {"required": False},
            "review_notes": {"required": False},
            "reviewed_by": {"required": False, "allow_null": True},
            "reviewed_at": {"required": False, "allow_null": True},
            "source_snapshot_json": {"required": False},
            "country": {"required": False},
            "service_tags_json": {"required": False},
            "practice_modes_json": {"required": False},
        }

    def get_source_name(self, obj):
        return obj.source.name

    def get_reviewed_by_email(self, obj):
        return getattr(obj.reviewed_by, "email", "")

    def get_duplicate_signals(self, obj):
        if not obj.review_notes:
            return []
        if obj.review_notes.startswith("Signaux doublon: "):
            values = obj.review_notes.replace("Signaux doublon: ", "", 1)
            return [value.strip() for value in values.split(",") if value.strip()]
        return []


class PractitionerClaimSerializer(serializers.ModelSerializer):
    imported_profile_name = serializers.SerializerMethodField()

    class Meta:
        model = PractitionerClaim
        fields = (
            "id",
            "imported_profile",
            "imported_profile_name",
            "practitioner_user",
            "email",
            "token",
            "status",
            "verification_method",
            "sent_at",
            "viewed_at",
            "verified_at",
            "approved_at",
            "expires_at",
            "decision_notes",
            "created_at",
            "updated_at",
        )

    def get_imported_profile_name(self, obj):
        return obj.imported_profile.public_name


class RemovalRequestSerializer(serializers.ModelSerializer):
    imported_profile_name = serializers.SerializerMethodField()

    class Meta:
        model = RemovalRequest
        fields = (
            "id",
            "imported_profile",
            "imported_profile_name",
            "requester_email",
            "requester_name",
            "reason",
            "status",
            "created_at",
            "resolved_at",
            "resolved_by",
            "notes",
            "updated_at",
        )

    def get_imported_profile_name(self, obj):
        return obj.imported_profile.public_name if obj.imported_profile else ""


class ContactCampaignSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()
    approved_by_email = serializers.SerializerMethodField()

    class Meta:
        model = ContactCampaign
        fields = (
            "id",
            "name",
            "source",
            "campaign_type",
            "status",
            "audience_filter_json",
            "email_template_key",
            "created_by",
            "created_by_email",
            "approved_by",
            "approved_by_email",
            "created_at",
            "approved_at",
            "total_targets",
            "total_sent",
            "total_failed",
            "updated_at",
        )
        extra_kwargs = {
            "created_by": {"required": False, "allow_null": True},
            "approved_by": {"required": False, "allow_null": True},
        }

    def get_created_by_email(self, obj):
        return getattr(obj.created_by, "email", "")

    def get_approved_by_email(self, obj):
        return getattr(obj.approved_by, "email", "")


class ContactMessageLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessageLog
        fields = (
            "id",
            "campaign",
            "imported_profile",
            "to_email",
            "template_key",
            "message_type",
            "status",
            "provider_message_id",
            "sent_at",
            "meta_json",
            "created_at",
            "updated_at",
        )


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_email",
            "action",
            "object_type",
            "object_id",
            "before_json",
            "after_json",
            "created_at",
            "updated_at",
        )

    def get_actor_email(self, obj):
        return getattr(obj.actor, "email", "")


class ImportedProfileBulkActionSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)
    action = serializers.ChoiceField(
        choices=(
            "approve_internal",
            "publish_unclaimed",
            "reject",
            "mark_removed",
            "send_claim_invite",
            "merge",
            "export_csv",
        )
    )
    target_id = serializers.UUIDField(required=False)


class PublicImportedProfileSerializer(serializers.ModelSerializer):
    listing_kind = serializers.SerializerMethodField()
    listing_url = serializers.SerializerMethodField()
    claim_notice = serializers.SerializerMethodField()

    class Meta:
        model = ImportedProfile
        fields = (
            "id",
            "listing_kind",
            "listing_url",
            "slug",
            "public_name",
            "business_name",
            "city",
            "region",
            "phone_public",
            "email_public",
            "website_url",
            "instagram_url",
            "service_tags_json",
            "practice_modes_json",
            "bio_short",
            "address_public_text",
            "has_public_booking_link",
            "public_status_note",
            "claim_notice",
        )

    def get_listing_kind(self, _obj):
        return "unclaimed"

    def get_listing_url(self, obj):
        return f"/praticiens/{obj.slug}"

    def get_claim_notice(self, _obj):
        return "Vous êtes ce praticien ? Revendiquez cette fiche pour la compléter et la gérer."


class UnifiedPublicPractitionerSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("claimed", "unclaimed"))
    claimed_profile = serializers.SerializerMethodField()
    imported_profile = serializers.SerializerMethodField()

    def get_claimed_profile(self, obj):
        if obj["kind"] != "claimed":
            return None
        return PublicProfessionalSerializer(
            obj["claimed_profile"],
            context=self.context,
        ).data

    def get_imported_profile(self, obj):
        if obj["kind"] != "unclaimed":
            return None
        return PublicImportedProfileSerializer(
            obj["imported_profile"],
            context=self.context,
        ).data


class ClaimRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ClaimVerifySerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)


class ClaimCompleteOnboardingSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    business_name = serializers.CharField(max_length=160, required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    password = serializers.CharField(required=False, write_only=True, min_length=8)
    password_confirmation = serializers.CharField(required=False, write_only=True, min_length=8)
    accepted_documents = serializers.ListField(
        child=serializers.CharField(max_length=60),
        required=False,
        allow_empty=True,
    )

    def validate(self, attrs):
        request = self.context["request"]
        if request.user.is_authenticated:
            if request.user.role != User.Role.PROFESSIONAL:
                raise serializers.ValidationError(
                    "Connectez-vous avec un compte praticien ou utilisez un lien de revendication anonyme."
                )
            return attrs

        required_signup_fields = ("email", "password", "password_confirmation")
        missing = [field for field in required_signup_fields if not attrs.get(field)]
        if missing:
            raise serializers.ValidationError(
                {field: "Ce champ est requis pour créer votre compte." for field in missing}
            )
        if attrs["password"] != attrs["password_confirmation"]:
            raise serializers.ValidationError(
                {"password_confirmation": "Les mots de passe ne correspondent pas."}
            )
        required_documents = set(get_required_practitioner_registration_documents())
        accepted_documents = {slug.strip() for slug in attrs.get("accepted_documents", []) if slug.strip()}
        missing_documents = sorted(required_documents - accepted_documents)
        if missing_documents:
            raise serializers.ValidationError(
                {
                    "accepted_documents": (
                        "Les documents suivants doivent être acceptés : "
                        + ", ".join(missing_documents)
                    )
                }
            )
        return attrs

    def save(self, *, claim: PractitionerClaim):
        request = self.context["request"]
        imported_profile = claim.imported_profile
        user = request.user if request.user.is_authenticated else None

        if not user:
            email = self.validated_data["email"].strip().lower()
            if User.objects.filter(email=email).exists():
                raise serializers.ValidationError(
                    {"email": "Un compte existe déjà avec cette adresse email."}
                )
            user = User.objects.create_user(
                email=email,
                username=email,
                password=self.validated_data["password"],
                first_name=self.validated_data.get("first_name", "").strip(),
                last_name=self.validated_data.get("last_name", "").strip(),
                role=User.Role.PROFESSIONAL,
            )
            for document_slug in self.validated_data.get("accepted_documents", []):
                if document_slug not in LEGAL_DOCUMENTS:
                    continue
                LegalAcceptanceRecord.objects.create(
                    user=user,
                    email_snapshot=email,
                    document_slug=document_slug,
                    document_version=LEGAL_DOCUMENTS[document_slug]["version"],
                    source=LegalAcceptanceRecord.Source.REGISTRATION,
                    accepted_at=timezone.now(),
                )

        profile, _created = ProfessionalProfile.objects.get_or_create(
            user=user,
            defaults={
                "business_name": self.validated_data.get("business_name") or imported_profile.business_name or imported_profile.public_name,
                "slug": imported_profile.slug,
                "city": imported_profile.city,
                "service_area": imported_profile.region,
                "bio": imported_profile.bio_short,
                "public_headline": imported_profile.public_status_note,
                "specialties": imported_profile.service_tags_json,
                "phone": imported_profile.phone_public,
                "public_email": imported_profile.email_public,
                "is_public": False,
                "accepts_online_booking": False,
                "profile_claimed_from_import": True,
                "imported_profile_origin": imported_profile,
                "verification_badge_status": ProfessionalProfile.VerificationBadgeStatus.NONE,
                "acquisition_source": ProfessionalProfile.AcquisitionSource.IMPORTED_CLAIMED,
            },
        )
        if not _created:
            profile.business_name = self.validated_data.get("business_name") or profile.business_name or imported_profile.business_name or imported_profile.public_name
            profile.city = profile.city or imported_profile.city
            profile.service_area = profile.service_area or imported_profile.region
            profile.bio = profile.bio or imported_profile.bio_short
            profile.public_headline = profile.public_headline or imported_profile.public_status_note
            profile.specialties = profile.specialties or imported_profile.service_tags_json
            profile.phone = profile.phone or imported_profile.phone_public
            profile.public_email = profile.public_email or imported_profile.email_public
            profile.profile_claimed_from_import = True
            profile.imported_profile_origin = imported_profile
            profile.acquisition_source = ProfessionalProfile.AcquisitionSource.IMPORTED_CLAIMED
            profile.save()

        imported_profile.import_status = ImportedProfile.ImportStatus.CLAIMED
        imported_profile.is_public = False
        imported_profile.claimable = False
        imported_profile.save(update_fields=["import_status", "is_public", "claimable", "updated_at"])

        claim.practitioner_user = user
        claim.status = PractitionerClaim.Status.APPROVED
        claim.verified_at = claim.verified_at or timezone.now()
        claim.approved_at = timezone.now()
        claim.save(update_fields=["practitioner_user", "status", "verified_at", "approved_at", "updated_at"])

        token, _ = Token.objects.get_or_create(user=user)
        return {"user": user, "profile": profile, "token": token}


class MeClaimStatusSerializer(serializers.Serializer):
    has_import_origin = serializers.BooleanField()
    imported_profile_id = serializers.CharField()
    imported_profile_status = serializers.CharField()
    imported_profile_slug = serializers.CharField()


class CompleteProfileFromImportSerializer(serializers.Serializer):
    imported_profile_id = serializers.UUIDField(required=False)
    claim_token = serializers.CharField(max_length=64, required=False)

    def validate(self, attrs):
        if not attrs.get("imported_profile_id") and not attrs.get("claim_token"):
            raise serializers.ValidationError("Fournissez un identifiant de fiche importée ou un token de revendication.")
        return attrs
