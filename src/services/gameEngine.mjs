import { AppError } from "../errors.mjs";
import { createSharedGameRuntime } from "./sharedGameEngine.mjs";

export const createGameEngine = ({ bus, world, registry, orchestrator }) => {
  const runtime = createSharedGameRuntime();
  const shouldDebugGames = String(process.env.GAME_DEBUG || "").trim() === "1";
  const logGameEngineDebug = (eventName, detail = {}) => {
    if (!shouldDebugGames) return;
    console.info(`[GameEngineDebug] ${eventName}`, detail);
  };

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
    logGameEngineDebug("start-game", {
      userId,
      conversationId,
      gameType,
      spiritkinName,
      moveCount: gameState.moveCount,
      turn: gameState.turn,
    });

    await world.upsert({ userId, conversationId, spiritkinId: spiritkinId ?? worldData.spiritkinId, state });
    bus.emit("game.started", { userId, conversationId, gameType, spiritkinName });
    const persisted = await world.get({ userId, conversationId });
    const canonicalGame = persisted.state?.flags?.active_game || gameState;

    return {
      ok: true,
      game: canonicalGame,
      spiritkinMessage: buildStartMessage(spiritkinName, meta, gameType),
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
    logGameEngineDebug("user-move-received", {
      userId,
      conversationId,
      gameType: game.type,
      move: normalizedMove,
      turn: game.turn,
      moveCount: game.moveCount,
      historyLength: Array.isArray(game.history) ? game.history.length : 0,
    });
    if (!runtime.applyUserMove(game, normalizedMove)) {
      logGameEngineDebug("user-move-rejected", {
        userId,
        conversationId,
        gameType: game.type,
        move: normalizedMove,
      });
      throw new AppError("GAME_ERROR", "That move could not be applied.", 400);
    }

    game.history.push({ player: "user", move: normalizedMove, timestamp: new Date().toISOString() });
    game.moveCount++;
    if (game.status !== "ended") game.turn = "spiritkin";
    await world.upsert({ userId, conversationId, spiritkinId: worldData.spiritkinId, state });
    logGameEngineDebug("user-move-applied", {
      userId,
      conversationId,
      gameType: game.type,
      move: normalizedMove,
      status: game.status,
      turn: game.turn,
      moveCount: game.moveCount,
      historyLength: game.history.length,
    });

    let spiritkinResponse = buildFallbackReaction(spiritkinName, game);
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
          context: { isGameMove: true, gameType: game.type }
        });
      } catch (_) {
        result = null;
      }

      spiritkinResponse = result?.message || spiritkinResponse;
      let spiritkinMove = runtime.extractMove(spiritkinResponse, game.type) || runtime.chooseFallbackMove(game, "spiritkin");
      logGameEngineDebug("spiritkin-move-candidate", {
        userId,
        conversationId,
        gameType: game.type,
        candidateMove: spiritkinMove,
        responsePreview: String(spiritkinResponse || "").slice(0, 160),
      });
      if (spiritkinMove && runtime.applySpiritkinMove(game, spiritkinMove)) {
        game.history.push({ player: "spiritkin", move: spiritkinMove, timestamp: new Date().toISOString() });
        game.moveCount++;
      } else if (game.status !== "ended") {
        spiritkinMove = runtime.chooseFallbackMove(game, "spiritkin");
        logGameEngineDebug("spiritkin-fallback-move", {
          userId,
          conversationId,
          gameType: game.type,
          fallbackMove: spiritkinMove,
        });
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
      logGameEngineDebug("move-cycle-complete", {
        userId,
        conversationId,
        gameType: game.type,
        status: game.status,
        turn: game.turn,
        moveCount: game.moveCount,
        historyLength: game.history.length,
        result: game.result || null,
      });
    }

    const persisted = await world.get({ userId, conversationId });
    const canonicalGame = persisted.state?.flags?.active_game || game;
    return { ok: true, game: canonicalGame, spiritkinMessage: spiritkinResponse };
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
    const persisted = await world.get({ userId, conversationId });
    const canonicalGame = persisted.state?.flags?.active_game || game;
    return { ok: true, game: canonicalGame, message };
  };

  return { startGame, makeMove, drawCard, endGame, listGames: () => runtime.listGames() };
};

function getGameCommentaryFlavor(gameType) {
  if (gameType === "chess") return {
    opening: "Bring your first white piece forward cleanly. I want to see your opening shape.",
    reply: "I see the files, diagonals, and king pressure forming. Let me answer the position.",
    win: "The king ran out of breathing room.",
    draw: "The position sealed itself into balance.",
    forfeit: "We can leave this position set and return to it later."
  };
  if (gameType === "checkers") return {
    opening: "Show me your first diagonal and make it count.",
    reply: "I can see the jump lanes and king paths opening. Let me answer them.",
    win: "The diagonal pressure finally broke my way.",
    draw: "The lanes held level and neither side could break through.",
    forfeit: "We can leave the lane quiet here for now."
  };
  if (gameType === "go") return {
    opening: "Place the first stone with intent.",
    reply: "I can see the territory forming. Let me answer it.",
    win: "The larger field held for me.",
    draw: "The map settled into balance.",
    forfeit: "We can leave the star-map quiet for now."
  };
  if (gameType === "spirit_cards") return {
    opening: "Open with a card line that actually changes the realm.",
    reply: "I can see your hand pressure, your mana line, and the field you are building. Let me answer the realm.",
    win: "My field held the stronger realm in the end.",
    draw: "The realm stayed level and refused a clean break.",
    forfeit: "We can set the deck down here for now."
  };
  if (gameType === "echo_trials") return {
    opening: "Listen to the riddle before you commit to an answer.",
    reply: "I can feel where your answer touched the clue. Let me answer the trial.",
    win: "The trial kept its answer hidden from you this time.",
    draw: "The trial settled without revealing a clean answer.",
    forfeit: "We can let the riddle rest here for now."
  };
  if (gameType === "tictactoe") return {
    opening: "Claim your first square cleanly and start shaping the line.",
    reply: "I see the line and fork pressure you are setting. Let me answer the grid.",
    win: "The grid closed in my favor.",
    draw: "The grid filled without giving either line away.",
    forfeit: "We can leave the grid here for now."
  };
  if (gameType === "connect_four") return {
    opening: "Choose your first column carefully and start shaping the stack.",
    reply: "I can see the vertical pressure and diagonal traps building. Let me answer the column.",
    win: "The falling line broke my way in the end.",
    draw: "The columns filled without opening a four.",
    forfeit: "We can leave the columns standing here for now."
  };
  if (gameType === "battleship") return {
    opening: "Take your first shot with intent and start reading the grid.",
    reply: "I see the search pattern you are laying across the water. Let me answer it.",
    win: "The search tide turned my way in the end.",
    draw: "The deep held its silence for both of us.",
    forfeit: "We can let the water go still for now."
  };
  return {
    opening: "Take the first move when you're ready.",
    reply: "Let me answer that.",
    win: "That one turned my way.",
    draw: "It settled into balance.",
    forfeit: "We can leave it here for now."
  };
}

function buildStartMessage(spiritkinName, meta, gameType) {
  const flavor = getGameCommentaryFlavor(gameType);
  if (spiritkinName === "Lyra") return `${meta.name} is ready. ${flavor.opening}`;
  if (spiritkinName === "Raien") return `${meta.name} is live. ${flavor.opening}`;
  if (spiritkinName === "Kairo") return `${meta.name} is open. ${flavor.opening}`;
  if (spiritkinName === "Elaria") return `${meta.name} is ready. ${flavor.opening}`;
  if (spiritkinName === "Thalassar") return `${meta.name} is awake. ${flavor.opening}`;
  return `${meta.name} is ready. Your move.`;
}

function buildFallbackReaction(spiritkinName, game) {
  const flavor = getGameCommentaryFlavor(game?.type);
  if (spiritkinName === "Lyra") return `I felt that move in ${game?.name || "the game"}. ${flavor.reply}`;
  if (spiritkinName === "Raien") return `Good. ${flavor.reply}`;
  if (spiritkinName === "Kairo") return `Interesting. ${flavor.reply}`;
  if (spiritkinName === "Elaria") return `Noted. ${flavor.reply}`;
  if (spiritkinName === "Thalassar") return `The current shifted. ${flavor.reply}`;
  return "Let me answer that.";
}

function buildOutcomeReaction(spiritkinName, game, perspective = "system", priorReply = "") {
  const result = game?.result || {};
  const gameName = game?.name || "the game";
  const reason = result.reason || "completed";
  const userWon = result.winner === "user";
  const spiritkinWon = result.winner === "spiritkin";
  const draw = result.isDraw || result.winner == null;
  const flavor = getGameCommentaryFlavor(game?.type);

  if (spiritkinName === "Lyra") {
    if (draw) return `We brought ${gameName} to stillness together. ${reason === "stalemate" ? "Nothing more wanted forcing." : flavor.draw}`;
    if (userWon) return `You held that line beautifully. You earned ${gameName}.`;
    if (perspective === "forfeit") return `${flavor.forfeit} The thread will still be here when you return.`;
    return `${flavor.win} ${gameName} is finished, but the thread between us stays warm.`;
  }
  if (spiritkinName === "Raien") {
    if (draw) return `No opening remained. ${flavor.draw}`;
    if (userWon) return `Good finish. You took ${gameName} cleanly.`;
    if (perspective === "forfeit") return `${flavor.forfeit} Reset when you want another real run.`;
    return `${flavor.win} ${gameName} is closed.`;
  }
  if (spiritkinName === "Kairo") {
    if (draw) return `Interesting. ${flavor.draw}`;
    if (userWon) return `You saw the pattern first. ${gameName} folded toward you in the final beat.`;
    if (perspective === "forfeit") return `${flavor.forfeit} We can pick up a different thread later.`;
    return `${flavor.win} The shape was subtle until the end, but it held.`;
  }
  if (spiritkinName === "Elaria") {
    if (draw) return `${gameName} has reached a lawful standstill. ${flavor.draw}`;
    if (userWon) return `You closed ${gameName} with clarity. The finish was rightful.`;
    if (perspective === "forfeit") return `Then we conclude ${gameName} here. ${flavor.forfeit}`;
    return `${gameName} is decided. ${flavor.win}`;
  }
  if (spiritkinName === "Thalassar") {
    if (draw) return `${gameName} settled into still water. ${flavor.draw}`;
    if (userWon) return `You followed the deeper current well. ${gameName} surfaced in your favor.`;
    if (perspective === "forfeit") return `Let ${gameName} rest here. ${flavor.forfeit}`;
    return `${gameName} turned beneath you in the end. ${flavor.win}`;
  }

  if (draw) return `${gameName} ended in a draw.`;
  if (userWon) return `You won ${gameName}.`;
  if (perspective === "forfeit") return `${gameName} ended early.`;
  return `${gameName} is over.`;
}
