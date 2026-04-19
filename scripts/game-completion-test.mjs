import { createSharedGameRuntime } from "../src/services/sharedGameEngine.mjs";
import { createGameEngine } from "../src/services/gameEngine.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createFakeWorld() {
  const store = new Map();
  return {
    async get({ userId, conversationId }) {
      const key = `${userId}:${conversationId}`;
      if (!store.has(key)) {
        store.set(key, {
          spiritkinId: "sk_test",
          state: { scene: { name: "default" }, flags: {}, bond: { stage: 1, stage_name: "Awakening", interaction_count: 12 } },
        });
      }
      return store.get(key);
    },
    async upsert({ userId, conversationId, spiritkinId, state }) {
      const key = `${userId}:${conversationId}`;
      store.set(key, { spiritkinId: spiritkinId || "sk_test", state: structuredClone(state) });
      return store.get(key);
    },
  };
}

async function testChess(runtime) {
  const invalidGame = runtime.createGameState("chess");
  assert(!runtime.applyUserMove(invalidGame, "e2e5"), "chess invalid move should be rejected");

  const userWinGame = runtime.createGameState("chess");
  userWinGame.data.fen = "7k/8/5KQ1/8/8/8/8/8 w - - 0 1";
  assert(runtime.applyUserMove(userWinGame, "g6g7"), "chess checkmate move should apply");
  assert(userWinGame.status === "ended", "chess checkmate should end the game");
  assert(userWinGame.result?.winner === "user" && userWinGame.result?.reason === "checkmate", "chess checkmate result should be recorded");

  const drawGame = runtime.createGameState("chess");
  drawGame.data.fen = "7k/5K2/8/6Q1/8/8/8/8 w - - 0 1";
  assert(runtime.applyUserMove(drawGame, "g5g6"), "chess stalemate move should apply");
  assert(drawGame.status === "ended", "chess stalemate should end the game");
  assert(drawGame.result?.isDraw && drawGame.result?.reason === "stalemate", "chess stalemate should be recorded as draw");

  const spiritkinWinGame = runtime.createGameState("chess");
  spiritkinWinGame.data.fen = "8/8/8/8/8/5k2/4q3/7K b - - 0 1";
  spiritkinWinGame.turn = "spiritkin";
  assert(runtime.applySpiritkinMove(spiritkinWinGame, "e2g2"), "chess spiritkin move should apply");
  assert(spiritkinWinGame.status === "ended", "chess spiritkin win should end the game");
}

async function testTicTacToe(runtime) {
  const winGame = runtime.createGameState("tictactoe");
  assert(runtime.applyUserMove(winGame, "0"), "ttt user move 0 failed");
  assert(runtime.applySpiritkinMove(winGame, "3"), "ttt spiritkin move 3 failed");
  assert(runtime.applyUserMove(winGame, "1"), "ttt user move 1 failed");
  assert(runtime.applySpiritkinMove(winGame, "4"), "ttt spiritkin move 4 failed");
  assert(runtime.applyUserMove(winGame, "2"), "ttt winning move failed");
  assert(winGame.status === "ended" && winGame.result?.winner === "user", "ttt user win should end and mark winner");

  const drawGame = runtime.createGameState("tictactoe");
  for (const [player, move] of [
    ["user", "0"], ["spiritkin", "1"], ["user", "2"],
    ["spiritkin", "4"], ["user", "3"], ["spiritkin", "5"],
    ["user", "7"], ["spiritkin", "6"], ["user", "8"],
  ]) {
    const applied = player === "user" ? runtime.applyUserMove(drawGame, move) : runtime.applySpiritkinMove(drawGame, move);
    assert(applied, `ttt draw move ${move} failed`);
  }
  assert(drawGame.status === "ended" && drawGame.result?.isDraw, "ttt draw should be detected");
}

async function testConnectFour(runtime) {
  const winGame = runtime.createGameState("connect_four");
  for (const [player, move] of [
    ["user", "0"], ["spiritkin", "1"],
    ["user", "0"], ["spiritkin", "1"],
    ["user", "0"], ["spiritkin", "1"],
    ["user", "0"],
  ]) {
    const applied = player === "user" ? runtime.applyUserMove(winGame, move) : runtime.applySpiritkinMove(winGame, move);
    assert(applied, `connect four move ${move} failed`);
  }
  assert(winGame.status === "ended" && winGame.result?.winner === "user", "connect four user win should be detected");

  const drawGame = runtime.createGameState("connect_four");
  drawGame.data.board = [
    "U","U","S","S","U","U","S",
    "S","S","U","U","S","S","U",
    "U","U","S","S","U","U","S",
    "S","S","U","U","S","S","U",
    "U","U","S","S","U","U","S",
    "S","S","U","U","S","S",null,
  ];
  assert(runtime.applyUserMove(drawGame, "6"), "connect four final draw move failed");
  assert(drawGame.status === "ended" && drawGame.result?.isDraw, "connect four draw should be detected");
}

async function testCheckers(runtime) {
  const fallbackGame = runtime.createGameState("checkers");
  const fallbackMove = runtime.chooseFallbackMove(fallbackGame, "spiritkin");
  assert(typeof fallbackMove === "string" && fallbackMove.includes("-"), "checkers fallback should produce a move");
  assert(runtime.applySpiritkinMove(fallbackGame, fallbackMove), "checkers fallback move should be legal");

  const kingGame = runtime.createGameState("checkers");
  kingGame.data.board = Array(32).fill(null);
  kingGame.data.board[5] = "white";
  assert(runtime.applyUserMove(kingGame, "5-0"), "checkers promotion move should apply");
  assert(String(kingGame.data.board[0]).includes("king"), "checkers promotion should crown the piece");

  const winGame = runtime.createGameState("checkers");
  winGame.data.board = Array(32).fill(null);
  winGame.data.board[9] = "white";
  winGame.data.board[6] = "black";
  assert(runtime.applyUserMove(winGame, "9-3"), "checkers capture move should apply");
  assert(winGame.status === "ended" && winGame.result?.winner === "user", "checkers capture should complete the game");
}

async function testBattleship(runtime) {
  const game = runtime.createGameState("battleship");
  assert(runtime.applyUserMove(game, "4"), "battleship hit 4 failed");
  assert(!runtime.applyUserMove(game, "4"), "battleship duplicate guess should be rejected");
  assert(runtime.applySpiritkinMove(game, "1"), "battleship spiritkin guess failed");
  assert(runtime.applyUserMove(game, "11"), "battleship hit 11 failed");
  assert(runtime.applySpiritkinMove(game, "7"), "battleship spiritkin second guess failed");
  assert(runtime.applyUserMove(game, "22"), "battleship finishing hit failed");
  assert(game.status === "ended" && game.result?.winner === "user", "battleship completion should be detected");
}

async function testEngineReplay() {
  const world = createFakeWorld();
  const runtime = createSharedGameRuntime();
  const gameEngine = createGameEngine({
    bus: { emit() {} },
    world,
    registry: { async getCanonical(name) { return { id: `sk_${name}`, name }; } },
    orchestrator: {
      async interact() {
        return { message: "Clean answer. MOVE:4" };
      },
    },
  });

  const base = { userId: "u_test", conversationId: "c_test", spiritkinName: "Lyra" };
  const started = await gameEngine.startGame({ ...base, gameType: "tictactoe" });
  assert(started.ok && started.game.status === "active", "engine startGame should create active game");

  const ended = await gameEngine.endGame({ ...base, outcome: "forfeit" });
  assert(ended.ok && ended.game.status === "ended", "engine endGame should end current game");
  assert(typeof ended.message === "string" && ended.message.length > 0, "engine endGame should return final reaction");

  const replayed = await gameEngine.startGame({ ...base, gameType: "tictactoe" });
  assert(replayed.ok && replayed.game.status === "active", "engine replay should start clean active game");
  assert(replayed.game.moveCount === 0 && replayed.game.history.length === 0, "replayed game should reset move state");

  const listed = gameEngine.listGames();
  assert(listed.chess && listed.tictactoe && listed.connect_four && listed.battleship, "target games should stay listed");
  void runtime;
}

async function main() {
  const runtime = createSharedGameRuntime();
  await testChess(runtime);
  await testCheckers(runtime);
  await testTicTacToe(runtime);
  await testConnectFour(runtime);
  await testBattleship(runtime);
  await testEngineReplay();
  console.log("game-completion-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
