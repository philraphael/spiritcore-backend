/**
 * SpiritCore — Episode Service
 *
 * Authoritative src service for episode management.
 * Absorbs: runtime/episodeEngine.mjs
 *
 * Episodes are narrative arc snapshots — structured records of significant
 * interaction moments that inform the Spiritkin's contextual understanding.
 */

import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";
import { toUuid } from "../utils/id.mjs";

export function createEpisodeService({ supabase }) {

  /**
   * Write a new episode record.
   * Absorbs: EpisodeEngine.writeEpisode()
   */
  async function write({ userId, spiritkinId = null, conversationId = null, text, emotion = {} }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    if (!text) throw new AppError("VALIDATION", "text is required", 400);
    const dbUserId = toUuid(userId);
    const episodeText = String(text);
    const payload = {
      user_id: dbUserId,
      spiritkin_id: spiritkinId,
      conversation_id: conversationId,
      // Keep legacy and current episode schemas in sync during the transition.
      summary: episodeText,
      content: episodeText,
      emotion_snapshot: emotion,
      created_at: nowIso(),
    };

    const { data, error } = await supabase
      .from("episodes")
      .insert([payload])
      .select("id, created_at")
      .single();

    if (error) {
      console.warn("[EpisodeService] write failed:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true, id: data.id, created_at: data.created_at };
  }

  /**
   * Fetch recent episodes for context assembly.
   * Absorbs: EpisodeEngine.fetchRecentEpisodes()
   */
  async function fetchRecent({ userId, spiritkinId = null, conversationId = null, limit = 5 }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    const dbUserId = toUuid(userId);
    let query = supabase
      .from("episodes")
      .select("id, content, emotion_snapshot, created_at")
      .eq("user_id", dbUserId)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 20));

    if (spiritkinId) query = query.eq("spiritkin_id", spiritkinId);
    if (conversationId) query = query.eq("conversation_id", conversationId);

    const { data, error } = await query;
    if (error) throw new AppError("DB", "Failed to fetch episodes", 500, error.message);
    return data ?? [];
  }

  /**
   * Fetch the most recent summary episode (if any).
   * Absorbs: EpisodeEngine.fetchLatestSummary()
   */
  async function fetchLatestSummary({ userId, spiritkinId = null, conversationId = null }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    const dbUserId = toUuid(userId);
    let query = supabase
      .from("episodes")
      .select("id, content, emotion_snapshot, created_at")
      .eq("user_id", dbUserId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (spiritkinId) query = query.eq("spiritkin_id", spiritkinId);
    if (conversationId) query = query.eq("conversation_id", conversationId);

    const { data, error } = await query;
    if (error) return null;
    return data?.[0] ?? null;
  }

  return { write, fetchRecent, fetchLatestSummary };
}
