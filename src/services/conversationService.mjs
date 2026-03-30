/**
 * SpiritCore — Conversation Service
 *
 * Authoritative src service for conversation lifecycle management.
 * Absorbs: runtime/contextResolver.mjs (conversation lookup)
 *          runtime/bootstrapEngine.mjs (conversation creation)
 *
 * Responsibilities:
 *   - Look up an existing conversation and resolve user_id + spiritkin_id
 *   - Bootstrap a new conversation linked to a canonical Spiritkin
 *   - List conversations for a user
 */

import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";

export function createConversationService({ supabase, registry }) {

  /**
   * Resolve an existing conversation by id.
   * Returns { conversation_id, user_id, spiritkin_id, title, created_at }.
   * Throws if not found.
   *
   * Absorbs: runtime/contextResolver.resolveByConversation()
   *
   * @param {string} conversationId
   * @returns {Promise<object>}
   */
  async function resolveByConversation(conversationId) {
    if (!conversationId) throw new AppError("VALIDATION", "conversationId is required", 400);

    const { data, error } = await supabase
      .from("conversations")
      .select("id, user_id, spiritkin_id, title, created_at")
      .eq("id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw new AppError("DB", "Conversation lookup failed", 500, error.message);

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) throw new AppError("NOT_FOUND", `No conversation found: ${conversationId}`, 404);

    return {
      conversation_id: row.id,
      user_id: row.user_id,
      spiritkin_id: row.spiritkin_id ?? null,
      title: row.title ?? "Untitled",
      created_at: row.created_at,
    };
  }

  /**
   * Bootstrap a new conversation for a user linked to a canonical Spiritkin.
   * Resolves the Spiritkin from the registry — never accepts a bare name stub.
   *
   * Absorbs: runtime/bootstrapEngine.bootstrapConversation()
   *
   * @param {{ userId: string, spiritkinName: string, title?: string }} opts
   * @returns {Promise<object>}
   */
  async function bootstrap({ userId, spiritkinName, title = "New Conversation" }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    if (!spiritkinName) throw new AppError("VALIDATION", "spiritkinName is required", 400);

    // Resolve canonical Spiritkin from registry
    const identity = await registry.getCanonical(spiritkinName);
    if (!identity) {
      throw new AppError(
        "NOT_FOUND",
        `No canonical Spiritkin found with name "${spiritkinName}". ` +
        `Valid names: Lyra, Raien, Kairo.`,
        404
      );
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert([{
        user_id: userId,
        spiritkin_id: identity.id,
        title,
        created_at: nowIso(),
      }])
      .select("id, user_id, spiritkin_id, title, created_at")
      .single();

    if (error) throw new AppError("DB", "Failed to create conversation", 500, error.message);

    return {
      conversation_id: data.id,
      user_id: data.user_id,
      spiritkin_id: data.spiritkin_id,
      spiritkin_name: identity.name,
      title: data.title,
      created_at: data.created_at,
    };
  }

  /**
   * List recent conversations for a user.
   *
   * @param {{ userId: string, limit?: number }} opts
   * @returns {Promise<object[]>}
   */
  async function listForUser({ userId, limit = 20 }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);

    const { data, error } = await supabase
      .from("conversations")
      .select("id, spiritkin_id, title, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) throw new AppError("DB", "Failed to list conversations", 500, error.message);
    return data ?? [];
  }

  return { resolveByConversation, bootstrap, listForUser };
}
