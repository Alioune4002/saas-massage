from django.db.models import Q
from rest_framework import generics, permissions, viewsets

from common.permissions import HasProfessionalProfile, IsProfessionalUser
from .models import MassageService, SERVICE_CATEGORY_KEYWORDS
from .serializers import (
    ProfessionalMassageServiceSerializer,
    PublicMassageServiceSerializer,
)


class PublicMassageServiceListView(generics.ListAPIView):
    serializer_class = PublicMassageServiceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = (
            MassageService.objects.select_related("professional")
            .filter(is_active=True, professional__is_public=True)
            .order_by("sort_order", "duration_minutes", "title")
        )

        professional_slug = self.request.query_params.get("professional")
        category = self.request.query_params.get("category")
        if professional_slug:
            queryset = queryset.filter(professional__slug=professional_slug)
        if category:
            keywords = SERVICE_CATEGORY_KEYWORDS.get(category, ())
            keyword_filter = Q(service_category=category)
            for keyword in keywords:
                keyword_filter |= Q(title__icontains=keyword)
                keyword_filter |= Q(short_description__icontains=keyword)
                keyword_filter |= Q(full_description__icontains=keyword)
            queryset = queryset.filter(keyword_filter)

        return queryset


class ProfessionalServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ProfessionalMassageServiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def get_queryset(self):
        return MassageService.objects.filter(
            professional=self.request.user.professional_profile
        ).order_by("sort_order", "duration_minutes", "title")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["professional"] = self.request.user.professional_profile
        return context
