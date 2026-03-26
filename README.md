# NUADYX

NUADYX est une application web pour les praticiens du massage et du bien-être.

Le projet combine :
- un frontend `Next.js` hébergé sur Vercel
- un backend `Django + DRF` hébergé sur Heroku
- Stripe pour les paiements, acomptes et Connect
- un annuaire public avec profils revendicables
- un espace praticien pour l’onboarding, les services, les disponibilités, les réservations, les paiements, l’assistant et les avis

## Architecture

### Frontend
- dossier : [`frontend`](./frontend)
- stack : `Next.js 16`, `React 19`, `TypeScript`
- rôle :
  - landing page
  - pages publiques praticiens
  - annuaire
  - revendication de fiches importées
  - espace praticien
  - dashboard ops admin

### Backend
- dossier : [`backend`](./backend)
- stack : `Django 6`, `Django REST Framework`
- rôle :
  - API métier
  - authentification par token
  - onboarding praticien
  - services
  - disponibilités et réservations
  - paiements Stripe / Connect / webhooks
  - assistant public
  - avis
  - conformité légale et consentements
  - annuaire importable et fiches revendicables

### Déploiement
- frontend : Vercel sur `https://www.nuadyx.com`
- backend : Heroku sur `https://api.nuadyx.com`

Fichiers de déploiement :
- [`Procfile`](./Procfile)
- [`requirements.txt`](./requirements.txt)
- [`docs/deployer-vercel-backend-separe.md`](./docs/deployer-vercel-backend-separe.md)

## Installation locale

### Backend
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp backend/.env.example backend/.env
./.venv/bin/python backend/manage.py migrate
./.venv/bin/python backend/manage.py runserver
```

API locale :
- `http://127.0.0.1:8000/`
- healthcheck : `http://127.0.0.1:8000/health/`

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend local :
- `http://localhost:3000`

## Variables d’environnement

### Frontend
Voir [`frontend/.env.example`](./frontend/.env.example)

Variables principales :
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_FEATURE_COOKIE_CONSENT`
- `NEXT_PUBLIC_COOKIE_CONSENT_VERSION`

### Backend
Voir [`backend/.env.example`](./backend/.env.example)

Variables principales :
- Django : `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`
- CORS / CSRF : `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS`
- DB : `DATABASE_URL`
- Email : `DJANGO_EMAIL_*`, `DJANGO_DEFAULT_FROM_EMAIL`
- Frontend callback : `FRONTEND_APP_URL`
- Stripe : `NUADYX_STRIPE_SECRET_KEY`, `NUADYX_STRIPE_PUBLISHABLE_KEY`, `NUADYX_STRIPE_WEBHOOK_SECRET`
- Marketplace : `NUADYX_DEFAULT_DEPOSIT_PERCENTAGE`, `NUADYX_MIN_DEPOSIT_PERCENTAGE`, `NUADYX_MAX_DEPOSIT_PERCENTAGE`, `NUADYX_UNVERIFIED_PRACTITIONER_MAX_DEPOSIT_PERCENTAGE`
- Booking sécurité : `NUADYX_BOOKING_EMAIL_VERIFICATION_MINUTES`, `NUADYX_BOOKING_EMAIL_MAX_RESENDS`, `NUADYX_BOOKING_EMAIL_MAX_ATTEMPTS`, `NUADYX_GUEST_BOOKING_HOLD_MINUTES`
- Annulation / validation : `NUADYX_FULL_REFUND_NOTICE_HOURS`, `NUADYX_PARTIAL_REFUND_NOTICE_HOURS`, `NUADYX_PARTIAL_REFUND_RATE`, `NUADYX_AUTO_RELEASE_AFTER_HOURS`, `NUADYX_INCIDENT_REPORT_WINDOW_HOURS`
- Feature flags : `NUADYX_FEATURE_COOKIE_CONSENT`, `NUADYX_FEATURE_PRACTITIONER_VERIFICATION`, `NUADYX_FEATURE_REVIEW_REPLIES`

## Modules backend

### `accounts`
- utilisateurs et rôles
- inscription praticien
- login / token / session API

### `professionals`
- profil praticien principal
- dashboard praticien
- profil public revendiqué
- compatibilité avec les anciens endpoints annuaire
- vérification praticien
- référentiel FR de localisation pour villes, codes postaux, départements et régions

### `services`
- prestations proposées
- catégories de massage
- CRUD praticien + listing public

### `bookings`
- disponibilités
- réservations
- statuts métier
- réservation invitée avec vérification email obligatoire
- note client au praticien
- paiements, acomptes, paiement sur place
- Stripe Connect
- payout différé et retenu côté plateforme
- validation de prestation et auto-validation
- incidents, no-show, registre de risque interne
- messagerie minimale liée à la réservation
- webhook Stripe

### `assistant`
- assistant métier public
- réponses cadrées
- configuration praticien

### `reviews`
- invitations d’avis
- dépôt d’avis
- réponses praticien
- modération

### `common`
- consentements cookies
- acceptations légales
- runtime config
- email transactionnel
- permissions transverses

### `directory`
- registre des sources autorisées
- jobs d’import
- profils importés
- revue admin
- publication non revendiquée
- revendication par claim token
- demandes de suppression
- campagnes de contact tracées
- audit log

## Routes API principales

Entrée principale backend :
- [`backend/config/urls.py`](./backend/config/urls.py)

Racines utiles :
- `/health/`
- `/api/auth/*`
- `/api/dashboard/*`
- `/api/assistant/*`
- `/api/reviews/*`
- `/api/public/*`
- `/api/admin/*`

## Routes frontend principales

### Public
- `/`
- `/annuaire`
- `/annuaire/[ville]`
- `/praticiens/[slug]`
- `/[slug]`
- `/revendiquer`
- `/revendiquer/[token]`
- `/demander-suppression/[slugOrId]`

### Espace praticien
- `/inscription`
- `/login`
- `/bienvenue`
- `/dashboard`
- `/services`
- `/availabilities`
- `/bookings`
- `/payments`
- `/assistant`
- `/reviews`
- `/profil-public`

### Admin / ops
- `/ops`

## Qualité et vérifications

Commandes utiles :
```bash
./.venv/bin/python backend/manage.py check
./.venv/bin/python backend/manage.py test directory professionals services bookings accounts reviews common
cd frontend && npm run lint
cd frontend && npm run build
```

## Référentiel FR de localisation

NUADYX embarque un référentiel France exploitable pour l’annuaire et l’auto-suggest live :
- villes
- codes postaux
- départements
- régions
- pays

Le dataset source local est :
- [`backend/professionals/data/fr_locations.csv`](./backend/professionals/data/fr_locations.csv)

Le modèle utilisé est :
- [`backend/professionals/models.py`](./backend/professionals/models.py) via `LocationIndex`

La commande de chargement est :
```bash
./.venv/bin/python backend/manage.py load_fr_location_index --replace
```

Cette commande :
- recharge complètement `LocationIndex`
- crée des slugs ville stables
- gère les homonymes de communes avec suffixe départemental si nécessaire
- alimente l’auto-suggest utilisé par l’annuaire et la landing

Filtres annuaire supportés côté API :
- `city`
- `location_type`
- `location_slug`

Exemples :
- `/annuaire/quimper`
- `/annuaire?location_type=department&location_slug=finistere-29`
- `/annuaire?location_type=region&location_slug=bretagne`
- `/annuaire?location_type=postal_code&location_slug=29000`

## Règles métier v1

Réglage NUADYX v1 actuellement codé :
- client invité autorisé
- email vérifié obligatoire avant création réelle de la réservation
- acompte par défaut recommandé : `30 %`
- praticien non vérifié : acompte en ligne limité à `20 %`
- praticien vérifié : acompte jusqu’à `50 %`
- paiement total à la réservation : réservé aux praticiens vérifiés
- paiement online encaissé par la plateforme puis payout différé
- validation client après la séance, sinon auto-validation à `24 h`
- annulation client : remboursement total à `>48 h`, remboursement partiel entre `48 h` et `24 h`, acompte conservé à `<24 h`
- annulation praticien : remboursement intégral
- litige : payout bloqué
- messagerie privée : 1 fil par réservation

## Documentation interne

- [`docs/deployer-vercel-backend-separe.md`](./docs/deployer-vercel-backend-separe.md)
- [`docs/go-live-checklist.md`](./docs/go-live-checklist.md)
- [`docs/ops-runbook.md`](./docs/ops-runbook.md)
- [`docs/directory-ops-readme.md`](./docs/directory-ops-readme.md)
- [`docs/payment-booking-audit-2026-03-25.md`](./docs/payment-booking-audit-2026-03-25.md)
- [`docs/stripe-billing-audit-2026-03-26.md`](./docs/stripe-billing-audit-2026-03-26.md)
- [`docs/booking-marketplace-statuses-2026-03-26.md`](./docs/booking-marketplace-statuses-2026-03-26.md)
- [`docs/marketplace-production-checklist-2026-03-26.md`](./docs/marketplace-production-checklist-2026-03-26.md)
- [`docs/compliance-foundation.md`](./docs/compliance-foundation.md)

## État actuel du projet

Le projet couvre déjà :
- acquisition praticiens
- annuaire et fiches revendicables
- onboarding praticien
- page publique
- services et disponibilités
- réservations
- paiements Stripe
- avis
- assistant
- conformité légale minimale

Les sujets à valider en environnement live restent généralement :
- Stripe live complet
- SMTP réel
- stockage média durable
- industrialisation éventuelle des imports / campagnes par workers
