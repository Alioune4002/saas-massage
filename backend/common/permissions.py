from rest_framework.permissions import BasePermission

from professionals.models import ProfessionalProfile


def is_admin_account(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (getattr(user, "is_superuser", False) or getattr(user, "role", "") == "admin")
    )


def has_directory_permission(user, codename: str) -> bool:
    if not is_admin_account(user):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return getattr(user, "role", "") == "admin" or user.has_perm(f"directory.{codename}")


def has_admin_permission(user, permission_name: str | None = None) -> bool:
    if not is_admin_account(user):
        return False
    if getattr(user, "is_superuser", False):
        return True
    if not permission_name:
        return True
    return getattr(user, "role", "") == "admin" or user.has_perm(permission_name)


def get_admin_capabilities(user) -> dict[str, bool]:
    return {
        "ops": has_admin_permission(user, "directory.import_operator"),
        "moderation": has_admin_permission(user, "bookings.moderate_incidents"),
        "support": has_admin_permission(user, "common.manage_support_messages"),
        "analytics": has_admin_permission(user, "common.view_admin_analytics"),
        "super_admin": has_directory_permission(user, "super_admin"),
    }


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
        return is_admin_account(request.user)


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


class AdminPermission(BasePermission):
    required_permission = ""

    def has_permission(self, request, view):
        return has_admin_permission(request.user, self.required_permission)


class CanModeratePlatform(AdminPermission):
    required_permission = "bookings.moderate_incidents"


class CanManageRestrictions(AdminPermission):
    required_permission = "bookings.manage_restrictions"


class CanManageSupport(AdminPermission):
    required_permission = "common.manage_support_messages"


class CanViewAnalytics(AdminPermission):
    required_permission = "common.view_admin_analytics"
