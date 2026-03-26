from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from accounts.models import User
from bookings.models import Booking, IncidentReport
from directory.acquisition import list_city_growth_rows
from directory.models import CityGrowthPlan, ContactCampaign, ImportedProfile, PractitionerClaim
from professionals.models import DirectoryInterestLead, ProfessionalProfile


def build_admin_analytics_overview() -> dict:
    now = timezone.now()
    last_30_days = now - timedelta(days=30)

    users_total = User.objects.count()
    practitioners_total = User.objects.filter(role=User.Role.PROFESSIONAL).count()
    admins_total = User.objects.filter(role=User.Role.ADMIN).count()
    profiles_total = ProfessionalProfile.objects.count()
    public_profiles_total = ProfessionalProfile.objects.filter(is_public=True).count()
    imported_profiles_total = ImportedProfile.objects.count()
    published_unclaimed_total = ImportedProfile.objects.filter(
        import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
        is_public=True,
    ).count()
    claims_total = PractitionerClaim.objects.count()
    claims_approved_total = PractitionerClaim.objects.filter(
        status=PractitionerClaim.Status.APPROVED
    ).count()
    bookings_total = Booking.objects.count()
    bookings_last_30_days = Booking.objects.filter(created_at__gte=last_30_days).count()
    confirmed_bookings_total = Booking.objects.filter(status=Booking.Status.CONFIRMED).count()
    completed_bookings_total = Booking.objects.filter(
        fulfillment_status__in=(
            Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
            Booking.FulfillmentStatus.AUTO_COMPLETED,
        )
    ).count()
    disputed_bookings_total = Booking.objects.filter(
        fulfillment_status=Booking.FulfillmentStatus.DISPUTED
    ).count()
    incidents_open_total = IncidentReport.objects.filter(
        status__in=(IncidentReport.Status.OPEN, IncidentReport.Status.IN_REVIEW)
    ).count()
    suggestions_total = DirectoryInterestLead.objects.count()
    suggestions_last_30_days = DirectoryInterestLead.objects.filter(
        created_at__gte=last_30_days
    ).count()
    campaigns_total = ContactCampaign.objects.count()
    city_plans_total = CityGrowthPlan.objects.filter(is_active=True).count()

    city_rows = list_city_growth_rows()
    top_cities = [
        {
            "city_slug": row["city_slug"],
            "city_label": row["city_label"],
            "coverage_percent": row["coverage_percent"],
            "claimed_profiles": row["claimed_profiles"],
            "active_profiles": row["active_profiles"],
            "priority_level": row["priority_level"],
            "recommended_action": row["recommended_action"],
        }
        for row in city_rows[:8]
    ]

    return {
        "snapshot_at": now,
        "kpis": {
            "users_total": users_total,
            "practitioners_total": practitioners_total,
            "admins_total": admins_total,
            "profiles_total": profiles_total,
            "public_profiles_total": public_profiles_total,
            "imported_profiles_total": imported_profiles_total,
            "published_unclaimed_total": published_unclaimed_total,
            "claims_total": claims_total,
            "claims_approved_total": claims_approved_total,
            "bookings_total": bookings_total,
            "bookings_last_30_days": bookings_last_30_days,
            "confirmed_bookings_total": confirmed_bookings_total,
            "completed_bookings_total": completed_bookings_total,
            "disputed_bookings_total": disputed_bookings_total,
            "incidents_open_total": incidents_open_total,
            "suggestions_total": suggestions_total,
            "suggestions_last_30_days": suggestions_last_30_days,
            "campaigns_total": campaigns_total,
            "city_plans_total": city_plans_total,
        },
        "ratios": {
            "claim_approval_rate": round(
                (claims_approved_total / claims_total) * 100, 1
            )
            if claims_total
            else 0.0,
            "public_profile_rate": round(
                (public_profiles_total / profiles_total) * 100, 1
            )
            if profiles_total
            else 0.0,
            "directory_publication_rate": round(
                (published_unclaimed_total / imported_profiles_total) * 100, 1
            )
            if imported_profiles_total
            else 0.0,
        },
        "tracking_notes": {
            "traffic": "Le trafic détaillé n'est pas encore tracé dans l'app. Cette vue expose uniquement les volumes réellement disponibles côté produit.",
            "conversion": "Les conversions affichées proviennent des inscriptions, claims, profils publics, réservations et campagnes existants.",
        },
        "top_cities": top_cities,
    }
