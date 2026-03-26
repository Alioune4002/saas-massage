from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, parsers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils.text import slugify

from common.permissions import HasProfessionalProfile, IsProfessionalUser
from directory.models import ImportedProfile, RemovalRequest
from directory.serializers import PublicImportedProfileSerializer
from directory.services import create_claim_for_profile, send_claim_invite, send_removal_confirmation
from services.models import MassageService, SERVICE_CATEGORY_KEYWORDS

from .crm import (
    filter_directory_querysets_by_location,
    get_location_suggestions,
    sync_practitioner_contacts,
)
from .models import (
    ContactPrivateNote,
    ContactTag,
    DirectoryInterestLead,
    FavoritePractitioner,
    GuestFavoriteCollection,
    PractitionerVerification,
    PractitionerContact,
    ProfessionalProfile,
)
from .serializers import (
    ContactTagSerializer,
    DirectoryInterestLeadSerializer,
    DirectoryProfileClaimRequestSerializer,
    DirectoryProfileRemovalRequestSerializer,
    FavoritePractitionerSerializer,
    GuestFavoriteCollectionSerializer,
    LocationSuggestionSerializer,
    PractitionerVerificationSerializer,
    PractitionerContactSerializer,
    PractitionerContactUpdateSerializer,
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


def _get_favorites_token(request):
    return (
        request.headers.get("X-Guest-Favorites-Token")
        or request.query_params.get("token")
        or request.data.get("token")
        or ""
    ).strip()


def _resolve_favorite_collection(request, *, create: bool = False):
    token = _get_favorites_token(request)
    if token:
        collection = GuestFavoriteCollection.objects.filter(
            access_token=token,
            is_active=True,
        ).first()
        if collection:
            collection.last_accessed_at = timezone.now()
            collection.save(update_fields=["last_accessed_at", "updated_at"])
            return collection
    if create:
        return GuestFavoriteCollection.objects.create(last_accessed_at=timezone.now())
    return None


class PublicFavoritesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        collection = _resolve_favorite_collection(request, create=False)
        if not collection:
            return Response(
                {
                    "collection_token": "",
                    "favorites": [],
                }
            )
        serializer = GuestFavoriteCollectionSerializer(collection, context={"request": request})
        return Response(
            {
                "collection_token": collection.access_token,
                "favorites": serializer.data["favorites"],
            }
        )

    def post(self, request):
        slug = str(request.data.get("professional_slug", "")).strip()
        if not slug:
            return Response({"detail": "Le praticien à ajouter est manquant."}, status=400)
        professional = generics.get_object_or_404(
            ProfessionalProfile.objects.filter(is_public=True),
            slug=slug,
        )
        collection = _resolve_favorite_collection(request, create=True)
        favorite, created = FavoritePractitioner.objects.get_or_create(
            collection=collection,
            professional=professional,
        )
        serializer = FavoritePractitionerSerializer(favorite, context={"request": request})
        return Response(
            {
                "collection_token": collection.access_token,
                "added": created,
                "favorite": serializer.data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PublicFavoriteDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def delete(self, request, slug: str):
        collection = _resolve_favorite_collection(request, create=False)
        if not collection:
            return Response(status=status.HTTP_204_NO_CONTENT)
        FavoritePractitioner.objects.filter(
            collection=collection,
            professional__slug=slug,
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicLocationSuggestionView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        suggestions = get_location_suggestions(query)
        serializer = LocationSuggestionSerializer(suggestions, many=True)
        return Response(serializer.data)


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


class ProfessionalContactListView(generics.ListAPIView):
    serializer_class = PractitionerContactSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def get_queryset(self):
        professional = self.request.user.professional_profile
        sync_practitioner_contacts(professional)
        queryset = (
            PractitionerContact.objects.filter(professional=professional)
            .prefetch_related("tags")
            .select_related("private_note")
            .order_by("-last_booking_at", "first_name", "last_name")
        )
        segment = self.request.query_params.get("segment")
        query = self.request.query_params.get("q")
        tag = self.request.query_params.get("tag")
        trusted = self.request.query_params.get("trusted")

        if segment:
            queryset = queryset.filter(segment=segment)
        if query:
            queryset = queryset.filter(
                Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(email__icontains=query)
                | Q(phone__icontains=query)
            )
        if tag:
            queryset = queryset.filter(tags__normalized_label__icontains=tag.replace(" ", "").lower())
        if trusted in {"true", "false"}:
            queryset = queryset.filter(is_trusted=trusted == "true")
        return queryset.distinct()


class ProfessionalContactDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def get_queryset(self):
        professional = self.request.user.professional_profile
        sync_practitioner_contacts(professional)
        return (
            PractitionerContact.objects.filter(professional=professional)
            .prefetch_related("tags")
            .select_related("private_note")
        )

    def get_serializer_class(self):
        if self.request.method in {"PATCH", "PUT"}:
            return PractitionerContactUpdateSerializer
        return PractitionerContactSerializer

    def update(self, request, *args, **kwargs):
        contact = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if "is_trusted" in serializer.validated_data:
            contact.is_trusted = serializer.validated_data["is_trusted"]
            contact.save(update_fields=["is_trusted", "updated_at"])

        if "private_note" in serializer.validated_data:
            content = serializer.validated_data["private_note"].strip()
            if content:
                ContactPrivateNote.objects.update_or_create(
                    contact=contact,
                    defaults={"content": content},
                )
            else:
                ContactPrivateNote.objects.filter(contact=contact).delete()

        if "tag_labels" in serializer.validated_data:
            tag_instances = []
            for label in serializer.validated_data["tag_labels"]:
                tag, _created = ContactTag.objects.get_or_create(
                    professional=contact.professional,
                    normalized_label=slugify(label).replace("-", ""),
                    defaults={"label": label},
                )
                if tag.label != label:
                    tag.label = label
                    tag.save(update_fields=["label", "updated_at"])
                tag_instances.append(tag)
            contact.tags.set(tag_instances)

        response_serializer = PractitionerContactSerializer(contact, context={"request": request})
        return Response(response_serializer.data)


class ProfessionalContactTagListCreateView(generics.ListCreateAPIView):
    serializer_class = ContactTagSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def get_queryset(self):
        return ContactTag.objects.filter(professional=self.request.user.professional_profile)

    def perform_create(self, serializer):
        serializer.save(professional=self.request.user.professional_profile)


class ProfessionalContactTagDetailView(generics.DestroyAPIView):
    serializer_class = ContactTagSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfessionalUser, HasProfessionalProfile]

    def get_queryset(self):
        return ContactTag.objects.filter(professional=self.request.user.professional_profile)


class PublicDirectoryListingView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        city = request.query_params.get("city", "").strip()
        query = request.query_params.get("q", "").strip()
        category = request.query_params.get("category", "").strip()
        location_type = request.query_params.get("location_type", "").strip()
        location_slug = request.query_params.get("location_slug", "").strip()

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

        professionals, candidates_queryset, _resolved_location = filter_directory_querysets_by_location(
            professionals,
            candidates_queryset,
            location_type=location_type,
            location_slug=location_slug,
        )

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
