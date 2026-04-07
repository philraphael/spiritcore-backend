/**
 * SpiritCore — Interactive Game Engine
 *
 * Orchestrates classic strategy games (Chess, Checkers, Go) and 
 * Spiritverse-specific games (Echo Trials, TCG).
 * 
 * Game states are persisted in the world_state flags to ensure
 * they are part of the Spiritkin's persistent memory.
 */

import { AppError } from "../errors.mjs";

export const createGameEngine = ({ bus, world, messageService }) => {
  
  const GAMES = {
    chess: { name: "Celestial Chess", type: "strategy" },
    checkers: { name: "Veil Checkers", type: "strategy" },
    go: { name: "Star-Mapping (Go)", type: "strategy" },
    echo_trials: { name: "Echo Trials", type: "lore" },
    spirit_cards: { name: "Spirit-Cards", type: "tcg" }
  };

  /**
   * Start a new game within a conversation.
   */
  const startGame = async ({ userId, conversationId, gameType, spiritkinName }) => {
    if (!GAMES[gameType]) throw new AppError("VALIDATION", `Unknown game type: ${gameType}`, 400);
    
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;
    
    // Initialize game state based on type
    let gameState = {
      type: gameType,
      status: "active",
      turn: "user",
      history: [],
      data: {}
    };

    if (gameType === "chess") {
      gameState.data = { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" };
    } else if (gameType === "checkers") {
      gameState.data = { board: "default" };
    }

    // Persist to world state flags
    state.flags = state.flags || {};
    state.flags.active_game = gameState;
    
    await world.upsert({ userId, conversationId, state });

    bus.emit("game.started", { userId, conversationId, gameType, spiritkinName });
    
    return { ok: true, game: gameState };
  };

  /**
   * Process a move in an active game.
   */
  const makeMove = async ({ userId, conversationId, move, spiritkinName }) => {
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;
    const game = state.flags?.active_game;

    if (!game || game.status !== "active") {
      throw new AppError("GAME_ERROR", "No active game found.", 400);
    }

    // Update game state (simplified logic for now)
    game.history.push({ player: "user", move, timestamp: new Date().toISOString() });
    game.turn = "spiritkin";
    
    // In a real implementation, we'd validate the move here
    // and potentially update game.data (e.g. FEN for chess)

    await world.upsert({ userId, conversationId, state });
    
    bus.emit("game.move_made", { userId, conversationId, gameType: game.type, player: "user", move });

    return { ok: true, game };
  };

  return { startGame, makeMove, listGames: () => GAMES };
};
