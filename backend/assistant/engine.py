import re
import unicodedata

from django.db.models import QuerySet
from django.utils import timezone

from bookings.models import AvailabilitySlot
from professionals.models import ProfessionalProfile
from services.models import MassageService

from .models import ProfessionalAssistantProfile


DEFAULT_STARTER_QUESTIONS = [
    "Quels sont vos tarifs ?",
    "Comment réserver ?",
    "Quelle prestation choisir ?",
    "Avez-vous un créneau bientôt ?",
]

MEDICAL_GUARDRAIL_TERMS = {
    "grossesse",
    "enceinte",
    "fievre",
    "fièvre",
    "blessure",
    "operation",
    "opération",
    "douleur",
    "douleurs",
    "pathologie",
    "maladie",
    "traitement",
    "cancer",
    "infection",
    "fracture",
    "entorse",
    "medicament",
    "médicament",
    "medecin",
    "médecin",
    "urgence",
}

THERAPEUTIC_PROMISE_TERMS = {
    "soigne",
    "guerit",
    "guérit",
    "therapeutique",
    "thérapeutique",
    "traiter",
    "guérir",
}


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.lower())
    return "".join(char for char in normalized if not unicodedata.combining(char))


def split_terms(value: str) -> list[str]:
    return [part.strip() for part in re.split(r"[\n,;]+", value) if part.strip()]


def get_public_assistant_starter_questions(
    assistant: ProfessionalAssistantProfile,
) -> list[str]:
    custom_questions = [
        item["question"]
        for item in assistant.faq_items
        if isinstance(item, dict) and item.get("question")
    ]
    return (custom_questions + DEFAULT_STARTER_QUESTIONS)[:4]


def get_public_services(professional: ProfessionalProfile) -> QuerySet[MassageService]:
    return professional.services.filter(is_active=True).order_by(
        "sort_order",
        "duration_minutes",
        "title",
    )


def get_public_slots(professional: ProfessionalProfile) -> QuerySet[AvailabilitySlot]:
    return (
        AvailabilitySlot.objects.select_related("service")
        .filter(
            professional=professional,
            is_active=True,
            bookings__isnull=True,
            start_at__gte=timezone.now(),
        )
        .order_by("start_at")
    )


def get_tone_intro(tone: str) -> str:
    return {
        "chaleureux": "Bonjour, voici ce qui peut vous aider.",
        "apaisant": "Avec plaisir, voici l’essentiel à savoir.",
        "professionnel": "Voici une réponse claire et directe.",
        "premium": "Voici une réponse soignée pour vous guider sereinement.",
        "sobre": "Voici les informations utiles.",
        "rassurant": "Bien sûr, voici les informations utiles.",
    }.get(tone, "Voici les informations utiles.")


def format_slot(slot: AvailabilitySlot) -> str:
    return timezone.localtime(slot.start_at).strftime("%A %d %B à %Hh%M")


def build_guardrail_answer(
    professional: ProfessionalProfile,
    assistant: ProfessionalAssistantProfile,
) -> str:
    business_name = professional.business_name
    city = professional.city or "votre ville"
    base_message = (
        f"Je préfère rester prudent sur ce point. Pour une situation liée à une douleur importante, "
        f"une grossesse, une fièvre, une blessure, un traitement ou une pathologie, le mieux est de "
        f"contacter directement {business_name} à {city} pour vérifier si une séance est adaptée, "
        f"et de demander un avis médical si nécessaire. L’assistant ne remplace pas un professionnel de santé."
    )
    if assistant.guardrails.strip():
        return f"{base_message} {assistant.guardrails.strip()}"
    return base_message


def matches_guardrail(question: str) -> bool:
    normalized = normalize_text(question)
    if any(term in normalized for term in MEDICAL_GUARDRAIL_TERMS):
        return True
    return any(term in normalized for term in THERAPEUTIC_PROMISE_TERMS)


def find_faq_answer(assistant: ProfessionalAssistantProfile, question: str) -> str:
    normalized_question = normalize_text(question)
    question_tokens = {token for token in re.findall(r"[a-z0-9]{4,}", normalized_question)}

    for item in assistant.faq_items:
        if not isinstance(item, dict):
            continue

        faq_question = str(item.get("question", "")).strip()
        faq_answer = str(item.get("answer", "")).strip()
        if not faq_question or not faq_answer:
            continue

        normalized_faq = normalize_text(faq_question)
        faq_tokens = {token for token in re.findall(r"[a-z0-9]{4,}", normalized_faq)}
        if normalized_faq in normalized_question or normalized_question in normalized_faq:
            return faq_answer
        if faq_tokens and len(question_tokens & faq_tokens) >= min(2, len(faq_tokens)):
            return faq_answer

    return ""


def build_services_answer(
    professional: ProfessionalProfile,
    services: list[MassageService],
) -> str:
    if not services:
        return (
            f"{professional.business_name} n’a pas encore détaillé ses prestations en ligne. "
            "Le mieux est de revenir un peu plus tard ou de prendre contact directement."
        )

    lines = [
        f"{service.title} : {service.duration_minutes} min, {service.price_eur} €"
        for service in services[:4]
    ]
    return "Voici quelques prestations proposées : " + " ; ".join(lines) + "."


def build_booking_answer(
    professional: ProfessionalProfile,
    slots: list[AvailabilitySlot],
) -> str:
    if professional.accepts_online_booking:
        if slots:
            next_slots = ", ".join(format_slot(slot) for slot in slots[:3])
            return (
                "Vous pouvez réserver directement depuis cette page en choisissant une prestation puis un créneau. "
                f"Les prochains créneaux visibles sont : {next_slots}."
            )

        return (
            "La réservation en ligne est bien ouverte. Pour le moment, aucun créneau n’est affiché, "
            "mais vous pouvez revenir plus tard ou contacter directement le praticien."
        )

    return (
        "La réservation en ligne n’est pas ouverte pour le moment. "
        "Le plus simple est de contacter directement le praticien pour convenir d’un rendez-vous."
    )


def build_location_answer(
    professional: ProfessionalProfile,
    assistant: ProfessionalAssistantProfile,
) -> str:
    details = []
    if professional.city:
        details.append(f"{professional.business_name} reçoit à {professional.city}.")
    if assistant.practice_information.strip():
        details.append(assistant.practice_information.strip())
    if assistant.contact_information.strip():
        details.append(assistant.contact_information.strip())
    if details:
        return " ".join(details)
    return "Les informations pratiques seront précisées directement par le praticien."


def build_session_answer(
    professional: ProfessionalProfile,
    assistant: ProfessionalAssistantProfile,
) -> str:
    parts = [
        assistant.activity_overview.strip(),
        professional.public_headline.strip(),
        professional.bio.strip(),
        assistant.support_style.strip(),
        assistant.service_information.strip(),
    ]
    content = " ".join(part for part in parts if part)
    if content:
        return content
    if professional.specialties:
        specialties = ", ".join(professional.specialties[:4])
        return (
            f"{professional.business_name} propose un accompagnement centré notamment sur {specialties}, "
            "avec une approche attentive et adaptée au besoin du moment."
        )
    return (
        f"{professional.business_name} propose des séances adaptées au besoin du moment, "
        "dans un cadre pensé pour être clair, rassurant et confortable."
    )


def build_before_after_answer(
    assistant: ProfessionalAssistantProfile,
    before: bool,
) -> str:
    value = assistant.before_session if before else assistant.after_session
    if value.strip():
        return value.strip()
    if before:
        return (
            "Le mieux est de venir dans une tenue confortable, d’arriver quelques minutes en avance "
            "et de signaler au praticien toute information importante avant la séance."
        )
    return (
        "Après la séance, il est généralement conseillé de prendre un moment calme, de bien s’hydrater "
        "et d’écouter ses sensations."
    )


def build_service_match_answer(
    professional: ProfessionalProfile,
    services: list[MassageService],
    question: str,
) -> str:
    normalized_question = normalize_text(question)
    tokens = {
        token for token in re.findall(r"[a-z0-9]{4,}", normalized_question)
        if token not in {"faire", "faites", "vous", "avec", "quel", "quelle", "pour", "type"}
    }

    matches = []
    for service in services:
        haystack = normalize_text(
            f"{service.title} {service.short_description} {service.full_description}"
        )
        if any(token in haystack for token in tokens):
            matches.append(service)

    if matches:
        lines = [
            f"{service.title} ({service.duration_minutes} min, {service.price_eur} €)"
            for service in matches[:3]
        ]
        return "Oui, voici ce qui peut correspondre : " + ", ".join(lines) + "."

    if professional.specialties:
        specialties = ", ".join(professional.specialties[:4])
        return (
            f"Le praticien met notamment en avant : {specialties}. "
            "Si vous hésitez entre plusieurs approches, le mieux est de préciser votre besoin avant de réserver."
        )

    return ""


def build_out_of_scope_answer(
    professional: ProfessionalProfile,
    assistant: ProfessionalAssistantProfile,
) -> str:
    contact_hint = assistant.contact_information.strip()
    if contact_hint:
        return (
            "Je préfère rester prudent et ne pas vous répondre de façon approximative sur ce point. "
            f"Le mieux est de contacter directement {professional.business_name}. {contact_hint}"
        )
    return (
        f"Je préfère rester prudent et ne pas inventer de réponse. "
        f"Le mieux est de contacter directement {professional.business_name} pour cette question."
    )


def question_matches_avoid_topics(
    assistant: ProfessionalAssistantProfile,
    question: str,
) -> bool:
    normalized_question = normalize_text(question)
    custom_terms = [normalize_text(item) for item in split_terms(assistant.avoid_topics)]
    return any(term and term in normalized_question for term in custom_terms)


def generate_assistant_answer(
    *,
    professional: ProfessionalProfile,
    assistant: ProfessionalAssistantProfile,
    question: str,
    public_mode: bool,
) -> dict:
    services = list(get_public_services(professional))
    slots = list(get_public_slots(professional)) if professional.accepts_online_booking else []
    normalized_question = normalize_text(question)

    if matches_guardrail(normalized_question) or question_matches_avoid_topics(assistant, question):
        answer = build_guardrail_answer(professional, assistant)
        return {"answer": f"{get_tone_intro(assistant.response_tone)} {answer}", "cautious": True}

    faq_answer = find_faq_answer(assistant, question)
    if faq_answer:
        return {"answer": f"{get_tone_intro(assistant.response_tone)} {faq_answer}", "cautious": False}

    if any(word in normalized_question for word in ("tarif", "prix", "combien", "cout", "coût")):
        answer = build_services_answer(professional, services)
    elif any(word in normalized_question for word in ("reserver", "réserver", "rdv", "rendez", "prendre rendez", "booking")):
        answer = build_booking_answer(professional, slots)
    elif any(word in normalized_question for word in ("disponible", "disponibilite", "disponibilité", "creneau", "créneau", "horaire")):
        answer = build_booking_answer(professional, slots)
    elif any(word in normalized_question for word in ("ou", "où", "situe", "situé", "adresse", "ville", "cabinet", "studio", "spa")):
        answer = build_location_answer(professional, assistant)
    elif any(word in normalized_question for word in ("comment se passe", "deroule", "déroule", "seance", "séance", "premiere", "première")):
        answer = build_session_answer(professional, assistant)
    elif any(word in normalized_question for word in ("avant", "prevoir", "prévoir", "preparer", "préparer")):
        answer = build_before_after_answer(assistant, before=True)
    elif any(word in normalized_question for word in ("apres", "après", "suite", "recuperation", "récupération")):
        answer = build_before_after_answer(assistant, before=False)
    elif any(word in normalized_question for word in ("massage", "prestation", "soin", "drainage", "relaxant", "deep", "tissue")):
        answer = build_service_match_answer(professional, services, question) or build_services_answer(
            professional,
            services,
        )
    else:
        answer = ""

    if not answer.strip():
        answer = build_out_of_scope_answer(professional, assistant)
        return {"answer": f"{get_tone_intro(assistant.response_tone)} {answer}", "cautious": True}

    extra_parts = [
        assistant.general_guidance.strip(),
        assistant.business_rules.strip(),
        assistant.assistant_notes.strip(),
    ]
    extra_hint = " ".join(part for part in extra_parts if part)
    if extra_hint and len(answer) < 420:
        answer = f"{answer} {extra_hint}"

    if public_mode and not professional.accepts_online_booking and "réservation en ligne" in answer.lower():
        answer = answer.replace(
            "La réservation en ligne est bien ouverte.",
            "La réservation en ligne n’est pas ouverte pour le moment.",
        )

    return {
        "answer": f"{get_tone_intro(assistant.response_tone)} {answer}",
        "cautious": False,
    }
