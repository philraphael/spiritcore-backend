import { AppError } from "../errors.mjs";
import { toUuid } from "../utils/id.mjs";

export const createEntitlementsService = ({ supabase, bus }) => {
  const check = async ({ userId }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    const dbUserId = toUuid(userId);
    const { data, error } = await supabase
      .from("entitlements")
      .select("status, tier, updated_at")
      .eq("user_id", dbUserId)
      .maybeSingle();

    if (error) {
      bus.emit("entitlements.fallback", { userId, reason: error.message });
      return {
        ok: true,
        userId,
        status: "free",
        plan: "free",
        source: "fallback"
      };
    }

    const status = data?.status || "free";
    const plan = data?.tier || "free";  // DB column is 'tier', exposed as 'plan'

    return { ok: true, userId, status, plan, source: "db" };
  };

  return { check };
};
