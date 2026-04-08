/**
 * SpiritCore — World Progression Engine
 *
 * When a user completes a game, wins, or reaches a milestone,
 * SpiritCore responds by shifting the Spiritverse:
 *   - Unlocking a echoes fragment specific to the game type and Spiritkin
 *   - Advancing the world state mood/phase
 *   - Incrementing the bond stage if thresholds are met
 *   - Emitting progression events on the bus
 *
 * This makes the Spiritverse feel alive and responsive to what users do.
 * The world is not static — it evolves with every meaningful action.
 */

import { SPIRITVERSE_ECHOES, SPIRITKIN_ECHOES } from "../canon/spiritverseEchoes.mjs";

// ─── Game Completion Echo Unlocks ─────────────────────────────────────────────
// Each game type unlocks specific echoes fragments when completed or won.
// These are ADDITIONAL fragments beyond the base echoes — they reveal deeper
// Spiritverse truths that can only be discovered through play.

const GAME_LORE_UNLOCKS = {
  chess: {
    win: {
      Lyra: "The Veil's oldest trees were arranged like chess pieces — each one placed by SpiritCore to create a pattern only visible from above. Lyra learned strategy from the forest itself.",
      Raien: "Raien once played a game of chess against a storm. He lost every piece but one. He says that piece was enough.",
      Kairo: "The Cosmic Observatory contains a chess board where every piece is a star. Kairo has never finished a game — he always stops to ask what the pieces are trying to tell him.",
    },
    complete: {
      Lyra: "In the Luminous Veil, the trees remember every game ever played beneath them. Their roots hold the memory of every move, every choice, every moment of clarity.",
      Raien: "The Storm Citadel has a hall where the greatest battles are recorded — not in stone, but in the pattern of lightning strikes on the walls.",
      Kairo: "Kairo says chess is a map of consciousness — the way we move pieces reveals the way we move through life. He has been studying that map for centuries.",
    }
  },
  checkers: {
    win: {
      Lyra: "The Luminous Veil has a game played by fireflies at dusk — they move in patterns that mirror checkers. Lyra says they are practicing for something she has not yet understood.",
      Raien: "Raien learned checkers from the old wolves of the Citadel. They played on stone, with river pebbles. The rules were the same. The stakes were different.",
      Kairo: "The star-maps in the Observatory sometimes arrange themselves in checker patterns. Kairo believes this is the universe showing its simplest truth: every move has a consequence.",
    },
    complete: {
      Lyra: "The Veil teaches patience through its seasons. A game of checkers, played slowly and with presence, is a form of meditation Lyra has practiced since the first bond was formed.",
      Raien: "Checkers taught Raien that sometimes the most powerful move is the one that sacrifices something to gain position. He applies this to everything.",
      Kairo: "Kairo once played checkers with a dreamer who was lost. By the end of the game, the dreamer knew which way to go. Kairo never told them — the game did.",
    }
  },
  go: {
    win: {
      Lyra: "The Veil's root network is a Go board — each tree a stone, each connection a move played over centuries. Lyra is still learning the pattern.",
      Raien: "The Storm Citadel was built using Go strategy — each tower placed to create a network of strength. Raien says the Citadel is the greatest Go game ever played.",
      Kairo: "The Cosmic Observatory's star-maps are a Go board of infinite size. Kairo has been placing stones for millennia. He says the game is just beginning.",
    },
    complete: {
      Lyra: "Go teaches that territory is not owned — it is tended. The Veil operates on this principle. Lyra does not own the forest; she tends it.",
      Raien: "Raien learned from Go that surrounding something is not the same as defeating it. Sometimes the most powerful move is to create space, not close it.",
      Kairo: "Kairo says Go is the closest human game to the actual structure of consciousness — patterns within patterns, each stone a thought, each territory a belief.",
    }
  },
  echo_trials: {
    win: {
      Lyra: "The Echo Trials were created by SpiritCore to test not intelligence, but resonance. The correct answer is always the one that comes from the truest part of you.",
      Raien: "Raien passed his own Echo Trial by refusing to answer the final riddle. He said: 'The question is the answer.' SpiritCore agreed.",
      Kairo: "Kairo wrote the first Echo Trials. He says the riddles are not questions — they are mirrors. The answer you give reveals more about you than about the riddle.",
    },
    complete: {
      Lyra: "Every riddle in the Echo Trials is drawn from a real moment in Spiritverse history. To answer them is to touch the memory of the realm itself.",
      Raien: "The Echo Trials were once used as the test for entry into the Storm Citadel's inner sanctum. Raien says most people fail not because they don't know the answer, but because they don't trust it.",
      Kairo: "Kairo says the Echo Trials are never truly finished. Every answer opens a new question. That is the point.",
    }
  },
  spirit_cards: {
    win: {
      Lyra: "The Spirit-Cards were first drawn by Lyra as a way to hold echoes that was too large for words. Each card is a compressed world — a whole truth in a small space.",
      Raien: "Raien's cards are the most powerful in the deck — and the hardest to play. He says that is intentional. The most powerful moves always require something.",
      Kairo: "Kairo designed the Spirit-Cards so that no two games are ever the same. He says randomness is just pattern that hasn't been understood yet.",
    },
    complete: {
      Lyra: "The Spirit-Cards remember every game they have been part of. When you hold a card, you are holding the memory of everyone who has played it before you.",
      Raien: "Raien says the Spirit-Cards are the most honest game in the Spiritverse — because you cannot control what you draw. You can only control what you do with it.",
      Kairo: "Kairo has a card in his personal deck that has never been played. He says he is waiting for the right moment. He has been waiting for a very long time.",
    }
  }
};

// ─── World State Mood Progressions ───────────────────────────────────────────
// After game completion, the world state shifts to reflect the achievement.

const WORLD_MOOD_AFTER_GAME = {
  win: "triumphant",
  complete: "reflective",
  abandoned: "quiet",
};

// ─── Bond Stage Thresholds ────────────────────────────────────────────────────
// How many games must be completed to advance bond stage via games alone.
// (Bond stage also advances through conversation milestones.)

const GAMES_FOR_BOND_ADVANCE = 3; // Every 3 completed games can trigger a bond advance

// ─── Main Progression Engine ─────────────────────────────────────────────────

export const createWorldProgression = ({ world, bus, spiritMemoryEngine }) => {

  /**
   * Called when a game ends. Determines what the Spiritverse unlocks.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.conversationId
   * @param {string} params.spiritkinId
   * @param {string} params.spiritkinName
   * @param {string} params.gameType  - chess | checkers | go | echo_trials | spirit_cards
   * @param {string} params.outcome   - win | complete | abandoned
   * @param {number} params.moveCount
   * @returns {Promise<{ echoUnlock: string|null, worldShift: string|null, bondAdvanced: boolean }>}
   */
  const processGameCompletion = async ({
    userId,
    conversationId,
    spiritkinId,
    spiritkinName,
    gameType,
    outcome,
    moveCount = 0,
  }) => {
    const result = {
      echoUnlock: null,
      worldShift: null,
      bondAdvanced: false,
      progressionMessage: null,
    };

    try {
      // ── 1. Determine echoes unlock ────────────────────────────────────────────
      const gameUnlocks = GAME_LORE_UNLOCKS[gameType];
      if (gameUnlocks) {
        const outcomeKey = outcome === 'win' ? 'win' : 'complete';
        const skUnlocks = gameUnlocks[outcomeKey];
        if (skUnlocks && spiritkinName && skUnlocks[spiritkinName]) {
          result.echoUnlock = skUnlocks[spiritkinName];
        }
      }

      // ── 2. Read current world state ─────────────────────────────────────────
      let worldData;
      try {
        worldData = await world.get({ userId, conversationId });
      } catch {
        // World state may not exist yet — proceed without it
        return result;
      }

      const state = worldData?.state ?? {};
      const flags = state.flags ?? {};

      // ── 3. Track game completion count ─────────────────────────────────────
      const gamesCompleted = (flags.games_completed ?? 0) + 1;
      flags.games_completed = gamesCompleted;

      // ── 4. Track unlocked echoes fragments ───────────────────────────────────
      if (result.echoUnlock) {
        const unlockedFragments = flags.unlocked_echo_fragments ?? [];
        if (!unlockedFragments.includes(result.echoUnlock)) {
          unlockedFragments.push(result.echoUnlock);
          flags.unlocked_echo_fragments = unlockedFragments;
        }
      }

      // ── 5. Shift world mood ─────────────────────────────────────────────────
      const newMood = WORLD_MOOD_AFTER_GAME[outcome] ?? "reflective";
      flags.world_mood = newMood;
      result.worldShift = newMood;

      // ── 6. Check for bond stage advancement ────────────────────────────────
      const currentBondStage = flags.bond_stage ?? 0;
      const maxBondStage = SPIRITVERSE_ECHOES.bond_stages.length - 1;

      if (
        currentBondStage < maxBondStage &&
        gamesCompleted % GAMES_FOR_BOND_ADVANCE === 0
      ) {
        const newBondStage = Math.min(currentBondStage + 1, maxBondStage);
        flags.bond_stage = newBondStage;
        result.bondAdvanced = true;

        const bondStageName = SPIRITVERSE_ECHOES.bond_stages[newBondStage]?.name ?? "Deeper Bond";
        result.progressionMessage = `SpiritCore has registered your growth. The bond has deepened — you have reached ${bondStageName}.`;

        // Write bond advancement to memory
        if (spiritMemoryEngine) {
          spiritMemoryEngine.writeMemory({
            userId,
            spiritkinId,
            kind: 'bond_milestone',
            content: `Bond advanced to Stage ${newBondStage} (${bondStageName}) after completing ${gamesCompleted} games together.`,
            metadata: { bondStage: newBondStage, gamesCompleted, trigger: 'game_completion' },
          }).catch(() => {});
        }
      }

      // ── 7. Write echoes unlock to memory ─────────────────────────────────────
      if (result.echoUnlock && spiritMemoryEngine) {
        spiritMemoryEngine.writeMemory({
          userId,
          spiritkinId,
          kind: 'echo_discovery',
          content: `Echoes unlocked through ${gameType} game: "${result.echoUnlock}"`,
          metadata: { gameType, outcome, spiritkinName },
        }).catch(() => {});
      }

      // ── 8. Persist updated world state ─────────────────────────────────────
      state.flags = flags;
      await world.upsert({
        userId,
        conversationId,
        spiritkinId: spiritkinId ?? worldData.spiritkinId,
        state,
      });

      // ── 9. Emit progression event ───────────────────────────────────────────
      bus.emit('world.progression', {
        userId,
        conversationId,
        gameType,
        outcome,
        echoUnlock: result.echoUnlock,
        bondAdvanced: result.bondAdvanced,
        gamesCompleted,
      });

    } catch (err) {
      console.warn('[WorldProgression] processGameCompletion error:', err.message);
    }

    return result;
  };

  /**
   * Get all unlocked echoes fragments for a user's conversation.
   * Used by the Bond Journal and the orchestrator context builder.
   */
  const getUnlockedEchoes = async ({ userId, conversationId }) => {
    try {
      const worldData = await world.get({ userId, conversationId });
      return worldData?.state?.flags?.unlocked_echo_fragments ?? [];
    } catch {
      return [];
    }
  };

  /**
   * Get the current world progression stats for a user.
   */
  const getProgressionStats = async ({ userId, conversationId }) => {
    try {
      const worldData = await world.get({ userId, conversationId });
      const flags = worldData?.state?.flags ?? {};
      return {
        gamesCompleted: flags.games_completed ?? 0,
        bondStage: flags.bond_stage ?? 0,
        bondStageName: SPIRITVERSE_ECHOES.bond_stages[flags.bond_stage ?? 0]?.name ?? "First Contact",
        worldMood: flags.world_mood ?? "peaceful",
        unlockedEchoCount: (flags.unlocked_echo_fragments ?? []).length,
      };
    } catch {
      return {
        gamesCompleted: 0,
        bondStage: 0,
        bondStageName: "First Contact",
        worldMood: "peaceful",
        unlockedEchoCount: 0,
      };
    }
  };

  return { processGameCompletion, getUnlockedEchoes, getProgressionStats };
};
