/**
 * SpiritCore — Interactive Game Routes (v2)
 *
 * GET  /v1/games/list                  — list all available Spiritverse games
 * POST /v1/games/start                 — start a new game in a conversation
 * POST /v1/games/move                  — make a move; returns Spiritkin commentary
 * GET  /v1/games/state/:conversationId — fetch current game state
 * POST /v1/games/end                   — end / forfeit the active game
 */

export async function gameRoutes(fastify, opts) {
  const { gameEngine, world } = opts;

  /**
   * GET /v1/games/list
   * Returns all available Spiritverse games with descriptions and instructions.
   */
  fastify.get("/v1/games/list", async (req, reply) => {
    try {
      const games = await gameEngine.listGames();
      return { ok: true, count: Object.keys(games).length, games };
    } catch (err) {
      req.log.error(err, "[games] listGames failed");
      return reply.code(500).send({ ok: false, error: "INTERNAL", message: "Failed to list games." });
    }
  });

  /**
   * POST /v1/games/start
   * Start a new game. Returns initial game state + Spiritkin opening message.
   */
  fastify.post("/v1/games/start", async (req, reply) => {
    const { userId, conversationId, gameType, spiritkinName } = req.body;

    if (!userId || !conversationId || !gameType) {
      return reply.code(400).send({
        ok: false,
        error: "VALIDATION",
        message: "userId, conversationId, and gameType are required."
      });
    }

    try {
      const result = await gameEngine.startGame({ userId, conversationId, gameType, spiritkinName });
      return {
        ok: true,
        game: result.game,
        spiritkinMessage: result.spiritkinMessage,
        instructions: result.instructions
      };
    } catch (err) {
      req.log.error(err, `[games] startGame failed for ${gameType}`);
      const code = err.statusCode || err.httpCode || 500;
      return reply.code(code).send({ ok: false, error: err.code || "INTERNAL", message: err.message });
    }
  });

  /**
   * POST /v1/games/move
   * Submit a player move. Returns updated game state + Spiritkin commentary/move.
   */
  fastify.post("/v1/games/move", async (req, reply) => {
    const { userId, conversationId, move, spiritkinName } = req.body;

    if (!userId || !conversationId || !move) {
      return reply.code(400).send({
        ok: false,
        error: "VALIDATION",
        message: "userId, conversationId, and move are required."
      });
    }

    try {
      const result = await gameEngine.makeMove({ userId, conversationId, move, spiritkinName });
      return {
        ok: true,
        game: result.game,
        spiritkinMessage: result.spiritkinMessage
      };
    } catch (err) {
      req.log.error(err, `[games] makeMove failed for conversation ${conversationId}`);
      const code = err.statusCode || err.httpCode || 500;
      return reply.code(code).send({ ok: false, error: err.code || "INTERNAL", message: err.message });
    }
  });

  /**
   * GET /v1/games/state/:conversationId
   * Fetch current game state for a conversation.
   */
  fastify.get("/v1/games/state/:conversationId", async (req, reply) => {
    const { conversationId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return reply.code(400).send({ ok: false, error: "VALIDATION", message: "userId query param is required." });
    }

    try {
      const worldData = await world.get({ userId, conversationId });
      const game = worldData.state.flags?.active_game || null;
      return { ok: true, game };
    } catch (err) {
      req.log.error(err, `[games] getState failed for conversation ${conversationId}`);
      const code = err.statusCode || err.httpCode || 500;
      return reply.code(code).send({ ok: false, error: err.code || "INTERNAL", message: err.message });
    }
  });

  /**
   * POST /v1/games/end
   * End or forfeit the active game in a conversation.
   */
  fastify.post("/v1/games/end", async (req, reply) => {
    const { userId, conversationId } = req.body;

    if (!userId || !conversationId) {
      return reply.code(400).send({ ok: false, error: "VALIDATION", message: "userId and conversationId are required." });
    }

    try {
      const worldData = await world.get({ userId, conversationId });
      const state = worldData.state;

      if (!state.flags?.active_game) {
        return reply.code(400).send({ ok: false, error: "GAME_ERROR", message: "No active game to end." });
      }

      state.flags.active_game.status = "ended";
      state.flags.active_game.endedAt = new Date().toISOString();

      await world.upsert({
        userId,
        conversationId,
        spiritkinId: worldData.spiritkinId,
        state
      });

      return { ok: true, message: "Game ended." };
    } catch (err) {
      req.log.error(err, `[games] endGame failed for conversation ${conversationId}`);
      const code = err.statusCode || err.httpCode || 500;
      return reply.code(code).send({ ok: false, error: err.code || "INTERNAL", message: err.message });
    }
  });
}
