from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from common.models import TimeStampedUUIDModel


class SourceRegistry(TimeStampedUUIDModel):
    class SourceType(models.TextChoices):
        MANUAL_CSV = "manual_csv", "Import CSV manuel"
        MANUAL_FORM = "manual_form", "Saisie manuelle"
        API = "api", "API"
        RSS = "rss", "Flux RSS"
        PARSER_CUSTOM = "parser_custom", "Parser custom"

    class LegalStatus(models.TextChoices):
        PENDING_REVIEW = "pending_review", "En revue"
        APPROVED = "approved", "Approuvée"
        BLOCKED = "blocked", "Bloquée"
        RETIRED = "retired", "Retirée"

    class DefaultVisibilityMode(models.TextChoices):
        PRIVATE_DRAFT = "private_draft", "Brouillon privé"
        UNCLAIMED_PUBLIC = "unclaimed_public", "Publique non revendiquée"

    name = models.CharField(max_length=160, unique=True)
    base_url = models.URLField(blank=True)
    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    is_active = models.BooleanField(default=True)
    legal_status = models.CharField(
        max_length=20,
        choices=LegalStatus.choices,
        default=LegalStatus.PENDING_REVIEW,
    )
    tos_url = models.URLField(blank=True)
    robots_url = models.URLField(blank=True)
    notes_internal = models.TextField(blank=True)
    import_policy_json = models.JSONField(default=dict, blank=True)
    allowed_fields_json = models.JSONField(default=list, blank=True)
    requires_manual_review_before_publish = models.BooleanField(default=True)
    can_contact_imported_profiles = models.BooleanField(default=False)
    default_visibility_mode = models.CharField(
        max_length=20,
        choices=DefaultVisibilityMode.choices,
        default=DefaultVisibilityMode.PRIVATE_DRAFT,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_sources",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "source autorisée"
        verbose_name_plural = "sources autorisées"
        ordering = ("name",)
        permissions = [
            ("source_reviewer", "Can review import sources"),
            ("import_operator", "Can operate imports"),
            ("profile_reviewer", "Can review imported profiles"),
            ("campaign_approver", "Can approve contact campaigns"),
            ("super_admin", "Can supervise directory operations"),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def is_approved(self) -> bool:
        return self.legal_status == self.LegalStatus.APPROVED and self.is_active


class SourceImportJob(TimeStampedUUIDModel):
    class TriggerType(models.TextChoices):
        MANUAL = "manual", "Manuel"
        SCHEDULED = "scheduled", "Planifié"
        API_PUSH = "api_push", "Push API"

    class Status(models.TextChoices):
        QUEUED = "queued", "En file"
        RUNNING = "running", "En cours"
        COMPLETED = "completed", "Terminé"
        PARTIAL_FAILED = "partial_failed", "Partiellement échoué"
        FAILED = "failed", "Échoué"
        CANCELLED = "cancelled", "Annulé"

    source = models.ForeignKey(
        SourceRegistry,
        on_delete=models.PROTECT,
        related_name="import_jobs",
    )
    trigger_type = models.CharField(max_length=20, choices=TriggerType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_import_jobs",
    )
    total_seen = models.PositiveIntegerField(default=0)
    total_created = models.PositiveIntegerField(default=0)
    total_updated = models.PositiveIntegerField(default=0)
    total_skipped = models.PositiveIntegerField(default=0)
    total_flagged = models.PositiveIntegerField(default=0)
    error_log_text = models.TextField(blank=True)
    raw_report_json = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "job d'import"
        verbose_name_plural = "jobs d'import"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.source.name} — {self.get_status_display()}"


class ImportedProfile(TimeStampedUUIDModel):
    class ImportStatus(models.TextChoices):
        DRAFT_IMPORTED = "draft_imported", "Brouillon importé"
        PENDING_REVIEW = "pending_review", "En revue"
        APPROVED_INTERNAL = "approved_internal", "Approuvé en interne"
        PUBLISHED_UNCLAIMED = "published_unclaimed", "Publié non revendiqué"
        CLAIMED = "claimed", "Revendiqué"
        REJECTED = "rejected", "Refusé"
        REMOVED = "removed", "Retiré"

    source = models.ForeignKey(
        SourceRegistry,
        on_delete=models.PROTECT,
        related_name="imported_profiles",
    )
    source_job = models.ForeignKey(
        SourceImportJob,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profiles",
    )
    external_id = models.CharField(max_length=255)
    source_url = models.URLField(blank=True)
    source_snapshot_json = models.JSONField(default=dict, blank=True)
    imported_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)
    import_status = models.CharField(
        max_length=30,
        choices=ImportStatus.choices,
        default=ImportStatus.DRAFT_IMPORTED,
    )
    dedupe_key = models.CharField(max_length=255, blank=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default="0.00")
    review_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_imported_profiles",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    slug = models.SlugField(max_length=170, unique=True)
    public_name = models.CharField(max_length=160)
    business_name = models.CharField(max_length=160, blank=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    city = models.CharField(max_length=120, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    region = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, default="France", blank=True)
    phone_public = models.CharField(max_length=40, blank=True)
    email_public = models.EmailField(blank=True)
    website_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    service_tags_json = models.JSONField(default=list, blank=True)
    practice_modes_json = models.JSONField(default=list, blank=True)
    bio_short = models.CharField(max_length=280, blank=True)
    address_public_text = models.CharField(max_length=220, blank=True)
    has_public_booking_link = models.BooleanField(default=False)
    public_status_note = models.CharField(max_length=220, blank=True)
    contains_personal_data = models.BooleanField(default=False)
    contact_allowed_based_on_source_policy = models.BooleanField(default=False)
    publishable_minimum_ok = models.BooleanField(default=False)
    removal_requested = models.BooleanField(default=False)
    claimable = models.BooleanField(default=True)
    is_public = models.BooleanField(default=False)

    class Meta:
        verbose_name = "profil importé"
        verbose_name_plural = "profils importés"
        ordering = ("public_name", "city")
        constraints = [
            models.UniqueConstraint(
                fields=("source", "external_id"),
                name="unique_imported_profile_per_source_external_id",
            )
        ]
        indexes = [
            models.Index(fields=("import_status",)),
            models.Index(fields=("source",)),
            models.Index(fields=("city",)),
            models.Index(fields=("dedupe_key",)),
            models.Index(fields=("external_id",)),
            models.Index(fields=("claimable",)),
            models.Index(fields=("is_public",)),
        ]

    def __str__(self) -> str:
        return self.public_name

    def clean(self):
        if not isinstance(self.service_tags_json, list):
            raise ValidationError({"service_tags_json": "Les tags doivent être fournis sous forme de liste."})
        if not isinstance(self.practice_modes_json, list):
            raise ValidationError({"practice_modes_json": "Les modes de pratique doivent être fournis sous forme de liste."})
        if self.is_public and self.import_status not in {
            self.ImportStatus.PUBLISHED_UNCLAIMED,
            self.ImportStatus.CLAIMED,
        }:
            raise ValidationError({"is_public": "Un profil public doit être publié ou revendiqué."})

    def save(self, *args, **kwargs):
        base_slug = slugify(self.business_name or self.public_name or self.external_id) or uuid4().hex[:12]
        if not self.slug:
            candidate = base_slug
            suffix = 1
            from professionals.models import ProfessionalProfile, RESERVED_PUBLIC_SLUGS

            while (
                candidate in RESERVED_PUBLIC_SLUGS
                or ImportedProfile.objects.exclude(pk=self.pk).filter(slug=candidate).exists()
                or ProfessionalProfile.objects.filter(slug=candidate).exists()
            ):
                suffix += 1
                candidate = f"{base_slug[:150]}-{suffix}"
            self.slug = candidate
        self.service_tags_json = [str(item).strip() for item in self.service_tags_json if str(item).strip()][:12]
        self.practice_modes_json = [str(item).strip() for item in self.practice_modes_json if str(item).strip()][:8]
        self.full_clean()
        return super().save(*args, **kwargs)


class PractitionerClaim(TimeStampedUUIDModel):
    class Status(models.TextChoices):
        SENT = "sent", "Envoyé"
        VIEWED = "viewed", "Ouvert"
        INITIATED = "initiated", "Initié"
        VERIFIED = "verified", "Vérifié"
        APPROVED = "approved", "Approuvé"
        REJECTED = "rejected", "Refusé"
        EXPIRED = "expired", "Expiré"

    class VerificationMethod(models.TextChoices):
        MAGIC_LINK = "magic_link", "Lien magique"
        EMAIL_CODE = "email_code", "Code email"
        ADMIN_MANUAL = "admin_manual", "Validation manuelle"

    imported_profile = models.ForeignKey(
        ImportedProfile,
        on_delete=models.CASCADE,
        related_name="claims",
    )
    practitioner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="directory_claims",
    )
    email = models.EmailField()
    token = models.CharField(max_length=64, unique=True, editable=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SENT)
    verification_method = models.CharField(
        max_length=20,
        choices=VerificationMethod.choices,
        default=VerificationMethod.MAGIC_LINK,
    )
    sent_at = models.DateTimeField(default=timezone.now)
    viewed_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    decision_notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "revendication praticien"
        verbose_name_plural = "revendications praticien"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.imported_profile.public_name} — {self.email}"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = uuid4().hex
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=14)
        return super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at or self.status == self.Status.EXPIRED


class RemovalRequest(TimeStampedUUIDModel):
    class Status(models.TextChoices):
        RECEIVED = "received", "Reçue"
        PENDING_REVIEW = "pending_review", "En revue"
        COMPLETED = "completed", "Traité"
        REJECTED = "rejected", "Refusé"

    imported_profile = models.ForeignKey(
        ImportedProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="removal_requests",
    )
    requester_email = models.EmailField()
    requester_name = models.CharField(max_length=160)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_removal_requests",
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "demande de suppression"
        verbose_name_plural = "demandes de suppression"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.requester_email} — {self.status}"


class CityGrowthPlan(TimeStampedUUIDModel):
    class PriorityLevel(models.TextChoices):
        LOW = "low", "Faible"
        MEDIUM = "medium", "Moyenne"
        HIGH = "high", "Haute"
        CRITICAL = "critical", "Critique"

    class GrowthStatus(models.TextChoices):
        EMPTY = "empty", "Vide"
        SEED = "seed", "Amorcée"
        BUILDING = "building", "En croissance"
        HEALTHY = "healthy", "Saine"
        SATURATED = "saturated", "Saturée"
        DEPRIORITIZED = "deprioritized", "Dépriorisée"

    location = models.OneToOneField(
        "professionals.LocationIndex",
        on_delete=models.PROTECT,
        related_name="city_growth_plan",
    )
    city_label = models.CharField(max_length=160)
    city_slug = models.SlugField(max_length=170, unique=True)
    department_code = models.CharField(max_length=10, blank=True)
    region = models.CharField(max_length=120, blank=True)
    objective_profiles_total = models.PositiveIntegerField(default=10)
    objective_claimed_profiles = models.PositiveIntegerField(default=4)
    objective_active_profiles = models.PositiveIntegerField(default=3)
    priority_level = models.CharField(
        max_length=20,
        choices=PriorityLevel.choices,
        default=PriorityLevel.MEDIUM,
    )
    growth_status = models.CharField(
        max_length=20,
        choices=GrowthStatus.choices,
        default=GrowthStatus.SEED,
    )
    notes_internal = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "plan de croissance ville"
        verbose_name_plural = "plans de croissance villes"
        ordering = ("city_label",)
        indexes = [
            models.Index(fields=("city_slug",)),
            models.Index(fields=("priority_level",)),
            models.Index(fields=("growth_status",)),
            models.Index(fields=("department_code",)),
            models.Index(fields=("region",)),
        ]

    def __str__(self) -> str:
        return self.city_label

    def save(self, *args, **kwargs):
        self.city_label = self.location.city or self.location.label
        self.city_slug = self.location.slug
        self.department_code = self.location.department_code
        self.region = self.location.region
        self.full_clean()
        return super().save(*args, **kwargs)


class ContactCampaign(TimeStampedUUIDModel):
    class CampaignType(models.TextChoices):
        CLAIM_INVITE = "claim_invite", "Invitation de revendication"
        INCOMPLETE_PROFILE_NUDGE = "incomplete_profile_nudge", "Relance fiche incomplète"
        SOURCE_RECONTACT = "source_recontact", "Recontact source"
        SEO = "seo", "SEO local"
        BOOST = "boost", "Mise en avant"
        ACQUISITION = "acquisition", "Acquisition"
        EMAIL = "email", "Email"

    class ScopeType(models.TextChoices):
        GLOBAL = "global", "Global"
        CITY = "city", "Ville"
        DEPARTMENT = "department", "Département"
        REGION = "region", "Région"
        SOURCE = "source", "Source"

    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        READY = "ready", "Prête"
        SENDING = "sending", "En envoi"
        PAUSED = "paused", "En pause"
        COMPLETED = "completed", "Terminée"
        CANCELLED = "cancelled", "Annulée"

    name = models.CharField(max_length=160)
    source = models.ForeignKey(
        SourceRegistry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
    )
    campaign_type = models.CharField(max_length=30, choices=CampaignType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    campaign_scope_type = models.CharField(
        max_length=20,
        choices=ScopeType.choices,
        default=ScopeType.GLOBAL,
    )
    campaign_scope_value = models.CharField(max_length=170, blank=True)
    city = models.CharField(max_length=120, blank=True)
    department_code = models.CharField(max_length=10, blank=True)
    region = models.CharField(max_length=120, blank=True)
    audience_filter_json = models.JSONField(default=dict, blank=True)
    email_template_key = models.CharField(max_length=80)
    campaign_message = models.TextField(blank=True)
    budget_eur = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_contact_campaigns",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_contact_campaigns",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    total_targets = models.PositiveIntegerField(default=0)
    total_sent = models.PositiveIntegerField(default=0)
    total_failed = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "campagne de contact"
        verbose_name_plural = "campagnes de contact"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("city",)),
            models.Index(fields=("department_code",)),
            models.Index(fields=("region",)),
            models.Index(fields=("campaign_scope_type", "campaign_scope_value")),
        ]

    def __str__(self) -> str:
        return self.name


class ContactMessageLog(TimeStampedUUIDModel):
    class MessageType(models.TextChoices):
        EMAIL = "email", "Email"

    class Status(models.TextChoices):
        QUEUED = "queued", "En file"
        SENT = "sent", "Envoyé"
        DELIVERED = "delivered", "Distribué"
        OPENED = "opened", "Ouvert"
        CLICKED = "clicked", "Cliqué"
        BOUNCED = "bounced", "Rebond"
        FAILED = "failed", "Échoué"

    campaign = models.ForeignKey(
        ContactCampaign,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="messages",
    )
    imported_profile = models.ForeignKey(
        ImportedProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contact_messages",
    )
    to_email = models.EmailField()
    template_key = models.CharField(max_length=80)
    message_type = models.CharField(max_length=20, choices=MessageType.choices, default=MessageType.EMAIL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    provider_message_id = models.CharField(max_length=160, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    meta_json = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "journal de message"
        verbose_name_plural = "journaux de messages"
        ordering = ("-created_at",)


class AuditLog(TimeStampedUUIDModel):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="directory_audit_logs",
    )
    action = models.CharField(max_length=120)
    object_type = models.CharField(max_length=120)
    object_id = models.CharField(max_length=64)
    before_json = models.JSONField(default=dict, blank=True)
    after_json = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "audit log"
        verbose_name_plural = "audit logs"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.action} — {self.object_type}:{self.object_id}"
