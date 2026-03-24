import hashlib
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import Review, ReviewInvitation


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
            "published_at",
        )

    def get_verification_label(self, obj):
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
            "verification_type",
            "verification_label",
            "flag_reason",
            "moderation_flags",
            "published_at",
            "created_at",
        )

    def get_verification_label(self, obj):
        return obj.get_verification_type_display()


class ReviewFlagSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=220)


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
        if "http://" in comment.lower() or "https://" in comment.lower() or "www." in comment.lower():
            moderation_flags.append("contains_link")

        client_ip = ""
        user_agent = ""
        if request:
            client_ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")
            user_agent = request.META.get("HTTP_USER_AGENT", "")

        review = Review.objects.create(
            professional=invitation.professional,
            booking=invitation.booking,
            invitation=invitation,
            invited_customer_email=invitation.email,
            author_name=validated_data["author_name"],
            rating=validated_data["rating"],
            comment=comment,
            status=Review.Status.FLAGGED if moderation_flags else Review.Status.PUBLISHED,
            verification_type=(
                Review.VerificationType.BOOKED_ON_PLATFORM
                if invitation.source == ReviewInvitation.Source.BOOKING
                else (
                    Review.VerificationType.IMPORTED_LEGACY_CUSTOMER
                    if invitation.source == ReviewInvitation.Source.LEGACY
                    else Review.VerificationType.INVITED_BY_PRACTITIONER
                )
            ),
            moderation_flags=moderation_flags,
            flag_reason="Vérification manuelle recommandée." if moderation_flags else "",
            submitted_from_ip_hash=hashlib.sha256(client_ip.encode()).hexdigest() if client_ip else "",
            submitted_from_user_agent_hash=hashlib.sha256(user_agent.encode()).hexdigest() if user_agent else "",
        )
        invitation.used_at = timezone.now()
        invitation.usage_count = invitation.usage_count + 1
        invitation.save(update_fields=["used_at", "usage_count", "updated_at"])
        return review
