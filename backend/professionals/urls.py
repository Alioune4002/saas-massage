from django.urls import path

from .views import (
    DirectoryInterestLeadCreateView,
    DirectoryProfileClaimRequestView,
    DirectoryProfileRemovalRequestView,
    ProfessionalDashboardProfileView,
    ProfessionalVerificationView,
    PublicDirectoryCandidateDetailView,
    PublicDirectoryListingView,
    PublicProfessionalDetailView,
    PublicProfessionalListView,
)

urlpatterns = [
    path("professionals/", PublicProfessionalListView.as_view(), name="public-professional-list"),
    path("professionals/<slug:slug>/", PublicProfessionalDetailView.as_view(), name="public-professional-detail"),
    path("directory/listings/", PublicDirectoryListingView.as_view(), name="public-directory-listings"),
    path("directory/candidates/<slug:slug>/", PublicDirectoryCandidateDetailView.as_view(), name="public-directory-candidate-detail"),
    path("directory/candidates/<slug:slug>/claim/", DirectoryProfileClaimRequestView.as_view(), name="directory-candidate-claim"),
    path("directory/candidates/<slug:slug>/remove/", DirectoryProfileRemovalRequestView.as_view(), name="directory-candidate-remove"),
    path("directory/interests/", DirectoryInterestLeadCreateView.as_view(), name="directory-interest-create"),
    path("dashboard/profile/", ProfessionalDashboardProfileView.as_view(), name="dashboard-profile"),
    path("dashboard/verification/", ProfessionalVerificationView.as_view(), name="dashboard-verification"),
]
