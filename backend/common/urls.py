from django.urls import path

from .views import (
    AdminAnalyticsOverviewView,
    AdminAnnouncementDetailView,
    AdminAnnouncementListCreateView,
    AdminSupportMessageDetailView,
    AdminSupportMessageListCreateView,
    AdminSupportUserListView,
    CookieConsentCreateView,
    LegalAcceptanceCreateView,
    MyPlatformMessageDetailView,
    MyPlatformMessageListView,
    RuntimeConfigView,
)

urlpatterns = [
    path("runtime-config/", RuntimeConfigView.as_view(), name="runtime-config"),
    path("consents/cookies/", CookieConsentCreateView.as_view(), name="cookie-consent"),
    path("consents/legal/", LegalAcceptanceCreateView.as_view(), name="legal-acceptance"),
    path("admin/support/users", AdminSupportUserListView.as_view(), name="admin-support-users"),
    path("admin/support/messages", AdminSupportMessageListCreateView.as_view(), name="admin-support-messages"),
    path("admin/support/messages/<uuid:pk>", AdminSupportMessageDetailView.as_view(), name="admin-support-message-detail"),
    path("admin/support/announcements", AdminAnnouncementListCreateView.as_view(), name="admin-support-announcements"),
    path("admin/support/announcements/<uuid:pk>", AdminAnnouncementDetailView.as_view(), name="admin-support-announcement-detail"),
    path("admin/analytics/overview", AdminAnalyticsOverviewView.as_view(), name="admin-analytics-overview"),
    path("me/platform-messages", MyPlatformMessageListView.as_view(), name="me-platform-messages"),
    path("me/platform-messages/<uuid:pk>", MyPlatformMessageDetailView.as_view(), name="me-platform-message-detail"),
]
