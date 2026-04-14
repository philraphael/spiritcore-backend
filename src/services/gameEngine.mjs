import { AppError } from "../errors.mjs";
import { createSharedGameRuntime } from "./sharedGameEngine.mjs";

export const createGameEngine = ({ bus, world, registry, orchestrator }) => {
  const runtime = createSharedGameRuntime();

  const resolveSpiritkinId = async (name) => {
    if (!registry || !name) return null;
    const sk = await registry.getCanonical(name);
    return sk?.id ?? null;
  };

  const startGame = async ({ userId, conversationId, gameType, spiritkinName }) => {
    const meta = runtime.getGameMeta(gameType);
    if (!meta) throw new AppError("VALIDATION", `Unknown game type: ${gameType}`, 400);

    const spiritkinId = await resolveSpiritkinId(spiritkinName);
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;
    const gameState = runtime.createGameState(gameType);

    state.flags = state.flags || {};
    state.flags.active_game = gameState;

    await world.upsert({ userId, conversationId, spiritkinId: spiritkinId ?? worldData.spiritkinId, state });
    bus.emit("game.started", { userId, conversationId, gameType, spiritkinName });

    return {
      ok: true,
      game: gameState,
      spiritkinMessage: buildStartMessage(spiritkinName, meta),
      instructions: meta.instructions,
      guide: null,
    };
  };

  const makeMove = async ({ userId, conversationId, move, spiritkinName }) => {
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;
    const game = state.flags?.active_game;

    if (!game || game.status !== "active") throw new AppError("GAME_ERROR", "No active game found.", 400);
    const normalizedMove = String(move || "").trim();
    if (!runtime.applyUserMove(game, normalizedMove)) {
      throw new AppError("GAME_ERROR", "That move could not be applied.", 400);
    }

    game.history.push({ player: "user", move: normalizedMove, timestamp: new Date().toISOString() });
    game.moveCount++;
    if (game.status !== "ended") game.turn = "spiritkin";
    await world.upsert({ userId, conversationId, spiritkinId: worldData.spiritkinId, state });

    let spiritkinResponse = "Interesting. Let me answer that.";
    if (game.status !== "ended") {
      const result = await orchestrator.interact({
        userId,
        conversationId,
        input: runtime.buildPrompt(game, normalizedMove),
        spiritkin: { name: spiritkinName },
        context: { isGameMove: true, gameType: game.type, activeGame: game }
      });

      spiritkinResponse = result?.message || spiritkinResponse;
      let spiritkinMove = runtime.extractMove(spiritkinResponse, game.type) || runtime.chooseFallbackMove(game, "spiritkin");
      if (spiritkinMove && runtime.applySpiritkinMove(game, spiritkinMove)) {
        game.history.push({ player: "spiritkin", move: spiritkinMove, timestamp: new Date().toISOString() });
        game.moveCount++;
      }

      if (game.status !== "ended") {
        game.turn = "user";
      }
      await world.upsert({ userId, conversationId, spiritkinId: worldData.spiritkinId, state });
    }

    return { ok: true, game, spiritkinMessage: spiritkinResponse };
  };

  const drawCard = async ({ userId, conversationId, spiritkinName }) => {
    return makeMove({ userId, conversationId, move: "draw", spiritkinName });
  };

  const endGame = async ({ userId, conversationId }) => {
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;
    const game = state.flags?.active_game;
    if (game) game.status = "ended";
    await world.upsert({ userId, conversationId, spiritkinId: worldData.spiritkinId, state });
    return { ok: true, game, message: "Game ended." };
  };

  return { startGame, makeMove, drawCard, endGame, listGames: () => runtime.listGames() };
};

function buildStartMessage(spiritkinName, meta) {
  if (spiritkinName === "Lyra") return `${meta.name} is ready. Take the first move when you feel settled.`;
  if (spiritkinName === "Raien") return `${meta.name} is live. Show me your opening move.`;
  if (spiritkinName === "Kairo") return `${meta.name} is open. I want to see what pattern you begin with.`;
  if (spiritkinName === "Elaria") return `${meta.name} is ready. Begin when you are clear.`;
  if (spiritkinName === "Thalassar") return `${meta.name} is awake. Let the first move surface.`;
  return `${meta.name} is ready. Your move.`;
}
