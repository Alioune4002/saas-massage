# Audit Réservations / Paiements / Acomptes / Stripe Connect

Date : 2026-03-25

## Tableau des flux existants

| Flux | Point d'entrée | État actuel | Notes |
| --- | --- | --- | --- |
| Création de réservation publique | `POST /api/bookings/` | OK | crée `Booking`, calcule paiement, peut ouvrir Checkout |
| Paiement total à la réservation | `reservation_payment_mode=full` | OK | montant demandé maintenant = total |
| Acompte à la réservation | `reservation_payment_mode=deposit` | OK | montant demandé maintenant = acompte |
| Paiement sur place | `payment_collection_method=on_site` / enregistrement manuel | OK | supporté via `record_manual_payment` |
| Connexion Stripe Connect praticien | `POST /api/dashboard/payments/connect-account/` | OK | compte connecté + lien d'onboarding |
| Webhook Stripe | `POST /api/payments/webhooks/stripe/` | OK | signature vérifiée, déduplication via `PaymentWebhookEventLog` |
| Remboursement | workflow d'annulation + webhook `charge.refunded/refund.updated` | OK avec garde-fous | blocage de versement si remboursement |
| Versement praticien | maintenance + `transfer.created` | OK | payout marqué `ready` puis `released` |
| Validation de prestation | email client + `POST /api/bookings/:id/validate-service/` | OK | validation client ou signalement |

## Ce qui marche

- `Booking` porte les statuts métier utiles : `status`, `payment_status`, `payout_status`, `fulfillment_status`.
- `BookingPayment` persiste les mouvements de paiement, remboursement, versement et encaissement manuel.
- `ProfessionalPaymentConnectView` crée le compte Stripe Connect, génère un account link et gère aussi un mode test interne.
- `StripeWebhookView` :
  - refuse si le webhook n'est pas configuré
  - vérifie la signature
  - déduplique les événements avec `PaymentWebhookEventLog`
  - synchronise `checkout.session.completed`
  - synchronise `payment_intent.succeeded`
  - synchronise `charge.succeeded`
  - synchronise `charge.refunded` / `refund.updated`
  - synchronise `transfer.created`
  - synchronise `account.updated`
- Le workflow d'annulation applique la politique de remboursement et bloque le payout si nécessaire.
- `run_booking_maintenance` :
  - expire les demandes de paiement obsolètes
  - auto-valide certaines prestations
  - réconcilie/libère les versements
  - audite certaines anomalies

## Ce qui casse ou reste fragile

### 1. Les états UI peuvent diverger si le frontend perd une requête réseau ponctuelle

Le backend répond correctement sur plusieurs routes critiques, mais le frontend peut afficher un `Failed to fetch` si une requête front échoue avant le re-check `/health/`.

Correctif déjà appliqué :
- fallback et re-check backend dans `frontend/lib/api.ts`

Reste à surveiller :
- identifier la route exacte si un nouveau `Failed to fetch` réapparaît côté navigateur

### 2. `checkout.session.completed` utilise un `charge_id` de secours imparfait

Dans `backend/bookings/views.py`, lors de `checkout.session.completed`, le code utilise parfois `payment_intent` comme valeur de secours pour `charge_id`.

Impact :
- pas bloquant si un `payment_intent.succeeded` ou `charge.succeeded` arrive ensuite
- moins propre pour la traçabilité si Stripe n'envoie pas l'événement suivant

Priorité :
- moyenne

### 3. Pas encore de file asynchrone dédiée

Les imports annuaire et les campagnes email sont actuellement synchrones.

Impact :
- acceptable au lancement
- pas idéal pour forte volumétrie

### 4. Le dashboard ops/email n'a pas encore de télémétrie fournisseur avancée

`ContactMessageLog` journalise les envois, mais pas encore les callbacks `opened/clicked/bounced` depuis un provider email réel.

## Causes probables des incidents déjà vus

- API non encore stabilisée côté domaine custom au moment des premiers tests
- frontend qui marquait trop vite le backend comme indisponible
- configuration Stripe incomplète ou non live selon l'environnement

## Correctifs appliqués pendant cette passe

- nouveau socle `directory` sans faux leads ni faux signaux
- audit ops avec traçabilité `SourceRegistry`, `SourceImportJob`, `ImportedProfile`, `PractitionerClaim`, `RemovalRequest`, `ContactCampaign`, `ContactMessageLog`, `AuditLog`
- claim flow honnête
- publication non revendiquée contrôlée
- maintien des flux réservation/paiement existants

## TODO restant

### Priorité haute

- régénérer les secrets Stripe live déjà exposés
- brancher un vrai provider email avec retours de bounce/delivery
- ajouter un test automatisé de bout en bout sur :
  - réservation
  - checkout
  - webhook
  - remboursement
  - libération du payout

### Priorité moyenne

- affiner la traçabilité `charge_id` sur `checkout.session.completed`
- brancher Celery + Redis pour imports et campagnes
- ajouter une vue ops dédiée aux `PaymentWebhookEventLog`

### Priorité basse

- enrichir les métriques métier exportables
- ajouter une relance automatique limitée sur imports échoués
