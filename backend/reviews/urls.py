from django.urls import path

from .views import (
    ProfessionalReviewFlagView,
    ProfessionalReviewListView,
    ProfessionalReviewResponseView,
    PublicReviewListView,
    PublicReviewSubmissionView,
    ReviewInvitationListCreateView,
    ReviewInvitationTokenInfoView,
)

urlpatterns = [
    path("dashboard/reviews/", ProfessionalReviewListView.as_view(), name="dashboard-reviews"),
    path("dashboard/reviews/<uuid:review_id>/flag/", ProfessionalReviewFlagView.as_view(), name="dashboard-review-flag"),
    path("dashboard/reviews/<uuid:review_id>/respond/", ProfessionalReviewResponseView.as_view(), name="dashboard-review-respond"),
    path("dashboard/review-invitations/", ReviewInvitationListCreateView.as_view(), name="dashboard-review-invitations"),
    path("reviews/submit/", PublicReviewSubmissionView.as_view(), name="public-review-submit"),
    path("reviews/token-info/", ReviewInvitationTokenInfoView.as_view(), name="public-review-token-info"),
    path("reviews/<slug:slug>/", PublicReviewListView.as_view(), name="public-reviews"),
]
