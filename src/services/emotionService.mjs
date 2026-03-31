/**
 * SpiritCore — Emotion Service
 *
 * Authoritative src service for emotion state management.
 * Absorbs: runtime/emotionEngine.mjs
 *
 * Reads and writes the `emotion_state` table.
 * Provides a simple sentiment signal derived from text for updates.
 */

import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";
import { toUuid } from "../utils/id.mjs";

/** Lightweight keyword-based sentiment signal (no external model dependency). */
function deriveEmotionFromText(text) {
  if (!text) return { label: "neutral", valence: 0.5, arousal: 0.3 };
  const lower = text.toLowerCase();
  const positive = ["happy", "great", "love", "excited", "good", "wonderful", "amazing", "joy", "grateful", "hope"];
  const negative = ["sad", "angry", "scared", "anxious", "hurt", "lost", "tired", "afraid", "alone", "pain", "crisis", "help"];
  const posScore = positive.filter(w => lower.includes(w)).length;
  const negScore = negative.filter(w => lower.includes(w)).length;
  if (negScore > posScore) return { label: "distressed", valence: 0.2, arousal: 0.7 };
  if (posScore > negScore) return { label: "positive", valence: 0.8, arousal: 0.5 };
  return { label: "neutral", valence: 0.5, arousal: 0.3 };
}

export function createEmotionService({ supabase }) {

  /**
   * Get the current emotion state for a user/spiritkin/conversation.
   * Returns null if no state exists yet.
   *
   * Absorbs: EmotionEngine.getState()
   */
  async function getState({ userId, spiritkinId = null, conversationId = null }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    const dbUserId = toUuid(userId);
    let query = supabase
      .from("emotion_state")
      .select("*")
      .eq("user_id", dbUserId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (spiritkinId) query = query.eq("spiritkin_id", spiritkinId);
    if (conversationId) query = query.eq("conversation_id", conversationId);

    const { data, error } = await query;
    if (error) throw new AppError("DB", "Failed to read emotion state", 500, error.message);
    return data?.[0] ?? null;
  }

  /**
   * Update emotion state derived from a text input.
   * Upserts into emotion_state keyed on user_id + spiritkin_id + conversation_id.
   *
   * Absorbs: EmotionEngine.updateFromText()
   */
  async function updateFromText({ userId, spiritkinId = null, conversationId = null, text }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    const dbUserId = toUuid(userId);
    const derived = deriveEmotionFromText(text);
    const payload = {
      user_id: dbUserId,
      spiritkin_id: spiritkinId,
      conversation_id: conversationId,
      label: derived.label,
      valence: derived.valence,
      arousal: derived.arousal,
      updated_at: nowIso(),
    };

    const { data, error } = await supabase
      .from("emotion_state")
      .upsert(payload, { onConflict: "user_id,spiritkin_id,conversation_id" })
      .select("*")
      .single();

    if (error) {
      // Non-fatal: log and return derived signal without persistence
      console.warn("[EmotionService] upsert failed:", error.message);
      return { ...derived, persisted: false };
    }
    return { ...data, persisted: true };
  }

  return { getState, updateFromText };
}
