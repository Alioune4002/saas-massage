# Checklist avant mise en production marketplace

Date : 26 mars 2026

## Déjà en place

- réservation invitée avec vérification email obligatoire
- acompte / paiement total / paiement sur place
- Stripe Connect Express
- charge plateforme + transfert différé
- blocage payout sur incident grave
- validation client / auto-validation de prestation
- incident report et registre interne de risque
- messagerie minimale liée à une réservation
- tests backend bookings

## À vérifier impérativement en environnement live

- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `refund.updated`
- `transfer.created`
- `transfer.failed`
- `account.updated`

## À faire avant lancement réel

- brancher un vrai SMTP de production ;
- régénérer les secrets Stripe exposés précédemment ;
- tester un vrai onboarding Connect complet ;
- tester un vrai acompte puis un vrai transfert différé ;
- tester un remboursement total et partiel ;
- mettre en place une revue admin explicite des litiges ;
- mettre en place une surveillance cron/worker pour auto-validation et release payout ;
- sortir les médias du filesystem Heroku ;
- documenter la politique de conservation du registre interne de risque ;
- vérifier que les textes UI et emails finaux correspondent à la politique commerciale décidée.

## Améliorations recommandées court terme

- UI client sécurisée pour consulter le fil de messages sans compte ;
- UI praticien plus complète sur incidents et payout bloqué ;
- dashboard ops spécifique pour litiges et remboursements ;
- tâches asynchrones Celery/Redis pour emails, payouts et maintenance ;
- monitoring métriques Stripe / bookings / dispute rate ;
- limitations anti-abus supplémentaires par IP / email / téléphone sur création de demandes.
