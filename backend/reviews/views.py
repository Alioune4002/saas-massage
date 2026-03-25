import hashlib

from django.conf import settings
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from common.communications import send_review_invitation_email
from common.permissions import HasProfessionalProfile, IsProfessionalUser
from .models import Review, ReviewInvitation, ReviewModerationLog
from .serializers import (
    ProfessionalReviewSerializer,
    ReviewResponseSerializer,
    PublicReviewSerializer,
    PublicReviewSubmissionSerializer,
    ReviewFlagSerializer,
    ReviewInvitationSerializer,
)


class ProfessionalReviewListView(generics.ListAPIView):
    serializer_class = ProfessionalReviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def get_queryset(self):
        return Review.objects.filter(
            professional=self.request.user.professional_profile
        ).order_by("-published_at", "-created_at")


class ReviewInvitationListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewInvitationSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def get_queryset(self):
        return ReviewInvitation.objects.filter(
            professional=self.request.user.professional_profile
        ).order_by("-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["professional"] = self.request.user.professional_profile
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = serializer.save()
        raw_token = serializer.context.get("raw_token", "")
        if raw_token:
            review_url = f"{settings.FRONTEND_APP_URL}/avis/{raw_token}"
            send_review_invitation_email(invitation, review_url)
            invitation.sent_at = invitation.sent_at or invitation.created_at
            invitation.save(update_fields=["sent_at", "updated_at"])
        return Response(self.get_serializer(invitation).data, status=201)


class PublicReviewSubmissionView(generics.CreateAPIView):
    serializer_class = PublicReviewSubmissionSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        return Response(PublicReviewSerializer(review).data, status=201)


class PublicReviewListView(generics.ListAPIView):
    serializer_class = PublicReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        slug = self.kwargs["slug"]
        return Review.objects.filter(
            professional__slug=slug,
            professional__is_public=True,
            status=Review.Status.APPROVED,
        ).order_by("-published_at", "-created_at")


class ReviewInvitationTokenInfoView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "")
        if not token:
            return Response({"valid": False, "reason": "missing"})

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        invitation = ReviewInvitation.objects.filter(token_hash=token_hash).first()
        if not invitation:
            return Response({"valid": False, "reason": "invalid"})
        if invitation.used_at:
            return Response({"valid": False, "reason": "used"})
        if invitation.expires_at < timezone.now():
            return Response({"valid": False, "reason": "expired"})

        return Response(
            {
                "valid": True,
                "first_name": invitation.first_name,
                "professional_name": invitation.professional.business_name,
                "expires_at": invitation.expires_at,
                "used": bool(invitation.used_at),
                "reason": "",
            }
        )


class ProfessionalReviewFlagView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def post(self, request, review_id):
        review = generics.get_object_or_404(
            Review,
            id=review_id,
            professional=request.user.professional_profile,
        )
        serializer = ReviewFlagSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if review.status in {Review.Status.PENDING, Review.Status.HIDDEN}:
            raise ValidationError("Cet avis est déjà signalé.")

        review.status = Review.Status.PENDING
        review.flag_reason = serializer.validated_data["reason"]
        review.moderation_flags = list(dict.fromkeys([*review.moderation_flags, "reported_by_practitioner"]))
        review.save(update_fields=["status", "flag_reason", "moderation_flags", "flagged_at", "updated_at"])
        ReviewModerationLog.objects.create(
            review=review,
            action=ReviewModerationLog.Action.FLAGGED,
            operator=request.user,
            reason=review.flag_reason,
            metadata={"flags": review.moderation_flags},
        )
        return Response(ProfessionalReviewSerializer(review).data)


class ProfessionalReviewResponseView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def post(self, request, review_id):
        review = generics.get_object_or_404(
            Review,
            id=review_id,
            professional=request.user.professional_profile,
        )
        serializer = ReviewResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review.practitioner_response = serializer.validated_data["response"].strip()
        review.save(update_fields=["practitioner_response", "practitioner_responded_at", "updated_at"])
        ReviewModerationLog.objects.create(
            review=review,
            action=ReviewModerationLog.Action.RESPONSE_ADDED,
            operator=request.user,
            reason="Réponse praticien ajoutée.",
        )
        return Response(ProfessionalReviewSerializer(review).data)
