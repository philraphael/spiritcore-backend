const GAME_REGISTRY = {
  chess: {
    name: "Celestial Chess",
    type: "strategy",
    description: "Classic chess played in the Spiritverse. Each piece is a constellation in the Luminous Veil.",
    instructions: "Move your pieces (White) to checkmate the Spiritkin (Black). Use algebraic notation or click the board.",
    createData: () => ({ fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", lastMove: null }),
  },
  checkers: {
    name: "Veil Checkers",
    type: "strategy",
    description: "Checkers played across the Luminous Veil. Shards of light against deep shadow.",
    instructions: "Capture all Spiritkin pieces. Pieces move diagonally forward.",
    createData: () => ({ board: Array(32).fill(null).map((_, i) => i < 12 ? "black" : (i >= 20 ? "white" : null)), lastMove: null }),
  },
  go: {
    name: "Star-Mapping (Go)",
    type: "strategy",
    description: "Go played on a 13x13 star chart. Every stone placed shapes the sky.",
    instructions: "Surround more territory than the Spiritkin to win.",
    createData: () => ({ board: Array(13 * 13).fill(null), lastMove: null }),
  },
  spirit_cards: {
    name: "Spirit-Cards",
    type: "tcg",
    description: "A Spiritverse trading card game. Shape the realm with your hand.",
    instructions: "Play cards to gain Realm Points or challenge the Spiritkin's board.",
    createData: () => {
      const deck = generateCardDeck();
      return { hand: deck.splice(0, 5), deck, discard: [], board: [], spiritkinHand: generateCardDeck().splice(0, 5), mana: 5, spiritkinMana: 5 };
    },
  },
  echo_trials: {
    name: "Echo Trials",
    type: "echoes",
    description: "A challenge where your Spiritkin poses riddles from the deep Echoes of the Spiritverse.",
    instructions: "Answer the riddle posed by your Spiritkin.",
    createData: () => {
      const riddles = [
        { question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "echo" },
        { question: "The more you take, the more you leave behind. What am I?", answer: "footsteps" },
        { question: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?", answer: "map" },
      ];
      const riddle = riddles[Math.floor(Math.random() * riddles.length)];
      return { riddle: riddle.question, answer: riddle.answer.toLowerCase(), attempts: 0, maxAttempts: 3 };
    },
  },
  tictactoe: {
    name: "TicTacToe of Echoes",
    type: "strategy",
    description: "A quick duel of pattern and timing.",
    instructions: "Claim three in a line before your companion does.",
    createData: () => ({ board: Array(9).fill(null), winner: null, lastMove: null }),
  },
  connect_four: {
    name: "Connect Four Constellations",
    type: "strategy",
    description: "Drop stars into the column and align four before your companion does.",
    instructions: "Choose a column and connect four in a row.",
    createData: () => ({ board: Array(42).fill(null), winner: null, lastMove: null }),
  },
  battleship: {
    name: "Abyssal Battleship",
    type: "strategy",
    description: "Trade deep-water strikes until one fleet is fully revealed.",
    instructions: "Choose cells on the 5x5 grid to search for your companion's hidden fleet.",
    createData: () => ({
      size: 5,
      userTargets: [1, 7, 19],
      spiritkinTargets: [4, 11, 22],
      userGuesses: [],
      spiritkinGuesses: [],
      hits: { user: [], spiritkin: [] },
      winner: null,
      lastMove: null,
    }),
  },
};

export function createSharedGameRuntime() {
  function createGameState(type) {
    const meta = GAME_REGISTRY[type];
    if (!meta) return null;
    return {
      type,
      name: meta.name,
      status: "active",
      turn: "user",
      moveCount: 0,
      history: [],
      data: meta.createData(),
      startedAt: new Date().toISOString(),
    };
  }

  function getGameMeta(type) {
    return GAME_REGISTRY[type] ?? null;
  }

  function listGames() {
    return GAME_REGISTRY;
  }

  function applyUserMove(game, move) {
    return applyMove(game, move, "user");
  }

  function applySpiritkinMove(game, move) {
    return applyMove(game, move, "spiritkin");
  }

  function applyMove(game, move, player) {
    if (!game?.data) return false;
    const type = game.type;
    if (type === "chess") return applyChessMove(game, move, player);
    if (type === "checkers") return applyCheckersMove(game, move, player);
    if (type === "go") return applyGoMove(game, move, player);
    if (type === "tictactoe") return applyTicTacToeMove(game, move, player);
    if (type === "connect_four") return applyConnectFourMove(game, move, player);
    if (type === "battleship") return applyBattleshipMove(game, move, player);
    if (type === "echo_trials") return applyEchoTrialsMove(game, move, player);
    if (type === "spirit_cards") return applySpiritCardsMove(game, move, player);
    return false;
  }

  function chooseFallbackMove(game, player = "spiritkin") {
    if (game.type === "chess") return "e7e5";
    if (game.type === "checkers") return "11-15";
    if (game.type === "go") return "G7";
    if (game.type === "tictactoe") return String(game.data.board.findIndex((cell) => cell == null));
    if (game.type === "connect_four") return String(firstPlayableColumn(game.data.board));
    if (game.type === "battleship") return String(firstUnguessedCell(game.data, player));
    if (game.type === "spirit_cards") return "draw";
    if (game.type === "echo_trials") return null;
    return null;
  }

  function extractMove(text, type) {
    const generic = text.match(/(?:^|\n)\s*MOVE:\s*([a-z0-9\-]+)/i) || text.match(/I play ([a-z0-9\-]+)/i);
    if (!generic) return null;
    const raw = generic[1];
    if (type === "tictactoe" || type === "connect_four" || type === "battleship") return String(parseInt(raw, 10));
    return raw;
  }

  function buildPrompt(game, userMove, spiritkinName = "Spiritkin") {
    return [
      `[GAME:${game.type}]`,
      `Spiritkin: ${spiritkinName}`,
      `User move: ${userMove}`,
      `Visible state: ${JSON.stringify(game.data)}`,
      `Keep the spoken reaction short, natural, and personality-specific.`,
      `Do not narrate the board like a commentator and do not repeat the exact move string unless clarity truly requires it.`,
      buildGameToneInstruction(game.type, spiritkinName),
      `Append one final machine-readable line exactly as MOVE:<move>.`,
    ].filter(Boolean).join(" ");
  }

  return {
    createGameState,
    getGameMeta,
    listGames,
    applyUserMove,
    applySpiritkinMove,
    chooseFallbackMove,
    extractMove,
    buildPrompt,
  };
}

function buildGameToneInstruction(gameType, spiritkinName) {
  const shared = gameType === "battleship"
    ? "React like a tense hidden-information duel."
    : gameType === "connect_four"
      ? "React like a quick positional duel with momentum."
      : gameType === "tictactoe"
        ? "React like a quick pattern duel."
        : "React to the move itself, not the interface.";

  if (spiritkinName === "Lyra") return `${shared} Lyra should sound calm, present, and gently incisive.`;
  if (spiritkinName === "Raien") return `${shared} Raien should sound direct, competitive, and clean.`;
  if (spiritkinName === "Kairo") return `${shared} Kairo should sound curious, alert to patterns, and lightly playful.`;
  if (spiritkinName === "Elaria") return `${shared} Elaria should sound precise, composed, and unmistakably deliberate.`;
  if (spiritkinName === "Thalassar") return `${shared} Thalassar should sound deep, steady, and quietly challenging.`;
  return shared;
}

function applyChessMove(game, move) {
  const nextFen = applyFenMove(game.data.fen, move);
  if (!nextFen) return false;
  game.data.fen = nextFen;
  game.data.lastMove = move;
  return true;
}

function applyFenMove(fen, move) {
  const parts = String(fen || "").split(" ");
  const board = parts[0].split("/").map((row) => row.replace(/\d/g, (n) => " ".repeat(parseInt(n, 10))).split(""));
  const match = String(move || "").match(/^([a-h])([1-8])([a-h])([1-8])$/i);
  if (!match) return null;
  const fromCol = match[1].toLowerCase().charCodeAt(0) - 97;
  const fromRow = 8 - parseInt(match[2], 10);
  const toCol = match[3].toLowerCase().charCodeAt(0) - 97;
  const toRow = 8 - parseInt(match[4], 10);
  if (!board[fromRow]?.[fromCol] || board[fromRow][fromCol] === " ") return null;
  board[toRow][toCol] = board[fromRow][fromCol];
  board[fromRow][fromCol] = " ";
  const nextBoard = board.map((row) => row.join("").replace(/ +/g, (spaces) => spaces.length)).join("/");
  return `${nextBoard} ${parts[1] === "w" ? "b" : "w"} - - 0 1`;
}

function applyCheckersMove(game, move) {
  const [fromRaw, toRaw] = String(move || "").split("-");
  const from = parseInt(fromRaw, 10);
  const to = parseInt(toRaw, 10);
  if (!Number.isInteger(from) || !Number.isInteger(to) || !game.data.board[from]) return false;
  game.data.board[to] = game.data.board[from];
  game.data.board[from] = null;
  if (Math.abs(to - from) > 5) game.data.board[Math.floor((from + to) / 2)] = null;
  game.data.lastMove = move;
  return true;
}

function applyGoMove(game, move, player) {
  const match = String(move || "").match(/^([A-M])([1-9]|1[0-3])$/i);
  if (!match) return false;
  const size = 13;
  const col = match[1].toUpperCase().charCodeAt(0) - 65;
  const row = size - parseInt(match[2], 10);
  const idx = row * size + col;
  if (game.data.board[idx]) return false;
  game.data.board[idx] = player === "user" ? "black" : "white";
  game.data.lastMove = move;
  return true;
}

function applyTicTacToeMove(game, move, player) {
  const idx = parseInt(move, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= 9 || game.data.board[idx]) return false;
  game.data.board[idx] = player === "user" ? "X" : "O";
  game.data.lastMove = String(idx);
  game.data.winner = detectLineWinner(game.data.board, 3);
  if (game.data.winner || game.data.board.every(Boolean)) game.status = "ended";
  return true;
}

function applyConnectFourMove(game, move, player) {
  const col = parseInt(move, 10);
  if (!Number.isInteger(col) || col < 0 || col > 6) return false;
  const row = findDropRow(game.data.board, col);
  if (row === -1) return false;
  const idx = row * 7 + col;
  game.data.board[idx] = player === "user" ? "U" : "S";
  game.data.lastMove = String(col);
  game.data.winner = detectConnectFourWinner(game.data.board);
  if (game.data.winner || !game.data.board.includes(null)) game.status = "ended";
  return true;
}

function applyBattleshipMove(game, move, player) {
  const idx = parseInt(move, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= 25) return false;
  const guessesKey = player === "user" ? "userGuesses" : "spiritkinGuesses";
  const hitKey = player === "user" ? "user" : "spiritkin";
  const targets = player === "user" ? game.data.spiritkinTargets : game.data.userTargets;
  if (game.data[guessesKey].includes(idx)) return false;
  game.data[guessesKey].push(idx);
  if (targets.includes(idx)) game.data.hits[hitKey].push(idx);
  game.data.lastMove = String(idx);
  if (game.data.hits.user.length >= game.data.spiritkinTargets.length || game.data.hits.spiritkin.length >= game.data.userTargets.length) {
    game.data.winner = game.data.hits.user.length >= game.data.spiritkinTargets.length ? "user" : "spiritkin";
    game.status = "ended";
  }
  return true;
}

function applyEchoTrialsMove(game, move) {
  const answer = String(move || "").trim().toLowerCase();
  game.data.attempts = Number(game.data.attempts || 0) + 1;
  if (answer === game.data.answer) game.status = "ended";
  if (game.data.attempts >= game.data.maxAttempts) game.status = "ended";
  game.data.lastMove = answer;
  return true;
}

function applySpiritCardsMove(game, move, player) {
  if (move === "draw") {
    const deck = game.data.deck || [];
    const drawn = deck.shift();
    if (drawn) {
      const handKey = player === "user" ? "hand" : "spiritkinHand";
      game.data[handKey].push(drawn);
      game.data.lastMove = move;
      return true;
    }
    return false;
  }
  if (/^play[:_]/.test(move)) {
    game.data.lastMove = move;
    return true;
  }
  return false;
}

function detectLineWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function detectConnectFourWinner(board) {
  const width = 7;
  const height = 6;
  const at = (r, c) => board[r * width + c];
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const cell = at(r, c);
      if (!cell) continue;
      if (c <= width - 4 && cell === at(r, c+1) && cell === at(r, c+2) && cell === at(r, c+3)) return cell;
      if (r <= height - 4 && cell === at(r+1, c) && cell === at(r+2, c) && cell === at(r+3, c)) return cell;
      if (r <= height - 4 && c <= width - 4 && cell === at(r+1, c+1) && cell === at(r+2, c+2) && cell === at(r+3, c+3)) return cell;
      if (r >= 3 && c <= width - 4 && cell === at(r-1, c+1) && cell === at(r-2, c+2) && cell === at(r-3, c+3)) return cell;
    }
  }
  return null;
}

function findDropRow(board, col) {
  for (let row = 5; row >= 0; row -= 1) {
    if (!board[row * 7 + col]) return row;
  }
  return -1;
}

function firstPlayableColumn(board) {
  for (let col = 0; col < 7; col += 1) {
    if (findDropRow(board, col) !== -1) return col;
  }
  return 0;
}

function firstUnguessedCell(data, player) {
  const guesses = player === "user" ? data.userGuesses : data.spiritkinGuesses;
  for (let i = 0; i < 25; i += 1) {
    if (!guesses.includes(i)) return i;
  }
  return 0;
}

function generateCardDeck() {
  const cardTypes = ["Essence", "Spirit", "Realm", "Echo", "Bond"];
  const deck = [];
  for (let i = 0; i < 5; i += 1) {
    for (let j = 1; j <= 10; j += 1) {
      deck.push({
        id: `${cardTypes[i]}-${j}`,
        name: `${cardTypes[i]} ${j}`,
        type: cardTypes[i],
        cost: Math.ceil(j / 2),
        power: j,
      });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}
