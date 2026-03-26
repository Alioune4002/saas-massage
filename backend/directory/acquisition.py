from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from django.conf import settings

from professionals.crm import normalize_text
from professionals.models import DirectoryInterestLead, LocationIndex, ProfessionalProfile

from .models import CityGrowthPlan, ContactCampaign, ContactMessageLog, ImportedProfile, PractitionerClaim


@dataclass
class CityAcquisitionContext:
    metrics: dict[str, dict[str, Any]]
    imported_profile_ids_by_city: dict[str, list[str]]
    suggestion_ids_by_city: dict[str, list[str]]
    campaign_ids_by_city: dict[str, list[str]]


def get_default_city_objectives() -> dict[str, int]:
    return {
        "objective_profiles_total": int(getattr(settings, "NUADYX_CITY_OBJECTIVE_DEFAULT", 10)),
        "objective_claimed_profiles": int(
            getattr(settings, "NUADYX_CITY_OBJECTIVE_CLAIMED_DEFAULT", 4)
        ),
        "objective_active_profiles": int(
            getattr(settings, "NUADYX_CITY_OBJECTIVE_ACTIVE_DEFAULT", 3)
        ),
    }


def get_city_location_by_slug(city_slug: str) -> LocationIndex | None:
    if not city_slug:
        return None
    return (
        LocationIndex.objects.filter(
            is_active=True,
            location_type=LocationIndex.LocationType.CITY,
            slug=city_slug,
        )
        .order_by("-priority", "label")
        .first()
    )


def get_or_create_city_growth_plan(*, city_slug: str) -> CityGrowthPlan:
    location = get_city_location_by_slug(city_slug)
    if not location:
        raise ValueError("Cette ville n'existe pas dans le référentiel France.")
    defaults = get_default_city_objectives()
    plan, _created = CityGrowthPlan.objects.get_or_create(
        location=location,
        defaults={
            **defaults,
            "priority_level": CityGrowthPlan.PriorityLevel.MEDIUM,
            "growth_status": CityGrowthPlan.GrowthStatus.SEED,
            "is_active": True,
        },
    )
    return plan


def _city_locations():
    locations = list(
        LocationIndex.objects.filter(
            is_active=True,
            location_type=LocationIndex.LocationType.CITY,
        ).order_by("-priority", "label")
    )
    by_city: dict[str, list[LocationIndex]] = defaultdict(list)
    by_slug: dict[str, LocationIndex] = {}
    for location in locations:
        by_city[normalize_text(location.city)].append(location)
        by_slug[location.slug] = location
    return locations, by_city, by_slug


def _match_city_location_slug(
    *,
    city: str,
    postal_code: str = "",
    department_code: str = "",
    region: str = "",
    by_city: dict[str, list[LocationIndex]],
) -> str:
    normalized_city = normalize_text(city)
    if not normalized_city:
        return ""
    matches = by_city.get(normalized_city, [])
    if not matches:
        return ""
    if len(matches) == 1:
        return matches[0].slug

    best_slug = ""
    best_score = -1
    normalized_region = normalize_text(region)
    for location in matches:
        score = 10
        if postal_code and location.postal_code == postal_code:
            score += 80
        if department_code and location.department_code == department_code:
            score += 60
        if normalized_region and normalize_text(location.region) == normalized_region:
            score += 30
        if score > best_score:
            best_score = score
            best_slug = location.slug
    return best_slug if best_score > 10 else ""


def _build_city_metrics() -> CityAcquisitionContext:
    _locations, by_city, by_slug = _city_locations()
    metrics: dict[str, dict[str, Any]] = {}
    imported_profile_ids_by_city: dict[str, list[str]] = defaultdict(list)
    suggestion_ids_by_city: dict[str, list[str]] = defaultdict(list)
    campaign_ids_by_city: dict[str, list[str]] = defaultdict(list)

    def ensure_city(slug: str) -> dict[str, Any] | None:
        if not slug:
            return None
        location = by_slug.get(slug)
        if not location:
            return None
        if slug not in metrics:
            metrics[slug] = {
                "location": location,
                "claimed_profiles": 0,
                "unclaimed_profiles": 0,
                "active_profiles": 0,
                "imported_profiles": 0,
                "profiles_in_review": 0,
                "profiles_published_unclaimed": 0,
                "profiles_claimed": 0,
                "suggestions_count": 0,
                "suggestions_unprocessed_count": 0,
                "campaigns_count": 0,
                "contacts_sent": 0,
                "claims_opened": 0,
                "claims_validated": 0,
            }
        return metrics[slug]

    for profile in ProfessionalProfile.objects.exclude(city="").only(
        "id",
        "city",
        "postal_code",
        "department_code",
        "region",
        "service_area",
        "is_public",
    ):
        slug = _match_city_location_slug(
            city=profile.city,
            postal_code=profile.postal_code,
            department_code=profile.department_code,
            region=profile.region or profile.service_area,
            by_city=by_city,
        )
        entry = ensure_city(slug)
        if not entry:
            continue
        entry["claimed_profiles"] += 1
        if profile.is_public:
            entry["active_profiles"] += 1

    for imported in ImportedProfile.objects.exclude(city="").only(
        "id",
        "city",
        "postal_code",
        "region",
        "import_status",
        "is_public",
    ):
        slug = _match_city_location_slug(
            city=imported.city,
            postal_code=imported.postal_code,
            region=imported.region,
            by_city=by_city,
        )
        entry = ensure_city(slug)
        if not entry:
            continue
        imported_profile_ids_by_city[slug].append(str(imported.id))
        if imported.import_status not in {
            ImportedProfile.ImportStatus.REJECTED,
            ImportedProfile.ImportStatus.REMOVED,
        }:
            entry["imported_profiles"] += 1
        if imported.import_status in {
            ImportedProfile.ImportStatus.DRAFT_IMPORTED,
                ImportedProfile.ImportStatus.PENDING_REVIEW,
                ImportedProfile.ImportStatus.APPROVED_INTERNAL,
        }:
            entry["profiles_in_review"] += 1
        if imported.import_status == ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED:
            entry["unclaimed_profiles"] += 1
            entry["profiles_published_unclaimed"] += 1
            if imported.is_public:
                entry["active_profiles"] += 1
        if imported.import_status == ImportedProfile.ImportStatus.CLAIMED:
            entry["profiles_claimed"] += 1

    for lead in DirectoryInterestLead.objects.exclude(city="").only(
        "id",
        "city",
        "city_slug",
        "processed",
    ):
        slug = lead.city_slug or _match_city_location_slug(city=lead.city, by_city=by_city)
        entry = ensure_city(slug)
        if not entry:
            continue
        suggestion_ids_by_city[slug].append(str(lead.id))
        entry["suggestions_count"] += 1
        if not lead.processed:
            entry["suggestions_unprocessed_count"] += 1

    for log in (
        ContactMessageLog.objects.exclude(imported_profile__city="")
        .select_related("imported_profile")
        .only(
            "id",
            "status",
            "imported_profile__city",
            "imported_profile__postal_code",
            "imported_profile__region",
        )
    ):
        imported = log.imported_profile
        slug = _match_city_location_slug(
            city=imported.city,
            postal_code=imported.postal_code,
            region=imported.region,
            by_city=by_city,
        )
        entry = ensure_city(slug)
        if not entry:
            continue
        entry["contacts_sent"] += 1

    for claim in (
        PractitionerClaim.objects.exclude(imported_profile__city="")
        .select_related("imported_profile")
        .only(
            "id",
            "status",
            "imported_profile__city",
            "imported_profile__postal_code",
            "imported_profile__region",
        )
    ):
        imported = claim.imported_profile
        slug = _match_city_location_slug(
            city=imported.city,
            postal_code=imported.postal_code,
            region=imported.region,
            by_city=by_city,
        )
        entry = ensure_city(slug)
        if not entry:
            continue
        if claim.status in {
            PractitionerClaim.Status.SENT,
            PractitionerClaim.Status.VIEWED,
            PractitionerClaim.Status.INITIATED,
            PractitionerClaim.Status.VERIFIED,
            PractitionerClaim.Status.APPROVED,
        }:
            entry["claims_opened"] += 1
        if claim.status == PractitionerClaim.Status.APPROVED:
            entry["claims_validated"] += 1

    for campaign in ContactCampaign.objects.only(
        "id",
        "campaign_scope_type",
        "campaign_scope_value",
        "city",
        "department_code",
        "region",
        "audience_filter_json",
    ):
        for slug in _extract_city_slugs_from_campaign(campaign=campaign, by_slug=by_slug, by_city=by_city):
            entry = ensure_city(slug)
            if not entry:
                continue
            campaign_ids_by_city[slug].append(str(campaign.id))
            entry["campaigns_count"] += 1

    return CityAcquisitionContext(
        metrics=metrics,
        imported_profile_ids_by_city=dict(imported_profile_ids_by_city),
        suggestion_ids_by_city=dict(suggestion_ids_by_city),
        campaign_ids_by_city=dict(campaign_ids_by_city),
    )


def _extract_city_slugs_from_campaign(
    *,
    campaign: ContactCampaign,
    by_slug: dict[str, LocationIndex],
    by_city: dict[str, list[LocationIndex]],
) -> list[str]:
    if campaign.campaign_scope_type == ContactCampaign.ScopeType.CITY and campaign.campaign_scope_value:
        return [campaign.campaign_scope_value] if campaign.campaign_scope_value in by_slug else []

    if campaign.city:
        slug = _match_city_location_slug(city=campaign.city, by_city=by_city)
        return [slug] if slug else []

    city_filter = str(campaign.audience_filter_json.get("city") or "").strip()
    if city_filter:
        slug = _match_city_location_slug(city=city_filter, by_city=by_city)
        return [slug] if slug else []

    if campaign.campaign_scope_type == ContactCampaign.ScopeType.DEPARTMENT and campaign.department_code:
        return list(
            LocationIndex.objects.filter(
                is_active=True,
                location_type=LocationIndex.LocationType.CITY,
                department_code=campaign.department_code,
            )
            .values_list("slug", flat=True)
            .distinct()
        )

    if campaign.campaign_scope_type == ContactCampaign.ScopeType.REGION and campaign.region:
        return list(
            LocationIndex.objects.filter(
                is_active=True,
                location_type=LocationIndex.LocationType.CITY,
                region=campaign.region,
            )
            .values_list("slug", flat=True)
            .distinct()
        )

    return []


def _computed_growth_status(*, total_profiles: int, active_profiles: int, objective_total: int, objective_active: int) -> str:
    if total_profiles == 0:
        return CityGrowthPlan.GrowthStatus.EMPTY
    if total_profiles < max(2, objective_total // 3):
        return CityGrowthPlan.GrowthStatus.SEED
    if total_profiles < objective_total:
        return CityGrowthPlan.GrowthStatus.BUILDING
    if total_profiles >= objective_total * 2 and active_profiles >= objective_active * 2:
        return CityGrowthPlan.GrowthStatus.SATURATED
    return CityGrowthPlan.GrowthStatus.HEALTHY


def _computed_priority_level(
    *,
    total_profiles: int,
    suggestions_count: int,
    objective_total: int,
    claims_validated: int,
) -> str:
    if total_profiles == 0 and suggestions_count > 0:
        return CityGrowthPlan.PriorityLevel.CRITICAL
    if total_profiles < max(1, objective_total // 2) and suggestions_count > 0:
        return CityGrowthPlan.PriorityLevel.HIGH
    if total_profiles < objective_total:
        return CityGrowthPlan.PriorityLevel.MEDIUM
    if claims_validated == 0 and suggestions_count == 0:
        return CityGrowthPlan.PriorityLevel.LOW
    return CityGrowthPlan.PriorityLevel.LOW


def _build_recommendations(*, stats: dict[str, Any], objective_total: int) -> list[str]:
    recommendations: list[str] = []
    if stats["total_profiles"] == 0 and stats["suggestions_count"] > 0:
        recommendations.append("Ville prioritaire : demande présente mais offre absente.")
    if stats["total_profiles"] == 0:
        recommendations.append("Ville à amorcer.")
    if stats["suggestions_unprocessed_count"] > 0:
        recommendations.append("Traiter les suggestions locales en attente.")
    if stats["unclaimed_profiles"] > stats["claimed_profiles"]:
        recommendations.append("Renforcer les invitations de revendication.")
    if stats["profiles_in_review"] > 0:
        recommendations.append("Faire avancer la file de review locale.")
    if stats["contacts_sent"] > 0 and stats["claim_rate"] < 20:
        recommendations.append("Ville avec offre présente mais conversion faible.")
    if stats["total_profiles"] >= objective_total and stats["active_profiles"] >= max(1, objective_total // 2):
        recommendations.append("Ville déjà bien couverte.")
    if not recommendations:
        recommendations.append("Continuer à publier et suivre les claims.")
    return recommendations


def _build_city_growth_rows(
    *,
    context: CityAcquisitionContext,
    filters: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    filters = filters or {}
    metrics = context.metrics
    plans = {plan.city_slug: plan for plan in CityGrowthPlan.objects.select_related("location")}
    default_objectives = get_default_city_objectives()
    city_slugs = set(metrics.keys()) | set(plans.keys())
    rows: list[dict[str, Any]] = []

    for city_slug in sorted(city_slugs):
        plan = plans.get(city_slug)
        location = metrics.get(city_slug, {}).get("location") or (plan.location if plan else get_city_location_by_slug(city_slug))
        if not location:
            continue
        stats = metrics.get(city_slug, {}).copy()
        total_profiles = (
            stats.get("claimed_profiles", 0)
            + stats.get("unclaimed_profiles", 0)
            + stats.get("profiles_in_review", 0)
        )
        claim_rate = round((stats.get("claims_validated", 0) / stats.get("contacts_sent", 0)) * 100, 1) if stats.get("contacts_sent", 0) else 0.0
        objective_total = plan.objective_profiles_total if plan else default_objectives["objective_profiles_total"]
        objective_claimed = plan.objective_claimed_profiles if plan else default_objectives["objective_claimed_profiles"]
        objective_active = plan.objective_active_profiles if plan else default_objectives["objective_active_profiles"]
        computed_growth_status = _computed_growth_status(
            total_profiles=total_profiles,
            active_profiles=stats.get("active_profiles", 0),
            objective_total=objective_total,
            objective_active=objective_active,
        )
        computed_priority = _computed_priority_level(
            total_profiles=total_profiles,
            suggestions_count=stats.get("suggestions_count", 0),
            objective_total=objective_total,
            claims_validated=stats.get("claims_validated", 0),
        )
        row = {
            "plan_id": str(plan.id) if plan else "",
            "city_label": location.city or location.label,
            "city_slug": city_slug,
            "department_code": location.department_code,
            "region": location.region,
            "objective_profiles_total": objective_total,
            "objective_claimed_profiles": objective_claimed,
            "objective_active_profiles": objective_active,
            "priority_level": plan.priority_level if plan else computed_priority,
            "growth_status": plan.growth_status if plan else computed_growth_status,
            "computed_growth_status": computed_growth_status,
            "is_active": plan.is_active if plan else False,
            "total_profiles": total_profiles,
            "claimed_profiles": stats.get("claimed_profiles", 0),
            "unclaimed_profiles": stats.get("unclaimed_profiles", 0),
            "active_profiles": stats.get("active_profiles", 0),
            "suggestions_count": stats.get("suggestions_count", 0),
            "suggestions_unprocessed_count": stats.get("suggestions_unprocessed_count", 0),
            "campaigns_count": stats.get("campaigns_count", 0),
            "contacts_sent": stats.get("contacts_sent", 0),
            "claims_opened": stats.get("claims_opened", 0),
            "claims_validated": stats.get("claims_validated", 0),
            "claim_rate": claim_rate,
            "coverage_percent": round(min(100.0, (total_profiles / objective_total) * 100), 1)
            if objective_total
            else 0.0,
            "notes_internal": plan.notes_internal if plan else "",
        }
        row["recommended_action"] = _build_recommendations(stats={**stats, **row}, objective_total=objective_total)[0]
        row["recommendations"] = _build_recommendations(stats={**stats, **row}, objective_total=objective_total)
        rows.append(row)

    city_filter = normalize_text(str(filters.get("city") or ""))
    department_filter = str(filters.get("department_code") or "").strip().upper()
    region_filter = normalize_text(str(filters.get("region") or ""))
    growth_status_filter = str(filters.get("growth_status") or "").strip()
    priority_filter = str(filters.get("priority_level") or "").strip()
    suggestions_processed = filters.get("processed")

    def matches(row: dict[str, Any]) -> bool:
        if city_filter and city_filter not in normalize_text(row["city_label"]):
            return False
        if department_filter and row["department_code"] != department_filter:
            return False
        if region_filter and region_filter not in normalize_text(row["region"]):
            return False
        if growth_status_filter and row["growth_status"] != growth_status_filter:
            return False
        if priority_filter and row["priority_level"] != priority_filter:
            return False
        if suggestions_processed == "true" and row["suggestions_unprocessed_count"] > 0:
            return False
        if suggestions_processed == "false" and row["suggestions_unprocessed_count"] == 0:
            return False
        return True

    return [row for row in rows if matches(row)]


def list_city_growth_rows(filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    return _build_city_growth_rows(context=_build_city_metrics(), filters=filters)


def get_city_growth_row(city_slug: str) -> dict[str, Any]:
    rows = _build_city_growth_rows(context=_build_city_metrics())
    for row in rows:
        if row["city_slug"] == city_slug:
            return row
    raise ValueError("Ville introuvable dans le cockpit d’acquisition.")


def get_city_funnel(city_slug: str) -> dict[str, Any]:
    context = _build_city_metrics()
    row = next(
        (item for item in _build_city_growth_rows(context=context) if item["city_slug"] == city_slug),
        None,
    )
    if not row:
        raise ValueError("Ville introuvable dans le cockpit d’acquisition.")
    city_metrics = context.metrics.get(city_slug, {})
    return {
        "city_label": row["city_label"],
        "city_slug": row["city_slug"],
        "suggestions_received": row["suggestions_count"],
        "suggestions_unprocessed": row["suggestions_unprocessed_count"],
        "profiles_imported": city_metrics.get("imported_profiles", 0),
        "profiles_in_review": city_metrics.get("profiles_in_review", 0),
        "profiles_published_unclaimed": city_metrics.get("profiles_published_unclaimed", 0),
        "invitations_sent": row["contacts_sent"],
        "claims_opened": row["claims_opened"],
        "claims_validated": row["claims_validated"],
        "profiles_claimed": city_metrics.get("profiles_claimed", 0),
        "profiles_public_active": row["active_profiles"],
    }


def get_city_imported_profiles_queryset(city_slug: str):
    context = _build_city_metrics()
    matching_ids = context.imported_profile_ids_by_city.get(city_slug, [])
    return ImportedProfile.objects.filter(id__in=matching_ids).order_by("public_name")


def get_city_suggestions_queryset(city_slug: str):
    context = _build_city_metrics()
    matching_ids = context.suggestion_ids_by_city.get(city_slug, [])
    if not matching_ids:
        return DirectoryInterestLead.objects.none()
    return DirectoryInterestLead.objects.filter(id__in=matching_ids).order_by("-created_at")


def get_city_campaigns_queryset(city_slug: str):
    context = _build_city_metrics()
    matching_ids = context.campaign_ids_by_city.get(city_slug, [])
    if not matching_ids:
        return ContactCampaign.objects.none()
    return ContactCampaign.objects.filter(id__in=matching_ids).order_by("-created_at")
