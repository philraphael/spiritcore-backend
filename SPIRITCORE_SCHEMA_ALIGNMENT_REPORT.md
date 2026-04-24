# SpiritCore Schema Alignment Report

Date: 2026-04-23
Project: `C:\spiritcore-backend`

## 1. Schema drift found

Code and live Supabase probes confirmed the backend is running against an older persistence shape than the current services expect.

### Confirmed missing table

- `public.user_engagement`

### Confirmed missing columns

- `public.memories.kind`
- `public.memories.meta`
- `public.episodes.content`
- `public.episodes.emotion_snapshot`
- `public.emotion_state.label`
- `public.emotion_state.valence`
- `public.emotion_state.arousal`
- `public.emotion_state.metadata_json`

### Current older shapes still present

- `memories` currently contains legacy columns such as `importance`, `tags`, and `resonance_score`.
- `episodes` currently stores `summary`, `emotion_json`, and `source_text`.
- `emotion_state` currently stores a single `state_json` blob plus `updated_at`.

That means the persistence layer did not disappear entirely. It drifted into a legacy shape while newer services were written against richer columns.

## 2. Migration applied/proposed

Created additive migration:

- [005_spiritcore_schema_alignment.sql](/C:/spiritcore-backend/005_spiritcore_schema_alignment.sql)

### What it does

- Creates `public.user_engagement` if missing.
- Adds `memories.kind` and `memories.meta` if missing.
- Adds `episodes.content` and `episodes.emotion_snapshot` if missing.
- Adds `emotion_state.label`, `emotion_state.valence`, `emotion_state.arousal`, and `emotion_state.metadata_json` if missing.
- Adds the unique indexes required by current `upsert(..., { onConflict: ... })` code:
  - `user_engagement (user_id, spiritkin_id)`
  - `emotion_state (user_id, spiritkin_id, conversation_id)`
- Backfills new columns from the older schema where possible:
  - `episodes.content <- COALESCE(summary, source_text)`
  - `episodes.emotion_snapshot <- emotion_json`
  - `emotion_state.label/valence/arousal <- state_json`
  - `emotion_state.metadata_json <- state_json` remainder
  - `memories.meta <- legacy importance/tags/resonance_score`

### Migration status

- Created in repo: yes
- Applied to Supabase from this shell: no

This session can verify the drift and prepare the SQL safely, but it does not have a direct SQL execution path to apply DDL against the remote Supabase database from within the repo workflow.

## 3. Services restored by the schema alignment

Once `005_spiritcore_schema_alignment.sql` is applied, the following current code paths should regain persistence instead of degrading:

- `src/services/engagementEngine.mjs`
  - restores `user_engagement` reads and writes
- `src/services/spiritCoreAdaptiveService.mjs`
  - restores engagement-backed return behavior and user-model context
- `src/services/structuredMemoryService.mjs`
  - restores structured memory reads/writes through `memories.kind` and `memories.meta`
- `src/services/episodeService.mjs`
  - restores episode writes and reads through `episodes.content` and `episodes.emotion_snapshot`
- `src/services/emotionService.mjs`
  - restores emotion-state reads/writes through `label`, `valence`, `arousal`, and `metadata_json`
- `src/services/contextService.mjs`
  - restores richer context assembly because emotion, episodes, and structured memory stop silently failing
- `src/services/orchestrator.mjs`
  - benefits indirectly because memory/emotion/episode persistence stop degrading in the background

## 4. Diagnostic rerun result

Reran:

```powershell
node scripts/endpoint-diagnostics.mjs
```

### Safe route result

- `31/31` safe endpoint checks still passed locally.

### Persistence warning result

The schema drift warnings remain present because the migration has been created but not yet executed against Supabase:

- `Could not find the table 'public.user_engagement' in the schema cache`
- `column memories.kind does not exist`
- `column episodes.content does not exist`
- `column emotion_state.label does not exist`
- subsequent runtime warnings from the same drift during `/v1/interact`

### Reduced warnings from prior audit fixes

Two non-schema backend issues remain fixed from the previous audit pass:

- invalid promise handling in `engagementEngine` no longer hides the true DB error
- session-control world writes no longer fail on null `world_state.spiritkin_id`

So the diagnostics are now clearer, even though the remote schema is still unaligned.

## 5. Remaining schema risks

- The migration assumes the existing tables are the intended legacy bases and backfills from them.
- If production has environment-specific drift beyond what was probed here, more columns could still be missing after this migration.
- `emotion_state` now expects a unique index on `(user_id, spiritkin_id, conversation_id)` for current upsert logic.
- `user_engagement` currently has no historical data because the table is absent; it will start fresh once created.
- Legacy `state_json`, `summary`, `emotion_json`, `source_text`, `importance`, `tags`, and `resonance_score` are preserved and not removed in this pass.

## 6. Next step

Apply `005_spiritcore_schema_alignment.sql` in Supabase, then rerun:

```powershell
node scripts/endpoint-diagnostics.mjs
```

The next backend phase should begin only after those persistence warnings are gone or reduced to clearly intentional compatibility noise.
