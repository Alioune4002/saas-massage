import hashlib
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from bookings.models import Booking

from .models import Review, ReviewInvitation, ReviewModerationLog


class PublicReviewSerializer(serializers.ModelSerializer):
    verification_label = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "author_name",
            "rating",
            "comment",
            "verification_type",
            "verification_label",
            "experience_date",
            "source",
            "practitioner_response",
            "practitioner_responded_at",
            "published_at",
        )

    def get_verification_label(self, obj):
        if obj.verification_type == Review.VerificationType.BOOKED_ON_PLATFORM:
            return "Avis vérifié"
        return obj.get_verification_type_display()


class ReviewInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewInvitation
        fields = (
            "id",
            "first_name",
            "last_name",
            "email",
            "source",
            "expires_at",
            "sent_at",
            "used_at",
            "created_at",
        )
        read_only_fields = ("expires_at", "sent_at", "used_at", "created_at")

    def validate_email(self, value):
        professional = self.context["professional"]
        existing_invitation = ReviewInvitation.objects.filter(
            professional=professional,
            email__iexact=value,
            used_at__isnull=True,
            expires_at__gte=timezone.now(),
        ).exists()
        if existing_invitation:
            raise serializers.ValidationError(
                "Une invitation encore valide existe déjà pour cette adresse."
            )
        if value.lower() == professional.user.email.lower():
            raise serializers.ValidationError(
                "Utilisez une adresse client réelle pour demander un avis."
            )
        return value

    def create(self, validated_data):
        token, token_hash = ReviewInvitation.issue_token()
        invitation = ReviewInvitation.objects.create(
            professional=self.context["professional"],
            created_by=self.context["request"].user,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(days=14),
            **validated_data,
        )
        self.context["raw_token"] = token
        return invitation


class ProfessionalReviewSerializer(serializers.ModelSerializer):
    verification_label = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = (
            "id",
            "author_name",
            "rating",
            "comment",
            "status",
            "source",
            "verification_type",
            "verification_label",
            "experience_date",
            "flag_reason",
            "moderation_flags",
            "practitioner_response",
            "practitioner_responded_at",
            "published_at",
            "created_at",
        )

    def get_verification_label(self, obj):
        if obj.verification_type == Review.VerificationType.BOOKED_ON_PLATFORM:
            return "Avis vérifié"
        return obj.get_verification_type_display()


class ReviewFlagSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=220)


class ReviewResponseSerializer(serializers.Serializer):
    response = serializers.CharField(max_length=1500)


class PublicReviewSubmissionSerializer(serializers.Serializer):
    token = serializers.CharField()
    author_name = serializers.CharField(max_length=160)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=2000)

    def validate(self, attrs):
        token_hash = hashlib.sha256(attrs["token"].encode()).hexdigest()
        try:
            invitation = ReviewInvitation.objects.get(token_hash=token_hash)
        except ReviewInvitation.DoesNotExist:
            raise serializers.ValidationError("Lien d'avis invalide.")

        if invitation.used_at:
            raise serializers.ValidationError("Ce lien d'avis a déjà été utilisé.")

        if invitation.expires_at < timezone.now():
            raise serializers.ValidationError("Ce lien d'avis a expiré.")

        if invitation.professional.user.email.lower() == invitation.email.lower():
            raise serializers.ValidationError("Cette invitation ne peut pas être utilisée pour un auto-avis.")

        if invitation.booking and invitation.booking.fulfillment_status not in {
            Booking.FulfillmentStatus.COMPLETED_BY_PRACTITIONER,
            Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
            Booking.FulfillmentStatus.AUTO_COMPLETED,
        }:
            raise serializers.ValidationError(
                "Cet avis ne peut être publié qu’après une prestation terminée."
            )

        duplicate_review = Review.objects.filter(
            professional=invitation.professional,
            invited_customer_email__iexact=invitation.email,
            author_name__iexact=attrs["author_name"],
            comment__iexact=attrs["comment"].strip(),
        ).exists()
        if duplicate_review:
            raise serializers.ValidationError("Un avis identique existe déjà pour ce client.")

        attrs["invitation"] = invitation
        return attrs

    def create(self, validated_data):
        invitation = validated_data["invitation"]
        request = self.context.get("request")
        comment = validated_data["comment"].strip()
        moderation_flags = []
        normalized_comment = comment.lower()
        if (
            "http://" in normalized_comment
            or "https://" in normalized_comment
            or "www." in normalized_comment
            or "@" in normalized_comment
        ):
            moderation_flags.append("contains_link")
        digits = sum(char.isdigit() for char in comment)
        if digits >= 8:
            moderation_flags.append("contains_contact_details")

        client_ip = ""
        user_agent = ""
        if request:
            client_ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")
            user_agent = request.META.get("HTTP_USER_AGENT", "")

        if client_ip:
            repeated_reviews = Review.objects.filter(
                professional=invitation.professional,
                submitted_from_ip_hash=hashlib.sha256(client_ip.encode()).hexdigest(),
                created_at__gte=timezone.now() - timedelta(days=1),
            ).count()
            if repeated_reviews >= 2:
                moderation_flags.append("rate_limited_ip")

        review = Review.objects.create(
            professional=invitation.professional,
            booking=invitation.booking,
            invitation=invitation,
            invited_customer_email=invitation.email,
            source=(
                Review.Source.BOOKING
                if invitation.source == ReviewInvitation.Source.BOOKING
                else (
                    Review.Source.LEGACY
                    if invitation.source == ReviewInvitation.Source.LEGACY
                    else Review.Source.INVITATION
                )
            ),
            author_name=validated_data["author_name"],
            rating=validated_data["rating"],
            comment=comment,
            status=Review.Status.PENDING if moderation_flags else Review.Status.APPROVED,
            verification_type=(
                Review.VerificationType.BOOKED_ON_PLATFORM
                if invitation.source == ReviewInvitation.Source.BOOKING
                else (
                    Review.VerificationType.IMPORTED_LEGACY_CUSTOMER
                    if invitation.source == ReviewInvitation.Source.LEGACY
                    else Review.VerificationType.INVITED_BY_PRACTITIONER
                )
            ),
            experience_date=(
                invitation.booking.slot.start_at.date()
                if invitation.booking and invitation.booking.slot and invitation.booking.slot.start_at
                else None
            ),
            moderation_flags=moderation_flags,
            flag_reason="Vérification manuelle recommandée." if moderation_flags else "",
            submitted_from_ip_hash=hashlib.sha256(client_ip.encode()).hexdigest() if client_ip else "",
            submitted_from_user_agent_hash=hashlib.sha256(user_agent.encode()).hexdigest() if user_agent else "",
        )
        ReviewModerationLog.objects.create(
            review=review,
            action=ReviewModerationLog.Action.SUBMITTED,
            reason=review.flag_reason,
            metadata={"status": review.status, "flags": review.moderation_flags},
        )
        invitation.used_at = timezone.now()
        invitation.usage_count = invitation.usage_count + 1
        invitation.save(update_fields=["used_at", "usage_count", "updated_at"])
        return review
