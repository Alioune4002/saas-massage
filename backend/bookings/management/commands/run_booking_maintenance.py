from django.core.management.base import BaseCommand

from bookings.payments import (
    audit_and_optionally_fix_booking_anomalies,
    expire_stale_payment_holds,
    process_overdue_service_validations,
    process_releasable_payouts,
)


class Command(BaseCommand):
    help = "Exécute les tâches de maintenance réservation/règlement/versement."

    def add_arguments(self, parser):
        parser.add_argument("--expire-payments", action="store_true")
        parser.add_argument("--auto-validate-services", action="store_true")
        parser.add_argument("--release-payouts", action="store_true")
        parser.add_argument("--audit-anomalies", action="store_true")
        parser.add_argument("--fix-anomalies", action="store_true")

    def handle(self, *args, **options):
        selected = any(
            options[key]
            for key in (
                "expire_payments",
                "auto_validate_services",
                "release_payouts",
                "audit_anomalies",
            )
        )

        run_expire = options["expire_payments"] or not selected
        run_auto_validate = options["auto_validate_services"] or not selected
        run_release = options["release_payouts"] or not selected
        run_audit = options["audit_anomalies"] or not selected or options["fix_anomalies"]

        summary = []
        if run_expire:
            expired = expire_stale_payment_holds()
            summary.append(f"Paiements expirés : {expired}")

        if run_auto_validate:
            validated = process_overdue_service_validations()
            summary.append(f"Prestations auto-validées : {validated}")

        if run_release:
            released = process_releasable_payouts()
            summary.append(f"Versements rapprochés : {released}")

        if run_audit:
            anomalies = audit_and_optionally_fix_booking_anomalies(
                fix=options["fix_anomalies"]
            )
            summary.append(
                f"Anomalies détectées : {len(anomalies)}"
                + (" (correction automatique activée)" if options["fix_anomalies"] else "")
            )

        for line in summary:
            self.stdout.write(self.style.SUCCESS(line))
