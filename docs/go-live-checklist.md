# NUADYX — checklist mise en production

## Avant déploiement
- renseigner toutes les variables de [`.env.example`](/Users/aliouneseck/massage-saas/backend/.env.example)
- renseigner aussi les variables de [`frontend/.env.example`](/Users/aliouneseck/massage-saas/frontend/.env.example)
- mettre `DJANGO_DEBUG=false`
- remplacer `DJANGO_SECRET_KEY`
- configurer `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_CORS_ALLOWED_ORIGINS`
- configurer `DATABASE_URL`
- activer `DJANGO_ENABLE_WHITENOISE=true` si le backend sert ses statiques sur Heroku
- configurer `NEXT_PUBLIC_SITE_URL` et `NEXT_PUBLIC_API_URL`
- configurer SMTP réel
- renseigner les 3 variables Stripe live:
  - `NUADYX_STRIPE_SECRET_KEY`
  - `NUADYX_STRIPE_PUBLISHABLE_KEY`
  - `NUADYX_STRIPE_WEBHOOK_SECRET`
- mettre `NUADYX_STRIPE_INTERNAL_TEST_MODE=false`

## Stripe live
- créer ou vérifier le compte plateforme Stripe
- configurer le webhook Stripe sur `POST /api/payments/webhooks/stripe/`
- écouter:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `charge.succeeded`
  - `charge.refunded`
  - `refund.updated`
  - `transfer.created`
  - `account.updated`
- vérifier qu’un praticien peut connecter son compte Stripe Connect en test live

## Déploiement backend
- lancer:
```bash
backend/venv/bin/python backend/manage.py migrate
backend/venv/bin/python backend/manage.py check
backend/venv/bin/python backend/manage.py run_booking_maintenance --audit-anomalies
```

## Déploiement frontend
- lancer:
```bash
cd frontend
npm run lint
npm run build
```
- vérifier que `NEXT_PUBLIC_API_URL` pointe bien vers `/api` du backend déployé
- vérifier que `NEXT_PUBLIC_SITE_URL` correspond à l’URL publique Vercel

## Scheduler / maintenance
- planifier `run_booking_maintenance` toutes les 15 minutes
- vérifier qu’un log d’exécution est bien conservé
- fréquence recommandée:
  - paiements expirés: 5 à 15 min
  - auto-validation / versements: 15 min
  - audit anomalies: 1 h

## Smoke tests post-déploiement
- créer un compte praticien
- terminer `/bienvenue`
- publier la page praticien
- ouvrir un créneau
- faire une réservation publique
- vérifier l’email de demande
- lancer un règlement Stripe test/live selon l’environnement
- vérifier le webhook et le passage en `payment_captured`
- confirmer la réservation côté praticien
- terminer la prestation
- valider côté client
- vérifier le statut du versement
- déposer un avis via lien d’invitation

## Vérifications support
- dans l’admin, retrouver:
  - la réservation
  - le journal webhook
  - les événements de réservation
  - l’invitation d’avis
  - l’avis publié ou signalé

## Rollback minimal
- revenir à la release précédente applicative
- ne pas supprimer les données de réservation/paiement
- relancer `run_booking_maintenance --audit-anomalies`
- vérifier les webhooks Stripe reçus pendant l’incident
