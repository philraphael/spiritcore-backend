# Schema Verification Diagnostic Report

## How Verification Works

- Added `scripts/schema-verify.mjs`.
- Uses existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from environment configuration.
- Does not print secrets.
- Performs read-only, zero-row Supabase reads:
  - `select("*").limit(0)` for required table presence.
  - `select("required,column,list").limit(0)` for required column presence.
- Attempts read-only `pg_catalog.pg_indexes` access for index verification.

## Tables Checked

- `users`
- `conversations`
- `messages`
- `memories`
- `spirit_memory`
- `episodes`
- `emotion_state`
- `world_state`
- `user_engagement`
- `safety_events`

Result: all 10 table checks passed.

## Columns Checked

- `memories`: `kind`, `meta`
- `episodes`: `content`, `emotion_snapshot`
- `emotion_state`: `label`, `valence`, `arousal`, `metadata_json`
- `world_state`: `spiritkin_id`, `scene_json`
- `user_engagement`: `user_id`, `spiritkin_id`, `last_session_at`, `last_bond_stage`, `last_echo_unlocks`, `last_emotion_label`, `last_arc`, `updated_at`

Result: all 5 column-group checks passed.

## Indexes Checked

Expected:

- `user_engagement` unique on `user_id + spiritkin_id`
- `emotion_state` unique on `user_id + spiritkin_id + conversation_id`

Result: not verified through Supabase REST. The current Supabase REST configuration exposes `public` and `graphql_public`, but not `pg_catalog`, so `pg_catalog.pg_indexes` returned `PGRST106 Invalid schema: pg_catalog`.

The diagnostic reports those index checks as `unverified` rather than guessing. This does not mask table or column failures.

## Validation Result

- `npm run diagnostics:schema`: passed.
- Table pass count: 10.
- Column group pass count: 5.
- Index verified count: 0.
- Index unverified count: 2.
- Index failure count: 0.

## npm test Result

- First sandbox run hit `spawn EPERM` when endpoint diagnostics attempted to spawn the local server.
- Rerun with approved escalation passed.
- Endpoint diagnostics: 31 passed, 0 skipped, 0 failed.
- Schema diagnostics: passed.

## Limitations

- Index and constraint verification depends on PostgREST exposing catalog/introspection schemas or an approved read-only RPC. Neither is currently available.
- The script does not apply migrations, create tables, alter schema, insert rows, update rows, or delete rows.
- The diagnostic validates the public REST-visible contract, not every database-level policy or private catalog detail.

## Schema Modification

No schema modifications were performed.
