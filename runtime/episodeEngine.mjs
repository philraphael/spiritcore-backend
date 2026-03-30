export default class EpisodeEngine {
  constructor(supabase) {
    this.supabase = supabase;
  }

  _tagsFromText(text) {
    const t = (text || "").toLowerCase();
    const tags = [];

    const map = [
      ["build", ["build", "code", "server", "bug", "error", "api", "supabase"]],
      ["family", ["wife", "husband", "kids", "daughter", "son"]],
      ["money", ["money", "rent", "bill", "debt", "loan"]],
      ["wedding", ["wedding", "venue", "dress", "church"]],
      ["trading", ["forex", "trade", "pips", "mt4", "mt5"]],
    ];

    for (const [tag, words] of map) {
      if (words.some((w) => t.includes(w))) tags.push(tag);
    }
    return [...new Set(tags)].slice(0, 8);
  }

  _summaryFromText(text) {
    const s = String(text || "").trim();
    if (s.length <= 140) return s;
    return s.slice(0, 140) + "…";
  }

  async writeEpisode({ user_id, spiritkin_id = null, conversation_id = null, text, emotion }) {
    const summary = this._summaryFromText(text);
    const tags = this._tagsFromText(text);

    const { error } = await this.supabase
      .from("spirit_episodes")
      .insert([
        {
          user_id,
          spiritkin_id,
          conversation_id,
          summary,
          tags,
          emotion_json: emotion || {},
          source_text: String(text || ""),
        },
      ]);

    if (error) throw new Error(`EpisodeEngine: insert failed. ${error.message || JSON.stringify(error)}`);

    // Phase 3: auto summary every N episodes
    await this._maybeWriteConversationSummary({ user_id, spiritkin_id, conversation_id });
  }

  async fetchRecentEpisodes({ user_id, spiritkin_id = null, conversation_id = null, limit = 5 }) {
    let q = this.supabase
      .from("spirit_episodes")
      .select("id, summary, tags, emotion_json, created_at")
      .eq("user_id", user_id);

    if (spiritkin_id) q = q.eq("spiritkin_id", spiritkin_id);
    if (conversation_id) q = q.eq("conversation_id", conversation_id);

    const { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(20, Number(limit) || 5)));

    if (error) throw new Error(`EpisodeEngine: fetch failed. ${error.message || JSON.stringify(error)}`);
    return data ?? [];
  }

  async fetchLatestSummary({ user_id, spiritkin_id = null, conversation_id = null }) {
    let q = this.supabase
      .from("spirit_episodes")
      .select("id, summary, tags, emotion_json, created_at")
      .eq("user_id", user_id);

    if (spiritkin_id) q = q.eq("spiritkin_id", spiritkin_id);
    if (conversation_id) q = q.eq("conversation_id", conversation_id);

    // summary episodes are tagged with "summary"
    const { data, error } = await q
      .contains("tags", ["summary"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw new Error(`EpisodeEngine: fetchLatestSummary failed. ${error.message || JSON.stringify(error)}`);

    const row = Array.isArray(data) ? data[0] : null;
    return row || null;
  }

  async _maybeWriteConversationSummary({ user_id, spiritkin_id, conversation_id }) {
    if (!conversation_id) return;

    // Count non-summary episodes for this conversation
    const { data, error } = await this.supabase
      .from("spirit_episodes")
      .select("id, tags, created_at", { count: "exact" })
      .eq("conversation_id", conversation_id)
      .not("tags", "cs", "{summary}") // exclude summary-tagged episodes
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) return; // fail-soft

    const episodes = data || [];
    const count = episodes.length;

    // Every 6 episodes, write/update a summary episode
    if (count < 6 || (count % 6) !== 0) return;

    const summaries = episodes
      .map((e) => e?.id ? e : null)
      .filter(Boolean);

    // Build a simple deterministic summary text
    const lines = episodes
      .slice(0, 6)
      .reverse()
      .map((e) => `• ${String(e.summary || "").trim()}`)
      .filter(Boolean);

    const summaryText = `Conversation summary (last ${Math.min(6, lines.length)}):\n${lines.join("\n")}`;

    await this.supabase.from("spirit_episodes").insert([
      {
        user_id,
        spiritkin_id,
        conversation_id,
        summary: summaryText,
        tags: ["summary"],
        emotion_json: {},
        source_text: summaryText,
      },
    ]);
  }
}
