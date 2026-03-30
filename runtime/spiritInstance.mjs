import IdentityKernel from "./identityKernel.mjs";
import MemoryEngine from "./memoryEngine.mjs";
import eventBus from "./eventBus.mjs";

export default class SpiritInstance {
  constructor(profile, supabase, userId, engines) {
    this.identity = new IdentityKernel(profile);
    this.memory = new MemoryEngine(supabase, userId);

    // Phase 1 engines
    this.emotionEngine = engines?.emotionEngine;
    this.episodeEngine = engines?.episodeEngine;
    this.contextStitcher = engines?.contextStitcher;

    // Phase 2 engines
    this.entitlementsEngine = engines?.entitlementsEngine;
    this.responseEngine = engines?.responseEngine;

    this._handler = this.handleInteraction.bind(this);
    eventBus.subscribe("interaction", this._handler);
  }

  async handleInteraction(event) {
    try {
      if (!event) return;
      if (event.userId !== this.memory.userId) return;

      const message = String(event.message ?? "");
      const spiritkin_id = event.spiritkin_id ?? null;
      const conversation_id = event.conversation_id ?? null;

      // 1) Governance policy (entitlements)
      let ent = { user_id: this.memory.userId, tier: "free", status: "active" };
      let policy = { status: "active", allow_write: true, max_memories: 5, max_episodes: 5 };

      if (this.entitlementsEngine) {
        try {
          ent = await this.entitlementsEngine.fetchEntitlements(this.memory.userId);
          policy = this.entitlementsEngine.policyFromEntitlements(ent);
        } catch (e) {
          console.error("[SpiritInstance] entitlements fetch failed:", e?.message ?? e);
        }
      }

      // 2) Update emotion + write episode + raw memory (only if allowed)
      let emotion = null;

      if (policy.allow_write && this.emotionEngine) {
        try {
          emotion = await this.emotionEngine.updateFromText({
            user_id: this.memory.userId,
            spiritkin_id,
            conversation_id,
            text: message,
          });
        } catch (e) {
          console.error("[SpiritInstance] emotion update failed:", e?.message ?? e);
        }
      }

      if (policy.allow_write && this.episodeEngine) {
        try {
          await this.episodeEngine.writeEpisode({
            user_id: this.memory.userId,
            spiritkin_id,
            conversation_id,
            text: message,
            emotion: emotion || {},
          });
        } catch (e) {
          console.error("[SpiritInstance] episode write failed:", e?.message ?? e);
        }
      }

      if (policy.allow_write) {
        try {
          await this.memory.storeMemory({
            type: "interaction",
            content: message,
            spiritkin_id,
            conversation_id,
          });
        } catch (e) {
          console.error("[SpiritInstance] raw memory write failed:", e?.message ?? e);
        }
      }

      // 3) Stitch context (this may read even if writes are blocked)
      let stitched = null;
      if (this.contextStitcher) {
        try {
          stitched = await this.contextStitcher.buildContext({
            user_id: this.memory.userId,
            spiritkin_id,
            conversation_id,
            recentText: message,
          });

          // Apply policy caps to returned context (dev-friendly, future proof)
          if (stitched?.memories && Array.isArray(stitched.memories)) {
            stitched.memories = stitched.memories.slice(0, policy.max_memories ?? 5);
          }
          if (stitched?.episodes && Array.isArray(stitched.episodes)) {
            stitched.episodes = stitched.episodes.slice(0, policy.max_episodes ?? 5);
          }
        } catch (e) {
          console.error("[SpiritInstance] context stitch failed:", e?.message ?? e);
        }
      }

      // 4) Generate response using adapter pipeline (Phase 2)
      // If response engine fails, fall back to identity echo (never crash)
      let responseText = null;

      if (this.responseEngine && stitched) {
        try {
          // PHASE C CHANGE: Hardcoded Lyra identity removed.
          // Resolve canonical Spiritkin from registry if available;
          // fall back to a minimal stub with the provided id only.
          // Full registry wiring is completed when identityGovernor is injected
          // into SpiritInstance (Phase D runtime unification).
          let spiritkin;
          if (this.identityGovernor) {
            spiritkin = await this.identityGovernor.resolveOrFallback({ id: spiritkin_id });
          } else {
            // Transitional stub — no hardcoded name, id is preserved for DB writes
            spiritkin = { id: spiritkin_id, name: null, archetype: null, persona_json: {} };
          }

          const mood = { mood: stitched?.emotion?.label || "neutral", tone: spiritkin?.tone || "warm" };

          const adapterResult = await this.responseEngine.generate({
            spiritkin,
            userText: message,
            mood,
            memories: stitched?.memories || [],
            policy,
            context: stitched,
          });

          // support adapters that return {text, meta} or plain string
          responseText =
            typeof adapterResult === "string"
              ? adapterResult
              : (adapterResult?.text ?? null);

        } catch (e) {
          console.error("[SpiritInstance] responseEngine failed:", e?.message ?? e);
        }
      }

      if (!responseText) {
        responseText = this.identity.enforceIdentity(message);
      }

      eventBus.emitEvent("response", {
        userId: this.memory.userId,
        response: responseText,
        spiritkin_id,
        conversation_id,
        emotion: emotion || stitched?.emotion || null,
        context: stitched || null,
        policy,
        entitlements: ent,
      });
    } catch (err) {
      console.error("[SpiritInstance] handleInteraction crashed:", err?.message ?? err);

      eventBus.emitEvent("response", {
        userId: event?.userId,
        response: "Spirit: I hit an internal glitch but I'm still here.",
        spiritkin_id: event?.spiritkin_id ?? null,
        conversation_id: event?.conversation_id ?? null,
      });
    }
  }

  dispose() {
    eventBus.unsubscribe("interaction", this._handler);
  }
}
