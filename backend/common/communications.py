import logging
import re
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import formats, timezone

logger = logging.getLogger(__name__)


def _format_appointment_window(start_at, end_at):
    localized_start = timezone.localtime(start_at)
    localized_end = timezone.localtime(end_at)
    day_label = formats.date_format(localized_start, "l j F")
    start_label = formats.date_format(localized_start, "H:i")
    end_label = formats.date_format(localized_end, "H:i")
    return f"{day_label} de {start_label} à {end_label}"


def _get_public_site_url() -> str:
    frontend_url = (getattr(settings, "FRONTEND_APP_URL", "") or "").strip()
    if frontend_url:
        return frontend_url.rstrip("/")
    return "https://www.nuadyx.com"


def _linkify_text(value: str) -> str:
    escaped = escape(value)
    url_pattern = re.compile(r"(https?://[^\s<]+)")
    return url_pattern.sub(
        lambda match: (
            f'<a href="{match.group(1)}" '
            'style="color:#2457ff;text-decoration:none;font-weight:600;">'
            f"{match.group(1)}</a>"
        ),
        escaped,
    )


def _render_email_html(*, subject: str, message: str) -> str:
    blocks = []
    for paragraph in [part.strip() for part in message.split("\n\n") if part.strip()]:
        lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
        bullet_lines = [line[2:].strip() for line in lines if line.startswith("- ")]
        plain_lines = [line for line in lines if not line.startswith("- ")]

        if plain_lines:
            blocks.append(
                "<p style=\"margin:0 0 16px;color:#445066;font-size:15px;line-height:1.7;\">"
                + "<br />".join(_linkify_text(line) for line in plain_lines)
                + "</p>"
            )

        if bullet_lines:
            blocks.append(
                "<ul style=\"margin:0 0 16px 18px;padding:0;color:#445066;font-size:15px;line-height:1.7;\">"
                + "".join(
                    f"<li style=\"margin:0 0 8px;\">{_linkify_text(line)}</li>"
                    for line in bullet_lines
                )
                + "</ul>"
            )

    site_url = _get_public_site_url()
    return f"""
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#132033;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dde5f0;">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#eff5ff 0%,#f9fcff 100%);border-bottom:1px solid #dde5f0;">
                <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#2457ff;font-weight:700;">NUADYX</div>
                <div style="margin-top:10px;font-size:28px;line-height:1.2;font-weight:700;color:#132033;">{escape(subject)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                {''.join(blocks)}
                <div style="margin-top:28px;padding:18px 20px;border-radius:18px;background:#f7f9fc;border:1px solid #e4ebf3;">
                  <p style="margin:0;color:#5a6475;font-size:13px;line-height:1.7;">
                    Cet email a été envoyé par NUADYX pour le suivi de votre activité, de vos réservations ou de votre compte.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;background:#132033;">
                <p style="margin:0 0 8px;color:#ffffff;font-size:14px;font-weight:700;">NUADYX</p>
                <p style="margin:0 0 6px;color:#d4dceb;font-size:13px;line-height:1.6;">
                  L’annuaire des praticiens du massage et du bien-être.
                </p>
                <p style="margin:0 0 6px;color:#d4dceb;font-size:13px;line-height:1.6;">
                  <a href="{site_url}" style="color:#ffffff;text-decoration:none;">{site_url}</a>
                </p>
                <p style="margin:0;color:#d4dceb;font-size:13px;line-height:1.6;">
                  Support : <a href="mailto:support@nuadyx.com" style="color:#ffffff;text-decoration:none;">support@nuadyx.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()


def _send_transactional_email(*, subject: str, message: str, recipients: list[str]):
    valid_recipients = [recipient for recipient in recipients if recipient]
    if not valid_recipients:
        return

    try:
        email = EmailMultiAlternatives(
            subject=subject,
            body=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=valid_recipients,
        )
        email.attach_alternative(
            _render_email_html(subject=subject, message=message),
            "text/html",
        )
        email.send(fail_silently=False)
    except Exception:
        logger.exception("Impossible d'envoyer l'email transactionnel %s.", subject)


def send_practitioner_welcome_email(profile):
    user = profile.user
    subject = "Bienvenue dans NUADYX"
    message = (
        f"Bonjour {profile.business_name},\n\n"
        "Votre espace praticien est prêt.\n"
        "Il ne vous reste plus qu'à présenter vos soins, ouvrir vos créneaux "
        "et découvrir votre page comme un client.\n\n"
        "Prochaines étapes conseillées :\n"
        "- présenter au moins un soin\n"
        "- ouvrir un premier créneau\n"
        "- vérifier votre page publique\n\n"
        "À bientôt sur NUADYX."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[user.email],
    )


def send_new_booking_request_email(booking):
    schedule = _format_appointment_window(
        booking.slot.start_at,
        booking.slot.end_at,
    )
    subject = f"Nouvelle demande de rendez-vous — {booking.client_first_name} {booking.client_last_name}"
    message = (
        f"Bonjour {booking.professional.business_name},\n\n"
        "Une nouvelle demande de rendez-vous vient d'arriver dans votre espace praticien.\n\n"
        f"Prestation : {booking.service.title}\n"
        f"Créneau : {schedule}\n"
        f"Client : {booking.client_first_name} {booking.client_last_name}\n"
        f"Email : {booking.client_email}\n"
        f"Téléphone : {booking.client_phone or 'Non renseigné'}\n\n"
        f"Note client : {booking.client_note or 'Aucune note transmise'}\n\n"
        f"Statut du règlement : {booking.get_payment_status_display()}\n"
        f"Montant demandé maintenant : {booking.amount_due_now_eur} €\n"
        f"Reste éventuel : {booking.amount_remaining_eur} €\n\n"
        "Vous pouvez maintenant confirmer la séance ou l'annuler depuis vos réservations clients."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[booking.professional.user.email],
    )


def send_booking_confirmed_email(booking):
    schedule = _format_appointment_window(
        booking.slot.start_at,
        booking.slot.end_at,
    )
    subject = f"Votre rendez-vous avec {booking.professional.business_name} est confirmé"
    message = (
        f"Bonjour {booking.client_first_name},\n\n"
        "Votre demande de rendez-vous a bien été confirmée.\n\n"
        f"Prestation : {booking.service.title}\n"
        f"Horaire : {schedule}\n"
        f"Praticien : {booking.professional.business_name}\n\n"
        f"Statut du règlement : {booking.get_payment_status_display()}\n"
        f"Montant sécurisé à ce stade : {booking.amount_received_eur} €\n"
        f"Reste éventuel à régler sur place : {booking.amount_remaining_eur} €\n\n"
        "Si vous avez une question avant la séance, vous pouvez répondre à cet email "
        "ou contacter directement le praticien si ses coordonnées sont affichées sur sa page."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[booking.client_email],
    )


def send_booking_canceled_email(booking):
    schedule = _format_appointment_window(
        booking.slot.start_at,
        booking.slot.end_at,
    )
    subject = f"Votre rendez-vous avec {booking.professional.business_name} a été annulé"
    payment_lines = (
        f"Statut du règlement : {booking.get_payment_status_display()}\n"
        f"Montant remboursé : {booking.amount_refunded_eur} €\n"
    )
    if booking.amount_received_eur > 0 and booking.amount_refunded_eur == 0:
        payment_lines = (
            "Statut du règlement : le remboursement ou le déblocage du règlement doit encore être confirmé.\n"
            f"Montant actuellement sécurisé : {booking.amount_received_eur} €\n"
        )

    message = (
        f"Bonjour {booking.client_first_name},\n\n"
        "Le rendez-vous demandé a été annulé.\n\n"
        f"Prestation : {booking.service.title}\n"
        f"Horaire concerné : {schedule}\n"
        f"Praticien : {booking.professional.business_name}\n\n"
        f"{payment_lines}\n"
        "Si besoin, vous pouvez revenir sur la page publique du praticien pour choisir un autre créneau "
        "ou reprendre contact avec lui directement."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[booking.client_email],
    )


def send_booking_requested_email_to_client(booking):
    schedule = _format_appointment_window(
        booking.slot.start_at,
        booking.slot.end_at,
    )
    subject = f"Votre demande a bien été transmise à {booking.professional.business_name}"
    message = (
        f"Bonjour {booking.client_first_name},\n\n"
        "Votre demande de rendez-vous a bien été transmise.\n\n"
        f"Prestation : {booking.service.title}\n"
        f"Créneau demandé : {schedule}\n"
        f"Praticien : {booking.professional.business_name}\n\n"
        f"Statut du règlement : {booking.get_payment_status_display()}\n"
        f"Montant à sécuriser maintenant : {booking.amount_due_now_eur} €\n"
        f"Reste éventuel à régler ensuite : {booking.amount_remaining_eur} €\n\n"
        "Le praticien pourra maintenant confirmer votre demande ou revenir vers vous si un ajustement est nécessaire."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[booking.client_email],
    )


def send_booking_email_verification_code(guest_identity, verification, *, code: str):
    subject = f"Vérifiez votre email pour finaliser votre réservation avec {guest_identity.professional.business_name}"
    message = (
        f"Bonjour {guest_identity.client_first_name},\n\n"
        "Nous avons bien reçu votre demande de réservation sur NUADYX.\n"
        "Avant de transmettre définitivement votre demande, merci de vérifier votre adresse email.\n\n"
        f"Code de vérification : {code}\n"
        f"Ce code expire le {formats.date_format(timezone.localtime(verification.expires_at), 'j F Y à H:i')}.\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, vous pouvez simplement ignorer cet email.\n"
        "Aucun rendez-vous ne sera confirmé tant que l'email n'aura pas été vérifié."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[guest_identity.client_email],
    )


def send_booking_payment_action_required_email(booking, checkout_url: str):
    subject = f"Finalisez votre règlement pour sécuriser votre créneau avec {booking.professional.business_name}"
    message = (
        f"Bonjour {booking.client_first_name},\n\n"
        "Votre demande est bien enregistrée, mais le règlement demandé doit encore être finalisé pour sécuriser ce créneau.\n\n"
        f"Prestation : {booking.service.title}\n"
        f"Montant à régler maintenant : {booking.amount_due_now_eur} €\n"
        f"Reste éventuel à régler ensuite : {booking.amount_remaining_eur} €\n\n"
        f"Finaliser mon règlement : {checkout_url}\n\n"
        "Tant que cette étape n'est pas confirmée par le prestataire de paiement, aucun montant n'est considéré comme encaissé."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[booking.client_email],
    )


def send_booking_payment_captured_email(booking):
    schedule = _format_appointment_window(
        booking.slot.start_at,
        booking.slot.end_at,
    )
    subject = f"Votre règlement est bien sécurisé pour votre rendez-vous avec {booking.professional.business_name}"
    message = (
        f"Bonjour {booking.client_first_name},\n\n"
        "Votre règlement a bien été sécurisé sur NUADYX.\n\n"
        f"Prestation : {booking.service.title}\n"
        f"Créneau : {schedule}\n"
        f"Montant sécurisé : {booking.amount_received_eur} €\n"
        f"Reste éventuel à régler sur place : {booking.amount_remaining_eur} €\n\n"
        "Le versement au praticien n'est libéré qu'après le déroulement de la séance et la validation prévue."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[booking.client_email],
    )


def send_client_service_validation_email(booking, validation_url: str):
    subject = f"Confirmez le bon déroulement de votre séance avec {booking.professional.business_name}"
    message = (
        f"Bonjour {booking.client_first_name},\n\n"
        "Votre praticien a indiqué que votre séance était terminée.\n"
        "Merci de confirmer en un instant que tout s'est bien déroulé.\n\n"
        f"Lien de validation : {validation_url}\n\n"
        "Si vous rencontrez un problème, ne validez pas la prestation et reprenez contact avec le praticien."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[booking.client_email],
    )


def send_review_invitation_email(invitation, review_url: str):
    subject = f"Partagez votre avis après votre séance avec {invitation.professional.business_name}"
    message = (
        f"Bonjour {invitation.first_name},\n\n"
        "Si vous le souhaitez, vous pouvez partager votre ressenti après votre séance.\n\n"
        f"Laisser un avis : {review_url}\n\n"
        "Ce lien est personnel et valable pendant 14 jours."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[invitation.email],
    )


def send_claim_profile_invitation_email(candidate, activation_url: str):
    recipient_email = getattr(candidate, "public_email", "") or getattr(candidate, "email_public", "")
    source_label = getattr(candidate, "source_label", "") or getattr(getattr(candidate, "source", None), "name", "")
    subject = "Votre fiche praticien peut être activée sur NUADYX"
    message = (
        f"Bonjour {candidate.business_name},\n\n"
        "Une fiche praticien de base a été préparée sur NUADYX à partir d’informations publiques minimales "
        "ou d’une suggestion reçue. Elle n’indique aucune fausse réservation, aucun faux client et aucune demande fictive.\n\n"
        f"Origine indiquée : {source_label or 'source autorisée par NUADYX'}.\n\n"
        "Si vous êtes bien ce praticien, vous pouvez revendiquer cette fiche puis compléter vos photos, vos soins et vos disponibilités :\n"
        f"{activation_url}\n\n"
        "Si cette fiche ne vous concerne pas ou si vous souhaitez sa suppression, vous pourrez aussi le demander depuis cette page.\n\n"
        "À bientôt sur NUADYX."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[recipient_email],
    )


def send_directory_incomplete_profile_nudge_email(*, imported_profile, target_email: str, completion_url: str):
    subject = "Complétez votre fiche NUADYX"
    message = (
        f"Bonjour {imported_profile.public_name},\n\n"
        "Votre fiche praticien peut encore être enrichie sur NUADYX.\n"
        "Vous pouvez ajouter vos photos, vos soins, vos disponibilités et vérifier votre lien public.\n\n"
        f"Compléter ma fiche : {completion_url}\n\n"
        "Cet email ne signifie pas qu’une réservation ou une demande client vous attend déjà."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[target_email],
    )


def send_directory_removal_confirmation_email(removal_request):
    subject = "Votre demande de suppression a bien été prise en compte"
    message = (
        f"Bonjour {removal_request.requester_name or 'bonjour'},\n\n"
        "Votre demande de suppression ou d’opposition concernant une fiche praticien NUADYX a bien été enregistrée.\n"
        "Elle sera traitée par notre équipe dans les meilleurs délais.\n\n"
        "Si vous avez besoin de compléter votre demande, vous pouvez répondre à cet email ou écrire à support@nuadyx.com."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[removal_request.requester_email],
    )
