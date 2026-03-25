from __future__ import annotations

from abc import ABC, abstractmethod

from django.utils import timezone

from directory.dedupe import build_dedupe_key, compute_similarity
from directory.models import ImportedProfile, SourceImportJob, SourceRegistry


class BaseImporter(ABC):
    def __init__(self, *, source: SourceRegistry, job: SourceImportJob | None = None, operator=None):
        self.source = source
        self.job = job
        self.operator = operator

    def ensure_source_allowed(self):
        if not self.source.is_approved:
            raise ValueError("Cette source n'est pas approuvée ou active.")

    @abstractmethod
    def fetch(self, **kwargs):
        raise NotImplementedError

    @abstractmethod
    def parse(self, payload, **kwargs) -> list[dict]:
        raise NotImplementedError

    def normalize(self, row: dict) -> dict:
        normalized = {
            "external_id": str(row.get("external_id") or row.get("id") or "").strip(),
            "source_url": str(row.get("source_url") or row.get("url") or "").strip(),
            "public_name": str(row.get("public_name") or row.get("business_name") or "").strip(),
            "business_name": str(row.get("business_name") or row.get("public_name") or "").strip(),
            "first_name": str(row.get("first_name") or "").strip(),
            "last_name": str(row.get("last_name") or "").strip(),
            "city": str(row.get("city") or "").strip(),
            "postal_code": str(row.get("postal_code") or "").strip(),
            "region": str(row.get("region") or "").strip(),
            "country": str(row.get("country") or "France").strip(),
            "phone_public": str(row.get("phone_public") or row.get("phone") or "").strip(),
            "email_public": str(row.get("email_public") or row.get("email") or "").strip(),
            "website_url": str(row.get("website_url") or row.get("website") or "").strip(),
            "instagram_url": str(row.get("instagram_url") or row.get("instagram") or "").strip(),
            "service_tags_json": row.get("service_tags_json") or row.get("service_tags") or [],
            "practice_modes_json": row.get("practice_modes_json") or row.get("practice_modes") or [],
            "bio_short": str(row.get("bio_short") or row.get("bio") or "").strip(),
            "address_public_text": str(row.get("address_public_text") or row.get("address") or "").strip(),
            "has_public_booking_link": bool(row.get("has_public_booking_link") or row.get("booking_url")),
            "public_status_note": str(row.get("public_status_note") or "").strip(),
            "contains_personal_data": bool(row.get("contains_personal_data", False)),
            "source_snapshot_json": row,
        }
        normalized["dedupe_key"] = build_dedupe_key(
            public_name=normalized["public_name"],
            city=normalized["city"],
            phone_public=normalized["phone_public"],
            website_url=normalized["website_url"],
            instagram_url=normalized["instagram_url"],
        )
        normalized["publishable_minimum_ok"] = self.validate_minimum(normalized)
        normalized["contact_allowed_based_on_source_policy"] = bool(
            self.source.can_contact_imported_profiles
        )
        normalized["claimable"] = normalized["publishable_minimum_ok"]
        return normalized

    def validate_minimum(self, profile: dict) -> bool:
        return bool(profile.get("public_name") and profile.get("city"))

    def find_duplicate_signals(self, normalized: dict) -> tuple[float, list[str]]:
        candidates = ImportedProfile.objects.filter(
            dedupe_key=normalized["dedupe_key"]
        ).exclude(source=self.source, external_id=normalized["external_id"])[:5]
        best_score = 0.0
        best_reasons: list[str] = []
        for candidate in candidates:
            score, reasons = compute_similarity(left=normalized, right={
                "public_name": candidate.public_name,
                "business_name": candidate.business_name,
                "city": candidate.city,
                "phone_public": candidate.phone_public,
                "website_url": candidate.website_url,
                "instagram_url": candidate.instagram_url,
            })
            if score > best_score:
                best_score = score
                best_reasons = reasons
        return best_score, best_reasons

    def upsert(self, normalized: dict, *, allow_publish: bool = False, dry_run: bool = False) -> tuple[str, dict]:
        confidence_score, duplicate_reasons = self.find_duplicate_signals(normalized)
        normalized["confidence_score"] = confidence_score
        normalized["review_notes"] = (
            f"Signaux doublon: {', '.join(duplicate_reasons)}" if duplicate_reasons else ""
        )
        import_status = ImportedProfile.ImportStatus.PENDING_REVIEW
        is_public = False
        if (
            allow_publish
            and self.source.default_visibility_mode == SourceRegistry.DefaultVisibilityMode.UNCLAIMED_PUBLIC
            and normalized["publishable_minimum_ok"]
            and confidence_score < 0.8
            and not self.source.requires_manual_review_before_publish
        ):
            import_status = ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED
            is_public = True

        defaults = {
            **normalized,
            "source_job": self.job,
            "last_seen_at": timezone.now(),
            "import_status": import_status,
            "is_public": is_public,
        }
        if dry_run:
            exists = ImportedProfile.objects.filter(
                source=self.source,
                external_id=normalized["external_id"],
            ).exists()
            return ("updated" if exists else "created"), defaults

        profile, created = ImportedProfile.objects.update_or_create(
            source=self.source,
            external_id=normalized["external_id"],
            defaults=defaults,
        )
        if confidence_score >= 0.8 and profile.import_status != ImportedProfile.ImportStatus.CLAIMED:
            profile.import_status = ImportedProfile.ImportStatus.PENDING_REVIEW
            profile.is_public = False
            profile.save(update_fields=["import_status", "is_public", "updated_at"])
        return ("created" if created else "updated"), {"id": str(profile.id), "slug": profile.slug}

    def build_report(self, rows: list[dict], results: list[dict]) -> dict:
        return {
            "rows_seen": len(rows),
            "results": results,
        }
