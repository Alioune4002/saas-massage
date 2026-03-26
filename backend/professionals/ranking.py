from __future__ import annotations

from bookings.models import AvailabilitySlot, Booking, IncidentReport


def build_profile_ranking_snapshot(profile) -> dict:
    services_count = profile.services.filter(is_active=True).count()
    slots_count = profile.availability_slots.filter(
        is_active=True,
        slot_type=AvailabilitySlot.SlotType.OPEN,
    ).count()
    reviews_count = profile.reviews.filter(status="approved").count()
    bookings_count = profile.bookings.count()
    completed_bookings_count = profile.bookings.filter(
        fulfillment_status__in=(
            Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
            Booking.FulfillmentStatus.AUTO_COMPLETED,
        )
    ).count()
    low_quality_signals = IncidentReport.objects.filter(
        booking__professional=profile,
        status__in=(IncidentReport.Status.OPEN, IncidentReport.Status.IN_REVIEW),
    ).count()

    completeness_signals = {
        "bio": bool(profile.bio.strip()),
        "headline": bool(profile.public_headline.strip()),
        "city": bool(profile.city.strip()),
        "photos": bool(profile.profile_photo or profile.cover_photo),
        "services": services_count > 0,
        "availabilities": slots_count > 0,
        "specialties": bool(profile.specialties),
        "contact": bool(profile.phone.strip() or profile.public_email.strip()),
        "booking_rules": bool(profile.payment_message.strip()),
    }
    completeness_score = round(
        (sum(1 for value in completeness_signals.values() if value) / len(completeness_signals))
        * 100
    )

    visibility_score = min(
        100,
        completeness_score
        + min(services_count * 4, 16)
        + min(slots_count, 10)
        + min(reviews_count * 4, 16)
        + min(completed_bookings_count * 3, 18)
        + (8 if profile.verification_badge_status == profile.VerificationBadgeStatus.VERIFIED else 0)
        + (4 if profile.accepts_online_booking else 0)
        - min(low_quality_signals * 8, 24),
    )

    return {
        "profile_completeness_score": completeness_score,
        "profile_visibility_score": max(0, visibility_score),
        "ranking_signals": {
            "services_count": services_count,
            "open_slots_count": slots_count,
            "reviews_count": reviews_count,
            "bookings_count": bookings_count,
            "completed_bookings_count": completed_bookings_count,
            "low_quality_signals": low_quality_signals,
            "verification_badge_status": profile.verification_badge_status,
            "accepts_online_booking": profile.accepts_online_booking,
            "completeness_signals": completeness_signals,
        },
    }
