-- ============================================================
-- Adaptive profile persistence layer
-- Migration 006 — additive profile storage for SpiritCore
-- ============================================================

ALTER TABLE public.user_engagement
  ADD COLUMN IF NOT EXISTS adaptive_profile JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.user_engagement
  ADD COLUMN IF NOT EXISTS adaptive_profile_updated_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_user_engagement_profile_updated_at
  ON public.user_engagement (adaptive_profile_updated_at DESC NULLS LAST);
