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

export function createContextService({ supabase, emotionService, episodeService, memoryService, hierarchicalMemoryService, structuredMemoryService, worldService }) {

  /**
   * Assemble the full context bundle for a conversation turn.
   *
   * @param {{ userId, spiritkinId, conversationId, recentText, policy, spiritkinName, bondStage }} opts
   * @returns {Promise<object>}
   */
  async function buildContext({ userId, spiritkinId = null, conversationId = null, recentText = "", policy = {}, spiritkinName = null, bondStage = 0 }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);

    const maxMemories = policy.max_memories ?? 5;
    const maxEpisodes = policy.max_episodes ?? 5;

    // Run all context reads in parallel for efficiency
    const [emotion, episodes, summary, memories, hierarchical, structured, worldCtx] = await Promise.allSettled([
      emotionService.getState({ userId, spiritkinId, conversationId }),
      episodeService.fetchRecent({ userId, spiritkinId, conversationId, limit: maxEpisodes }),
      episodeService.fetchLatestSummary({ userId, spiritkinId, conversationId }),
      memoryService.query({ userId, spiritkinId, limit: maxMemories }),
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

    return {
      user_id: userId,
      spiritkin_id: spiritkinId,
      conversation_id: conversationId,
      emotion: emotionValue,
      episodes: episodes.status === "fulfilled" ? (episodes.value ?? []) : [],
      summary_episode: summary.status === "fulfilled" ? summary.value : null,
      memories: memories.status === "fulfilled" ? (memories.value ?? []) : [],
      // New hierarchical memory layers
      semantic_facts: hierarchicalValue.semantic ?? [],
      episodic_milestones: hierarchicalValue.episodic ?? [],
      procedural_patterns: hierarchicalValue.procedural ?? [],
      structured_memory: structuredValue,
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
