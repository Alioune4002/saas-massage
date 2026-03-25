from django.urls import path

from .views import (
    ProfessionalDashboardProfileView,
    ProfessionalVerificationView,
    PublicProfessionalDetailView,
    PublicProfessionalListView,
)

urlpatterns = [
    path("professionals/", PublicProfessionalListView.as_view(), name="public-professional-list"),
    path("professionals/<slug:slug>/", PublicProfessionalDetailView.as_view(), name="public-professional-detail"),
    path("dashboard/profile/", ProfessionalDashboardProfileView.as_view(), name="dashboard-profile"),
    path("dashboard/verification/", ProfessionalVerificationView.as_view(), name="dashboard-verification"),
]
