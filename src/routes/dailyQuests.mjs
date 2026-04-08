/**
 * SpiritCore — Daily Quest Routes
 *
 * GET /v1/quests/daily
 *   Returns today's personalized daily quest for the user.
 *   Query params: userId, spiritkinName, bondStage
 *
 * GET /v1/quests/daily/next
 *   Returns tomorrow's quest (preview).
 */

import {
  generateDailyQuest,
  getNextDailyQuest,
  getTimeUntilNextQuest,
} from "../services/dailyQuestService.mjs";

export async function dailyQuestRoutes(fastify) {
  /**
   * GET /v1/quests/daily
   * Returns today's personalized daily quest.
   */
  fastify.get("/v1/quests/daily", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          userId:       { type: "string" },
          spiritkinName: { type: "string" },
          bondStage:    { type: "integer", minimum: 0, maximum: 5 },
        }
      }
    }
  }, async (req, reply) => {
    const userId       = req.query.userId ?? "anonymous";
    const spiritkinName = req.query.spiritkinName ?? "Lyra";
    const bondStage    = parseInt(req.query.bondStage ?? "0", 10) || 0;

    const quest = generateDailyQuest({ spiritkinName, bondStage, userId });
    const timeUntilNext = getTimeUntilNextQuest();

    return reply.send({
      ok: true,
      quest,
      refreshesIn: timeUntilNext,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /v1/quests/daily/next
   * Returns tomorrow's quest (preview).
   */
  fastify.get("/v1/quests/daily/next", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          userId:       { type: "string" },
          spiritkinName: { type: "string" },
          bondStage:    { type: "integer", minimum: 0, maximum: 5 },
        }
      }
    }
  }, async (req, reply) => {
    const userId       = req.query.userId ?? "anonymous";
    const spiritkinName = req.query.spiritkinName ?? "Lyra";
    const bondStage    = parseInt(req.query.bondStage ?? "0", 10) || 0;

    const quest = getNextDailyQuest({ spiritkinName, bondStage, userId });
    const timeUntilNext = getTimeUntilNextQuest();

    return reply.send({
      ok: true,
      quest,
      refreshesIn: timeUntilNext,
      timestamp: new Date().toISOString(),
    });
  });
}
