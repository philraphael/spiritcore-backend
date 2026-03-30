/**
 * PHASE C CHANGE:
 * Hardcoded defaults (spirit_name="Lyra", persona_json={voiceTone:"Lyra",...})
 * have been removed. bootstrapConversation now requires a `spiritkin_name`
 * parameter and resolves the full identity from the canonical registry
 * via the injected `registry` dependency.
 *
 * The old behavior of inserting a new spiritkin row per conversation has been
 * replaced: canonical Spiritkins already exist in the registry and are
 * referenced by id, not duplicated per user session.
 */
export default class BootstrapEngine {
  /**
   * @param {object} supabase
   * @param {object} [registry]  — optional SpiritkinRegistry for canonical resolution
   */
  constructor(supabase, registry = null) {
    this.supabase = supabase;
    this.registry = registry;
  }

  async bootstrapConversation({
    user_id,
    spiritkin_name,          // REQUIRED — resolved against registry; no hardcoded default
    title = "New Conversation",
  }) {
    if (!spiritkin_name) {
      throw new Error(
        "BootstrapEngine: spiritkin_name is required. " +
        "Hardcoded Lyra default has been removed. Pass a canonical Spiritkin name."
      );
    }

    const uid = user_id || crypto.randomUUID();

    // 1) Resolve canonical Spiritkin from registry (never insert a new row for canon)
    let spiritRow;
    if (this.registry) {
      const identity = await this.registry.getCanonical(spiritkin_name);
      if (!identity) {
        throw new Error(
          `BootstrapEngine: No canonical Spiritkin found with name "${spiritkin_name}".`
        );
      }
      spiritRow = { id: identity.id, name: identity.name, archetype: identity.title };
    } else {
      // Fallback: look up directly from DB (transitional path when registry not injected)
      const { data, error } = await this.supabase
        .from("spiritkins")
        .select("id, name, archetype")
        .eq("is_canon", true)
        .ilike("name", spiritkin_name)
        .single();
      if (error || !data) {
        throw new Error(
          `BootstrapEngine: spiritkin lookup failed for "${spiritkin_name}". ${error?.message ?? "Not found."}`
        );
      }
      spiritRow = data;
    }

    // 2) Create conversation
    const { data: convoRow, error: convoErr } = await this.supabase
      .from("conversations")
      .insert([
        {
          user_id: uid,
          spiritkin_id: spiritRow.id,
          title,
          created_at: new Date().toISOString(),
        },
      ])
      .select("id, user_id, spiritkin_id, title, created_at")
      .single();

    if (convoErr) {
      throw new Error(`BootstrapEngine: conversation insert failed. ${convoErr.message || JSON.stringify(convoErr)}`);
    }

    return {
      user_id: uid,
      spiritkin_id: spiritRow.id,
      conversation_id: convoRow.id,
      title: convoRow.title,
      created_at: convoRow.created_at,
    };
  }
}
