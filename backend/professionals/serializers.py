import json

from rest_framework import serializers
from django.utils import timezone

from reviews.serializers import PublicReviewSerializer

from .models import (
    DirectoryInterestLead,
    DirectoryProfileCandidate,
    DirectoryProfileClaimRequest,
    DirectoryProfileRemovalRequest,
    PractitionerVerification,
    PractitionerVerificationDecision,
    ProfessionalPaymentAccount,
    ProfessionalProfile,
)


class ProfessionalPaymentAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfessionalPaymentAccount
        fields = (
            "provider",
            "onboarding_status",
            "stripe_account_id",
            "account_email",
            "country",
            "default_currency",
            "details_submitted",
            "charges_enabled",
            "payouts_enabled",
        )


class PractitionerVerificationDecisionSerializer(serializers.ModelSerializer):
    decided_by_email = serializers.SerializerMethodField()

    class Meta:
        model = PractitionerVerificationDecision
        fields = (
            "id",
            "from_status",
            "to_status",
            "reason",
            "decided_by_email",
            "created_at",
        )

    def get_decided_by_email(self, obj):
        return getattr(obj.decided_by, "email", "")


class PractitionerVerificationSerializer(serializers.ModelSerializer):
    identity_document_url = serializers.SerializerMethodField()
    selfie_document_url = serializers.SerializerMethodField()
    activity_document_url = serializers.SerializerMethodField()
    liability_insurance_document_url = serializers.SerializerMethodField()
    iban_document_url = serializers.SerializerMethodField()
    badge_is_active = serializers.SerializerMethodField()
    badge_tooltip = serializers.SerializerMethodField()
    decisions = PractitionerVerificationDecisionSerializer(many=True, read_only=True)

    class Meta:
        model = PractitionerVerification
        fields = (
            "status",
            "siren",
            "siret",
            "beneficiary_name",
            "iban_last4",
            "identity_document",
            "identity_document_url",
            "selfie_document",
            "selfie_document_url",
            "activity_document",
            "activity_document_url",
            "liability_insurance_document",
            "liability_insurance_document_url",
            "iban_document",
            "iban_document_url",
            "submitted_at",
            "reviewed_at",
            "verified_at",
            "expires_at",
            "rejection_reason",
            "internal_notes",
            "badge_is_active",
            "badge_tooltip",
            "decisions",
        )
        read_only_fields = (
            "status",
            "submitted_at",
            "reviewed_at",
            "verified_at",
            "expires_at",
            "rejection_reason",
            "internal_notes",
            "badge_is_active",
            "badge_tooltip",
            "decisions",
        )
        extra_kwargs = {
            "identity_document": {"write_only": True, "required": False},
            "selfie_document": {"write_only": True, "required": False},
            "activity_document": {"write_only": True, "required": False},
            "liability_insurance_document": {"write_only": True, "required": False},
            "iban_document": {"write_only": True, "required": False},
            "internal_notes": {"required": False},
        }

    def get_identity_document_url(self, obj):
        return self._build_file_url(obj.identity_document)

    def get_selfie_document_url(self, obj):
        return self._build_file_url(obj.selfie_document)

    def get_activity_document_url(self, obj):
        return self._build_file_url(obj.activity_document)

    def get_liability_insurance_document_url(self, obj):
        return self._build_file_url(obj.liability_insurance_document)

    def get_iban_document_url(self, obj):
        return self._build_file_url(obj.iban_document)

    def get_badge_is_active(self, obj):
        return obj.badge_is_active

    def get_badge_tooltip(self, _obj):
        return (
            "Ce badge signifie qu’une vérification documentaire d’identité "
            "et/ou d’activité a été effectuée par NUADYX à une date donnée. "
            "Il ne garantit pas la qualité des prestations."
        )

    def _build_file_url(self, field):
        request = self.context.get("request")
        if not field:
            return ""
        url = field.url
        return request.build_absolute_uri(url) if request else url

    def update(self, instance, validated_data):
        uploaded_document = False
        for field in (
            "identity_document",
            "selfie_document",
            "activity_document",
            "liability_insurance_document",
            "iban_document",
        ):
            if field in validated_data:
                uploaded_document = True
                file_value = validated_data.pop(field)
                current_file = getattr(instance, field)
                if current_file:
                    current_file.delete(save=False)
                setattr(instance, field, file_value)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if uploaded_document and instance.status == PractitionerVerification.Status.NOT_STARTED:
            instance.status = PractitionerVerification.Status.PENDING
            instance.submitted_at = instance.submitted_at or timezone.now()

        instance.save()
        return instance


class PublicProfessionalSerializer(serializers.ModelSerializer):
    profile_photo_url = serializers.SerializerMethodField()
    cover_photo_url = serializers.SerializerMethodField()
    practice_information = serializers.SerializerMethodField()
    before_session = serializers.SerializerMethodField()
    after_session = serializers.SerializerMethodField()
    booking_policy = serializers.SerializerMethodField()
    contact_information = serializers.SerializerMethodField()
    faq_items = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    review_average = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    verification_badge = serializers.SerializerMethodField()

    class Meta:
        model = ProfessionalProfile
        fields = (
            "id",
            "business_name",
            "slug",
            "activity_type",
            "practice_mode",
            "city",
            "service_area",
            "venue_details",
            "access_details",
            "ambience_details",
            "equipment_provided",
            "client_preparation",
            "ideal_for",
            "highlight_points",
            "bio",
            "public_headline",
            "specialties",
            "visual_theme",
            "phone",
            "public_email",
            "accepts_online_booking",
            "reservation_payment_mode",
            "deposit_value_type",
            "deposit_value",
            "free_cancellation_notice_hours",
            "keep_payment_after_deadline",
            "payment_message",
            "profile_photo_url",
            "cover_photo_url",
            "practice_information",
            "before_session",
            "after_session",
            "booking_policy",
            "contact_information",
            "faq_items",
            "reviews",
            "review_average",
            "review_count",
            "verification_badge",
        )

    def get_profile_photo_url(self, obj):
        request = self.context.get("request")
        if not obj.profile_photo:
            return ""
        url = obj.profile_photo.url
        return request.build_absolute_uri(url) if request else url

    def get_cover_photo_url(self, obj):
        request = self.context.get("request")
        if not obj.cover_photo:
            return ""
        url = obj.cover_photo.url
        return request.build_absolute_uri(url) if request else url

    def get_practice_information(self, obj):
        assistant = self._get_assistant_profile(obj)
        return assistant.practice_information if assistant else ""

    def get_before_session(self, obj):
        assistant = self._get_assistant_profile(obj)
        return assistant.before_session if assistant else ""

    def get_after_session(self, obj):
        assistant = self._get_assistant_profile(obj)
        return assistant.after_session if assistant else ""

    def get_booking_policy(self, obj):
        assistant = self._get_assistant_profile(obj)
        return assistant.booking_policy if assistant else ""

    def get_contact_information(self, obj):
        assistant = self._get_assistant_profile(obj)
        return assistant.contact_information if assistant else ""

    def get_faq_items(self, obj):
        assistant = self._get_assistant_profile(obj)
        return assistant.faq_items if assistant else []

    def get_reviews(self, obj):
        queryset = obj.reviews.filter(status="approved").order_by("-published_at", "-created_at")[:6]
        return PublicReviewSerializer(queryset, many=True).data

    def get_review_average(self, obj):
        published = obj.reviews.filter(status="approved")
        if not published.exists():
            return None
        average = sum(review.rating for review in published) / published.count()
        return round(average, 1)

    def get_review_count(self, obj):
        return obj.reviews.filter(status="approved").count()

    def get_verification_badge(self, obj):
        verification = getattr(obj, "verification", None)
        if not verification or not verification.badge_is_active:
            return None
        return {
            "label": "Praticien vérifié",
            "verified_at": verification.verified_at,
            "expires_at": verification.expires_at,
            "tooltip": (
                "Ce badge signifie qu’une vérification documentaire d’identité "
                "et/ou d’activité a été effectuée par NUADYX à une date donnée. "
                "Il ne garantit pas la qualité des prestations."
            ),
        }

    def _get_assistant_profile(self, obj):
        try:
            return obj.assistant_profile
        except ProfessionalProfile.assistant_profile.RelatedObjectDoesNotExist:
            return None


class ProfessionalDashboardSerializer(serializers.ModelSerializer):
    owner_first_name = serializers.CharField(
        source="user.first_name", required=False, allow_blank=True
    )
    owner_last_name = serializers.CharField(
        source="user.last_name", required=False, allow_blank=True
    )
    login_email = serializers.EmailField(source="user.email", required=False)
    profile_photo = serializers.FileField(write_only=True, required=False, allow_null=True)
    cover_photo = serializers.FileField(write_only=True, required=False, allow_null=True)
    profile_photo_url = serializers.SerializerMethodField(read_only=True)
    cover_photo_url = serializers.SerializerMethodField(read_only=True)
    remove_profile_photo = serializers.BooleanField(write_only=True, required=False, default=False)
    remove_cover_photo = serializers.BooleanField(write_only=True, required=False, default=False)
    payment_account = serializers.SerializerMethodField(read_only=True)
    verification = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProfessionalProfile
        fields = (
            "id",
            "business_name",
            "slug",
            "owner_first_name",
            "owner_last_name",
            "login_email",
            "activity_type",
            "practice_mode",
            "city",
            "service_area",
            "venue_details",
            "access_details",
            "ambience_details",
            "equipment_provided",
            "client_preparation",
            "ideal_for",
            "highlight_points",
            "bio",
            "public_headline",
            "specialties",
            "visual_theme",
            "phone",
            "public_email",
            "is_public",
            "accepts_online_booking",
            "reservation_payment_mode",
            "deposit_value_type",
            "deposit_value",
            "free_cancellation_notice_hours",
            "keep_payment_after_deadline",
            "payment_message",
            "profile_photo",
            "cover_photo",
            "profile_photo_url",
            "cover_photo_url",
            "payment_account",
            "verification",
            "remove_profile_photo",
            "remove_cover_photo",
            "onboarding_step",
            "onboarding_completed",
        )

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()

        specialties = data.get("specialties")
        if isinstance(specialties, str):
            try:
                parsed = json.loads(specialties)
                data["specialties"] = parsed
            except json.JSONDecodeError:
                data["specialties"] = [
                    item.strip() for item in specialties.split(",") if item.strip()
                ]

        highlight_points = data.get("highlight_points")
        if isinstance(highlight_points, str):
            try:
                parsed = json.loads(highlight_points)
                data["highlight_points"] = parsed
            except json.JSONDecodeError:
                data["highlight_points"] = [
                    item.strip() for item in highlight_points.split("\n") if item.strip()
                ]

        return super().to_internal_value(data)

    def validate_slug(self, value: str):
        queryset = ProfessionalProfile.objects.exclude(pk=self.instance.pk if self.instance else None)
        if queryset.filter(slug=value).exists():
            raise serializers.ValidationError("Ce lien public est déjà utilisé.")
        return value

    def validate_login_email(self, value: str):
        normalized = value.strip().lower()
        queryset = self.instance.user.__class__.objects.exclude(
            pk=self.instance.user_id if self.instance else None
        )
        if queryset.filter(email=normalized).exists():
            raise serializers.ValidationError(
                "Un compte existe déjà avec cette adresse email."
            )
        return normalized

    def validate_public_headline(self, value: str):
        if len(value) > 180:
            raise serializers.ValidationError(
                "La phrase courte doit contenir 180 caractères maximum."
            )
        return value

    def validate_specialties(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Les spécialités doivent être une liste.")

        cleaned = [str(item).strip() for item in value if str(item).strip()]
        return cleaned[:8]

    def validate_highlight_points(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Les points forts doivent être une liste.")

        cleaned = [str(item).strip() for item in value if str(item).strip()]
        return cleaned[:3]

    def validate_onboarding_step(self, value: str):
        valid_values = {choice for choice, _label in ProfessionalProfile.OnboardingStep.choices}
        if value not in valid_values:
            raise serializers.ValidationError("Étape d’accompagnement invalide.")
        return value

    def validate_profile_photo(self, value):
        return self._validate_image_file(value, "photo de profil")

    def validate_cover_photo(self, value):
        return self._validate_image_file(value, "photo de couverture")

    def _validate_image_file(self, value, field_label: str):
        content_type = getattr(value, "content_type", "")
        if content_type and not content_type.startswith("image/"):
            raise serializers.ValidationError(
                f"La {field_label} doit être un fichier image."
            )

        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError(
                f"La {field_label} ne doit pas dépasser 5 Mo."
            )

        return value

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        profile_photo = validated_data.pop("profile_photo", None)
        cover_photo = validated_data.pop("cover_photo", None)
        remove_profile_photo = validated_data.pop("remove_profile_photo", False)
        remove_cover_photo = validated_data.pop("remove_cover_photo", False)

        if user_data:
            for field, value in user_data.items():
                setattr(instance.user, field, value)
            instance.user.save(update_fields=list(user_data.keys()))

        if remove_profile_photo and instance.profile_photo:
            instance.profile_photo.delete(save=False)
            instance.profile_photo = None

        if remove_cover_photo and instance.cover_photo:
            instance.cover_photo.delete(save=False)
            instance.cover_photo = None

        if profile_photo is not None:
            if instance.profile_photo:
                instance.profile_photo.delete(save=False)
            instance.profile_photo = profile_photo

        if cover_photo is not None:
            if instance.cover_photo:
                instance.cover_photo.delete(save=False)
            instance.cover_photo = cover_photo

        return super().update(instance, validated_data)

    def get_profile_photo_url(self, obj):
        request = self.context.get("request")
        if not obj.profile_photo:
            return ""
        url = obj.profile_photo.url
        return request.build_absolute_uri(url) if request else url

    def get_cover_photo_url(self, obj):
        request = self.context.get("request")
        if not obj.cover_photo:
            return ""
        url = obj.cover_photo.url
        return request.build_absolute_uri(url) if request else url

    def get_payment_account(self, obj):
        account = getattr(obj, "payment_account", None)
        if not account:
            return None
        return ProfessionalPaymentAccountSerializer(account).data

    def get_verification(self, obj):
        verification, _created = PractitionerVerification.objects.get_or_create(
            professional=obj
        )
        verification.refresh_expired_status()
        return PractitionerVerificationSerializer(
            verification,
            context=self.context,
        ).data


class PublicDirectoryListingSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    listing_kind = serializers.ChoiceField(choices=("claimed", "unclaimed"))
    listing_url = serializers.CharField()
    business_name = serializers.CharField()
    slug = serializers.CharField()
    city = serializers.CharField(allow_blank=True)
    service_area = serializers.CharField(allow_blank=True)
    public_headline = serializers.CharField(allow_blank=True)
    bio = serializers.CharField(allow_blank=True)
    specialties = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    massage_categories = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    visual_theme = serializers.CharField(allow_blank=True)
    profile_photo_url = serializers.CharField(allow_blank=True)
    cover_photo_url = serializers.CharField(allow_blank=True)
    accepts_online_booking = serializers.BooleanField()
    verification_badge = serializers.JSONField(allow_null=True)
    claim_notice = serializers.CharField(allow_blank=True)


class PublicDirectoryCandidateSerializer(serializers.ModelSerializer):
    listing_kind = serializers.SerializerMethodField()
    listing_url = serializers.SerializerMethodField()
    claim_notice = serializers.SerializerMethodField()

    class Meta:
        model = DirectoryProfileCandidate
        fields = (
            "id",
            "listing_kind",
            "listing_url",
            "business_name",
            "slug",
            "city",
            "service_area",
            "public_headline",
            "bio",
            "specialties",
            "massage_categories",
            "claim_notice",
        )

    def get_listing_kind(self, _obj):
        return "unclaimed"

    def get_listing_url(self, obj):
        return f"/fiches/{obj.slug}"

    def get_claim_notice(self, _obj):
        return (
            "Informations de base publiées à titre indicatif. "
            "Le praticien peut compléter, corriger ou demander la suppression de cette fiche."
        )


class DirectoryProfileCandidateDetailSerializer(serializers.ModelSerializer):
    claim_notice = serializers.SerializerMethodField()

    class Meta:
        model = DirectoryProfileCandidate
        fields = (
            "id",
            "status",
            "business_name",
            "slug",
            "city",
            "service_area",
            "public_headline",
            "bio",
            "specialties",
            "massage_categories",
            "source_label",
            "source_url",
            "imported_at",
            "claim_notice",
        )

    def get_claim_notice(self, _obj):
        return (
            "Cette fiche n’est pas encore revendiquée. "
            "Aucune réservation ou demande client n’est générée automatiquement à partir de cette page."
        )


class DirectoryProfileClaimRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectoryProfileClaimRequest
        fields = ("claimant_name", "claimant_email", "claimant_phone", "message")


class DirectoryProfileRemovalRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectoryProfileRemovalRequest
        fields = ("requester_name", "requester_email", "reason")


class DirectoryInterestLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectoryInterestLead
        fields = (
            "kind",
            "full_name",
            "email",
            "city",
            "practitioner_name",
            "message",
            "source_page",
        )
