# NUADYX — déployer sur Vercel + backend séparé

## 1. Frontend sur Vercel

Variables à définir
- `NEXT_PUBLIC_SITE_URL=https://votre-frontend.example.com`
- `NEXT_PUBLIC_API_URL=https://votre-backend.example.com/api`

Commande de build
```bash
cd frontend
npm run build
```

## 2. Backend séparé

Variables minimales
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG=false`
- `DJANGO_ALLOWED_HOSTS=votre-backend.example.com`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://votre-frontend.example.com`
- `DJANGO_CORS_ALLOWED_ORIGINS=https://votre-frontend.example.com`
- `FRONTEND_APP_URL=https://votre-frontend.example.com`
- `DATABASE_URL=postgres://...`
- `DJANGO_ENABLE_WHITENOISE=true`
- `DJANGO_DEFAULT_FROM_EMAIL`

SMTP si envoi réel
- `DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`
- `DJANGO_EMAIL_HOST`
- `DJANGO_EMAIL_PORT`
- `DJANGO_EMAIL_HOST_USER`
- `DJANGO_EMAIL_HOST_PASSWORD`
- `DJANGO_EMAIL_USE_TLS`

Stripe live
- `NUADYX_STRIPE_SECRET_KEY`
- `NUADYX_STRIPE_PUBLISHABLE_KEY`
- `NUADYX_STRIPE_WEBHOOK_SECRET`
- `NUADYX_STRIPE_INTERNAL_TEST_MODE=false`

Commandes minimales
```bash
backend/venv/bin/python backend/manage.py migrate
backend/venv/bin/python backend/manage.py check
```

## 3. Webhook Stripe

URL à déclarer
- `https://votre-backend.example.com/api/payments/webhooks/stripe/`

Événements à écouter
- `checkout.session.completed`
- `payment_intent.succeeded`
- `charge.succeeded`
- `charge.refunded`
- `refund.updated`
- `transfer.created`
- `account.updated`

## 4. Maintenance planifiée

Commande
```bash
backend/venv/bin/python backend/manage.py run_booking_maintenance
```

Fréquence recommandée
- sur Heroku Scheduler: toutes les 10 minutes

## 5. Point d'attention stockage média

Le code actuel stocke encore les fichiers envoyés par les praticiens dans le
filesystem local Django (`MEDIA_ROOT`). Sur Heroku, ce stockage n'est pas
durable entre redémarrages et déploiements.

Avant un vrai lancement public avec photos de profil/couverture actives,
prévoir un stockage externe objet compatible Django.

## 6. Smoke tests après mise en ligne

- ouvrir la landing
- créer un compte praticien
- terminer `/bienvenue`
- ouvrir un créneau
- faire une réservation publique
- vérifier le retour de règlement
- vérifier le webhook Stripe
- confirmer la réservation
- terminer la prestation
- valider côté client
- déposer un avis via lien
