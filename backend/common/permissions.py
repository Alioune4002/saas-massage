from rest_framework.permissions import BasePermission

from professionals.models import ProfessionalProfile


ADMIN_ROLE_CAPABILITIES = {
    "admin": {
        "ops",
        "users",
        "moderation",
        "campaigns",
        "analytics",
        "support",
        "ranking",
        "settings",
        "super_admin",
    },
    "ops": {"ops", "users", "campaigns", "analytics", "ranking"},
    "moderator": {"moderation", "users"},
    "support": {"support", "users"},
}


def is_admin_account(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and (getattr(user, "is_superuser", False) or getattr(user, "role", "") == "admin")
    )


def get_admin_role_scope(user) -> str:
    if not is_admin_account(user):
        return ""
    if getattr(user, "is_superuser", False):
        return "admin"
    scope = getattr(user, "admin_role", "") or "admin"
    return scope


def can_access_admin_section(user, section: str) -> bool:
    if not is_admin_account(user):
        return False
    if getattr(user, "is_superuser", False):
        return True
    return section in ADMIN_ROLE_CAPABILITIES.get(get_admin_role_scope(user), set())


def has_directory_permission(user, codename: str) -> bool:
    if not is_admin_account(user):
        return False
    if getattr(user, "is_superuser", False):
        return True
    if getattr(user, "role", "") == "admin" and can_access_admin_section(user, "ops"):
        return True
    return user.has_perm(f"directory.{codename}")


def has_admin_permission(user, permission_name: str | None = None) -> bool:
    if not is_admin_account(user):
        return False
    if getattr(user, "is_superuser", False):
        return True
    if not permission_name:
        return True
    permission_map = {
        "bookings.moderate_incidents": "moderation",
        "bookings.manage_restrictions": "moderation",
        "common.manage_support_messages": "support",
        "common.view_admin_analytics": "analytics",
        "common.manage_admin_users": "users",
        "common.manage_admin_campaigns": "campaigns",
        "common.view_admin_ranking": "ranking",
        "common.manage_platform_settings": "settings",
    }
    section = permission_map.get(permission_name)
    if section and can_access_admin_section(user, section):
        return True
    return user.has_perm(permission_name)


def get_admin_capabilities(user) -> dict[str, bool]:
    return {
        "dashboard": is_admin_account(user),
        "ops": can_access_admin_section(user, "ops"),
        "users": can_access_admin_section(user, "users"),
        "moderation": can_access_admin_section(user, "moderation"),
        "campaigns": can_access_admin_section(user, "campaigns"),
        "support": can_access_admin_section(user, "support"),
        "analytics": can_access_admin_section(user, "analytics"),
        "ranking": can_access_admin_section(user, "ranking"),
        "settings": can_access_admin_section(user, "settings"),
        "super_admin": can_access_admin_section(user, "super_admin"),
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


class CanManageAdminUsers(AdminPermission):
    required_permission = "common.manage_admin_users"


class CanManageAdminCampaigns(AdminPermission):
    required_permission = "common.manage_admin_campaigns"


class CanViewAdminRanking(AdminPermission):
    required_permission = "common.view_admin_ranking"


class CanManagePlatformSettings(AdminPermission):
    required_permission = "common.manage_platform_settings"
