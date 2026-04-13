/**
 * Spiritverse Games Engine — Visual Interactive Boards (GRAND STAGE EDITION)
 * All 5 games rendered as real visual boards with Spiritverse theming.
 * Chess: FEN-based board with SVG pieces, 3D-isometric, click-to-move
 * Checkers: 8x8 board with light/shadow pieces, 3D-isometric
 * Go: 13x13 star-chart with stone placement, 3D-isometric
 * Spirit-Cards: visual hand + play area
 * Echo Trials: visual riddle UI with score tracking
 */

// ============================================================
// SPIRITVERSE CHESS PIECES — SVG symbols themed to each realm
// ============================================================
const CHESS_PIECES = {
  wK: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V17s-5.5-3.5-6 1c-1 4.5 5 6 5 6v3.5"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`,
  wQ: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/><path d="M9 26c8.5-8.5 15.5-8.5 27 0l2.5-12.5L31 25l-.3-14.1-8.2 13.4-8.2-13.4L14 25 6.5 13.5 9 26z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4"/><path d="M11.5 30c3.5-1 18.5-1 22 0"/><path d="M12 33.5c4-1.5 17-1.5 21 0"/></g></svg>`,
  wR: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23"/></g></svg>`,
  wB: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#f2dba0" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/></g><path d="M17.5 26h10M15 30h15" stroke="#c8a870" stroke-linejoin="miter"/></g></svg>`,
  wN: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 5.12-5.5 7.9-8 9.5-2.5 1.6-2.5 5.5-2.5 5.5-2.5-1.5-2.5-5.5-2.5-5.5 0-2.5 2-3.5 2-5.5 0-2.5-2-3.5 2-5.5 0-2.5-2-4-2-4-1.5-2.5 0-5 0-5 2.5 0 3.5 2 3.5 2 1.5-2 4-2 4-2 0 0 0 2 2 2z"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" fill="#c8a870"/><path d="M14.933 15.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 0 1 .866.5z" fill="#c8a870"/></g></svg>`,
  wP: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#f2dba0" stroke="#c8a870" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  bK: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V17s-5.5-3.5-6 1c-1 4.5 5 6 5 6v3.5"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`,
  bQ: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/><path d="M9 26c8.5-8.5 15.5-8.5 27 0l2.5-12.5L31 25l-.3-14.1-8.2 13.4-8.2-13.4L14 25 6.5 13.5 9 26z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4"/><path d="M11.5 30c3.5-1 18.5-1 22 0"/><path d="M12 33.5c4-1.5 17-1.5 21 0"/></g></svg>`,
  bR: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23"/></g></svg>`,
  bB: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#1a2a3a" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/></g><path d="M17.5 26h10M15 30h15" stroke="#4ecdc4" stroke-linejoin="miter"/></g></svg>`,
  bN: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><g fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 5.12-5.5 7.9-8 9.5-2.5 1.6-2.5 5.5-2.5 5.5-2.5-1.5-2.5-5.5-2.5-5.5 0-2.5 2-3.5 2-5.5 0-2.5-2-3.5 2-5.5 0-2.5-2-4-2-4-1.5-2.5 0-5 0-5 2.5 0 3.5 2 3.5 2 1.5-2 4-2 4-2 0 0 0 2 2 2z"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" fill="#4ecdc4"/><path d="M14.933 15.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 0 1 .866.5z" fill="#4ecdc4"/></g></svg>`,
  bP: `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#1a2a3a" stroke="#4ecdc4" stroke-width="1.5" stroke-linecap="round"/></svg>`
};

// ============================================================
// GRAND STAGE OVERLAY — Unified Fullscreen System
// ============================================================
const GrandStage = {
  isOpen: false,
  gameType: null,
  spiritkin: null,
  
  open(gameType, spiritkin, renderFn) {
    if (this.isOpen) this.close();
    this.isOpen = true;
    this.gameType = gameType;
    this.spiritkin = spiritkin;
    
    const overlay = document.createElement('div');
    overlay.className = 'game-fullscreen-overlay';
    overlay.id = 'grand-stage';
    
    overlay.innerHTML = `
      <div class="game-fullscreen-header">
        <div class="game-fullscreen-title">${this.getGameTitle(gameType)}</div>
        <button class="game-fullscreen-close" id="gs-close">✕ End Experience</button>
      </div>
      <div class="game-fullscreen-stage">
        <div class="board-3d-wrap" id="gs-board-wrap"></div>
      </div>
      <div class="game-fullscreen-sidebar">
        <div class="gs-sidebar-section">
          <div class="gs-sidebar-label">Presence</div>
          <div class="gs-commentary-bubble">
            <div class="gs-commentary-text" id="gs-commentary">"The board is set, Traveler. Let us see where the resonance leads."</div>
          </div>
        </div>
        <div class="gs-sidebar-section">
          <div class="gs-sidebar-label">History</div>
          <div class="gs-move-history" id="gs-history"></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.querySelector('#gs-close').onclick = () => this.close();
    
    // Initial render
    const wrap = overlay.querySelector('#gs-board-wrap');
    renderFn(wrap, true);
  },
  
  close() {
    const overlay = document.getElementById('grand-stage');
    if (overlay) overlay.remove();
    this.isOpen = false;
  },
  
  update(renderFn, commentary, history) {
    if (!this.isOpen) return;
    const wrap = document.getElementById('gs-board-wrap');
    const comm = document.getElementById('gs-commentary');
    const hist = document.getElementById('gs-history');
    
    if (wrap) renderFn(wrap, true);
    if (comm && commentary) comm.innerText = commentary;
    if (hist && history) {
      hist.innerHTML = history.slice(-5).reverse().map(m => `
        <div class="gs-history-row ${m.player}">
          <span class="move-player">${m.player === 'user' ? 'You' : this.spiritkin}</span>
          <span class="move-value">${m.move}</span>
        </div>
      `).join('');
    }
  },
  
  getGameTitle(type) {
    const titles = {
      chess: '♟ Celestial Chess',
      checkers: '◈ Veil Checkers',
      go: '★ Star-Mapping Go',
      'spirit-cards': '🎴 Spirit-Cards',
      'echo-trials': '📜 Echo Trials'
    };
    return titles[type] || 'Spiritverse Game';
  }
};

// ============================================================
// CHESS ENGINE & RENDERER
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

function renderChessBoard(container, fen, selectedSquare, validMoves, lastMove, onSquareClick, isExpanded = false) {
  const board = parseFEN(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const files = ['a','b','c','d','e','f','g','h'];

  let html = '';
  if (!isExpanded) {
    html += `<div class="game-board-controls" style="display:flex;align-items:center;justify-content:space-between;width:100%;max-width:340px;margin-bottom:6px;">
      <div class="piece-theme-selector">
        <span class="piece-theme-label">Theme</span>
        <button class="piece-theme-btn active" data-action="set-piece-theme" data-theme="celestial">Celestial</button>
        <button class="piece-theme-btn" data-action="set-piece-theme" data-theme="ember">Ember</button>
        <button class="piece-theme-btn" data-action="set-piece-theme" data-theme="astral">Astral</button>
      </div>
      <button class="game-expand-btn" data-action="chess-expand">&#x26F6; Grand Stage</button>
    </div>`;
  }

  html += `<div class="chess-board ${isExpanded ? 'board-3d' : ''}" id="chess-board" style="${isExpanded ? 'width: 560px; max-width: none;' : ''}">`;
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
      if (isValidMove && !piece) html += `<div class="chess-move-dot"></div>`;
      if (pieceSvg) html += `<div class="chess-piece ${piece.color === 'w' ? 'piece-white' : 'piece-black'}" data-sq="${sq}">${pieceSvg}</div>`;
      if (isValidMove && piece) html += `<div class="chess-capture-ring"></div>`;
      html += `</div>`;
    }
  }
  html += `</div>`;
  
  if (!isExpanded) {
    html += `<div class="chess-labels-files">`;
    for (const f of files) html += `<span>${f}</span>`;
    html += `</div>`;
  }

  container.innerHTML = html;

  if (!isExpanded) {
    const expandBtn = container.querySelector('[data-action="chess-expand"]');
    if (expandBtn) {
      expandBtn.onclick = () => {
        GrandStage.open('chess', 'Spiritkin', (c, exp) => renderChessBoard(c, fen, selectedSquare, validMoves, lastMove, onSquareClick, exp));
      };
    }
  }
}

// ============================================================
// CHECKERS ENGINE & RENDERER
// ============================================================
function renderCheckersBoard(container, boardArray, selectedPiece, validMoves, onSquareClick, isExpanded = false) {
  const board = boardArray || Array(32).fill(null);
  
  let html = '';
  if (!isExpanded) {
    html += `<div class="game-board-controls" style="display:flex;align-items:center;justify-content:flex-end;width:100%;max-width:340px;margin-bottom:6px;">
      <button class="game-expand-btn" data-action="checkers-expand">&#x26F6; Grand Stage</button>
    </div>`;
  }

  html += `<div class="checkers-board" style="${isExpanded ? 'width: 560px; max-width: none;' : ''}">`;
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const isLight = (rank + file) % 2 === 0;
      let sqIndex = -1;
      if (!isLight) {
        sqIndex = rank * 4 + Math.floor(file / 2);
      }
      
      const piece = sqIndex !== -1 ? board[sqIndex] : null;
      const isSelected = selectedPiece === sqIndex;
      const isValid = validMoves && validMoves.includes(sqIndex);

      let cellClass = `checkers-cell ${isLight ? 'checkers-light' : 'checkers-dark'}`;
      if (isSelected) cellClass += ' checkers-selected';
      if (isValid) cellClass += ' checkers-valid';

      html += `<div class="${cellClass}" data-sq="${sqIndex}" data-action="checkers-square-click">`;
      if (piece) {
        const isKing = piece.includes('king');
        const colorClass = piece.includes('white') ? 'piece-user' : 'piece-spiritkin';
        html += `<div class="checkers-piece ${colorClass} ${isKing ? 'piece-king' : ''}">
          ${isKing ? '<span class="king-crown">♔</span>' : ''}
        </div>`;
      }
      if (isValid && !piece) html += `<div class="checkers-move-dot"></div>`;
      html += `</div>`;
    }
  }
  html += `</div>`;
  container.innerHTML = html;

  if (!isExpanded) {
    const expandBtn = container.querySelector('[data-action="checkers-expand"]');
    if (expandBtn) {
      expandBtn.onclick = () => {
        GrandStage.open('checkers', 'Spiritkin', (c, exp) => renderCheckersBoard(c, boardArray, selectedPiece, validMoves, onSquareClick, exp));
      };
    }
  }
}

// ============================================================
// GO (STAR-MAPPING) RENDERER
// ============================================================
function renderGoBoard(container, boardArray, lastMove, onSquareClick, isExpanded = false) {
  const size = 13;
  const board = boardArray || Array(size * size).fill(null);

  let html = '';
  if (!isExpanded) {
    html += `<div class="game-board-controls" style="display:flex;align-items:center;justify-content:flex-end;width:100%;max-width:340px;margin-bottom:6px;">
      <button class="game-expand-btn" data-action="go-expand">&#x26F6; Grand Stage</button>
    </div>`;
  }

  html += `<div class="go-board" style="grid-template-columns: repeat(${size}, 1fr); grid-template-rows: repeat(${size}, 1fr); ${isExpanded ? 'width: 600px; max-width: none;' : ''}">`;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      const piece = board[idx];
      const isLast = lastMove && (lastMove.row === r && lastMove.col === c);
      
      let cellClass = 'go-cell';
      if (r === 0) cellClass += ' go-edge-t';
      if (r === size - 1) cellClass += ' go-edge-b';
      if (c === 0) cellClass += ' go-edge-l';
      if (c === size - 1) cellClass += ' go-edge-r';

      html += `<div class="${cellClass}" data-idx="${idx}" data-action="go-square-click">
        <div class="go-line-h"></div>
        <div class="go-line-v"></div>
        <div class="go-hover-indicator"></div>`;
      
      if (piece) {
        const stoneClass = piece === 'black' ? 'go-stone-black' : 'go-stone-white';
        html += `<div class="go-stone ${stoneClass} ${isLast ? 'go-stone-last' : ''}"></div>`;
      }
      html += `</div>`;
    }
  }
  html += `</div>`;
  container.innerHTML = html;

  if (!isExpanded) {
    const expandBtn = container.querySelector('[data-action="go-expand"]');
    if (expandBtn) {
      expandBtn.onclick = () => {
        GrandStage.open('go', 'Spiritkin', (c, exp) => renderGoBoard(c, boardArray, lastMove, onSquareClick, exp));
      };
    }
  }
}

// ============================================================
// PUBLIC API — SpiritverseGames singleton
// ============================================================
export const SpiritverseGames = {
  chess: { selectedSquare: null, validMoves: [], lastMove: null },
  checkers: { selectedPiece: null, validMoves: [] },
  echoAnswer: '',

  render(container, gameData, spiritkinName, commentary, onMoveSubmit) {
    if (!gameData || !gameData.type) return;
    const type = gameData.type;
    const gameCommentary = commentary || gameData.commentary || "The board is yours.";
    const history = gameData.history || [];

    const renderFn = (target, isExp) => {
      switch (type) {
        case 'chess':
          renderChessBoard(target, gameData.fen, this.chess.selectedSquare, this.chess.validMoves, this.chess.lastMove, (sq) => {
            this.handleChessSquareClick(sq, gameData.fen, onMoveSubmit);
          }, isExp);
          break;
        case 'checkers':
          renderCheckersBoard(target, gameData.board, this.checkers.selectedPiece, this.checkers.validMoves, (sq) => {
            this.handleCheckersSquareClick(sq, gameData.board, 'white', onMoveSubmit);
          }, isExp);
          break;
        case 'go':
          renderGoBoard(target, gameData.board, gameData.lastMove, (idx) => {
            const size = 13;
            const r = Math.floor(idx / size);
            const c = idx % size;
            onMoveSubmit(`${String.fromCharCode(65 + c)}${size - r}`);
          }, isExp);
          break;
        case 'spirit_cards':
          this.renderSpiritCards(target, gameData, onMoveSubmit, isExp);
          break;
        case 'echo_trials':
          this.renderEchoTrials(target, gameData, onMoveSubmit, isExp);
          break;
      }
    };

    // Render to main container
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (el) renderFn(el, false);
    // Update Grand Stage if open
    if (GrandStage.isOpen && GrandStage.gameType === type) {
      GrandStage.update(renderFn, gameCommentary, history);
    }
  },

  expand(gameData, spiritkinName, onMoveSubmit) {
    if (!gameData || !gameData.type) return;
    const type = gameData.type;
    const commentary = gameData.commentary || "The board is set. Let us see where the resonance leads.";
    const history = gameData.history || [];
    const renderFn = (target, isExp) => {
      switch (type) {
        case 'chess':
          renderChessBoard(target, gameData.fen, this.chess.selectedSquare, this.chess.validMoves, this.chess.lastMove, (sq) => {
            this.handleChessSquareClick(sq, gameData.fen, onMoveSubmit);
          }, isExp);
          break;
        case 'checkers':
          renderCheckersBoard(target, gameData.board, this.checkers.selectedPiece, this.checkers.validMoves, (sq) => {
            this.handleCheckersSquareClick(sq, gameData.board, 'white', onMoveSubmit);
          }, isExp);
          break;
        case 'go':
          renderGoBoard(target, gameData.board, gameData.lastMove, (idx) => {
            const size = 13;
            const r = Math.floor(idx / size);
            const c = idx % size;
            onMoveSubmit(`${String.fromCharCode(65 + c)}${size - r}`);
          }, isExp);
          break;
        case 'spirit_cards':
          this.renderSpiritCards(target, gameData, onMoveSubmit, isExp);
          break;
        case 'echo_trials':
          this.renderEchoTrials(target, gameData, onMoveSubmit, isExp);
          break;
        default:
          if (target) target.innerHTML = `<div style="padding:2rem;text-align:center;color:#ccc">Grand Stage not available for this game type.</div>`;
      }
    };
    GrandStage.open(type, spiritkinName, renderFn);
    // Update commentary immediately
    const comm = document.getElementById('gs-commentary');
    if (comm && commentary) comm.innerText = commentary;
    const hist = document.getElementById('gs-history');
    if (hist && history.length) {
      hist.innerHTML = history.slice(-5).reverse().map(m => `
        <div class="gs-history-row ${m.player}">
          <span class="move-player">${m.player === 'user' ? 'You' : spiritkinName}</span>
          <span class="move-value">${m.move}</span>
        </div>
      `).join('');
    }
  },

  renderSpiritCards(container, gameData, onMoveSubmit, isExpanded) {
    const hand = gameData.hand || [];
    const mana = gameData.mana || 5;
    const board = gameData.board || [];
    const spiritkinHand = gameData.spiritkinHand || [];
    
    const html = `
      <div class="spirit-cards-container" style="display:flex;flex-direction:column;gap:1rem;padding:1rem;height:100%;">
        <div class="spiritkin-area" style="flex:1;border:2px solid #4ecdc4;border-radius:8px;padding:1rem;background:rgba(30,60,80,0.5);">
          <div style="font-size:0.9rem;color:#4ecdc4;margin-bottom:0.5rem;">Spiritkin's Play Area</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:0.5rem;">
            ${spiritkinHand.map((card, i) => `
              <div style="background:linear-gradient(135deg,#4ecdc4,#44a08d);border-radius:4px;padding:0.75rem;text-align:center;color:#fff;font-size:0.8rem;cursor:default;">
                <div style="font-weight:bold;">${card.name}</div>
                <div style="font-size:0.7rem;margin-top:0.25rem;">⚡ ${card.power}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="mana-display" style="display:flex;justify-content:space-around;padding:0.5rem;background:rgba(100,50,150,0.3);border-radius:4px;">
          <div style="text-align:center;">
            <div style="color:#b19cd9;font-size:0.8rem;">Your Mana</div>
            <div style="color:#fff;font-size:1.5rem;font-weight:bold;">${mana}/5</div>
          </div>
          <div style="text-align:center;">
            <div style="color:#4ecdc4;font-size:0.8rem;">Spiritkin Mana</div>
            <div style="color:#fff;font-size:1.5rem;font-weight:bold;">${gameData.spiritkinMana || 5}/5</div>
          </div>
        </div>
        
        <div class="player-hand" style="flex:1;border:2px solid #b19cd9;border-radius:8px;padding:1rem;background:rgba(80,30,100,0.5);">
          <div style="font-size:0.9rem;color:#b19cd9;margin-bottom:0.5rem;">Your Hand</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:0.5rem;">
            ${hand.map((card, i) => `
              <div onclick="this.style.opacity='0.7';" style="background:linear-gradient(135deg,#b19cd9,#9d6ba8);border-radius:4px;padding:0.75rem;text-align:center;color:#fff;font-size:0.8rem;cursor:pointer;transition:opacity 0.2s;" data-card-idx="${i}">
                <div style="font-weight:bold;">${card.name}</div>
                <div style="font-size:0.7rem;margin-top:0.25rem;">Cost: ${card.cost}</div>
                <div style="font-size:0.7rem;">⚡ ${card.power}</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="text-align:center;color:#999;font-size:0.8rem;">
          Click a card to play it
        </div>
      </div>
    `;
    
    if (typeof container === 'string') {
      document.getElementById(container).innerHTML = html;
    } else {
      container.innerHTML = html;
    }
    
    // Add click handlers for cards
    const cardElements = (typeof container === 'string' ? document.getElementById(container) : container).querySelectorAll('[data-card-idx]');
    cardElements.forEach((el, idx) => {
      el.onclick = () => onMoveSubmit(`play_card_${idx}`);
    });
  },
  
  renderEchoTrials(container, gameData, onMoveSubmit, isExpanded) {
    const riddle = gameData.riddle || "A riddle awaits...";
    const attempts = gameData.attempts || 0;
    const maxAttempts = gameData.maxAttempts || 3;
    
    const html = `
      <div class="echo-trials-container" style="display:flex;flex-direction:column;gap:2rem;padding:2rem;height:100%;justify-content:center;align-items:center;">
        <div class="riddle-box" style="background:linear-gradient(135deg,rgba(78,205,196,0.2),rgba(177,156,217,0.2));border:2px solid #4ecdc4;border-radius:12px;padding:2rem;text-align:center;max-width:500px;">
          <div style="font-size:0.9rem;color:#4ecdc4;margin-bottom:1rem;text-transform:uppercase;letter-spacing:2px;">🔔 Echo's Riddle</div>
          <div style="font-size:1.3rem;color:#ecf5ff;line-height:1.6;margin-bottom:2rem;font-style:italic;">${riddle}</div>
          
          <div style="display:flex;gap:0.5rem;margin-bottom:1rem;justify-content:center;">
            ${Array.from({length: maxAttempts}).map((_, i) => `
              <div style="width:12px;height:12px;border-radius:50%;background:${i < attempts ? '#ff6b6b' : '#4ecdc4'};opacity:${i < attempts ? 0.5 : 1};"></div>
            `).join('')}
          </div>
          <div style="font-size:0.8rem;color:#999;margin-bottom:1.5rem;">Attempts: ${attempts}/${maxAttempts}</div>
          
          <div style="display:flex;gap:0.5rem;">
            <input type="text" id="echo-answer" placeholder="Your answer..." style="flex:1;padding:0.75rem;border:1px solid #4ecdc4;border-radius:4px;background:#1a2a3a;color:#ecf5ff;font-size:1rem;" />
            <button onclick="const ans = document.getElementById('echo-answer').value; if(ans) { this.parentElement.parentElement.parentElement.onMoveSubmit = window.echoOnMove; window.echoOnMove(ans); }" style="padding:0.75rem 1.5rem;background:#4ecdc4;color:#1a2a3a;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Submit</button>
          </div>
        </div>
      </div>
    `;
    
    if (typeof container === 'string') {
      document.getElementById(container).innerHTML = html;
    } else {
      container.innerHTML = html;
    }
    
    // Store the onMoveSubmit for the button
    window.echoOnMove = onMoveSubmit;
    
    // Focus on input
    setTimeout(() => {
      const input = (typeof container === 'string' ? document.getElementById(container) : container).querySelector('#echo-answer');
      if (input) input.focus();
    }, 100);
  },

  handleChessSquareClick(sq, fen, onMoveSubmit) {
    const board = parseFEN(fen);
    const file = 'abcdefgh'.indexOf(sq[0]);
    const rank = 8 - parseInt(sq[1]);
    const piece = board[rank][file];

    if (!this.chess.selectedSquare) {
      if (piece && piece.color === 'w') {
        this.chess.selectedSquare = sq;
        this.chess.validMoves = getChessValidMoves(sq, board, fen);
      }
    } else {
      if (this.chess.validMoves.includes(sq)) {
        const move = this.chess.selectedSquare + sq;
        this.chess.selectedSquare = null;
        this.chess.validMoves = [];
        onMoveSubmit(move);
      } else if (piece && piece.color === 'w') {
        this.chess.selectedSquare = sq;
        this.chess.validMoves = getChessValidMoves(sq, board, fen);
      } else {
        this.chess.selectedSquare = null;
        this.chess.validMoves = [];
      }
    }
  },

  handleCheckersSquareClick(sqNum, boardArray, userColor, onMoveSubmit) {
    const sq = parseInt(sqNum);
    if (isNaN(sq)) return;
    const board = boardArray || Array(32).fill(null);
    const piece = board[sq];

    if (!this.checkers.selectedPiece) {
      if (piece && piece.includes(userColor)) {
        this.checkers.selectedPiece = sq;
        this.checkers.validMoves = getCheckersValidMoves(sq, board, userColor);
      }
    } else {
      if (this.checkers.validMoves.includes(sq)) {
        const move = `${this.checkers.selectedPiece}-${sq}`;
        this.checkers.selectedPiece = null;
        this.checkers.validMoves = [];
        onMoveSubmit(move);
      } else if (piece && piece.includes(userColor)) {
        this.checkers.selectedPiece = sq;
        this.checkers.validMoves = getCheckersValidMoves(sq, board, userColor);
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
    GrandStage.close();
  }
};

// ============================================================
// MOVE GENERATION UTILS (Preserved from original)
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
    return !target;
  };
  switch (piece.type) {
    case 'P':
      if (rank > 0 && !board[rank-1][file]) {
        addMove(rank-1, file);
        if (rank === 6 && !board[rank-2][file]) addMove(rank-2, file);
      }
      if (rank > 0 && file > 0 && board[rank-1][file-1]?.color === 'b') addMove(rank-1, file-1);
      if (rank > 0 && file < 7 && board[rank-1][file+1]?.color === 'b') addMove(rank-1, file+1);
      break;
    case 'N':
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, df]) => addMove(rank+dr, file+df));
      break;
    case 'B':
      for (const [dr, df] of [[-1,-1],[-1,1],[1,-1],[1,1]]) for (let i = 1; i < 8; i++) if (!addMove(rank+dr*i, file+df*i)) break;
      break;
    case 'R':
      for (const [dr, df] of [[-1,0],[1,0],[0,-1],[0,1]]) for (let i = 1; i < 8; i++) if (!addMove(rank+dr*i, file+df*i)) break;
      break;
    case 'Q':
      for (const [dr, df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) for (let i = 1; i < 8; i++) if (!addMove(rank+dr*i, file+df*i)) break;
      break;
    case 'K':
      for (const [dr, df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) addMove(rank+dr, file+df);
      break;
  }
  return moves;
}

function getCheckersValidMoves(sq, board, userColor) {
  const moves = [];
  const piece = board[sq];
  if (!piece) return moves;
  
  // Validate piece exists and belongs to player
  if (!piece.includes(userColor)) return moves;
  
  const isKing = piece.includes('king');
  const row = Math.floor(sq / 4);
  const col = sq % 4;
  
  // Valid diagonal directions for checkers on 32-square board
  // Each row has 4 squares, so diagonal moves are ±3 or ±5
  const directions = [];
  
  // Forward moves (for non-kings and appropriate direction for color)
  if (userColor === 'white') {
    // White moves up (decreasing row numbers)
    if (col > 0) directions.push(-5); // up-left
    if (col < 3) directions.push(-3); // up-right
    if (isKing) {
      if (col > 0) directions.push(3);  // down-left
      if (col < 3) directions.push(5);  // down-right
    }
  } else {
    // Black moves down (increasing row numbers)
    if (col > 0) directions.push(3);   // down-left
    if (col < 3) directions.push(5);   // down-right
    if (isKing) {
      if (col > 0) directions.push(-5); // up-left
      if (col < 3) directions.push(-3); // up-right
    }
  }
  
  // Check each direction for valid moves
  for (const d of directions) {
    const target = sq + d;
    
    // Validate target is on board
    if (target < 0 || target >= 32) continue;
    
    // Check for simple move (empty square)
    if (!board[target]) {
      moves.push(target);
    } else {
      // Check for jump (capture)
      const jump = sq + d * 2;
      if (jump >= 0 && jump < 32 && 
          board[target] && 
          !board[target].includes(userColor) && 
          !board[jump]) {
        moves.push(jump);
      }
    }
  }
  
  return moves;
}

// Make SpiritverseGames globally accessible
window.SpiritverseGames = SpiritverseGames;
