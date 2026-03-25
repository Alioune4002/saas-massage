from rest_framework.permissions import BasePermission

from professionals.models import ProfessionalProfile


def has_directory_permission(user, codename: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False):
        return True
    if getattr(user, "role", "") == "admin":
        return True
    return user.has_perm(f"directory.{codename}")


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


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (getattr(request.user, "is_superuser", False) or getattr(request.user, "role", "") == "admin")
        )


class DirectoryPermission(BasePermission):
    required_permission = ""

    def has_permission(self, request, view):
        return has_directory_permission(request.user, self.required_permission)


class CanReviewSources(DirectoryPermission):
    required_permission = "source_reviewer"


class CanOperateImports(DirectoryPermission):
    required_permission = "import_operator"


class CanReviewProfiles(DirectoryPermission):
    required_permission = "profile_reviewer"


class CanApproveCampaigns(DirectoryPermission):
    required_permission = "campaign_approver"


class CanSuperviseDirectory(DirectoryPermission):
    required_permission = "super_admin"
