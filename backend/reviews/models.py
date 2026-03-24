import hashlib
import secrets

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from bookings.models import Booking
from common.models import TimeStampedUUIDModel
from professionals.models import ProfessionalProfile


class ReviewInvitation(TimeStampedUUIDModel):
    class Source(models.TextChoices):
        MANUAL = "manual", "Invitation manuelle"
        BOOKING = "booking", "Après réservation"
        LEGACY = "legacy", "Client historique"

    professional = models.ForeignKey(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="review_invitations",
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review_invitations",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review_invitations_created",
    )
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField()
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    usage_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "invitation d'avis"
        verbose_name_plural = "invitations d'avis"
        ordering = ("-created_at",)

    @staticmethod
    def issue_token() -> tuple[str, str]:
        token = secrets.token_urlsafe(32)
        return token, hashlib.sha256(token.encode()).hexdigest()

    def is_valid(self) -> bool:
        return not self.used_at and self.expires_at >= timezone.now()


class Review(TimeStampedUUIDModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        PUBLISHED = "published", "Publié"
        REJECTED = "rejected", "Refusé"
        FLAGGED = "flagged", "Signalé"

    class VerificationType(models.TextChoices):
        BOOKED_ON_PLATFORM = "booked_on_platform", "Réservation vérifiée"
        INVITED_BY_PRACTITIONER = "invited_by_practitioner", "Client invité"
        IMPORTED_LEGACY_CUSTOMER = "imported_legacy_customer", "Client historique"

    professional = models.ForeignKey(
        ProfessionalProfile,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviews",
    )
    invitation = models.OneToOneField(
        ReviewInvitation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review",
    )
    invited_customer_email = models.EmailField(blank=True)
    author_name = models.CharField(max_length=160)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PUBLISHED)
    verification_type = models.CharField(
        max_length=30,
        choices=VerificationType.choices,
        default=VerificationType.INVITED_BY_PRACTITIONER,
    )
    moderation_flags = models.JSONField(default=list, blank=True)
    flag_reason = models.CharField(max_length=220, blank=True)
    submitted_from_ip_hash = models.CharField(max_length=64, blank=True)
    submitted_from_user_agent_hash = models.CharField(max_length=64, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    flagged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "avis client"
        verbose_name_plural = "avis clients"
        ordering = ("-published_at", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("booking",),
                condition=Q(booking__isnull=False),
                name="unique_review_per_booking",
            )
        ]

    def save(self, *args, **kwargs):
        if self.status == self.Status.PUBLISHED and not self.published_at:
            self.published_at = timezone.now()
        if self.status == self.Status.FLAGGED and not self.flagged_at:
            self.flagged_at = timezone.now()
        return super().save(*args, **kwargs)
