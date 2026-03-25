import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import formats, timezone

logger = logging.getLogger(__name__)


def _format_appointment_window(start_at, end_at):
    localized_start = timezone.localtime(start_at)
    localized_end = timezone.localtime(end_at)
    day_label = formats.date_format(localized_start, "l j F")
    start_label = formats.date_format(localized_start, "H:i")
    end_label = formats.date_format(localized_end, "H:i")
    return f"{day_label} de {start_label} à {end_label}"


def _send_transactional_email(*, subject: str, message: str, recipients: list[str]):
    valid_recipients = [recipient for recipient in recipients if recipient]
    if not valid_recipients:
        return

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=valid_recipients,
            fail_silently=False,
        )
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
    subject = "Votre fiche praticien peut être activée sur NUADYX"
    message = (
        f"Bonjour {candidate.business_name},\n\n"
        "Une fiche praticien de base a été préparée sur NUADYX à partir d’informations publiques minimales "
        "ou d’une suggestion reçue. Elle n’indique aucune fausse réservation, aucun faux client et aucune demande fictive.\n\n"
        "Si vous êtes bien ce praticien, vous pouvez revendiquer cette fiche puis compléter vos photos, vos soins et vos disponibilités :\n"
        f"{activation_url}\n\n"
        "Si cette fiche ne vous concerne pas ou si vous souhaitez sa suppression, vous pourrez aussi le demander depuis cette page.\n\n"
        "À bientôt sur NUADYX."
    )
    _send_transactional_email(
        subject=subject,
        message=message,
        recipients=[candidate.public_email],
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
