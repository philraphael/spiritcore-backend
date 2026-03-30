export default class EmotionEngine {
  constructor(supabase) {
    this.supabase = supabase;
  }

  // very simple v1: rolling intensity + tone label, stored per context
  _inferDelta(text) {
    const t = (text || "").toLowerCase();
    let arousal = 0;
    let valence = 0;

    const up = ["excited", "hype", "love", "amazing", "let’s go", "lets go", "win"];
    const down = ["sad", "depressed", "hopeless", "tired", "overwhelmed", "anxious", "panic"];
    const anger = ["angry", "mad", "pissed", "furious"];

    if (up.some((w) => t.includes(w))) { arousal += 1; valence += 1; }
    if (down.some((w) => t.includes(w))) { arousal += 1; valence -= 1; }
    if (anger.some((w) => t.includes(w))) { arousal += 1; valence -= 1; }

    return { arousal, valence };
  }

  _clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
  }

  _label(state) {
    const a = state.arousal ?? 0;
    const v = state.valence ?? 0;

    if (a <= 1 && v >= 1) return "calm_positive";
    if (a >= 2 && v >= 1) return "energized_positive";
    if (a >= 2 && v <= -1) return "activated_negative";
    if (a <= 1 && v <= -1) return "low_negative";
    return "neutral";
  }

  async getState({ user_id, spiritkin_id = null, conversation_id = null }) {
    const { data, error } = await this.supabase
      .from("spirit_emotion_state")
      .select("id, state_json")
      .eq("user_id", user_id)
      .eq("spiritkin_id", spiritkin_id)
      .eq("conversation_id", conversation_id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) throw new Error(`EmotionEngine: fetch failed. ${error.message || JSON.stringify(error)}`);

    const state = data?.[0]?.state_json ?? { arousal: 0, valence: 0, label: "neutral" };
    return state;
  }

  async updateFromText({ user_id, spiritkin_id = null, conversation_id = null, text }) {
    const prev = await this.getState({ user_id, spiritkin_id, conversation_id });
    const delta = this._inferDelta(text);

    const next = {
      arousal: this._clamp((prev.arousal ?? 0) + delta.arousal, 0, 10),
      valence: this._clamp((prev.valence ?? 0) + delta.valence, -10, 10),
    };
    next.label = this._label(next);
    next.updated_at = new Date().toISOString();

    // upsert (we store as new row style to keep history simple; you can change later)
    const { error } = await this.supabase
      .from("spirit_emotion_state")
      .insert([
        {
          user_id,
          spiritkin_id,
          conversation_id,
          state_json: next,
          updated_at: next.updated_at,
        },
      ]);

    if (error) throw new Error(`EmotionEngine: insert failed. ${error.message || JSON.stringify(error)}`);

    return next;
  }
}
