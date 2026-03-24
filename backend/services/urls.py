from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PublicMassageServiceListView, ProfessionalServiceViewSet

router = DefaultRouter()
router.register("dashboard/services", ProfessionalServiceViewSet, basename="dashboard-services")

urlpatterns = [
    path("services/", PublicMassageServiceListView.as_view(), name="public-services"),
    path("", include(router.urls)),
]