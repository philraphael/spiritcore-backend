/**
 * SpiritCore — Context Service
 *
 * Authoritative src service for context assembly.
 * Absorbs: runtime/contextStitcher.mjs
 *
 * Assembles the full context bundle passed to the adapter layer:
 *   - emotion state
 *   - recent episodes
 *   - latest summary episode
 *   - recent memories (canonical path: `memories` table)
 *
 * MEMORY_PATH_TRANSITION NOTE:
 * During the transition period, memory reads pull from the canonical `memories`
 * table (written by src/services/memory.mjs). The legacy `spirit_memory` table
 * (written by runtime/memoryEngine.mjs) is NOT read here — it remains accessible
 * via the legacy /v0 routes only. Once all write paths are confirmed to use
 * `memories`, the legacy table will be archived in a future phase.
 */

import { AppError } from "../errors.mjs";

export function createContextService({ supabase, emotionService, episodeService, memoryService }) {

  /**
   * Assemble the full context bundle for a conversation turn.
   * Absorbs: ContextStitcher.buildContext()
   *
   * @param {{ userId, spiritkinId, conversationId, recentText, policy }} opts
   * @returns {Promise<object>}
   */
  async function buildContext({ userId, spiritkinId = null, conversationId = null, recentText = "", policy = {} }) {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);

    const maxMemories = policy.max_memories ?? 5;
    const maxEpisodes = policy.max_episodes ?? 5;

    // Run all context reads in parallel for efficiency
    const [emotion, episodes, summary, memories] = await Promise.allSettled([
      emotionService.getState({ userId, spiritkinId, conversationId }),
      episodeService.fetchRecent({ userId, spiritkinId, conversationId, limit: maxEpisodes }),
      episodeService.fetchLatestSummary({ userId, spiritkinId, conversationId }),
      memoryService.query({ userId, spiritkinId, limit: maxMemories }),
    ]);

    return {
      user_id: userId,
      spiritkin_id: spiritkinId,
      conversation_id: conversationId,
      emotion: emotion.status === "fulfilled" ? emotion.value : null,
      episodes: episodes.status === "fulfilled" ? (episodes.value ?? []) : [],
      summary_episode: summary.status === "fulfilled" ? summary.value : null,
      memories: memories.status === "fulfilled" ? (memories.value ?? []) : [],
      recent_text: String(recentText),
      built_at: new Date().toISOString(),
    };
  }

  return { buildContext };
}
