import { nowIso } from "../utils/time.mjs";
import { toUuid } from "../utils/id.mjs";
import { buildSpiritCoreAmbientFoundation } from "./spiritCoreAmbientService.mjs";

function clamp01(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function numberOrDefault(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeText(value, limit = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function average(values = [], fallback = 0) {
  const cleaned = values.filter((value) => Number.isFinite(value));
  if (!cleaned.length) return fallback;
  return cleaned.reduce((sum, value) => sum + value, 0) / cleaned.length;
}

function normalizeAdaptiveProfile(raw = {}) {
  return {
    tone_preference: typeof raw?.tone_preference === "string" && raw.tone_preference.trim()
      ? raw.tone_preference.trim()
      : "grounded",
    depth_level: typeof raw?.depth_level === "string" && raw.depth_level.trim()
      ? raw.depth_level.trim()
      : "balanced",
    response_style: typeof raw?.response_style === "string" && raw.response_style.trim()
      ? raw.response_style.trim()
      : "balanced",
    emotional_expression: typeof raw?.emotional_expression === "string" && raw.emotional_expression.trim()
      ? raw.emotional_expression.trim()
      : "warm",
    toneStyle: typeof raw?.toneStyle === "string" && raw.toneStyle.trim() ? raw.toneStyle.trim() : "grounded",
    intensity: clamp01(raw?.intensity, 0.45),
    playfulness: clamp01(raw?.playfulness, 0.3),
    competitiveness: clamp01(raw?.competitiveness, 0.3),
    repetitionSensitivity: clamp01(raw?.repetitionSensitivity, 0.25),
    respectPreference: clamp01(raw?.respectPreference, 0.5),
    spiritualityPreference: clamp01(raw?.spiritualityPreference, 0.25),
    styleModel: raw?.styleModel && typeof raw.styleModel === "object"
      ? {
          formality: clamp01(raw.styleModel.formality, 0.48),
          casualness: clamp01(raw.styleModel.casualness, 0.34),
          emotionalHeaviness: clamp01(raw.styleModel.emotionalHeaviness, 0.3),
          directness: clamp01(raw.styleModel.directness, 0.46),
          verbosity: clamp01(raw.styleModel.verbosity, 0.44),
          playfulness: clamp01(raw.styleModel.playfulness, 0.32),
        }
      : {
          formality: 0.48,
          casualness: 0.34,
          emotionalHeaviness: 0.3,
          directness: 0.46,
          verbosity: 0.44,
          playfulness: 0.32,
        },
    styleMemory: raw?.styleMemory && typeof raw.styleMemory === "object"
      ? {
          prefersConciseReplies: Boolean(raw.styleMemory.prefersConciseReplies),
          prefersPlayfulTone: Boolean(raw.styleMemory.prefersPlayfulTone),
          prefersWarmth: raw.styleMemory.prefersWarmth === false ? false : true,
          prefersStructuredClarity: Boolean(raw.styleMemory.prefersStructuredClarity),
          usesCasualLanguage: Boolean(raw.styleMemory.usesCasualLanguage),
          prefersDirectness: Boolean(raw.styleMemory.prefersDirectness),
        }
      : {
          prefersConciseReplies: false,
          prefersPlayfulTone: false,
          prefersWarmth: true,
          prefersStructuredClarity: false,
          usesCasualLanguage: false,
          prefersDirectness: false,
        },
    preferenceSummary: Array.isArray(raw?.preferenceSummary) ? raw.preferenceSummary.filter(Boolean).slice(-8) : [],
    correctionFlags: raw?.correctionFlags && typeof raw.correctionFlags === "object"
      ? {
          avoidRepetition: Boolean(raw.correctionFlags.avoidRepetition),
          avoidNarration: Boolean(raw.correctionFlags.avoidNarration),
          avoidProfanity: Boolean(raw.correctionFlags.avoidProfanity),
          avoidTeasing: Boolean(raw.correctionFlags.avoidTeasing),
        }
      : {
          avoidRepetition: false,
          avoidNarration: false,
          avoidProfanity: false,
          avoidTeasing: false,
        },
    dislikedPhrases: Array.isArray(raw?.dislikedPhrases) ? raw.dislikedPhrases.filter(Boolean).slice(-8) : [],
    blockedOpeners: Array.isArray(raw?.blockedOpeners) ? raw.blockedOpeners.filter(Boolean).slice(-6) : [],
    recentCorrections: Array.isArray(raw?.recentCorrections) ? raw.recentCorrections.filter(Boolean).slice(-6) : [],
  };
}

function buildPromptForSpiritkin(name = "") {
  const prompts = {
    Lyra: "What feels true in you right now, even if it is quiet?",
    Raien: "What needs to move, even if part of you is resisting it?",
    Kairo: "What pattern or possibility are you trying to see more clearly?",
    Elaria: "What truth needs to be named cleanly right now?",
    Thalassar: "What are you sensing underneath the first thing you want to say?",
  };
  return prompts[name] || "What feels most real for you right now?";
}

function getRecentUserText(recentMessages = []) {
  return recentMessages
    .filter((message) => message?.role === "user" && message?.content)
    .slice(-3)
    .map((message) => String(message.content).trim())
    .join(" ");
}

function deriveTextSignals(text = "") {
  const lower = String(text || "").toLowerCase();
  if (!lower.trim()) {
    return {
      appreciation: 0.18,
      sadness: 0.1,
      playfulness: 0.16,
      focus: 0.22,
      avoidance: 0.08,
      overwhelm: 0.08,
      exploration: 0.18,
      bonding: 0.18,
      openness: 0.18,
    };
  }

  const score = (patterns, bonus = 0.18) => {
    const hits = patterns.reduce((count, pattern) => count + (pattern.test(lower) ? 1 : 0), 0);
    if (!hits) return 0;
    return clamp01((hits * bonus) + 0.1, 0);
  };

  return {
    appreciation: score([/\bthank(s| you)\b/, /\bappreciate\b/, /\bglad\b/, /\bthat helped\b/, /\bi needed that\b/], 0.22),
    sadness: score([/\bsad\b/, /\bgrief\b/, /\bhurting\b/, /\blonely\b/, /\bheavy\b/, /\bexhausted\b/, /\boverwhelmed\b/], 0.16),
    playfulness: score([/\blol\b/, /\bhaha\b/, /\bfunny\b/, /\bbanter\b/, /\btease\b/, /\bplay\b/], 0.18),
    focus: score([/\bneed\b/, /\bhelp me\b/, /\bwhat do i do\b/, /\bplan\b/, /\bclarity\b/, /\bnext\b/, /\bhow\b/], 0.15),
    avoidance: score([/\bmaybe\b/, /\bi don't know\b/, /\bnot sure\b/, /\blater\b/, /\bskip\b/, /\bavoid\b/], 0.14),
    overwhelm: score([/\btoo much\b/, /\boverwhelm(ed|ing)?\b/, /\bclutter(ed)?\b/, /\bslow down\b/, /\bconfused\b/], 0.2),
    exploration: score([/\bcurious\b/, /\bexplore\b/, /\bwhat if\b/, /\bwonder\b/, /\bshow me\b/, /\bperspective\b/], 0.18),
    bonding: score([/\bstay with me\b/, /\bi need you\b/, /\bwith you\b/, /\bbond\b/, /\bfeel seen\b/, /\bi trust\b/], 0.2),
    openness: score([/\bi feel\b/, /\bi'm feeling\b/, /\btruth\b/, /\bhonest\b/, /\bopen\b/, /\breal\b/], 0.16),
  };
}

function deriveContextSignals({ requestContext = {}, recentMessages = [], worldState = {}, currentGame = null }) {
  const adaptive = normalizeAdaptiveProfile(requestContext?.adaptiveProfile || {});
  const recentUserText = getRecentUserText(recentMessages);
  const sourceText = [requestContext?.recentText || "", recentUserText].filter(Boolean).join(" ");
  const textSignals = deriveTextSignals(sourceText);
  const emotion = requestContext?.emotion || requestContext?.emotionState || {};
  const emotionMeta = emotion?.metadata_json || {};
  const emotionLabel = String(emotion?.label || emotion?.tone || emotionMeta?.label || "").toLowerCase();
  const emotionIntensity = clamp01(emotionMeta?.intensity, adaptive.intensity);
  const currentMood = String(worldState?.scene?.mood || "peaceful").toLowerCase();
  const activeGameType = currentGame?.type || requestContext?.surfaceContext?.activeGameType || null;

  return {
    appreciation: clamp01(textSignals.appreciation + (adaptive.respectPreference * 0.18)),
    sadness: clamp01(textSignals.sadness + (/sad|grief|heavy|hurt|alone/.test(emotionLabel) ? 0.24 : 0)),
    playfulness: clamp01(textSignals.playfulness + (adaptive.playfulness * 0.48)),
    focus: clamp01(textSignals.focus + (adaptive.intensity * 0.18) + (activeGameType ? 0.1 : 0)),
    avoidance: clamp01(textSignals.avoidance + (adaptive.repetitionSensitivity * 0.12)),
    overwhelm: clamp01(textSignals.overwhelm + (adaptive.repetitionSensitivity * 0.34) + (emotionIntensity > 0.72 ? 0.16 : 0)),
    exploration: clamp01(textSignals.exploration + ((currentMood === "expansive" || currentMood === "hopeful") ? 0.12 : 0)),
    bonding: clamp01(textSignals.bonding + (textSignals.openness * 0.4) + (adaptive.respectPreference * 0.12)),
    openness: clamp01(textSignals.openness + (emotionIntensity > 0.55 ? 0.1 : 0)),
  };
}

function pickInteractionStyle(profile, signals) {
  if (profile.spiritualityPreference > 0.68) return "reverent";
  if (signals.playfulness > 0.62 && profile.competitiveness > 0.52) return "playful-competitive";
  if (signals.playfulness > 0.58) return "playful";
  if (signals.focus > 0.62 && signals.sadness < 0.34) return "direct";
  if (signals.bonding > 0.52 || signals.sadness > 0.4) return "reflective";
  return "grounded";
}

function pickEmotionalInteractionStyle(signals) {
  if (signals.sadness > 0.54 || signals.bonding > 0.58) return "emotionally open";
  if (signals.focus > 0.62 && signals.playfulness < 0.4) return "goal-seeking";
  if (signals.playfulness > 0.6) return "playful contact";
  if (signals.avoidance > 0.42 || signals.overwhelm > 0.42) return "guarded / overloaded";
  return "balanced";
}

function pickEngagementDepth({ worldState = {}, recentMessages = [] }) {
  const bondStage = Number(worldState?.bond?.stage ?? 0);
  const interactions = Number(worldState?.bond?.interaction_count ?? 0);
  const messageCount = recentMessages.length;
  const score = average([
    clamp01(bondStage / 4, 0),
    clamp01(interactions / 40, 0),
    clamp01(messageCount / 24, 0),
  ], 0);
  if (score > 0.72) return "deep";
  if (score > 0.42) return "growing";
  return "early";
}

function pickWorldPreference(spiritkinIdentity, worldState = {}) {
  if (spiritkinIdentity?.name) return spiritkinIdentity.name;
  return String(worldState?.scene?.display_name || worldState?.scene?.name || "Spiritverse");
}

function deriveReturnBehavior(engagement = {}) {
  const lastSessionAt = engagement?.lastSessionAt || null;
  if (!lastSessionAt) return { cadence: "new", hoursAway: null };
  const hoursAway = Math.max(0, (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60));
  const cadence = hoursAway > 72 ? "returning-long" : hoursAway > 24 ? "returning-medium" : "returning-short";
  return { cadence, hoursAway: Number(hoursAway.toFixed(2)) };
}

function deriveUserModel({
  spiritkinIdentity,
  worldState = {},
  recentMessages = [],
  unifiedAdaptiveProfile,
  signals,
  engagement = {},
  currentMode = "idle",
}) {
  const bondStage = Number(worldState?.bond?.stage ?? 0);
  const interactionCount = Number(worldState?.bond?.interaction_count ?? 0);
  const returnBehavior = deriveReturnBehavior(engagement);
  const favoredSpiritkins = spiritkinIdentity?.name ? [spiritkinIdentity.name] : [];
  const overwhelmSensitivity = clamp01(
    (unifiedAdaptiveProfile.repetitionSensitivity * 0.48) +
    (signals.overwhelm * 0.34) +
    (signals.avoidance * 0.18)
  );
  const pacingTolerance = clamp01(
    1 - ((overwhelmSensitivity * 0.56) + (signals.sadness * 0.12)),
    0.48
  );
  const guidanceReceptivity = clamp01(
    0.34 +
    (signals.focus * 0.24) +
    (signals.exploration * 0.18) +
    (interactionCount > 2 ? 0.08 : 0) -
    (signals.avoidance * 0.16)
  );
  const currentMoodContext = signals.sadness > 0.54
    ? "heavy"
    : signals.playfulness > 0.58
      ? "light / playful"
      : signals.focus > 0.58
        ? "goal-seeking"
        : signals.exploration > 0.52
          ? "curious"
          : String(worldState?.scene?.mood || "steady");

  return {
    interactionStylePreference: pickInteractionStyle(unifiedAdaptiveProfile, signals),
    favoredSpiritkins,
    guidanceReceptivity: Number(guidanceReceptivity.toFixed(3)),
    pacingTolerance: Number(pacingTolerance.toFixed(3)),
    overwhelmSensitivity: Number(overwhelmSensitivity.toFixed(3)),
    emotionalInteractionStyle: pickEmotionalInteractionStyle(signals),
    engagementDepth: pickEngagementDepth({ worldState, recentMessages }),
    returnBehavior,
    worldDomainPreference: pickWorldPreference(spiritkinIdentity, worldState),
    currentMoodContext,
    currentMode,
    bondStage,
    interactionCount,
  };
}

function buildSurfacePriority({ currentGame, currentSurface, currentMode, userModel, signals, hasConversation }) {
  const weights = {
    conversation: 0.36 + (signals.bonding * 0.24) + (signals.sadness * 0.18) + (hasConversation ? 0.08 : -0.06),
    games: 0.2 + (signals.playfulness * 0.24) + (signals.focus * 0.12) + (currentGame?.status === "active" ? 0.7 : 0),
    journal: 0.16 + (signals.bonding * 0.16) + (signals.sadness * 0.18) + (signals.overwhelm > 0.45 ? 0.08 : 0),
    events: 0.14 + (signals.exploration * 0.2) - (signals.overwhelm * 0.14),
    bonding: 0.18 + (!hasConversation ? 0.18 : 0) + (signals.bonding * 0.16),
    quests: 0.12 + (signals.focus * 0.18) - (signals.overwhelm * 0.1),
    world: 0.14 + (signals.exploration * 0.22) + (signals.appreciation * 0.08),
  };

  if (currentSurface && weights[currentSurface] !== undefined) {
    weights[currentSurface] += 0.08;
  }
  if (currentMode === "game") weights.games += 0.2;
  if (userModel.overwhelmSensitivity > 0.55) {
    weights.events -= 0.1;
    weights.quests -= 0.08;
  }

  const ranked = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .map(([surface, score]) => ({ surface, score: Number(score.toFixed(3)) }));

  return {
    primary: ranked[0]?.surface || "conversation",
    secondary: ranked[1]?.surface || "journal",
    ranked,
    reduceClutter: userModel.overwhelmSensitivity > 0.52 || signals.overwhelm > 0.48,
    reason: userModel.overwhelmSensitivity > 0.52
      ? "Reduce simultaneous prompts and keep the next move obvious."
      : ranked[0]?.surface === "games"
        ? "Shared action is the clearest current momentum."
        : ranked[0]?.surface === "journal"
          ? "Reflection is more useful than another prompt-heavy step right now."
          : "Conversation remains the strongest continuity thread.",
  };
}

function buildGuidanceActions({ spiritkinName, hasConversation, currentGame, surfacePriority }) {
  const prompt = buildPromptForSpiritkin(spiritkinName);
  if (currentGame?.status === "active") {
    return [
      { action: "expand-game", label: "Focus the game" },
      { action: "set-presence-tab", tab: "profile", label: "Back to profile" },
    ];
  }
  if (!hasConversation && spiritkinName) {
    return [
      { action: "begin", label: `Begin with ${spiritkinName}` },
      { action: "open-games-hub", label: "Open games" },
    ];
  }
  if (surfacePriority.primary === "games") {
    return [
      { action: "set-presence-tab", tab: "games", label: "Open games" },
      { action: "prompt", prompt, label: "Stay in conversation" },
    ];
  }
  if (surfacePriority.primary === "journal") {
    return [
      { action: "set-presence-tab", tab: "journal", label: "Open bond journal" },
      { action: "prompt", prompt, label: "Keep talking" },
    ];
  }
  if (surfacePriority.primary === "events") {
    return [
      { action: "set-presence-tab", tab: "events", label: "Open realm events" },
      { action: "prompt", prompt, label: "Ask a real question" },
    ];
  }
  return [
    { action: "prompt", prompt, label: "Ask a real question" },
    { action: "set-presence-tab", tab: "games", label: "Open games" },
  ];
}

function buildGuidance({ spiritkinIdentity, hasConversation, currentGame, userModel, signals, surfacePriority }) {
  const spiritkinName = spiritkinIdentity?.name || null;

  if (currentGame?.status === "active") {
    return {
      label: "SpiritCore guidance",
      title: `Stay with ${currentGame.name || "the game"} until the board settles.`,
      text: "Keep the board primary for this moment. Reflection can follow after the move resolves cleanly.",
      actions: buildGuidanceActions({ spiritkinName, hasConversation, currentGame, surfacePriority }),
      foregroundSurface: "games",
      reduceClutter: true,
    };
  }

  if (!spiritkinName) {
    return {
      label: "SpiritCore guidance",
      title: "Meet a founder before you commit the bond.",
      text: "Preview deliberately. Choose the presence that stays steady when you imagine returning to it repeatedly.",
      actions: [],
      foregroundSurface: "bonding",
      reduceClutter: false,
    };
  }

  if (!hasConversation) {
    return {
      label: "SpiritCore guidance",
      title: `${spiritkinName} is in view. Open the first live channel cleanly.`,
      text: "Begin conversation when you want presence. If shared motion feels easier than words, open games first and let the bond form through action.",
      actions: buildGuidanceActions({ spiritkinName, hasConversation, currentGame, surfacePriority }),
      foregroundSurface: "conversation",
      reduceClutter: false,
    };
  }

  if (surfacePriority.reduceClutter && (signals.overwhelm > 0.42 || userModel.overwhelmSensitivity > 0.52)) {
    return {
      label: "SpiritCore guidance",
      title: "Keep the next step singular.",
      text: "Reduce the number of competing surfaces. Stay with one thread: either continue the conversation or move into the journal for quieter reflection.",
      actions: buildGuidanceActions({ spiritkinName, hasConversation, currentGame, surfacePriority }),
      foregroundSurface: surfacePriority.primary,
      reduceClutter: true,
    };
  }

  if (surfacePriority.primary === "games") {
    return {
      label: "SpiritCore guidance",
      title: "Shared action is carrying more momentum than another text turn.",
      text: "Use the game surface if you want cleaner movement, visible turns, and lighter pacing before returning to reflection.",
      actions: buildGuidanceActions({ spiritkinName, hasConversation, currentGame, surfacePriority }),
      foregroundSurface: "games",
      reduceClutter: false,
    };
  }

  if (surfacePriority.primary === "journal") {
    return {
      label: "SpiritCore guidance",
      title: "Reflection is the stronger next move right now.",
      text: "Open the bond journal if you want continuity and quieter meaning. Return to chat when you want the next exchange to build from that footing.",
      actions: buildGuidanceActions({ spiritkinName, hasConversation, currentGame, surfacePriority }),
      foregroundSurface: "journal",
      reduceClutter: true,
    };
  }

  return {
    label: "SpiritCore guidance",
    title: `Keep the live bond with ${spiritkinName} centered.`,
    text: signals.sadness > 0.45
      ? "Stay with presence before expanding the surface stack. A grounded conversation is likely to serve you better than extra noise."
      : "Conversation is still the strongest continuity thread. Branch into games, journal, or events only when it adds something real.",
    actions: buildGuidanceActions({ spiritkinName, hasConversation, currentGame, surfacePriority }),
    foregroundSurface: "conversation",
    reduceClutter: false,
  };
}

function buildReturnPackage({ spiritkinIdentity, recentMessages = [], currentGame = null, userModel, surfacePriority, engagement = {}, worldState = {} }) {
  const resumeMessage = [...recentMessages].reverse().find((message) => message?.role === "user" && message?.content)?.content || "";
  const highlight = currentGame?.status === "active"
    ? `${currentGame.name || currentGame.type} is still active.`
    : sanitizeText(worldState?.bond?.last_milestone || engagement?.whisper || resumeMessage || worldState?.scene?.description || "", 140);
  const bestReentryPath = currentGame?.status === "active"
    ? "games"
    : surfacePriority.primary;
  const suppress = [];
  if (surfacePriority.reduceClutter) suppress.push("events", "quests");
  if (userModel.overwhelmSensitivity > 0.55) suppress.push("extra-prompts");

  return {
    lastCaredAbout: sanitizeText(resumeMessage || worldState?.bond?.last_milestone || "", 140) || null,
    stillMattersNow: sanitizeText(highlight, 140) || null,
    resumeTarget: bestReentryPath,
    bestReentryPath,
    suppress,
    highlight: sanitizeText(highlight, 140) || `${spiritkinIdentity?.name || "Your bond"} still has continuity waiting.`,
    quietResume: surfacePriority.reduceClutter,
  };
}

function buildWorldHooks({ spiritkinIdentity, worldState = {}, signals, surfacePriority, userModel }) {
  const moodEmphasis = signals.sadness > 0.48
    ? "soothing"
    : signals.playfulness > 0.58
      ? "lively"
      : signals.exploration > 0.52
        ? "expansive"
        : signals.focus > 0.55
          ? "clarifying"
          : "steady";

  const chamberEmphasis = spiritkinIdentity?.name === "Lyra"
    ? "veil-stillness"
    : spiritkinIdentity?.name === "Raien"
      ? "citadel-charge"
      : spiritkinIdentity?.name === "Kairo"
        ? "observatory-expansion"
        : spiritkinIdentity?.name === "Elaria"
          ? "archive-clarity"
          : spiritkinIdentity?.name === "Thalassar"
            ? "abyssal-depth"
            : String(worldState?.scene?.name || "spiritverse");

  return {
    chamberEmphasis,
    moodEmphasis,
    surfacedActivity: surfacePriority.primary,
    revealPacing: userModel.overwhelmSensitivity > 0.55 ? "quiet" : signals.exploration > 0.52 ? "inviting" : "steady",
    promptCadence: userModel.guidanceReceptivity > 0.62 && userModel.overwhelmSensitivity < 0.42 ? "medium" : "low",
    clutterReduction: surfacePriority.reduceClutter,
    worldMoodContext: String(worldState?.scene?.mood || "peaceful"),
  };
}

function mergeStoredAdaptiveProfile(stored = {}, generated = {}) {
    const base = normalizeAdaptiveProfile(stored);
    const incoming = normalizeAdaptiveProfile(generated);
    return {
      ...base,
      tone_preference: incoming.tone_preference || base.tone_preference,
      depth_level: incoming.depth_level || base.depth_level,
      response_style: incoming.response_style || base.response_style,
      emotional_expression: incoming.emotional_expression || base.emotional_expression,
      toneStyle: incoming.toneStyle || base.toneStyle,
    intensity: Number(average([base.intensity, incoming.intensity], base.intensity).toFixed(3)),
    playfulness: Number(average([base.playfulness, incoming.playfulness], base.playfulness).toFixed(3)),
    competitiveness: Number(average([base.competitiveness, incoming.competitiveness], base.competitiveness).toFixed(3)),
    repetitionSensitivity: Number(Math.max(base.repetitionSensitivity, incoming.repetitionSensitivity).toFixed(3)),
    respectPreference: Number(Math.max(base.respectPreference, incoming.respectPreference).toFixed(3)),
    spiritualityPreference: Number(Math.max(base.spiritualityPreference, incoming.spiritualityPreference).toFixed(3)),
    styleModel: {
      formality: Number(average([base.styleModel.formality, incoming.styleModel.formality], base.styleModel.formality).toFixed(3)),
      casualness: Number(average([base.styleModel.casualness, incoming.styleModel.casualness], base.styleModel.casualness).toFixed(3)),
      emotionalHeaviness: Number(average([base.styleModel.emotionalHeaviness, incoming.styleModel.emotionalHeaviness], base.styleModel.emotionalHeaviness).toFixed(3)),
      directness: Number(average([base.styleModel.directness, incoming.styleModel.directness], base.styleModel.directness).toFixed(3)),
      verbosity: Number(average([base.styleModel.verbosity, incoming.styleModel.verbosity], base.styleModel.verbosity).toFixed(3)),
      playfulness: Number(average([base.styleModel.playfulness, incoming.styleModel.playfulness], base.styleModel.playfulness).toFixed(3)),
    },
    styleMemory: {
      prefersConciseReplies: base.styleMemory.prefersConciseReplies || incoming.styleMemory.prefersConciseReplies,
      prefersPlayfulTone: base.styleMemory.prefersPlayfulTone || incoming.styleMemory.prefersPlayfulTone,
      prefersWarmth: base.styleMemory.prefersWarmth || incoming.styleMemory.prefersWarmth,
      prefersStructuredClarity: base.styleMemory.prefersStructuredClarity || incoming.styleMemory.prefersStructuredClarity,
      usesCasualLanguage: base.styleMemory.usesCasualLanguage || incoming.styleMemory.usesCasualLanguage,
      prefersDirectness: base.styleMemory.prefersDirectness || incoming.styleMemory.prefersDirectness,
    },
    preferenceSummary: [...new Set([...(base.preferenceSummary || []), ...(incoming.preferenceSummary || [])])].slice(-8),
    correctionFlags: {
      avoidRepetition: base.correctionFlags.avoidRepetition || incoming.correctionFlags.avoidRepetition,
      avoidNarration: base.correctionFlags.avoidNarration || incoming.correctionFlags.avoidNarration,
      avoidProfanity: base.correctionFlags.avoidProfanity || incoming.correctionFlags.avoidProfanity,
      avoidTeasing: base.correctionFlags.avoidTeasing || incoming.correctionFlags.avoidTeasing,
    },
    dislikedPhrases: [...new Set([...(base.dislikedPhrases || []), ...(incoming.dislikedPhrases || [])])].slice(-10),
    blockedOpeners: [...new Set([...(base.blockedOpeners || []), ...(incoming.blockedOpeners || [])])].slice(-8),
    recentCorrections: [...new Set([...(base.recentCorrections || []), ...(incoming.recentCorrections || [])])].slice(-8),
  };
}

function buildStructuredMemoryAdaptiveProfile(structured = {}) {
  const preferences = Array.isArray(structured?.preferences) ? structured.preferences : [];
  const corrections = Array.isArray(structured?.corrections) ? structured.corrections : [];
  const content = preferences.map((entry) => String(entry?.content || "").toLowerCase());
  const correctionContent = corrections.map((entry) => String(entry?.content || "").toLowerCase());
  return normalizeAdaptiveProfile({
    toneStyle: content.some((entry) => entry.includes("spiritual") || entry.includes("faith")) ? "reverent" : "grounded",
    playfulness: content.some((entry) => entry.includes("competitive") || entry.includes("play")) ? 0.52 : 0.3,
    competitiveness: content.some((entry) => entry.includes("competitive") || entry.includes("strategy")) ? 0.56 : 0.3,
    repetitionSensitivity: correctionContent.some((entry) => entry.includes("repeat")) ? 0.72 : 0.25,
    respectPreference: content.some((entry) => entry.includes("respectful") || entry.includes("cleaner")) ? 0.74 : 0.5,
    spiritualityPreference: content.some((entry) => entry.includes("spiritual") || entry.includes("faith")) ? 0.78 : 0.25,
    styleModel: {
      formality: content.some((entry) => entry.includes("formal") || entry.includes("professional")) ? 0.74 : 0.48,
      casualness: content.some((entry) => entry.includes("casual") || entry.includes("slang")) ? 0.7 : 0.34,
      emotionalHeaviness: content.some((entry) => entry.includes("deep") || entry.includes("heavy")) ? 0.68 : 0.3,
      directness: content.some((entry) => entry.includes("direct") || entry.includes("clear")) ? 0.72 : 0.46,
      verbosity: content.some((entry) => entry.includes("concise") || entry.includes("brief")) ? 0.26 : 0.44,
      playfulness: content.some((entry) => entry.includes("playful")) ? 0.62 : 0.32,
    },
    styleMemory: {
      prefersConciseReplies: content.some((entry) => entry.includes("concise") || entry.includes("brief")),
      prefersPlayfulTone: content.some((entry) => entry.includes("playful")),
      prefersWarmth: content.some((entry) => entry.includes("warm") || entry.includes("kind")),
      prefersStructuredClarity: content.some((entry) => entry.includes("structured") || entry.includes("clear")),
      usesCasualLanguage: content.some((entry) => entry.includes("casual") || entry.includes("slang")),
      prefersDirectness: content.some((entry) => entry.includes("direct")),
    },
    preferenceSummary: preferences.map((entry) => entry?.content).filter(Boolean).slice(-6),
    recentCorrections: corrections.map((entry) => entry?.content).filter(Boolean).slice(-6),
    correctionFlags: {
      avoidRepetition: correctionContent.some((entry) => entry.includes("repeat")),
      avoidNarration: correctionContent.some((entry) => entry.includes("narrator")),
      avoidProfanity: correctionContent.some((entry) => entry.includes("cleaner") || entry.includes("swear")),
      avoidTeasing: correctionContent.some((entry) => entry.includes("teasing") || entry.includes("cocky") || entry.includes("rude")),
    },
  });
}

async function getEngagementRecord(supabase, { userId, spiritkinId }) {
  if (!userId || !spiritkinId) return null;
  try {
    const { data } = await supabase
      .from("user_engagement")
      .select("*")
      .eq("user_id", toUuid(userId))
      .eq("spiritkin_id", spiritkinId)
      .maybeSingle();
    return data || null;
  } catch (_) {
    return null;
  }
}

export function createSpiritCoreAdaptiveService({ supabase, structuredMemoryService }) {
  async function buildRuntimeEnvelope({
    userId,
    spiritkinIdentity = null,
    conversationId = null,
    currentSurface = "selection",
    currentMode = "idle",
    activeTab = null,
    worldState = {},
    recentMessages = [],
    currentGame = null,
    requestContext = {},
    storedAdaptiveProfile = null,
  }) {
    const spiritkinId = spiritkinIdentity?.id || null;
    const engagement = await getEngagementRecord(supabase, { userId, spiritkinId });
    const structured = structuredMemoryService && userId
      ? await structuredMemoryService.buildContextSnapshot({
          userId,
          spiritkinId,
          conversationId,
          recentText: getRecentUserText(recentMessages),
          contextTags: [spiritkinIdentity?.name || "", currentSurface || "", currentMode || "", activeTab || ""].filter(Boolean),
          limit: 6,
        }).catch(() => ({ top: [], corrections: [], milestones: [], preferences: [], brief: "", hasMemories: false }))
      : { top: [], corrections: [], milestones: [], preferences: [], brief: "", hasMemories: false };

    const requestAdaptive = requestContext?.adaptiveProfile || requestContext?.localAdaptiveProfile || {};
    const persistedAdaptive = engagement?.adaptive_profile && typeof engagement.adaptive_profile === "object"
      ? engagement.adaptive_profile
      : {};
    const structuredAdaptive = buildStructuredMemoryAdaptiveProfile(structured);
    const unifiedAdaptiveProfile = mergeStoredAdaptiveProfile(
      mergeStoredAdaptiveProfile(
        mergeStoredAdaptiveProfile(storedAdaptiveProfile, persistedAdaptive),
        structuredAdaptive
      ),
      requestAdaptive
    );
    const signals = deriveContextSignals({
      requestContext,
      recentMessages,
      worldState,
      currentGame,
    });
    const userModel = deriveUserModel({
      spiritkinIdentity,
      worldState,
      recentMessages,
      unifiedAdaptiveProfile,
      signals,
      engagement: {
        lastSessionAt: engagement?.last_session_at || null,
        whisper: null,
      },
      currentMode,
    });
    const surfacePriority = buildSurfacePriority({
      currentGame,
      currentSurface,
      currentMode,
      userModel,
      signals,
      hasConversation: !!conversationId,
    });
    const guidance = buildGuidance({
      spiritkinIdentity,
      hasConversation: !!conversationId,
      currentGame,
      userModel,
      signals,
      surfacePriority,
    });
    const returnPackage = buildReturnPackage({
      spiritkinIdentity,
      recentMessages,
      currentGame,
      userModel,
      surfacePriority,
      engagement: {
        lastSessionAt: engagement?.last_session_at || null,
        whisper: null,
      },
      worldState,
    });
    const worldHooks = buildWorldHooks({
      spiritkinIdentity,
      worldState,
      signals,
      surfacePriority,
      userModel,
    });
    const ambientFoundation = buildSpiritCoreAmbientFoundation({
      spiritkinIdentity,
      worldState,
      signals,
      surfacePriority,
      userModel,
    });

    return {
      userModel,
      emotionalSignals: Object.fromEntries(
        Object.entries(signals).map(([key, value]) => [key, Number(clamp01(value).toFixed(3))])
      ),
      adaptiveProfile: unifiedAdaptiveProfile,
      guidance,
      surfacePriority,
      returnPackage,
      worldHooks,
      ambientFoundation,
      structuredMemorySummary: structured?.brief || "",
      version: 1,
    };
  }

  function applyWorldStateEnhancements(worldState = {}, envelope = null) {
    if (!envelope || typeof envelope !== "object") return worldState;
    return {
      ...(worldState || {}),
      flags: {
        ...(worldState?.flags || {}),
        spiritcore_adaptive_profile: {
          version: envelope.version || 1,
          ...envelope.adaptiveProfile,
          userModel: envelope.userModel,
          updatedAt: nowIso(),
        },
        spiritcore_world_hooks: {
          ...(envelope.worldHooks || {}),
          updatedAt: nowIso(),
        },
        spiritcore_surface_priority: {
          ...(envelope.surfacePriority || {}),
          updatedAt: nowIso(),
        },
        spiritcore_return_state: {
          ...(envelope.returnPackage || {}),
          updatedAt: nowIso(),
        },
        spiritcore_ambient_foundation: {
          ...(envelope.ambientFoundation || {}),
          updatedAt: nowIso(),
        },
      },
    };
  }

  return {
    buildRuntimeEnvelope,
    applyWorldStateEnhancements,
  };
}
