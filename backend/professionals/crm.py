from __future__ import annotations

from datetime import timedelta
import unicodedata
from collections import defaultdict
from typing import Any
from urllib.parse import urlencode

from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.utils import timezone
from django.utils.text import slugify

from bookings.models import Booking, IncidentReport, RiskRegisterEntry, TrustedClient
from directory.models import ContactMessageLog, ImportedProfile, PractitionerClaim

from .models import ContactPrivateNote, ContactTag, LocationIndex, PractitionerContact, ProfessionalProfile


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_value.lower().split())


def normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def normalize_phone(value: str) -> str:
    return "".join(char for char in (value or "") if char.isdigit())


def _risk_rank(value: str) -> int:
    return {
        RiskRegisterEntry.RiskLevel.NONE: 0,
        RiskRegisterEntry.RiskLevel.LOW: 1,
        RiskRegisterEntry.RiskLevel.MEDIUM: 2,
        RiskRegisterEntry.RiskLevel.HIGH: 3,
        RiskRegisterEntry.RiskLevel.BLOCKED: 4,
    }.get(value, 0)


def determine_contact_segment(
    *,
    booking_count: int,
    validated_count: int,
    canceled_count: int,
    no_show_count: int,
    disputed_count: int,
    risk_level: str,
    is_trusted: bool,
    last_booking_at,
) -> tuple[str, int, list[str]]:
    now = timezone.now()
    reasons: list[str] = []
    score = 10
    score += validated_count * 18
    score += booking_count * 4
    score += 12 if is_trusted else 0
    score -= canceled_count * 10
    score -= no_show_count * 20
    score -= disputed_count * 25
    score -= _risk_rank(risk_level) * 12

    if risk_level == RiskRegisterEntry.RiskLevel.BLOCKED:
        reasons.append("restriction active")
        return PractitionerContact.Segment.BLOCKED, score, reasons

    if disputed_count > 0:
        reasons.append("litige ouvert ou récent")
        return PractitionerContact.Segment.DISPUTE, score, reasons

    if no_show_count > 0 and validated_count == 0:
        reasons.append("absence client confirmée")
        return PractitionerContact.Segment.NO_SHOW, score, reasons

    if risk_level in {
        RiskRegisterEntry.RiskLevel.LOW,
        RiskRegisterEntry.RiskLevel.MEDIUM,
        RiskRegisterEntry.RiskLevel.HIGH,
    }:
        reasons.append("registre de risque actif")
        return PractitionerContact.Segment.WATCH, score, reasons

    if validated_count >= 3 or is_trusted:
        reasons.append("plusieurs prestations validées")
        return PractitionerContact.Segment.LOYAL, score, reasons

    if validated_count >= 1:
        reasons.append("au moins une prestation validée")
        return PractitionerContact.Segment.ACTIVE, score, reasons

    if canceled_count > 0 and validated_count == 0:
        reasons.append("annulations sans prestation validée")
        return PractitionerContact.Segment.CANCELED, score, reasons

    if booking_count == 1 and validated_count == 0:
        reasons.append("première réservation")
        return PractitionerContact.Segment.NEW, score, reasons

    if booking_count > 0 and validated_count == 0:
        reasons.append("réservation sans prestation validée")
        return PractitionerContact.Segment.NEVER_SEEN, score, reasons

    if last_booking_at and last_booking_at <= now - timedelta(days=180):
        reasons.append("relation inactive depuis longtemps")
        return PractitionerContact.Segment.INACTIVE, score, reasons

    reasons.append("activité faible mais saine")
    return PractitionerContact.Segment.ACTIVE, score, reasons


def sync_practitioner_contacts(professional: ProfessionalProfile) -> list[PractitionerContact]:
    bookings = (
        Booking.objects.filter(professional=professional)
        .select_related("slot")
        .order_by("created_at")
    )
    trusted_clients = {
        normalize_email(client.email): client
        for client in TrustedClient.objects.filter(professional=professional, is_active=True)
    }

    active_risk_entries = (
        RiskRegisterEntry.objects.filter(
            professional=professional,
            is_active=True,
        )
        .exclude(client_email="")
        .values("client_email")
        .annotate(risk_hits=Count("id"))
    )
    risk_lookup: dict[str, str] = {}
    for email in {row["client_email"] for row in active_risk_entries}:
        entries = RiskRegisterEntry.objects.filter(
            professional=professional,
            client_email=email,
            is_active=True,
        )
        highest = RiskRegisterEntry.RiskLevel.NONE
        for entry in entries:
            if _risk_rank(entry.risk_level) > _risk_rank(highest):
                highest = entry.risk_level
        risk_lookup[normalize_email(email)] = highest

    incidents_by_email = defaultdict(list)
    for incident in IncidentReport.objects.filter(booking__professional=professional).select_related("booking"):
        incidents_by_email[normalize_email(incident.booking.client_email)].append(incident)

    seen_emails: set[str] = set()
    contacts: list[PractitionerContact] = []

    grouped_bookings: dict[str, list[Booking]] = defaultdict(list)
    for booking in bookings:
        grouped_bookings[normalize_email(booking.client_email)].append(booking)

    for normalized_email, email_bookings in grouped_bookings.items():
        if not normalized_email:
            continue
        seen_emails.add(normalized_email)
        first_booking = email_bookings[0]
        last_booking = email_bookings[-1]
        validated_count = sum(
            1
            for booking in email_bookings
            if booking.fulfillment_status
            in {
                Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
                Booking.FulfillmentStatus.AUTO_COMPLETED,
            }
        )
        canceled_count = sum(
            1 for booking in email_bookings if booking.status == Booking.Status.CANCELED
        )
        no_show_count = sum(
            1
            for booking in email_bookings
            if booking.client_no_show_at is not None
        )
        disputed_count = sum(
            1
            for incident in incidents_by_email.get(normalized_email, [])
            if incident.status in {IncidentReport.Status.OPEN, IncidentReport.Status.IN_REVIEW}
        )
        trusted_client = trusted_clients.get(normalized_email)
        risk_level = risk_lookup.get(normalized_email, RiskRegisterEntry.RiskLevel.NONE)
        segment, score, reasons = determine_contact_segment(
            booking_count=len(email_bookings),
            validated_count=validated_count,
            canceled_count=canceled_count,
            no_show_count=no_show_count,
            disputed_count=disputed_count,
            risk_level=risk_level,
            is_trusted=bool(trusted_client),
            last_booking_at=last_booking.slot.start_at if last_booking.slot_id else last_booking.created_at,
        )
        contact, _created = PractitionerContact.objects.get_or_create(
            professional=professional,
            normalized_email=normalized_email,
            defaults={
                "email": first_booking.client_email,
            },
        )
        contact.email = first_booking.client_email
        contact.first_name = first_booking.client_first_name
        contact.last_name = first_booking.client_last_name
        contact.phone = first_booking.client_phone or contact.phone
        contact.booking_count = len(email_bookings)
        contact.validated_booking_count = validated_count
        contact.canceled_booking_count = canceled_count
        contact.no_show_count = no_show_count
        contact.disputed_booking_count = disputed_count
        contact.first_booking_at = (
            first_booking.slot.start_at if first_booking.slot_id else first_booking.created_at
        )
        contact.last_booking_at = (
            last_booking.slot.start_at if last_booking.slot_id else last_booking.created_at
        )
        contact.last_validated_at = max(
            (
                booking.client_validated_at
                or booking.auto_completed_at
                or booking.service_completed_at
                for booking in email_bookings
                if booking.fulfillment_status
                in {
                    Booking.FulfillmentStatus.COMPLETED_VALIDATED_BY_CLIENT,
                    Booking.FulfillmentStatus.AUTO_COMPLETED,
                }
            ),
            default=None,
        )
        contact.segment = segment
        contact.segment_score = score
        contact.segment_reasons_json = reasons
        contact.risk_level = risk_level
        contact.is_trusted = bool(trusted_client)
        contact.save()
        if trusted_client and trusted_client.notes and not hasattr(contact, "private_note"):
            ContactPrivateNote.objects.update_or_create(
                contact=contact,
                defaults={"content": trusted_client.notes[:600]},
            )
        contacts.append(contact)

    PractitionerContact.objects.filter(professional=professional).exclude(
        normalized_email__in=seen_emails
    ).delete()
    return contacts


def get_location_suggestions(query: str, *, limit: int = 8) -> list[dict[str, Any]]:
    normalized_query = normalize_text(query)
    if not normalized_query:
        default_queryset = (
            LocationIndex.objects.filter(
                is_active=True,
                location_type__in=[
                    LocationIndex.LocationType.CITY,
                    LocationIndex.LocationType.REGION,
                    LocationIndex.LocationType.DEPARTMENT,
                ],
            )
            .annotate(
                type_rank=Case(
                    When(location_type=LocationIndex.LocationType.CITY, then=Value(3)),
                    When(location_type=LocationIndex.LocationType.DEPARTMENT, then=Value(2)),
                    default=Value(1),
                    output_field=IntegerField(),
                )
            )
            .order_by("-priority", "-type_rank", "label")[:limit]
        )
        return [_serialize_location_suggestion(item) for item in default_queryset]

    base_queryset = LocationIndex.objects.filter(is_active=True)
    numeric_query = "".join(char for char in normalized_query if char.isdigit())
    query_filter = Q(normalized_label__startswith=normalized_query) | Q(search_text__icontains=normalized_query)
    if numeric_query:
        query_filter |= Q(postal_code__startswith=numeric_query)
        query_filter |= Q(department_code__istartswith=numeric_query)

    queryset = base_queryset.filter(query_filter).annotate(
        exact_rank=Case(
            When(normalized_label=normalized_query, then=Value(600)),
            default=Value(0),
            output_field=IntegerField(),
        ),
        prefix_rank=Case(
            When(normalized_label__startswith=normalized_query, then=Value(450)),
            default=Value(0),
            output_field=IntegerField(),
        ),
        postal_rank=Case(
            When(postal_code__startswith=numeric_query, then=Value(420)) if numeric_query else When(pk__isnull=False, then=Value(0)),
            default=Value(0),
            output_field=IntegerField(),
        ),
        type_rank=Case(
            When(location_type=LocationIndex.LocationType.CITY, then=Value(40)),
            When(location_type=LocationIndex.LocationType.POSTAL_CODE, then=Value(30)),
            When(location_type=LocationIndex.LocationType.DEPARTMENT, then=Value(20)),
            When(location_type=LocationIndex.LocationType.REGION, then=Value(10)),
            default=Value(0),
            output_field=IntegerField(),
        ),
    ).order_by("-exact_rank", "-prefix_rank", "-postal_rank", "-priority", "-type_rank", "label")[:limit]

    suggestions = [_serialize_location_suggestion(item) for item in queryset]
    seen_keys = {
        (item["kind"], item["slug"], item["postal_code"])
        for item in suggestions
    }

    def append_suggestion(payload: dict[str, Any]):
        key = (payload["kind"], payload["slug"], payload["postal_code"])
        if key in seen_keys:
            return
        seen_keys.add(key)
        suggestions.append(payload)

    if len(suggestions) < limit:
        dynamic_cities = set(
            ProfessionalProfile.objects.filter(is_public=True)
            .exclude(city="")
            .values_list("city", flat=True)
        ) | set(
            ImportedProfile.objects.filter(
                import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
                is_public=True,
            )
            .exclude(city="")
            .values_list("city", flat=True)
        )
        dynamic_regions = set(
            ImportedProfile.objects.filter(
                import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
                is_public=True,
            )
            .exclude(region="")
            .values_list("region", flat=True)
        )
        dynamic_postal_codes = set(
            ImportedProfile.objects.filter(
                import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
                is_public=True,
            )
            .exclude(postal_code="")
            .values_list("postal_code", flat=True)
        )
        for city in sorted(dynamic_cities):
            if normalized_query not in normalize_text(city):
                continue
            slug = slugify(city)
            append_suggestion(
                {
                    "kind": "city",
                    "label": city,
                    "slug": slug,
                    "city": city,
                    "postal_code": "",
                    "department_name": "",
                    "region": "",
                    "country": "France",
                    "directory_url": f"/annuaire/{slug}",
                },
            )
            if len(suggestions) >= limit:
                break

        if len(suggestions) < limit:
            for region in sorted(dynamic_regions):
                if normalized_query not in normalize_text(region):
                    continue
                slug = slugify(region)
                append_suggestion(
                    {
                        "kind": "region",
                        "label": region,
                        "slug": slug,
                        "city": "",
                        "postal_code": "",
                        "department_name": "",
                        "region": region,
                        "country": "France",
                        "directory_url": f"/annuaire?{urlencode({'location_type': 'region', 'location_slug': slug, 'location_label': region})}",
                    },
                )
                if len(suggestions) >= limit:
                    break

        if len(suggestions) < limit:
            for postal_code in sorted(dynamic_postal_codes):
                if normalized_query not in normalize_text(postal_code):
                    continue
                append_suggestion(
                    {
                        "kind": "postal_code",
                        "label": postal_code,
                        "slug": postal_code,
                        "city": "",
                        "postal_code": postal_code,
                        "department_name": "",
                        "region": "",
                        "country": "France",
                        "directory_url": f"/annuaire?{urlencode({'location_type': 'postal_code', 'location_slug': postal_code, 'location_label': postal_code})}",
                    },
                )
                if len(suggestions) >= limit:
                    break

    return suggestions[:limit]


def _serialize_location_suggestion(item: LocationIndex) -> dict[str, Any]:
    if item.location_type == LocationIndex.LocationType.CITY and item.slug == slugify(item.city or item.label):
        directory_url = f"/annuaire/{item.slug}"
    elif item.location_type == LocationIndex.LocationType.CITY:
        directory_url = f"/annuaire?{urlencode({'location_type': 'city', 'location_slug': item.slug, 'location_label': item.label})}"
    else:
        directory_url = f"/annuaire?{urlencode({'location_type': item.location_type, 'location_slug': item.slug, 'location_label': item.label})}"
    return {
        "kind": item.location_type,
        "label": item.label,
        "slug": item.slug,
        "city": item.city,
        "postal_code": item.postal_code,
        "department_name": item.department_name,
        "region": item.region,
        "country": item.country,
        "directory_url": directory_url,
    }


def resolve_location_index(location_type: str, location_slug: str) -> LocationIndex | None:
    if not location_slug:
        return None
    queryset = LocationIndex.objects.filter(is_active=True, slug=location_slug)
    if location_type:
        queryset = queryset.filter(location_type=location_type)
    return queryset.order_by("-priority", "label").first()


def filter_directory_querysets_by_location(
    claimed_queryset,
    imported_queryset,
    *,
    location_type: str,
    location_slug: str,
):
    location = resolve_location_index(location_type, location_slug)
    if not location:
        return claimed_queryset, imported_queryset, None

    city_queryset = LocationIndex.objects.filter(
        is_active=True,
        location_type=LocationIndex.LocationType.CITY,
    )
    if location.location_type == LocationIndex.LocationType.CITY:
        claimed_queryset = claimed_queryset.filter(city__iexact=location.city)
        imported_queryset = imported_queryset.filter(city__iexact=location.city)
    elif location.location_type == LocationIndex.LocationType.POSTAL_CODE:
        city_names = list(
            city_queryset.filter(postal_code=location.postal_code)
            .values_list("city", flat=True)
            .distinct()
        )
        claimed_queryset = claimed_queryset.filter(city__in=city_names)
        imported_queryset = imported_queryset.filter(
            Q(postal_code=location.postal_code) | Q(city__in=city_names)
        )
    elif location.location_type == LocationIndex.LocationType.DEPARTMENT:
        department_rows = city_queryset.filter(department_code=location.department_code)
        city_names = list(department_rows.values_list("city", flat=True).distinct())
        postal_codes = list(department_rows.values_list("postal_code", flat=True).distinct())
        claimed_queryset = claimed_queryset.filter(city__in=city_names)
        imported_queryset = imported_queryset.filter(
            Q(city__in=city_names) | Q(postal_code__in=postal_codes)
        )
    elif location.location_type == LocationIndex.LocationType.REGION:
        region_rows = city_queryset.filter(region=location.region)
        city_names = list(region_rows.values_list("city", flat=True).distinct())
        postal_codes = list(region_rows.values_list("postal_code", flat=True).distinct())
        claimed_queryset = claimed_queryset.filter(
            Q(city__in=city_names) | Q(service_area__icontains=location.region)
        )
        imported_queryset = imported_queryset.filter(
            Q(region__iexact=location.region)
            | Q(city__in=city_names)
            | Q(postal_code__in=postal_codes)
        )
    return claimed_queryset, imported_queryset, location


def build_city_coverage_metrics(*, objective_per_city: int = 10) -> list[dict[str, Any]]:
    claimed_counts = {
        row["city"]: row["count"]
        for row in (
            ProfessionalProfile.objects.filter(is_public=True)
            .exclude(city="")
            .values("city")
            .annotate(count=Count("id"))
        )
    }
    unclaimed_counts = {
        row["city"]: row["count"]
        for row in (
            ImportedProfile.objects.filter(
                import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
                is_public=True,
            )
            .exclude(city="")
            .values("city")
            .annotate(count=Count("id"))
        )
    }
    active_counts = claimed_counts
    from professionals.models import DirectoryInterestLead  # local import to avoid cycle

    interest_counts = {
        row["city"]: row["count"]
        for row in (
            DirectoryInterestLead.objects.exclude(city="")
            .values("city")
            .annotate(count=Count("id"))
        )
    }
    contacts_sent_by_city = {
        row["imported_profile__city"]: row["count"]
        for row in (
            ContactMessageLog.objects.exclude(imported_profile__city="")
            .values("imported_profile__city")
            .annotate(count=Count("id"))
        )
    }
    claimed_invites_by_city = {
        row["imported_profile__city"]: row["count"]
        for row in (
            PractitionerClaim.objects.exclude(imported_profile__city="")
            .filter(status=PractitionerClaim.Status.APPROVED)
            .values("imported_profile__city")
            .annotate(count=Count("id"))
        )
    }
    cities = sorted(
        {
            *claimed_counts.keys(),
            *unclaimed_counts.keys(),
            *interest_counts.keys(),
            *contacts_sent_by_city.keys(),
        }
    )
    metrics: list[dict[str, Any]] = []
    for city in cities:
        claimed = claimed_counts.get(city, 0)
        unclaimed = unclaimed_counts.get(city, 0)
        total = claimed + unclaimed
        contacts_sent = contacts_sent_by_city.get(city, 0)
        approved_claims = claimed_invites_by_city.get(city, 0)
        demand = interest_counts.get(city, 0)
        if total == 0:
            stage = "ville vide"
        elif total < 4:
            stage = "ville amorcée"
        elif total < objective_per_city:
            stage = "ville en croissance"
        else:
            stage = "ville dense"
        metrics.append(
            {
                "city": city,
                "objective": objective_per_city,
                "total_profiles": total,
                "claimed_profiles": claimed,
                "unclaimed_profiles": unclaimed,
                "active_profiles": active_counts.get(city, 0),
                "contacts_sent": contacts_sent,
                "claim_rate": round((approved_claims / contacts_sent) * 100, 1)
                if contacts_sent
                else 0.0,
                "interest_count": demand,
                "coverage_stage": stage,
                "recommended_action": _recommend_city_action(
                    total=total,
                    demand=demand,
                    objective=objective_per_city,
                ),
            }
        )
    return metrics


def _recommend_city_action(*, total: int, demand: int, objective: int) -> str:
    if total == 0 and demand > 0:
        return "Ville prioritaire : demande présente mais offre absente."
    if total == 0:
        return "Ville à amorcer."
    if total < objective and demand >= total:
        return "Renforcer l’acquisition locale."
    if total < objective:
        return "Continuer à publier et revendiquer."
    return "Couverture saine à entretenir."
