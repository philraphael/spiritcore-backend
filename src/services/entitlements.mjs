import { AppError } from "../errors.mjs";

export const createEntitlementsService = ({ supabase, bus }) => {
  const check = async ({ userId }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);

    const { data, error } = await supabase
      .from("entitlements")
      .select("status, plan, updated_at")
      .eq("user_id", userId)
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
    const plan = data?.plan || "free";

    return { ok: true, userId, status, plan, source: "db" };
  };

  return { check };
};
