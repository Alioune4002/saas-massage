import hashlib

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from common.permissions import CanManageSupport, CanViewAnalytics, IsAdminUser

from .admin_dashboard import build_admin_analytics_overview
from .legal import COOKIE_CONSENT_VERSION, LEGAL_DOCUMENTS
from .models import AdminAnnouncement, PlatformMessage
from .serializers import (
    AdminAnnouncementSerializer,
    AdminUserSummarySerializer,
    CookieConsentRecordSerializer,
    LegalAcceptanceSerializer,
    MyPlatformMessageSerializer,
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
                    "is_active": user.is_active,
                    "professional_slug": getattr(profile, "slug", ""),
                    "professional_name": getattr(profile, "business_name", ""),
                    "date_joined": user.date_joined,
                }
            )
        serializer = self.get_serializer(payload, many=True)
        return Response(serializer.data)


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
        return Response(build_admin_analytics_overview())
