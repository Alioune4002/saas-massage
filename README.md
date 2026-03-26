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
  - landing praticiens sur `/`
  - entrée client dédiée sur `/trouver-un-praticien`
  - annuaire sur `/annuaire`
  - pages publiques praticiens
  - revendication de fiches importées
  - espace praticien
  - cockpit ops admin
  - pages admin modération / support / analytics

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
- Croissance locale : `NUADYX_CITY_OBJECTIVE_DEFAULT`, `NUADYX_CITY_OBJECTIVE_CLAIMED_DEFAULT`, `NUADYX_CITY_OBJECTIVE_ACTIVE_DEFAULT`
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
- socle de ranking interne pour la visibilité praticien

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
- modération V1 via incidents, registre de risque et restrictions de compte
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
- messages plateforme in-app
- annonces admin
- analytics admin transverses

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
- `/trouver-un-praticien`
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
- `/admin/moderation`
- `/admin/support`
- `/admin/analytics`

## Séparation praticiens / clients

La structure front est maintenant explicitement séparée :

- `/` = landing 100 % praticiens
  - visibilité
  - page publique type mini site vitrine
  - prestations / créneaux / demandes
  - assistant
  - gratuit pendant le lancement
- `/trouver-un-praticien` = porte d’entrée client
  - recherche locale
  - accès annuaire
  - favoris
  - suggestion de praticien
  - recommandation / attente dans une ville
- `/annuaire` = listing réel + SEO + browse

La vieille route `/praticiens` redirige désormais vers `/trouver-un-praticien`.

## Cockpit villes / acquisition

`/ops` pilote maintenant l’annuaire ville par ville.

Le cockpit repose sur :
- `LocationIndex` pour le référentiel France
- `CityGrowthPlan` pour les objectifs locaux configurables
- `ImportedProfile`, `PractitionerClaim`, `DirectoryInterestLead`, `ContactCampaign` et `ContactMessageLog` pour les métriques réelles

Ce que montre le cockpit :
- couverture par ville
- objectif local et progression
- statut de croissance
- priorité ops
- funnel d’acquisition local
- suggestions, profils importés et campagnes liés à la ville
- recommandations explicables

Endpoints ops principaux :
- `GET /api/admin/acquisition/cities`
- `POST /api/admin/acquisition/cities`
- `GET /api/admin/acquisition/cities/:city_slug`
- `PATCH /api/admin/acquisition/cities/:city_slug`
- `GET /api/admin/acquisition/cities/:city_slug/funnel`
- `GET /api/admin/acquisition/cities/:city_slug/profiles`
- `GET /api/admin/acquisition/cities/:city_slug/suggestions`
- `GET /api/admin/acquisition/cities/:city_slug/campaigns`

Règles actuelles :
- un plan ville ne crée jamais de faux praticiens
- les suggestions restent des pistes ops jusqu’à revue humaine
- les campagnes locales restent bornées par les sources whitelistées et les règles de contact
- les calculs sont centralisés côté backend dans `backend/directory/acquisition.py`

## Admin complète

La structure admin V1 est maintenant séparée en 4 zones :

- `/ops`
  - cockpit business / acquisition / annuaire / claims / imports / campagnes
- `/admin/moderation`
  - signalements de réservation
  - restrictions actives
  - registre de risque
  - décisions modérateur
- `/admin/support`
  - utilisateurs
  - messages in-app
  - annonces admin
- `/admin/analytics`
  - KPI disponibles réellement dans la base
  - ratios
  - villes qui performent

Endpoints admin ajoutés ou étendus :
- `GET /api/admin/moderation/overview`
- `GET /api/admin/moderation/incidents`
- `GET /api/admin/moderation/incidents/:id`
- `POST /api/admin/moderation/incidents/:id/decide`
- `GET /api/admin/moderation/restrictions`
- `GET /api/admin/moderation/risk-entries`
- `GET /api/admin/support/users`
- `GET/POST /api/admin/support/messages`
- `GET/POST /api/admin/support/announcements`
- `GET /api/admin/analytics/overview`

Support in-app utilisateur :
- `GET /api/me/platform-messages`
- `PATCH /api/me/platform-messages/:id`

## Visibilité praticien / ranking interne

NUADYX pose maintenant un socle explicable pour la mise en avant des praticiens.

Le calcul actuel vit dans :
- [`backend/professionals/ranking.py`](./backend/professionals/ranking.py)

Ce socle produit :
- `profile_completeness_score`
- `profile_visibility_score`
- `ranking_signals`

Les signaux pris en compte à ce stade :
- bio et accroche renseignées
- ville principale structurée
- photos
- services actifs
- créneaux ouverts
- spécialités
- contact public
- règles de réservation
- avis approuvés
- réservations et prestations réalisées
- badge vérifié
- activation de la réservation en ligne
- incidents ouverts ou en revue comme signal négatif

Le score n’est pas encore utilisé comme tri public principal.
Il sert déjà à :
- donner un retour lisible au praticien dans son espace profil public
- préparer les futures logiques de visibilité / mise en avant sans promesse trompeuse

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
