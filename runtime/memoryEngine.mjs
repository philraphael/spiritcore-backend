export default class MemoryEngine {
  constructor(supabase, userId) {
    this.supabase = supabase;
    this.userId = userId;
  }

  async storeMemory({ type, content, spiritkin_id = null, conversation_id = null }) {
    if (!this.supabase) throw new Error("MemoryEngine: Missing supabase client");
    if (!this.userId) throw new Error("MemoryEngine: Missing userId");
    if (!type) throw new Error("MemoryEngine: Missing type");
    if (content === undefined || content === null) throw new Error("MemoryEngine: Missing content");

    const payload = {
      user_id: this.userId,
      type: String(type),
      content: String(content),
      timestamp: new Date().toISOString(),
      spiritkin_id: spiritkin_id || null,
      conversation_id: conversation_id || null,
    };

    const { error } = await this.supabase.from("spirit_memory").insert([payload]);

    if (error) {
      throw new Error(
        `MemoryEngine: DB insert failed (table=spirit_memory). ${error.message || JSON.stringify(error)}`
      );
    }
  }

  async fetchRecentMemories({ limit = 10, spiritkin_id = null, conversation_id = null } = {}) {
    if (!this.supabase) throw new Error("MemoryEngine: Missing supabase client");
    if (!this.userId) throw new Error("MemoryEngine: Missing userId");

    let q = this.supabase
      .from("spirit_memory")
      .select("*")
      .eq("user_id", this.userId);

    if (spiritkin_id) q = q.eq("spiritkin_id", spiritkin_id);
    if (conversation_id) q = q.eq("conversation_id", conversation_id);

    const { data, error } = await q
      .order("timestamp", { ascending: false })
      .limit(Math.max(1, Math.min(50, Number(limit) || 10)));

    if (error) {
      throw new Error(
        `MemoryEngine: DB fetch failed (table=spirit_memory). ${error.message || JSON.stringify(error)}`
      );
    }

    return data ?? [];
  }
}
