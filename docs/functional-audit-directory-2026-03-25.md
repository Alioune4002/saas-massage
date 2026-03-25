# Audit fonctionnel NUADYX — Annuaire / réservation / paiements

Date : 25 mars 2026

## Ce qui marche

- Inscription et connexion praticien
- Création de prestations avec plusieurs durées
- Création de créneaux et agenda praticien
- Page praticien publique revendiquée
- Réservation publique sur créneau ouvert
- Paiement plateforme avec acompte ou paiement total
- Paiement sur place / règlement enregistré manuellement
- Webhook Stripe avec déduplication d’événements
- Validation de prestation et blocage en cas de signalement
- Avis, invitations d’avis, modération, réponse praticien
- Assistant praticien avec garde-fous métiers
- Connexion Stripe Connect côté praticien
- Vue paiements / versements / compte de paiement

## Ce qui cassait ou restait inabouti avant cette passe

- Landing encore positionnée comme produit “premium / SaaS”
- Menu public avec “Tarification” et section cartes tarifaires visibles
- Pas de pages SEO locales dédiées ville / catégorie
- Pas de système de fiches revendicables traçables
- Pas de formulaires d’acquisition annuaire
- Pas de liste annuaire unifiée entre profils revendiqués et fiches candidates
- Pas de filtre catégorie exploitable côté services / annuaire

## Endpoints ou écrans restés partiellement branchés

- Le billing SaaS n’existe pas comme module autonome : l’écran utile est `Règlements`, centré sur les flux réservation/paiement/versement
- Les fiches candidates non revendiquées ne génèrent volontairement ni réservation ni demande client fictive
- Les emails de revendication existent, mais la validation finale d’une revendication reste un workflow back-office

## Erreurs frontend/backend détectées

- Wording trompeur ou trop abstrait sur la landing et certains écrans praticiens
- Catégories massage absentes des prestations, bloquant les pages SEO catégorie
- Pas d’URL publique dédiée pour revendiquer ou supprimer une fiche non revendiquée

## Correctifs appliqués

- Repositionnement marketing vers un annuaire gratuit pendant le lancement
- Suppression de la tarification produit visible sur la landing
- Ajout des pages SEO ville/catégorie
- Ajout d’un endpoint annuaire unifié :
  - `GET /api/directory/listings/`
- Ajout des endpoints claim profile :
  - `GET /api/directory/candidates/<slug>/`
  - `POST /api/directory/candidates/<slug>/claim/`
  - `POST /api/directory/candidates/<slug>/remove/`
- Ajout du endpoint d’acquisition :
  - `POST /api/directory/interests/`
- Ajout d’une catégorie de massage sur les prestations
- Ajout d’un email d’invitation honnête à revendiquer une fiche

## Conformité restante

- Rotation immédiate des secrets Stripe déjà exposés
- SMTP réel au lieu d’un backend console si encore actif
- Stockage média durable hors filesystem Heroku
- Compléter l’hébergeur front/back et le médiateur dans les textes légaux
- Définir la procédure opérationnelle de revue des revendications et suppressions
