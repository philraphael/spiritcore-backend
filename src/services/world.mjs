import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";
import { toUuid } from "../utils/id.mjs";

export const createWorldService = ({ supabase, bus }) => {
  const get = async ({ userId, conversationId }) => {
    if (!conversationId) throw new AppError("VALIDATION", "conversationId is required", 400);

    const safeUserId = toUuid(userId);

    const { data, error } = await supabase
      .from("world_state")
      .select("conversation_id, user_id, spiritkin_id, scene_json, updated_at")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (error) {
      throw new AppError("DB", "Failed to read world state", 500, error.message);
    }

    return {
      conversationId,
      userId: safeUserId,
      spiritkinId: data?.spiritkin_id ?? null,
      state: data?.scene_json || { scene: { name: "default" }, flags: {} },
      updatedAt: data?.updated_at || null,
    };
  };

  const upsert = async ({ userId, conversationId, spiritkinId = null, state }) => {
    if (!conversationId) throw new AppError("VALIDATION", "conversationId is required", 400);
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    if (!state || typeof state !== "object") {
      throw new AppError("VALIDATION", "state must be an object", 400);
    }

    const safeUserId = toUuid(userId);

    const payload = {
      conversation_id: conversationId,
      user_id: safeUserId,
      spiritkin_id: spiritkinId,
      scene_json: state,
      updated_at: nowIso(),
    };

    const { error } = await supabase
      .from("world_state")
      .upsert(payload, { onConflict: "conversation_id" });

    if (error) {
      throw new AppError("DB", "Failed to write world state", 500, error.message);
    }

    bus.emit("world.updated", { conversationId, userId: safeUserId });
    return { ok: true };
  };

  return { get, upsert };
};