from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from pathlib import Path
from uuid import uuid4
from decimal import Decimal

from common.models import TimeStampedUUIDModel


slug_validator = RegexValidator(
    regex=r"^[a-z0-9-]+$",
    message="Le slug ne peut contenir que des lettres minuscules, chiffres et tirets.",
)

RESERVED_PUBLIC_SLUGS = {
    "admin",
    "assistant",
    "api",
    "availabilities",
    "bookings",
    "dashboard",
    "health",
    "login",
    "profil-public",
    "praticiens",
    "services",
    "static",
}


def validate_public_slug(value: str):
    if value in RESERVED_PUBLIC_SLUGS:
        raise ValidationError("Ce lien public n'est pas disponible.")


def build_professional_media_path(instance, folder: str, filename: str) -> str:
    suffix = Path(filename).suffix.lower() or ".bin"
    profile_identifier = str(instance.pk or "pending")
    return f"professionals/{profile_identifier}/{folder}/{uuid4().hex}{suffix}"


def professional_profile_photo_upload_to(_instance, filename: str) -> str:
    return build_professional_media_path(_instance, "profile", filename)


def professional_cover_photo_upload_to(_instance, filename: str) -> str:
    return build_professional_media_path(_instance, "cover", filename)


def practitioner_verification_upload_to(instance, filename: str, folder: str) -> str:
    professional_id = str(instance.professional_id or "pending")
    suffix = Path(filename).suffix.lower() or ".bin"
    return f"professionals/{professional_id}/verification/{folder}/{uuid4().hex}{suffix}"


def verification_identity_document_upload_to(instance, filename: str) -> str:
    return practitioner_verification_upload_to(instance, filename, "identity")


def verification_selfie_upload_to(instance, filename: str) -> str:
    return practitioner_verification_upload_to(instance, filename, "selfie")


def verification_activity_upload_to(instance, filename: str) -> str:
    return practitioner_verification_upload_to(instance, filename, "activity")


def verification_insurance_upload_to(instance, filename: str) -> str:
    return practitioner_verification_upload_to(instance, filename, "insurance")


def verification_iban_upload_to(instance, filename: str) -> str:
    return practitioner_verification_upload_to(instance, filename, "iban")


class ProfessionalProfile(TimeStampedUUIDModel):
    class ActivityType(models.TextChoices):
        SOLO = "solo", "Praticien solo"
        STUDIO = "studio", "Cabinet / studio"
        SPA = "spa", "Spa / institut"
        TEAM = "team", "Équipe de praticiens"

    class PracticeMode(models.TextChoices):
        STUDIO = "studio", "En cabinet / studio"
        HOME = "home", "À domicile"
        MOBILE = "mobile", "En déplacement / itinérant"
        CORPORATE = "corporate", "En entreprise / en événementiel"
        MIXED = "mixed", "Mixte"

    class OnboardingStep(models.TextChoices):
        WELCOME = "welcome", "Bienvenue"
        ACTIVITY = "activity", "Activité"
        SERVICES = "services", "Prestations"
        SETTING = "setting", "Cadre d'accueil"
        SLOTS = "slots", "Créneaux"
        READY = "ready", "Prêt"

    class VisualTheme(models.TextChoices):
        EPURE = "epure", "Épure"
        CHALEUR = "chaleur", "Chaleur"
        PRESTIGE = "prestige", "Prestige"

    class ReservationPaymentMode(models.TextChoices):
        NONE = "none", "Sans paiement à la réservation"
        DEPOSIT = "deposit", "Avec acompte"
        FULL = "full", "Avec paiement total"

    class DepositValueType(models.TextChoices):
        FIXED = "fixed", "Montant fixe"
        PERCENTAGE = "percentage", "Pourcentage"

    class VerificationBadgeStatus(models.TextChoices):
        NONE = "none", "Aucun"
        PENDING = "pending", "En attente"
        VERIFIED = "verified", "Vérifié"
        SUSPENDED = "suspended", "Suspendu"
        EXPIRED = "expired", "Expiré"

    class AcquisitionSource(models.TextChoices):
        DIRECT_SIGNUP = "direct_signup", "Inscription directe"
        IMPORTED_CLAIMED = "imported_claimed", "Fiche importée revendiquée"
        ADMIN_CREATED = "admin_created", "Créé par admin"
        REFERRAL = "referral", "Par recommandation"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="professional_profile",
    )
    business_name = models.CharField("nom affiché", max_length=160)
    slug = models.SlugField(
        "slug public",
        unique=True,
        validators=[slug_validator, validate_public_slug],
    )
    activity_type = models.CharField(
        "type d'activité",
        max_length=20,
        choices=ActivityType.choices,
        default=ActivityType.SOLO,
    )
    practice_mode = models.CharField(
        "façon d'exercer",
        max_length=20,
        choices=PracticeMode.choices,
        default=PracticeMode.STUDIO,
    )
    city = models.CharField("ville", max_length=120, blank=True)
    service_area = models.CharField("zone desservie", max_length=180, blank=True)
    venue_details = models.TextField("lieu d'accueil", blank=True)
    access_details = models.TextField("accès et repères", blank=True)
    ambience_details = models.TextField("ambiance et cadre", blank=True)
    equipment_provided = models.TextField("ce que le praticien apporte", blank=True)
    client_preparation = models.TextField("ce que le client doit prévoir", blank=True)
    ideal_for = models.TextField("pour qui ou pour quoi le praticien reçoit", blank=True)
    highlight_points = models.JSONField("points forts", default=list, blank=True)
    bio = models.TextField("présentation", blank=True)
    public_headline = models.CharField("accroche publique", max_length=180, blank=True)
    specialties = models.JSONField("spécialités", default=list, blank=True)
    visual_theme = models.CharField(
        "thème visuel",
        max_length=20,
        choices=VisualTheme.choices,
        default=VisualTheme.EPURE,
    )
    phone = models.CharField("téléphone", max_length=30, blank=True)
    public_email = models.EmailField("email public", blank=True)
    website_url = models.URLField("site web", blank=True)
    instagram_url = models.URLField("Instagram", blank=True)
    facebook_url = models.URLField("Facebook", blank=True)
    tiktok_url = models.URLField("TikTok", blank=True)
    imported_profile_origin = models.ForeignKey(
        "directory.ImportedProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="claimed_professional_profiles",
    )
    profile_claimed_from_import = models.BooleanField(
        "profil revendiqué depuis import",
        default=False,
    )
    verification_badge_status = models.CharField(
        "statut du badge public",
        max_length=20,
        choices=VerificationBadgeStatus.choices,
        default=VerificationBadgeStatus.NONE,
    )
    acquisition_source = models.CharField(
        "source d'acquisition",
        max_length=20,
        choices=AcquisitionSource.choices,
        default=AcquisitionSource.DIRECT_SIGNUP,
    )
    is_public = models.BooleanField("profil public", default=True)
    accepts_online_booking = models.BooleanField("réservation en ligne active", default=True)
    reservation_payment_mode = models.CharField(
        "mode de règlement à la réservation",
        max_length=20,
        choices=ReservationPaymentMode.choices,
        default=ReservationPaymentMode.NONE,
    )
    deposit_value_type = models.CharField(
        "type de valeur d'acompte",
        max_length=20,
        choices=DepositValueType.choices,
        default=DepositValueType.FIXED,
    )
    deposit_value = models.DecimalField(
        "montant ou pourcentage d'acompte",
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    free_cancellation_notice_hours = models.PositiveIntegerField(
        "annulation sans frais jusqu'à",
        default=24,
    )
    keep_payment_after_deadline = models.BooleanField(
        "conserver le règlement après le délai",
        default=True,
    )
    payment_message = models.CharField(
        "message rassurant sur le règlement",
        max_length=220,
        blank=True,
    )
    profile_photo = models.FileField(
        "photo de profil",
        upload_to=professional_profile_photo_upload_to,
        blank=True,
    )
    cover_photo = models.FileField(
        "photo de couverture",
        upload_to=professional_cover_photo_upload_to,
        blank=True,
    )
    onboarding_step = models.CharField(
        "étape d'accompagnement",
        max_length=20,
        choices=OnboardingStep.choices,
        default=OnboardingStep.WELCOME,
    )
    onboarding_completed = models.BooleanField(
        "accompagnement terminé",
        default=False,
    )

    class Meta:
        verbose_name = "profil professionnel"
        verbose_name_plural = "profils professionnels"

    def __str__(self) -> str:
        return self.business_name

    def clean(self):
        super().clean()

        if self.reservation_payment_mode == self.ReservationPaymentMode.DEPOSIT:
            if self.deposit_value <= Decimal("0.00"):
                raise ValidationError(
                    {"deposit_value": "Renseignez un acompte supérieur à 0."}
                )
            if (
                self.deposit_value_type == self.DepositValueType.PERCENTAGE
                and self.deposit_value > Decimal("100.00")
            ):
                raise ValidationError(
                    {"deposit_value": "Le pourcentage d'acompte ne peut pas dépasser 100 %."}
                )
        elif self.deposit_value and self.deposit_value != Decimal("0.00"):
            raise ValidationError(
                {
                    "deposit_value": "Aucun acompte n'est nécessaire si vous ne demandez pas d'acompte à la réservation."
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ProfessionalPaymentAccount(TimeStampedUUIDModel):
    class Provider(models.TextChoices):
        STRIPE_CONNECT = "stripe_connect", "Stripe Connect"

    class OnboardingStatus(models.TextChoices):
        NOT_STARTED = "not_started", "Non commencé"
        PENDING = "pending", "En attente"
        ACTIVE = "active", "Actif"
        RESTRICTED = "restricted", "Restreint"

    professional = models.OneToOneField(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="payment_account",
    )
    provider = models.CharField(
        "prestataire de paiement",
        max_length=30,
        choices=Provider.choices,
        default=Provider.STRIPE_CONNECT,
    )
    onboarding_status = models.CharField(
        "statut du compte de paiement",
        max_length=20,
        choices=OnboardingStatus.choices,
        default=OnboardingStatus.NOT_STARTED,
    )
    stripe_account_id = models.CharField("identifiant Stripe", max_length=80, blank=True)
    account_email = models.EmailField("email du compte de paiement", blank=True)
    country = models.CharField("pays", max_length=2, default="FR")
    default_currency = models.CharField("devise", max_length=3, default="eur")
    details_submitted = models.BooleanField("informations transmises", default=False)
    charges_enabled = models.BooleanField("encaissements activés", default=False)
    payouts_enabled = models.BooleanField("versements activés", default=False)
    last_onboarding_link_requested_at = models.DateTimeField(
        "dernier lien d'activation demandé",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "compte de paiement professionnel"
        verbose_name_plural = "comptes de paiement professionnels"

    def __str__(self) -> str:
        return f"{self.professional.business_name} — {self.get_provider_display()}"


class PractitionerVerification(TimeStampedUUIDModel):
    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Non commencé"
        PENDING = "pending", "En attente"
        IN_REVIEW = "in_review", "En revue"
        VERIFIED = "verified", "Vérifié"
        REJECTED = "rejected", "Refusé"
        EXPIRED = "expired", "Expiré"

    professional = models.OneToOneField(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="verification",
    )
    status = models.CharField(
        "statut KYC",
        max_length=20,
        choices=Status.choices,
        default=Status.NOT_STARTED,
    )
    siren = models.CharField("SIREN", max_length=20, blank=True)
    siret = models.CharField("SIRET", max_length=20, blank=True)
    beneficiary_name = models.CharField("bénéficiaire", max_length=180, blank=True)
    iban_last4 = models.CharField("4 derniers chiffres IBAN", max_length=4, blank=True)
    identity_document = models.FileField(
        "pièce d'identité",
        upload_to=verification_identity_document_upload_to,
        blank=True,
    )
    selfie_document = models.FileField(
        "selfie de vérification",
        upload_to=verification_selfie_upload_to,
        blank=True,
    )
    activity_document = models.FileField(
        "justificatif d'activité",
        upload_to=verification_activity_upload_to,
        blank=True,
    )
    liability_insurance_document = models.FileField(
        "attestation RC Pro",
        upload_to=verification_insurance_upload_to,
        blank=True,
    )
    iban_document = models.FileField(
        "justificatif bancaire",
        upload_to=verification_iban_upload_to,
        blank=True,
    )
    submitted_at = models.DateTimeField("soumis le", null=True, blank=True)
    reviewed_at = models.DateTimeField("revue le", null=True, blank=True)
    verified_at = models.DateTimeField("vérifié le", null=True, blank=True)
    expires_at = models.DateTimeField("expire le", null=True, blank=True)
    rejection_reason = models.CharField("motif de refus", max_length=280, blank=True)
    internal_notes = models.TextField("notes internes", blank=True)

    class Meta:
        verbose_name = "vérification praticien"
        verbose_name_plural = "vérifications praticiens"

    def __str__(self) -> str:
        return f"{self.professional.business_name} — {self.get_status_display()}"

    @property
    def badge_is_active(self) -> bool:
        if self.status != self.Status.VERIFIED:
            return False
        if self.expires_at and self.expires_at <= timezone.now():
            return False
        return True

    def refresh_expired_status(self, *, save: bool = True) -> bool:
        if self.status == self.Status.VERIFIED and self.expires_at and self.expires_at <= timezone.now():
            self.status = self.Status.EXPIRED
            if save:
                self.save(update_fields=["status", "updated_at"])
            return True
        return False


class PractitionerVerificationDecision(TimeStampedUUIDModel):
    verification = models.ForeignKey(
        PractitionerVerification,
        on_delete=models.CASCADE,
        related_name="decisions",
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="practitioner_verification_decisions",
    )
    from_status = models.CharField("ancien statut", max_length=20, blank=True)
    to_status = models.CharField("nouveau statut", max_length=20)
    reason = models.CharField("motif", max_length=280, blank=True)

    class Meta:
        verbose_name = "décision de vérification"
        verbose_name_plural = "décisions de vérification"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.verification.professional.business_name} → {self.to_status}"


class DirectoryProfileCandidate(TimeStampedUUIDModel):
    class Status(models.TextChoices):
        DRAFT_IMPORTED = "draft_imported", "Brouillon importé"
        PENDING_REVIEW = "pending_review", "En revue"
        PUBLISHED_UNCLAIMED = "published_unclaimed", "Publié non revendiqué"
        CLAIMED = "claimed", "Revendiqué"
        REMOVED = "removed", "Retiré"

    linked_professional = models.OneToOneField(
        ProfessionalProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="directory_candidate",
    )
    status = models.CharField(
        "statut de fiche",
        max_length=30,
        choices=Status.choices,
        default=Status.DRAFT_IMPORTED,
    )
    business_name = models.CharField("nom affiché", max_length=160)
    slug = models.SlugField(
        "slug public",
        unique=True,
        validators=[slug_validator, validate_public_slug],
    )
    city = models.CharField("ville", max_length=120, blank=True)
    service_area = models.CharField("zone desservie", max_length=180, blank=True)
    public_headline = models.CharField("accroche publique", max_length=180, blank=True)
    bio = models.TextField("présentation", blank=True)
    specialties = models.JSONField("spécialités", default=list, blank=True)
    massage_categories = models.JSONField("catégories massage", default=list, blank=True)
    public_email = models.EmailField("email public", blank=True)
    phone = models.CharField("téléphone public", max_length=30, blank=True)
    source_label = models.CharField("source", max_length=120, blank=True)
    source_url = models.URLField("source_url", blank=True)
    source_payload = models.JSONField("payload source", default=dict, blank=True)
    imported_at = models.DateTimeField("importé le", default=timezone.now)
    published_at = models.DateTimeField("publié le", null=True, blank=True)
    claim_token = models.CharField("claim_token", max_length=64, unique=True, editable=False)
    claimed_at = models.DateTimeField("revendiqué le", null=True, blank=True)
    removal_requested_at = models.DateTimeField("suppression demandée le", null=True, blank=True)
    internal_notes = models.TextField("notes internes", blank=True)

    class Meta:
        verbose_name = "fiche candidate annuaire"
        verbose_name_plural = "fiches candidates annuaire"
        ordering = ("business_name",)

    def __str__(self) -> str:
        return self.business_name

    def clean(self):
        super().clean()
        if not isinstance(self.specialties, list):
            raise ValidationError({"specialties": "Les spécialités doivent être une liste."})
        if not isinstance(self.massage_categories, list):
            raise ValidationError({"massage_categories": "Les catégories doivent être une liste."})
        self.specialties = [str(item).strip() for item in self.specialties if str(item).strip()][:8]
        self.massage_categories = [
            str(item).strip() for item in self.massage_categories if str(item).strip()
        ][:6]

    def save(self, *args, **kwargs):
        if not self.claim_token:
            self.claim_token = uuid4().hex
        if self.status == self.Status.PUBLISHED_UNCLAIMED and not self.published_at:
            self.published_at = timezone.now()
        if self.status == self.Status.CLAIMED and not self.claimed_at:
            self.claimed_at = timezone.now()
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def is_publicly_visible(self) -> bool:
        return self.status == self.Status.PUBLISHED_UNCLAIMED


class DirectoryProfileClaimRequest(TimeStampedUUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        APPROVED = "approved", "Approuvée"
        REJECTED = "rejected", "Refusée"

    candidate = models.ForeignKey(
        DirectoryProfileCandidate,
        on_delete=models.CASCADE,
        related_name="claim_requests",
    )
    claimant_name = models.CharField("nom du demandeur", max_length=160)
    claimant_email = models.EmailField("email du demandeur")
    claimant_phone = models.CharField("téléphone du demandeur", max_length=30, blank=True)
    message = models.TextField("message", blank=True)
    status = models.CharField(
        "statut",
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reviewed_at = models.DateTimeField("traité le", null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="directory_claim_reviews",
    )
    review_notes = models.TextField("notes de traitement", blank=True)

    class Meta:
        verbose_name = "demande de revendication"
        verbose_name_plural = "demandes de revendication"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.candidate.business_name} — {self.claimant_email}"


class DirectoryProfileRemovalRequest(TimeStampedUUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        COMPLETED = "completed", "Traitée"

    candidate = models.ForeignKey(
        DirectoryProfileCandidate,
        on_delete=models.CASCADE,
        related_name="removal_requests",
    )
    requester_name = models.CharField("nom du demandeur", max_length=160)
    requester_email = models.EmailField("email du demandeur")
    reason = models.TextField("motif", blank=True)
    status = models.CharField(
        "statut",
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    reviewed_at = models.DateTimeField("traité le", null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="directory_removal_reviews",
    )

    class Meta:
        verbose_name = "demande de suppression de fiche"
        verbose_name_plural = "demandes de suppression de fiche"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Suppression {self.candidate.business_name} — {self.requester_email}"


class DirectoryInterestLead(TimeStampedUUIDModel):
    class Kind(models.TextChoices):
        SUGGEST_PRACTITIONER = "suggest_practitioner", "Suggérer un praticien"
        RECOMMEND_MY_MASSAGE_THERAPIST = "recommend_masseur", "Recommander mon masseur"
        CITY_WAITLIST = "city_waitlist", "Prévenu à l'ouverture"

    kind = models.CharField("type de demande", max_length=40, choices=Kind.choices)
    full_name = models.CharField("nom", max_length=160)
    email = models.EmailField("email")
    city = models.CharField("ville", max_length=120, blank=True)
    practitioner_name = models.CharField("praticien suggéré", max_length=160, blank=True)
    message = models.TextField("message", blank=True)
    source_page = models.CharField("page source", max_length=200, blank=True)
    processed = models.BooleanField("traité", default=False)

    class Meta:
        verbose_name = "lead annuaire"
        verbose_name_plural = "leads annuaire"
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_kind_display()} — {self.email}"
