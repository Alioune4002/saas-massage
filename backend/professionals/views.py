from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, parsers
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import HasProfessionalProfile, IsProfessionalUser
from services.models import MassageService, SERVICE_CATEGORY_KEYWORDS

from .models import (
    DirectoryInterestLead,
    DirectoryProfileCandidate,
    DirectoryProfileClaimRequest,
    DirectoryProfileRemovalRequest,
    PractitionerVerification,
    ProfessionalProfile,
)
from .serializers import (
    DirectoryInterestLeadSerializer,
    DirectoryProfileCandidateDetailSerializer,
    DirectoryProfileClaimRequestSerializer,
    DirectoryProfileRemovalRequestSerializer,
    PractitionerVerificationSerializer,
    PublicDirectoryCandidateSerializer,
    PublicDirectoryListingSerializer,
    ProfessionalDashboardSerializer,
    PublicProfessionalSerializer,
)


def _filter_profiles_by_category(queryset, category: str):
    keywords = SERVICE_CATEGORY_KEYWORDS.get(category, ())
    service_queryset = MassageService.objects.filter(
        professional__in=queryset,
        professional__is_public=True,
        is_active=True,
    )
    service_filter = Q(service_category=category)
    for keyword in keywords:
        service_filter |= Q(title__icontains=keyword)
        service_filter |= Q(short_description__icontains=keyword)
        service_filter |= Q(full_description__icontains=keyword)

    professional_ids = service_queryset.filter(service_filter).values_list(
        "professional_id", flat=True
    )
    return queryset.filter(id__in=professional_ids).distinct()


class PublicProfessionalListView(generics.ListAPIView):
    serializer_class = PublicProfessionalSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = (
            ProfessionalProfile.objects.filter(is_public=True)
            .select_related("assistant_profile", "payment_account", "verification")
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
        category = self.request.query_params.get("category")
        if category:
            queryset = _filter_profiles_by_category(queryset, category)
        return queryset


class PublicProfessionalDetailView(generics.RetrieveAPIView):
    serializer_class = PublicProfessionalSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return (
            ProfessionalProfile.objects.filter(is_public=True)
            .select_related("assistant_profile", "payment_account", "verification")
            .prefetch_related("reviews")
        )


class ProfessionalDashboardProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfessionalDashboardSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    def get_object(self):
        return self.request.user.professional_profile


class ProfessionalVerificationView(generics.RetrieveUpdateAPIView):
    serializer_class = PractitionerVerificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    def get_object(self):
        verification, _created = PractitionerVerification.objects.get_or_create(
            professional=self.request.user.professional_profile
        )
        verification.refresh_expired_status()
        return verification


class PublicDirectoryListingView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        city = request.query_params.get("city", "").strip()
        query = request.query_params.get("q", "").strip()
        category = request.query_params.get("category", "").strip()

        professionals = (
            ProfessionalProfile.objects.filter(is_public=True)
            .select_related("assistant_profile", "payment_account", "verification")
            .prefetch_related("reviews")
            .order_by("business_name")
        )
        candidates_queryset = DirectoryProfileCandidate.objects.filter(
            status=DirectoryProfileCandidate.Status.PUBLISHED_UNCLAIMED
        ).order_by("business_name")

        if city:
            professionals = professionals.filter(city__icontains=city)
            candidates_queryset = candidates_queryset.filter(city__icontains=city)

        if query:
            professionals = professionals.filter(
                Q(business_name__icontains=query)
                | Q(city__icontains=query)
                | Q(service_area__icontains=query)
                | Q(public_headline__icontains=query)
                | Q(slug__icontains=query)
            )
            candidates_queryset = candidates_queryset.filter(
                Q(business_name__icontains=query)
                | Q(city__icontains=query)
                | Q(service_area__icontains=query)
                | Q(public_headline__icontains=query)
                | Q(slug__icontains=query)
            )

        candidates = list(candidates_queryset)
        if category:
            professionals = _filter_profiles_by_category(professionals, category)
            candidates = [
                candidate
                for candidate in candidates
                if category in (candidate.massage_categories or [])
            ]

        professional_data = PublicProfessionalSerializer(
            professionals,
            many=True,
            context={"request": request},
        ).data
        candidate_data = PublicDirectoryCandidateSerializer(
            candidates,
            many=True,
            context={"request": request},
        ).data

        listings = [
            {
                "id": item["id"],
                "listing_kind": "claimed",
                "listing_url": f"/{item['slug']}",
                "business_name": item["business_name"],
                "slug": item["slug"],
                "city": item["city"],
                "service_area": item["service_area"],
                "public_headline": item["public_headline"],
                "bio": item["bio"],
                "specialties": item["specialties"],
                "massage_categories": [],
                "visual_theme": item["visual_theme"],
                "profile_photo_url": item["profile_photo_url"],
                "cover_photo_url": item["cover_photo_url"],
                "accepts_online_booking": item["accepts_online_booking"],
                "verification_badge": item["verification_badge"],
                "claim_notice": "",
            }
            for item in professional_data
        ] + [
            {
                "id": item["id"],
                "listing_kind": item["listing_kind"],
                "listing_url": item["listing_url"],
                "business_name": item["business_name"],
                "slug": item["slug"],
                "city": item["city"],
                "service_area": item["service_area"],
                "public_headline": item["public_headline"],
                "bio": item["bio"],
                "specialties": item["specialties"],
                "massage_categories": item["massage_categories"],
                "visual_theme": "",
                "profile_photo_url": "",
                "cover_photo_url": "",
                "accepts_online_booking": False,
                "verification_badge": None,
                "claim_notice": item["claim_notice"],
            }
            for item in candidate_data
        ]

        listings.sort(key=lambda item: (item["city"] or "", item["business_name"].lower()))
        serializer = PublicDirectoryListingSerializer(listings, many=True)
        return Response(serializer.data)


class PublicDirectoryCandidateDetailView(generics.RetrieveAPIView):
    serializer_class = DirectoryProfileCandidateDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return DirectoryProfileCandidate.objects.filter(
            status=DirectoryProfileCandidate.Status.PUBLISHED_UNCLAIMED
        )


class DirectoryProfileClaimRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, slug: str):
        candidate = generics.get_object_or_404(
            DirectoryProfileCandidate.objects.filter(
                status=DirectoryProfileCandidate.Status.PUBLISHED_UNCLAIMED
            ),
            slug=slug,
        )
        serializer = DirectoryProfileClaimRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim_request = DirectoryProfileClaimRequest.objects.create(
            candidate=candidate,
            **serializer.validated_data,
        )
        return Response(
            {
                "status": "received",
                "message": "La demande de revendication a bien été enregistrée.",
                "request_id": str(claim_request.id),
            },
            status=201,
        )


class DirectoryProfileRemovalRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, slug: str):
        candidate = generics.get_object_or_404(
            DirectoryProfileCandidate.objects.filter(
                status=DirectoryProfileCandidate.Status.PUBLISHED_UNCLAIMED
            ),
            slug=slug,
        )
        serializer = DirectoryProfileRemovalRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        removal_request = DirectoryProfileRemovalRequest.objects.create(
            candidate=candidate,
            **serializer.validated_data,
        )
        candidate.removal_requested_at = candidate.removal_requested_at or timezone.now()
        candidate.save(update_fields=["removal_requested_at", "updated_at"])
        return Response(
            {
                "status": "received",
                "message": "La demande de suppression a bien été enregistrée.",
                "request_id": str(removal_request.id),
            },
            status=201,
        )


class DirectoryInterestLeadCreateView(generics.CreateAPIView):
    serializer_class = DirectoryInterestLeadSerializer
    permission_classes = [permissions.AllowAny]
    queryset = DirectoryInterestLead.objects.all()
