from django.db import models

from common.models import TimeStampedUUIDModel
from professionals.models import ProfessionalProfile


class ProfessionalAssistantProfile(TimeStampedUUIDModel):
    class ResponseTone(models.TextChoices):
        RASSURANT = "rassurant", "Rassurant"
        APAISANT = "apaisant", "Apaisant"
        CHALEUREUX = "chaleureux", "Chaleureux"
        PROFESSIONAL = "professionnel", "Professionnel"
        PREMIUM = "premium", "Haut de gamme"
        SOBER = "sobre", "Sobre"

    professional = models.OneToOneField(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="assistant_profile",
    )
    assistant_enabled = models.BooleanField("assistant activé", default=False)
    welcome_message = models.CharField("message d'accueil", max_length=220, blank=True)
    activity_overview = models.TextField("présentation de l'activité", blank=True)
    general_guidance = models.TextField("consignes de réponse", blank=True)
    support_style = models.TextField("style d'accompagnement", blank=True)
    practice_information = models.TextField(
        "informations sur le cabinet ou le lieu d'accueil",
        blank=True,
    )
    faq_items = models.JSONField("questions fréquentes", default=list, blank=True)
    before_session = models.TextField("avant la séance", blank=True)
    after_session = models.TextField("après la séance", blank=True)
    service_information = models.TextField("informations sur les prestations", blank=True)
    booking_policy = models.TextField("réservation et annulation", blank=True)
    contact_information = models.TextField("informations de contact utiles", blank=True)
    business_rules = models.TextField("règles métier", blank=True)
    guardrails = models.TextField("garde-fous", blank=True)
    avoid_topics = models.TextField("questions à ne pas traiter", blank=True)
    assistant_notes = models.TextField(
        "ce que l'assistant doit savoir sur l'activité",
        blank=True,
    )
    internal_context = models.TextField("note interne de contexte", blank=True)
    response_tone = models.CharField(
        "manière de répondre",
        max_length=20,
        choices=ResponseTone.choices,
        default=ResponseTone.RASSURANT,
    )
    public_assistant_enabled = models.BooleanField(
        "assistant visible sur le profil public",
        default=False,
    )

    class Meta:
        verbose_name = "assistant praticien"
        verbose_name_plural = "assistants praticiens"

    def __str__(self) -> str:
        return f"Assistant de {self.professional.business_name}"
