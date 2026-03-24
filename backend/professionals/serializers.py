import json

from rest_framework import serializers

from reviews.serializers import PublicReviewSerializer

from .models import ProfessionalPaymentAccount, ProfessionalProfile


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
        queryset = obj.reviews.filter(status="published").order_by("-published_at", "-created_at")[:6]
        return PublicReviewSerializer(queryset, many=True).data

    def get_review_average(self, obj):
        published = obj.reviews.filter(status="published")
        if not published.exists():
            return None
        average = sum(review.rating for review in published) / published.count()
        return round(average, 1)

    def get_review_count(self, obj):
        return obj.reviews.filter(status="published").count()

    def _get_assistant_profile(self, obj):
        try:
            return obj.assistant_profile
        except ProfessionalProfile.assistant_profile.RelatedObjectDoesNotExist:
            return None


class ProfessionalDashboardSerializer(serializers.ModelSerializer):
    profile_photo = serializers.FileField(write_only=True, required=False, allow_null=True)
    cover_photo = serializers.FileField(write_only=True, required=False, allow_null=True)
    profile_photo_url = serializers.SerializerMethodField(read_only=True)
    cover_photo_url = serializers.SerializerMethodField(read_only=True)
    remove_profile_photo = serializers.BooleanField(write_only=True, required=False, default=False)
    remove_cover_photo = serializers.BooleanField(write_only=True, required=False, default=False)
    payment_account = serializers.SerializerMethodField(read_only=True)

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
        profile_photo = validated_data.pop("profile_photo", None)
        cover_photo = validated_data.pop("cover_photo", None)
        remove_profile_photo = validated_data.pop("remove_profile_photo", False)
        remove_cover_photo = validated_data.pop("remove_cover_photo", False)

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
