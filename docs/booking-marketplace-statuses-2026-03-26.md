# Tableau des statuts métier réservation / paiement / validation

Date : 26 mars 2026

## Réservation

Source principale : [`backend/bookings/models.py`](/Users/aliouneseck/massage-saas/backend/bookings/models.py)

### `Booking.status`

- `pending` : demande créée, en attente de traitement ou de confirmation
- `confirmed` : réservation confirmée
- `canceled` : réservation annulée

### `Booking.payment_status`

- `none_required` : aucun paiement demandé à la réservation
- `payment_required` : paiement requis mais pas encore lancé
- `deposit_required` : acompte attendu
- `payment_pending` : Checkout / paiement initié
- `payment_authorized` : autorisation enregistrée
- `payment_captured` : montant encaissé par la plateforme
- `partially_refunded` : remboursement partiel
- `refunded` : remboursement total
- `canceled` : paiement abandonné ou réservation annulée

### `Booking.payment_mode`

- `none` : pas de règlement à la réservation
- `deposit` : acompte
- `full` : paiement total

### `Booking.payment_collection_method`

- `none`
- `platform`
- `on_site`

### `Booking.payout_status`

- `not_applicable` : aucun versement plateforme à prévoir
- `payout_pending` : fonds capturés mais encore retenus
- `payout_ready` : versement autorisé
- `payout_released` : transfert envoyé
- `payout_blocked` : payout gelé

### `Booking.fulfillment_status`

- `scheduled`
- `client_arrived`
- `in_progress`
- `completed_by_practitioner`
- `completed_validated_by_client`
- `disputed`
- `auto_completed`

## Vérification email réservation invitée

### `GuestBookingIdentity.verification_status`

- `pending`
- `verified`
- `completed`
- `expired`
- `blocked`

### `BookingEmailVerification.status`

- `pending`
- `verified`
- `expired`
- `blocked`

## Incidents

### `IncidentReport.status`

- `open`
- `under_review`
- `resolved`
- `dismissed`

### `IncidentReport.severity`

- `low`
- `medium`
- `high`
- `critical`

## Registre interne de risque

### `RiskRegisterEntry.risk_level`

- `none`
- `low`
- `medium`
- `high`
- `blocked`

### `RiskRegisterEntry.booking_restriction_status`

- `none`
- `review_required`
- `restricted`
- `blocked`

### `RiskRegisterEntry.practitioner_trust_status`

- `good`
- `watch`
- `restricted`
- `suspended`

## Messagerie liée à la réservation

### `BookingMessage.sender_role`

- `client`
- `practitioner`
- `admin`
- `system`

### `BookingMessage.moderation_status`

- `visible`
- `flagged`
- `hidden`

## Séquence cible

### Sans paiement à la réservation

1. `GuestBookingIdentity.pending`
2. email vérifié
3. `Booking.status = pending`
4. `payment_status = none_required`
5. `fulfillment_status = scheduled`
6. prestation terminée
7. validation client ou auto-validation
8. pas de payout plateforme

### Avec acompte

1. `GuestBookingIdentity.pending`
2. email vérifié
3. `Booking.payment_status = payment_pending`
4. Stripe capture
5. `payment_status = payment_captured`
6. `payout_status = payout_pending`
7. prestation terminée
8. validation client ou auto-validation
9. `payout_status = payout_ready`
10. transfert
11. `payout_status = payout_released`

### Avec litige

1. prestation terminée
2. client signale un problème
3. `fulfillment_status = disputed`
4. `payout_status = payout_blocked`
5. incident enregistré
6. revue admin requise
