import { AppError } from "../errors.mjs";
import { config } from "../config.mjs";
import { nowIso, daysBetween } from "../utils/time.mjs";
import { sanitizeText } from "../utils/sanitize.mjs";

export const createMemoryService = ({ supabase, bus }) => {
  const write = async ({ userId, spiritkinId, kind = "message", content, meta = {} }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    if (!content || typeof content !== "string") throw new AppError("VALIDATION", "content is required", 400);

    const clean = sanitizeText(content).slice(0, 4000);

    const payload = {
      user_id: userId,
      spiritkin_id: spiritkinId || null,
      kind,
      content: clean,
      meta,
      last_accessed_at: nowIso()
    };

    const { error } = await supabase.from("memories").insert(payload);
    if (error) throw new AppError("DB", "Failed to write memory", 500, error.message);

    bus.emit("memory.written", { userId, kind });
    return { ok: true };
  };

  const query = async ({ userId, spiritkinId, limit = 20 }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);

    let q = supabase.from("memories").select("id, kind, content, meta, created_at").eq("user_id", userId);

    if (spiritkinId) q = q.eq("spiritkin_id", spiritkinId);

    const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
    if (error) throw new AppError("DB", "Failed to query memory", 500, error.message);

    supabase
      .from("memory_access")
      .upsert({ user_id: userId, last_accessed_at: nowIso() }, { onConflict: "user_id" })
      .then(() => {})
      .catch(() => {});

    return data || [];
  };

  const computePolicyState = async ({ userId }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);

    const { data, error } = await supabase
      .from("memory_access")
      .select("last_accessed_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return { userId, state: "unknown", reason: error.message };
    }

    const last = data?.last_accessed_at;
    if (!last) return { userId, state: "new" };

    const dormantDays = config.memoryPolicy.dormantDays;
    const compressDays = config.memoryPolicy.compressAfterDays;
    const deleteDays = config.memoryPolicy.deleteAfterDays;

    const d = daysBetween(last, nowIso());

    if (d >= deleteDays) return { userId, state: "delete_due", days: d };
    if (d >= compressDays) return { userId, state: "compress_due", days: d };
    if (d >= dormantDays) return { userId, state: "dormant", days: d };

    return { userId, state: "active", days: d };
  };

  return { write, query, computePolicyState };
};
