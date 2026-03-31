import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";
import { toUuid } from "../utils/id.mjs";

export const createWorldService = ({ supabase, bus }) => {
  const get = async ({ userId }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    const dbUserId = toUuid(userId);
    const { data, error } = await supabase
      .from("world_state")
      .select("scene_json, updated_at")
      .eq("user_id", dbUserId)
      .maybeSingle();
    if (error) throw new AppError("DB", "Failed to read world state", 500, error.message);
    return {
      userId,
      state: data?.scene_json || { scene: { name: "default" }, flags: {} },
      updatedAt: data?.updated_at || null
    };
  };

  const upsert = async ({ userId, state }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    if (!state || typeof state !== "object") throw new AppError("VALIDATION", "state must be an object", 400);
    const dbUserId = toUuid(userId);
    const payload = { user_id: dbUserId, scene_json: state, updated_at: nowIso() };
    const { error } = await supabase.from("world_state").upsert(payload, { onConflict: "user_id" });
    if (error) throw new AppError("DB", "Failed to write world state", 500, error.message);
    bus.emit("world.updated", { userId });
    return { ok: true };
  };

  return { get, upsert };
};
