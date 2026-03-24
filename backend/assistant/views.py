from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import HasProfessionalProfile, IsProfessionalUser
from professionals.models import ProfessionalProfile
from .engine import generate_assistant_answer
from .models import ProfessionalAssistantProfile
from .serializers import (
    AssistantQuestionSerializer,
    ProfessionalAssistantProfileSerializer,
    PublicAssistantSerializer,
)


class ProfessionalAssistantProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfessionalAssistantProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def get_object(self):
        assistant_profile, _ = ProfessionalAssistantProfile.objects.get_or_create(
            professional=self.request.user.professional_profile,
        )
        return assistant_profile


class ProfessionalAssistantReplyView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def post(self, request):
        serializer = AssistantQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        professional = request.user.professional_profile
        assistant_profile, _ = ProfessionalAssistantProfile.objects.get_or_create(
            professional=professional,
        )

        response_payload = generate_assistant_answer(
            professional=professional,
            assistant=assistant_profile,
            question=serializer.validated_data["question"],
            public_mode=False,
        )

        return Response(response_payload)


class PublicAssistantView(APIView):
    permission_classes = [permissions.AllowAny]

    def get_professional_and_assistant(self, slug: str):
        professional = get_object_or_404(
            ProfessionalProfile.objects.filter(is_public=True),
            slug=slug,
        )
        assistant_profile = ProfessionalAssistantProfile.objects.filter(
            professional=professional,
        ).first()
        if (
            not assistant_profile
            or not assistant_profile.assistant_enabled
            or not assistant_profile.public_assistant_enabled
        ):
            raise PermissionDenied("Assistant indisponible.")
        return professional, assistant_profile

    def get(self, request, slug: str):
        _professional, assistant_profile = self.get_professional_and_assistant(slug)
        return Response(PublicAssistantSerializer(assistant_profile).data)

    def post(self, request, slug: str):
        professional, assistant_profile = self.get_professional_and_assistant(slug)
        serializer = AssistantQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        response_payload = generate_assistant_answer(
            professional=professional,
            assistant=assistant_profile,
            question=serializer.validated_data["question"],
            public_mode=True,
        )

        return Response(response_payload)
