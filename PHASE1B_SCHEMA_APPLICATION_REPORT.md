# Phase 1B Schema Application Report

Date: 2026-04-24
Project: `C:\spiritcore-backend`

## Migration applied

- Status: partially applied, not fully effective against the currently running backend service contract.
- Method used: manual Supabase migration plus manual cleanup of duplicate `emotion_state` rows, followed by successful creation of the unique `emotion_state` index.

## Diagnostics run

Command:

```powershell
node scripts/endpoint-diagnostics.mjs
```

Result:

- `31/31` safe endpoint checks passed.
- Verified routes:
  - `/health`
  - `/ready`
  - `/v0/health`
  - `/app`
  - `/app/app.js`
  - `/app/data/spiritverseCanon.js`
  - `/app/assets/concepts/Solis.png`
  - `/app/game-theme-assets/Checkers/boards/checkers_board_premium_placeholder.svg`
  - `/app/spiritkin-videos/README.md`
  - `/portraits/lyra_portrait.png`
  - `/videos/lyra_intro.mp4`
  - `/v1/spiritkins`
  - `/v1/spiritkins/Lyra`
  - `/v1/spiritcore/welcome`
  - `/v1/veil-crossing/questions`
  - `/v1/veil-crossing/calculate`
  - `/v1/spiritverse/events/current`
  - `/v1/spiritverse/events/all`
  - `/v1/quests/daily`
  - `/v1/games/list`
  - `/v1/conversations`
  - `/v1/conversations/:userId`
  - `/v1/session/snapshot`
  - `/v1/session/control`
  - `/v1/bond-journal`
  - `/runtime/conversation/bootstrap`
  - `/runtime/context/:conversation_id`
  - `/runtime/episodes/:conversation_id`
  - `/v1/games/state/:conversationId`
  - `/v1/interact`
  - `/v1/speech`

## Remaining warnings

The backend still reports unresolved schema drift during live requests:

- `[EngagementEngine] engagement upsert failed: Could not find the table 'public.user_engagement' in the schema cache`
- `[StructuredMemory] query failed: column memories.kind does not exist`
- `[EpisodeService] write failed: Could not find the 'content' column of 'episodes' in the schema cache`
- `[EmotionService] upsert failed: Could not find the 'arousal' column of 'emotion_state' in the schema cache`

These warnings confirm that persistence restoration is not complete yet for:

- engagement persistence
- structured memory persistence
- episode persistence
- emotion-state persistence

## What this means

- Safe endpoint health is good.
- Core HTTP surfaces are still responding correctly.
- SpiritCore persistence is still degraded in important background systems.
- The manual Supabase work completed so far did not fully align the live schema with the backend’s expected columns/tables.

## Additional non-schema warnings still present

These are configuration warnings rather than persistence drift:

- no Spiritkins image generation provider configured
- no Spiritkins video generation provider configured
- Node warning about `spiritkins-app/package.json` lacking `"type": "module"`

## Current Phase 1B truth

Phase 1B verification is not fully clean yet. The backend remains operational, but schema restoration is incomplete because the live diagnostics still show missing `user_engagement`, `memories.kind`, `episodes.content`, and `emotion_state.arousal` in the active Supabase schema cache path the backend is hitting.
