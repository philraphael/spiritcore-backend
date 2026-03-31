import { AppError } from "../errors.mjs";
import { config } from "../config.mjs";
import { nowIso, daysBetween } from "../utils/time.mjs";
import { sanitizeText } from "../utils/sanitize.mjs";
import { toUuid } from "../utils/id.mjs";

export const createMemoryService = ({ supabase, bus }) => {
  const write = async ({ userId, spiritkinId, kind = "message", content, meta = {} }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    if (!content || typeof content !== "string") {
      throw new AppError("VALIDATION", "content is required", 400);
    }

    const clean = sanitizeText(content).slice(0, 4000);
    const safeUserId = toUuid(userId);

    const payload = {
      user_id: safeUserId,
      spiritkin_id: spiritkinId || null,
      kind,
      content: clean,
      meta,
    };

    const { error } = await supabase.from("memories").insert(payload);
    if (error) throw new AppError("DB", "Failed to write memory", 500, error.message);

    bus.emit("memory.written", { userId: safeUserId, kind });
    return { ok: true };
  };

  const query = async ({ userId, spiritkinId, conversationId = null, limit = 20 }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);

    const safeUserId = toUuid(userId);

    let q = supabase
      .from("memories")
      .select("id, kind, content, meta, created_at")
      .eq("user_id", safeUserId);

    if (spiritkinId) q = q.eq("spiritkin_id", spiritkinId);

    const { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new AppError("DB", "Failed to query memory", 500, error.message);

    const memories = data || [];

    // Log memory access using the normalized Phase B schema:
    // memory_access(memory_id, conversation_id, accessed_at, reason)
    if (conversationId && memories.length) {
      const accessRows = memories.map((m) => ({
        memory_id: m.id,
        conversation_id: conversationId,
        accessed_at: nowIso(),
        reason: "context_query",
      }));

      supabase
        .from("memory_access")
        .insert(accessRows)
        .then(() => {})
        .catch(() => {});
    }

    return memories;
  };

  const computePolicyState = async ({ userId }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);

    const safeUserId = toUuid(userId);

    // Determine last memory activity from the memories table itself
    // because memory_access is now an audit table, not a per-user state table.
    const { data, error } = await supabase
      .from("memories")
      .select("created_at")
      .eq("user_id", safeUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { userId: safeUserId, state: "unknown", reason: error.message };
    }

    const last = data?.created_at;
    if (!last) return { userId: safeUserId, state: "new" };

    const dormantDays = config.memoryPolicy.dormantDays;
    const compressDays = config.memoryPolicy.compressAfterDays;
    const deleteDays = config.memoryPolicy.deleteAfterDays;

    const d = daysBetween(last, nowIso());

    if (d >= deleteDays) return { userId: safeUserId, state: "delete_due", days: d };
    if (d >= compressDays) return { userId: safeUserId, state: "compress_due", days: d };
    if (d >= dormantDays) return { userId: safeUserId, state: "dormant", days: d };

    return { userId: safeUserId, state: "active", days: d };
  };

  return { write, query, computePolicyState };
};