function clamp01(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function sanitizeLabel(value, fallback = "conversation") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || fallback;
}

function numberOrDefault(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textScore(text, patterns = [], weight = 0.2) {
  const lower = String(text || "").toLowerCase();
  const hits = patterns.reduce((count, pattern) => count + (pattern.test(lower) ? 1 : 0), 0);
  return clamp01((hits * weight) + (hits ? 0.08 : 0), 0);
}

function topIntent(scores = {}) {
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);
  const [intent, confidence] = ranked[0] || ["casual_chat", 0.25];
  return { intent, confidence: Number(clamp01(confidence, 0.25).toFixed(3)), ranked };
}

function detectIntent({ message = "", emotion = null, recentConversation = [], sessionContext = {}, worldState = {} }) {
  const text = String(message || "");
  const lower = text.toLowerCase();
  const activeSurface = sanitizeLabel(sessionContext?.currentSurface || sessionContext?.activeSurface || "");
  const activeMode = sanitizeLabel(sessionContext?.currentMode || "");
  const emotionLabel = String(emotion?.label || emotion?.tone || emotion?.metadata_json?.label || "").toLowerCase();
  const activeGame = worldState?.flags?.active_game || null;
  const recentJoined = (Array.isArray(recentConversation) ? recentConversation : [])
    .slice(-4)
    .map((entry) => String(entry?.content || ""))
    .join(" ")
    .toLowerCase();
  const combined = `${lower} ${recentJoined}`.trim();

  const scores = {
    emotional_support: textScore(combined, [/\bi feel\b/, /\bhurt\b/, /\bsad\b/, /\bgrief\b/, /\blonely\b/, /\boverwhelm(ed|ing)?\b/, /\bneed support\b/, /\bi'm struggling\b/], 0.18),
    decision_help: textScore(combined, [/\bshould i\b/, /\bwhat should i do\b/, /\bdecide\b/, /\bwhich one\b/, /\bchoose\b/, /\bhelp me decide\b/], 0.22),
    confusion: textScore(combined, [/\bconfused\b/, /\bnot sure\b/, /\bdon't understand\b/, /\bunclear\b/, /\blost\b/, /\bwhat do you mean\b/], 0.22),
    storytelling: textScore(combined, [/\bstory\b/, /\btell me about\b/, /\bwhat happened\b/, /\bimagine\b/, /\blore\b/, /\bnarrative\b/], 0.18),
    gameplay: textScore(combined, [/\bmove\b/, /\bgame\b/, /\bplay\b/, /\bchess\b/, /\bcheckers\b/, /\bgo\b/, /\bconnect four\b/, /\bbattleship\b/, /\bspirit cards\b/], 0.22),
    journaling: textScore(combined, [/\bjournal\b/, /\bwrite this down\b/, /\breflect\b/, /\breflection\b/, /\brecord this\b/, /\bnote this\b/], 0.22),
    exploration: textScore(combined, [/\bexplore\b/, /\bcurious\b/, /\bwhat if\b/, /\bshow me\b/, /\bmore about\b/, /\bwonder\b/], 0.18),
    practical_help: textScore(combined, [/\bhow do i\b/, /\bplan\b/, /\bsteps\b/, /\bpractical\b/, /\bhelp me with\b/, /\bworkflow\b/, /\bfix\b/], 0.18),
    casual_chat: textScore(combined, [/\bhello\b/, /\bhey\b/, /\bwhat's up\b/, /\bhow are you\b/, /\bjust checking in\b/, /\bhang out\b/], 0.16),
    distress_signal: textScore(combined, [/\bpanic\b/, /\bcan't do this\b/, /\bunsafe\b/, /\bcrisis\b/, /\bi want to disappear\b/, /\bi can't go on\b/, /\bhopeless\b/], 0.3),
  };

  if (/crisis|panic|unsafe|hopeless/.test(emotionLabel)) scores.distress_signal = Math.max(scores.distress_signal, 0.72);
  if (activeGame?.status === "active" || activeSurface === "games" || activeMode === "game") scores.gameplay += 0.24;
  if (activeSurface === "journal") scores.journaling += 0.18;
  if (activeSurface === "events") scores.exploration += 0.12;
  if (!text.trim()) scores.casual_chat = Math.max(scores.casual_chat, 0.3);

  return topIntent(scores);
}

function detectTone({ intent, adaptiveProfile = null, emotion = null, sessionContext = {}, message = "" }) {
  const lower = String(message || "").toLowerCase();
  const tonePreference = String(adaptiveProfile?.tone_preference || adaptiveProfile?.toneStyle || "").toLowerCase();
  const responseStyle = String(adaptiveProfile?.response_style || "").toLowerCase();
  const depthLevel = String(adaptiveProfile?.depth_level || "").toLowerCase();
  const emotionLabel = String(emotion?.label || emotion?.tone || emotion?.metadata_json?.label || "").toLowerCase();

  if (intent === "distress_signal") return "grounding";
  if (intent === "gameplay" && (tonePreference === "playful" || /\b(joke|banter|trash talk|lol)\b/.test(lower))) return "playful";
  if (intent === "decision_help" || intent === "practical_help") return responseStyle === "concise" ? "concise" : "direct";
  if (intent === "confusion") return responseStyle === "concise" ? "concise" : "grounding";
  if (intent === "journaling" || intent === "storytelling") return depthLevel === "deep" ? "deep" : "reflective";
  if (intent === "emotional_support" && /grief|hurt|sad|lonely|fear|overwhelm/.test(emotionLabel)) return "gentle";
  if (tonePreference === "playful") return "playful";
  if (responseStyle === "concise") return "concise";
  if (depthLevel === "deep") return "deep";
  return tonePreference === "direct" ? "direct" : "reflective";
}

function selectNextSurface({ intent, sessionContext = {}, worldState = {}, adaptiveProfile = null }) {
  const activeSurface = sanitizeLabel(sessionContext?.currentSurface || sessionContext?.activeSurface || "");
  const currentGame = worldState?.flags?.active_game || null;
  const reduceClutter = Boolean(worldState?.flags?.spiritcore_surface_priority?.reduceClutter);
  const concise = adaptiveProfile?.response_style === "concise";

  if (intent === "distress_signal") return "rest";
  if (intent === "gameplay") return currentGame?.status === "active" ? "games" : "games";
  if (intent === "journaling") return "journal";
  if (intent === "exploration" && activeSurface !== "events") return "events";
  if (intent === "decision_help" || intent === "practical_help") return concise ? "conversation" : "profile";
  if (intent === "confusion") return "conversation";
  if (reduceClutter) return "conversation";
  return activeSurface === "selection" ? "conversation" : (activeSurface || "conversation");
}

function buildSuggestedAction({ intent, nextSurface, adaptiveProfile = null }) {
  const concise = adaptiveProfile?.response_style === "concise";
  if (intent === "distress_signal") return "stabilize-and-reduce-pressure";
  if (intent === "gameplay") return nextSurface === "games" ? "continue-active-game" : "open-games-surface";
  if (intent === "journaling") return "offer-reflection-or-journal-entry";
  if (intent === "decision_help") return concise ? "give-clear-next-step" : "compare-options-cleanly";
  if (intent === "confusion") return "clarify-one-point-at-a-time";
  if (intent === "practical_help") return "provide-steps";
  if (intent === "exploration") return "invite-curiosity";
  if (intent === "emotional_support") return "stay-present-and-ground";
  return "continue-conversation";
}

function buildResponseDirective({ intent, tone, adaptiveProfile = null, worldState = {} }) {
  const concise = adaptiveProfile?.response_style === "concise";
  const worldMood = String(worldState?.scene?.mood || "steady");
  if (intent === "distress_signal") return "Prioritize stabilization, brevity, and immediate safety-aware grounding over exploration.";
  if (intent === "gameplay") return "Keep the reply concise, in-world, and oriented to the active game turn or next shared move.";
  if (intent === "decision_help") return concise
    ? "Name the cleanest next move directly, then give one short reason."
    : "Clarify the tradeoff, recommend a next move, and avoid over-expanding.";
  if (intent === "confusion") return "Reduce ambiguity, answer the core confusion first, and avoid layered abstractions.";
  if (intent === "journaling") return "Favor reflective language, continuity, and one clear invitation deeper if helpful.";
  if (intent === "practical_help") return "Be concrete, stepwise, and outcome-aware.";
  if (intent === "emotional_support") return `Stay ${tone}, relational, and emotionally precise while matching the current world mood of ${worldMood}.`;
  return "Stay canon-consistent, specific to the user's message, and naturally steer toward the clearest next thread.";
}

function derivePriority(intent, fallback = "medium") {
  const map = {
    distress_signal: "urgent",
    emotional_support: "high",
    confusion: "high",
    decision_help: "high",
    practical_help: "medium",
    journaling: "medium",
    exploration: "medium",
    storytelling: "medium",
    gameplay: "medium",
    casual_chat: "low",
  };
  return map[intent] || fallback;
}

function deriveMemoryPriority({ intent, weightedMemories = [], recentConversation = [] }) {
  if (intent === "gameplay") return "light";
  if (intent === "distress_signal") return "bounded";
  if ((Array.isArray(weightedMemories) ? weightedMemories.length : 0) > 0 || (Array.isArray(recentConversation) ? recentConversation.length : 0) > 2) {
    return intent === "emotional_support" || intent === "journaling" ? "high" : "medium";
  }
  return "light";
}

export function createGuidanceService() {
  function buildGuidance({
    message,
    adaptiveProfile = null,
    emotion = null,
    weightedMemories = [],
    recentConversation = [],
    worldState = {},
    sessionContext = {},
  }) {
    const { intent, confidence } = detectIntent({
      message,
      emotion,
      recentConversation,
      sessionContext,
      worldState,
    });
    const tone = detectTone({
      intent,
      adaptiveProfile,
      emotion,
      sessionContext,
      message,
    });
    const next_surface = selectNextSurface({
      intent,
      sessionContext,
      worldState,
      adaptiveProfile,
    });
    const suggested_action = buildSuggestedAction({
      intent,
      nextSurface: next_surface,
      adaptiveProfile,
    });
    const emotional_priority = derivePriority(intent);
    const memory_priority = deriveMemoryPriority({
      intent,
      weightedMemories,
      recentConversation,
    });
    const world_mood = String(worldState?.scene?.mood || worldState?.flags?.spiritcore_world_hooks?.worldMoodContext || "steady");
    const safety_note = intent === "distress_signal"
      ? "favor-grounding-and-safe-containment"
      : intent === "emotional_support"
        ? "keep-pressure-low"
        : "none";
    const should_prompt_user = ["confusion", "decision_help", "journaling", "exploration"].includes(intent);

    return {
      intent,
      confidence,
      tone,
      response_directive: buildResponseDirective({ intent, tone, adaptiveProfile, worldState }),
      next_surface,
      suggested_action,
      emotional_priority,
      memory_priority,
      world_mood,
      safety_note,
      should_prompt_user,
    };
  }

  return { buildGuidance };
}
