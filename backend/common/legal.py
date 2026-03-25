from __future__ import annotations

from typing import Final


LEGAL_DOCUMENTS: Final[dict[str, dict[str, str]]] = {
    "mentions-legales": {
        "title": "Mentions légales",
        "version": "2026-03-25",
    },
    "cgu": {
        "title": "Conditions Générales d’Utilisation",
        "version": "2026-03-25",
    },
    "cgv": {
        "title": "Conditions Générales de Vente",
        "version": "2026-03-25",
    },
    "contrat-praticien": {
        "title": "Conditions spécifiques praticiens",
        "version": "2026-03-25",
    },
    "confidentialite": {
        "title": "Politique de confidentialité",
        "version": "2026-03-25",
    },
    "cookies": {
        "title": "Politique cookies",
        "version": "2026-03-25",
    },
    "politique-avis": {
        "title": "Politique des avis",
        "version": "2026-03-25",
    },
    "annulation-remboursement": {
        "title": "Politique d’annulation et de remboursement",
        "version": "2026-03-25",
    },
}

COOKIE_CONSENT_VERSION: Final[str] = "2026-03-25"


def get_legal_document_version(slug: str) -> str:
    document = LEGAL_DOCUMENTS.get(slug)
    if not document:
        raise KeyError(f"Document légal inconnu: {slug}")
    return document["version"]


def get_required_practitioner_registration_documents() -> tuple[str, ...]:
    return ("cgu", "cgv", "contrat-praticien", "confidentialite")
