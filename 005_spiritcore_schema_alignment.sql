-- ============================================================
-- SpiritCore Persistence Schema Alignment
-- Migration 005 — additive alignment after authority audit
-- ============================================================
--
-- Goal:
-- Restore the current backend service contract without destructive changes.
-- This migration only adds missing tables, columns, defaults, indexes,
-- and compatibility backfills.
--
-- Drift confirmed in code + live Supabase probes:
-- - public.user_engagement missing
-- - public.memories.kind missing
-- - public.memories.meta missing
-- - public.episodes.content missing
-- - public.episodes.emotion_snapshot missing
-- - public.emotion_state.label missing
-- - public.emotion_state.valence missing
-- - public.emotion_state.arousal missing
-- - public.emotion_state.metadata_json missing

-- ------------------------------------------------------------
-- 1. user_engagement
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_engagement (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL,
  spiritkin_id             UUID        NOT NULL,
  last_session_at          TIMESTAMPTZ NULL,
  last_bond_stage          INTEGER     NOT NULL DEFAULT 0,
  last_echo_unlocks        TEXT[]      NOT NULL DEFAULT '{}'::TEXT[],
  last_emotion_label       TEXT        NULL,
  last_arc                 TEXT        NULL,
  last_session_minutes     INTEGER     NOT NULL DEFAULT 0,
  last_sustained_intensity DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_engagement_user_spiritkin
  ON public.user_engagement (user_id, spiritkin_id);

CREATE INDEX IF NOT EXISTS idx_user_engagement_updated_at
  ON public.user_engagement (updated_at DESC);

-- ------------------------------------------------------------
-- 2. memories compatibility columns for structured memory
-- ------------------------------------------------------------

ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS kind TEXT;

ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS meta JSONB;

UPDATE public.memories
SET kind = COALESCE(kind, 'legacy_memory')
WHERE kind IS NULL;

UPDATE public.memories
SET meta = COALESCE(
  meta,
  jsonb_strip_nulls(
    jsonb_build_object(
      'legacy_importance', importance,
      'legacy_tags', to_jsonb(tags),
      'legacy_resonance_score', resonance_score,
      'migration_source', '005_spiritcore_schema_alignment'
    )
  )
)
WHERE meta IS NULL;

ALTER TABLE public.memories
  ALTER COLUMN kind SET DEFAULT 'legacy_memory';

ALTER TABLE public.memories
  ALTER COLUMN meta SET DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_memories_kind
  ON public.memories (kind);

-- ------------------------------------------------------------
-- 3. episodes compatibility columns for current episode service
-- ------------------------------------------------------------

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS emotion_snapshot JSONB;

UPDATE public.episodes
SET content = COALESCE(content, summary, source_text)
WHERE content IS NULL;

UPDATE public.episodes
SET emotion_snapshot = COALESCE(emotion_snapshot, emotion_json, '{}'::JSONB)
WHERE emotion_snapshot IS NULL;

-- ------------------------------------------------------------
-- 4. emotion_state compatibility columns for current emotion service
-- ------------------------------------------------------------

ALTER TABLE public.emotion_state
  ADD COLUMN IF NOT EXISTS label TEXT;

ALTER TABLE public.emotion_state
  ADD COLUMN IF NOT EXISTS valence DOUBLE PRECISION;

ALTER TABLE public.emotion_state
  ADD COLUMN IF NOT EXISTS arousal DOUBLE PRECISION;

ALTER TABLE public.emotion_state
  ADD COLUMN IF NOT EXISTS metadata_json JSONB;

UPDATE public.emotion_state
SET label = COALESCE(label, state_json->>'label', 'neutral')
WHERE label IS NULL;

UPDATE public.emotion_state
SET valence = COALESCE(
  valence,
  CASE
    WHEN jsonb_typeof(state_json->'valence') = 'number' THEN (state_json->>'valence')::DOUBLE PRECISION
    ELSE 0.5
  END
)
WHERE valence IS NULL;

UPDATE public.emotion_state
SET arousal = COALESCE(
  arousal,
  CASE
    WHEN jsonb_typeof(state_json->'arousal') = 'number' THEN (state_json->>'arousal')::DOUBLE PRECISION
    ELSE 0.3
  END
)
WHERE arousal IS NULL;

UPDATE public.emotion_state
SET metadata_json = COALESCE(
  metadata_json,
  CASE
    WHEN state_json IS NOT NULL THEN
      jsonb_strip_nulls(
        (state_json - 'label' - 'valence' - 'arousal') ||
        jsonb_build_object(
          'migration_source', '005_spiritcore_schema_alignment'
        )
      )
    ELSE
      jsonb_build_object('migration_source', '005_spiritcore_schema_alignment')
  END
)
WHERE metadata_json IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_emotion_state_user_spiritkin_conversation
  ON public.emotion_state (user_id, spiritkin_id, conversation_id);

-- ------------------------------------------------------------
-- 5. Service-role-only server-side tables — keep RLS enabled
-- ------------------------------------------------------------

ALTER TABLE public.user_engagement ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no anon policies are added here.
