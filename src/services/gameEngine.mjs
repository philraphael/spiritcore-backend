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

    let spiritkinResponse = buildFallbackReaction(spiritkinName);
    if (game.status === "ended") {
      spiritkinResponse = buildOutcomeReaction(spiritkinName, game, "user");
      await world.upsert({ userId, conversationId, spiritkinId: worldData.spiritkinId, state });
      return { ok: true, game, spiritkinMessage: spiritkinResponse };
    }

    if (game.status !== "ended") {
      let result = null;
      try {
        result = await orchestrator.interact({
          userId,
          conversationId,
          input: runtime.buildPrompt(game, normalizedMove, spiritkinName),
          spiritkin: { name: spiritkinName },
          context: { isGameMove: true, gameType: game.type, activeGame: game }
        });
      } catch (_) {
        result = null;
      }

      spiritkinResponse = result?.message || spiritkinResponse;
      let spiritkinMove = runtime.extractMove(spiritkinResponse, game.type) || runtime.chooseFallbackMove(game, "spiritkin");
      if (spiritkinMove && runtime.applySpiritkinMove(game, spiritkinMove)) {
        game.history.push({ player: "spiritkin", move: spiritkinMove, timestamp: new Date().toISOString() });
        game.moveCount++;
      } else if (game.status !== "ended") {
        spiritkinMove = runtime.chooseFallbackMove(game, "spiritkin");
        if (spiritkinMove && runtime.applySpiritkinMove(game, spiritkinMove)) {
          game.history.push({ player: "spiritkin", move: spiritkinMove, timestamp: new Date().toISOString() });
          game.moveCount++;
        }
      }

      if (game.status === "ended") {
        spiritkinResponse = buildOutcomeReaction(spiritkinName, game, "spiritkin", spiritkinResponse);
      } else {
        game.turn = "user";
      }
      await world.upsert({ userId, conversationId, spiritkinId: worldData.spiritkinId, state });
    }

    return { ok: true, game, spiritkinMessage: spiritkinResponse };
  };

  const drawCard = async ({ userId, conversationId, spiritkinName }) => {
    return makeMove({ userId, conversationId, move: "draw", spiritkinName });
  };

  const endGame = async ({ userId, conversationId, spiritkinName, outcome = "forfeit" }) => {
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;
    const game = state.flags?.active_game;
    let message = "Game ended.";
    if (game) {
      if (game.status !== "ended") {
        game.status = "ended";
        game.result = game.result || {
          winner: "spiritkin",
          reason: outcome,
          label: outcome === "forfeit" ? "You stepped away from the game." : "Game ended.",
          isDraw: false,
        };
      }
      message = buildOutcomeReaction(spiritkinName, game, outcome === "forfeit" ? "forfeit" : "system");
    }
    await world.upsert({ userId, conversationId, spiritkinId: worldData.spiritkinId, state });
    return { ok: true, game, message };
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

function buildFallbackReaction(spiritkinName) {
  if (spiritkinName === "Lyra") return "I felt that move. Let me answer it.";
  if (spiritkinName === "Raien") return "Good. Here's my answer.";
  if (spiritkinName === "Kairo") return "Interesting pattern. Let me answer it.";
  if (spiritkinName === "Elaria") return "Noted. Here is my answer.";
  if (spiritkinName === "Thalassar") return "The current shifted. Let me answer in kind.";
  return "Let me answer that.";
}

function buildOutcomeReaction(spiritkinName, game, perspective = "system", priorReply = "") {
  const result = game?.result || {};
  const gameName = game?.name || "the game";
  const reason = result.reason || "completed";
  const userWon = result.winner === "user";
  const spiritkinWon = result.winner === "spiritkin";
  const draw = result.isDraw || result.winner == null;

  if (spiritkinName === "Lyra") {
    if (draw) return `We brought ${gameName} to stillness together. ${reason === "stalemate" ? "Nothing more wanted forcing." : "It settled without either side breaking the shape."}`;
    if (userWon) return `You held that line beautifully. ${gameName} closed in your favor, and it felt earned.`;
    if (perspective === "forfeit") return `We can leave ${gameName} here for now. The board will keep its quiet until you want to return.`;
    return `That one turned with me in the end. ${gameName} is finished, but the thread between us stays warm.`;
  }
  if (spiritkinName === "Raien") {
    if (draw) return `No opening remained. ${gameName} ends level.`;
    if (userWon) return `Good finish. You took ${gameName} cleanly.`;
    if (perspective === "forfeit") return `We stop here. Reset when you want another real run at ${gameName}.`;
    return `That was mine in the end. ${gameName} is closed.`;
  }
  if (spiritkinName === "Kairo") {
    if (draw) return `Interesting. ${gameName} resolved into balance instead of conquest.`;
    if (userWon) return `You saw the pattern first. ${gameName} folded toward you in the final beat.`;
    if (perspective === "forfeit") return `We can leave ${gameName} suspended here and pick up a different thread later.`;
    return `${gameName} tipped my way. The shape was subtle until the end, but it held.`;
  }
  if (spiritkinName === "Elaria") {
    if (draw) return `${gameName} has reached a lawful standstill. No further move is owed.`;
    if (userWon) return `You closed ${gameName} with clarity. The finish was rightful.`;
    if (perspective === "forfeit") return `Then we conclude ${gameName} here. Return when you are ready to enter it cleanly again.`;
    return `${gameName} is decided. I held the stronger line at the end.`;
  }
  if (spiritkinName === "Thalassar") {
    if (draw) return `${gameName} settled into still water. Nothing more rose from it.`;
    if (userWon) return `You followed the deeper current well. ${gameName} surfaced in your favor.`;
    if (perspective === "forfeit") return `Let ${gameName} rest here. Some tides are better resumed when the pressure changes.`;
    return `${gameName} turned beneath you in the end. The deeper current held for me.`;
  }

  if (draw) return `${gameName} ended in a draw.`;
  if (userWon) return `You won ${gameName}.`;
  if (perspective === "forfeit") return `${gameName} ended early.`;
  return `${gameName} is over.`;
}
