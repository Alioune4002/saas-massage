from django.db.models import Q
from rest_framework import generics, permissions, parsers

from common.permissions import HasProfessionalProfile, IsProfessionalUser
from .models import ProfessionalProfile
from .serializers import (
    ProfessionalDashboardSerializer,
    PublicProfessionalSerializer,
)


class PublicProfessionalListView(generics.ListAPIView):
    serializer_class = PublicProfessionalSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = (
            ProfessionalProfile.objects.filter(is_public=True)
            .select_related("assistant_profile", "payment_account")
            .prefetch_related("reviews")
            .order_by("business_name")
        )
        city = self.request.query_params.get("city")
        query = self.request.query_params.get("q")
        if city:
            queryset = queryset.filter(city__icontains=city)
        if query:
            queryset = queryset.filter(
                Q(business_name__icontains=query)
                | Q(city__icontains=query)
                | Q(service_area__icontains=query)
                | Q(public_headline__icontains=query)
                | Q(slug__icontains=query)
            )
        return queryset


class PublicProfessionalDetailView(generics.RetrieveAPIView):
    serializer_class = PublicProfessionalSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return (
            ProfessionalProfile.objects.filter(is_public=True)
            .select_related("assistant_profile", "payment_account")
            .prefetch_related("reviews")
        )


class ProfessionalDashboardProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfessionalDashboardSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    def get_object(self):
        return self.request.user.professional_profile
