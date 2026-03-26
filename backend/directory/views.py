from __future__ import annotations

import json

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, parsers, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import (
    CanApproveCampaigns,
    CanOperateImports,
    CanReviewProfiles,
    CanReviewSources,
    IsAdminUser,
)
from professionals.crm import filter_directory_querysets_by_location, resolve_profile_geography
from professionals.models import DirectoryInterestLead, ProfessionalProfile
from professionals.serializers import (
    DirectoryInterestLeadAdminSerializer,
    PublicProfessionalSerializer,
)

from .models import (
    CityGrowthPlan,
    ContactCampaign,
    ImportedProfile,
    PractitionerClaim,
    RemovalRequest,
    SourceImportJob,
    SourceRegistry,
)
from .serializers import (
    ClaimCompleteOnboardingSerializer,
    ClaimRequestSerializer,
    ClaimVerifySerializer,
    CityAcquisitionFunnelSerializer,
    CityAcquisitionSummarySerializer,
    CityGrowthPlanSerializer,
    CompleteProfileFromImportSerializer,
    ContactCampaignSerializer,
    ImportedProfileBulkActionSerializer,
    ImportedProfileSerializer,
    MeClaimStatusSerializer,
    PublicImportedProfileSerializer,
    RemovalRequestSerializer,
    SourceImportJobSerializer,
    SourceRegistrySerializer,
    UnifiedPublicPractitionerSerializer,
)
from .acquisition import (
    get_city_campaigns_queryset,
    get_city_funnel,
    get_city_growth_row,
    get_city_imported_profiles_queryset,
    get_city_suggestions_queryset,
    get_or_create_city_growth_plan,
    list_city_growth_rows,
)
from .services import (
    build_campaign_targets,
    create_claim_for_profile,
    execute_import_job,
    log_audit,
    run_contact_campaign,
    send_claim_invite,
    send_removal_confirmation,
)


class AdminSourcesView(generics.ListCreateAPIView):
    serializer_class = SourceRegistrySerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewSources]

    def get_queryset(self):
        return SourceRegistry.objects.order_by("name")

    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit(actor=self.request.user, action="source.created", obj=instance, after=serializer.data)


class AdminSourceDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = SourceRegistrySerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewSources]
    queryset = SourceRegistry.objects.all()

    def perform_update(self, serializer):
        instance = self.get_object()
        before = SourceRegistrySerializer(instance).data
        updated = serializer.save()
        log_audit(actor=self.request.user, action="source.updated", obj=updated, before=before, after=serializer.data)


class AdminSourceRunImportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanOperateImports]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def post(self, request, pk):
        source = get_object_or_404(SourceRegistry, pk=pk)
        job = SourceImportJob.objects.create(
            source=source,
            trigger_type=SourceImportJob.TriggerType.MANUAL,
            status=SourceImportJob.Status.QUEUED,
            created_by=request.user,
        )
        mapping_raw = request.data.get("mapping") or "{}"
        try:
            mapping = json.loads(mapping_raw) if isinstance(mapping_raw, str) else mapping_raw
        except json.JSONDecodeError as exc:
            return Response({"detail": f"Mapping JSON invalide: {exc}"}, status=400)

        dry_run = str(request.data.get("dry_run", "false")).lower() == "true"
        file_obj = request.FILES.get("file")
        payload_text = request.data.get("payload_text", "")
        if file_obj:
            payload = file_obj.read().decode("utf-8")
        else:
            payload = payload_text

        result = execute_import_job(
            job=job,
            payload=payload,
            mapping=mapping or {},
            dry_run=dry_run,
        )
        if dry_run:
            job.status = SourceImportJob.Status.CANCELLED
            job.finished_at = timezone.now()
            job.raw_report_json = result.report
            job.save(update_fields=["status", "finished_at", "raw_report_json", "updated_at"])
        log_audit(
            actor=request.user,
            action="source.run_import",
            obj=job,
            after={
                "dry_run": dry_run,
                "report": result.report,
            },
        )
        return Response(
            {
                "job_id": str(job.id),
                "dry_run": dry_run,
                "summary": {
                    "total_seen": result.total_seen,
                    "total_created": result.total_created,
                    "total_updated": result.total_updated,
                    "total_skipped": result.total_skipped,
                    "total_flagged": result.total_flagged,
                },
                "report": result.report,
            }
        )


class AdminImportJobsView(generics.ListAPIView):
    serializer_class = SourceImportJobSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanOperateImports]

    def get_queryset(self):
        queryset = SourceImportJob.objects.select_related("source", "created_by").order_by("-created_at")
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset


class AdminImportJobDetailView(generics.RetrieveAPIView):
    serializer_class = SourceImportJobSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanOperateImports]
    queryset = SourceImportJob.objects.select_related("source", "created_by")


class AdminImportedProfilesView(generics.ListCreateAPIView):
    serializer_class = ImportedProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]
    parser_classes = [parsers.JSONParser]

    def get_queryset(self):
        queryset = ImportedProfile.objects.select_related("source", "reviewed_by").order_by("public_name")
        for param in ("import_status", "source", "city", "claimable", "publishable_minimum_ok"):
            value = self.request.query_params.get(param)
            if value:
                queryset = queryset.filter(**{param: value})
        probable_duplicates = self.request.query_params.get("probable_duplicates")
        if probable_duplicates == "true":
            queryset = queryset.filter(confidence_score__gte=0.8)
        return queryset

    def perform_create(self, serializer):
        manual_source = SourceRegistry.objects.filter(
            source_type=SourceRegistry.SourceType.MANUAL_FORM,
            legal_status=SourceRegistry.LegalStatus.APPROVED,
        ).first()
        if not manual_source:
            manual_source = SourceRegistry.objects.create(
                name="Saisie manuelle admin",
                source_type=SourceRegistry.SourceType.MANUAL_FORM,
                legal_status=SourceRegistry.LegalStatus.APPROVED,
                is_active=True,
                reviewed_by=self.request.user,
                reviewed_at=timezone.now(),
            )
        instance = serializer.save(
            source=manual_source,
            external_id=serializer.validated_data.get("external_id") or f"manual-{timezone.now().timestamp()}",
            imported_at=timezone.now(),
            last_seen_at=timezone.now(),
        )
        log_audit(actor=self.request.user, action="imported_profile.created", obj=instance, after=serializer.data)


class AdminImportedProfilesBulkActionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def post(self, request):
        serializer = ImportedProfileBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]
        action = serializer.validated_data["action"]
        queryset = ImportedProfile.objects.filter(id__in=ids)
        updated = 0
        details: list[dict] = []

        for profile in queryset:
            before = ImportedProfileSerializer(profile).data
            if action == "approve_internal":
                profile.import_status = ImportedProfile.ImportStatus.APPROVED_INTERNAL
                profile.reviewed_by = request.user
                profile.reviewed_at = timezone.now()
                profile.save(update_fields=["import_status", "reviewed_by", "reviewed_at", "updated_at"])
                updated += 1
            elif action == "publish_unclaimed":
                profile.import_status = ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED
                profile.is_public = True
                profile.reviewed_by = request.user
                profile.reviewed_at = timezone.now()
                profile.save(update_fields=["import_status", "is_public", "reviewed_by", "reviewed_at", "updated_at"])
                updated += 1
            elif action == "reject":
                profile.import_status = ImportedProfile.ImportStatus.REJECTED
                profile.is_public = False
                profile.reviewed_by = request.user
                profile.reviewed_at = timezone.now()
                profile.save(update_fields=["import_status", "is_public", "reviewed_by", "reviewed_at", "updated_at"])
                updated += 1
            elif action == "mark_removed":
                profile.import_status = ImportedProfile.ImportStatus.REMOVED
                profile.is_public = False
                profile.removal_requested = True
                profile.reviewed_by = request.user
                profile.reviewed_at = timezone.now()
                profile.save(update_fields=["import_status", "is_public", "removal_requested", "reviewed_by", "reviewed_at", "updated_at"])
                updated += 1
            elif action == "send_claim_invite":
                target_email = profile.email_public
                if (
                    target_email
                    and profile.claimable
                    and profile.contact_allowed_based_on_source_policy
                ):
                    claim = create_claim_for_profile(imported_profile=profile, email=target_email)
                    send_claim_invite(
                        claim=claim,
                        activation_url=f"{settings.FRONTEND_APP_URL}/revendiquer/{claim.token}",
                    )
                    updated += 1
                else:
                    details.append(
                        {
                            "id": str(profile.id),
                            "action": action,
                            "skipped": True,
                            "reason": "Contact sortant non autorisé ou email manquant.",
                        }
                    )
                    continue
            elif action == "merge":
                target = get_object_or_404(ImportedProfile, pk=serializer.validated_data["target_id"])
                target.service_tags_json = list({*target.service_tags_json, *profile.service_tags_json})
                target.practice_modes_json = list({*target.practice_modes_json, *profile.practice_modes_json})
                target.bio_short = target.bio_short or profile.bio_short
                target.phone_public = target.phone_public or profile.phone_public
                target.email_public = target.email_public or profile.email_public
                target.website_url = target.website_url or profile.website_url
                target.instagram_url = target.instagram_url or profile.instagram_url
                target.source_snapshot_json = {
                    "merged_from": str(profile.id),
                    "primary": target.source_snapshot_json,
                    "secondary": profile.source_snapshot_json,
                }
                target.save()
                profile.import_status = ImportedProfile.ImportStatus.REMOVED
                profile.is_public = False
                profile.review_notes = "Fusionné avec une autre fiche."
                profile.reviewed_by = request.user
                profile.reviewed_at = timezone.now()
                profile.save(update_fields=["import_status", "is_public", "review_notes", "reviewed_by", "reviewed_at", "updated_at"])
                updated += 1
            elif action == "export_csv":
                details.append(ImportedProfileSerializer(profile).data)
                continue
            log_audit(
                actor=request.user,
                action=f"imported_profile.{action}",
                obj=profile,
                before=before,
                after=ImportedProfileSerializer(profile).data,
            )
            details.append({"id": str(profile.id), "action": action})

        return Response({"updated": updated, "details": details})


class AdminContactCampaignCreateView(generics.ListCreateAPIView):
    serializer_class = ContactCampaignSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanOperateImports]

    def get_queryset(self):
        return ContactCampaign.objects.select_related("created_by", "approved_by").order_by("-created_at")

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_audit(actor=self.request.user, action="campaign.created", obj=instance, after=serializer.data)


class AdminContactCampaignSendView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanApproveCampaigns]

    def post(self, request, pk):
        campaign = get_object_or_404(ContactCampaign, pk=pk)
        target_count = build_campaign_targets(campaign=campaign).count()
        is_super_admin = bool(
            getattr(request.user, "is_superuser", False)
            or request.user.has_perm("directory.super_admin")
        )
        if target_count > 25 and not campaign.approved_by and not is_super_admin:
            return Response(
                {"detail": "Cette campagne dépasse le seuil d'envoi sans approbation explicite."},
                status=400,
            )
        if not campaign.approved_by:
            campaign.approved_by = request.user
            campaign.approved_at = timezone.now()
        campaign.total_targets = target_count
        campaign.save(update_fields=["approved_by", "approved_at", "total_targets", "updated_at"])
        result = run_contact_campaign(campaign=campaign, base_url=settings.FRONTEND_APP_URL)
        log_audit(actor=request.user, action="campaign.sent", obj=campaign, after=result)
        return Response(result)


class AdminAcquisitionCoverageView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def get(self, request):
        metrics = list_city_growth_rows(
            {
                "city": request.query_params.get("city", ""),
                "department_code": request.query_params.get("department_code", ""),
                "region": request.query_params.get("region", ""),
                "growth_status": request.query_params.get("growth_status", ""),
                "priority_level": request.query_params.get("priority_level", ""),
                "processed": request.query_params.get("processed", ""),
            }
        )
        serializer = CityAcquisitionSummarySerializer(metrics, many=True)
        return Response(serializer.data)


class AdminAcquisitionSuggestionsView(generics.ListAPIView):
    serializer_class = DirectoryInterestLeadAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def get_queryset(self):
        queryset = DirectoryInterestLead.objects.order_by("-created_at")
        city = self.request.query_params.get("city")
        city_slug = self.request.query_params.get("city_slug")
        kind = self.request.query_params.get("kind")
        processed = self.request.query_params.get("processed")
        ops_status = self.request.query_params.get("ops_status")
        if city:
            queryset = queryset.filter(city__icontains=city)
        if city_slug:
            queryset = queryset.filter(city_slug=city_slug)
        if kind:
            queryset = queryset.filter(kind=kind)
        if processed in {"true", "false"}:
            queryset = queryset.filter(processed=processed == "true")
        if ops_status:
            queryset = queryset.filter(ops_status=ops_status)
        return queryset


class AdminAcquisitionSuggestionDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = DirectoryInterestLeadAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]
    queryset = DirectoryInterestLead.objects.select_related("assigned_to", "converted_to_imported_profile")

    def perform_update(self, serializer):
        instance = self.get_object()
        before = DirectoryInterestLeadAdminSerializer(instance).data
        updated = serializer.save()
        log_audit(
            actor=self.request.user,
            action="directory_interest_lead.updated",
            obj=updated,
            before=before,
            after=DirectoryInterestLeadAdminSerializer(updated).data,
        )


class AdminCityGrowthPlansView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def get(self, request):
        rows = list_city_growth_rows(
            {
                "city": request.query_params.get("city", ""),
                "department_code": request.query_params.get("department_code", ""),
                "region": request.query_params.get("region", ""),
                "growth_status": request.query_params.get("growth_status", ""),
                "priority_level": request.query_params.get("priority_level", ""),
                "processed": request.query_params.get("processed", ""),
            }
        )
        serializer = CityAcquisitionSummarySerializer(rows, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CityGrowthPlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        log_audit(
            actor=request.user,
            action="city_growth_plan.created",
            obj=instance,
            after=CityGrowthPlanSerializer(instance).data,
        )
        return Response(
            CityAcquisitionSummarySerializer(get_city_growth_row(instance.city_slug)).data,
            status=status.HTTP_201_CREATED,
        )


class AdminCityGrowthPlanDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def get(self, request, city_slug):
        try:
            row = get_city_growth_row(city_slug)
        except ValueError:
            return Response({"detail": "Ville introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = CityAcquisitionSummarySerializer(row)
        return Response(serializer.data)

    def patch(self, request, city_slug):
        try:
            instance = get_or_create_city_growth_plan(city_slug=city_slug)
        except ValueError:
            return Response({"detail": "Ville introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = CityGrowthPlanSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        before = CityGrowthPlanSerializer(instance).data
        updated = serializer.save()
        log_audit(
            actor=request.user,
            action="city_growth_plan.updated",
            obj=updated,
            before=before,
            after=CityGrowthPlanSerializer(updated).data,
        )
        return Response(CityAcquisitionSummarySerializer(get_city_growth_row(updated.city_slug)).data)


class AdminCityGrowthPlanFunnelView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def get(self, request, city_slug):
        try:
            funnel = get_city_funnel(city_slug)
        except ValueError:
            return Response({"detail": "Ville introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = CityAcquisitionFunnelSerializer(funnel)
        return Response(serializer.data)


class AdminCityGrowthPlanProfilesView(generics.ListAPIView):
    serializer_class = ImportedProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def get_queryset(self):
        city_slug = self.kwargs["city_slug"]
        queryset = get_city_imported_profiles_queryset(city_slug)
        import_status = self.request.query_params.get("import_status")
        claimable = self.request.query_params.get("claimable")
        if import_status:
            queryset = queryset.filter(import_status=import_status)
        if claimable in {"true", "false"}:
            queryset = queryset.filter(claimable=claimable == "true")
        return queryset


class AdminCityGrowthPlanSuggestionsView(generics.ListAPIView):
    serializer_class = DirectoryInterestLeadAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def get_queryset(self):
        queryset = get_city_suggestions_queryset(self.kwargs["city_slug"])
        processed = self.request.query_params.get("processed")
        ops_status = self.request.query_params.get("ops_status")
        if processed in {"true", "false"}:
            queryset = queryset.filter(processed=processed == "true")
        if ops_status:
            queryset = queryset.filter(ops_status=ops_status)
        return queryset


class AdminCityGrowthPlanCampaignsView(generics.ListAPIView):
    serializer_class = ContactCampaignSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def get_queryset(self):
        return get_city_campaigns_queryset(self.kwargs["city_slug"])


class AdminRemovalRequestsView(generics.ListAPIView):
    serializer_class = RemovalRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanReviewProfiles]

    def get_queryset(self):
        queryset = RemovalRequest.objects.select_related("imported_profile", "resolved_by").order_by("-created_at")
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset


class PublicDirectoryListingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        city = request.query_params.get("city", "").strip()
        category = request.query_params.get("category", "").strip().lower()
        query = request.query_params.get("q", "").strip().lower()
        location_type = request.query_params.get("location_type", "").strip()
        location_slug = request.query_params.get("location_slug", "").strip()

        claimed_queryset = ProfessionalProfile.objects.filter(is_public=True).order_by("business_name")
        imported_queryset = ImportedProfile.objects.filter(is_public=True).order_by("public_name")
        claimed_queryset, imported_queryset, _resolved_location = filter_directory_querysets_by_location(
            claimed_queryset,
            imported_queryset,
            location_type=location_type,
            location_slug=location_slug,
        )
        if city:
            claimed_queryset = claimed_queryset.filter(city__icontains=city)
        if query:
            claimed_queryset = claimed_queryset.filter(business_name__icontains=query)

        if city:
            imported_queryset = imported_queryset.filter(city__icontains=city)
        if query:
            imported_queryset = imported_queryset.filter(public_name__icontains=query)
        if category:
            imported_queryset = imported_queryset.filter(service_tags_json__icontains=category)

        claimed_data = PublicProfessionalSerializer(claimed_queryset, many=True, context={"request": request}).data
        imported_data = PublicImportedProfileSerializer(imported_queryset, many=True, context={"request": request}).data

        payload = [
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
            for item in claimed_data
        ] + [
            {
                "id": item["id"],
                "listing_kind": "unclaimed",
                "listing_url": item["listing_url"],
                "business_name": item["business_name"] or item["public_name"],
                "slug": item["slug"],
                "city": item["city"],
                "service_area": item["region"],
                "public_headline": item["public_status_note"],
                "bio": item["bio_short"],
                "specialties": item["service_tags_json"],
                "massage_categories": item["service_tags_json"],
                "visual_theme": "epure",
                "profile_photo_url": "",
                "cover_photo_url": "",
                "accepts_online_booking": item["has_public_booking_link"],
                "verification_badge": None,
                "claim_notice": item["claim_notice"],
            }
            for item in imported_data
        ]
        payload.sort(key=lambda item: ((item["city"] or "").lower(), item["business_name"].lower()))
        return Response(payload)


class PublicPractitionerDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        claimed = ProfessionalProfile.objects.filter(slug=slug, is_public=True).first()
        if claimed:
            serializer = UnifiedPublicPractitionerSerializer(
                {"kind": "claimed", "claimed_profile": claimed},
                context={"request": request},
            )
            return Response(serializer.data)

        imported = get_object_or_404(ImportedProfile, slug=slug, is_public=True)
        serializer = UnifiedPublicPractitionerSerializer(
            {"kind": "unclaimed", "imported_profile": imported},
            context={"request": request},
        )
        return Response(serializer.data)


class PublicClaimRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        imported_profile = get_object_or_404(ImportedProfile, pk=pk, claimable=True)
        serializer = ClaimRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim = create_claim_for_profile(
            imported_profile=imported_profile,
            email=serializer.validated_data["email"],
        )
        send_claim_invite(
            claim=claim,
            activation_url=f"{settings.FRONTEND_APP_URL}/revendiquer/{claim.token}",
        )
        return Response({"status": "sent", "claim_id": str(claim.id)})


class PublicRemovalRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        slug_or_id = request.data.get("slug_or_id", "").strip()
        imported_profile = None
        if slug_or_id:
            imported_profile = ImportedProfile.objects.filter(slug=slug_or_id).first()
            if not imported_profile:
                imported_profile = ImportedProfile.objects.filter(pk=slug_or_id).first()
        removal_request = RemovalRequest.objects.create(
            imported_profile=imported_profile,
            requester_email=request.data.get("requester_email", ""),
            requester_name=request.data.get("requester_name", ""),
            reason=request.data.get("reason", ""),
            status=RemovalRequest.Status.RECEIVED,
        )
        if imported_profile:
            imported_profile.removal_requested = True
            imported_profile.save(update_fields=["removal_requested", "updated_at"])
        send_removal_confirmation(removal_request=removal_request)
        return Response({"status": "received", "request_id": str(removal_request.id)}, status=201)


class PublicClaimVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ClaimVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim = get_object_or_404(PractitionerClaim, token=serializer.validated_data["token"])
        if claim.is_expired:
            claim.status = PractitionerClaim.Status.EXPIRED
            claim.save(update_fields=["status", "updated_at"])
            return Response({"status": "expired"}, status=410)

        if not claim.viewed_at:
            claim.viewed_at = timezone.now()
        claim.status = PractitionerClaim.Status.VERIFIED
        claim.verified_at = claim.verified_at or timezone.now()
        claim.save(update_fields=["viewed_at", "status", "verified_at", "updated_at"])
        profile_data = PublicImportedProfileSerializer(claim.imported_profile, context={"request": request}).data
        return Response({"status": "verified", "claim": {"token": claim.token, "email": claim.email}, "profile": profile_data})


class PublicClaimCompleteOnboardingView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ClaimCompleteOnboardingSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        claim = get_object_or_404(PractitionerClaim, token=serializer.validated_data["token"])
        result = serializer.save(claim=claim)
        return Response(
            {
                "status": "approved",
                "token": result["token"].key,
                "user": {
                    "email": result["user"].email,
                    "role": result["user"].role,
                    "professional_slug": result["profile"].slug,
                    "professional_name": result["profile"].business_name,
                    "onboarding_completed": result["profile"].onboarding_completed,
                },
            }
        )


class MeClaimStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "professional_profile", None)
        imported_profile = getattr(profile, "imported_profile_origin", None) if profile else None
        serializer = MeClaimStatusSerializer(
            {
                "has_import_origin": bool(imported_profile),
                "imported_profile_id": str(imported_profile.id) if imported_profile else "",
                "imported_profile_status": imported_profile.import_status if imported_profile else "",
                "imported_profile_slug": imported_profile.slug if imported_profile else "",
            }
        )
        return Response(serializer.data)


class MeCompleteProfileFromImportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CompleteProfileFromImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = getattr(request.user, "professional_profile", None)
        if not profile:
            return Response({"detail": "Aucun profil professionnel rattaché."}, status=400)

        imported_profile = None
        claim_token = serializer.validated_data.get("claim_token")
        if claim_token:
            claim = get_object_or_404(PractitionerClaim, token=claim_token)
            imported_profile = claim.imported_profile
            claim.practitioner_user = request.user
            claim.status = PractitionerClaim.Status.APPROVED
            claim.approved_at = timezone.now()
            claim.save(update_fields=["practitioner_user", "status", "approved_at", "updated_at"])
        elif serializer.validated_data.get("imported_profile_id"):
            imported_profile = get_object_or_404(
                ImportedProfile,
                pk=serializer.validated_data["imported_profile_id"],
            )

        profile.imported_profile_origin = imported_profile
        profile.profile_claimed_from_import = True
        profile.acquisition_source = ProfessionalProfile.AcquisitionSource.IMPORTED_CLAIMED
        profile.business_name = profile.business_name or imported_profile.business_name or imported_profile.public_name
        profile.city = profile.city or imported_profile.city
        profile.postal_code = profile.postal_code or imported_profile.postal_code
        profile.service_area = profile.service_area or imported_profile.region
        profile.region = profile.region or imported_profile.region
        profile.bio = profile.bio or imported_profile.bio_short
        profile.public_headline = profile.public_headline or imported_profile.public_status_note
        profile.specialties = profile.specialties or imported_profile.service_tags_json
        profile.phone = profile.phone or imported_profile.phone_public
        profile.public_email = profile.public_email or imported_profile.email_public
        location = resolve_profile_geography(
            city=profile.city,
            postal_code=profile.postal_code,
            department_code=profile.department_code,
            region=profile.region or profile.service_area,
        )
        if location:
            profile.city = location.city or profile.city
            profile.postal_code = location.postal_code or profile.postal_code
            profile.department_code = location.department_code or profile.department_code
            profile.region = location.region or profile.region or profile.service_area
        profile.save()

        imported_profile.import_status = ImportedProfile.ImportStatus.CLAIMED
        imported_profile.is_public = False
        imported_profile.claimable = False
        imported_profile.save(update_fields=["import_status", "is_public", "claimable", "updated_at"])

        return Response({"status": "linked", "professional_slug": profile.slug})
