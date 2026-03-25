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
