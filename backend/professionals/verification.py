from django.utils import timezone

from .models import PractitionerVerification


def expire_outdated_verifications() -> int:
    return PractitionerVerification.objects.filter(
        status=PractitionerVerification.Status.VERIFIED,
        expires_at__isnull=False,
        expires_at__lte=timezone.now(),
    ).update(status=PractitionerVerification.Status.EXPIRED)
