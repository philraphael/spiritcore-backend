/**
 * SpiritCore — Emotion Service (v2)
 *
 * Upgraded from 3-state keyword detection to a full 20+ emotion taxonomy
 * with intensity scoring, trajectory tracking, and session arc detection.
 *
 * Emotion Taxonomy:
 *   Positive: joy, gratitude, hope, love, excitement, pride, awe, contentment, relief, curiosity
 *   Negative: grief, anxiety, anger, shame, loneliness, fear, despair, frustration, exhaustion, confusion
 *   Transitional: longing, nostalgia, ambivalence, vulnerability, restlessness
 *
 * Each emotion carries:
 *   - label: canonical emotion name
 *   - valence: 0.0 (very negative) → 1.0 (very positive)
 *   - arousal: 0.0 (very calm) → 1.0 (very activated)
 *   - intensity: 0.0 (barely present) → 1.0 (overwhelming)
 *   - trajectory: "rising" | "falling" | "stable" (compared to previous state)
 *   - arc: "opening" | "deepening" | "resolving" | "crisis" | "plateau"
 */

import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";
import { toUuid } from "../utils/id.mjs";

// ─── Emotion Taxonomy ────────────────────────────────────────────────────────

const EMOTION_TAXONOMY = {
  // Positive emotions
  joy: {
    valence: 0.95, arousal: 0.75,
    signals: ["happy", "joy", "joyful", "delighted", "elated", "thrilled", "overjoyed", "ecstatic", "blissful", "wonderful"],
    weight: 1.0
  },
  gratitude: {
    valence: 0.90, arousal: 0.40,
    signals: ["grateful", "thankful", "appreciate", "blessed", "fortunate", "thank you", "means so much"],
    weight: 1.0
  },
  hope: {
    valence: 0.80, arousal: 0.55,
    signals: ["hope", "hopeful", "looking forward", "optimistic", "better days", "maybe things will", "believe it can"],
    weight: 1.0
  },
  love: {
    valence: 0.95, arousal: 0.60,
    signals: ["love", "adore", "cherish", "care deeply", "heart", "beloved", "dear to me"],
    weight: 1.0
  },
  excitement: {
    valence: 0.88, arousal: 0.90,
    signals: ["excited", "can't wait", "pumped", "stoked", "thrilled", "amazing news", "so ready"],
    weight: 1.0
  },
  pride: {
    valence: 0.85, arousal: 0.65,
    signals: ["proud", "accomplished", "achieved", "did it", "finally", "succeeded", "made it"],
    weight: 1.0
  },
  awe: {
    valence: 0.85, arousal: 0.70,
    signals: ["incredible", "breathtaking", "awe", "magnificent", "can't believe", "stunning", "overwhelming beauty"],
    weight: 1.0
  },
  contentment: {
    valence: 0.80, arousal: 0.20,
    signals: ["content", "peaceful", "at peace", "settled", "calm", "okay now", "good place"],
    weight: 1.0
  },
  relief: {
    valence: 0.75, arousal: 0.35,
    signals: ["relief", "relieved", "finally over", "weight lifted", "so glad that's done", "phew", "can breathe"],
    weight: 1.0
  },
  curiosity: {
    valence: 0.70, arousal: 0.65,
    signals: ["curious", "wonder", "what if", "interesting", "tell me more", "how does", "want to understand"],
    weight: 0.8
  },

  // Negative emotions
  grief: {
    valence: 0.05, arousal: 0.30,
    signals: ["grief", "grieving", "lost", "loss", "miss them", "gone forever", "mourning", "heartbroken", "devastated"],
    weight: 1.2
  },
  anxiety: {
    valence: 0.20, arousal: 0.85,
    signals: ["anxious", "anxiety", "worried", "nervous", "on edge", "can't stop thinking", "what if something", "panic", "dread"],
    weight: 1.2
  },
  anger: {
    valence: 0.15, arousal: 0.90,
    signals: ["angry", "furious", "rage", "infuriated", "so mad", "hate", "can't stand", "fed up", "livid"],
    weight: 1.1
  },
  shame: {
    valence: 0.10, arousal: 0.50,
    signals: ["ashamed", "shame", "embarrassed", "humiliated", "worthless", "failure", "not good enough", "let everyone down"],
    weight: 1.2
  },
  loneliness: {
    valence: 0.15, arousal: 0.25,
    signals: ["lonely", "alone", "isolated", "no one understands", "nobody cares", "by myself", "disconnected", "invisible"],
    weight: 1.2
  },
  fear: {
    valence: 0.15, arousal: 0.85,
    signals: ["scared", "afraid", "terrified", "frightened", "fear", "petrified", "dread", "something bad will happen"],
    weight: 1.2
  },
  despair: {
    valence: 0.05, arousal: 0.15,
    signals: ["hopeless", "despair", "no point", "give up", "nothing matters", "can't go on", "what's the use", "done"],
    weight: 1.5 // highest weight — safety-adjacent
  },
  frustration: {
    valence: 0.25, arousal: 0.75,
    signals: ["frustrated", "annoyed", "irritated", "nothing works", "keeps happening", "so tired of this", "can't get it right"],
    weight: 1.0
  },
  exhaustion: {
    valence: 0.25, arousal: 0.10,
    signals: ["exhausted", "drained", "tired", "worn out", "burnt out", "no energy", "running on empty", "can't keep going"],
    weight: 1.1
  },
  confusion: {
    valence: 0.35, arousal: 0.55,
    signals: ["confused", "don't understand", "lost", "overwhelmed", "not sure", "what do i do", "can't figure out"],
    weight: 0.9
  },

  // Transitional emotions
  longing: {
    valence: 0.40, arousal: 0.35,
    signals: ["miss", "wish things were", "used to be", "remember when", "if only", "long for", "ache for"],
    weight: 1.0
  },
  nostalgia: {
    valence: 0.55, arousal: 0.30,
    signals: ["nostalgic", "reminds me of", "back then", "childhood", "used to", "those days", "feels like before"],
    weight: 0.9
  },
  ambivalence: {
    valence: 0.50, arousal: 0.40,
    signals: ["not sure how i feel", "mixed feelings", "part of me", "but also", "conflicted", "torn between"],
    weight: 0.9
  },
  vulnerability: {
    valence: 0.45, arousal: 0.55,
    signals: ["vulnerable", "opening up", "hard to say", "never told anyone", "feel exposed", "scared to admit", "raw"],
    weight: 1.1
  },
  restlessness: {
    valence: 0.40, arousal: 0.70,
    signals: ["restless", "can't sit still", "something needs to change", "stuck", "need more", "unsatisfied", "itching to"],
    weight: 0.9
  },
};

// Crisis signals — always escalate regardless of other emotion scores
const CRISIS_SIGNALS = [
  "want to die", "kill myself", "end it all", "suicidal", "self-harm", "hurt myself",
  "not worth living", "no reason to live", "better off dead", "can't take it anymore",
  "going to hurt", "end my life"
];

// ─── Core Emotion Derivation ─────────────────────────────────────────────────

/**
 * Derive a rich emotion object from text input.
 * Returns the dominant emotion with intensity, valence, arousal, and matched signals.
 *
 * @param {string} text
 * @returns {{ label, valence, arousal, intensity, signals_matched, is_crisis }}
 */
function deriveEmotionFromText(text) {
  if (!text || typeof text !== "string") {
    return { label: "neutral", valence: 0.5, arousal: 0.3, intensity: 0.2, signals_matched: [], is_crisis: false };
  }

  const lower = text.toLowerCase();

  // Crisis check — highest priority
  const crisisMatched = CRISIS_SIGNALS.filter(s => lower.includes(s));
  if (crisisMatched.length > 0) {
    return {
      label: "despair",
      valence: 0.05,
      arousal: 0.20,
      intensity: 1.0,
      signals_matched: crisisMatched,
      is_crisis: true
    };
  }

  // Score each emotion
  const scores = {};
  for (const [emotion, config] of Object.entries(EMOTION_TAXONOMY)) {
    const matched = config.signals.filter(s => lower.includes(s));
    if (matched.length > 0) {
      scores[emotion] = {
        raw: matched.length,
        weighted: matched.length * config.weight,
        matched,
        config
      };
    }
  }

  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return { label: "neutral", valence: 0.5, arousal: 0.3, intensity: 0.15, signals_matched: [], is_crisis: false };
  }

  // Find dominant emotion by weighted score
  entries.sort((a, b) => b[1].weighted - a[1].weighted);
  const [dominantLabel, dominantData] = entries[0];

  // Calculate intensity: normalized match count + text length factor
  const maxPossibleSignals = dominantData.config.signals.length;
  const matchRatio = dominantData.raw / maxPossibleSignals;
  const lengthFactor = Math.min(text.length / 200, 1.0) * 0.3; // longer text = more intensity
  const intensity = Math.min(matchRatio * 0.7 + lengthFactor + 0.1, 1.0);

  return {
    label: dominantLabel,
    valence: dominantData.config.valence,
    arousal: dominantData.config.arousal,
    intensity: Math.round(intensity * 100) / 100,
    signals_matched: dominantData.matched,
    is_crisis: false,
    secondary: entries.length > 1 ? entries[1][0] : null // second strongest emotion
  };
}

/**
 * Compute trajectory by comparing current emotion to previous state.
 * Returns "rising" (improving), "falling" (worsening), or "stable".
 *
 * @param {object} current  — { valence, arousal, intensity }
 * @param {object} previous — { valence, arousal, intensity } or null
 * @returns {"rising"|"falling"|"stable"}
 */
function computeTrajectory(current, previous) {
  if (!previous) return "stable";
  const valenceDelta = current.valence - (previous.valence ?? 0.5);
  if (valenceDelta > 0.15) return "rising";
  if (valenceDelta < -0.15) return "falling";
  return "stable";
}

/**
 * Compute session arc from trajectory history.
 * Returns a narrative arc label that describes the emotional journey.
 *
 * @param {string} trajectory  — current trajectory
 * @param {object} previous    — previous emotion state
 * @param {object} current     — current emotion state
 * @returns {"opening"|"deepening"|"resolving"|"crisis"|"plateau"}
 */
function computeArc(trajectory, previous, current) {
  if (current.is_crisis) return "crisis";
  if (!previous) return "opening";
  if (current.intensity > 0.7 && trajectory === "falling") return "deepening";
  if (trajectory === "rising" && current.valence > 0.6) return "resolving";
  if (trajectory === "stable" && current.intensity < 0.3) return "plateau";
  if (trajectory === "stable") return "deepening";
  return "opening";
}

// ─── Service Factory ─────────────────────────────────────────────────────────

export function createEmotionService({ supabase }) {

  /**
   * Get the current emotion state for a user/spiritkin/conversation.
   * Returns null if no state exists yet.
   */
  async function getState({ userId, spiritkinId = null, conversationId = null }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    const dbUserId = toUuid(userId);
    let query = supabase
      .from("emotion_state")
      .select("*")
      .eq("user_id", dbUserId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (spiritkinId) query = query.eq("spiritkin_id", spiritkinId);
    if (conversationId) query = query.eq("conversation_id", conversationId);

    const { data, error } = await query;
    if (error) throw new AppError("DB", "Failed to read emotion state", 500, error.message);
    return data?.[0] ?? null;
  }

  /**
   * Update emotion state derived from a text input.
   * Now includes: rich emotion taxonomy, intensity, trajectory, arc, secondary emotion.
   * Upserts into emotion_state keyed on user_id + spiritkin_id + conversation_id.
   */
  async function updateFromText({ userId, spiritkinId = null, conversationId = null, text }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    const dbUserId = toUuid(userId);

    // Get previous state for trajectory computation
    const previous = await getState({ userId, spiritkinId, conversationId }).catch(() => null);

    const derived = deriveEmotionFromText(text);
    const trajectory = computeTrajectory(derived, previous);
    const arc = computeArc(trajectory, previous, derived);

    const payload = {
      user_id: dbUserId,
      spiritkin_id: spiritkinId,
      conversation_id: conversationId,
      label: derived.label,
      valence: derived.valence,
      arousal: derived.arousal,
      // Store extended fields in metadata_json if column exists, otherwise fall back gracefully
      metadata_json: {
        intensity: derived.intensity,
        trajectory,
        arc,
        secondary: derived.secondary ?? null,
        signals_matched: derived.signals_matched ?? [],
        is_crisis: derived.is_crisis ?? false,
        previous_label: previous?.label ?? null,
        previous_valence: previous?.valence ?? null,
      },
      updated_at: nowIso(),
    };

    const { data, error } = await supabase
      .from("emotion_state")
      .upsert(payload, { onConflict: "user_id,spiritkin_id,conversation_id" })
      .select("*")
      .single();

    if (error) {
      console.warn("[EmotionService] upsert failed:", error.message);
      return { ...derived, trajectory, arc, persisted: false };
    }

    return {
      ...data,
      intensity: derived.intensity,
      trajectory,
      arc,
      secondary: derived.secondary,
      is_crisis: derived.is_crisis,
      persisted: true
    };
  }

  /**
   * Get a rich emotional summary for use in the adapter context.
   * Returns a human-readable description of the user's emotional state.
   */
  async function getSummary({ userId, spiritkinId = null, conversationId = null }) {
    const state = await getState({ userId, spiritkinId, conversationId });
    if (!state) return null;

    const meta = state.metadata_json ?? {};
    const label = state.label ?? "neutral";
    const intensity = meta.intensity ?? 0.3;
    const trajectory = meta.trajectory ?? "stable";
    const arc = meta.arc ?? "opening";
    const secondary = meta.secondary;

    const intensityWord = intensity > 0.7 ? "deeply" : intensity > 0.4 ? "noticeably" : "gently";
    const trajectoryPhrase = trajectory === "rising"
      ? "and moving toward lighter ground"
      : trajectory === "falling"
        ? "and moving into heavier territory"
        : "with a steady presence";

    const secondaryPhrase = secondary ? `, with undertones of ${secondary}` : "";

    return {
      label,
      valence: state.valence,
      arousal: state.arousal,
      intensity,
      trajectory,
      arc,
      secondary,
      description: `The user is ${intensityWord} ${label}${secondaryPhrase}, ${trajectoryPhrase}. Session arc: ${arc}.`,
      is_crisis: meta.is_crisis ?? false,
    };
  }

  return { getState, updateFromText, getSummary };
}
