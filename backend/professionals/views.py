from django.conf import settings
from django.db.models import Q
from rest_framework import generics, permissions, parsers
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import HasProfessionalProfile, IsProfessionalUser
from directory.models import ImportedProfile, RemovalRequest
from directory.serializers import PublicImportedProfileSerializer
from directory.services import create_claim_for_profile, send_claim_invite, send_removal_confirmation
from services.models import MassageService, SERVICE_CATEGORY_KEYWORDS

from .models import (
    DirectoryInterestLead,
    PractitionerVerification,
    ProfessionalProfile,
)
from .serializers import (
    DirectoryInterestLeadSerializer,
    DirectoryProfileClaimRequestSerializer,
    DirectoryProfileRemovalRequestSerializer,
    PractitionerVerificationSerializer,
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
        candidates_queryset = ImportedProfile.objects.filter(
            import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
            is_public=True,
        ).order_by("public_name")

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
                Q(public_name__icontains=query)
                | Q(business_name__icontains=query)
                | Q(city__icontains=query)
                | Q(region__icontains=query)
                | Q(public_status_note__icontains=query)
                | Q(slug__icontains=query)
            )

        candidates = list(candidates_queryset)
        if category:
            professionals = _filter_profiles_by_category(professionals, category)
            candidates = [
                candidate
                for candidate in candidates
                if category in (candidate.service_tags_json or [])
            ]

        professional_data = PublicProfessionalSerializer(
            professionals,
            many=True,
            context={"request": request},
        ).data
        candidate_data = PublicImportedProfileSerializer(
            candidates,
            many=True,
            context={"request": request},
        ).data

        listings = [
            {
                "id": item["id"],
                "listing_kind": "claimed",
                "listing_url": f"/praticiens/{item['slug']}",
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
                "business_name": item["business_name"] or item["public_name"],
                "slug": item["slug"],
                "city": item["city"],
                "service_area": item["region"],
                "public_headline": item["public_status_note"],
                "bio": item["bio_short"],
                "specialties": item["service_tags_json"],
                "massage_categories": item["service_tags_json"],
                "visual_theme": "",
                "profile_photo_url": "",
                "cover_photo_url": "",
                "accepts_online_booking": item["has_public_booking_link"],
                "verification_badge": None,
                "claim_notice": item["claim_notice"],
            }
            for item in candidate_data
        ]

        listings.sort(key=lambda item: (item["city"] or "", item["business_name"].lower()))
        serializer = PublicDirectoryListingSerializer(listings, many=True)
        return Response(serializer.data)


class PublicDirectoryCandidateDetailView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, slug: str):
        candidate = generics.get_object_or_404(
            ImportedProfile.objects.filter(
                import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
                is_public=True,
            ),
            slug=slug,
        )
        return Response(
            {
                "id": str(candidate.id),
                "status": candidate.import_status,
                "business_name": candidate.business_name or candidate.public_name,
                "slug": candidate.slug,
                "city": candidate.city,
                "service_area": candidate.region,
                "public_headline": candidate.public_status_note,
                "bio": candidate.bio_short,
                "specialties": candidate.service_tags_json,
                "massage_categories": candidate.service_tags_json,
                "source_label": candidate.source.name,
                "source_url": candidate.source_url,
                "imported_at": candidate.imported_at,
                "claim_notice": (
                    "Cette fiche n’est pas encore revendiquée. "
                    "Aucune réservation ou demande client n’est générée automatiquement à partir de cette page."
                ),
            }
        )


class DirectoryProfileClaimRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, slug: str):
        imported_profile = generics.get_object_or_404(
            ImportedProfile.objects.filter(
                import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
                is_public=True,
                claimable=True,
            ),
            slug=slug,
        )
        serializer = DirectoryProfileClaimRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim = create_claim_for_profile(
            imported_profile=imported_profile,
            email=serializer.validated_data["claimant_email"],
        )
        claim.decision_notes = "\n".join(
            value
            for value in [
                f"Nom: {serializer.validated_data.get('claimant_name', '').strip()}",
                f"Téléphone: {serializer.validated_data.get('claimant_phone', '').strip()}",
                f"Message: {serializer.validated_data.get('message', '').strip()}",
            ]
            if value.split(": ", 1)[1]
        )
        claim.save(update_fields=["decision_notes", "updated_at"])
        send_claim_invite(
            claim=claim,
            activation_url=f"{settings.FRONTEND_APP_URL}/revendiquer/{claim.token}",
        )
        return Response(
            {
                "status": "received",
                "message": "La demande de revendication a bien été enregistrée.",
                "request_id": str(claim.id),
            },
            status=201,
        )


class DirectoryProfileRemovalRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, slug: str):
        imported_profile = generics.get_object_or_404(
            ImportedProfile.objects.filter(
                import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
                is_public=True,
            ),
            slug=slug,
        )
        serializer = DirectoryProfileRemovalRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        removal_request = RemovalRequest.objects.create(
            imported_profile=imported_profile,
            requester_name=serializer.validated_data["requester_name"],
            requester_email=serializer.validated_data["requester_email"],
            reason=serializer.validated_data.get("reason", ""),
            status=RemovalRequest.Status.RECEIVED,
        )
        imported_profile.removal_requested = True
        imported_profile.save(update_fields=["removal_requested", "updated_at"])
        send_removal_confirmation(removal_request=removal_request)
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
