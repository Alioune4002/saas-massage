from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from common.models import TimeStampedUUIDModel
from professionals.models import ProfessionalProfile


SERVICE_CATEGORY_CHOICES = (
    ("", "Non précisée"),
    ("relaxant", "Massage relaxant"),
    ("deep_tissue", "Deep tissue"),
    ("tantrique", "Tantrique"),
)

SERVICE_CATEGORY_KEYWORDS = {
    "relaxant": ("relaxant", "relaxation", "detente", "détente", "californien"),
    "deep_tissue": ("deep tissue", "deep-tissue", "musculaire", "sportif", "tissus profonds"),
    "tantrique": ("tantrique", "tantra"),
}


class MassageService(TimeStampedUUIDModel):
    professional = models.ForeignKey(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="services",
    )
    title = models.CharField("titre", max_length=160)
    short_description = models.CharField("description courte", max_length=255)
    full_description = models.TextField("description complète", blank=True)
    service_category = models.CharField(
        "catégorie principale",
        max_length=30,
        choices=SERVICE_CATEGORY_CHOICES,
        blank=True,
        default="",
    )
    duration_minutes = models.PositiveIntegerField("durée (minutes)")
    price_eur = models.DecimalField(
        "prix (€)",
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    is_active = models.BooleanField("actif", default=True)
    sort_order = models.PositiveIntegerField("ordre", default=0)

    class Meta:
        verbose_name = "service"
        verbose_name_plural = "services"
        ordering = ("sort_order", "duration_minutes", "title")

    def __str__(self) -> str:
        return f"{self.professional.business_name} — {self.title} ({self.duration_minutes} min)"
