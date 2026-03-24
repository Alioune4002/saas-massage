from rest_framework.permissions import BasePermission

from professionals.models import ProfessionalProfile


class IsProfessionalUser(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "professional"
        )


class HasProfessionalProfile(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return ProfessionalProfile.objects.filter(user=request.user).exists()