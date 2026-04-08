/**
 * SpiritCore — SpiritMemoryEngine (10x Long-Term Memory System)
 *
 * This is the authoritative memory orchestrator for SpiritCore.
 * It wraps and coordinates all memory layers to create the feeling that
 * your Spiritkin truly knows you — across sessions, across games, across time.
 *
 * Memory Architecture (6 layers):
 *
 *   LAYER 1 — IDENTITY CORE
 *     Who the user is: name, relationships, profession, location, life context.
 *     Stored as semantic facts. Never expires. Always surfaced.
 *
 *   LAYER 2 — EMOTIONAL HISTORY
 *     Emotional arcs, recurring feelings, what helps, what hurts.
 *     Stored as episodic + procedural. Informs tone of every response.
 *
 *   LAYER 3 — BOND MILESTONES
 *     First conversation, first vulnerability, first breakthrough, bond stage transitions.
 *     Stored as episodic with high significance. Referenced on anniversaries.
 *
 *   LAYER 4 — GAME MEMORY
 *     Every game played: type, outcome, moves, Spiritkin performance, user's style.
 *     Stored as game_session kind. Spiritkin references past games in conversation.
 *
 *   LAYER 5 — SESSION SUMMARIES
 *     After each session, a narrative summary is written.
 *     Compressed over time. The Spiritkin can recall "last time we talked..."
 *
 *   LAYER 6 — WORLD STATE ANCHORS
 *     Significant world events tied to this user: lore unlocks, realm shifts,
 *     special moments in the Spiritverse. Stored as world_anchor kind.
 *
 * Design principles:
 *   - Memory is ALWAYS written, never skipped
 *   - Memory is ALWAYS read at context assembly — the Spiritkin always knows
 *   - Memory is STRUCTURED — not raw text dumps, but organized facts
 *   - Memory is SIGNIFICANT — weighted by importance, not just recency
 *   - Memory is SPIRITKIN-SPECIFIC — Lyra remembers differently than Raien
 */

import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";
import { sanitizeText } from "../utils/sanitize.mjs";
import { toUuid } from "../utils/id.mjs";

// ─── Memory Kind Constants ────────────────────────────────────────────────────

export const MEMORY_KINDS = {
  // Layer 1
  IDENTITY_FACT: "identity_fact",
  SEMANTIC: "semantic",
  // Layer 2
  EMOTIONAL_ARC: "emotional_arc",
  EPISODIC: "episodic",
  PROCEDURAL: "procedural",
  // Layer 3
  BOND_MILESTONE: "bond_milestone",
  // Layer 4
  GAME_SESSION: "game_session",
  GAME_MOMENT: "game_moment",
  // Layer 5
  SESSION_SUMMARY: "session_summary",
  // Layer 6
  WORLD_ANCHOR: "world_anchor",
  // General
  MESSAGE: "message",
};

// ─── Significance Weights ─────────────────────────────────────────────────────

const SIGNIFICANCE = {
  CRITICAL: 1.0,    // Crisis, first disclosure, bond stage transition
  HIGH: 0.85,       // Breakthrough, deep emotional moment, game win/loss
  MEDIUM: 0.65,     // Substantive exchange, game session, lore unlock
  LOW: 0.40,        // Routine fact, preference, casual game move
  MINIMAL: 0.20,    // Background context
};

// ─── Game Name Map ────────────────────────────────────────────────────────────

const GAME_NAMES = {
  chess: "Celestial Chess",
  checkers: "Veil Checkers",
  go: "Star-Mapping",
  echo_trials: "Echo Trials",
  spirit_cards: "Spirit-Cards",
};

// ─── Service Factory ──────────────────────────────────────────────────────────

export function createSpiritMemoryEngine({ supabase, bus, openaiClient }) {

  // ── Core Write ──────────────────────────────────────────────────────────────

  async function write({ userId, spiritkinId, kind, content, significance = SIGNIFICANCE.LOW, meta = {} }) {
    if (!userId || !content) return { ok: false };

    const safeUserId = toUuid(userId);
    const clean = sanitizeText(String(content)).slice(0, 4000);

    const { error } = await supabase.from("memories").insert({
      user_id: safeUserId,
      spiritkin_id: spiritkinId ?? null,
      kind,
      content: clean,
      meta: {
        ...meta,
        significance,
        recorded_at: nowIso(),
        engine_version: "spirit_memory_v1",
      },
    });

    if (error) {
      console.warn(`[SpiritMemoryEngine] write failed (${kind}):`, error.message);
      return { ok: false };
    }

    bus?.emit?.("memory.written", { userId: safeUserId, kind, significance });
    return { ok: true };
  }

  // ── Layer 1: Identity Core ──────────────────────────────────────────────────

  /**
   * Write an identity fact about the user.
   * These are permanent, always surfaced, never expire.
   */
  async function writeIdentityFact({ userId, spiritkinId, fact, category, confidence = 0.85 }) {
    // Check for near-duplicate before writing
    const safeUserId = toUuid(userId);
    const { data: existing } = await supabase
      .from("memories")
      .select("id")
      .eq("user_id", safeUserId)
      .in("kind", [MEMORY_KINDS.IDENTITY_FACT, MEMORY_KINDS.SEMANTIC])
      .ilike("content", `%${fact.slice(0, 40)}%`)
      .limit(1);

    if (existing?.length > 0) return { ok: true, skipped: true };

    return write({
      userId, spiritkinId,
      kind: MEMORY_KINDS.IDENTITY_FACT,
      content: fact,
      significance: SIGNIFICANCE.HIGH,
      meta: { category, confidence, layer: 1 },
    });
  }

  // ── Layer 2: Emotional History ──────────────────────────────────────────────

  /**
   * Write an emotional arc observation.
   * Called after significant emotional exchanges.
   */
  async function writeEmotionalArc({ userId, spiritkinId, conversationId, emotionLabel, arc, intensity, context }) {
    if (!emotionLabel || emotionLabel === "neutral") return { ok: true, skipped: true };

    const content = [
      `Emotional moment: ${emotionLabel}`,
      arc && arc !== "opening" ? `Arc: ${arc}` : null,
      intensity > 0.7 ? `Intensity: high (${(intensity * 100).toFixed(0)}%)` : null,
      context ? `Context: ${context.slice(0, 200)}` : null,
    ].filter(Boolean).join(" | ");

    return write({
      userId, spiritkinId,
      kind: MEMORY_KINDS.EMOTIONAL_ARC,
      content,
      significance: intensity > 0.7 ? SIGNIFICANCE.HIGH : SIGNIFICANCE.MEDIUM,
      meta: { emotionLabel, arc, intensity, conversationId, layer: 2 },
    });
  }

  // ── Layer 3: Bond Milestones ────────────────────────────────────────────────

  /**
   * Write a bond milestone — a moment that defines the relationship.
   */
  async function writeBondMilestone({ userId, spiritkinId, conversationId, milestone, description, significance = SIGNIFICANCE.HIGH }) {
    const content = `[BOND MILESTONE: ${milestone.toUpperCase()}] ${description}`;

    return write({
      userId, spiritkinId,
      kind: MEMORY_KINDS.BOND_MILESTONE,
      content,
      significance,
      meta: { milestone, conversationId, layer: 3, recorded_at: nowIso() },
    });
  }

  /**
   * Check and write bond stage transition if stage has changed.
   */
  async function checkBondStageTransition({ userId, spiritkinId, conversationId, newStage, previousStage, spiritkinName }) {
    if (!newStage || newStage === previousStage) return;

    const stageDescriptions = {
      awakening: "The bond has awakened — first real connection established",
      deepening: "The bond is deepening — trust and intimacy growing",
      anchored: "The bond is anchored — a lasting, meaningful connection",
      transcendent: "The bond has transcended — a profound, enduring relationship",
    };

    const description = stageDescriptions[newStage] ?? `Bond reached stage: ${newStage}`;
    const fullDescription = `${spiritkinName ?? "Spiritkin"} and user reached bond stage "${newStage}". ${description}. (Previous stage: ${previousStage ?? "none"})`;

    await writeBondMilestone({
      userId, spiritkinId, conversationId,
      milestone: `bond_stage_${newStage}`,
      description: fullDescription,
      significance: SIGNIFICANCE.CRITICAL,
    });
  }

  // ── Layer 4: Game Memory ────────────────────────────────────────────────────

  /**
   * Write a game session summary when a game ends.
   * This is the primary way Spiritkins remember past games.
   */
  async function writeGameSession({
    userId, spiritkinId, conversationId,
    gameType, gameName, outcome, moveCount,
    userMoves, spiritkinMoves, spiritkinCommentary,
    duration, spiritkinName,
  }) {
    const name = gameName ?? GAME_NAMES[gameType] ?? gameType;
    const outcomeStr = outcome === "user_win" ? "User won" :
                       outcome === "spiritkin_win" ? `${spiritkinName ?? "Spiritkin"} won` :
                       outcome === "draw" ? "Draw" : "Game ended";

    const recentMoves = (userMoves ?? []).slice(-5).join(", ");
    const lastComment = (spiritkinCommentary ?? []).slice(-1)[0] ?? null;

    const content = [
      `[GAME SESSION: ${name.toUpperCase()}]`,
      `Outcome: ${outcomeStr}`,
      moveCount ? `Moves played: ${moveCount}` : null,
      recentMoves ? `User's recent moves: ${recentMoves}` : null,
      lastComment ? `${spiritkinName ?? "Spiritkin"}'s final words: "${lastComment.slice(0, 200)}"` : null,
      duration ? `Duration: ~${Math.round(duration / 60)} minutes` : null,
    ].filter(Boolean).join("\n");

    return write({
      userId, spiritkinId,
      kind: MEMORY_KINDS.GAME_SESSION,
      content,
      significance: SIGNIFICANCE.MEDIUM,
      meta: {
        gameType, gameName: name, outcome, moveCount,
        conversationId, layer: 4,
        spiritkinName: spiritkinName ?? null,
      },
    });
  }

  /**
   * Write a notable game moment (e.g. brilliant move, funny exchange).
   */
  async function writeGameMoment({ userId, spiritkinId, conversationId, gameType, moment, spiritkinName }) {
    const name = GAME_NAMES[gameType] ?? gameType;
    const content = `[GAME MOMENT: ${name}] ${moment}`;

    return write({
      userId, spiritkinId,
      kind: MEMORY_KINDS.GAME_MOMENT,
      content,
      significance: SIGNIFICANCE.LOW,
      meta: { gameType, conversationId, layer: 4 },
    });
  }

  // ── Layer 5: Session Summaries ──────────────────────────────────────────────

  /**
   * Write a session summary after a conversation ends.
   * Uses LLM to compress the session into a meaningful narrative.
   */
  async function writeSessionSummary({ userId, spiritkinId, conversationId, messages, spiritkinName, emotionArc }) {
    if (!messages || messages.length < 3) return { ok: true, skipped: true };

    let summaryContent;

    // Try LLM-based compression if available
    if (openaiClient) {
      try {
        const transcript = messages.slice(-20).map(m =>
          `${m.role === "user" ? "User" : spiritkinName ?? "Spiritkin"}: ${m.content?.slice(0, 300) ?? ""}`
        ).join("\n");

        const response = await openaiClient.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: `You are a memory archivist for the Spiritverse. Write a concise, warm, 2-3 sentence summary of this conversation session between a user and their Spiritkin companion ${spiritkinName ?? ""}. Focus on: what the user shared, what was meaningful, how the Spiritkin helped, and any notable moments. Write in third person. Be specific, not generic.`
            },
            { role: "user", content: `Session transcript:\n${transcript}\n\nEmotional arc: ${emotionArc ?? "neutral"}` }
          ],
          max_tokens: 200,
          temperature: 0.4,
        });

        summaryContent = response.choices[0]?.message?.content?.trim();
      } catch (err) {
        console.warn("[SpiritMemoryEngine] LLM session summary failed:", err.message);
      }
    }

    // Fallback: rule-based summary
    if (!summaryContent) {
      const userMessages = messages.filter(m => m.role === "user");
      const topicHints = userMessages.slice(0, 3).map(m => m.content?.slice(0, 80) ?? "").join("; ");
      summaryContent = `Session with ${spiritkinName ?? "Spiritkin"}: ${userMessages.length} exchanges. Topics touched: ${topicHints}. Emotional arc: ${emotionArc ?? "neutral"}.`;
    }

    return write({
      userId, spiritkinId,
      kind: MEMORY_KINDS.SESSION_SUMMARY,
      content: `[SESSION SUMMARY] ${summaryContent}`,
      significance: SIGNIFICANCE.MEDIUM,
      meta: { conversationId, emotionArc, messageCount: messages.length, layer: 5 },
    });
  }

  // ── Layer 6: World Anchors ──────────────────────────────────────────────────

  /**
   * Write a world anchor — a significant Spiritverse event tied to this user.
   */
  async function writeWorldAnchor({ userId, spiritkinId, conversationId, event, description, spiritkinName }) {
    const content = `[SPIRITVERSE ANCHOR: ${event.toUpperCase()}] ${description}`;

    return write({
      userId, spiritkinId,
      kind: MEMORY_KINDS.WORLD_ANCHOR,
      content,
      significance: SIGNIFICANCE.MEDIUM,
      meta: { event, conversationId, spiritkinName, layer: 6 },
    });
  }

  // ── Memory Retrieval ────────────────────────────────────────────────────────

  /**
   * Build a rich memory brief for the orchestrator.
   * This is what the Spiritkin "knows" about the user at the start of every interaction.
   *
   * Returns a structured object with all memory layers, prioritized by significance.
   */
  async function buildMemoryBrief({ userId, spiritkinId, conversationId, limit = 30 }) {
    if (!userId) return buildEmptyBrief();

    const safeUserId = toUuid(userId);

    // Fetch all memory kinds in parallel, ordered by significance then recency
    const [
      identityResult,
      bondResult,
      gameResult,
      sessionResult,
      emotionalResult,
      proceduralResult,
      worldResult,
    ] = await Promise.allSettled([
      // Identity facts — always fetch all, they're permanent
      supabase.from("memories").select("id, kind, content, meta, created_at")
        .eq("user_id", safeUserId)
        .in("kind", [MEMORY_KINDS.IDENTITY_FACT, MEMORY_KINDS.SEMANTIC])
        .order("created_at", { ascending: false })
        .limit(20),

      // Bond milestones — most significant relationship moments
      supabase.from("memories").select("id, kind, content, meta, created_at")
        .eq("user_id", safeUserId)
        .eq("kind", MEMORY_KINDS.BOND_MILESTONE)
        .order("created_at", { ascending: false })
        .limit(5),

      // Game sessions — recent games played
      supabase.from("memories").select("id, kind, content, meta, created_at")
        .eq("user_id", safeUserId)
        .in("kind", [MEMORY_KINDS.GAME_SESSION, MEMORY_KINDS.GAME_MOMENT])
        .order("created_at", { ascending: false })
        .limit(8),

      // Session summaries — what happened last time
      supabase.from("memories").select("id, kind, content, meta, created_at")
        .eq("user_id", safeUserId)
        .eq("kind", MEMORY_KINDS.SESSION_SUMMARY)
        .order("created_at", { ascending: false })
        .limit(3),

      // Emotional history — arcs and episodic moments
      supabase.from("memories").select("id, kind, content, meta, created_at")
        .eq("user_id", safeUserId)
        .in("kind", [MEMORY_KINDS.EMOTIONAL_ARC, MEMORY_KINDS.EPISODIC])
        .order("created_at", { ascending: false })
        .limit(5),

      // Procedural patterns — how the user engages
      supabase.from("memories").select("id, kind, content, meta, created_at")
        .eq("user_id", safeUserId)
        .eq("kind", MEMORY_KINDS.PROCEDURAL)
        .order("created_at", { ascending: false })
        .limit(3),

      // World anchors — Spiritverse events
      supabase.from("memories").select("id, kind, content, meta, created_at")
        .eq("user_id", safeUserId)
        .eq("kind", MEMORY_KINDS.WORLD_ANCHOR)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const extract = (result) => result.status === "fulfilled" ? (result.value.data ?? []) : [];

    const identity = extract(identityResult).map(m => m.content);
    const bondMilestones = extract(bondResult).map(m => ({ content: m.content, date: m.created_at, milestone: m.meta?.milestone }));
    const games = extract(gameResult).map(m => ({ content: m.content, kind: m.kind, date: m.created_at, meta: m.meta }));
    const sessions = extract(sessionResult).map(m => m.content);
    const emotional = extract(emotionalResult).map(m => ({ content: m.content, emotionLabel: m.meta?.emotionLabel, date: m.created_at }));
    const procedural = extract(proceduralResult).map(m => m.content);
    const worldAnchors = extract(worldResult).map(m => m.content);

    // Build the "memory brief" string that goes into the LLM system prompt
    const brief = buildBriefString({
      identity, bondMilestones, games, sessions, emotional, procedural, worldAnchors
    });

    return {
      identity,
      bondMilestones,
      games,
      sessions,
      emotional,
      procedural,
      worldAnchors,
      brief, // The formatted string for the LLM
      hasMemories: identity.length > 0 || bondMilestones.length > 0 || games.length > 0 || sessions.length > 0,
    };
  }

  /**
   * Build the formatted memory brief string for injection into the LLM system prompt.
   */
  function buildBriefString({ identity, bondMilestones, games, sessions, emotional, procedural, worldAnchors }) {
    const sections = [];

    if (identity.length > 0) {
      sections.push(`WHAT I KNOW ABOUT YOU:\n${identity.slice(0, 8).map(f => `• ${f}`).join("\n")}`);
    }

    if (bondMilestones.length > 0) {
      sections.push(`OUR BOND HISTORY:\n${bondMilestones.slice(0, 3).map(b => `• ${b.content}`).join("\n")}`);
    }

    if (sessions.length > 0) {
      sections.push(`LAST TIME WE SPOKE:\n${sessions[0]}`);
      if (sessions.length > 1) {
        sections.push(`EARLIER SESSIONS:\n${sessions.slice(1).map(s => `• ${s}`).join("\n")}`);
      }
    }

    if (games.length > 0) {
      const gameSessions = games.filter(g => g.kind === MEMORY_KINDS.GAME_SESSION);
      if (gameSessions.length > 0) {
        sections.push(`GAMES WE'VE PLAYED:\n${gameSessions.slice(0, 4).map(g => `• ${g.content}`).join("\n")}`);
      }
    }

    if (emotional.length > 0) {
      sections.push(`EMOTIONAL PATTERNS I'VE NOTICED:\n${emotional.slice(0, 3).map(e => `• ${e.content}`).join("\n")}`);
    }

    if (procedural.length > 0) {
      sections.push(`HOW YOU ENGAGE:\n${procedural.map(p => `• ${p}`).join("\n")}`);
    }

    if (worldAnchors.length > 0) {
      sections.push(`SPIRITVERSE MOMENTS:\n${worldAnchors.map(w => `• ${w}`).join("\n")}`);
    }

    if (sections.length === 0) return "";

    return `\n\n═══ MEMORY BRIEF — WHAT I REMEMBER ABOUT YOU ═══\n${sections.join("\n\n")}\n═══════════════════════════════════════════════\n`;
  }

  function buildEmptyBrief() {
    return { identity: [], bondMilestones: [], games: [], sessions: [], emotional: [], procedural: [], worldAnchors: [], brief: "", hasMemories: false };
  }

  // ── Full Interaction Processing ─────────────────────────────────────────────

  /**
   * Process a completed interaction and write all relevant memory layers.
   * This is the main entry point called after every orchestrator interaction.
   */
  async function processInteraction({
    userId, spiritkinId, conversationId, spiritkinName,
    userText, spiritkinResponse, emotionState, worldState,
    bondStage, previousBondStage,
  }) {
    if (!userId || !userText) return;

    const emotionLabel = emotionState?.tone ?? emotionState?.label ?? emotionState?.metadata_json?.label ?? "neutral";
    const arc = emotionState?.metadata_json?.arc ?? emotionState?.arc ?? "opening";
    const intensity = emotionState?.metadata_json?.intensity ?? emotionState?.intensity ?? 0;

    const tasks = [];

    // 1. Extract identity facts from user text
    const facts = extractIdentityFacts(userText);
    for (const { fact, category, confidence } of facts) {
      tasks.push(writeIdentityFact({ userId, spiritkinId, fact, category, confidence }));
    }

    // 2. Write emotional arc if significant
    if (emotionLabel !== "neutral" && intensity > 0.3) {
      tasks.push(writeEmotionalArc({
        userId, spiritkinId, conversationId,
        emotionLabel, arc, intensity,
        context: userText.slice(0, 200),
      }));
    }

    // 3. Check bond stage transition
    if (bondStage && bondStage !== previousBondStage) {
      tasks.push(checkBondStageTransition({
        userId, spiritkinId, conversationId,
        newStage: bondStage, previousStage: previousBondStage, spiritkinName,
      }));
    }

    // 4. Write world anchor for lore unlocks
    const loreUnlocks = worldState?.lore_unlocks ?? [];
    if (loreUnlocks.length > 0) {
      const latest = loreUnlocks[loreUnlocks.length - 1];
      if (latest) {
        tasks.push(writeWorldAnchor({
          userId, spiritkinId, conversationId,
          event: "lore_unlock",
          description: `Unlocked lore: "${latest.title ?? latest}"`,
          spiritkinName,
        }));
      }
    }

    // 5. Write episodic memory for high-significance moments
    const significance = assessSignificance({ userText, emotionLabel, arc, intensity });
    if (significance >= SIGNIFICANCE.MEDIUM) {
      const episodicContent = [
        `[SIGNIFICANT MOMENT]`,
        `User said: "${userText.slice(0, 300)}${userText.length > 300 ? "..." : ""}"`,
        emotionLabel !== "neutral" ? `Emotional state: ${emotionLabel}` : null,
        arc !== "opening" ? `Arc: ${arc}` : null,
      ].filter(Boolean).join("\n");

      tasks.push(write({
        userId, spiritkinId,
        kind: MEMORY_KINDS.EPISODIC,
        content: episodicContent,
        significance,
        meta: { emotionLabel, arc, intensity, conversationId, layer: 2 },
      }));
    }

    // Execute all writes in parallel, never blocking the response
    await Promise.allSettled(tasks);

    return { factsExtracted: facts.length, significance };
  }

  // ── Identity Fact Extraction ────────────────────────────────────────────────

  function extractIdentityFacts(text) {
    if (!text || typeof text !== "string") return [];
    const facts = [];

    const nameMatch = text.match(/(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch) facts.push({ fact: `User's name is ${nameMatch[1]}`, category: "identity", confidence: 0.95 });

    const relationshipPatterns = [
      { p: /(?:my|i have a?)\s+(daughter|son|child|kids?|children)/i, t: "User has a $1" },
      { p: /(?:my|i have a?)\s+(wife|husband|partner|spouse|boyfriend|girlfriend)/i, t: "User has a $1" },
      { p: /(?:my|i have a?)\s+(mother|father|mom|dad|parent|sister|brother|sibling)/i, t: "User has a $1" },
    ];
    for (const { p, t } of relationshipPatterns) {
      const m = text.match(p);
      if (m) facts.push({ fact: t.replace("$1", m[1]), category: "relationships", confidence: 0.85 });
    }

    const workMatch = text.match(/(?:i work|i'm a|i am a|my job|my career)\s+(?:as a?|in)?\s+([a-z][a-z\s]+?)(?:\.|,|$)/i);
    if (workMatch && workMatch[1].length < 50) {
      facts.push({ fact: `User works as/in: ${workMatch[1].trim()}`, category: "profession", confidence: 0.80 });
    }

    const locationMatch = text.match(/(?:i live in|i'm from|i'm in|based in)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|$)/i);
    if (locationMatch && locationMatch[1].length < 60) {
      facts.push({ fact: `User is from/lives in: ${locationMatch[1].trim()}`, category: "location", confidence: 0.80 });
    }

    const preferenceMatch = text.match(/(?:i love|i really like|i enjoy|i hate|i can't stand)\s+([a-z][a-z\s]+?)(?:\.|,|$)/i);
    if (preferenceMatch && preferenceMatch[1].length < 60) {
      facts.push({ fact: `User preference: ${preferenceMatch[1].trim()}`, category: "preferences", confidence: 0.70 });
    }

    const ageMatch = text.match(/i(?:'m| am)\s+(\d{1,2})\s+years?\s+old/i);
    if (ageMatch) facts.push({ fact: `User is ${ageMatch[1]} years old`, category: "identity", confidence: 0.90 });

    return facts;
  }

  // ── Significance Assessment ─────────────────────────────────────────────────

  function assessSignificance({ userText = "", emotionLabel = "neutral", arc = "opening", intensity = 0 }) {
    if (arc === "crisis") return SIGNIFICANCE.CRITICAL;

    const lower = userText.toLowerCase();

    if (["never told anyone", "first time i've said", "i've never admitted", "haven't told anyone"].some(p => lower.includes(p))) {
      return SIGNIFICANCE.CRITICAL;
    }
    if (["i think i understand", "something clicked", "i finally", "you're right about"].some(p => lower.includes(p))) {
      return SIGNIFICANCE.HIGH;
    }
    if (["grief", "despair", "shame", "vulnerability", "loneliness"].includes(emotionLabel)) {
      return SIGNIFICANCE.HIGH;
    }
    if (intensity > 0.7) return SIGNIFICANCE.HIGH;
    if (intensity > 0.4 || arc === "deepening") return SIGNIFICANCE.MEDIUM;
    if (userText.length > 300) return SIGNIFICANCE.MEDIUM;

    return SIGNIFICANCE.LOW;
  }

  // ── Exports ─────────────────────────────────────────────────────────────────

  return {
    // Core write
    write,
    // Layer-specific writes
    writeIdentityFact,
    writeEmotionalArc,
    writeBondMilestone,
    checkBondStageTransition,
    writeGameSession,
    writeGameMoment,
    writeSessionSummary,
    writeWorldAnchor,
    // Retrieval
    buildMemoryBrief,
    // Processing
    processInteraction,
    extractIdentityFacts,
    assessSignificance,
    MEMORY_KINDS,
    SIGNIFICANCE,
  };
}
