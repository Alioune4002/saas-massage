# NUADYX — runbook exploitation

## Variables d'environnement

Obligatoires en production
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG=false`
- `DJANGO_ALLOWED_HOSTS`
- `FRONTEND_APP_URL`
- `DATABASE_URL`
- `DJANGO_ENABLE_WHITENOISE=true`
- `DJANGO_DEFAULT_FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_URL`

Email SMTP si envoi réel
- `DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`
- `DJANGO_EMAIL_HOST`
- `DJANGO_EMAIL_PORT`
- `DJANGO_EMAIL_HOST_USER`
- `DJANGO_EMAIL_HOST_PASSWORD`
- `DJANGO_EMAIL_USE_TLS`

Stripe Connect live ou test Stripe
- `NUADYX_STRIPE_SECRET_KEY`
- `NUADYX_STRIPE_PUBLISHABLE_KEY`
- `NUADYX_STRIPE_WEBHOOK_SECRET`

Optionnelles
- `NUADYX_STRIPE_INTERNAL_TEST_MODE`
- `NUADYX_PLATFORM_FEE_RATE`
- `NUADYX_PAYMENT_HOLD_MINUTES`
- `NUADYX_AUTO_RELEASE_AFTER_HOURS`

## Déploiement frontend séparé

Frontend Vercel
- `NEXT_PUBLIC_SITE_URL=https://votre-frontend.example.com`
- `NEXT_PUBLIC_API_URL=https://votre-backend.example.com/api`

Backend Django
- `FRONTEND_APP_URL=https://votre-frontend.example.com`
- `DJANGO_CORS_ALLOWED_ORIGINS=https://votre-frontend.example.com`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://votre-frontend.example.com`
- `DJANGO_ALLOWED_HOSTS=votre-backend.example.com`

Règle pratique
- `NEXT_PUBLIC_API_URL` doit pointer vers le backend et se terminer logiquement par `/api`
- `FRONTEND_APP_URL` doit être l’URL publique du frontend sans suffixe `/api`

## Mode test vs mode live

Mode test interne
- `NUADYX_STRIPE_INTERNAL_TEST_MODE=true`
- aucune clé Stripe nécessaire
- réservé au développement
- un règlement n'est marqué capturé qu'après confirmation serveur sur la page de test

Mode Stripe
- renseigner les 3 variables Stripe
- configurer le webhook Stripe sur `POST /api/payments/webhooks/stripe/`
- écouter au minimum :
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `charge.succeeded`
  - `charge.refunded`
  - `refund.updated`
  - `transfer.created`
  - `account.updated`

## Commandes de maintenance

Tout lancer
```bash
backend/venv/bin/python backend/manage.py run_booking_maintenance
```

Expirer les paiements non finalisés
```bash
backend/venv/bin/python backend/manage.py run_booking_maintenance --expire-payments
```

Auto-valider les prestations après délai
```bash
backend/venv/bin/python backend/manage.py run_booking_maintenance --auto-validate-services
```

Préparer ou libérer les versements
```bash
backend/venv/bin/python backend/manage.py run_booking_maintenance --release-payouts
```

Auditer les anomalies
```bash
backend/venv/bin/python backend/manage.py run_booking_maintenance --audit-anomalies
```

Auditer et corriger les anomalies simples
```bash
backend/venv/bin/python backend/manage.py run_booking_maintenance --audit-anomalies --fix-anomalies
```

## Planification recommandée

Exemple cron toutes les 15 minutes
```bash
*/15 * * * * cd /chemin/nuadyx && backend/venv/bin/python backend/manage.py run_booking_maintenance >> /var/log/nuadyx-maintenance.log 2>&1
```

Rythme conseillé
- expiration des paiements: toutes les 5 à 15 minutes
- auto-validation et libération des versements: toutes les 15 minutes
- audit d'anomalies: toutes les heures

Exemple systemd timer
```ini
# /etc/systemd/system/nuadyx-maintenance.service
[Unit]
Description=NUADYX maintenance bookings/payments

[Service]
Type=oneshot
WorkingDirectory=/chemin/nuadyx
ExecStart=/chemin/nuadyx/backend/venv/bin/python /chemin/nuadyx/backend/manage.py run_booking_maintenance
```

```ini
# /etc/systemd/system/nuadyx-maintenance.timer
[Unit]
Description=Run NUADYX maintenance every 15 minutes

[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
```

Exemple job plateforme/cloud
- Render / Railway / Fly machine cron:
  - commande: `backend/venv/bin/python backend/manage.py run_booking_maintenance`
  - fréquence: `*/15 * * * *`

Particularité Heroku Scheduler
- fréquence minimale disponible: toutes les 10 minutes
- recommandation Heroku pour NUADYX: toutes les 10 minutes

## Vérifications d'exploitation

Paiement bien capturé
- Admin `réservations`
- vérifier `payment_status = payment_captured`
- vérifier `payment_captured_at`
- vérifier `provider_payment_intent_id` ou `provider_charge_id`

Versement bloqué
- vérifier `payout_status = payout_blocked`
- lire `payout_blocked_reason`
- lire les `événements de réservation`

Signalement ou litige
- vérifier `fulfillment_status = disputed`
- lire `issue_reason`
- vérifier que le versement est bloqué

Remboursement manuel à reprendre
- si une annulation a été enregistrée mais que Stripe n'a pas confirmé le remboursement,
  l'interface ne doit pas annoncer "remboursé"
- reprendre la situation côté Stripe puis vérifier `provider_refund_id`

## Support pratique

Quand un client dit "j'ai payé"
- regarder la réservation
- si statut `payment_pending` ou `payment_authorized`, le montant n'est pas encore capturé
- vérifier le journal webhook paiement

Quand un praticien dit "je n'ai pas reçu mon versement"
- vérifier `payment_status`
- vérifier `fulfillment_status`
- vérifier `payout_status`
- si `payout_blocked`, lire la raison
- si `payout_ready`, relancer la maintenance versement

Quand un avis pose problème
- aller dans `Avis clients`
- signaler l'avis ou le traiter dans l'admin
- vérifier l'invitation liée, son usage et sa date d'expiration
