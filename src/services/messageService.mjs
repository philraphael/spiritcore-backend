/**
 * SpiritCore — Message Ledger Service (Phase E)
 *
 * The authoritative durable store for conversation turns.
 * Every inbound user message and every outbound Spiritkin response
 * is written here as the primary chat transcript.
 *
 * ARCHITECTURAL RULE:
 *   messages   = raw, durable, ordered chat transcript (this service)
 *   memories   = derived, governed artifacts (summaries, emotional anchors)
 *
 * The messages table schema:
 *   id              uuid PK
 *   conversation_id uuid NOT NULL → conversations.id
 *   role            text NOT NULL  ('user' | 'spiritkin' | 'system')
 *   content         text NOT NULL
 *   client_timestamp timestamptz
 *   created_at      timestamptz DEFAULT now()
 */

import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";

export function createMessageService({ supabase }) {

  /**
   * Persist a single message turn to the durable ledger.
   *
   * @param {{ conversationId, role, content, clientTimestamp? }} opts
   * @returns {Promise<{ ok: boolean, id: string, created_at: string }>}
   */
  async function persist({ conversationId, role, content, clientTimestamp = null }) {
    if (!conversationId) throw new AppError("VALIDATION", "conversationId is required", 400);
    if (!role) throw new AppError("VALIDATION", "role is required", 400);
    if (!content || typeof content !== "string") throw new AppError("VALIDATION", "content is required", 400);

    const validRoles = ["user", "spiritkin", "system"];
    if (!validRoles.includes(role)) {
      throw new AppError("VALIDATION", `role must be one of: ${validRoles.join(", ")}`, 400);
    }

    const payload = {
      conversation_id: conversationId,
      role,
      content: content.slice(0, 8000), // hard cap to prevent runaway writes
      client_timestamp: clientTimestamp ?? null,
      created_at: nowIso(),
    };

    const { data, error } = await supabase
      .from("messages")
      .insert([payload])
      .select("id, created_at")
      .single();

    if (error) {
      // Non-fatal: log and return failure indicator — never crash the pipeline
      console.error("[MessageService] persist failed:", error.message);
      return { ok: false, reason: error.message };
    }

    return { ok: true, id: data.id, created_at: data.created_at };
  }

  /**
   * Fetch recent messages for a conversation (for context window reconstruction).
   *
   * @param {{ conversationId, limit? }} opts
   * @returns {Promise<object[]>}
   */
  async function fetchRecent({ conversationId, limit = 20 }) {
    if (!conversationId) throw new AppError("VALIDATION", "conversationId is required", 400);

    const { data, error } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) throw new AppError("DB", "Failed to fetch messages", 500, error.message);

    // Return in chronological order
    return (data ?? []).reverse();
  }

  return { persist, fetchRecent };
}
