from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.core.validators import MinValueValidator
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
