/**
 * SpiritCore — Hierarchical Memory Service
 *
 * Three-layer memory architecture that makes users feel truly known:
 *
 *   SEMANTIC   — Facts about the user: name, relationships, preferences, life context
 *                "Alex has a daughter named Maya. They work in healthcare."
 *
 *   EPISODIC   — Significant moments: milestones, breakthroughs, hard conversations
 *                "First time Alex talked about their mother's illness (Session 3)"
 *
 *   PROCEDURAL — Behavioral patterns: how the user engages, what helps them, rhythms
 *                "Alex usually comes back after difficult Mondays. Responds well to direct questions."
 *
 * Each memory has a significance score (0.0–1.0) that determines:
 *   - How often it surfaces in context
 *   - Whether it triggers a proactive engagement
 *   - When it gets promoted to long-term storage
 *
 * This service wraps the existing memory.mjs and adds the hierarchical layer
 * without replacing or breaking the existing system.
 */

import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";
import { sanitizeText } from "../utils/sanitize.mjs";
import { toUuid } from "../utils/id.mjs";

// ─── Semantic Fact Extractor ──────────────────────────────────────────────────

/**
 * Extract semantic facts from a user message.
 * Returns an array of fact objects if facts are detected.
 *
 * @param {string} text
 * @returns {Array<{ fact: string, category: string, confidence: number }>}
 */
export function extractSemanticFacts(text) {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase();
  const facts = [];

  // Name patterns
  const nameMatch = text.match(/(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+)/i);
  if (nameMatch) {
    facts.push({ fact: `User's name is ${nameMatch[1]}`, category: "identity", confidence: 0.95 });
  }

  // Relationship patterns
  const relationshipPatterns = [
    { pattern: /(?:my|i have a?)\s+(daughter|son|child|kids?|children)/i, template: "User has a $1" },
    { pattern: /(?:my|i have a?)\s+(wife|husband|partner|spouse|boyfriend|girlfriend)/i, template: "User has a $1" },
    { pattern: /(?:my|i have a?)\s+(mother|father|mom|dad|parent|sister|brother|sibling)/i, template: "User has a $1" },
  ];
  for (const { pattern, template } of relationshipPatterns) {
    const m = text.match(pattern);
    if (m) facts.push({ fact: template.replace("$1", m[1]), category: "relationships", confidence: 0.85 });
  }

  // Work/profession patterns
  const workMatch = text.match(/(?:i work|i'm a|i am a|my job|my career)\s+(?:as a?|in)?\s+([a-z\s]+?)(?:\.|,|$)/i);
  if (workMatch && workMatch[1].length < 50) {
    facts.push({ fact: `User works as/in: ${workMatch[1].trim()}`, category: "profession", confidence: 0.80 });
  }

  // Location patterns
  const locationMatch = text.match(/(?:i live in|i'm from|i'm in|based in)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|$)/i);
  if (locationMatch && locationMatch[1].length < 60) {
    facts.push({ fact: `User is from/lives in: ${locationMatch[1].trim()}`, category: "location", confidence: 0.80 });
  }

  // Health/struggle patterns
  const healthPatterns = [
    /(?:i have|i've been diagnosed with|i struggle with|i deal with)\s+([a-z\s]+?)(?:\.|,|and|$)/i,
    /(?:i've been going through|dealing with)\s+([a-z\s]+?)(?:\.|,|$)/i,
  ];
  for (const pattern of healthPatterns) {
    const m = text.match(pattern);
    if (m && m[1].length < 80) {
      facts.push({ fact: `User mentioned: ${m[1].trim()}`, category: "personal_context", confidence: 0.75 });
    }
  }

  // Preference patterns
  const preferenceMatch = text.match(/(?:i love|i really like|i enjoy|i hate|i can't stand|i don't like)\s+([a-z\s]+?)(?:\.|,|$)/i);
  if (preferenceMatch && preferenceMatch[1].length < 60) {
    facts.push({ fact: `User preference: ${preferenceMatch[1].trim()}`, category: "preferences", confidence: 0.70 });
  }

  return facts;
}

/**
 * Assess the episodic significance of a message exchange.
 * Returns a significance score (0.0–1.0) and a milestone label if significant.
 *
 * @param {{ userText: string, spiritkinResponse: string, emotionLabel: string, arc: string }} opts
 * @returns {{ score: number, milestone: string|null, reason: string }}
 */
export function assessEpisodicSignificance({ userText, spiritkinResponse = "", emotionLabel = "neutral", arc = "opening" }) {
  let score = 0.1;
  let milestone = null;
  let reason = "routine exchange";

  const lower = (userText ?? "").toLowerCase();
  const responseLen = (spiritkinResponse ?? "").length;

  // Crisis — always highest significance
  if (arc === "crisis") {
    return { score: 1.0, milestone: "crisis_moment", reason: "User was in crisis state" };
  }

  // First disclosure patterns
  const firstDisclosurePatterns = [
    "never told anyone", "first time i've said", "i've never admitted",
    "haven't told anyone", "keeping this secret", "hard to say this"
  ];
  if (firstDisclosurePatterns.some(p => lower.includes(p))) {
    score = 0.95;
    milestone = "first_disclosure";
    reason = "User shared something for the first time";
  }

  // Breakthrough patterns
  const breakthroughPatterns = [
    "i think i understand now", "that makes sense", "i never thought of it that way",
    "you're right", "that's exactly it", "i finally", "something clicked"
  ];
  if (breakthroughPatterns.some(p => lower.includes(p))) {
    score = Math.max(score, 0.85);
    milestone = milestone ?? "breakthrough";
    reason = "User had a breakthrough or insight";
  }

  // Deep emotional disclosure
  if (["grief", "despair", "shame", "vulnerability", "loneliness"].includes(emotionLabel)) {
    score = Math.max(score, 0.80);
    milestone = milestone ?? "deep_emotional_disclosure";
    reason = `User expressed deep ${emotionLabel}`;
  }

  // Resolution/healing patterns
  const resolutionPatterns = [
    "i feel better", "thank you for", "i'm going to", "i've decided",
    "i'm ready", "i can do this", "i will try"
  ];
  if (resolutionPatterns.some(p => lower.includes(p)) && arc === "resolving") {
    score = Math.max(score, 0.75);
    milestone = milestone ?? "resolution_moment";
    reason = "User reached a resolution or commitment";
  }

  // Long, substantive exchanges
  if (userText.length > 400 && responseLen > 600) {
    score = Math.max(score, 0.60);
    reason = reason === "routine exchange" ? "Substantive deep exchange" : reason;
  }

  // Moderate emotional engagement
  if (["anxiety", "fear", "anger", "exhaustion", "longing"].includes(emotionLabel)) {
    score = Math.max(score, 0.50);
  }

  return { score: Math.round(score * 100) / 100, milestone, reason };
}

/**
 * Detect behavioral patterns from a sequence of memory records.
 * Returns pattern observations for procedural memory.
 *
 * @param {Array<object>} memories — recent memory records
 * @returns {Array<{ pattern: string, confidence: number }>}
 */
export function detectProceduralPatterns(memories) {
  if (!Array.isArray(memories) || memories.length < 3) return [];
  const patterns = [];

  // Time-of-day patterns
  const hours = memories
    .map(m => m.created_at ? new Date(m.created_at).getHours() : null)
    .filter(h => h !== null);
  if (hours.length >= 5) {
    const eveningCount = hours.filter(h => h >= 18 && h <= 23).length;
    const morningCount = hours.filter(h => h >= 6 && h <= 10).length;
    if (eveningCount / hours.length > 0.6) {
      patterns.push({ pattern: "User typically engages in the evening", confidence: 0.80 });
    } else if (morningCount / hours.length > 0.6) {
      patterns.push({ pattern: "User typically engages in the morning", confidence: 0.80 });
    }
  }

  // Frequency patterns
  if (memories.length >= 10) {
    patterns.push({ pattern: `User has engaged ${memories.length}+ times — this is an established bond`, confidence: 0.90 });
  }

  // Emotional pattern detection
  const emotionLabels = memories
    .map(m => m.meta?.emotion_label ?? m.meta?.emotion ?? null)
    .filter(Boolean);
  if (emotionLabels.length >= 5) {
    const anxietyCount = emotionLabels.filter(e => e === "anxiety").length;
    const griefCount = emotionLabels.filter(e => e === "grief").length;
    if (anxietyCount / emotionLabels.length > 0.4) {
      patterns.push({ pattern: "User frequently carries anxiety — gentle grounding is effective", confidence: 0.75 });
    }
    if (griefCount / emotionLabels.length > 0.3) {
      patterns.push({ pattern: "User has been processing grief across multiple sessions", confidence: 0.80 });
    }
  }

  return patterns;
}

// ─── Service Factory ──────────────────────────────────────────────────────────

export function createHierarchicalMemoryService({ supabase, bus }) {

  /**
   * Write a semantic fact to memory.
   * Facts are stored with kind="semantic" and a significance score.
   */
  async function writeSemantic({ userId, spiritkinId, fact, category, confidence = 0.8 }) {
    if (!userId || !fact) throw new AppError("VALIDATION", "userId and fact are required", 400);
    const safeUserId = toUuid(userId);

    const { error } = await supabase.from("memories").insert({
      user_id: safeUserId,
      spiritkin_id: spiritkinId ?? null,
      kind: "semantic",
      content: sanitizeText(fact).slice(0, 500),
      meta: { category, confidence, layer: "semantic" }
    });

    if (error) console.warn("[HierarchicalMemory] Failed to write semantic fact:", error.message);
    else bus?.emit?.("memory.semantic.written", { userId: safeUserId, category });

    return { ok: !error };
  }

  /**
   * Write an episodic memory — a significant moment in the bond's history.
   */
  async function writeEpisodic({ userId, spiritkinId, conversationId, content, milestone, significance, reason }) {
    if (!userId || !content) throw new AppError("VALIDATION", "userId and content are required", 400);
    const safeUserId = toUuid(userId);

    const { error } = await supabase.from("memories").insert({
      user_id: safeUserId,
      spiritkin_id: spiritkinId ?? null,
      kind: "episodic",
      content: sanitizeText(content).slice(0, 2000),
      meta: {
        layer: "episodic",
        milestone: milestone ?? null,
        significance: significance ?? 0.5,
        reason: reason ?? null,
        conversation_id: conversationId ?? null,
        recorded_at: nowIso()
      }
    });

    if (error) console.warn("[HierarchicalMemory] Failed to write episodic memory:", error.message);
    else bus?.emit?.("memory.episodic.written", { userId: safeUserId, milestone, significance });

    return { ok: !error };
  }

  /**
   * Write a procedural pattern observation.
   */
  async function writeProcedural({ userId, spiritkinId, pattern, confidence }) {
    if (!userId || !pattern) throw new AppError("VALIDATION", "userId and pattern are required", 400);
    const safeUserId = toUuid(userId);

    // Check if this pattern already exists to avoid duplicates
    const { data: existing } = await supabase
      .from("memories")
      .select("id")
      .eq("user_id", safeUserId)
      .eq("kind", "procedural")
      .ilike("content", `%${pattern.slice(0, 40)}%`)
      .limit(1);

    if (existing?.length > 0) return { ok: true, skipped: true };

    const { error } = await supabase.from("memories").insert({
      user_id: safeUserId,
      spiritkin_id: spiritkinId ?? null,
      kind: "procedural",
      content: sanitizeText(pattern).slice(0, 500),
      meta: { layer: "procedural", confidence: confidence ?? 0.7 }
    });

    if (error) console.warn("[HierarchicalMemory] Failed to write procedural pattern:", error.message);
    return { ok: !error };
  }

  /**
   * Process a completed interaction and automatically extract/store hierarchical memories.
   * This is the main entry point — called after every interaction completes.
   *
   * @param {{ userId, spiritkinId, conversationId, userText, spiritkinResponse, emotionState }} opts
   */
  async function processInteraction({ userId, spiritkinId, conversationId, userText, spiritkinResponse, emotionState }) {
    if (!userId || !userText) return;

    const emotionLabel = emotionState?.label ?? emotionState?.metadata_json?.label ?? "neutral";
    const arc = emotionState?.metadata_json?.arc ?? "opening";

    // 1. Extract and store semantic facts
    const facts = extractSemanticFacts(userText);
    for (const { fact, category, confidence } of facts) {
      await writeSemantic({ userId, spiritkinId, fact, category, confidence }).catch(() => {});
    }

    // 2. Assess and store episodic significance
    const { score, milestone, reason } = assessEpisodicSignificance({
      userText, spiritkinResponse, emotionLabel, arc
    });

    if (score >= 0.5) {
      const episodicContent = [
        milestone ? `[${milestone.toUpperCase()}]` : "[SIGNIFICANT MOMENT]",
        `User said: "${userText.slice(0, 300)}${userText.length > 300 ? "..." : ""}"`,
        reason ? `Context: ${reason}` : "",
        emotionLabel !== "neutral" ? `Emotional state: ${emotionLabel}` : ""
      ].filter(Boolean).join("\n");

      await writeEpisodic({
        userId, spiritkinId, conversationId,
        content: episodicContent,
        milestone, significance: score, reason
      }).catch(() => {});
    }

    // 3. Emit event for proactive engagement engine
    if (score >= 0.8) {
      bus?.emit?.("memory.milestone.reached", {
        userId, spiritkinId, milestone, significance: score, emotionLabel
      });
    }

    return { factsExtracted: facts.length, episodicScore: score, milestone };
  }

  /**
   * Get a hierarchical memory summary for context assembly.
   * Returns semantic facts, recent episodic milestones, and procedural patterns.
   */
  async function getHierarchicalContext({ userId, spiritkinId, limit = 5 }) {
    if (!userId) return { semantic: [], episodic: [], procedural: [] };
    const safeUserId = toUuid(userId);

    const baseQuery = supabase
      .from("memories")
      .select("id, kind, content, meta, created_at")
      .eq("user_id", safeUserId);

    const spiritkinFilter = spiritkinId ? baseQuery.eq("spiritkin_id", spiritkinId) : baseQuery;

    const [semanticResult, episodicResult, proceduralResult] = await Promise.all([
      spiritkinFilter.eq("kind", "semantic").order("created_at", { ascending: false }).limit(limit),
      spiritkinFilter.eq("kind", "episodic").order("created_at", { ascending: false }).limit(limit),
      spiritkinFilter.eq("kind", "procedural").order("created_at", { ascending: false }).limit(3),
    ]);

    const semantic = (semanticResult.data ?? []).map(m => m.content);
    const episodic = (episodicResult.data ?? []).map(m => ({
      content: m.content,
      milestone: m.meta?.milestone ?? null,
      significance: m.meta?.significance ?? 0.5,
      date: m.created_at
    }));
    const procedural = (proceduralResult.data ?? []).map(m => m.content);

    return { semantic, episodic, procedural };
  }

  return {
    writeSemantic,
    writeEpisodic,
    writeProcedural,
    processInteraction,
    getHierarchicalContext,
    // Export utilities for use in other services
    extractSemanticFacts,
    assessEpisodicSignificance,
    detectProceduralPatterns,
  };
}
