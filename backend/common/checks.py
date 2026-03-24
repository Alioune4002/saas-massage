from django.conf import settings
from django.core.checks import Error, Tags, Warning, register


@register(Tags.security, Tags.compatibility)
def nuadyx_configuration_checks(app_configs, **kwargs):
    issues = []

    if getattr(settings, "TESTING", False):
        return issues

    if not settings.DEBUG and settings.SECRET_KEY == "django-insecure-change-me":
        issues.append(
            Error(
                "DJANGO_SECRET_KEY doit être remplacée en production.",
                id="nuadyx.E001",
            )
        )

    if settings.DEBUG:
        issues.append(
            Warning(
                "DEBUG est activé. Désactivez-le avant une mise en ligne publique.",
                id="nuadyx.W000",
            )
        )

    stripe_values = [
        bool(settings.NUADYX_STRIPE_SECRET_KEY),
        bool(settings.NUADYX_STRIPE_PUBLISHABLE_KEY),
        bool(settings.NUADYX_STRIPE_WEBHOOK_SECRET),
    ]
    if any(stripe_values) and not all(stripe_values):
        issues.append(
            Warning(
                "La configuration Stripe est partielle. Renseignez la clé secrète, la clé publique et le secret webhook ensemble.",
                id="nuadyx.W001",
            )
        )

    if settings.NUADYX_STRIPE_INTERNAL_TEST_MODE and not settings.DEBUG:
        issues.append(
            Warning(
                "Le mode de test Stripe interne est activé hors DEBUG. Désactivez-le pour un environnement public.",
                id="nuadyx.W002",
            )
        )

    if settings.EMAIL_BACKEND.endswith("smtp.EmailBackend") and not getattr(settings, "EMAIL_HOST", ""):
        issues.append(
            Warning(
                "EMAIL_HOST est vide alors que le backend email SMTP est activé.",
                id="nuadyx.W003",
            )
        )

    if not settings.FRONTEND_APP_URL.startswith(("http://", "https://")):
        issues.append(
            Error(
                "FRONTEND_APP_URL doit être une URL complète.",
                id="nuadyx.E002",
            )
        )

    if not settings.ALLOWED_HOSTS or settings.ALLOWED_HOSTS == ["127.0.0.1", "localhost"]:
        issues.append(
            Warning(
                "DJANGO_ALLOWED_HOSTS semble resté sur les valeurs locales par défaut.",
                id="nuadyx.W004",
            )
        )

    return issues
