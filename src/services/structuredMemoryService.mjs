import { nowIso, daysBetween } from "../utils/time.mjs";
import { sanitizeText } from "../utils/sanitize.mjs";
import { toUuid } from "../utils/id.mjs";
import { extractSemanticFacts, assessEpisodicSignificance } from "./hierarchicalMemory.mjs";

export const STRUCTURED_MEMORY_KIND = "structured_memory";

export const MEMORY_TYPES = {
  PREFERENCE: "preference",
  AVERSION: "aversion",
  TONE_PREFERENCE: "tone_preference",
  RELATIONSHIP_FACT: "relationship_fact",
  MILESTONE: "milestone",
  EMOTIONAL_ANCHOR: "emotional_anchor",
  CORRECTION: "correction",
  RECURRING_TOPIC: "recurring_topic",
  RECURRING_PERSON: "recurring_person",
  GAMEPLAY_TENDENCY: "gameplay_tendency",
  SPIRITUAL_PREFERENCE: "spiritual_preference",
  RESPECT_PREFERENCE: "respect_preference",
};

const SCHEMA_VERSION = 1;
const RETENTION_SOFT_LIMIT = 140;
const RETENTION_HARD_LIMIT = 220;
const CONTEXT_LIMIT = 8;

const MILESTONE_PHRASES = [
  "never told anyone",
  "first time i've said",
  "i finally understand",
  "something clicked",
  "thank you for",
  "i'm ready",
  "i forgive",
];

function clamp01(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number < 0) return 0;
  if (number > 1) return 1;
  return number;
}

function normalizeTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter(Boolean))]
    .slice(0, 12);
}

function normalizeSummary(text) {
  return sanitizeText(String(text || ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

function buildMetadata(entry, conversationId = null) {
  return {
    schema_version: SCHEMA_VERSION,
    memory_type: entry.type,
    normalized_summary: normalizeSummary(entry.normalizedSummary || entry.content || ""),
    source: entry.source || "interaction_extract",
    confidence: clamp01(entry.confidence, 0.7),
    importance: clamp01(entry.importance, 0.5),
    recency_score: clamp01(entry.recencyScore, 1),
    reuse_count: Math.max(0, Number(entry.reuseCount || 0)),
    last_referenced_at: entry.lastReferencedAt || null,
    tags: normalizeTags(entry.tags),
    premium_retention_eligible: Boolean(entry.premiumRetentionEligible),
    correction_priority: clamp01(entry.correctionPriority, 0),
    emotional_weight: clamp01(entry.emotionalWeight, 0),
    retention_state: entry.retentionState || "active",
    conversation_id: conversationId ?? entry.conversationId ?? null,
    related_people: normalizeTags(entry.relatedPeople),
    related_topics: normalizeTags(entry.relatedTopics),
    supporting_context: entry.supportingContext ? String(entry.supportingContext).slice(0, 300) : null,
    engine_version: "structured_memory_v1",
  };
}

function createEntry(type, summary, options = {}) {
  const normalizedSummary = normalizeSummary(summary);
  if (!normalizedSummary) return null;
  return {
    id: options.id || null,
    type,
    content: normalizedSummary,
    normalizedSummary,
    source: options.source || "interaction_extract",
    confidence: clamp01(options.confidence, 0.72),
    importance: clamp01(options.importance, 0.5),
    recencyScore: clamp01(options.recencyScore, 1),
    reuseCount: Math.max(0, Number(options.reuseCount || 0)),
    createdAt: options.createdAt || null,
    lastReferencedAt: options.lastReferencedAt || null,
    tags: normalizeTags(options.tags),
    premiumRetentionEligible: Boolean(options.premiumRetentionEligible),
    correctionPriority: clamp01(options.correctionPriority, 0),
    emotionalWeight: clamp01(options.emotionalWeight, 0),
    relatedPeople: normalizeTags(options.relatedPeople),
    relatedTopics: normalizeTags(options.relatedTopics),
    supportingContext: options.supportingContext || null,
    retentionState: options.retentionState || "active",
  };
}

function mergeEntries(entries) {
  const map = new Map();
  for (const entry of entries.filter(Boolean)) {
    const key = `${entry.type}:${entry.normalizedSummary.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, entry);
      continue;
    }
    const current = map.get(key);
    map.set(key, {
      ...current,
      confidence: Math.max(current.confidence, entry.confidence),
      importance: Math.max(current.importance, entry.importance),
      correctionPriority: Math.max(current.correctionPriority, entry.correctionPriority),
      emotionalWeight: Math.max(current.emotionalWeight, entry.emotionalWeight),
      premiumRetentionEligible: current.premiumRetentionEligible || entry.premiumRetentionEligible,
      tags: normalizeTags([...(current.tags || []), ...(entry.tags || [])]),
      relatedPeople: normalizeTags([...(current.relatedPeople || []), ...(entry.relatedPeople || [])]),
      relatedTopics: normalizeTags([...(current.relatedTopics || []), ...(entry.relatedTopics || [])]),
    });
  }
  return [...map.values()];
}

function extractPreferenceEntries(text) {
  const input = String(text || "");
  const entries = [];
  const positive = [...input.matchAll(/\b(?:i\s+(?:really\s+)?(?:like|love|enjoy|prefer))\s+([^.!?,;]{2,80})/gi)];
  const negative = [...input.matchAll(/\b(?:i\s+(?:really\s+)?(?:dislike|hate)|i\s+can't stand|i\s+do not like|i\s+don't like|please avoid)\s+([^.!?,;]{2,80})/gi)];
  for (const match of positive) {
    const subject = normalizeSummary(match[1]);
    if (!subject) continue;
    entries.push(createEntry(MEMORY_TYPES.PREFERENCE, `User likes ${subject}.`, {
      confidence: 0.78,
      importance: 0.58,
      tags: ["preference"],
      relatedTopics: [subject],
      premiumRetentionEligible: true,
    }));
  }
  for (const match of negative) {
    const subject = normalizeSummary(match[1]);
    if (!subject) continue;
    entries.push(createEntry(MEMORY_TYPES.AVERSION, `User dislikes ${subject}.`, {
      confidence: 0.84,
      importance: 0.66,
      tags: ["aversion", "boundary"],
      relatedTopics: [subject],
      premiumRetentionEligible: true,
    }));
  }
  return entries;
}

function extractToneAndCorrectionEntries(text) {
  const lower = String(text || "").toLowerCase();
  const entries = [];
  const correctionPatterns = [
    { pattern: /\b(stop saying|don't say|do not say|quit saying)\s+([^.!?,;]{2,80})/i, summary: (value) => `Avoid saying ${value}.`, phrase: true },
    { pattern: /\b(you keep repeating|you keep saying|that's repetitive|stop repeating)\b/i, summary: () => "User objected to repeated phrasing." },
    { pattern: /\b(stop narrating|don't narrate|do not narrate|less narrator)\b/i, summary: () => "User wants less narrator-style delivery." },
    { pattern: /\b(that's wrong|not like that|you got that wrong)\b/i, summary: () => "User corrected Spiritkin framing or content." },
    { pattern: /\b(don't tease|do not tease|less teasing|not so cocky)\b/i, summary: () => "User wants teasing reduced." },
  ];

  for (const item of correctionPatterns) {
    const match = text.match(item.pattern);
    if (!match) continue;
    const target = normalizeSummary(match[2] || "");
    entries.push(createEntry(MEMORY_TYPES.CORRECTION, item.summary(target || "that"), {
      confidence: 0.92,
      importance: 0.82,
      correctionPriority: 0.98,
      premiumRetentionEligible: true,
      tags: ["correction", "user_boundary"],
      relatedTopics: target ? [target] : [],
    }));
  }

  const tonePatterns = [
    { pattern: /\b(be gentle|be softer|go easy on me|keep it calm)\b/i, summary: "User prefers gentle, calm delivery.", type: MEMORY_TYPES.TONE_PREFERENCE, tags: ["gentle", "calm"] },
    { pattern: /\b(be direct|be honest|keep it straight|tell me plainly)\b/i, summary: "User prefers direct delivery.", type: MEMORY_TYPES.TONE_PREFERENCE, tags: ["direct"] },
    { pattern: /\b(keep it respectful|be respectful|clean language|don't cuss|don't swear)\b/i, summary: "User prefers respectful, cleaner delivery.", type: MEMORY_TYPES.RESPECT_PREFERENCE, tags: ["respectful", "clean_language"] },
    { pattern: /\b(god|jesus|faith|prayer|church|spiritual|sacred|holy|religious)\b/i, summary: "User signaled spiritual or faith-oriented framing.", type: MEMORY_TYPES.SPIRITUAL_PREFERENCE, tags: ["spiritual"] },
  ];

  for (const item of tonePatterns) {
    if (!item.pattern.test(lower)) continue;
    entries.push(createEntry(item.type, item.summary, {
      confidence: 0.8,
      importance: item.type === MEMORY_TYPES.RESPECT_PREFERENCE || item.type === MEMORY_TYPES.SPIRITUAL_PREFERENCE ? 0.76 : 0.7,
      premiumRetentionEligible: true,
      tags: item.tags,
    }));
  }
  return entries;
}

function extractRelationshipEntries(text) {
  const facts = extractSemanticFacts(text);
  return facts.map(({ fact, category, confidence }) => createEntry(MEMORY_TYPES.RELATIONSHIP_FACT, fact, {
    confidence,
    importance: category === "identity" ? 0.88 : 0.68,
    premiumRetentionEligible: true,
    tags: [category],
  }));
}

function extractGameplayEntries(text) {
  const lower = String(text || "").toLowerCase();
  const entries = [];
  if (/\b(i'm competitive|im competitive|don't go easy|trash talk|come at me|i play to win)\b/.test(lower)) {
    entries.push(createEntry(MEMORY_TYPES.GAMEPLAY_TENDENCY, "User enjoys competitive game energy.", {
      confidence: 0.82,
      importance: 0.6,
      tags: ["competitive", "games"],
    }));
  }
  if (/\b(i like chess|i love chess|i like strategy games|i love strategy)\b/.test(lower)) {
    entries.push(createEntry(MEMORY_TYPES.GAMEPLAY_TENDENCY, "User is drawn to strategy-heavy games.", {
      confidence: 0.78,
      importance: 0.54,
      tags: ["games", "strategy"],
    }));
  }
  return entries;
}

function extractMilestoneAndAnchorEntries({ userText, spiritkinResponse = "", emotionState = {}, worldState = {}, bondStage = null, previousBondStage = null }) {
  const lower = String(userText || "").toLowerCase();
  const emotionLabel = emotionState?.label ?? emotionState?.tone ?? "neutral";
  const intensity = clamp01(emotionState?.intensity ?? emotionState?.metadata_json?.intensity, 0);
  const arc = emotionState?.arc ?? emotionState?.metadata_json?.arc ?? "opening";
  const significance = assessEpisodicSignificance({ userText, spiritkinResponse, emotionLabel, arc });
  const entries = [];

  if (significance.score >= 0.72 || MILESTONE_PHRASES.some((phrase) => lower.includes(phrase))) {
    entries.push(createEntry(MEMORY_TYPES.MILESTONE, significance.milestone
      ? `Relationship milestone: ${significance.milestone.replace(/_/g, " ")}.`
      : "A meaningful relationship moment occurred.", {
      confidence: Math.max(0.76, significance.score),
      importance: Math.max(0.78, significance.score),
      emotionalWeight: Math.max(intensity, significance.score),
      premiumRetentionEligible: true,
      tags: ["milestone", arc, emotionLabel],
    }));
  }

  if (intensity >= 0.72 || ["grief", "vulnerability", "longing", "relief", "awe"].includes(String(emotionLabel).toLowerCase())) {
    entries.push(createEntry(MEMORY_TYPES.EMOTIONAL_ANCHOR, `Emotionally significant ${emotionLabel || "bond"} moment.`, {
      confidence: 0.8,
      importance: 0.8,
      emotionalWeight: Math.max(0.76, intensity),
      premiumRetentionEligible: true,
      tags: ["emotional_anchor", emotionLabel, arc],
    }));
  }

  if (bondStage !== null && bondStage !== undefined && bondStage !== previousBondStage) {
    entries.push(createEntry(MEMORY_TYPES.MILESTONE, `Bond stage advanced to ${bondStage}.`, {
      confidence: 0.95,
      importance: 0.92,
      emotionalWeight: 0.66,
      premiumRetentionEligible: true,
      tags: ["bond_stage"],
    }));
  }

  const echoUnlocks = worldState?.echo_unlocks ?? [];
  if (Array.isArray(echoUnlocks) && echoUnlocks.length) {
    const latest = echoUnlocks[echoUnlocks.length - 1];
    entries.push(createEntry(MEMORY_TYPES.MILESTONE, `Unlocked Spiritverse echo: ${latest?.title ?? latest}.`, {
      confidence: 0.88,
      importance: 0.74,
      premiumRetentionEligible: true,
      tags: ["echo_unlock", "spiritverse"],
    }));
  }

  return entries;
}

function extractNamedPeople(text) {
  const matches = [...String(text || "").matchAll(/\b(?:my|our)\s+(?:friend|daughter|son|wife|husband|partner|mom|mother|dad|father|sister|brother)\s+([A-Z][a-z]+)\b/g)];
  return [...new Set(matches.map((match) => match[1]).filter(Boolean))];
}

function extractTopicHints(text) {
  const hints = [];
  const lower = String(text || "").toLowerCase();
  if (/\bgame|chess|checkers|tic tac toe|connect four|battleship|cards|star mapping\b/.test(lower)) hints.push("games");
  if (/\bfaith|prayer|church|god|spiritual|sacred\b/.test(lower)) hints.push("spirituality");
  if (/\bwork|job|career|office|coworker\b/.test(lower)) hints.push("work");
  if (/\bfamily|daughter|son|wife|husband|mom|dad|partner\b/.test(lower)) hints.push("family");
  if (/\bemotion|feel|anxiety|grief|sad|lonely|afraid\b/.test(lower)) hints.push("emotional_state");
  return hints;
}

export function extractStructuredMemories({ userText, spiritkinResponse = "", emotionState = {}, worldState = {}, bondStage = null, previousBondStage = null }) {
  const entries = [
    ...extractPreferenceEntries(userText),
    ...extractToneAndCorrectionEntries(userText),
    ...extractRelationshipEntries(userText),
    ...extractGameplayEntries(userText),
    ...extractMilestoneAndAnchorEntries({ userText, spiritkinResponse, emotionState, worldState, bondStage, previousBondStage }),
  ];
  return mergeEntries(entries);
}

function deriveRecurringEntries(text, existingRows = []) {
  const normalized = (existingRows || []).map((row) => normalizeStructuredMemoryRow(row));
  const people = extractNamedPeople(text);
  const topics = extractTopicHints(text);
  const entries = [];

  for (const person of people) {
    const priorMentions = normalized.filter((entry) => (entry.relatedPeople || []).includes(person.toLowerCase()) || entry.content.toLowerCase().includes(person.toLowerCase()));
    if (priorMentions.length >= 1) {
      entries.push(createEntry(MEMORY_TYPES.RECURRING_PERSON, `Recurring person in user's life: ${person}.`, {
        confidence: 0.78,
        importance: 0.64,
        premiumRetentionEligible: true,
        tags: ["recurring_person"],
        relatedPeople: [person],
      }));
    }
  }

  for (const topic of topics) {
    const priorMentions = normalized.filter((entry) => (entry.relatedTopics || []).includes(topic) || (entry.tags || []).includes(topic));
    if (priorMentions.length >= 1) {
      entries.push(createEntry(MEMORY_TYPES.RECURRING_TOPIC, `Recurring topic in bond: ${topic.replace(/_/g, " ")}.`, {
        confidence: 0.74,
        importance: 0.58,
        premiumRetentionEligible: topic === "family" || topic === "spirituality",
        tags: ["recurring_topic", topic],
        relatedTopics: [topic],
      }));
    }
  }
  return mergeEntries(entries);
}

export function normalizeStructuredMemoryRow(row) {
  const meta = row?.meta && typeof row.meta === "object" ? row.meta : {};
  const content = normalizeSummary(row?.content || meta.normalized_summary || "");
  return {
    id: row?.id || null,
    type: meta.memory_type || "unknown",
    content,
    normalizedSummary: meta.normalized_summary || content,
    source: meta.source || "unknown",
    confidence: clamp01(meta.confidence, 0.6),
    importance: clamp01(meta.importance, 0.5),
    recencyScore: clamp01(meta.recency_score, 0.5),
    reuseCount: Math.max(0, Number(meta.reuse_count || 0)),
    createdAt: row?.created_at || null,
    lastReferencedAt: meta.last_referenced_at || null,
    tags: normalizeTags(meta.tags),
    premiumRetentionEligible: Boolean(meta.premium_retention_eligible),
    correctionPriority: clamp01(meta.correction_priority, meta.memory_type === MEMORY_TYPES.CORRECTION ? 1 : 0),
    emotionalWeight: clamp01(meta.emotional_weight, 0),
    retentionState: meta.retention_state || "active",
    relatedPeople: normalizeTags(meta.related_people),
    relatedTopics: normalizeTags(meta.related_topics),
    meta,
  };
}

function buildContextTerms(queryText = "", contextTags = []) {
  return normalizeTags([
    ...String(queryText || "").toLowerCase().split(/[^a-z0-9_]+/g).filter((part) => part.length > 2),
    ...contextTags,
  ]);
}

export function rankMemoryEntry(entry, { queryText = "", contextTags = [] } = {}) {
  const terms = buildContextTerms(queryText, contextTags);
  const text = `${entry.normalizedSummary} ${(entry.tags || []).join(" ")} ${(entry.relatedTopics || []).join(" ")}`.toLowerCase();
  const matches = terms.filter((term) => text.includes(term)).length;
  const relevance = terms.length ? matches / Math.max(terms.length, 1) : 0.35;
  const ageDays = entry.createdAt ? Math.max(0, daysBetween(entry.createdAt, nowIso())) : 365;
  const freshness = Math.max(0.05, 1 - Math.min(ageDays / 120, 0.95));
  const recency = clamp01((entry.recencyScore * 0.6) + (freshness * 0.4), freshness);
  const reuseBoost = Math.min(entry.reuseCount / 5, 1);
  const correctionBoost = entry.type === MEMORY_TYPES.CORRECTION ? 1 : entry.correctionPriority;
  const premiumBoost = entry.premiumRetentionEligible ? 0.08 : 0;
  const retentionPenalty = entry.retentionState === "archived" ? 0.35 : entry.retentionState === "cool" ? 0.12 : 0;

  const score =
    (entry.importance * 0.28) +
    (entry.confidence * 0.18) +
    (recency * 0.16) +
    (relevance * 0.18) +
    (entry.emotionalWeight * 0.1) +
    (reuseBoost * 0.04) +
    (correctionBoost * 0.14) +
    premiumBoost -
    retentionPenalty;

  return {
    score: Math.max(0, Number(score.toFixed(4))),
    relevance,
    recency,
    correctionBoost,
  };
}

function summarizeForBrief(entries) {
  return entries.map((entry) => `• ${entry.content}`).join("\n");
}

export function createStructuredMemoryService({ supabase, bus }) {
  async function listStructuredRows({ userId, spiritkinId = null, limit = RETENTION_HARD_LIMIT, includeArchived = true }) {
    const safeUserId = toUuid(userId);
    let query = supabase
      .from("memories")
      .select("id, kind, content, meta, created_at")
      .eq("user_id", safeUserId)
      .eq("kind", STRUCTURED_MEMORY_KIND)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (spiritkinId) query = query.eq("spiritkin_id", spiritkinId);
    const { data, error } = await query;
    if (error) {
      console.warn("[StructuredMemory] query failed:", error.message);
      return [];
    }
    const rows = (data || []).filter((row) => includeArchived || row?.meta?.retention_state !== "archived");
    return rows;
  }

  async function updateRowMeta(id, meta) {
    const { error } = await supabase
      .from("memories")
      .update({ meta })
      .eq("id", id);
    if (error) console.warn("[StructuredMemory] meta update failed:", error.message);
  }

  async function upsertEntry({ userId, spiritkinId = null, conversationId = null, entry }) {
    const safeUserId = toUuid(userId);
    const summary = normalizeSummary(entry.normalizedSummary || entry.content);
    if (!summary) return { ok: false, skipped: true };

    const existingRows = await listStructuredRows({ userId, spiritkinId, limit: 80 });
    const existing = existingRows.find((row) => {
      const normalized = normalizeStructuredMemoryRow(row);
      return normalized.type === entry.type && normalized.normalizedSummary.toLowerCase() === summary.toLowerCase();
    });

    if (existing) {
      const normalized = normalizeStructuredMemoryRow(existing);
      const meta = {
        ...existing.meta,
        confidence: Math.max(normalized.confidence, entry.confidence),
        importance: Math.max(normalized.importance, entry.importance),
        recency_score: 1,
        reuse_count: normalized.reuseCount + 1,
        last_referenced_at: nowIso(),
        correction_priority: Math.max(normalized.correctionPriority, entry.correctionPriority || 0),
        emotional_weight: Math.max(normalized.emotionalWeight, entry.emotionalWeight || 0),
        tags: normalizeTags([...(normalized.tags || []), ...(entry.tags || [])]),
        related_topics: normalizeTags([...(normalized.relatedTopics || []), ...(entry.relatedTopics || [])]),
        related_people: normalizeTags([...(normalized.relatedPeople || []), ...(entry.relatedPeople || [])]),
        premium_retention_eligible: normalized.premiumRetentionEligible || Boolean(entry.premiumRetentionEligible),
        retention_state: normalized.retentionState === "archived" ? "cool" : normalized.retentionState,
      };
      await updateRowMeta(existing.id, meta);
      bus?.emit?.("structured_memory.updated", { userId: safeUserId, type: entry.type });
      return { ok: true, updated: true, id: existing.id };
    }

    const payload = {
      user_id: safeUserId,
      spiritkin_id: spiritkinId ?? null,
      kind: STRUCTURED_MEMORY_KIND,
      content: summary,
      meta: buildMetadata(entry, conversationId),
    };
    const { data, error } = await supabase.from("memories").insert(payload).select("id").maybeSingle();
    if (error) {
      console.warn("[StructuredMemory] insert failed:", error.message);
      return { ok: false, error: error.message };
    }
    bus?.emit?.("structured_memory.written", { userId: safeUserId, type: entry.type });
    return { ok: true, id: data?.id ?? null };
  }

  async function applyRetention({ userId, spiritkinId = null }) {
    const rows = await listStructuredRows({ userId, spiritkinId, limit: RETENTION_HARD_LIMIT, includeArchived: true });
    if (rows.length <= RETENTION_SOFT_LIMIT) return { ok: true, total: rows.length, cooled: 0, skippedWrites: false };
    const normalized = rows.map((row) => normalizeStructuredMemoryRow(row));
    const scored = normalized
      .map((entry) => ({
        ...entry,
        retentionScore: (entry.importance * 0.35) +
          (entry.confidence * 0.18) +
          (entry.emotionalWeight * 0.14) +
          (entry.correctionPriority * 0.2) +
          (entry.premiumRetentionEligible ? 0.12 : 0) +
          (Math.min(entry.reuseCount / 6, 1) * 0.08),
      }))
      .sort((a, b) => a.retentionScore - b.retentionScore);

    const archiveTargets = scored.filter((entry) =>
      entry.retentionState !== "archived" &&
      entry.type !== MEMORY_TYPES.CORRECTION &&
      entry.type !== MEMORY_TYPES.MILESTONE &&
      entry.type !== MEMORY_TYPES.EMOTIONAL_ANCHOR &&
      !entry.premiumRetentionEligible
    ).slice(0, Math.max(0, rows.length - RETENTION_SOFT_LIMIT));

    await Promise.allSettled(archiveTargets.map(async (entry) => {
      const row = rows.find((candidate) => candidate.id === entry.id);
      if (!row) return;
      await updateRowMeta(entry.id, {
        ...(row.meta || {}),
        retention_state: "archived",
        recency_score: Math.min(clamp01(row.meta?.recency_score, 0.4), 0.25),
      });
    }));

    return {
      ok: true,
      total: rows.length,
      cooled: archiveTargets.length,
      skippedWrites: rows.length >= RETENTION_HARD_LIMIT,
    };
  }

  async function recordInteractionMemories({
    userId,
    spiritkinId = null,
    conversationId = null,
    userText,
    spiritkinResponse = "",
    emotionState = {},
    worldState = {},
    bondStage = null,
    previousBondStage = null,
  }) {
    if (!userId || !userText) return { ok: false, count: 0 };

    const retention = await applyRetention({ userId, spiritkinId });
    const baseEntries = extractStructuredMemories({
      userText,
      spiritkinResponse,
      emotionState,
      worldState,
      bondStage,
      previousBondStage,
    });

    const existingRows = await listStructuredRows({ userId, spiritkinId, limit: 80, includeArchived: true });
    const recurringEntries = deriveRecurringEntries(userText, existingRows);
    const entries = mergeEntries([...baseEntries, ...recurringEntries]);
    const filtered = retention.skippedWrites
      ? entries.filter((entry) => entry.importance >= 0.65 || entry.correctionPriority >= 0.7 || entry.premiumRetentionEligible)
      : entries;

    const results = await Promise.allSettled(filtered.map((entry) =>
      upsertEntry({ userId, spiritkinId, conversationId, entry })
    ));

    return {
      ok: true,
      count: results.filter((result) => result.status === "fulfilled" && result.value?.ok).length,
      skippedLowValue: entries.length - filtered.length,
    };
  }

  async function retrieveRelevantMemories({ userId, spiritkinId = null, conversationId = null, queryText = "", contextTags = [], limit = CONTEXT_LIMIT }) {
    const rows = await listStructuredRows({ userId, spiritkinId, limit: RETENTION_HARD_LIMIT, includeArchived: false });
    const ranked = rows
      .map((row) => {
        const normalized = normalizeStructuredMemoryRow(row);
        const ranking = rankMemoryEntry(normalized, { queryText, contextTags });
        return { row, entry: normalized, ranking };
      })
      .sort((a, b) => b.ranking.score - a.ranking.score)
      .slice(0, limit);

    if (ranked.length && conversationId) {
      const accessRows = ranked.map(({ row, ranking }) => ({
        memory_id: row.id,
        conversation_id: conversationId,
        accessed_at: nowIso(),
        reason: `structured_memory:${ranking.score}`,
      }));
      supabase.from("memory_access").insert(accessRows).then(() => {}).catch(() => {});
    }

    await Promise.allSettled(ranked.map(async ({ row, entry }) => {
      await updateRowMeta(row.id, {
        ...(row.meta || {}),
        reuse_count: entry.reuseCount + 1,
        recency_score: 1,
        last_referenced_at: nowIso(),
      });
    }));

    return ranked.map(({ entry, ranking }) => ({
      ...entry,
      ranking,
    }));
  }

  async function buildContextSnapshot({ userId, spiritkinId = null, conversationId = null, recentText = "", contextTags = [], limit = CONTEXT_LIMIT }) {
    const top = await retrieveRelevantMemories({
      userId,
      spiritkinId,
      conversationId,
      queryText: recentText,
      contextTags,
      limit,
    });
    const corrections = top.filter((entry) => entry.type === MEMORY_TYPES.CORRECTION || entry.correctionPriority >= 0.7);
    const milestones = top.filter((entry) => entry.type === MEMORY_TYPES.MILESTONE || entry.type === MEMORY_TYPES.EMOTIONAL_ANCHOR);
    const preferences = top.filter((entry) => [
      MEMORY_TYPES.PREFERENCE,
      MEMORY_TYPES.AVERSION,
      MEMORY_TYPES.TONE_PREFERENCE,
      MEMORY_TYPES.RESPECT_PREFERENCE,
      MEMORY_TYPES.SPIRITUAL_PREFERENCE,
      MEMORY_TYPES.GAMEPLAY_TENDENCY,
    ].includes(entry.type));

    const sections = [];
    if (corrections.length) sections.push(`CORRECTIONS & BOUNDARIES:\n${summarizeForBrief(corrections.slice(0, 3))}`);
    if (preferences.length) sections.push(`STABLE PREFERENCES:\n${summarizeForBrief(preferences.slice(0, 4))}`);
    if (milestones.length) sections.push(`MILESTONES & EMOTIONAL ANCHORS:\n${summarizeForBrief(milestones.slice(0, 3))}`);

    return {
      top,
      corrections,
      milestones,
      preferences,
      brief: sections.join("\n\n"),
      hasMemories: top.length > 0,
    };
  }

  return {
    extractStructuredMemories,
    recordInteractionMemories,
    retrieveRelevantMemories,
    buildContextSnapshot,
    applyRetention,
    normalizeStructuredMemoryRow,
    rankMemoryEntry,
    MEMORY_TYPES,
    STRUCTURED_MEMORY_KIND,
  };
}
