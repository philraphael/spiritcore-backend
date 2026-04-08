/**
 * SpiritCore — Interactive Game Routes (v3)
 *
 * GET  /v1/games/list                  — list all available Spiritverse games
 * POST /v1/games/start                 — start a new game in a conversation
 * POST /v1/games/move                  — make a move; returns Spiritkin commentary
 * POST /v1/games/draw                  — draw a card (Spirit-Cards only)
 * GET  /v1/games/state/:conversationId — fetch current game state
 * POST /v1/games/end                   — end / forfeit the active game (writes memory)
 */

export async function gameRoutes(fastify, opts) {
  const { gameEngine, world } = opts;

  /**
   * GET /v1/games/list
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
        instructions: result.instructions,
        guide: result.guide || null
      };
    } catch (err) {
      req.log.error(err, `[games] startGame failed for ${gameType}`);
      const code = err.statusCode || err.httpCode || 500;
      return reply.code(code).send({ ok: false, error: err.code || "INTERNAL", message: err.message });
    }
  });

  /**
   * POST /v1/games/move
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
   * POST /v1/games/draw
   * Draw a card in an active Spirit-Cards game.
   */
  fastify.post("/v1/games/draw", async (req, reply) => {
    const { userId, conversationId, spiritkinName } = req.body;

    if (!userId || !conversationId) {
      return reply.code(400).send({
        ok: false,
        error: "VALIDATION",
        message: "userId and conversationId are required."
      });
    }

    try {
      const result = await gameEngine.drawCard({ userId, conversationId, spiritkinName });
      return {
        ok: true,
        game: result.game,
        spiritkinMessage: result.spiritkinMessage
      };
    } catch (err) {
      req.log.error(err, `[games] drawCard failed for conversation ${conversationId}`);
      const code = err.statusCode || err.httpCode || 500;
      return reply.code(code).send({ ok: false, error: err.code || "INTERNAL", message: err.message });
    }
  });

  /**
   * GET /v1/games/state/:conversationId
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
   * End or forfeit the active game. Writes a game session memory via spiritMemoryEngine.
   */
  fastify.post("/v1/games/end", async (req, reply) => {
    const { userId, conversationId, spiritkinName, outcome } = req.body;

    if (!userId || !conversationId) {
      return reply.code(400).send({ ok: false, error: "VALIDATION", message: "userId and conversationId are required." });
    }

    try {
      const result = await gameEngine.endGame({ userId, conversationId, spiritkinName, outcome });
      return { ok: true, game: result.game, message: result.message };
    } catch (err) {
      req.log.error(err, `[games] endGame failed for conversation ${conversationId}`);
      const code = err.statusCode || err.httpCode || 500;
      return reply.code(code).send({ ok: false, error: err.code || "INTERNAL", message: err.message });
    }
  });
}
