import Scheduler from "./scheduler.mjs";
import SpiritInstance from "./spiritInstance.mjs";
import eventBus from "./eventBus.mjs";

import ContextResolver from "./contextResolver.mjs";
import EmotionEngine from "./emotionEngine.mjs";
import EpisodeEngine from "./episodeEngine.mjs";
import ContextStitcher from "./contextStitcher.mjs";
import MemoryEngine from "./memoryEngine.mjs";

import EntitlementsEngine from "./entitlementsEngine.mjs";
import ResponseEngine from "./responseEngine.mjs";

export default class RuntimeController {
  constructor(supabase, config = {}) {
    this.supabase = supabase;
    this.config = {
      useLLM: !!config.useLLM,
      debug: !!config.debug,
    };

    this.scheduler = new Scheduler(1000);
    this.instances = new Map();
    this.started = false;

    // Phase 1 engines
    this.contextResolver = new ContextResolver(supabase); // ✅ FIXED NAME
    this.emotionEngine = new EmotionEngine(supabase);
    this.episodeEngine = new EpisodeEngine(supabase);

    this.contextStitcher = new ContextStitcher({
      memoryEngineFactory: (userId) => new MemoryEngine(this.supabase, userId),
      emotionEngine: this.emotionEngine,
      episodeEngine: this.episodeEngine,
    });

    // Phase 2 engines
    this.entitlementsEngine = new EntitlementsEngine(supabase);
    this.responseEngine = new ResponseEngine({ useLLM: this.config.useLLM });
  }

  createSpirit(userId, profile) {
    if (!userId) throw new Error("RuntimeController.createSpirit: userId required");
    if (this.instances.has(userId)) return this.instances.get(userId);

    const spirit = new SpiritInstance(profile, this.supabase, userId, {
      // Phase 1
      emotionEngine: this.emotionEngine,
      episodeEngine: this.episodeEngine,
      contextStitcher: this.contextStitcher,

      // Phase 2
      entitlementsEngine: this.entitlementsEngine,
      responseEngine: this.responseEngine,
    });

    this.instances.set(userId, spirit);
    return spirit;
  }

  removeSpirit(userId) {
    const spirit = this.instances.get(userId);
    if (spirit) spirit.dispose?.();
    this.instances.delete(userId);
  }

  start() {
    if (this.started) return;
    this.started = true;

    this.scheduler.addTask(() => {
      eventBus.emitEvent("heartbeat", { time: Date.now() });
    });

    this.scheduler.start();
  }

  stop() {
    this.scheduler.stop();
    this.started = false;
  }

  async resolveContextByConversation(conversation_id) {
    return this.contextResolver.resolveByConversation(conversation_id);
  }

  async stitchContext({ user_id, spiritkin_id, conversation_id, recentText }) {
    return this.contextStitcher.buildContext({ user_id, spiritkin_id, conversation_id, recentText });
  }
}
