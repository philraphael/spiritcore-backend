# Phase 1B Episode Persistence Fix Report

Date: 2026-04-24
Project: `C:\spiritcore-backend`

## Root cause

The live `episodes` table still carries a legacy `summary` column with a `NOT NULL` constraint.

Current backend code in `src/services/episodeService.mjs` had already migrated to writing:

- `content`
- `emotion_snapshot`

but it was no longer supplying `summary`.

That created a compatibility mismatch:

- current service expected the newer `content`-based schema
- live production still enforced legacy `summary NOT NULL`

Result:

- episode writes failed during `/v1/interact`
- the rest of the request still returned `200`, so this was a degraded persistence issue rather than a hard endpoint failure

## Fix applied

Applied the least risky production-safe fix in backend code:

- updated `src/services/episodeService.mjs`
- mirrored the same episode text into both:
  - `summary`
  - `content`

This keeps the newer service contract working while satisfying the legacy `summary NOT NULL` constraint without requiring another immediate schema change.

## Why this fix was chosen

This was safer than changing database constraints again because:

- it is additive at the payload level
- it preserves backward compatibility with the current table shape
- it does not depend on another manual migration step
- it does not change frontend, voice, wake, or orchestrator behavior

## Diagnostics rerun

Command:

```powershell
node scripts/endpoint-diagnostics.mjs
```

Result:

- `31/31` safe endpoint checks passed
- `/v1/interact` still returned successfully
- no `EpisodeService` `summary` `NOT NULL` failure appeared in the rerun logs

## Remaining warnings

The specific episode persistence warning is resolved.

Remaining non-episode warnings observed in the rerun:

- Node warning:
  - `spiritkins-app/data/spiritkinRuntimeConfig.js` is reparsed as ESM because `spiritkins-app/package.json` does not declare `"type": "module"`
- generator configuration warnings:
  - no Spiritkins image generation provider configured
  - no Spiritkins video generation provider configured

No remaining schema drift warnings for:

- `user_engagement`
- `memories.kind`
- `episodes.content`
- `emotion_state.arousal`

appeared during the final diagnostic run.

## Final Phase 1B status

Phase 1B backend persistence cleanup is now functionally clean on the verified local diagnostic path:

- safe endpoints pass `31/31`
- schema drift warnings are no longer showing in the diagnostic run
- episode persistence compatibility is restored
