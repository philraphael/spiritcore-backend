/**
 * Spiritverse Games Engine — Visual Interactive Boards
 * All 5 games rendered as real visual boards with Spiritverse theming.
 * Chess: FEN-based board with SVG pieces, click-to-move
 * Checkers: 8x8 board with light/shadow pieces
 * Go: 19x19 star-chart with stone placement
 * Spirit-Cards: visual hand + play area
 * Echo Trials: visual riddle UI with score tracking
 */

// ============================================================
// SPIRITVERSE CHESS PIECES — SVG symbols themed to each realm
// ============================================================
const CHESS_PIECES = {
  // White pieces (user) — Luminous Veil / rose-gold tones
  wK: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V17s-5.5-3.5-6 1c-1 4.5 5 6 5 6v3.5"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`,
  wQ: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/><path d="M9 26c8.5-8.5 15.5-8.5 27 0l2.5-12.5L31 25l-.3-14.1-8.2 13.4-8.2-13.4L14 25 6.5 13.5 9 26z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4"/><path d="M11.5 30c3.5-1 18.5-1 22 0"/><path d="M12 33.5c4-1.5 17-1.5 21 0"/></g></svg>`,
  wR: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23"/></g></svg>`,
  wB: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#f2dba0" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/></g><path d="M17.5 26h10M15 30h15" stroke="#c8a870" stroke-linejoin="miter"/></g></svg>`,
  wN: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 5.12-5.5 7.9-8 9.5-2.5 1.6-2.5 5.5-2.5 5.5-2.5-1.5-2.5-5.5-2.5-5.5 0-2.5 2-3.5 2-5.5 0-2.5-2-4-2-4-1.5-2.5 0-5 0-5 2.5 0 3.5 2 3.5 2 1.5-2 4-2 4-2 0 0 0 2 2 2z"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" fill="#c8a870"/><path d="M14.933 15.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 0 1 .866.5z" fill="#c8a870"/></g></svg>`,
  wP: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  // Black pieces (Spiritkin) — deep cosmic / teal/gold tones
  bK: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V17s-5.5-3.5-6 1c-1 4.5 5 6 5 6v3.5"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`,
  bQ: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/><path d="M9 26c8.5-8.5 15.5-8.5 27 0l2.5-12.5L31 25l-.3-14.1-8.2 13.4-8.2-13.4L14 25 6.5 13.5 9 26z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4"/><path d="M11.5 30c3.5-1 18.5-1 22 0"/><path d="M12 33.5c4-1.5 17-1.5 21 0"/></g></svg>`,
  bR: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23"/></g></svg>`,
  bB: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#1a2a3a" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/></g><path d="M17.5 26h10M15 30h15" stroke="#4ecdc4" stroke-linejoin="miter"/></g></svg>`,
  bN: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 5.12-5.5 7.9-8 9.5-2.5 1.6-2.5 5.5-2.5 5.5-2.5-1.5-2.5-5.5-2.5-5.5 0-2.5 2-3.5 2-5.5 0-2.5-2-4-2-4-1.5-2.5 0-5 0-5 2.5 0 3.5 2 3.5 2 1.5-2 4-2 4-2 0 0 0 2 2 2z"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" fill="#4ecdc4"/><path d="M14.933 15.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 0 1 .866.5z" fill="#4ecdc4"/></g></svg>`,
  bP: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round"/></svg>`
};

// ============================================================
// FEN PARSER — converts FEN string to 8x8 board array
// ============================================================
function parseFEN(fen) {
  const board = [];
  const rows = fen.split(' ')[0].split('/');
  for (const row of rows) {
    const rank = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch); i++) rank.push(null);
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        const type = ch.toUpperCase();
        rank.push({ color, type });
      }
    }
    board.push(rank);
  }
  return board;
}

// ============================================================
// CHESS BOARD RENDERER
// ============================================================
function renderChessBoard(container, fen, selectedSquare, validMoves, lastMove, onSquareClick) {
  const board = parseFEN(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const files = ['a','b','c','d','e','f','g','h'];

  // Board controls row
  let html = `<div class="game-board-controls" style="display:flex;align-items:center;justify-content:space-between;width:100%;max-width:340px;margin-bottom:6px;">`;
  html += `<div class="piece-theme-selector">
    <span class="piece-theme-label">Theme</span>
    <button class="piece-theme-btn active" data-action="chess-theme" data-theme="celestial">Celestial</button>
    <button class="piece-theme-btn" data-action="chess-theme" data-theme="shadow">Shadow</button>
    <button class="piece-theme-btn" data-action="chess-theme" data-theme="ember">Ember</button>
  </div>`;
  html += `<button class="game-expand-btn" data-action="chess-expand">&#x26F6; Expand</button>`;
  html += `</div>`;

  html += `<div class="chess-board" id="chess-board">`;
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const sq = files[file] + (8 - rank);
      const isLight = (rank + file) % 2 === 0;
      const piece = board[rank][file];
      const isSelected = selectedSquare === sq;
      const isValidMove = validMoves && validMoves.includes(sq);
      const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq);

      let cellClass = `chess-cell ${isLight ? 'chess-light' : 'chess-dark'}`;
      if (isSelected) cellClass += ' chess-selected';
      if (isValidMove) cellClass += ' chess-valid-move';
      if (isLastMove) cellClass += ' chess-last-move';

      const pieceKey = piece ? `${piece.color}${piece.type}` : null;
      const pieceSvg = pieceKey && CHESS_PIECES[pieceKey] ? CHESS_PIECES[pieceKey] : '';

      html += `<div class="${cellClass}" data-sq="${sq}" data-action="chess-square-click">`;
      if (isValidMove && !piece) {
        html += `<div class="chess-move-dot"></div>`;
      }
      if (pieceSvg) {
        html += `<div class="chess-piece ${piece.color === 'w' ? 'piece-white' : 'piece-black'}" data-sq="${sq}">${pieceSvg}</div>`;
      }
      if (isValidMove && piece) {
        html += `<div class="chess-capture-ring"></div>`;
      }
      html += `</div>`;
    }
  }
  html += `</div>`;

  // Rank/file labels
  html += `<div class="chess-labels-files">`;
  for (const f of files) html += `<span>${f}</span>`;
  html += `</div>`;

  container.innerHTML = html;

  // Handle expand button — create fullscreen overlay
  const expandBtn = container.querySelector('[data-action="chess-expand"]');
  if (expandBtn) {
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const overlay = document.createElement('div');
      overlay.className = 'game-fullscreen-overlay';
      overlay.innerHTML = `
        <div class="game-fullscreen-header">
          <div class="game-fullscreen-title">♟ Celestial Chess</div>
          <button class="game-fullscreen-close" id="fs-close">✕ Close</button>
        </div>
        <div class="game-fullscreen-board-wrap" id="fs-board-wrap"></div>
      `;
      document.body.appendChild(overlay);
      // Render board inside fullscreen
      const wrap = overlay.querySelector('#fs-board-wrap');
      renderChessBoard(wrap, fen, selectedSquare, validMoves, lastMove, onSquareClick);
      // Remove expand btn from fullscreen version
      const innerExpand = wrap.querySelector('[data-action="chess-expand"]');
      if (innerExpand) innerExpand.style.display = 'none';
      // Close handler
      overlay.querySelector('#fs-close').addEventListener('click', () => {
        document.body.removeChild(overlay);
      });
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) document.body.removeChild(overlay);
      });
    });
  }
}

// ============================================================
// CHECKERS BOARD RENDERER
// ============================================================
function renderCheckersBoard(container, boardArray, selectedPiece, validMoves, spiritkinColor) {
  // boardArray is 32-element array (dark squares only, standard checkers notation)
  // null = empty, "black"/"red" = piece, "black-king"/"red-king" = king
  const userColor = spiritkinColor === 'black' ? 'red' : 'black';
  const skColor = spiritkinColor || 'black';

  let html = `<div class="checkers-board" id="checkers-board">`;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isDark = (row + col) % 2 !== 0;
      const squareNum = isDark ? Math.floor(row / 2) * 4 + Math.floor((col + (row % 2 === 0 ? 1 : 0)) / 2) : null;
      const piece = squareNum !== null && boardArray ? boardArray[squareNum] : null;
      const isSelected = selectedPiece === squareNum;
      const isValid = validMoves && validMoves.includes(squareNum);

      let cellClass = `checkers-cell ${isDark ? 'checkers-dark' : 'checkers-light'}`;
      if (isSelected) cellClass += ' checkers-selected';
      if (isValid) cellClass += ' checkers-valid';

      html += `<div class="${cellClass}" data-sq="${squareNum}" data-action="${isDark ? 'checkers-square-click' : ''}">`;
      if (piece) {
        const isKing = piece.includes('king');
        const color = piece.includes('black') ? 'black' : 'red';
        const isUser = color === userColor;
        html += `<div class="checkers-piece ${isUser ? 'piece-user' : 'piece-spiritkin'} ${isKing ? 'piece-king' : ''}">
          ${isKing ? '<span class="king-crown">✦</span>' : ''}
        </div>`;
      }
      if (isValid && !piece) html += `<div class="checkers-move-dot"></div>`;
      html += `</div>`;
    }
  }
  html += `</div>`;
  container.innerHTML = html;
}

// ============================================================
// GO BOARD RENDERER (Star-Mapping)
// ============================================================
function renderGoBoard(container, stonesMap, lastMove) {
  // stonesMap: { "D4": "black", "Q16": "white", ... }
  const size = 13; // Use 13x13 for better UX (full 19x19 is too small on screen)
  const cols = 'ABCDEFGHJKLMN'; // standard Go columns (no I)

  let html = `<div class="go-board" id="go-board">`;
  // Star points for 13x13
  const starPoints = ['D4','D10','G7','J4','J10'];

  for (let row = size; row >= 1; row--) {
    for (let ci = 0; ci < size; ci++) {
      const col = cols[ci];
      const coord = `${col}${row}`;
      const stone = stonesMap && stonesMap[coord];
      const isStar = starPoints.includes(coord);
      const isLast = lastMove === coord;

      html += `<div class="go-cell" data-coord="${coord}" data-action="go-place-stone">
        <div class="go-line-h ${ci === 0 ? 'go-edge-l' : ''} ${ci === size-1 ? 'go-edge-r' : ''}"></div>
        <div class="go-line-v ${row === 1 ? 'go-edge-b' : ''} ${row === size ? 'go-edge-t' : ''}"></div>
        ${isStar ? '<div class="go-star-point"></div>' : ''}
        ${stone ? `<div class="go-stone go-stone-${stone} ${isLast ? 'go-stone-last' : ''}"></div>` : ''}
        ${!stone ? '<div class="go-hover-indicator"></div>' : ''}
      </div>`;
    }
  }
  html += `</div>`;

  // Column labels
  html += `<div class="go-labels-cols">`;
  for (let ci = 0; ci < size; ci++) html += `<span>${cols[ci]}</span>`;
  html += `</div>`;

  container.innerHTML = html;
}

// ============================================================
// SPIRIT-CARDS RENDERER
// ============================================================
const CARD_TYPE_COLORS = {
  atmosphere: { bg: '#1a2a3a', border: '#4ecdc4', glow: 'rgba(78,205,196,0.3)', icon: '🌫' },
  attack:     { bg: '#2a1a1a', border: '#f5a623', glow: 'rgba(245,166,35,0.3)', icon: '⚡' },
  bond:       { bg: '#1a1a2a', border: '#e8b4d8', glow: 'rgba(232,180,216,0.3)', icon: '♥' },
  defense:    { bg: '#1a2a1a', border: '#7ed321', glow: 'rgba(126,211,33,0.3)', icon: '🛡' },
  echoes:       { bg: '#2a2a1a', border: '#f2dba0', glow: 'rgba(242,219,160,0.3)', icon: '📖' },
  sigil:      { bg: '#2a1a2a', border: '#b8a6ff', glow: 'rgba(184,166,255,0.3)', icon: '✦' }
};

function renderSpiritCards(container, hand, played, deck, realmPoints, spiritkinName) {
  const deckCount = deck ? deck.length : 0;

  let html = `<div class="spirit-cards-arena">`;

  // Realm points bar
  html += `<div class="cards-realm-bar">
    <div class="realm-points-label">Realm Points</div>
    <div class="realm-points-value">${realmPoints || 0}</div>
  </div>`;

  // Spiritkin played area
  html += `<div class="cards-spiritkin-area">
    <div class="cards-area-label">${spiritkinName || 'Spiritkin'}'s Field</div>
    <div class="cards-played-row sk-played">`;
  if (played && played.filter(c => c.playedBy === 'spiritkin').length > 0) {
    played.filter(c => c.playedBy === 'spiritkin').forEach(card => {
      html += renderCardHTML(card, false, false);
    });
  } else {
    html += `<div class="cards-empty-field">No cards played yet</div>`;
  }
  html += `</div></div>`;

  // User played area
  html += `<div class="cards-user-area">
    <div class="cards-area-label">Your Field</div>
    <div class="cards-played-row user-played">`;
  if (played && played.filter(c => c.playedBy === 'user').length > 0) {
    played.filter(c => c.playedBy === 'user').forEach(card => {
      html += renderCardHTML(card, false, false);
    });
  } else {
    html += `<div class="cards-empty-field">No cards played yet</div>`;
  }
  html += `</div></div>`;

  // User hand
  html += `<div class="cards-hand-area">
    <div class="cards-hand-label">Your Hand (${hand ? hand.length : 0} cards)</div>
    <div class="cards-hand-row">`;
  if (hand && hand.length > 0) {
    hand.forEach((card, idx) => {
      html += renderCardHTML(card, true, true, idx);
    });
  } else {
    html += `<div class="cards-empty-hand">Your hand is empty — draw a card to begin.</div>`;
  }
  html += `</div></div>`;

  // Action buttons
  html += `<div class="cards-actions">
    <button class="btn btn-ghost btn-sm" data-action="cards-draw">
      Draw Card <span class="deck-count">(${deckCount} left)</span>
    </button>
  </div>`;

  html += `</div>`;
  container.innerHTML = html;
}

function renderCardHTML(card, inHand, clickable, idx) {
  const theme = CARD_TYPE_COLORS[card.type] || CARD_TYPE_COLORS.echoes;
  const actionAttr = clickable ? `data-action="cards-play-card" data-card-idx="${idx}"` : '';
  // Art area gradient backgrounds per element type
  const artGradients = {
    spirit:  'linear-gradient(160deg, rgba(78,205,196,0.4) 0%, rgba(20,80,80,0.6) 100%)',
    realm:   'linear-gradient(160deg, rgba(184,166,255,0.4) 0%, rgba(60,30,100,0.6) 100%)',
    echo:    'linear-gradient(160deg, rgba(242,219,160,0.4) 0%, rgba(100,70,20,0.6) 100%)',
    echoes:    'linear-gradient(160deg, rgba(255,200,100,0.3) 0%, rgba(80,50,10,0.6) 100%)',
    bond:    'linear-gradient(160deg, rgba(255,150,200,0.3) 0%, rgba(80,20,50,0.6) 100%)',
  };
  const artBg = artGradients[card.type] || artGradients.echoes;
  return `<div class="spirit-card ${inHand ? 'card-in-hand' : 'card-played'} ${clickable ? 'card-clickable' : ''}" 
    ${actionAttr}
    style="--card-border: ${theme.border}; --card-glow: ${theme.glow};">
    <div class="card-art-area">
      <div class="card-art-bg" style="background: ${artBg};"></div>
      <span class="card-art-symbol" style="color: ${theme.border};">${theme.icon}</span>
    </div>
    <div class="card-body">
      <div class="card-header">
        <span class="card-name">${card.name}</span>
        <span class="card-power">${card.power}</span>
      </div>
      <div class="card-type">${card.type}</div>
      <div class="card-effect">${card.effect}</div>
    </div>
  </div>`;
}

// ============================================================
// ECHO TRIALS RENDERER
// ============================================================
function renderEchoTrials(container, trialNumber, score, currentRiddle, spiritkinName, spiritkinMessage) {
  const riddleText = currentRiddle || (spiritkinMessage ? extractRiddle(spiritkinMessage) : null);

  let html = `<div class="echo-trials-arena">`;

  // Score header
  html += `<div class="echo-header">
    <div class="echo-trial-num">Trial ${trialNumber || 1}</div>
    <div class="echo-score">Score: <strong>${score || 0}</strong></div>
  </div>`;

  // Spiritkin riddle card
  if (spiritkinMessage) {
    html += `<div class="echo-spiritkin-card">
      <div class="echo-sk-label">${spiritkinName || 'Spiritkin'} speaks:</div>
      <div class="echo-message">${spiritkinMessage.replace(/\*(.*?)\*/g, '<em>$1</em>')}</div>
    </div>`;
  }

  // Answer input
  html += `<div class="echo-answer-area">
    <div class="echo-answer-label">Your answer:</div>
    <textarea 
      class="echo-answer-input" 
      placeholder="Speak your truth to the Spiritverse..."
      data-action="echo-input-change"
      rows="3"
    ></textarea>
    <button class="btn btn-primary" data-action="submit-game-move" style="margin-top:10px; width:100%;">
      Offer Your Answer
    </button>
  </div>`;

  // Trial history
  html += `</div>`;
  container.innerHTML = html;
}

function extractRiddle(message) {
  const match = message.match(/\*(.*?)\*/);
  return match ? match[1] : null;
}

// ============================================================
// MAIN GAME RENDERER — called from app.js render loop
// ============================================================
window.SpiritverseGames = {
  renderChessBoard,
  renderCheckersBoard,
  renderGoBoard,
  renderSpiritCards,
  renderEchoTrials,
  parseFEN,

  // State for interactive chess
  chess: {
    selectedSquare: null,
    validMoves: [],
    lastMove: null
  },

  // State for checkers
  checkers: {
    selectedPiece: null,
    validMoves: []
  },

  // State for echo trials answer
  echoAnswer: '',

  /**
   * Main render dispatcher — call this from app.js with the active game state
   */
  render(containerId, game, spiritkinName, spiritkinMessage, onMove) {
    const container = document.getElementById(containerId);
    if (!container) return;
    // Store current game state and callbacks so click handlers can access them
    this._currentGame = game;
    this._currentSpiritkin = spiritkinName;
    this._onMove = onMove;

    switch (game.type) {
      case 'chess':
        renderChessBoard(
          container,
          game.data?.fen,
          this.chess.selectedSquare,
          this.chess.validMoves,
          this.chess.lastMove,
          onMove
        );
        break;
      case 'checkers':
        renderCheckersBoard(
          container,
          game.data?.board,
          this.checkers.selectedPiece,
          this.checkers.validMoves,
          'black' // spiritkin plays black
        );
        break;
      case 'go':
        renderGoBoard(
          container,
          game.data?.stones || {},
          game.data?.lastMove
        );
        break;
      case 'spirit_cards':
        renderSpiritCards(
          container,
          game.data?.hand,
          game.data?.played,
          game.data?.deck,
          game.data?.realmPoints,
          spiritkinName
        );
        break;
      case 'echo_trials':
        renderEchoTrials(
          container,
          game.data?.trialNumber,
          game.data?.score,
          game.data?.currentRiddle,
          spiritkinName,
          spiritkinMessage
        );
        break;
    }
  },

  /**
   * Handle chess square click — select piece, show valid moves, or submit move
   */
  handleChessSquareClick(sq, fen, onMoveSubmit) {
    if (!this.chess.selectedSquare) {
      // Select a piece
      const board = parseFEN(fen);
      const file = 'abcdefgh'.indexOf(sq[0]);
      const rank = 8 - parseInt(sq[1]);
      const piece = board[rank] && board[rank][file];
      if (piece && piece.color === 'w') {
        this.chess.selectedSquare = sq;
        // Generate pseudo-valid moves for visual feedback
        this.chess.validMoves = getChessValidMoves(sq, board, fen);
      }
    } else {
      if (this.chess.validMoves.includes(sq) || sq !== this.chess.selectedSquare) {
        if (sq !== this.chess.selectedSquare) {
          const move = this.chess.selectedSquare + sq;
          this.chess.lastMove = { from: this.chess.selectedSquare, to: sq };
          this.chess.selectedSquare = null;
          this.chess.validMoves = [];
          onMoveSubmit(move);
        } else {
          // Deselect
          this.chess.selectedSquare = null;
          this.chess.validMoves = [];
        }
      } else {
        // Select different piece
        const board = parseFEN(fen);
        const file = 'abcdefgh'.indexOf(sq[0]);
        const rank = 8 - parseInt(sq[1]);
        const piece = board[rank] && board[rank][file];
        if (piece && piece.color === 'w') {
          this.chess.selectedSquare = sq;
          this.chess.validMoves = getChessValidMoves(sq, board, fen);
        } else {
          this.chess.selectedSquare = null;
          this.chess.validMoves = [];
        }
      }
    }
  },

  /**
   * Handle checkers square click
   */
  handleCheckersSquareClick(sqNum, boardArray, userColor, onMoveSubmit) {
    const sq = parseInt(sqNum);
    if (isNaN(sq)) return;
    const piece = boardArray && boardArray[sq];

    if (!this.checkers.selectedPiece) {
      if (piece && piece.includes(userColor)) {
        this.checkers.selectedPiece = sq;
        this.checkers.validMoves = getCheckersValidMoves(sq, boardArray, userColor);
      }
    } else {
      if (this.checkers.validMoves.includes(sq)) {
        const move = `${this.checkers.selectedPiece}-${sq}`;
        this.checkers.selectedPiece = null;
        this.checkers.validMoves = [];
        onMoveSubmit(move);
      } else if (piece && piece.includes(userColor)) {
        this.checkers.selectedPiece = sq;
        this.checkers.validMoves = getCheckersValidMoves(sq, boardArray, userColor);
      } else {
        this.checkers.selectedPiece = null;
        this.checkers.validMoves = [];
      }
    }
  },

  reset() {
    this.chess = { selectedSquare: null, validMoves: [], lastMove: null };
    this.checkers = { selectedPiece: null, validMoves: [] };
    this.echoAnswer = '';
  }
};

// ============================================================
// CHESS MOVE GENERATION (simplified — for visual feedback only)
// The server validates actual legality
// ============================================================
function getChessValidMoves(sq, board, fen) {
  const file = 'abcdefgh'.indexOf(sq[0]);
  const rank = 8 - parseInt(sq[1]);
  const piece = board[rank] && board[rank][file];
  if (!piece) return [];

  const moves = [];
  const files = 'abcdefgh';

  const addMove = (r, f) => {
    if (r < 0 || r > 7 || f < 0 || f > 7) return false;
    const target = board[r][f];
    if (target && target.color === 'w') return false;
    moves.push(files[f] + (8 - r));
    return !target; // returns true if square was empty (can continue sliding)
  };

  switch (piece.type) {
    case 'P': {
      // White pawn moves up (rank decreases)
      if (rank > 0 && !board[rank-1][file]) {
        addMove(rank-1, file);
        if (rank === 6 && !board[rank-2][file]) addMove(rank-2, file);
      }
      if (rank > 0 && file > 0 && board[rank-1][file-1]?.color === 'b') addMove(rank-1, file-1);
      if (rank > 0 && file < 7 && board[rank-1][file+1]?.color === 'b') addMove(rank-1, file+1);
      break;
    }
    case 'N': {
      const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      knightMoves.forEach(([dr, df]) => addMove(rank+dr, file+df));
      break;
    }
    case 'B': {
      for (const [dr, df] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        for (let i = 1; i < 8; i++) { if (!addMove(rank+dr*i, file+df*i)) break; }
      }
      break;
    }
    case 'R': {
      for (const [dr, df] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        for (let i = 1; i < 8; i++) { if (!addMove(rank+dr*i, file+df*i)) break; }
      }
      break;
    }
    case 'Q': {
      for (const [dr, df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        for (let i = 1; i < 8; i++) { if (!addMove(rank+dr*i, file+df*i)) break; }
      }
      break;
    }
    case 'K': {
      for (const [dr, df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        addMove(rank+dr, file+df);
      }
      break;
    }
  }
  return moves;
}

// ============================================================
// CHECKERS MOVE GENERATION (simplified)
// ============================================================
function getCheckersValidMoves(sq, board, userColor) {
  const moves = [];
  const piece = board[sq];
  if (!piece) return moves;

  // Standard checkers: black moves down (higher index), red moves up (lower index)
  const isKing = piece.includes('king');
  const directions = userColor === 'black'
    ? (isKing ? [-4, -3, 4, 5] : [4, 5])
    : (isKing ? [-4, -3, 4, 5] : [-4, -3]);

  for (const d of directions) {
    const target = sq + d;
    if (target >= 0 && target < 32) {
      if (!board[target]) moves.push(target);
      // Jump
      const jump = sq + d * 2;
      if (jump >= 0 && jump < 32 && board[target] && !board[target].includes(userColor) && !board[jump]) {
        moves.push(jump);
      }
    }
  }
  return moves;
}
