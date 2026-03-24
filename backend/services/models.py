from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from common.models import TimeStampedUUIDModel
from professionals.models import ProfessionalProfile


class MassageService(TimeStampedUUIDModel):
    professional = models.ForeignKey(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="services",
    )
    title = models.CharField("titre", max_length=160)
    short_description = models.CharField("description courte", max_length=255)
    full_description = models.TextField("description complète", blank=True)
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