-- ============================================================
-- SpiritCore Analytics & Feedback Schema
-- Migration 004 — Beta Phase
-- ============================================================

-- 1. Interaction Analytics
-- Logs every /v1/interact call with performance and outcome data.
CREATE TABLE IF NOT EXISTS analytics_interactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL,
  spiritkin_name  TEXT        NOT NULL,
  conversation_id UUID,
  input_length    INTEGER     NOT NULL DEFAULT 0,
  response_length INTEGER     NOT NULL DEFAULT 0,
  latency_ms      INTEGER,
  success         BOOLEAN     NOT NULL DEFAULT TRUE,
  retry_count     INTEGER     NOT NULL DEFAULT 0,
  safety_tier     INTEGER,
  trace_id        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_user_id        ON analytics_interactions (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_spiritkin_name ON analytics_interactions (spiritkin_name);
CREATE INDEX IF NOT EXISTS idx_ai_created_at     ON analytics_interactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversation   ON analytics_interactions (conversation_id);

-- 2. Feedback Events
-- Stores explicit user feedback after responses.
CREATE TABLE IF NOT EXISTS feedback_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT        NOT NULL,
  conversation_id     UUID,
  spiritkin_name      TEXT        NOT NULL,
  rating              SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  helpful             BOOLEAN,
  emotional_resonance TEXT,
  free_text           TEXT,
  message_id          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fe_user_id        ON feedback_events (user_id);
CREATE INDEX IF NOT EXISTS idx_fe_spiritkin_name ON feedback_events (spiritkin_name);
CREATE INDEX IF NOT EXISTS idx_fe_created_at     ON feedback_events (created_at DESC);

-- 3. Behavioral Sessions
-- Tracks session-level signals: start, end, duration, abandonment.
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT        NOT NULL,
  conversation_id     UUID,
  spiritkin_name      TEXT,
  event_type          TEXT        NOT NULL,  -- 'start' | 'end' | 'spiritkin_selected' | 'first_message' | 'abandon'
  first_message_delay INTEGER,               -- ms from session start to first message
  session_duration_ms INTEGER,               -- ms from start to end/abandon
  message_count       INTEGER     NOT NULL DEFAULT 0,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_as_user_id        ON analytics_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_as_spiritkin_name ON analytics_sessions (spiritkin_name);
CREATE INDEX IF NOT EXISTS idx_as_event_type     ON analytics_sessions (event_type);
CREATE INDEX IF NOT EXISTS idx_as_created_at     ON analytics_sessions (created_at DESC);

-- 4. Spiritkin Derived Metrics
-- Aggregated per-spiritkin scoring updated on each interaction.
CREATE TABLE IF NOT EXISTS spiritkin_metrics (
  spiritkin_name          TEXT PRIMARY KEY,
  total_interactions      INTEGER     NOT NULL DEFAULT 0,
  successful_interactions INTEGER     NOT NULL DEFAULT 0,
  total_sessions          INTEGER     NOT NULL DEFAULT 0,
  unique_users            INTEGER     NOT NULL DEFAULT 0,
  return_users            INTEGER     NOT NULL DEFAULT 0,
  avg_rating              NUMERIC(3,2),
  total_feedback_count    INTEGER     NOT NULL DEFAULT 0,
  avg_session_length_ms   INTEGER,
  avg_response_length     INTEGER,
  drop_off_count          INTEGER     NOT NULL DEFAULT 0,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed canonical Spiritkins
INSERT INTO spiritkin_metrics (spiritkin_name)
VALUES ('Lyra'), ('Raien'), ('Kairo')
ON CONFLICT (spiritkin_name) DO NOTHING;

-- ============================================================
-- Row Level Security (open for service role, locked for anon)
-- ============================================================
ALTER TABLE analytics_interactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE spiritkin_metrics       ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- No anon policies needed — all writes are server-side only.
