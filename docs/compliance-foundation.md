# Socle conformité NUADYX

Ce document décrit le socle juridique et produit branché dans le code.

## Activations par feature flags

Backend:
- `NUADYX_FEATURE_COOKIE_CONSENT=true`
- `NUADYX_FEATURE_PRACTITIONER_VERIFICATION=true`
- `NUADYX_FEATURE_REVIEW_REPLIES=true`

Frontend:
- `NEXT_PUBLIC_FEATURE_COOKIE_CONSENT=true`
- `NEXT_PUBLIC_COOKIE_CONSENT_VERSION=2026-03-25`

## Pages légales branchées

- `/mentions-legales`
- `/cgu`
- `/cgv`
- `/contrat-praticien`
- `/confidentialite`
- `/cookies`
- `/politique-avis`
- `/annulation-remboursement`

Les contenus sont centralisés dans `frontend/content/legal-documents.tsx`.

## CMP et consentement cookies

- Bandeau avec `Tout accepter`, `Tout refuser`, `Enregistrer mes choix`
- Centre de préférences rouvrable via `Gérer mes cookies`
- Catégories: `necessary`, `analytics`, `advertising`, `support`
- Preuve locale stockée dans `localStorage`
- Preuve serveur stockée dans `common.CookieConsentRecord`

API utilisée:
- `GET /api/runtime-config/`
- `POST /api/consents/cookies/`

## Acceptations légales

Preuves stockées dans `common.LegalAcceptanceRecord`.

À l’inscription praticien, le frontend impose l’acceptation de:
- `cgu`
- `cgv`
- `contrat-praticien`
- `confidentialite`

Le backend journalise la version datée du document au moment de l’acceptation.

## Vérification praticien

Modèles:
- `professionals.PractitionerVerification`
- `professionals.PractitionerVerificationDecision`

Statuts:
- `not_started`
- `pending`
- `in_review`
- `verified`
- `rejected`
- `expired`

Fonctionnement:
- le praticien dépose ses pièces via `/payments`
- l’admin fait évoluer le statut via Django admin
- le badge public `Praticien vérifié` n’apparaît que si le statut est `verified` et non expiré
- la maintenance peut expirer automatiquement les vérifications arrivées à échéance

API utilisée:
- `GET/PATCH /api/dashboard/verification/`

Maintenance:
- `python backend/manage.py run_booking_maintenance --expire-verifications`

## Avis

Modèle:
- `reviews.Review`
- `reviews.ReviewModerationLog`

Statuts:
- `pending`
- `approved`
- `rejected`
- `hidden`

Règles branchées:
- un avis par réservation réelle si `booking` lié
- avis booking autorisé seulement après prestation terminée
- détection simple des liens, emails, numéros et répétitions par IP
- droit de réponse praticien
- journalisation des actions de modération

API utilisée:
- `GET /api/dashboard/reviews/`
- `POST /api/dashboard/reviews/{id}/flag/`
- `POST /api/dashboard/reviews/{id}/respond/`
- `POST /api/reviews/submit/`

## Reste à compléter avant une commercialisation large

- adhésion à un médiateur de la consommation et mise à jour de la CGV
- revue juridique formelle des textes
- éventuel choix d’un CMP tiers si des scripts marketing réels sont ajoutés
- rotation des secrets Stripe déjà exposés
- stockage média durable hors filesystem Heroku
