import { nowIso } from "../utils/time.mjs";
import { toUuid } from "../utils/id.mjs";

const DEFAULT_PROFILE = Object.freeze({
  tone_preference: "grounded",
  depth_level: "balanced",
  response_style: "balanced",
  emotional_expression: "warm",
  toneStyle: "grounded",
  intensity: 0.45,
  playfulness: 0.3,
  competitiveness: 0.3,
  repetitionSensitivity: 0.25,
  respectPreference: 0.5,
  spiritualityPreference: 0.25,
  styleModel: {
    formality: 0.48,
    casualness: 0.34,
    emotionalHeaviness: 0.3,
    directness: 0.46,
    verbosity: 0.44,
    playfulness: 0.32,
  },
  styleMemory: {
    prefersConciseReplies: false,
    prefersPlayfulTone: false,
    prefersWarmth: true,
    prefersStructuredClarity: false,
    usesCasualLanguage: false,
    prefersDirectness: false,
  },
  preferenceSummary: [],
  recentCorrections: [],
  correctionFlags: {
    avoidRepetition: false,
    avoidNarration: false,
    avoidProfanity: false,
    avoidTeasing: false,
  },
  profile_version: 1,
  sample_count: 0,
  updated_at: null,
});

function clamp01(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function normalizeList(list, limit = 8) {
  return [...new Set((Array.isArray(list) ? list : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean))]
    .slice(-limit);
}

function normalizeProfile(raw = {}) {
  const base = raw && typeof raw === "object" ? raw : {};
  const styleModel = base.styleModel && typeof base.styleModel === "object" ? base.styleModel : {};
  const styleMemory = base.styleMemory && typeof base.styleMemory === "object" ? base.styleMemory : {};
  const correctionFlags = base.correctionFlags && typeof base.correctionFlags === "object" ? base.correctionFlags : {};
  return {
    tone_preference: typeof base.tone_preference === "string" && base.tone_preference.trim()
      ? base.tone_preference.trim()
      : DEFAULT_PROFILE.tone_preference,
    depth_level: typeof base.depth_level === "string" && base.depth_level.trim()
      ? base.depth_level.trim()
      : DEFAULT_PROFILE.depth_level,
    response_style: typeof base.response_style === "string" && base.response_style.trim()
      ? base.response_style.trim()
      : DEFAULT_PROFILE.response_style,
    emotional_expression: typeof base.emotional_expression === "string" && base.emotional_expression.trim()
      ? base.emotional_expression.trim()
      : DEFAULT_PROFILE.emotional_expression,
    toneStyle: typeof base.toneStyle === "string" && base.toneStyle.trim()
      ? base.toneStyle.trim()
      : (typeof base.tone_preference === "string" && base.tone_preference.trim() ? base.tone_preference.trim() : DEFAULT_PROFILE.toneStyle),
    intensity: clamp01(base.intensity, DEFAULT_PROFILE.intensity),
    playfulness: clamp01(base.playfulness, DEFAULT_PROFILE.playfulness),
    competitiveness: clamp01(base.competitiveness, DEFAULT_PROFILE.competitiveness),
    repetitionSensitivity: clamp01(base.repetitionSensitivity, DEFAULT_PROFILE.repetitionSensitivity),
    respectPreference: clamp01(base.respectPreference, DEFAULT_PROFILE.respectPreference),
    spiritualityPreference: clamp01(base.spiritualityPreference, DEFAULT_PROFILE.spiritualityPreference),
    styleModel: {
      formality: clamp01(styleModel.formality, DEFAULT_PROFILE.styleModel.formality),
      casualness: clamp01(styleModel.casualness, DEFAULT_PROFILE.styleModel.casualness),
      emotionalHeaviness: clamp01(styleModel.emotionalHeaviness, DEFAULT_PROFILE.styleModel.emotionalHeaviness),
      directness: clamp01(styleModel.directness, DEFAULT_PROFILE.styleModel.directness),
      verbosity: clamp01(styleModel.verbosity, DEFAULT_PROFILE.styleModel.verbosity),
      playfulness: clamp01(styleModel.playfulness, DEFAULT_PROFILE.styleModel.playfulness),
    },
    styleMemory: {
      prefersConciseReplies: Boolean(styleMemory.prefersConciseReplies),
      prefersPlayfulTone: Boolean(styleMemory.prefersPlayfulTone),
      prefersWarmth: styleMemory.prefersWarmth === false ? false : true,
      prefersStructuredClarity: Boolean(styleMemory.prefersStructuredClarity),
      usesCasualLanguage: Boolean(styleMemory.usesCasualLanguage),
      prefersDirectness: Boolean(styleMemory.prefersDirectness),
    },
    preferenceSummary: normalizeList(base.preferenceSummary, 8),
    recentCorrections: normalizeList(base.recentCorrections, 6),
    correctionFlags: {
      avoidRepetition: Boolean(correctionFlags.avoidRepetition),
      avoidNarration: Boolean(correctionFlags.avoidNarration),
      avoidProfanity: Boolean(correctionFlags.avoidProfanity),
      avoidTeasing: Boolean(correctionFlags.avoidTeasing),
    },
    profile_version: 1,
    sample_count: Math.max(0, Number(base.sample_count || 0)),
    updated_at: base.updated_at ? String(base.updated_at) : null,
  };
}

function average(values = [], fallback = 0) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return fallback;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function getTextSignals(message = "", recentMessages = [], emotionState = null) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  const recentJoined = (Array.isArray(recentMessages) ? recentMessages : [])
    .map((entry) => String(entry?.content || ""))
    .join(" ")
    .toLowerCase();
  const combined = `${lower} ${recentJoined}`.trim();
  const questionCount = (text.match(/\?/g) || []).length;
  const sentenceCount = Math.max(1, text.split(/[.!?]+/).filter(Boolean).length);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const emotionMeta = emotionState?.metadata_json || {};
  const emotionLabel = String(emotionState?.label || emotionState?.tone || emotionMeta?.label || "").toLowerCase();
  const emotionIntensity = clamp01(emotionMeta?.intensity, 0);

  const score = (patterns, weight = 0.2) => {
    const hits = patterns.reduce((count, pattern) => count + (pattern.test(combined) ? 1 : 0), 0);
    return clamp01((hits * weight) + (hits ? 0.08 : 0), 0);
  };

  return {
    wordCount,
    questionCount,
    sentenceCount,
    explicitConcise: /\b(brief|concise|short answer|keep it short|quick answer)\b/.test(combined),
    explicitStructured: /\b(step by step|steps|structured|organize|bullet|plan|break it down)\b/.test(combined),
    explicitDirect: /\b(be direct|be honest|tell me plainly|keep it straight|no fluff)\b/.test(combined),
    explicitGentle: /\b(gentle|soft|calm|easy on me|respectful|keep it smooth)\b/.test(combined),
    explicitPlayful: /\b(playful|banter|tease|trash talk|funny|joke|lol|haha|lmao)\b/.test(combined),
    explicitSpiritual: /\b(god|faith|prayer|church|spiritual|holy|sacred|jesus|religious)\b/.test(combined),
    correction: /\b(stop saying|don't say|do not say|you keep repeating|stop repeating|less narration|don't narrate|not so robotic)\b/.test(combined),
    warm: score([/\bthank(s| you)\b/, /\bappreciate\b/, /\bglad\b/, /\bwith you\b/, /\btrust\b/], 0.22),
    emotional: score([/\bi feel\b/, /\bi'm feeling\b/, /\bhurt\b/, /\bgrief\b/, /\bsad\b/, /\blonely\b/, /\boverwhelmed\b/, /\bheavy\b/], 0.18),
    playful: score([/\blol\b/, /\bhaha\b/, /\bbanter\b/, /\bjoke\b/, /\btease\b/, /\bplay\b/], 0.18),
    direct: score([/\bneed\b/, /\bwhat do i do\b/, /\bjust tell me\b/, /\bplainly\b/, /\bdirect\b/, /\bclarity\b/], 0.18),
    structured: score([/\bsteps\b/, /\bplan\b/, /\borganize\b/, /\bbullet\b/, /\bbreak it down\b/], 0.18),
    casual: score([/\blol\b/, /\blmao\b/, /\bgonna\b/, /\bwanna\b/, /\bkinda\b/, /\bsorta\b/], 0.18),
    spiritual: score([/\bfaith\b/, /\bprayer\b/, /\bchurch\b/, /\bspiritual\b/, /\bsacred\b/, /\bholy\b/], 0.22),
    deep: score([/\bmeaning\b/, /\btruth\b/, /\bwhy\b/, /\bunderneath\b/, /\bdeeper\b/, /\bpattern\b/, /\bsoul\b/], 0.18),
    emotionLabel,
    emotionIntensity,
  };
}

function deriveTonePreference(signals) {
  if (signals.explicitSpiritual || signals.spiritual > 0.5) return "reverent";
  if (signals.explicitPlayful || signals.playful > 0.54) return "playful";
  if (signals.explicitDirect || signals.direct > 0.52) return "direct";
  if (signals.explicitGentle) return "gentle";
  if (signals.warm > 0.4 || signals.emotional > 0.35) return "warm";
  return "grounded";
}

function deriveDepthLevel(signals) {
  if (signals.deep > 0.48 || signals.wordCount > 90 || (signals.questionCount >= 2 && signals.emotional > 0.2)) return "deep";
  if (signals.wordCount < 14 && signals.questionCount <= 1 && signals.emotional < 0.2) return "light";
  return "balanced";
}

function deriveResponseStyle(signals) {
  if (signals.explicitConcise) return "concise";
  if (signals.explicitStructured || signals.structured > 0.42) return "structured";
  if (signals.wordCount > 110 || (signals.deep > 0.4 && signals.questionCount >= 2)) return "expansive";
  return "balanced";
}

function deriveEmotionalExpression(signals) {
  if (signals.emotionIntensity > 0.72 || signals.emotional > 0.55) return "intense";
  if (signals.emotional > 0.34 || /\b(trust|afraid|grief|hurt|ashamed|love)\b/.test(signals.emotionLabel)) return "open";
  if (signals.warm > 0.32) return "warm";
  return "reserved";
}

function buildPreferenceSummary(profile) {
  const summary = [];
  if (profile.response_style === "concise") summary.push("prefers concise replies");
  if (profile.response_style === "structured") summary.push("responds well to structured clarity");
  if (profile.tone_preference === "playful") summary.push("welcomes playful tone");
  if (profile.tone_preference === "gentle" || profile.tone_preference === "warm") summary.push("responds well to warmth");
  if (profile.tone_preference === "reverent") summary.push("welcomes reverent or spiritual framing");
  if (profile.styleMemory.usesCasualLanguage) summary.push("uses casual language");
  if (profile.styleMemory.prefersDirectness) summary.push("prefers directness");
  if (profile.depth_level === "deep") summary.push("welcomes depth over surface-level replies");
  return normalizeList(summary, 8);
}

function buildDetectedProfile({ message, recentMessages = [], emotionState = null }) {
  const signals = getTextSignals(message, recentMessages, emotionState);
  const tone_preference = deriveTonePreference(signals);
  const depth_level = deriveDepthLevel(signals);
  const response_style = deriveResponseStyle(signals);
  const emotional_expression = deriveEmotionalExpression(signals);
  const concise = response_style === "concise";
  const structured = response_style === "structured";
  const direct = tone_preference === "direct" || signals.explicitDirect;
  const playful = tone_preference === "playful";
  const reverent = tone_preference === "reverent";
  const warm = tone_preference === "warm" || tone_preference === "gentle";

  const detected = normalizeProfile({
    tone_preference,
    depth_level,
    response_style,
    emotional_expression,
    toneStyle: tone_preference === "warm" ? "grounded" : tone_preference,
    intensity: average([
      signals.emotionIntensity,
      depth_level === "deep" ? 0.62 : depth_level === "light" ? 0.24 : 0.44,
    ], 0.45),
    playfulness: playful ? 0.68 : Math.max(signals.playful, 0.18),
    competitiveness: /\b(win|competitive|beat me|trash talk|come at me)\b/i.test(String(message || "")) ? 0.62 : 0.3,
    repetitionSensitivity: signals.correction ? 0.72 : 0.25,
    respectPreference: warm || signals.explicitGentle ? 0.72 : 0.5,
    spiritualityPreference: reverent ? 0.78 : Math.max(signals.spiritual, 0.25),
    styleModel: {
      formality: signals.casual > 0.42 ? 0.32 : (reverent ? 0.64 : 0.48),
      casualness: Math.max(signals.casual, playful ? 0.58 : 0.24),
      emotionalHeaviness: depth_level === "deep" ? 0.66 : emotional_expression === "intense" ? 0.74 : 0.32,
      directness: direct ? 0.76 : Math.max(signals.direct, 0.42),
      verbosity: concise ? 0.22 : response_style === "expansive" ? 0.72 : 0.46,
      playfulness: playful ? 0.7 : Math.max(signals.playful, 0.28),
    },
    styleMemory: {
      prefersConciseReplies: concise,
      prefersPlayfulTone: playful,
      prefersWarmth: warm || emotional_expression !== "reserved",
      prefersStructuredClarity: structured,
      usesCasualLanguage: signals.casual > 0.42,
      prefersDirectness: direct,
    },
    recentCorrections: signals.correction
      ? normalizeList([String(message || "").replace(/\s+/g, " ").trim().slice(0, 140)], 6)
      : [],
    correctionFlags: {
      avoidRepetition: signals.correction && /\brepeat/.test(String(message || "").toLowerCase()),
      avoidNarration: signals.correction && /\bnarrat/.test(String(message || "").toLowerCase()),
      avoidProfanity: /\b(clean language|don't cuss|don't swear|respectful)\b/i.test(String(message || "")),
      avoidTeasing: /\b(don't tease|not so cocky|less teasing)\b/i.test(String(message || "")),
    },
  });

  detected.preferenceSummary = buildPreferenceSummary(detected);
  return { profile: detected, signals };
}

function mergeProfiles(stored = DEFAULT_PROFILE, detected = DEFAULT_PROFILE) {
  const base = normalizeProfile(stored);
  const incoming = normalizeProfile(detected);
  const nextSampleCount = Math.max(base.sample_count || 0, 0) + 1;
  const blend = (oldValue, newValue, floor = 0) => {
    const weight = nextSampleCount > 5 ? 0.22 : 0.34;
    return Number(Math.max(floor, ((oldValue * (1 - weight)) + (newValue * weight))).toFixed(3));
  };
  const chooseStyle = (current, next) => (next && next !== DEFAULT_PROFILE.tone_preference ? next : current);

  const merged = normalizeProfile({
    ...base,
    tone_preference: chooseStyle(base.tone_preference, incoming.tone_preference),
    depth_level: chooseStyle(base.depth_level, incoming.depth_level),
    response_style: chooseStyle(base.response_style, incoming.response_style),
    emotional_expression: chooseStyle(base.emotional_expression, incoming.emotional_expression),
    toneStyle: chooseStyle(base.toneStyle, incoming.toneStyle),
    intensity: blend(base.intensity, incoming.intensity, 0.15),
    playfulness: blend(base.playfulness, incoming.playfulness, 0.1),
    competitiveness: blend(base.competitiveness, incoming.competitiveness, 0.1),
    repetitionSensitivity: Math.max(base.repetitionSensitivity, incoming.repetitionSensitivity),
    respectPreference: Math.max(base.respectPreference, incoming.respectPreference),
    spiritualityPreference: Math.max(base.spiritualityPreference, incoming.spiritualityPreference),
    styleModel: {
      formality: blend(base.styleModel.formality, incoming.styleModel.formality, 0.1),
      casualness: blend(base.styleModel.casualness, incoming.styleModel.casualness, 0.1),
      emotionalHeaviness: blend(base.styleModel.emotionalHeaviness, incoming.styleModel.emotionalHeaviness, 0.1),
      directness: blend(base.styleModel.directness, incoming.styleModel.directness, 0.1),
      verbosity: blend(base.styleModel.verbosity, incoming.styleModel.verbosity, 0.1),
      playfulness: blend(base.styleModel.playfulness, incoming.styleModel.playfulness, 0.1),
    },
    styleMemory: {
      prefersConciseReplies: base.styleMemory.prefersConciseReplies || incoming.styleMemory.prefersConciseReplies,
      prefersPlayfulTone: base.styleMemory.prefersPlayfulTone || incoming.styleMemory.prefersPlayfulTone,
      prefersWarmth: base.styleMemory.prefersWarmth || incoming.styleMemory.prefersWarmth,
      prefersStructuredClarity: base.styleMemory.prefersStructuredClarity || incoming.styleMemory.prefersStructuredClarity,
      usesCasualLanguage: base.styleMemory.usesCasualLanguage || incoming.styleMemory.usesCasualLanguage,
      prefersDirectness: base.styleMemory.prefersDirectness || incoming.styleMemory.prefersDirectness,
    },
    preferenceSummary: normalizeList([...(base.preferenceSummary || []), ...(incoming.preferenceSummary || [])], 8),
    recentCorrections: normalizeList([...(base.recentCorrections || []), ...(incoming.recentCorrections || [])], 6),
    correctionFlags: {
      avoidRepetition: base.correctionFlags.avoidRepetition || incoming.correctionFlags.avoidRepetition,
      avoidNarration: base.correctionFlags.avoidNarration || incoming.correctionFlags.avoidNarration,
      avoidProfanity: base.correctionFlags.avoidProfanity || incoming.correctionFlags.avoidProfanity,
      avoidTeasing: base.correctionFlags.avoidTeasing || incoming.correctionFlags.avoidTeasing,
    },
    sample_count: nextSampleCount,
    updated_at: nowIso(),
  });

  merged.preferenceSummary = buildPreferenceSummary(merged);
  return merged;
}

async function safeGetEngagement(supabase, userId, spiritkinId) {
  if (!userId || !spiritkinId) return null;
  try {
    const { data, error } = await supabase
      .from("user_engagement")
      .select("*")
      .eq("user_id", toUuid(userId))
      .eq("spiritkin_id", spiritkinId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.warn("[AdaptiveProfile] load failed:", error.message);
    return null;
  }
}

export function createAdaptiveProfileService({ supabase }) {
  async function getProfile({ userId, spiritkinId }) {
    if (!userId || !spiritkinId) return normalizeProfile(DEFAULT_PROFILE);
    const record = await safeGetEngagement(supabase, userId, spiritkinId);
    return normalizeProfile(record?.adaptive_profile || {});
  }

  async function persistProfile({ userId, spiritkinId, profile }) {
    if (!userId || !spiritkinId) return { ok: false, skipped: true };

    const payload = {
      user_id: toUuid(userId),
      spiritkin_id: spiritkinId,
      adaptive_profile: profile,
      adaptive_profile_updated_at: nowIso(),
      updated_at: nowIso(),
    };

    try {
      const { error } = await supabase
        .from("user_engagement")
        .upsert(payload, { onConflict: "user_id,spiritkin_id" });

      if (error) throw error;
      return { ok: true };
    } catch (error) {
      const message = String(error?.message || "");
      if (/adaptive_profile|adaptive_profile_updated_at|schema cache/i.test(message)) {
        console.warn("[AdaptiveProfile] persistence skipped until schema migration is applied.");
        return { ok: false, skipped: true, reason: "schema_not_aligned" };
      }
      console.warn("[AdaptiveProfile] persist failed:", message);
      return { ok: false, reason: message };
    }
  }

  async function updateFromMessage({
    userId,
    spiritkinId,
    message,
    recentMessages = [],
    emotionState = null,
    existingProfile = null,
  }) {
    if (!userId || !spiritkinId || !String(message || "").trim()) {
      return { ok: false, profile: normalizeProfile(existingProfile || DEFAULT_PROFILE), skipped: true };
    }

    const stored = existingProfile ? normalizeProfile(existingProfile) : await getProfile({ userId, spiritkinId });
    const { profile: detected, signals } = buildDetectedProfile({ message, recentMessages, emotionState });
    const merged = mergeProfiles(stored, detected);
    const persistence = await persistProfile({ userId, spiritkinId, profile: merged });

    console.info("[AdaptiveProfile] updated", {
      userId: String(userId),
      spiritkinId: String(spiritkinId),
      tone_preference: merged.tone_preference,
      depth_level: merged.depth_level,
      response_style: merged.response_style,
      emotional_expression: merged.emotional_expression,
      sample_count: merged.sample_count,
      persisted: Boolean(persistence.ok),
      message_length: String(message || "").length,
      signal_snapshot: {
        emotional: Number(signals.emotional.toFixed(3)),
        direct: Number(signals.direct.toFixed(3)),
        playful: Number(signals.playful.toFixed(3)),
        structured: Number(signals.structured.toFixed(3)),
        spiritual: Number(signals.spiritual.toFixed(3)),
      },
    });

    return {
      ok: true,
      profile: merged,
      persisted: Boolean(persistence.ok),
      persistence,
      signals,
    };
  }

  return {
    getProfile,
    updateFromMessage,
    normalizeProfile,
  };
}
