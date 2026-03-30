export default class contextResolver {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async resolveByConversation(conversation_id) {
    if (!conversation_id) throw new Error("contextResolver: conversation_id required");
    if (!this.supabase) throw new Error("contextResolver: missing supabase client");

    // ✅ Robust: do NOT require .single() because table may contain duplicates
    const { data, error } = await this.supabase
      .from("conversations")
      .select("id, user_id, spiritkin_id, created_at")
      .eq("id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(
        `contextResolver: conversation lookup failed for ${conversation_id}. ${error.message || JSON.stringify(error)}`
      );
    }

    const row = Array.isArray(data) ? data[0] : null;

    if (!row) {
      throw new Error(
        `contextResolver: no conversation found for ${conversation_id}.`
      );
    }

    return {
      conversation_id: row.id,
      user_id: row.user_id,
      spiritkin_id: row.spiritkin_id ?? null,
    };
  }
}
