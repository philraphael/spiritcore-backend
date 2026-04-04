/**
 * SpiritCore — Context Service (v2)
 *
 * Upgraded to inject hierarchical memory layers and lore fragments
 * into the context bundle passed to the adapter layer.
 *
 * Context bundle now includes:
 *   - emotion state (rich: label, valence, arousal, intensity, trajectory, arc)
 *   - recent episodes
 *   - latest summary episode
 *   - recent memories (canonical path: `memories` table)
 *   - hierarchical memory (semantic facts, episodic milestones, procedural patterns)
 *   - lore fragment (realm description, contextual phrase, Charter law)
 */

import { AppError } from "../errors.mjs";
import { getLoreFragment } from "../canon/spiritverseLore.mjs";

export function createContextService({ supabase, emotionService, episodeService, memoryService, hierarchicalMemoryService }) {

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
    const [emotion, episodes, summary, memories, hierarchical] = await Promise.allSettled([
      emotionService.getState({ userId, spiritkinId, conversationId }),
      episodeService.fetchRecent({ userId, spiritkinId, conversationId, limit: maxEpisodes }),
      episodeService.fetchLatestSummary({ userId, spiritkinId, conversationId }),
      memoryService.query({ userId, spiritkinId, limit: maxMemories }),
      hierarchicalMemoryService
        ? hierarchicalMemoryService.getHierarchicalContext({ userId, spiritkinId, limit: 5 })
        : Promise.resolve({ semantic: [], episodic: [], procedural: [] }),
    ]);

    const emotionValue = emotion.status === "fulfilled" ? emotion.value : null;
    const emotionMeta = emotionValue?.metadata_json ?? {};
    const emotionLabel = emotionValue?.label ?? emotionMeta?.label ?? "neutral";
    const arc = emotionMeta?.arc ?? "opening";

    // Inject lore fragment based on current emotional state and Spiritkin
    let loreFragment = null;
    if (spiritkinName) {
      try {
        loreFragment = getLoreFragment({ spiritkinName, emotionLabel, arc, bondStage });
      } catch (_) {
        // Non-critical — lore injection should never break the pipeline
      }
    }

    const hierarchicalValue = hierarchical.status === "fulfilled"
      ? hierarchical.value
      : { semantic: [], episodic: [], procedural: [] };

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
      // Lore injection
      lore: loreFragment,
      recent_text: String(recentText),
      built_at: new Date().toISOString(),
    };
  }

  return { buildContext };
}
