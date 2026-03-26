# Imports & Annuaire NUADYX

Ce socle repose sur une règle simple : aucune source n'est importée tant qu'elle n'est pas inscrite dans `SourceRegistry`, approuvée et active.

## Créer une source

1. Ouvrir `/ops` avec un compte admin ou utiliser l'admin Django.
2. Créer une `SourceRegistry`.
3. Renseigner :
   - `name`
   - `source_type`
   - `legal_status=approved` uniquement après validation humaine
   - `requires_manual_review_before_publish`
   - `can_contact_imported_profiles`
   - `default_visibility_mode`

Fixture de départ :
```bash
./.venv/bin/python backend/manage.py loaddata backend/directory/fixtures/manual_csv_source.json
```

## Lancer un import CSV

Depuis `/ops` :
1. choisir la source `manual_csv`
2. charger un CSV
3. cocher `dry-run` pour une simulation
4. relancer sans `dry-run` pour écrire en base

Colonnes attendues par défaut :
- `external_id`
- `public_name`
- `business_name`
- `city`
- `postal_code`
- `region`
- `country`
- `phone_public`
- `email_public`
- `website_url`
- `instagram_url`
- `service_tags_json`
- `practice_modes_json`
- `bio_short`
- `address_public_text`

API utilisée :
`POST /api/admin/sources/:id/run-import`

## Revoir et publier

Les imports arrivent par défaut en `pending_review` ou `draft_imported`.

Actions disponibles :
- `approve_internal`
- `publish_unclaimed`
- `reject`
- `mark_removed`
- `send_claim_invite`
- `merge`

API :
`POST /api/admin/imported-profiles/bulk-action`

## Envoyer des invitations

Créer une campagne :
`POST /api/admin/contact-campaigns`

Envoyer :
`POST /api/admin/contact-campaigns/:id/send`

Règles :
- aucune campagne si la source n'est pas whitelistée
- aucun faux email de réservation ou faux lead
- seuls les templates honnêtes sont utilisés

## Pilotage ville par ville

Le cockpit `/ops` expose maintenant une section `Villes / Croissance`.

Le modèle central est `CityGrowthPlan` :
- `city_label`
- `city_slug`
- `department_code`
- `region`
- `objective_profiles_total`
- `objective_claimed_profiles`
- `objective_active_profiles`
- `priority_level`
- `growth_status`
- `notes_internal`
- `is_active`

Defaults backend :
- `NUADYX_CITY_OBJECTIVE_DEFAULT=10`
- `NUADYX_CITY_OBJECTIVE_CLAIMED_DEFAULT=4`
- `NUADYX_CITY_OBJECTIVE_ACTIVE_DEFAULT=3`

Statuts de croissance :
- `empty`
- `seed`
- `building`
- `healthy`
- `saturated`
- `deprioritized`

Lecture recommandée :
- `coverage_percent` = progression vers l’objectif profils total
- `claim_rate` = claims validés / contacts envoyés
- `suggestions_unprocessed_count` = backlog local à traiter
- `recommended_action` = synthèse courte affichée dans le cockpit

Définition actuelle des métriques ville :
- `total_profiles` = `claimed_profiles + unclaimed_profiles + profiles_in_review`
- `claimed_profiles` = profils praticiens revendiqués rattachés à la ville
- `unclaimed_profiles` = fiches importées publiées non revendiquées
- `active_profiles` = profils publics actuellement visibles
- `suggestions_count` = suggestions publiques reçues pour la ville, traitées ou non
- `suggestions_unprocessed_count` = suggestions encore non traitées
- `campaigns_count` = campagnes ciblant ou couvrant la ville
- `contacts_sent` = messages envoyés aux fiches importées de la ville
- `claims_opened` = claims ayant réellement démarré, y compris les claims approuvés
- `claims_validated` = claims approuvés

Ce qui est calculé à la volée :
- la couverture ville
- le funnel local
- les recommandations
- le rattachement des profils importés / suggestions / campagnes à une ville

Ce qui pourra nécessiter un cache ou une agrégation plus tard :
- `list_city_growth_rows()` sur gros volume
- `get_city_funnel()` si `/ops` interroge beaucoup de villes en parallèle
- les vues locales profils/suggestions/campagnes si le volume devient élevé

Champs géographiques praticiens :
- `ProfessionalProfile` porte maintenant `postal_code`, `department_code`, `region`
- ils sont hydratés à la revendication d’une fiche importée
- ils sont aussi complétés lors de l’édition du profil praticien quand la ville / code postal matche `LocationIndex`
- à finir côté produit : rendre ces champs plus visibles dans l’UI praticien si on veut une édition géographique explicite

Funnel local :
- suggestions reçues
- suggestions non traitées
- profils importés
- profils en review
- profils publiés non revendiqués
- invitations envoyées
- claims ouverts
- claims validés
- profils revendiqués
- profils publics actifs

Endpoints utiles :
- `GET /api/admin/acquisition/cities`
- `POST /api/admin/acquisition/cities`
- `GET /api/admin/acquisition/cities/:city_slug`
- `PATCH /api/admin/acquisition/cities/:city_slug`
- `GET /api/admin/acquisition/cities/:city_slug/funnel`
- `GET /api/admin/acquisition/cities/:city_slug/profiles`
- `GET /api/admin/acquisition/cities/:city_slug/suggestions`
- `GET /api/admin/acquisition/cities/:city_slug/campaigns`

Usage simple :
1. ajouter une ville au cockpit via le référentiel France
2. régler l’objectif local
3. lire la couverture et le funnel
4. traiter les suggestions locales
5. publier / revendiquer les fiches pertinentes
6. lancer une campagne ciblée ville si nécessaire

## Traiter une demande de suppression

Entrée publique :
`POST /api/public/removal-request`

Suivi ops :
`GET /api/admin/removal-requests`

Bon réflexe :
1. vérifier la fiche concernée
2. marquer la demande en `pending_review`
3. traiter
4. journaliser l'action via `AuditLog`

## Relancer ou surveiller un import

Jobs :
- `GET /api/admin/import-jobs`
- `GET /api/admin/import-jobs/:id`

Indicateurs utiles :
- `total_seen`
- `total_created`
- `total_updated`
- `total_skipped`
- `total_flagged`
- `error_log_text`

## Claim flow

1. la fiche importée est publiée ou reste privée selon la policy
2. un claim est demandé ou envoyé
3. le token est vérifié via `/api/public/claim/verify`
4. l'onboarding de revendication crée ou rattache un compte praticien
5. la fiche importée passe en `claimed`

## Garde-fous actuels

- pas de crawl global
- pas d'import sans source approuvée
- traçabilité par source, job, snapshot, opérateur et statut
- possibilité de retrait / opposition / revendication
- logs d'audit sur les actions ops critiques

## Limites restantes

- pas encore de worker Celery/Redis branché
- pas encore de dead-letter queue
- dashboard ops volontairement minimal
- approbation forte des campagnes encore simple
