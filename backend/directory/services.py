from __future__ import annotations

from dataclasses import dataclass

from django.utils import timezone

from common.communications import (
    send_claim_profile_invitation_email,
    send_directory_incomplete_profile_nudge_email,
    send_directory_removal_confirmation_email,
)
from directory.importers import CSVImporter, JsonFeedImporter
from directory.models import (
    AuditLog,
    ContactCampaign,
    ContactMessageLog,
    ImportedProfile,
    PractitionerClaim,
    RemovalRequest,
    SourceImportJob,
    SourceRegistry,
)


IMPORTER_BY_SOURCE_TYPE = {
    SourceRegistry.SourceType.MANUAL_CSV: CSVImporter,
    SourceRegistry.SourceType.API: JsonFeedImporter,
    SourceRegistry.SourceType.RSS: JsonFeedImporter,
}


def log_audit(*, actor, action: str, obj, before: dict | None = None, after: dict | None = None):
    AuditLog.objects.create(
        actor=actor,
        action=action,
        object_type=obj.__class__.__name__,
        object_id=str(obj.pk),
        before_json=before or {},
        after_json=after or {},
    )


@dataclass
class ImportExecutionResult:
    total_seen: int
    total_created: int
    total_updated: int
    total_skipped: int
    total_flagged: int
    report: dict


def get_importer_for_source(source: SourceRegistry):
    importer_class = IMPORTER_BY_SOURCE_TYPE.get(source.source_type, JsonFeedImporter)
    return importer_class


def execute_import_job(*, job: SourceImportJob, payload, mapping: dict | None = None, dry_run: bool = False) -> ImportExecutionResult:
    importer = get_importer_for_source(job.source)(source=job.source, job=job, operator=job.created_by)
    importer.ensure_source_allowed()
    job.status = SourceImportJob.Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at", "updated_at"])

    rows = importer.parse(payload, mapping=mapping or {})
    results: list[dict] = []
    created = 0
    updated = 0
    skipped = 0
    flagged = 0
    for index, row in enumerate(rows, start=1):
        normalized = importer.normalize(row)
        if not normalized["external_id"]:
            normalized["external_id"] = f"row-{index}"
        try:
            action, details = importer.upsert(
                normalized,
                allow_publish=True,
                dry_run=dry_run,
            )
            if action == "created":
                created += 1
            else:
                updated += 1
            if float(normalized["confidence_score"]) >= 0.8:
                flagged += 1
            results.append(
                {
                    "row": index,
                    "action": action,
                    "external_id": normalized["external_id"],
                    "slug": details.get("slug", ""),
                    "confidence_score": str(normalized["confidence_score"]),
                    "review_notes": normalized["review_notes"],
                }
            )
        except Exception as exc:
            skipped += 1
            results.append(
                {
                    "row": index,
                    "action": "skipped",
                    "external_id": normalized["external_id"],
                    "error": str(exc),
                }
            )

    status = SourceImportJob.Status.COMPLETED
    if skipped and (created or updated):
        status = SourceImportJob.Status.PARTIAL_FAILED
    elif skipped and not (created or updated):
        status = SourceImportJob.Status.FAILED

    report = importer.build_report(rows, results)
    if not dry_run:
        job.status = status
        job.finished_at = timezone.now()
        job.total_seen = len(rows)
        job.total_created = created
        job.total_updated = updated
        job.total_skipped = skipped
        job.total_flagged = flagged
        job.raw_report_json = report
        job.error_log_text = "\n".join(
            item["error"] for item in results if item.get("error")
        )
        job.save()

    return ImportExecutionResult(
        total_seen=len(rows),
        total_created=created,
        total_updated=updated,
        total_skipped=skipped,
        total_flagged=flagged,
        report=report,
    )


def create_claim_for_profile(*, imported_profile: ImportedProfile, email: str, practitioner_user=None, verification_method: str = PractitionerClaim.VerificationMethod.MAGIC_LINK) -> PractitionerClaim:
    claim = PractitionerClaim.objects.create(
        imported_profile=imported_profile,
        practitioner_user=practitioner_user,
        email=email,
        verification_method=verification_method,
        status=PractitionerClaim.Status.SENT,
    )
    return claim


def send_claim_invite(*, claim: PractitionerClaim, activation_url: str, campaign: ContactCampaign | None = None):
    send_claim_profile_invitation_email(claim.imported_profile, activation_url)
    ContactMessageLog.objects.create(
        campaign=campaign,
        imported_profile=claim.imported_profile,
        to_email=claim.email,
        template_key="claim_invite",
        status=ContactMessageLog.Status.SENT,
        sent_at=timezone.now(),
        meta_json={"claim_token": claim.token},
    )


def send_incomplete_profile_nudge(*, imported_profile: ImportedProfile, target_email: str, completion_url: str, campaign: ContactCampaign | None = None):
    send_directory_incomplete_profile_nudge_email(
        imported_profile=imported_profile,
        target_email=target_email,
        completion_url=completion_url,
    )
    ContactMessageLog.objects.create(
        campaign=campaign,
        imported_profile=imported_profile,
        to_email=target_email,
        template_key="incomplete_profile_nudge",
        status=ContactMessageLog.Status.SENT,
        sent_at=timezone.now(),
        meta_json={"completion_url": completion_url},
    )


def send_removal_confirmation(*, removal_request: RemovalRequest):
    send_directory_removal_confirmation_email(removal_request)
    ContactMessageLog.objects.create(
        imported_profile=removal_request.imported_profile,
        to_email=removal_request.requester_email,
        template_key="removal_confirmation",
        status=ContactMessageLog.Status.SENT,
        sent_at=timezone.now(),
        meta_json={"removal_request_id": str(removal_request.id)},
    )


def run_contact_campaign(*, campaign: ContactCampaign, base_url: str) -> dict:
    targets = ImportedProfile.objects.filter(
        import_status=ImportedProfile.ImportStatus.PUBLISHED_UNCLAIMED,
        claimable=True,
    )
    if campaign.source_id:
        targets = targets.filter(source=campaign.source)
    city = campaign.audience_filter_json.get("city")
    if city:
        targets = targets.filter(city__icontains=city)

    sent = 0
    failed = 0
    campaign.status = ContactCampaign.Status.SENDING
    campaign.total_targets = targets.count()
    campaign.save(update_fields=["status", "total_targets", "updated_at"])

    for imported_profile in targets:
        target_email = imported_profile.email_public
        if not target_email:
            failed += 1
            continue
        try:
            if campaign.email_template_key == "claim_invite":
                claim = create_claim_for_profile(imported_profile=imported_profile, email=target_email)
                send_claim_invite(
                    claim=claim,
                    activation_url=f"{base_url}/revendiquer/{claim.token}",
                    campaign=campaign,
                )
            elif campaign.email_template_key == "incomplete_profile_nudge":
                send_incomplete_profile_nudge(
                    imported_profile=imported_profile,
                    target_email=target_email,
                    completion_url=f"{base_url}/revendiquer",
                    campaign=campaign,
                )
            else:
                failed += 1
                continue
            sent += 1
        except Exception:
            failed += 1

    campaign.total_sent = sent
    campaign.total_failed = failed
    campaign.status = ContactCampaign.Status.COMPLETED
    campaign.save(update_fields=["total_sent", "total_failed", "status", "updated_at"])
    return {"sent": sent, "failed": failed, "total_targets": campaign.total_targets}
