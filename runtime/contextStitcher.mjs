export default class ContextStitcher {
  constructor({ memoryEngineFactory, emotionEngine, episodeEngine }) {
    this.memoryEngineFactory = memoryEngineFactory; // (userId) => MemoryEngine
    this.emotionEngine = emotionEngine;
    this.episodeEngine = episodeEngine;
  }

  async buildContext({ user_id, spiritkin_id, conversation_id, recentText }) {
    const emotion = await this.emotionEngine.getState({
      user_id,
      spiritkin_id,
      conversation_id,
    });

    const episodes = await this.episodeEngine.fetchRecentEpisodes({
      user_id,
      spiritkin_id,
      conversation_id,
      limit: 5,
    });

    const latestSummary = await this.episodeEngine.fetchLatestSummary({
      user_id,
      spiritkin_id,
      conversation_id,
    });

    const memEngine = this.memoryEngineFactory(user_id);
    const memories = await memEngine.fetchRecentMemories({
      limit: 5,
      spiritkin_id,
      conversation_id,
    });

    return {
      user_id,
      spiritkin_id,
      conversation_id,
      emotion,
      summary_episode: latestSummary,
      episodes,
      memories,
      recentText: String(recentText || ""),
      built_at: new Date().toISOString(),
    };
  }
}
