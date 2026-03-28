import hashlib
from decimal import Decimal

from django.conf import settings
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from common.permissions import (
    CanManageAdminCampaigns,
    CanManageAdminUsers,
    CanManagePlatformSettings,
    CanManageSupport,
    CanViewAdminRanking,
    CanViewAnalytics,
    IsAdminUser,
)
from directory.models import ContactCampaign
from professionals.models import ProfessionalProfile
from professionals.ranking import build_profile_ranking_snapshot

from .admin_dashboard import (
    build_admin_analytics_overview,
    build_admin_dashboard_overview,
    build_admin_platform_settings_snapshot,
)
from .legal import COOKIE_CONSENT_VERSION, LEGAL_DOCUMENTS
from .models import AdminAnnouncement, PageViewEvent, PlatformMessage
from .serializers import (
    AdminAnnouncementSerializer,
    AdminUserSummarySerializer,
    AdminUserUpdateSerializer,
    CookieConsentRecordSerializer,
    LegalAcceptanceSerializer,
    MyPlatformMessageSerializer,
    PageViewEventCreateSerializer,
    PlatformMessageSerializer,
    RuntimeConfigSerializer,
)


def _request_hashes(request):
    client_ip = (
        request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        or request.META.get("REMOTE_ADDR", "")
    )
    user_agent = request.META.get("HTTP_USER_AGENT", "")
    return {
        "ip_hash": hashlib.sha256(client_ip.encode()).hexdigest() if client_ip else "",
        "user_agent_hash": (
            hashlib.sha256(user_agent.encode()).hexdigest() if user_agent else ""
        ),
    }


def _build_payment_account_status(profile):
    account = getattr(profile, "payment_account", None) if profile else None
    if not account:
        return "non configuré"
    if getattr(account, "charges_enabled", False) and getattr(account, "payouts_enabled", False):
        return "actif"
    onboarding_status = getattr(account, "onboarding_status", "") or ""
    if onboarding_status:
        return onboarding_status
    if getattr(account, "stripe_account_id", ""):
        return "configuration partielle"
    return "non configuré"


class RuntimeConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        serializer = RuntimeConfigSerializer(
            data={
                "features": {
                    "cookie_consent": getattr(
                        settings, "NUADYX_FEATURE_COOKIE_CONSENT", True
                    ),
                    "practitioner_verification": getattr(
                        settings, "NUADYX_FEATURE_PRACTITIONER_VERIFICATION", True
                    ),
                    "review_replies": getattr(
                        settings, "NUADYX_FEATURE_REVIEW_REPLIES", True
                    ),
                },
                "cookie_consent_version": COOKIE_CONSENT_VERSION,
                "legal_documents": LEGAL_DOCUMENTS,
            }
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class PageViewEventCreateView(generics.CreateAPIView):
    serializer_class = PageViewEventCreateSerializer
    permission_classes = [permissions.AllowAny]


class CookieConsentCreateView(generics.CreateAPIView):
    serializer_class = CookieConsentRecordSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(_request_hashes(self.request))
        return context


class LegalAcceptanceCreateView(generics.CreateAPIView):
    serializer_class = LegalAcceptanceSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update(_request_hashes(self.request))
        return context


class AdminDashboardOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        return Response(build_admin_dashboard_overview())


class AdminSupportUserListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageSupport]
    serializer_class = AdminUserSummarySerializer

    def get_queryset(self):
        queryset = User.objects.select_related("professional_profile").order_by("-date_joined")
        query = self.request.query_params.get("q", "").strip()
        role = self.request.query_params.get("role", "").strip()
        if query:
            queryset = queryset.filter(
                Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(professional_profile__business_name__icontains=query)
            )
        if role:
            queryset = queryset.filter(role=role)
        return queryset[:100]

    def list(self, request, *args, **kwargs):
        payload = []
        for user in self.get_queryset():
            profile = getattr(user, "professional_profile", None)
            payload.append(
                {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                    "admin_role": getattr(user, "admin_role", ""),
                    "is_active": user.is_active,
                    "professional_slug": getattr(profile, "slug", ""),
                    "professional_name": getattr(profile, "business_name", ""),
                    "date_joined": user.date_joined,
                }
            )
        serializer = self.get_serializer(payload, many=True)
        return Response(serializer.data)


class AdminUserDirectoryView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageAdminUsers]
    serializer_class = AdminUserSummarySerializer

    def get_queryset(self):
        queryset = User.objects.select_related("professional_profile").order_by("-date_joined")
        query = self.request.query_params.get("q", "").strip()
        role = self.request.query_params.get("role", "").strip()
        status_value = self.request.query_params.get("status", "").strip()
        city = self.request.query_params.get("city", "").strip()
        verification = self.request.query_params.get("verification", "").strip()
        public_status = self.request.query_params.get("public_status", "").strip()
        incidented = self.request.query_params.get("incidented", "").strip()
        if query:
            queryset = queryset.filter(
                Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(professional_profile__business_name__icontains=query)
            )
        if role:
            queryset = queryset.filter(role=role)
        if status_value == "active":
            queryset = queryset.filter(is_active=True)
        elif status_value == "suspended":
            queryset = queryset.filter(is_active=False)
        if city:
            queryset = queryset.filter(professional_profile__city__icontains=city)
        if verification == "verified":
            queryset = queryset.filter(
                professional_profile__verification_badge_status=ProfessionalProfile.VerificationBadgeStatus.VERIFIED
            )
        elif verification == "unverified":
            queryset = queryset.exclude(
                professional_profile__verification_badge_status=ProfessionalProfile.VerificationBadgeStatus.VERIFIED
            )
        if public_status == "public":
            queryset = queryset.filter(professional_profile__is_public=True)
        elif public_status == "private":
            queryset = queryset.filter(
                Q(professional_profile__is_public=False) | Q(professional_profile__is_public__isnull=True)
            )
        return queryset.annotate(
            bookings_count=Count("professional_profile__bookings", distinct=True),
            incidents_count=Count("professional_profile__bookings__incidents", distinct=True),
            average_rating=Avg("professional_profile__reviews__rating"),
            payments_total_eur=Sum("professional_profile__bookings__amount_received_eur"),
        )[:200]

    def list(self, request, *args, **kwargs):
        payload = []
        queryset = self.get_queryset()
        incidented = self.request.query_params.get("incidented", "").strip()
        for user in queryset:
            profile = getattr(user, "professional_profile", None)
            ranking = build_profile_ranking_snapshot(profile) if profile else None
            incidents_count = int(getattr(user, "incidents_count", 0) or 0)
            if incidented == "true" and incidents_count <= 0:
                continue
            if incidented == "false" and incidents_count > 0:
                continue
            payload.append(
                {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                    "admin_role": getattr(user, "admin_role", ""),
                    "is_active": user.is_active,
                    "professional_slug": getattr(profile, "slug", ""),
                    "professional_name": getattr(profile, "business_name", ""),
                    "city": getattr(profile, "city", ""),
                    "bookings_count": int(getattr(user, "bookings_count", 0) or 0),
                    "average_rating": Decimal(getattr(user, "average_rating", 0) or 0).quantize(Decimal("0.01")),
                    "incidents_count": incidents_count,
                    "payments_total_eur": Decimal(getattr(user, "payments_total_eur", 0) or 0).quantize(Decimal("0.01")),
                    "public_profile_url": f"/{profile.slug}" if profile and profile.slug else "",
                    "is_public_profile": bool(profile and profile.is_public),
                    "verification_badge_status": getattr(profile, "verification_badge_status", ""),
                    "profile_visibility_score": int((ranking or {}).get("profile_visibility_score", 0)),
                    "payment_account_status": _build_payment_account_status(profile),
                    "date_joined": user.date_joined,
                }
            )
        serializer = self.get_serializer(payload, many=True)
        return Response(serializer.data)


class AdminUserDirectoryDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageAdminUsers]
    queryset = User.objects.select_related("professional_profile")
    serializer_class = AdminUserUpdateSerializer


class AdminUserBulkActionView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageAdminUsers]

    def post(self, request):
        ids = request.data.get("ids") or []
        action = str(request.data.get("action") or "").strip()
        if not ids or not action:
            raise ValidationError({"detail": "Sélection et action requises."})

        queryset = User.objects.filter(id__in=ids)
        if action == "suspend":
            updated = queryset.update(is_active=False)
            return Response({"updated": updated})
        if action == "reactivate":
            updated = queryset.update(is_active=True)
            return Response({"updated": updated})
        if action in {"assign_support", "assign_moderation", "send_group_message"}:
            category = (
                PlatformMessage.Category.SUPPORT
                if action == "assign_support"
                else PlatformMessage.Category.MODERATION
                if action == "assign_moderation"
                else request.data.get("category") or PlatformMessage.Category.PRODUCT
            )
            title = str(request.data.get("title") or "").strip() or "Message plateforme"
            body = str(request.data.get("body") or "").strip() or "Un message vous a été adressé depuis NUADYX."
            created = 0
            for user in queryset:
                PlatformMessage.objects.create(
                    recipient_user=user,
                    category=category,
                    title=title,
                    body=body,
                    display_mode=request.data.get("display_mode") or PlatformMessage.DisplayMode.INBOX,
                    reply_allowed=bool(request.data.get("reply_allowed")),
                    created_by=request.user,
                    metadata={
                        "ticket_status": request.data.get("ticket_status") or "pending",
                        "bulk_action": action,
                    },
                )
                created += 1
            return Response({"created": created})
        if action == "export_csv":
            rows = []
            for user in queryset.select_related("professional_profile"):
                profile = getattr(user, "professional_profile", None)
                rows.append(
                    {
                        "id": str(user.id),
                        "email": user.email,
                        "role": user.role,
                        "admin_role": getattr(user, "admin_role", ""),
                        "is_active": user.is_active,
                        "business_name": getattr(profile, "business_name", ""),
                        "city": getattr(profile, "city", ""),
                    }
                )
            return Response({"rows": rows})
        raise ValidationError({"action": "Action bulk non reconnue."})


class AdminSupportMessageListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageSupport]
    serializer_class = PlatformMessageSerializer

    def get_queryset(self):
        queryset = PlatformMessage.objects.select_related("recipient_user", "created_by").order_by("-sent_at")
        recipient_id = self.request.query_params.get("recipient_user")
        status_value = self.request.query_params.get("status")
        if recipient_id:
            queryset = queryset.filter(recipient_user_id=recipient_id)
        if status_value == "unread":
            queryset = queryset.filter(is_read=False)
        elif status_value == "read":
            queryset = queryset.filter(is_read=True)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, sent_at=timezone.now())


class AdminSupportMessageDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageSupport]
    serializer_class = PlatformMessageSerializer
    queryset = PlatformMessage.objects.select_related("recipient_user", "created_by")


class AdminAnnouncementListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageSupport]
    serializer_class = AdminAnnouncementSerializer

    def get_queryset(self):
        return AdminAnnouncement.objects.select_related("created_by").order_by("-starts_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AdminAnnouncementDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageSupport]
    serializer_class = AdminAnnouncementSerializer
    queryset = AdminAnnouncement.objects.select_related("created_by")


class AdminCampaignOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManageAdminCampaigns]

    def get(self, request):
        campaigns = ContactCampaign.objects.order_by("-created_at")[:100]
        return Response(
            {
                "summary": {
                    "total_campaigns": ContactCampaign.objects.count(),
                    "active_campaigns": ContactCampaign.objects.filter(
                        status__in=(ContactCampaign.Status.READY, ContactCampaign.Status.SENDING)
                    ).count(),
                    "sent_messages": sum(campaign.total_sent for campaign in campaigns),
                    "failed_messages": sum(campaign.total_failed for campaign in campaigns),
                }
            }
        )


class AdminRankingOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanViewAdminRanking]

    def get(self, request):
        city = request.query_params.get("city", "").strip()
        query = request.query_params.get("q", "").strip()
        queryset = ProfessionalProfile.objects.filter(is_public=True).select_related("user").order_by("-updated_at")
        if city:
            queryset = queryset.filter(city__icontains=city)
        if query:
            queryset = queryset.filter(
                Q(business_name__icontains=query)
                | Q(city__icontains=query)
                | Q(user__email__icontains=query)
            )
        rows = []
        for profile in queryset[:120]:
            rows.append(
                {
                    "id": str(profile.id),
                    "slug": profile.slug,
                    "business_name": profile.business_name,
                    "city": profile.city,
                    "is_public": profile.is_public,
                    "verification_badge_status": profile.verification_badge_status,
                    "manual_visibility_boost": profile.manual_visibility_boost,
                    **build_profile_ranking_snapshot(profile),
                }
            )
        return Response({"results": rows})

    def patch(self, request):
        profile = generics.get_object_or_404(ProfessionalProfile, pk=request.data.get("profile_id"))
        profile.manual_visibility_boost = int(request.data.get("manual_visibility_boost", 0))
        profile.save(update_fields=["manual_visibility_boost", "updated_at"])
        return Response(
            {
                "id": str(profile.id),
                "manual_visibility_boost": profile.manual_visibility_boost,
                **build_profile_ranking_snapshot(profile),
            }
        )


class AdminPlatformSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanManagePlatformSettings]

    def get(self, request):
        return Response(build_admin_platform_settings_snapshot())


class MyPlatformMessageListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MyPlatformMessageSerializer

    def get_queryset(self):
        announcements_queryset = AdminAnnouncement.objects.filter(
            is_active=True,
            starts_at__lte=timezone.now(),
        ).filter(Q(ends_at__isnull=True) | Q(ends_at__gte=timezone.now()))
        role = getattr(self.request.user, "role", "")
        if role:
            announcements_queryset = announcements_queryset.filter(
                Q(audience_role=AdminAnnouncement.AudienceRole.ALL)
                | Q(audience_role=role)
            )
        self.announcements = list(announcements_queryset.order_by("-starts_at")[:5])
        return PlatformMessage.objects.filter(
            recipient_user=self.request.user,
            is_active=True,
        ).order_by("-sent_at")[:20]

    def list(self, request, *args, **kwargs):
        messages = self.get_queryset()
        payload = self.get_serializer(messages, many=True).data
        announcements = AdminAnnouncementSerializer(self.announcements, many=True).data
        return Response({"messages": payload, "announcements": announcements})


class MyPlatformMessageDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        message = generics.get_object_or_404(
            PlatformMessage,
            pk=pk,
            recipient_user=request.user,
        )
        if request.data.get("mark_read", True):
            message.is_read = True
            message.read_at = timezone.now()
            message.save(update_fields=["is_read", "read_at", "updated_at"])
        return Response(MyPlatformMessageSerializer(message).data)


class AdminAnalyticsOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser, CanViewAnalytics]

    def get(self, request):
        filters = {
            "city": request.query_params.get("city", ""),
            "visitor_type": request.query_params.get("visitor_type", ""),
            "days": request.query_params.get("days", "30"),
        }
        return Response(build_admin_analytics_overview(filters))
