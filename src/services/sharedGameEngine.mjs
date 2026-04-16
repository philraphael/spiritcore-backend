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
      const spiritkinDeck = generateCardDeck();
      return {
        hand: deck.splice(0, 5),
        deck,
        discard: [],
        board: [],
        spiritkinHand: spiritkinDeck.splice(0, 5),
        spiritkinDeck,
        spiritkinDiscard: [],
        mana: 5,
        spiritkinMana: 5,
        realmPoints: { user: 0, spiritkin: 0 },
      };
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
      result: null,
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
    if (game.type === "chess") {
      const moves = listLegalChessMoves(game.data?.fen, player === "user" ? "w" : "b");
      return moves[0] ?? null;
    }
    if (game.type === "checkers") return "11-15";
    if (game.type === "go") return "G7";
    if (game.type === "tictactoe") return chooseTicTacToeMove(game.data.board, player === "user" ? "X" : "O");
    if (game.type === "connect_four") return String(firstPlayableColumn(game.data.board));
    if (game.type === "battleship") return String(firstUnguessedCell(game.data, player));
    if (game.type === "spirit_cards") {
      const hand = player === "user" ? (game.data.hand || []) : (game.data.spiritkinHand || []);
      const mana = player === "user" ? Number(game.data.mana || 0) : Number(game.data.spiritkinMana || 0);
      const playable = hand
        .filter((card) => Number(card?.cost || 0) <= mana)
        .sort((a, b) => Number(b?.power || 0) - Number(a?.power || 0))[0];
      if (playable?.name) return `play:${playable.name}`;
      const deck = player === "user" ? (game.data.deck || []) : (game.data.spiritkinDeck || []);
      return deck.length ? "draw" : null;
    }
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
    describeOutcome,
  };
}

function chooseTicTacToeMove(board, marker) {
  const enemy = marker === "X" ? "O" : "X";
  const open = board.map((cell, idx) => cell == null ? idx : -1).filter((idx) => idx !== -1);
  if (!open.length) return null;

  for (const idx of open) {
    const trial = [...board];
    trial[idx] = marker;
    if (detectLineWinner(trial) === marker) return String(idx);
  }

  for (const idx of open) {
    const trial = [...board];
    trial[idx] = enemy;
    if (detectLineWinner(trial) === enemy) return String(idx);
  }

  if (board[4] == null) return "4";

  const corners = [0, 2, 6, 8].filter((idx) => board[idx] == null);
  if (corners.length) return String(corners[0]);

  return String(open[0]);
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
  const playerColor = moveColorForTurn(game, move);
  const applied = applyFenMove(game.data.fen, move, playerColor);
  if (!applied) return false;
  game.data.fen = applied.fen;
  game.data.lastMove = move;
  applyChessOutcome(game, applied.nextTurnColor);
  return true;
}

function applyFenMove(fen, move, playerColor) {
  const parts = String(fen || "").trim().split(/\s+/);
  const board = parseFenBoard(parts[0]);
  const match = String(move || "").match(/^([a-h])([1-8])([a-h])([1-8])$/i);
  if (!match) return null;
  const fromCol = match[1].toLowerCase().charCodeAt(0) - 97;
  const fromRow = 8 - parseInt(match[2], 10);
  const toCol = match[3].toLowerCase().charCodeAt(0) - 97;
  const toRow = 8 - parseInt(match[4], 10);
  if (!isLegalChessMove(board, fromRow, fromCol, toRow, toCol, playerColor)) return null;
  const nextBoard = cloneBoard(board);
  nextBoard[toRow][toCol] = promoteIfNeeded(nextBoard[fromRow][fromCol], toRow);
  nextBoard[fromRow][fromCol] = " ";
  const nextTurnColor = playerColor === "w" ? "b" : "w";
  return {
    fen: `${boardToFen(nextBoard)} ${nextTurnColor} - - 0 1`,
    nextTurnColor,
  };
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
  if (game.data.winner) {
    setOutcome(game, {
      winner: game.data.winner === "X" ? "user" : "spiritkin",
      reason: "line-complete",
      label: game.data.winner === "X" ? "You aligned the line." : "Your Spiritkin aligned the line.",
    });
  } else if (game.data.board.every(Boolean)) {
    setOutcome(game, {
      winner: null,
      reason: "draw",
      label: "The grid resolved into a draw.",
    });
  }
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
  if (game.data.winner) {
    setOutcome(game, {
      winner: game.data.winner === "U" ? "user" : "spiritkin",
      reason: "connect-four",
      label: game.data.winner === "U" ? "You connected four." : "Your Spiritkin connected four.",
    });
  } else if (!game.data.board.includes(null)) {
    setOutcome(game, {
      winner: null,
      reason: "draw",
      label: "The board filled into a draw.",
    });
  }
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
    setOutcome(game, {
      winner: game.data.winner,
      reason: "fleet-cleared",
      label: game.data.winner === "user" ? "You found every hidden vessel." : "Your Spiritkin found every hidden vessel.",
    });
  }
  return true;
}

function applyEchoTrialsMove(game, move) {
  const answer = String(move || "").trim().toLowerCase();
  game.data.attempts = Number(game.data.attempts || 0) + 1;
  if (answer === game.data.answer) {
    setOutcome(game, {
      winner: "user",
      reason: "riddle-solved",
      label: "You solved the Echo Trial."
    });
  } else if (game.data.attempts >= game.data.maxAttempts) {
    setOutcome(game, {
      winner: "spiritkin",
      reason: "attempts-exhausted",
      label: "The Echo Trial closed before the right answer surfaced."
    });
  }
  game.data.lastMove = answer;
  return true;
}

function applySpiritCardsMove(game, move, player) {
  const handKey = player === "user" ? "hand" : "spiritkinHand";
  const deckKey = player === "user" ? "deck" : "spiritkinDeck";
  const discardKey = player === "user" ? "discard" : "spiritkinDiscard";
  const manaKey = player === "user" ? "mana" : "spiritkinMana";
  const opponentManaKey = player === "user" ? "spiritkinMana" : "mana";
  const owner = player === "user" ? "user" : "spiritkin";
  const pointKey = owner;

  if (move === "draw") {
    const deck = game.data[deckKey] || [];
    const drawn = deck.shift();
    if (drawn) {
      game.data[handKey].push(drawn);
      game.data.lastMove = move;
      return true;
    }
    return false;
  }
  if (/^play[:_]/.test(move)) {
    const cardName = String(move).slice(5).trim().toLowerCase();
    const hand = Array.isArray(game.data[handKey]) ? game.data[handKey] : [];
    const cardIndex = hand.findIndex((card) => String(card?.name || "").trim().toLowerCase() === cardName);
    if (cardIndex === -1) return false;
    const card = hand[cardIndex];
    const availableMana = Number(game.data[manaKey] || 0);
    const cost = Number(card?.cost || 0);
    if (cost > availableMana) return false;

    hand.splice(cardIndex, 1);
    game.data[discardKey] = Array.isArray(game.data[discardKey]) ? game.data[discardKey] : [];
    game.data[discardKey].push(card);
    game.data.board = Array.isArray(game.data.board) ? game.data.board : [];
    game.data.board.push({
      owner,
      cardId: card.id,
      name: card.name,
      type: card.type,
      cost,
      power: Number(card?.power || 0),
    });
    game.data.realmPoints = game.data.realmPoints && typeof game.data.realmPoints === "object"
      ? game.data.realmPoints
      : { user: 0, spiritkin: 0 };
    game.data.realmPoints[pointKey] = Number(game.data.realmPoints[pointKey] || 0) + Number(card?.power || 0);
    game.data[manaKey] = Math.max(0, availableMana - cost);
    game.data[opponentManaKey] = 5;
    game.data.lastMove = move;
    if (game.data.realmPoints[pointKey] >= 15) {
      setOutcome(game, {
        winner: owner,
        reason: "realm-points",
        label: owner === "user"
          ? "You shaped the stronger realm and won Spirit-Cards."
          : "Your Spiritkin shaped the stronger realm and won Spirit-Cards."
      });
    }
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

function setOutcome(game, { winner = null, reason = "completed", label = "Game complete." }) {
  game.status = "ended";
  game.result = {
    winner,
    reason,
    label,
    isDraw: winner == null,
  };
}

function describeOutcome(game) {
  return game?.result ?? null;
}

function moveColorForTurn(game, move) {
  const fenTurn = String(game?.data?.fen || "").trim().split(/\s+/)[1];
  if (fenTurn === "w" || fenTurn === "b") return fenTurn;
  return game?.turn === "user" ? "w" : "b";
}

function applyChessOutcome(game, nextTurnColor) {
  const board = parseFenBoard(String(game.data.fen || "").split(/\s+/)[0]);
  const nextKing = findKing(board, nextTurnColor);
  const winner = nextTurnColor === "w" ? "spiritkin" : "user";
  if (!nextKing) {
    setOutcome(game, {
      winner,
      reason: "king-lost",
      label: winner === "user" ? "You ended the game decisively." : "Your Spiritkin ended the game decisively.",
    });
    return;
  }

  const legalMoves = listLegalChessMoves(game.data.fen, nextTurnColor);
  if (legalMoves.length > 0) {
    game.result = null;
    return;
  }

  if (isSquareAttacked(board, nextKing.row, nextKing.col, nextTurnColor === "w" ? "b" : "w")) {
    setOutcome(game, {
      winner,
      reason: "checkmate",
      label: winner === "user" ? "Checkmate. You closed the board cleanly." : "Checkmate. Your Spiritkin closed the board cleanly.",
    });
    return;
  }

  setOutcome(game, {
    winner: null,
    reason: "stalemate",
    label: "Stalemate. No legal move remains.",
  });
}

function listLegalChessMoves(fen, color) {
  const parts = String(fen || "").trim().split(/\s+/);
  const board = parseFenBoard(parts[0]);
  const moves = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row]?.[col];
      if (!piece || piece === " ") continue;
      if (pieceColor(piece) !== color) continue;
      for (const [toRow, toCol] of getPseudoMoves(board, row, col)) {
        if (isLegalChessMove(board, row, col, toRow, toCol, color)) {
          moves.push(coordsToMove(row, col, toRow, toCol));
        }
      }
    }
  }
  return moves;
}

function isLegalChessMove(board, fromRow, fromCol, toRow, toCol, color) {
  const piece = board[fromRow]?.[fromCol];
  if (!piece || piece === " " || pieceColor(piece) !== color) return false;
  const pseudoMoves = getPseudoMoves(board, fromRow, fromCol);
  if (!pseudoMoves.some(([row, col]) => row === toRow && col === toCol)) return false;
  const nextBoard = cloneBoard(board);
  nextBoard[toRow][toCol] = promoteIfNeeded(nextBoard[fromRow][fromCol], toRow);
  nextBoard[fromRow][fromCol] = " ";
  const king = findKing(nextBoard, color);
  if (!king) return false;
  return !isSquareAttacked(nextBoard, king.row, king.col, color === "w" ? "b" : "w");
}

function getPseudoMoves(board, row, col) {
  const piece = board[row]?.[col];
  if (!piece || piece === " ") return [];
  const color = pieceColor(piece);
  const type = piece.toUpperCase();
  const moves = [];
  const push = (nextRow, nextCol) => {
    if (!isOnBoard(nextRow, nextCol)) return false;
    const target = board[nextRow][nextCol];
    if (target !== " " && target && pieceColor(target) === color) return false;
    moves.push([nextRow, nextCol]);
    return !target || target === " ";
  };

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    if (isOnBoard(row + dir, col) && isEmpty(board[row + dir][col])) {
      moves.push([row + dir, col]);
      if (row === startRow && isOnBoard(row + dir * 2, col) && isEmpty(board[row + dir * 2][col])) {
        moves.push([row + dir * 2, col]);
      }
    }
    for (const offset of [-1, 1]) {
      const targetRow = row + dir;
      const targetCol = col + offset;
      if (!isOnBoard(targetRow, targetCol)) continue;
      const target = board[targetRow][targetCol];
      if (!isEmpty(target) && pieceColor(target) !== color) {
        moves.push([targetRow, targetCol]);
      }
    }
    return moves;
  }

  if (type === "N") {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      push(row + dr, col + dc);
    }
    return moves;
  }

  if (type === "K") {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      push(row + dr, col + dc);
    }
    return moves;
  }

  const directions = [];
  if (type === "B" || type === "Q") directions.push([-1,-1],[-1,1],[1,-1],[1,1]);
  if (type === "R" || type === "Q") directions.push([-1,0],[1,0],[0,-1],[0,1]);

  for (const [dr, dc] of directions) {
    let step = 1;
    while (true) {
      const nextRow = row + dr * step;
      const nextCol = col + dc * step;
      if (!push(nextRow, nextCol)) break;
      step += 1;
    }
  }
  return moves;
}

function isSquareAttacked(board, row, col, byColor) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = board[r]?.[c];
      if (!piece || piece === " " || pieceColor(piece) !== byColor) continue;
      const type = piece.toUpperCase();
      if (type === "P") {
        const dir = byColor === "w" ? -1 : 1;
        if ((r + dir === row) && (c - 1 === col || c + 1 === col)) return true;
        continue;
      }
      if (getPseudoMoves(board, r, c).some(([nextRow, nextCol]) => nextRow === row && nextCol === col)) {
        return true;
      }
    }
  }
  return false;
}

function parseFenBoard(fenBoard) {
  return String(fenBoard || "")
    .split("/")
    .map((row) => row.replace(/\d/g, (n) => " ".repeat(parseInt(n, 10))).split(""));
}

function boardToFen(board) {
  return board
    .map((row) => row.join("").replace(/ +/g, (spaces) => spaces.length))
    .join("/");
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function findKing(board, color) {
  const king = color === "w" ? "K" : "k";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (board[row]?.[col] === king) return { row, col };
    }
  }
  return null;
}

function pieceColor(piece) {
  return piece === piece.toUpperCase() ? "w" : "b";
}

function isOnBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function isEmpty(value) {
  return !value || value === " ";
}

function coordsToMove(fromRow, fromCol, toRow, toCol) {
  return `${String.fromCharCode(97 + fromCol)}${8 - fromRow}${String.fromCharCode(97 + toCol)}${8 - toRow}`;
}

function promoteIfNeeded(piece, toRow) {
  if (piece === "P" && toRow === 0) return "Q";
  if (piece === "p" && toRow === 7) return "q";
  return piece;
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
