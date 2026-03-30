export default class EntitlementsEngine {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async fetchEntitlements(user_id) {
    const { data, error } = await this.supabase
      .from("entitlements")
      .select("user_id, tier, status, updated_at")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) {
      // fail-soft: default free/active
      return { user_id, tier: "free", status: "active", updated_at: null, warning: error };
    }
    if (!data) return { user_id, tier: "free", status: "active", updated_at: null };
    return data;
  }

  policyFromEntitlements(ent) {
    const status = String(ent?.status || "active").toLowerCase();

    // Match your SpiritCore policy intent:
    // - dormant: no memory retention
    // - lapsed: minimal retention
    // - active: normal retention
    if (status === "dormant") return { status, allow_write: false, max_memories: 0, max_episodes: 0 };
    if (status === "lapsed") return { status, allow_write: true, max_memories: 1, max_episodes: 1 };
    return { status: "active", allow_write: true, max_memories: 5, max_episodes: 5 };
  }
}
