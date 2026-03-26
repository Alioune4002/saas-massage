# Audit Stripe / Billing / Marketplace

Date : 26 mars 2026

## 1. Architecture actuelle

NUADYX n'utilise pas des `destination charges` ni un encaissement direct sur le compte connecté du praticien.

Le code actuel s'appuie sur :

- un `Checkout Session` Stripe créé sur le compte plateforme dans [`backend/bookings/payments/stripe_connect.py`](/Users/aliouneseck/massage-saas/backend/bookings/payments/stripe_connect.py)
- un `PaymentIntent` rattaché au compte plateforme via `payment_intent_data`
- un transfert séparé et différé vers le praticien via `POST /v1/transfers`

En pratique, le modèle en place est donc :

1. le client paie la plateforme ;
2. la réservation conserve l'état métier local ;
3. le versement praticien n'est déclenché qu'ensuite ;
4. la plateforme garde la main sur le remboursement et le blocage.

Ce choix est compatible avec :

- acompte,
- payout différé,
- blocage du versement,
- remboursement partiel ou total,
- revue manuelle en cas de litige.

## 2. Ce qui existait déjà avant cette passe

Avant la consolidation du 26 mars, le code gérait déjà :

- `payment_status`, `payout_status`, `fulfillment_status` sur [`backend/bookings/models.py`](/Users/aliouneseck/massage-saas/backend/bookings/models.py)
- la logique de calcul acompte / total / sur place dans [`backend/bookings/payments/workflow.py`](/Users/aliouneseck/massage-saas/backend/bookings/payments/workflow.py)
- les webhooks Stripe principaux dans [`backend/bookings/views.py`](/Users/aliouneseck/massage-saas/backend/bookings/views.py)
- la création de compte Connect Express et l'onboarding dans [`backend/bookings/payments/stripe_connect.py`](/Users/aliouneseck/massage-saas/backend/bookings/payments/stripe_connect.py)

## 3. Correctifs et renforcements appliqués

Cette passe ajoute ou renforce :

- réservation invitée avec vérification email obligatoire avant création réelle de la réservation ;
- blocage du paiement en ligne si le praticien n'est pas réellement prêt pour Connect ;
- politique d'acompte bornée par la plateforme ;
- incidents / signalements persistés ;
- registre de risque interne non public ;
- fil de messagerie minimal par réservation ;
- prise en compte de `payment_intent.payment_failed` ;
- prise en compte de `transfer.failed` avec blocage du payout ;
- gel automatique du payout sur signalement grave ou no-show ;
- fallback vers paiement sur place si le praticien n'est pas éligible à l'encaissement plateforme.

## 4. Webhooks Stripe vérifiés dans le code

Traités actuellement dans [`backend/bookings/views.py`](/Users/aliouneseck/massage-saas/backend/bookings/views.py) :

- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.succeeded`
- `charge.refunded`
- `refund.updated`
- `transfer.created`
- `transfer.failed`
- `account.updated`

## 5. Capacité réelle par cas d'usage

### Acompte

Oui.

- calcul métier localisé dans [`backend/bookings/payments/workflow.py`](/Users/aliouneseck/massage-saas/backend/bookings/payments/workflow.py)
- borne plateforme via `NUADYX_MAX_DEPOSIT_PERCENTAGE`
- défaut plateforme via `NUADYX_DEFAULT_DEPOSIT_PERCENTAGE`
- override praticien limité par validation dans [`backend/professionals/models.py`](/Users/aliouneseck/massage-saas/backend/professionals/models.py)

### Payout différé

Oui.

- le versement praticien n'est pas envoyé au moment du paiement client ;
- il passe par `payout_pending` puis `payout_ready` puis `payout_released` ;
- le déclenchement reste contrôlé par le workflow de validation de prestation.

### Remboursement

Oui, côté plateforme.

- remboursement Stripe via `create_refund(...)` dans [`backend/bookings/payments/stripe_connect.py`](/Users/aliouneseck/massage-saas/backend/bookings/payments/stripe_connect.py)
- moteur de politique d'annulation dans [`backend/bookings/payments/workflow.py`](/Users/aliouneseck/massage-saas/backend/bookings/payments/workflow.py)
- traces locales dans `Booking`, `BookingPayment` et `BookingEventLog`

### Litige / contestation

Partiellement oui, avec base sérieuse.

- blocage payout : oui
- signalement persistant : oui
- registre de risque interne : oui
- décision admin structurée complète : pas encore totalement finalisée
- interface admin spécialisée litiges : pas encore faite

### Reverse / retenue / blocage

Le blocage est en place.

- `payout_blocked_reason`
- `PAYOUT_BLOCKED`
- incidents et risque

Le reverse avancé après transfert effectif n'est pas encore industrialisé.

## 6. Points dangereux identifiés

- si Stripe Connect n'est pas complètement onboardé, le praticien ne doit pas pouvoir encaisser en ligne ;
- les remboursements admin avancés et la résolution de litige restent encore largement pilotés par les workflows backend, pas par une UI ops dédiée ;
- le payout réellement déclenché dépend encore d'une exécution workflow / maintenance, pas d'une orchestration asynchrone type Celery ;
- il manque encore une validation live complète sur environnement Stripe réel avec vrais webhooks de bout en bout.

## 7. Décision d'architecture recommandée

Conserver le modèle actuel :

- charge sur le compte plateforme
- transfert différé explicite
- pas de `destination charges`

C'est le meilleur compromis ici pour :

- garder le contrôle sur l'acompte,
- geler les fonds si prestation contestée,
- rembourser proprement,
- éviter un versement trop rapide au praticien.

## 8. TODO avant production réelle

- tester en environnement Stripe réel :
  - acompte,
  - paiement total,
  - paiement échoué,
  - remboursement,
  - transfert différé,
  - `account.updated`,
  - `transfer.failed`
- ajouter un écran admin de résolution litige / remboursement partiel ;
- ajouter une tâche planifiée fiable pour passage automatique `payout_pending -> payout_ready -> payout_released` ;
- instrumenter plus finement les événements Stripe pour réconciliation ops ;
- décider si certains remboursements doivent être purement automatiques ou toujours soumis à revue humaine.
