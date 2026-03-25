import uuid
from django.conf import settings
from django.db import models


class TimeStampedUUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    updated_at = models.DateTimeField("mis à jour le", auto_now=True)

    class Meta:
        abstract = True


class LegalAcceptanceRecord(TimeStampedUUIDModel):
    class Source(models.TextChoices):
        REGISTRATION = "registration", "Inscription"
        DASHBOARD = "dashboard", "Espace praticien"
        BOOKING = "booking", "Réservation"
        SUPPORT = "support", "Support"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="legal_acceptance_records",
    )
    email_snapshot = models.EmailField("email au moment de l'acceptation", blank=True)
    document_slug = models.CharField("document", max_length=60)
    document_version = models.CharField("version", max_length=40)
    source = models.CharField(
        "contexte d'acceptation",
        max_length=20,
        choices=Source.choices,
        default=Source.REGISTRATION,
    )
    accepted_at = models.DateTimeField("accepté le")
    ip_hash = models.CharField("empreinte IP", max_length=64, blank=True)
    user_agent_hash = models.CharField(
        "empreinte user agent",
        max_length=64,
        blank=True,
    )
    metadata = models.JSONField("métadonnées", default=dict, blank=True)

    class Meta:
        verbose_name = "preuve d'acceptation légale"
        verbose_name_plural = "preuves d'acceptation légale"
        ordering = ("-accepted_at", "-created_at")
        indexes = [
            models.Index(fields=("document_slug", "document_version")),
        ]

    def __str__(self) -> str:
        return f"{self.document_slug} {self.document_version}"


class CookieConsentRecord(TimeStampedUUIDModel):
    class Source(models.TextChoices):
        BANNER = "banner", "Bandeau"
        PREFERENCES = "preferences", "Centre de préférences"
        SUPPORT = "support", "Support"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cookie_consent_records",
    )
    session_key = models.CharField("identifiant local", max_length=120, blank=True)
    consent_version = models.CharField("version CMP", max_length=40)
    source = models.CharField(
        "source",
        max_length=20,
        choices=Source.choices,
        default=Source.BANNER,
    )
    necessary = models.BooleanField("cookies nécessaires", default=True)
    analytics = models.BooleanField("mesure d'audience", default=False)
    advertising = models.BooleanField("publicité / retargeting", default=False)
    support = models.BooleanField("support / tiers", default=False)
    accepted_at = models.DateTimeField("consenti le")
    revoked_at = models.DateTimeField("retiré le", null=True, blank=True)
    ip_hash = models.CharField("empreinte IP", max_length=64, blank=True)
    user_agent_hash = models.CharField(
        "empreinte user agent",
        max_length=64,
        blank=True,
    )
    evidence = models.JSONField("preuve complémentaire", default=dict, blank=True)

    class Meta:
        verbose_name = "preuve de consentement cookies"
        verbose_name_plural = "preuves de consentement cookies"
        ordering = ("-accepted_at", "-created_at")

    def __str__(self) -> str:
        return f"Consentement {self.consent_version}"
