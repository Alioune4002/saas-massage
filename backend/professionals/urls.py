from django.urls import path

from .views import (
    DirectoryInterestLeadCreateView,
    DirectoryProfileClaimRequestView,
    DirectoryProfileRemovalRequestView,
    ProfessionalContactDetailView,
    ProfessionalContactListView,
    ProfessionalContactTagDetailView,
    ProfessionalContactTagListCreateView,
    ProfessionalDashboardProfileView,
    ProfessionalVerificationView,
    PublicDirectoryCandidateDetailView,
    PublicDirectoryListingView,
    PublicFavoriteDetailView,
    PublicFavoritesView,
    PublicLocationSuggestionView,
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
    path("public/favorites", PublicFavoritesView.as_view(), name="public-favorites"),
    path("public/favorites/<slug:slug>", PublicFavoriteDetailView.as_view(), name="public-favorite-detail"),
    path("public/location-suggestions", PublicLocationSuggestionView.as_view(), name="public-location-suggestions"),
    path("dashboard/profile/", ProfessionalDashboardProfileView.as_view(), name="dashboard-profile"),
    path("dashboard/verification/", ProfessionalVerificationView.as_view(), name="dashboard-verification"),
    path("dashboard/contacts/", ProfessionalContactListView.as_view(), name="dashboard-contacts"),
    path("dashboard/contacts/<uuid:pk>/", ProfessionalContactDetailView.as_view(), name="dashboard-contact-detail"),
    path("dashboard/contact-tags/", ProfessionalContactTagListCreateView.as_view(), name="dashboard-contact-tags"),
    path("dashboard/contact-tags/<uuid:pk>/", ProfessionalContactTagDetailView.as_view(), name="dashboard-contact-tag-detail"),
]
