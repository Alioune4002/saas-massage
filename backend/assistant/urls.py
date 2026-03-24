from django.urls import path

from .views import (
    ProfessionalAssistantProfileView,
    ProfessionalAssistantReplyView,
    PublicAssistantView,
)

urlpatterns = [
    path("dashboard/assistant/", ProfessionalAssistantProfileView.as_view(), name="dashboard-assistant"),
    path("dashboard/assistant/respond/", ProfessionalAssistantReplyView.as_view(), name="dashboard-assistant-respond"),
    path("assistant/<slug:slug>/", PublicAssistantView.as_view(), name="public-assistant"),
]
