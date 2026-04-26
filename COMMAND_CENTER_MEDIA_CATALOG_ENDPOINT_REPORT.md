# Command Center Media Catalog Endpoint Report

Date: 2026-04-26

## Route

`POST /admin/media/command-center-catalog`

## Purpose

This route provides the command center with a read-only media production catalog for one entity and pack. It aggregates source readiness, motion-pack status, limited approved asset discovery, failed/rejected policy notes, retry eligibility, sequence candidates, premium readiness, and recommended operator actions.

The route exists so command center UI work can consume backend authority instead of duplicating Runway payload logic, file/path naming, source category rules, retry policy, or promotion behavior.

## Response sections

- `entityId`, `packId`, `generatedAt`, `catalogMode`
- `sourceReadiness`
- `motionPackStatus`
- `approvedAssets`
- `approvedAssetDiscoveryMode`
- `failedOrRejectedJobs`
- `retryEligibility`
- `sequenceCandidates`
- `premiumReadiness`
- `commandCenterActions`
- safety flags:
  - `externalApiCall: false`
  - `noProviderCall: true`
  - `noGenerationPerformed: true`
  - `noIngestPerformed: true`
  - `noPromotionPerformed: true`
  - `noManifestUpdatePerformed: true`
  - `noActiveWritePerformed: true`
  - `premiumGenerationEnabled: false`

## How command center should use it

Command center should call this endpoint to render the media dashboard. It should show source still readiness, blocked motion states, retry eligibility, possible sequence candidates, known failure policy, premium blockers, and the next allowed operator actions.

Command center should not construct Runway payloads, infer source category rules, build storage paths, scan files directly, or promote assets directly.

## How it prevents duplicate media logic

The endpoint reuses `spiritCoreMediaProduction.mjs`, including:

- source reference planning
- source category mapping
- motion-pack metadata
- generation mode recommendations
- sequence candidate planning
- premium generation boundary

It does not use `spiritkinGeneratorService.mjs` or `/v1/admin/generator/*`.

## Current limitations

- Approved asset discovery is `limited_filesystem_metadata`; it reads available APPROVED metadata sidecars if present, but there is not yet a persistent approved asset registry.
- Failed job discovery is `not_persistent_yet`; known failed/rejected policy is returned, but provider job failures are not yet stored in a durable registry.
- Sequence candidates are derived from discovered approved metadata. If approved clips exist only in staging/Railway storage and not the local filesystem, the local catalog can still report candidates but may mark them partial or blocked.
- No budget tracker, queue, auto-review scorer, or ACTIVE promotion route exists yet.

## Next implementation steps

1. Add a persistent approved asset registry or index file for command-center catalog reads.
2. Add a failed-provider-job registry with source/prompt combination history.
3. Add identity-canon and safety preflight helpers before broad provider execution.
4. Add command center UI panels that call this route instead of legacy generator services.
5. Add explicit promotion route only after review scoring, rollback, pack completeness, and manifest update policy are locked.

## Validation

Validation commands for this phase:

- `npm test`
- `node scripts/endpoint-diagnostics.mjs`
- `node scripts/system-authority-diagnostics.mjs`

Executed validation:

- `npm test`: passed.
- `node scripts/endpoint-diagnostics.mjs`: passed with `176` passes, `0` skips, `0` failures.
- `node scripts/system-authority-diagnostics.mjs`: passed with `19` passes, `0` failures.

No Runway call, generation, ingest, promotion, manifest update, or ACTIVE write is performed by this endpoint.
