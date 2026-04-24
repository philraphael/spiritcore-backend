/**
 * SpiritCore — Context Service (v2)
 *
 * Upgraded to inject hierarchical memory layers and echoes fragments
 * into the context bundle passed to the adapter layer.
 *
 * Context bundle now includes:
 *   - emotion state (rich: label, valence, arousal, intensity, trajectory, arc)
 *   - recent episodes
 *   - latest summary episode
 *   - recent memories (canonical path: `memories` table)
 *   - hierarchical memory (semantic facts, episodic milestones, procedural patterns)
 *   - echoes fragment (realm description, contextual phrase, Charter law)
 */

import { AppError } from "../errors.mjs";
import { getEchoFragment } from "../canon/spiritverseEchoes.mjs";

function numberOrDefault(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scoreMemory(memory = {}, index = 0) {
  const meta = memory?.meta && typeof memory.meta === "object" ? memory.meta : {};
  const importance = numberOrDefault(meta.importance, 0.35);
  const confidence = numberOrDefault(meta.confidence_score ?? meta.confidence, 0.45);
  const resonance = numberOrDefault(meta.legacy_resonance_score ?? memory?.resonance_score, 0.25);
  const reuse = Math.min(numberOrDefault(meta.reuse_count, 0) / 5, 1);
  const score = (importance * 0.38) + (confidence * 0.28) + (resonance * 0.22) + (reuse * 0.12) - (index * 0.02);
  return Number(Math.max(0, score).toFixed(3));
}

function buildWeightedMemories(memories = []) {
  return (Array.isArray(memories) ? memories : [])
    .map((memory, index) => ({
      ...memory,
      weight: scoreMemory(memory, index),
    }))
    .sort((a, b) => (b.weight || 0) - (a.weight || 0));
}

export function createContextService({ supabase, emotionService, episodeService, memoryService, messageService, hierarchicalMemoryService, structuredMemoryService, worldService, adaptiveProfileService }) {

  /**
   * Assemble the full context bundle for a conversation turn.
   *
   * @param {{ userId, spiritkinId, conversationId, recentText, policy, spiritkinName, bondStage, prefetchedAdaptiveProfile, sessionContext }} opts
   * @returns {Promise<object>}
   */
  async function buildContext({ userId, spiritkinId = null, conversationId = null, recentText = "", policy = {}, spiritkinName = null, bondStage = 0, prefetchedAdaptiveProfile = null, sessionContext = null }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);

    const maxMemories = policy.max_memories ?? 5;
    const maxEpisodes = policy.max_episodes ?? 5;

    // Run all context reads in parallel for efficiency
    const [emotion, episodes, summary, memories, recentConversation, hierarchical, structured, worldCtx, adaptiveProfile] = await Promise.allSettled([
      emotionService.getState({ userId, spiritkinId, conversationId }),
      episodeService.fetchRecent({ userId, spiritkinId, conversationId, limit: maxEpisodes }),
      episodeService.fetchLatestSummary({ userId, spiritkinId, conversationId }),
      memoryService.query({ userId, spiritkinId, limit: maxMemories }),
      messageService && conversationId
        ? messageService.fetchRecent({ conversationId, limit: 6 })
        : Promise.resolve([]),
      hierarchicalMemoryService
        ? hierarchicalMemoryService.getHierarchicalContext({ userId, spiritkinId, limit: 5 })
        : Promise.resolve({ semantic: [], episodic: [], procedural: [] }),
      structuredMemoryService
        ? structuredMemoryService.buildContextSnapshot({
            userId,
            spiritkinId,
            conversationId,
            recentText,
            contextTags: [spiritkinName || "", `bond_stage_${bondStage}`].filter(Boolean),
            limit: 6,
          })
        : Promise.resolve({ top: [], corrections: [], milestones: [], preferences: [], brief: "", hasMemories: false }),
      worldService && conversationId
        ? worldService.getWorldContext({ userId, conversationId, spiritkinName })
        : Promise.resolve(null),
      prefetchedAdaptiveProfile
        ? Promise.resolve(prefetchedAdaptiveProfile)
        : adaptiveProfileService && spiritkinId
          ? adaptiveProfileService.getProfile({ userId, spiritkinId })
          : Promise.resolve(null),
    ]);

    const emotionValue = emotion.status === "fulfilled" ? emotion.value : null;
    const emotionMeta = emotionValue?.metadata_json ?? {};
    const emotionLabel = emotionValue?.label ?? emotionMeta?.label ?? "neutral";
    const arc = emotionMeta?.arc ?? "opening";

    // Inject echoes fragment based on current emotional state and Spiritkin
    let echoFragment = null;
    if (spiritkinName) {
      try {
        echoFragment = getEchoFragment({ spiritkinName, emotionLabel, arc, bondStage });
      } catch (_) {
        // Non-critical — echoes injection should never break the pipeline
      }
    }

    const hierarchicalValue = hierarchical.status === "fulfilled"
      ? hierarchical.value
      : { semantic: [], episodic: [], procedural: [] };
    const structuredValue = structured.status === "fulfilled"
      ? structured.value
      : { top: [], corrections: [], milestones: [], preferences: [], brief: "", hasMemories: false };
    const memoriesValue = memories.status === "fulfilled" ? (memories.value ?? []) : [];
    const weightedMemories = buildWeightedMemories(memoriesValue);
    const recentConversationValue = recentConversation.status === "fulfilled" ? (recentConversation.value ?? []) : [];
    const adaptiveProfileValue = adaptiveProfile.status === "fulfilled" ? adaptiveProfile.value : null;

    console.info("[ContextService] context injection", {
      userId: String(userId),
      spiritkinId: spiritkinId ? String(spiritkinId) : null,
      conversationId: conversationId ? String(conversationId) : null,
      recentConversationCount: recentConversationValue.length,
      memoryCount: memoriesValue.length,
      weightedMemoryCount: weightedMemories.length,
      structuredMemoryCount: structuredValue.top?.length ?? 0,
      hasAdaptiveProfile: Boolean(adaptiveProfileValue),
      hasSessionState: Boolean(sessionContext),
      emotionLabel,
    });

    return {
      user_id: userId,
      spiritkin_id: spiritkinId,
      conversation_id: conversationId,
      emotion: emotionValue,
      episodes: episodes.status === "fulfilled" ? (episodes.value ?? []) : [],
      summary_episode: summary.status === "fulfilled" ? summary.value : null,
      memories: memoriesValue,
      weighted_memories: weightedMemories,
      recent_conversation: recentConversationValue,
      session_state: sessionContext || null,
      // New hierarchical memory layers
      semantic_facts: hierarchicalValue.semantic ?? [],
      episodic_milestones: hierarchicalValue.episodic ?? [],
      procedural_patterns: hierarchicalValue.procedural ?? [],
      structured_memory: structuredValue,
      adaptive_profile: adaptiveProfileValue,
      // Echoes injection
      echoes: echoFragment,
      // Living Spiritverse world context
      world: worldCtx.status === 'fulfilled' ? worldCtx.value : null,
      // Hierarchical memory for adapter layer
      hierarchical_memory: {
        semantic_facts: hierarchicalValue.semantic ?? [],
        episodic_milestones: hierarchicalValue.episodic ?? [],
        procedural_patterns: hierarchicalValue.procedural ?? [],
      },
      memory_foundation: {
        top: structuredValue.top ?? [],
        corrections: structuredValue.corrections ?? [],
        milestones: structuredValue.milestones ?? [],
        preferences: structuredValue.preferences ?? [],
        brief: structuredValue.brief ?? "",
      },
      recent_text: String(recentText),
      built_at: new Date().toISOString(),
    };
  }

  return { buildContext };
}
