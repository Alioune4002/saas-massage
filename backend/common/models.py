import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


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


class PlatformMessage(TimeStampedUUIDModel):
    class Category(models.TextChoices):
        SUPPORT = "support", "Support"
        BILLING = "billing", "Paiement"
        MODERATION = "moderation", "Modération"
        PRODUCT = "product", "Produit"
        SYSTEM = "system", "Système"

    class DisplayMode(models.TextChoices):
        INBOX = "inbox", "Boîte de réception"
        NOTICE = "notice", "Bandeau interne"
        POPUP = "popup", "Popup à l'ouverture"

    recipient_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="platform_messages",
    )
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.SUPPORT)
    title = models.CharField("titre", max_length=160)
    body = models.TextField("message")
    display_mode = models.CharField(
        "mode d'affichage",
        max_length=20,
        choices=DisplayMode.choices,
        default=DisplayMode.INBOX,
    )
    reply_allowed = models.BooleanField("réponse autorisée", default=False)
    is_read = models.BooleanField("lu", default=False)
    is_active = models.BooleanField("actif", default=True)
    sent_at = models.DateTimeField("envoyé le", default=timezone.now)
    read_at = models.DateTimeField("lu le", null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_platform_messages",
    )
    metadata = models.JSONField("métadonnées", default=dict, blank=True)

    class Meta:
        verbose_name = "message plateforme"
        verbose_name_plural = "messages plateforme"
        ordering = ("-sent_at", "-created_at")
        permissions = [
            ("manage_support_messages", "Can manage support messages"),
            ("view_admin_analytics", "Can view admin analytics"),
        ]
        indexes = [
            models.Index(fields=("recipient_user", "is_read", "is_active")),
            models.Index(fields=("display_mode", "is_active")),
        ]

    def __str__(self) -> str:
        return f"{self.title} → {self.recipient_user_id}"


class AdminAnnouncement(TimeStampedUUIDModel):
    class AudienceRole(models.TextChoices):
        ALL = "all", "Tous"
        PROFESSIONAL = "professional", "Praticiens"
        ADMIN = "admin", "Admins"

    class DisplayMode(models.TextChoices):
        NOTICE = "notice", "Bandeau"
        POPUP = "popup", "Popup"

    title = models.CharField("titre", max_length=160)
    body = models.TextField("message")
    audience_role = models.CharField(
        "audience",
        max_length=20,
        choices=AudienceRole.choices,
        default=AudienceRole.ALL,
    )
    display_mode = models.CharField(
        "mode d'affichage",
        max_length=20,
        choices=DisplayMode.choices,
        default=DisplayMode.NOTICE,
    )
    is_active = models.BooleanField("active", default=True)
    starts_at = models.DateTimeField("début", default=timezone.now)
    ends_at = models.DateTimeField("fin", null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_announcements",
    )
    metadata = models.JSONField("métadonnées", default=dict, blank=True)

    class Meta:
        verbose_name = "annonce admin"
        verbose_name_plural = "annonces admin"
        ordering = ("-starts_at", "-created_at")
        indexes = [
            models.Index(fields=("audience_role", "is_active")),
            models.Index(fields=("starts_at", "ends_at")),
        ]

    def __str__(self) -> str:
        return self.title
