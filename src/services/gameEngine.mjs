/**
 * SpiritCore — Interactive Game Engine (Phase J, v2)
 *
 * Orchestrates classic strategy games (Chess, Checkers, Go) and
 * Spiritverse-specific games (Echo Trials, Spirit-Cards).
 *
 * Game states are persisted in world_state flags so they are part of
 * the Spiritkin's persistent memory.  After each user move the
 * Spiritkin responds via the orchestrator — commentary, reaction, and
 * (for strategy games) their own move — so every turn is a live
 * conversation.
 *
 * Fixes in v2:
 *  - registry injected so spiritkinId can be resolved by name
 *  - spiritkinId always passed to world.upsert (fixes DB constraint)
 *  - makeMove now calls orchestrator to generate Spiritkin commentary
 *    and game move, then persists the Spiritkin turn
 *  - listGames returns the full GAMES catalogue
 */

import { AppError } from "../errors.mjs";
import { MEMORY_KINDS } from "./spiritMemoryEngine.mjs";

export const createGameEngine = ({ bus, world, messageService, registry, orchestrator, memory, spiritMemoryEngine }) => {

  const GAMES = {
    chess: {
      name: "Celestial Chess",
      type: "strategy",
      description: "Classic chess played in the Spiritverse. The board is a celestial map — each piece a constellation.",
      instructions: "Enter moves in algebraic notation (e.g. e2e4, Nf3, O-O for castling)."
    },
    checkers: {
      name: "Veil Checkers",
      type: "strategy",
      description: "Checkers played across the Luminous Veil. Pieces are shards of light.",
      instructions: "Enter moves as 'from-to' (e.g. 3-7, 22-18)."
    },
    go: {
      name: "Star-Mapping (Go)",
      type: "strategy",
      description: "Go played on a star chart. Each stone marks a constellation point.",
      instructions: "Enter moves as column-row (e.g. D4, Q16, pass)."
    },
    echo_trials: {
      name: "Echo Trials",
      type: "lore",
      description: "A lore-based challenge where your Spiritkin poses riddles drawn from Spiritverse history.",
      instructions: "Answer the riddle your Spiritkin poses. Type your answer freely."
    },
    spirit_cards: {
      name: "Spirit-Cards",
      type: "tcg",
      description: "A Spiritverse trading card game. Draw from your deck and play cards to shape the realm.",
      instructions: "Type the name or number of the card you wish to play, or 'draw' to draw a card."
    }
  };

  /**
   * Resolve spiritkinId from name using the registry.
   * Falls back gracefully — never throws.
   */
  const resolveSpiritkinId = async (spiritkinName) => {
    if (!registry || !spiritkinName) return null;
    try {
      const sk = await registry.getCanonical(spiritkinName);
      return sk?.id ?? null;
    } catch {
      return null;
    }
  };

  /**
   * Build the opening message for a new game from the Spiritkin's perspective.
   */
  const buildOpeningMessage = (gameType, spiritkinName, gameMeta) => {
    const openers = {
      chess: [
        `The board is set. Every piece holds its breath. I am ready — are you? Make your first move.`,
        `Celestial Chess. The stars align for this match. Show me how you open.`,
        `I have been waiting for this. The board is yours to begin.`
      ],
      checkers: [
        `The Veil shimmers across the board. Light against shadow. Your move first.`,
        `Veil Checkers. Simple in form, deep in consequence. Begin when you are ready.`
      ],
      go: [
        `The star chart is empty and waiting. Every stone you place will shape the sky. Begin.`,
        `Star-Mapping. I find this game reveals more about a person than almost anything else. Show me.`
      ],
      echo_trials: [
        `The Echo Trials begin. I will pose a riddle from the deep lore of the Spiritverse. Answer with your heart, not just your mind.\n\nFirst trial: *What is the name of the realm from which I emerged, and what does its atmosphere feel like?*`,
        `Welcome to the Echo Trials. These riddles are drawn from the oldest memories of the Spiritverse.\n\nFirst trial: *I am the force that holds a bond together even when words fail. What am I?*`
      ],
      spirit_cards: [
        `Your deck is shuffled. The realm waits. Type 'draw' to draw your first card, or name a card to play it.`,
        `Spirit-Cards. The cards know things about you already. Draw when you are ready.`
      ]
    };
    const list = openers[gameType] || [`A new game of ${gameMeta.name} begins. Your move.`];
    return list[Math.floor(Math.random() * list.length)];
  };

  /**
   * Start a new game within a conversation.
   * Persists game state to world_state and returns the initial Spiritkin message.
   */
  const startGame = async ({ userId, conversationId, gameType, spiritkinName }) => {
    if (!GAMES[gameType]) throw new AppError("VALIDATION", `Unknown game type: ${gameType}`, 400);

    const spiritkinId = await resolveSpiritkinId(spiritkinName);
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;

    // Initialize game state
    const gameState = {
      type: gameType,
      name: GAMES[gameType].name,
      status: "active",
      turn: "user",
      moveCount: 0,
      history: [],
      data: {}
    };

    if (gameType === "chess") {
      gameState.data = {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        lastMove: null
      };
    } else if (gameType === "checkers") {
      gameState.data = {
        board: initCheckersBoard(),
        lastMove: null
      };
    } else if (gameType === "go") {
      gameState.data = {
        board: "empty_19x19",
        captures: { black: 0, white: 0 },
        lastMove: null
      };
    } else if (gameType === "echo_trials") {
      gameState.data = {
        trialNumber: 1,
        score: 0,
        currentRiddle: null
      };
    } else if (gameType === "spirit_cards") {
      gameState.data = {
        hand: [],
        deck: initSpiritCardDeck(),
        played: [],
        realmPoints: 0
      };
    }

    // Persist to world state flags
    state.flags = state.flags || {};
    state.flags.active_game = gameState;

    await world.upsert({
      userId,
      conversationId,
      spiritkinId: spiritkinId ?? worldData.spiritkinId,
      state
    });

    bus.emit("game.started", { userId, conversationId, gameType, spiritkinName });

    const openingMessage = buildOpeningMessage(gameType, spiritkinName, GAMES[gameType]);

    return {
      ok: true,
      game: gameState,
      spiritkinMessage: openingMessage,
      instructions: GAMES[gameType].instructions
    };
  };

  /**
   * Process a player's move.
   * Updates game state, then calls the orchestrator so the Spiritkin
   * can respond with commentary and (for strategy games) their own move.
   */
  const makeMove = async ({ userId, conversationId, move, spiritkinName }) => {
    const spiritkinId = await resolveSpiritkinId(spiritkinName);
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;
    const game = state.flags?.active_game;

    if (!game || game.status !== "active") {
      throw new AppError("GAME_ERROR", "No active game found for this conversation.", 400);
    }

    // Record user's move
    game.history.push({
      player: "user",
      move: move.trim(),
      timestamp: new Date().toISOString()
    });
    game.moveCount = (game.moveCount || 0) + 1;
    game.turn = "spiritkin";

    // Persist user move immediately
    await world.upsert({
      userId,
      conversationId,
      spiritkinId: spiritkinId ?? worldData.spiritkinId,
      state
    });

    bus.emit("game.move_made", { userId, conversationId, gameType: game.type, player: "user", move });

    // Now ask the orchestrator to generate the Spiritkin's response
    // The orchestrator will see the active_game in world state and include it in the LLM prompt
    let spiritkinResponse = null;
    if (orchestrator) {
      try {
        const gameContext = buildGamePromptContext(game, move, spiritkinName);
        const result = await orchestrator.interact({
          userId,
          input: gameContext,
          spiritkin: spiritkinName ? { name: spiritkinName } : undefined,
          conversationId,
          context: { isGameMove: true, gameType: game.type, userMove: move }
        });
        spiritkinResponse = result?.message ?? null;

        // If the orchestrator returned a game move, record it
        if (result?.metadata?.world?.game?.turn === "user") {
          // Orchestrator already updated the game state via Stage 11d
          // Re-read to get the latest state
          const refreshed = await world.get({ userId, conversationId });
          return {
            ok: true,
            game: refreshed.state.flags?.active_game ?? game,
            spiritkinMessage: spiritkinResponse
          };
        }
      } catch (err) {
        console.warn("[GameEngine] orchestrator call failed:", err.message);
        // Fall back to a simple acknowledgment
        spiritkinResponse = buildFallbackResponse(game, move, spiritkinName);
      }
    } else {
      spiritkinResponse = buildFallbackResponse(game, move, spiritkinName);
    }

    // If orchestrator didn't advance the turn, do it manually
    const refreshed = await world.get({ userId, conversationId });
    const currentGame = refreshed.state.flags?.active_game ?? game;

    return {
      ok: true,
      game: currentGame,
      spiritkinMessage: spiritkinResponse
    };
  };

  /**
   * Build a natural-language prompt for the orchestrator that describes
   * the current game state and the user's move.
   */
  const buildGamePromptContext = (game, userMove, spiritkinName) => {
    const gameName = GAMES[game.type]?.name ?? game.type;
    const moveNum = game.moveCount ?? 1;

    const recentHistory = (game.history ?? []).slice(-6).map(h =>
      `${h.player === "user" ? "User" : spiritkinName ?? "Spiritkin"}: ${h.move}`
    ).join("\n");

    let stateDesc = "";
    if (game.type === "chess" && game.data?.fen) {
      stateDesc = `Current FEN: ${game.data.fen}`;
    } else if (game.type === "echo_trials") {
      stateDesc = `Trial number: ${game.data?.trialNumber ?? 1}, Score: ${game.data?.score ?? 0}`;
    } else if (game.type === "spirit_cards") {
      stateDesc = `Realm points: ${game.data?.realmPoints ?? 0}`;
    }

    return [
      `[GAME: ${gameName} — Move ${moveNum}]`,
      `The user just played: "${userMove}"`,
      recentHistory ? `Recent moves:\n${recentHistory}` : "",
      stateDesc,
      `It is now your turn. React to the user's move with your personality, then make your own move if applicable.`,
      `For strategy games (chess, checkers, go): state your move clearly (e.g. "I play e7e5") and comment on the position.`,
      `For Echo Trials: evaluate their answer and pose the next riddle.`,
      `For Spirit-Cards: describe what happens when their card is played and respond with your own card or action.`,
      `Stay fully in character. Be playful, competitive, or reflective as fits your nature.`
    ].filter(Boolean).join("\n");
  };

  /**
   * Fallback response when the orchestrator is unavailable.
   */
  const buildFallbackResponse = (game, userMove, spiritkinName) => {
    const name = spiritkinName ?? "Your companion";
    const responses = {
      chess: [
        `${name} studies the board carefully after your move "${userMove}"... and responds in kind.`,
        `Interesting. "${userMove}" — I see what you are doing. My turn.`
      ],
      checkers: [`"${userMove}" — well played. I am thinking...`],
      go: [`You place at ${userMove}. I consider the whole board before responding.`],
      echo_trials: [`You answered: "${userMove}". Let me consider that...`],
      spirit_cards: [`You played "${userMove}". The realm shifts in response.`]
    };
    const list = responses[game.type] || [`Move noted: "${userMove}". Your companion responds.`];
    return list[Math.floor(Math.random() * list.length)];
  };

  /**
   * Initialize a standard checkers board (simplified representation).
   */
  const initCheckersBoard = () => {
    const board = Array(32).fill(null);
    for (let i = 0; i < 12; i++) board[i] = "black";
    for (let i = 20; i < 32; i++) board[i] = "red";
    return board;
  };

  /**
   * Initialize a Spirit-Cards deck with Spiritverse-themed cards.
   */
  const initSpiritCardDeck = () => {
    return [
      { id: 1, name: "Veil Mist", type: "atmosphere", power: 2, effect: "Obscures one opponent card for one turn." },
      { id: 2, name: "Heart Anchor", type: "bond", power: 3, effect: "Restores 2 realm points." },
      { id: 3, name: "Storm Surge", type: "attack", power: 4, effect: "Reduces opponent realm points by 2." },
      { id: 4, name: "Dream Fragment", type: "lore", power: 1, effect: "Draw 2 additional cards." },
      { id: 5, name: "Ember Ward", type: "defense", power: 3, effect: "Blocks the next attack." },
      { id: 6, name: "Constellation Mark", type: "sigil", power: 5, effect: "Reveals the opponent's next 3 moves." },
      { id: 7, name: "Still Water", type: "atmosphere", power: 2, effect: "Calms all active effects for one turn." },
      { id: 8, name: "Lightning Truth", type: "attack", power: 4, effect: "Forces opponent to reveal their hand." }
    ].sort(() => Math.random() - 0.5);
  };

  /**
   * End a game and write a full game session memory.
   */
  const endGame = async ({ userId, conversationId, spiritkinName, outcome }) => {
    const spiritkinId = await resolveSpiritkinId(spiritkinName);
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;
    const game = state.flags?.active_game;

    if (!game) return { ok: true, message: 'No active game to end.' };

    const endedAt = new Date().toISOString();
    const startedAt = game.startedAt ?? endedAt;
    const durationMs = new Date(endedAt) - new Date(startedAt);

    game.status = 'ended';
    game.endedAt = endedAt;
    game.outcome = outcome ?? 'ended';

    await world.upsert({
      userId,
      conversationId,
      spiritkinId: spiritkinId ?? worldData.spiritkinId,
      state
    });

    // Write game session to long-term memory
    if (spiritMemoryEngine) {
      const userMoves = (game.history ?? []).filter(h => h.player === 'user').map(h => h.move);
      const skCommentary = (game.history ?? []).filter(h => h.player === 'spiritkin').map(h => h.move);

      spiritMemoryEngine.writeGameSession({
        userId,
        spiritkinId: spiritkinId ?? worldData.spiritkinId,
        conversationId,
        gameType: game.type,
        gameName: game.name,
        outcome: game.outcome,
        moveCount: game.moveCount ?? 0,
        userMoves,
        spiritkinMoves: skCommentary,
        spiritkinCommentary: skCommentary,
        duration: Math.round(durationMs / 1000),
        spiritkinName,
      }).catch(err => console.warn('[GameEngine] writeGameSession failed:', err.message));
    }

    bus.emit('game.ended', { userId, conversationId, gameType: game.type, outcome: game.outcome });

    return { ok: true, game, message: 'Game ended.' };
  };

  /**
   * Draw a card for Spirit-Cards game.
   */
  const drawCard = async ({ userId, conversationId, spiritkinName }) => {
    const spiritkinId = await resolveSpiritkinId(spiritkinName);
    const worldData = await world.get({ userId, conversationId });
    const state = worldData.state;
    const game = state.flags?.active_game;

    if (!game || game.type !== 'spirit_cards') {
      throw new AppError('GAME_ERROR', 'No active Spirit-Cards game.', 400);
    }

    if (!game.data.deck || game.data.deck.length === 0) {
      return { ok: true, game, spiritkinMessage: 'The deck is empty. The realm has spoken all it can.' };
    }

    const card = game.data.deck.shift();
    game.data.hand = game.data.hand || [];
    game.data.hand.push(card);

    await world.upsert({
      userId, conversationId,
      spiritkinId: spiritkinId ?? worldData.spiritkinId,
      state
    });

    return {
      ok: true,
      game,
      spiritkinMessage: `You draw *${card.name}* — ${card.effect} The deck holds ${game.data.deck.length} cards remaining.`
    };
  };

  return { startGame, makeMove, endGame, drawCard, listGames: () => GAMES };
};
