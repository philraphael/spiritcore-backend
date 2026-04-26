# Command Center Media Alignment Contract

Date: 2026-04-26

The command center is an operator surface. It must display and operate the backend media pipeline; it must not become a second media generation implementation.

## Required backend authority usage

The command center must call these backend authorities:

- Source readiness: `/admin/media/spiritkin-source-reference-plan`, `/admin/media/source-reference-registry-plan`, `/admin/media/spiritkin-source-summary/:spiritkinId`
- Source still ingest: `/admin/media/source-still-ingest`
- Motion-pack planning: `/admin/media/motion-pack-plan`, `/admin/media/spiritkin-motion-pack-plan`
- Motion generation execution: `/admin/media/spiritkin-motion-state-execute`
- SpiritGate planning/execution: `/admin/media/spiritgate-*`
- Runway auth/status: `/admin/runway/auth-check`, `/admin/runway/status-check`
- Approved asset ingest: `/admin/media/asset-ingest`
- Sequence planning: `/admin/media/sequence-compose-plan`
- Promotion planning: `/admin/media/promotion-plan`
- Catalog: `/admin/media/catalog-summary` and a future unified media command-center catalog endpoint

## Command center should display

- Source still readiness by category.
- Motion-pack plan status and blocked states.
- Approved asset catalog and metadata.
- Review-required assets and failed provider jobs.
- Retry eligibility and known-bad source/prompt combinations.
- Sequence candidates and target duration.
- Premium generation readiness and blockers.
- Budget/credit status after server-side budget tracking exists.
- Provider error details in sanitized form only.

## Command center must not do

- Implement raw Runway payload construction.
- Store provider keys client-side.
- Build file names or APPROVED/ACTIVE paths independently.
- Promote ACTIVE directly.
- Update manifests directly.
- Bypass review approval.
- Use staging bypass headers in production.
- Use `/v1/admin/generator/*` for new media work unless a bridge decision explicitly routes through the authoritative media services.
- Duplicate source category rules, motion prompt modes, or sequence validation rules.

## Legacy generator bridge rule

The older generator job routes may provide useful UI/job concepts, but they are not the future media authority. If reused, they must be wrapped so job creation calls the new services:

1. `spiritCoreMediaProduction.mjs` for plans and validation.
2. `runwayProvider.mjs` for provider execution/status.
3. `sourceStillIngestService.mjs` for approved source stills.
4. `mediaAssetIngestService.mjs` for reviewed provider outputs.

No command-center feature should add a parallel provider stack or separate storage convention.

## Promotion rule

Command center may show promotion readiness. Actual ACTIVE writes and manifest updates require a future explicit promotion route with operator approval, rollback metadata, pack completeness checks, and diagnostics coverage.
