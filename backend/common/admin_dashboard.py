from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Avg, Count, Sum
from django.utils import timezone

from accounts.models import User
from bookings.models import AccountRestriction, Booking, IncidentReport
from directory.acquisition import list_city_growth_rows
from directory.models import CityGrowthPlan, ContactCampaign, ImportedProfile, PractitionerClaim
from professionals.models import DirectoryInterestLead, ProfessionalProfile

from .models import AdminAnnouncement, PageViewEvent, PlatformMessage


def _build_daily_series(days: int, values: dict[str, int]) -> list[dict]:
    now = timezone.now().date()
    points = []
    for offset in range(days - 1, -1, -1):
        day = now - timedelta(days=offset)
        label = day.strftime("%d/%m")
        points.append({"date": label, "value": values.get(day.isoformat(), 0)})
    return points


def _bucket_daily(queryset, date_field: str, days: int = 14) -> list[dict]:
    start = timezone.now() - timedelta(days=days - 1)
    values = defaultdict(int)
    for item in queryset.filter(**{f"{date_field}__gte": start}).values_list(date_field, flat=True):
        if item:
            values[item.date().isoformat()] += 1
    return _build_daily_series(days, values)


def build_admin_dashboard_overview() -> dict:
    now = timezone.now()
    last_day = now - timedelta(days=1)
    last_week = now - timedelta(days=7)
    last_month = now - timedelta(days=30)

    page_views_total = PageViewEvent.objects.filter(occurred_at__gte=last_month).count()
    practitioner_signups_day = User.objects.filter(
        role=User.Role.PROFESSIONAL, date_joined__gte=last_day
    ).count()
    practitioner_signups_week = User.objects.filter(
        role=User.Role.PROFESSIONAL, date_joined__gte=last_week
    ).count()
    practitioners_total = ProfessionalProfile.objects.count()
    bookings_total = Booking.objects.count()
    bookings_last_week = Booking.objects.filter(created_at__gte=last_week).count()
    completed_bookings = Booking.objects.filter(
        fulfillment_status__in=(
            Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
            Booking.FulfillmentStatus.AUTO_COMPLETED,
        )
    )
    revenue_total = (
        Booking.objects.filter(payment_status=Booking.PaymentStatus.PAYMENT_CAPTURED)
        .aggregate(total=Sum("amount_received_eur"))
        .get("total")
        or Decimal("0.00")
    )
    revenue_last_month = (
        Booking.objects.filter(
            payment_status=Booking.PaymentStatus.PAYMENT_CAPTURED,
            created_at__gte=last_month,
        )
        .aggregate(total=Sum("amount_received_eur"))
        .get("total")
        or Decimal("0.00")
    )
    open_incidents = IncidentReport.objects.filter(
        status__in=(IncidentReport.Status.OPEN, IncidentReport.Status.IN_REVIEW)
    ).count()
    growing_cities = CityGrowthPlan.objects.filter(
        growth_status__in=(
            CityGrowthPlan.GrowthStatus.SEED,
            CityGrowthPlan.GrowthStatus.BUILDING,
        ),
        is_active=True,
    ).count()
    activated_practitioners = ProfessionalProfile.objects.filter(
        onboarding_completed=True
    ).count()

    conversion_visit_to_booking = round(
        (bookings_last_week / page_views_total) * 100, 1
    ) if page_views_total else 0.0

    top_city_rows = list_city_growth_rows()[:6]
    top_profiles = []
    for profile in ProfessionalProfile.objects.filter(is_public=True).annotate(
        avg_rating=Avg("reviews__rating"),
        bookings_count=Count("bookings", distinct=True),
    ).order_by("-manual_visibility_boost", "-created_at")[:8]:
        top_profiles.append(
            {
                "id": str(profile.id),
                "name": profile.business_name,
                "slug": profile.slug,
                "city": profile.city,
                "average_rating": round(float(profile.avg_rating or 0), 2),
                "bookings_count": profile.bookings_count,
                "is_public": profile.is_public,
            }
        )

    return {
        "snapshot_at": now,
        "widgets": {
            "practitioners_total": practitioners_total,
            "new_signups_day": practitioner_signups_day,
            "new_signups_week": practitioner_signups_week,
            "bookings_total": bookings_total,
            "bookings_last_week": bookings_last_week,
            "revenue_total_eur": str(revenue_total),
            "revenue_last_month_eur": str(revenue_last_month),
            "conversion_visit_to_booking": conversion_visit_to_booking,
            "open_incidents": open_incidents,
            "growing_cities": growing_cities,
            "activated_practitioners": activated_practitioners,
        },
        "charts": {
            "traffic": _bucket_daily(PageViewEvent.objects.all(), "occurred_at"),
            "bookings": _bucket_daily(Booking.objects.all(), "created_at"),
            "activation": _bucket_daily(
                ProfessionalProfile.objects.filter(onboarding_completed=True),
                "updated_at",
            ),
        },
        "top_cities": top_city_rows,
        "top_profiles": top_profiles,
    }


def build_admin_analytics_overview(filters: dict | None = None) -> dict:
    filters = filters or {}
    city = (filters.get("city") or "").strip()
    visitor_type = (filters.get("visitor_type") or "").strip()
    days = max(7, min(int(filters.get("days") or 30), 180))
    now = timezone.now()
    window_start = now - timedelta(days=days)

    pageviews = PageViewEvent.objects.filter(occurred_at__gte=window_start)
    bookings = Booking.objects.filter(created_at__gte=window_start)
    profiles = ProfessionalProfile.objects.all()
    if city:
        pageviews = pageviews.filter(city_slug=city)
        bookings = bookings.filter(professional__city__icontains=city)
        profiles = profiles.filter(city__icontains=city)
    if visitor_type:
        pageviews = pageviews.filter(visitor_type=visitor_type)

    top_cities = list_city_growth_rows()[:10]
    top_profiles = []
    for profile in profiles.filter(is_public=True).annotate(
        avg_rating=Avg("reviews__rating"),
        bookings_count=Count("bookings", distinct=True),
    ).order_by("-manual_visibility_boost", "-created_at")[:10]:
        top_profiles.append(
            {
                "id": str(profile.id),
                "name": profile.business_name,
                "slug": profile.slug,
                "city": profile.city,
                "average_rating": round(float(profile.avg_rating or 0), 2),
                "bookings_count": profile.bookings_count,
            }
        )

    pageviews_total = pageviews.count()
    bookings_total = bookings.count()
    claims_approved_total = PractitionerClaim.objects.filter(
        status=PractitionerClaim.Status.APPROVED,
        created_at__gte=window_start,
    ).count()
    public_profiles_total = profiles.filter(is_public=True).count()
    practitioners_total = profiles.count()
    users_total = User.objects.filter(date_joined__gte=window_start).count()

    return {
        "snapshot_at": now,
        "filters": {"city": city, "visitor_type": visitor_type, "days": days},
        "kpis": {
            "users_total": users_total,
            "practitioners_total": practitioners_total,
            "public_profiles_total": public_profiles_total,
            "bookings_total": bookings_total,
            "claims_approved_total": claims_approved_total,
            "pageviews_total": pageviews_total,
            "campaigns_total": ContactCampaign.objects.count(),
            "city_plans_total": CityGrowthPlan.objects.filter(is_active=True).count(),
        },
        "ratios": {
            "visit_to_booking": round((bookings_total / pageviews_total) * 100, 1)
            if pageviews_total
            else 0.0,
            "visit_to_claim": round((claims_approved_total / pageviews_total) * 100, 1)
            if pageviews_total
            else 0.0,
            "public_profile_rate": round((public_profiles_total / practitioners_total) * 100, 1)
            if practitioners_total
            else 0.0,
        },
        "tracking_notes": {
            "traffic": "Le trafic provient des vues de pages enregistrées par l’application sur les routes publiques et les espaces internes.",
            "conversion": "Les conversions comparent les visites suivies aux réservations et claims réellement enregistrés.",
        },
        "charts": {
            "traffic": _bucket_daily(pageviews, "occurred_at", days=min(days, 30)),
            "bookings": _bucket_daily(bookings, "created_at", days=min(days, 30)),
            "activation": _bucket_daily(
                profiles.filter(onboarding_completed=True),
                "updated_at",
                days=min(days, 30),
            ),
        },
        "top_cities": top_cities,
        "top_profiles": top_profiles,
        "traffic_by_city": [
            {"city_slug": row["city_slug"], "city_label": row["city_label"], "pageviews": pageviews.filter(city_slug=row["city_slug"]).count()}
            for row in top_cities[:8]
        ],
    }


def build_admin_platform_settings_snapshot() -> dict:
    return {
        "platform": {
            "frontend_app_url": settings.FRONTEND_APP_URL,
            "stripe_live_enabled": bool(
                settings.NUADYX_STRIPE_SECRET_KEY
                and settings.NUADYX_STRIPE_PUBLISHABLE_KEY
                and settings.NUADYX_STRIPE_WEBHOOK_SECRET
            ),
            "stripe_internal_test_mode": bool(settings.NUADYX_STRIPE_INTERNAL_TEST_MODE),
            "cookie_consent_enabled": bool(getattr(settings, "NUADYX_FEATURE_COOKIE_CONSENT", True)),
            "practitioner_verification_enabled": bool(
                getattr(settings, "NUADYX_FEATURE_PRACTITIONER_VERIFICATION", True)
            ),
            "review_replies_enabled": bool(getattr(settings, "NUADYX_FEATURE_REVIEW_REPLIES", True)),
        },
        "defaults": {
            "city_objective_total": getattr(settings, "NUADYX_CITY_OBJECTIVE_DEFAULT", 10),
            "city_objective_claimed": getattr(settings, "NUADYX_CITY_OBJECTIVE_CLAIMED_DEFAULT", 4),
            "city_objective_active": getattr(settings, "NUADYX_CITY_OBJECTIVE_ACTIVE_DEFAULT", 3),
            "default_deposit_percentage": str(getattr(settings, "NUADYX_DEFAULT_DEPOSIT_PERCENTAGE", "30.00")),
            "minimum_deposit_percentage": str(getattr(settings, "NUADYX_MIN_DEPOSIT_PERCENTAGE", "20.00")),
            "maximum_deposit_percentage": str(getattr(settings, "NUADYX_MAX_DEPOSIT_PERCENTAGE", "50.00")),
            "unverified_practitioner_max_deposit_percentage": str(
                getattr(settings, "NUADYX_UNVERIFIED_PRACTITIONER_MAX_DEPOSIT_PERCENTAGE", "20.00")
            ),
        },
        "support": {
            "email_backend": settings.EMAIL_BACKEND,
            "default_from_email": settings.DEFAULT_FROM_EMAIL,
            "active_announcements": AdminAnnouncement.objects.filter(is_active=True).count(),
            "open_platform_messages": PlatformMessage.objects.filter(is_active=True, is_read=False).count(),
        },
        "safety": {
            "active_restrictions": AccountRestriction.objects.filter(status=AccountRestriction.Status.ACTIVE).count(),
            "open_incidents": IncidentReport.objects.filter(
                status__in=(IncidentReport.Status.OPEN, IncidentReport.Status.IN_REVIEW)
            ).count(),
            "published_unclaimed_profiles": ImportedProfile.objects.filter(
                import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
                is_public=True,
            ).count(),
            "suggestions_backlog": DirectoryInterestLead.objects.filter(processed=False).count(),
        },
    }
