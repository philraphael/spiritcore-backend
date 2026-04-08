/**
 * SpiritCore — Bond Journal Route
 *
 * Returns the user's bond journal: memories, progression stats,
 * game-unlocked echoes, and bond stage data.
 *
 * GET /v1/bond-journal?userId=&conversationId=
 */

export async function bondJournalRoutes(fastify) {
  const { spiritMemoryEngine, worldProgression } = fastify;

  fastify.get("/v1/bond-journal", {
    schema: {
      querystring: {
        type: "object",
        required: ["userId", "conversationId"],
        properties: {
          userId:         { type: "string" },
          conversationId: { type: "string" },
        }
      }
    }
  }, async (req, reply) => {
    const { userId, conversationId } = req.query;

    // Get progression stats (games completed, bond stage, world mood)
    let stats = { gamesCompleted: 0, bondStage: 0, bondStageName: "First Contact", worldMood: "peaceful", unlockedEchoCount: 0 };
    if (worldProgression) {
      try {
        stats = await worldProgression.getProgressionStats({ userId, conversationId });
      } catch (err) {
        fastify.log.warn({ err }, "bondJournal: getProgressionStats failed");
      }
    }

    // Get unlocked echoes from games
    let gameUnlocks = [];
    if (worldProgression) {
      try {
        gameUnlocks = await worldProgression.getUnlockedEchoes({ userId, conversationId });
      } catch (err) {
        fastify.log.warn({ err }, "bondJournal: getUnlockedEchoes failed");
      }
    }

    // Get preserved memories from spiritMemoryEngine
    let memories = [];
    if (spiritMemoryEngine) {
      try {
        const memResult = await spiritMemoryEngine.buildMemoryBrief({ userId, spiritkinId: null, limit: 20 });
        // buildMemoryBrief returns { identity, bondMilestones, games, sessions, emotional, procedural, worldAnchors }
        // Flatten into a display-friendly array for the Bond Journal
        const allMems = [];
        (memResult?.bondMilestones ?? []).forEach(m => allMems.push({ kind: 'bond_milestone', content: m.content, created_at: m.date }));
        (memResult?.games ?? []).forEach(m => allMems.push({ kind: m.kind ?? 'game_session', content: m.content, created_at: m.date }));
        (memResult?.emotional ?? []).forEach(m => allMems.push({ kind: 'emotional_arc', content: m.content, created_at: m.date }));
        (memResult?.identity ?? []).slice(0, 5).forEach(c => allMems.push({ kind: 'identity_fact', content: c, created_at: null }));
        memories = allMems.slice(0, 15);
      } catch (err) {
        fastify.log.warn({ err }, "bondJournal: getMemoryBrief failed");
      }
    }

    return reply.send({
      ok: true,
      journal: {
        ...stats,
        memories,
        gameUnlocks,
      }
    });
  });
}
