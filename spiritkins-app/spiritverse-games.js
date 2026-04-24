import { getGameTheme } from "./data/gameThemes.js";
import { getGameAssetPackage, resolveGameAsset, resolveGameThemeEnvironment } from "./data/gameAssetManifest.js";

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
// CELESTIAL THEME (original)
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

// THEME VARIANTS
const CHESS_THEME_OPTIONS = [
  { id: 'crown', label: 'SpiritCore Crown' },
  { id: 'veil', label: 'Lyra Veil' },
  { id: 'ember', label: 'Kairo Ember' },
  { id: 'astral', label: 'Raien Astral' },
  { id: 'abyssal', label: 'Neris Abyssal' }
];

const CHESS_PIECE_THEMES = {
  crown: CHESS_PIECES,
  veil: CHESS_PIECES,
  ember: CHESS_PIECES,
  astral: CHESS_PIECES,
  abyssal: CHESS_PIECES,
  celestial: CHESS_PIECES
};

function resolveGameTheme(type, overrideTheme) {
  if (overrideTheme && typeof overrideTheme === "object" && !Array.isArray(overrideTheme)) {
    const baseTheme = getGameTheme(type);
    return {
      ...baseTheme,
      ...overrideTheme,
      assets: overrideTheme.assets || baseTheme.assets,
      cssVars: {
        ...(baseTheme.cssVars || {}),
        ...(overrideTheme.cssVars || {})
      }
    };
  }
  const gameTheme = getGameTheme(type);
  if (type === "chess" && overrideTheme && CHESS_THEME_OPTIONS.some((option) => option.id === overrideTheme)) {
    return { ...gameTheme, boardVariant: overrideTheme };
  }
  return gameTheme;
}

function cssUrlValue(url) {
  if (!url) return "none";
  return `url("${String(url).replace(/"/g, '\\"')}")`;
}

function assetPublicPath(asset) {
  return asset?.publicPath || asset?.fallbackAsset?.publicPath || "";
}

function resolveRuntimeAssetUrl(type, slot, variant = "default") {
  return assetPublicPath(resolveGameAsset(type, slot, variant));
}

function buildRuntimePieceImage(src, alt, cls = "") {
  if (!src) return "";
  return `<img src="${src}" alt="${escapeAttribute(alt)}" class="${cls}" loading="eager" decoding="async" draggable="false" />`;
}

function themeVarsToStyle(theme, assetUrls = {}) {
  const vars = {
    ...(theme?.cssVars || {}),
    "--game-room-art": cssUrlValue(assetUrls.roomUrl),
    "--game-board-art": cssUrlValue(assetUrls.boardUrl),
    "--game-card-art": cssUrlValue(assetUrls.cardUrl),
    "--game-accent-art": cssUrlValue(assetUrls.accentUrl),
    "--game-token-user": cssUrlValue(assetUrls.tokenUserUrl),
    "--game-token-spirit": cssUrlValue(assetUrls.tokenSpiritUrl),
    "--game-token-accent": cssUrlValue(assetUrls.tokenAccentUrl),
    "--game-overlay-fx": cssUrlValue(assetUrls.overlayUrl),
    "--game-overlay-selected": cssUrlValue(assetUrls.overlaySelectedUrl),
    "--game-overlay-valid": cssUrlValue(assetUrls.overlayValidUrl),
    "--game-overlay-capture": cssUrlValue(assetUrls.overlayCaptureUrl),
    "--game-overlay-hover": cssUrlValue(assetUrls.overlayHoverUrl),
    "--game-overlay-win": cssUrlValue(assetUrls.overlayWinUrl),
    "--game-card-back": cssUrlValue(assetUrls.cardBackUrl),
    "--game-card-frame": cssUrlValue(assetUrls.cardFrameUrl),
    "--game-card-founder": cssUrlValue(assetUrls.cardFounderUrl),
    "--game-modal-frame": cssUrlValue(assetUrls.frameUrl),
    "--game-ui-frame": cssUrlValue(assetUrls.frameUrl)
  };
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

function resolveThemeAssetPackage(type, theme) {
  return theme?.assets || getGameAssetPackage(type);
}

function resolveRuntimeTokenUrl(type, variant = "user") {
  return assetPublicPath(resolveGameAsset(type, "pieces", variant));
}

function findConnectFourWinningLine(board = []) {
  if (!Array.isArray(board) || board.length !== 42) return [];
  const lines = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      if (col <= 3) lines.push([row * 7 + col, row * 7 + col + 1, row * 7 + col + 2, row * 7 + col + 3]);
      if (row <= 2) lines.push([row * 7 + col, (row + 1) * 7 + col, (row + 2) * 7 + col, (row + 3) * 7 + col]);
      if (row <= 2 && col <= 3) lines.push([row * 7 + col, (row + 1) * 7 + col + 1, (row + 2) * 7 + col + 2, (row + 3) * 7 + col + 3]);
      if (row <= 2 && col >= 3) lines.push([row * 7 + col, (row + 1) * 7 + col - 1, (row + 2) * 7 + col - 2, (row + 3) * 7 + col - 3]);
    }
  }
  for (const line of lines) {
    const token = board[line[0]];
    if (!token) continue;
    if (line.every((index) => board[index] === token)) return line;
  }
  return [];
}

function resolveThemeEnvironmentOverrides(theme) {
  const environment = resolveGameThemeEnvironment(theme?.boardVariant);
  if (!environment) return {};
  return {
    roomUrl: environment.room?.publicPath || "",
    boardUrl: environment.board?.publicPath || "",
    accentUrl: environment.accent?.publicPath || ""
  };
}

function buildAssetDataAttributes(type, theme) {
  const assets = resolveThemeAssetPackage(type, theme);
  if (!assets) return "";
  const boardAsset = resolveGameAsset(type, "board");
  const roomAsset = resolveGameAsset(type, "room");
  const environment = resolveThemeEnvironmentOverrides(theme);
  const fallbackAsset = assets.fallback || null;
  const attrs = [
    ["data-asset-root", assets.sourceRoot],
    ["data-asset-board", environment.boardUrl || assetPublicPath(boardAsset) || boardAsset?.sourcePath || ""],
    ["data-asset-room", environment.roomUrl || assetPublicPath(roomAsset) || roomAsset?.sourcePath || ""],
    ["data-asset-fallback", fallbackAsset?.fallbackKey || fallbackAsset?.renderer || ""]
  ];
  return attrs
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
    .join(" ");
}

function withThemeFrame(content, type, theme, extraClass = "") {
  const classes = ["sv-theme-shell", `sv-theme-${type}`];
  if (extraClass) classes.push(extraClass);
  const assetAttrs = buildAssetDataAttributes(type, theme);
  const boardAsset = resolveGameAsset(type, "board");
  const roomAsset = resolveGameAsset(type, "room");
  const environment = resolveThemeEnvironmentOverrides(theme);
  const cardAsset = resolveGameAsset(type, "cards");
  const accentAsset =
    resolveGameAsset(type, "pieces", theme?.boardVariant || "default") ||
    resolveGameAsset(type, "pieces", "default") ||
    resolveGameAsset(type, "pieces", "user") ||
    resolveGameAsset(type, "pieces", "shipSet") ||
    cardAsset;
  const tokenUserAsset = resolveGameAsset(type, "pieces", "user");
  const tokenSpiritAsset = resolveGameAsset(type, "pieces", "spiritkin");
  const tokenAccentAsset = resolveGameAsset(type, "pieces", "accent");
  const overlayAsset =
    resolveGameAsset(type, "overlays", "moveGlow") ||
    resolveGameAsset(type, "overlays", "dropTrail") ||
    resolveGameAsset(type, "overlays", "selection") ||
    resolveGameAsset(type, "overlays", "winLine") ||
    resolveGameAsset(type, "overlays", "hoshi") ||
    resolveGameAsset(type, "overlays", "sonar") ||
    resolveGameAsset(type, "overlays", "frame");
  const overlaySelectedAsset = resolveGameAsset(type, "overlays", "selected");
  const overlayValidAsset = resolveGameAsset(type, "overlays", "validMove");
  const overlayCaptureAsset = resolveGameAsset(type, "overlays", "capture");
  const overlayHoverAsset =
    resolveGameAsset(type, "overlays", "dropTrail") ||
    resolveGameAsset(type, "overlays", "selection") ||
    resolveGameAsset(type, "overlays", "hoshi");
  const overlayWinAsset = resolveGameAsset(type, "overlays", "winLine");
  const frameAsset = resolveGameAsset(type, "ui", "frame");
  const cardBackAsset = resolveGameAsset(type, "cards", "backs");
  const cardFrameAsset = resolveGameAsset(type, "cards", "frames");
  const cardFounderAsset = resolveGameAsset(type, "cards", "founderSet");
  return `
    <div class="${classes.join(" ")}" data-game-theme="${type}" data-associated-spiritkin="${theme.associatedSpiritkin}" data-theme="${escapeAttribute(theme.boardVariant || "default")}" data-theme-variant="${escapeAttribute(theme.boardVariant || "default")}" ${assetAttrs} style="${themeVarsToStyle(theme, {
      boardUrl: assetPublicPath(boardAsset),
      roomUrl: assetPublicPath(roomAsset),
      cardUrl: assetPublicPath(cardAsset),
      accentUrl: assetPublicPath(accentAsset),
      tokenUserUrl: assetPublicPath(tokenUserAsset),
      tokenSpiritUrl: assetPublicPath(tokenSpiritAsset),
      tokenAccentUrl: assetPublicPath(tokenAccentAsset),
      overlayUrl: assetPublicPath(overlayAsset),
      overlaySelectedUrl: assetPublicPath(overlaySelectedAsset),
      overlayValidUrl: assetPublicPath(overlayValidAsset),
      overlayCaptureUrl: assetPublicPath(overlayCaptureAsset),
      overlayHoverUrl: assetPublicPath(overlayHoverAsset),
      overlayWinUrl: assetPublicPath(overlayWinAsset),
      cardBackUrl: assetPublicPath(cardBackAsset),
      cardFrameUrl: assetPublicPath(cardFrameAsset),
      cardFounderUrl: assetPublicPath(cardFounderAsset),
      frameUrl: assetPublicPath(frameAsset)
    })}; --game-room-art: ${cssUrlValue(environment.roomUrl || assetPublicPath(roomAsset))}; --game-board-art: ${cssUrlValue(environment.boardUrl || assetPublicPath(boardAsset))}; --game-accent-art: ${cssUrlValue(environment.accentUrl || assetPublicPath(accentAsset))};">
      <div class="sv-theme-atlas">
        <div class="sv-theme-atlas-copy">
          <span class="sv-theme-atlas-kicker">${escapeAttribute(theme.domainLabel || `${theme.associatedSpiritkin} Domain`)}</span>
          <strong>${escapeAttribute(theme.chamberLabel || theme.boardStyle || "Spiritverse Chamber")}</strong>
        </div>
        <div class="sv-theme-atlas-mark">
          <span>${escapeAttribute(theme.displayName || type)}</span>
          <strong>${escapeAttribute(theme.associatedSpiritkin || "SpiritCore")}</strong>
        </div>
      </div>
      ${content}
    </div>
  `;
}

function resolveTarget(container) {
  return typeof container === "string" ? document.getElementById(container) : container;
}

function bindClicks(root, selector, handler) {
  if (!root) return;
  root.querySelectorAll(selector).forEach((element) => {
    element.onclick = (event) => {
      event.preventDefault();
      handler(element, event);
    };
  });
}

function shouldLogGameRenderDebug() {
  try {
    return window.__SV_GAME_DEBUG === true || localStorage.getItem("sv.game.debug") === "1";
  } catch (_) {
    return window.__SV_GAME_DEBUG === true;
  }
}

function logGameRenderDebug(eventName, detail = {}) {
  if (!shouldLogGameRenderDebug()) return;
  console.info(`[GameRenderDebug] ${eventName}`, detail);
}

function spiritCardGlyph(card = {}) {
  const glyphs = {
    Essence: "✦",
    Spirit: "◈",
    Realm: "⬡",
    Echo: "☽",
    Bond: "✧"
  };
  return glyphs[card.type] || "✶";
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================
// GRAND STAGE OVERLAY — Unified Fullscreen System
// ============================================================
const GrandStage = {
  isOpen: false,
  gameType: null,
  spiritkin: null,
  
  open(gameType, spiritkin, renderFn, theme = resolveGameTheme(gameType)) {
    if (this.isOpen) this.close();
    this.isOpen = true;
    this.gameType = gameType;
    this.spiritkin = spiritkin;
    
    const overlay = document.createElement('div');
    overlay.className = 'game-fullscreen-overlay';
    overlay.id = 'grand-stage';
    overlay.dataset.gameTheme = gameType;
    overlay.dataset.associatedSpiritkin = theme.associatedSpiritkin;
    overlay.dataset.theme = theme.boardVariant || "default";
    const assetPackage = resolveThemeAssetPackage(gameType, theme);
    const environment = resolveThemeEnvironmentOverrides(theme);
    if (assetPackage?.sourceRoot) overlay.dataset.assetRoot = assetPackage.sourceRoot;
    const boardAsset = resolveGameAsset(gameType, "board");
    const roomAsset = resolveGameAsset(gameType, "room");
    const fallbackAsset = assetPackage?.fallback || null;
    if (environment.boardUrl || assetPublicPath(boardAsset) || boardAsset?.sourcePath) overlay.dataset.assetBoard = environment.boardUrl || assetPublicPath(boardAsset) || boardAsset.sourcePath;
    if (environment.roomUrl || assetPublicPath(roomAsset) || roomAsset?.sourcePath) overlay.dataset.assetRoom = environment.roomUrl || assetPublicPath(roomAsset) || roomAsset.sourcePath;
    if (fallbackAsset?.fallbackKey || fallbackAsset?.renderer) overlay.dataset.assetFallback = fallbackAsset?.fallbackKey || fallbackAsset?.renderer;
    for (const [key, value] of Object.entries(theme.cssVars || {})) {
      overlay.style.setProperty(key, value);
    }
    overlay.style.setProperty("--game-board-art", cssUrlValue(environment.boardUrl || assetPublicPath(boardAsset)));
    overlay.style.setProperty("--game-room-art", cssUrlValue(environment.roomUrl || assetPublicPath(roomAsset)));
    overlay.style.setProperty("--game-accent-art", cssUrlValue(environment.accentUrl || ""));
    
    overlay.innerHTML = `
      <div class="game-fullscreen-header">
        <div class="game-fullscreen-title">${this.getGameTitle(gameType)}<span class="game-fullscreen-domain">${escapeAttribute(theme.chamberLabel || theme.domainLabel || "Spiritverse Chamber")}</span></div>
        <button class="game-fullscreen-close" id="gs-close">✕ End Experience</button>
      </div>
      <div class="game-fullscreen-stage">
        <div class="board-3d-wrap" id="gs-board-wrap"></div>
      </div>
      <div class="game-fullscreen-sidebar">
        <div class="gs-sidebar-section">
          <div class="gs-sidebar-label">Presence</div>
          <div class="gs-commentary-bubble">
            <div class="gs-commentary-text" id="gs-commentary">"I'm ready. Make your move."</div>
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
      spirit_cards: '🎴 Spirit-Cards',
      'echo-trials': '📜 Echo Trials',
      echo_trials: '📜 Echo Trials'
    };
    titles.tictactoe = titles.tictactoe || 'TicTacToe of Echoes';
    titles.connect_four = titles.connect_four || 'Connect Four Constellations';
    titles.battleship = titles.battleship || 'Abyssal Battleship';
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

function getBoardPieceAtSquare(board, square) {
  if (!board || !square) return null;
  const file = 'abcdefgh'.indexOf(String(square[0] || '').toLowerCase());
  const rank = 8 - parseInt(String(square[1] || ''), 10);
  if (file < 0 || Number.isNaN(rank) || rank < 0 || rank > 7) return null;
  return board[rank]?.[file] || null;
}

function buildChessPieceMarkup(piece, themeId) {
  if (!piece) return "";
  const pieceKey = `${piece.color}${piece.type}`;
  const themePieces = CHESS_PIECE_THEMES[themeId] || CHESS_PIECE_THEMES.crown;
  const pieceSvg = themePieces[pieceKey] || "";
  if (!pieceSvg) return "";
  return `<div class="chess-piece ${piece.color === 'w' ? 'piece-white' : 'piece-black'}">${pieceSvg}</div>`;
}

function playMoveSound(detail = {}) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("spiritverse:chess-move-sound", { detail }));
  } catch {}
}

function animateCommittedChessMove(target, previousFen, nextFen, lastMove, themeId) {
  if (!target || !previousFen || !nextFen || !lastMove?.from || !lastMove?.to) return;
  const boardEl = target.querySelector('#chess-board');
  if (!boardEl) return;
  const fromCell = target.querySelector(`.chess-cell[data-sq="${lastMove.from}"]`);
  const toCell = target.querySelector(`.chess-cell[data-sq="${lastMove.to}"]`);
  if (!fromCell || !toCell) return;

  const previousBoard = parseFEN(previousFen);
  const nextBoard = parseFEN(nextFen);
  const movingPiece = getBoardPieceAtSquare(previousBoard, lastMove.from) || getBoardPieceAtSquare(nextBoard, lastMove.to);
  const capturedPiece = getBoardPieceAtSquare(previousBoard, lastMove.to);
  const nextPieceEl = toCell.querySelector('.chess-piece');
  if (!movingPiece || !nextPieceEl) return;

  const fromRect = fromCell.getBoundingClientRect();
  const toRect = toCell.getBoundingClientRect();
  if (!fromRect.width || !toRect.width) return;

  const ghost = document.createElement('div');
  ghost.className = `chess-piece chess-piece-ghost ${movingPiece.color === 'w' ? 'piece-white' : 'piece-black'}`;
  ghost.innerHTML = nextPieceEl.innerHTML;
  ghost.style.left = `${fromRect.left}px`;
  ghost.style.top = `${fromRect.top}px`;
  ghost.style.width = `${fromRect.width}px`;
  ghost.style.height = `${fromRect.height}px`;
  document.body.appendChild(ghost);

  nextPieceEl.classList.add('chess-piece-hidden');

  if (capturedPiece && capturedPiece.color !== movingPiece.color) {
    toCell.classList.add('chess-capture-flash');
    window.setTimeout(() => toCell.classList.remove('chess-capture-flash'), 260);
  }

  window.requestAnimationFrame(() => {
    ghost.classList.add('is-moving');
    ghost.style.transform = `translate(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px) scale(1)`;
  });

  window.setTimeout(() => {
    nextPieceEl.classList.remove('chess-piece-hidden');
    nextPieceEl.classList.add('chess-piece-landed');
    window.setTimeout(() => nextPieceEl.classList.remove('chess-piece-landed'), 240);
    ghost.remove();
    playMoveSound({ from: lastMove.from, to: lastMove.to, piece: `${movingPiece.color}${movingPiece.type}` });
  }, 230);
}

function renderChessBoard(container, fen, selectedSquare, validMoves, lastMove, onSquareClick, isExpanded = false, theme = resolveGameTheme("chess"), isInteractive = true) {
  const board = parseFEN(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const files = ['a','b','c','d','e','f','g','h'];
  const themeId = theme.boardVariant || 'crown';

  let html = '';
  if (!isExpanded) {
    html += `<div class="game-board-controls chess-board-controls">
      <div class="piece-theme-selector">
        <span class="piece-theme-label">Theme</span>
        ${CHESS_THEME_OPTIONS.map((option) => `<button class="piece-theme-btn ${themeId === option.id ? 'active' : ''}" data-action="set-piece-theme" data-theme="${option.id}">${option.label}</button>`).join('')}
      </div>
      <button class="game-expand-btn chess-stage-btn" data-action="chess-expand">&#x26F6; Enter Grand Stage</button>
    </div>`;
  }

  html += `<div class="chess-showcase-meta">
    <div class="chess-showcase-kicker">Authoritative Board</div>
    <div class="chess-showcase-copy">${isInteractive ? 'Select a white piece, follow the glow, and keep the board centered while the answer lands.' : 'The canonical position is locked while the board resolves.'}</div>
  </div>`;

  html += `<div class="chess-board chess-theme-${themeId} chess-showcase-board ${isExpanded ? 'board-3d board-grand' : 'board-standard'} ${isInteractive ? '' : 'board-locked'}" id="chess-board">`;
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const sq = files[file] + (8 - rank);
      const piece = board[rank][file];
      const isSelected = selectedSquare === sq;
      const isValidMove = validMoves && validMoves.includes(sq);
      const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq);

      let cellClass = `chess-cell`;
      if (isSelected) cellClass += ' chess-selected';
      if (isValidMove) cellClass += ' chess-valid-move';
      if (isLastMove) cellClass += ' chess-last-move';

      const pieceKey = piece ? `${piece.color}${piece.type}` : null;
      const pieceSvg = pieceKey ? (CHESS_PIECE_THEMES[themeId]?.[pieceKey] || CHESS_PIECES[pieceKey] || "") : "";

      html += `<div class="${cellClass}" data-sq="${sq}" ${isInteractive ? 'data-action="chess-square-click"' : ''}>`;
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
    html += `<div class="chess-showcase-footer">Every move resolves through the live bonded board. Watch the highlighted landing squares and the response banner above the board.</div>`;
  }

  const target = resolveTarget(container);
  if (!target) return;
  const previousFen = target.dataset.renderFen || '';
  const nextMoveSignature = lastMove?.from && lastMove?.to ? `${lastMove.from}-${lastMove.to}-${fen}` : '';
  const previousMoveSignature = target.dataset.lastMoveSignature || '';
  target.innerHTML = withThemeFrame(html, 'chess', theme, `${isExpanded ? 'sv-theme-expanded ' : ''}chess-showcase-shell`.trim());
  target.dataset.renderFen = fen || '';
  target.dataset.lastMoveSignature = nextMoveSignature;

  if (nextMoveSignature && previousFen && previousMoveSignature !== nextMoveSignature) {
    animateCommittedChessMove(target, previousFen, fen, lastMove, themeId);
  }

  if (!isExpanded) {
    const expandBtn = target.querySelector('[data-action="chess-expand"]');
    if (expandBtn) {
      expandBtn.onclick = () => {
        GrandStage.open('chess', 'Spiritkin', (c, exp) => renderChessBoard(c, fen, selectedSquare, validMoves, lastMove, onSquareClick, exp, theme), theme);
      };
    }
  }

  if (isExpanded) {
    bindClicks(target, '[data-action="chess-square-click"]', (element) => {
      const square = element.dataset.sq;
      if (!square) return;
      onSquareClick(square);
      renderChessBoard(
        target,
        fen,
        SpiritverseGames.chess.selectedSquare,
        SpiritverseGames.chess.validMoves,
        lastMove,
        onSquareClick,
        true,
        theme
      );
    });
  }
}

// ============================================================
// CHECKERS ENGINE & RENDERER
// ============================================================
function renderCheckersBoard(container, boardArray, selectedPiece, validMoves, lastMove, onSquareClick, isExpanded = false, theme = resolveGameTheme("checkers"), isInteractive = true) {
  const board = boardArray || Array(32).fill(null);
  const userPieceUrl = resolveRuntimeAssetUrl("checkers", "pieces", "user");
  const spiritPieceUrl = resolveRuntimeAssetUrl("checkers", "pieces", "spiritkin");
  const userKingUrl = resolveRuntimeAssetUrl("checkers", "pieces", "userKing") || userPieceUrl;
  const spiritKingUrl = resolveRuntimeAssetUrl("checkers", "pieces", "spiritkinKing") || spiritPieceUrl;
  
  let html = '';
  if (!isExpanded) {
    html += `<div class="game-board-controls" style="display:flex;align-items:center;justify-content:flex-end;width:100%;max-width:340px;margin-bottom:6px;">
      <button class="game-expand-btn" data-action="checkers-expand">&#x26F6; Grand Stage</button>
    </div>`;
  }

  html += `<div class="checkers-showcase-meta">
    <div class="checkers-showcase-kicker">Dragonforge Match</div>
    <div class="checkers-showcase-copy">${isInteractive ? 'Advance, jump, and crown your line.' : 'The board is holding while the Spiritkin resolves the answer.'}</div>
  </div>`;
  html += `<div class="checkers-board ${isExpanded ? 'board-grand' : 'board-standard'} ${isInteractive ? '' : 'board-locked'}">`;
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
      const isLastFrom = sqIndex !== -1 && lastMove && Number(lastMove.from) === sqIndex;
      const isLastTo = sqIndex !== -1 && lastMove && Number(lastMove.to) === sqIndex;

      let cellClass = `checkers-cell ${isLight ? 'checkers-light-zone' : 'checkers-dark-zone'}`;
      if (isSelected) cellClass += ' checkers-selected';
      if (isValid) cellClass += ' checkers-valid';
      if (isLastFrom) cellClass += ' checkers-last-from';
      if (isLastTo) cellClass += ' checkers-last-to';

      html += `<div class="${cellClass}" data-sq="${sqIndex}" ${isInteractive ? 'data-action="checkers-square-click"' : ''}>`;
      if (piece) {
        const isKing = piece.includes('king');
        const colorClass = piece.includes('white') ? 'piece-user' : 'piece-spiritkin';
        const pieceUrl = piece.includes("white")
          ? (isKing ? userKingUrl : userPieceUrl)
          : (isKing ? spiritKingUrl : spiritPieceUrl);
        html += `<div class="checkers-piece ${colorClass} ${isKing ? 'piece-king' : ''}">${buildRuntimePieceImage(pieceUrl, `${piece} checkers piece`, "checkers-piece-image")}</div>`;
      }
      if (isValid && !piece) html += `<div class="checkers-move-dot"></div>`;
      html += `</div>`;
    }
  }
  html += `</div>`;
  const target = resolveTarget(container);
  if (!target) return;
  target.innerHTML = withThemeFrame(html, 'checkers', theme, isExpanded ? 'sv-theme-expanded' : '');

  if (!isExpanded) {
    const expandBtn = target.querySelector('[data-action="checkers-expand"]');
    if (expandBtn) {
      expandBtn.onclick = () => {
        GrandStage.open('checkers', 'Spiritkin', (c, exp) => renderCheckersBoard(c, boardArray, selectedPiece, validMoves, lastMove, onSquareClick, exp, theme), theme);
      };
    }
  }

  if (isExpanded) {
    bindClicks(target, '[data-action="checkers-square-click"]', (element) => {
      const square = element.dataset.sq;
      if (square === undefined) return;
      onSquareClick(square);
      renderCheckersBoard(
        target,
        boardArray,
        SpiritverseGames.checkers.selectedPiece,
        SpiritverseGames.checkers.validMoves,
        lastMove,
        onSquareClick,
        true,
        theme
      );
    });
  }
}

// ============================================================
// GO (STAR-MAPPING) RENDERER
// ============================================================
function renderGoBoard(container, boardArray, lastMove, onSquareClick, isExpanded = false, theme = resolveGameTheme("go"), isInteractive = true) {
  const size = 13;
  const board = boardArray || Array(size * size).fill(null);
  const goUserStone = resolveRuntimeTokenUrl("go", "user");
  const goSpiritStone = resolveRuntimeTokenUrl("go", "spiritkin");
  const goHintOverlay = assetPublicPath(resolveGameAsset("go", "overlays", "hoshi"));

  let html = '';
  if (!isExpanded) {
    html += `<div class="game-board-controls" style="display:flex;align-items:center;justify-content:flex-end;width:100%;max-width:340px;margin-bottom:6px;">
      <div class="game-preview-chip">Preview only</div>
    </div>`;
  }

  html += `<div class="go-board ${isExpanded ? 'board-grand' : 'board-standard'} ${isInteractive ? '' : 'board-locked'}" style="grid-template-columns: repeat(${size}, 1fr); grid-template-rows: repeat(${size}, 1fr);">`;
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

      html += `<div class="${cellClass}" data-idx="${idx}" ${isInteractive ? 'data-action="go-square-click"' : ''}>
        <div class="go-line-h"></div>
        <div class="go-line-v"></div>
        <div class="go-hover-indicator"${goHintOverlay ? ` style="background-image:url('${escapeAttribute(goHintOverlay)}')"` : ""}></div>`;
      
      if (piece) {
        const stoneClass = piece === 'black' ? 'go-stone-black' : 'go-stone-white';
        const stoneImage = piece === 'black' ? goSpiritStone : goUserStone;
        html += `<div class="go-stone ${stoneClass} ${isLast ? 'go-stone-last' : ''}">${buildRuntimePieceImage(stoneImage, `${piece} go stone`, "go-stone-image")}</div>`;
      }
      html += `</div>`;
    }
  }
  html += `</div>`;
  html += `<div class="sv-mini-caption">Star-Mapping is currently a read-only preview while capture, pass, and scoring rules stay out of live rotation.</div>`;
  const target = resolveTarget(container);
  if (!target) return;
  target.innerHTML = withThemeFrame(html, 'go', theme, isExpanded ? 'sv-theme-expanded' : '');

  if (isExpanded) {
    bindClicks(target, '[data-action="go-square-click"]', (element) => {
      const index = element.dataset.idx;
      if (index !== undefined) onSquareClick(Number(index));
    });
  }
}

function getGamePayload(gameData) {
  if (gameData?.data && typeof gameData.data === 'object') {
    return gameData.data;
  }
  return gameData || {};
}

function buildFallbackPayload(type) {
  switch (type) {
    case 'chess':
      return { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', lastMove: null };
    case 'checkers':
      return { board: Array(32).fill(null), lastMove: null };
    case 'go':
      return { board: Array(13 * 13).fill(null), lastMove: null };
    case 'spirit_cards':
      return {
        hand: [],
        deck: [],
        discard: [],
        board: [],
        spiritkinHand: [],
        spiritkinDeck: [],
        spiritkinDiscard: [],
        mana: 5,
        spiritkinMana: 5,
        realmPoints: { user: 0, spiritkin: 0 }
      };
    case 'echo_trials':
      return { riddle: 'A riddle awaits...', answer: '', attempts: 0, maxAttempts: 3 };
    case 'tictactoe':
      return { board: Array(9).fill(null), winner: null, lastMove: null };
    case 'connect_four':
      return { board: Array(42).fill(null), winner: null, lastMove: null };
    case 'battleship':
      return {
        size: 5,
        userGuesses: [],
        spiritkinGuesses: [],
        hits: { user: [], spiritkin: [] },
        winner: null,
        lastMove: null
      };
    default:
      return {};
  }
}

function normalizeSizedArray(source, size) {
  const next = Array.isArray(source) ? source.slice(0, size) : [];
  if (next.length < size) next.push(...Array(size - next.length).fill(null));
  return next;
}

function normalizePayloadForView(type, payload = {}) {
  const base = buildFallbackPayload(type);
  const normalized = { ...base, ...(payload && typeof payload === 'object' ? payload : {}) };

  if (type === 'checkers') {
    normalized.board = normalizeSizedArray(payload.board, 32);
  } else if (type === 'go') {
    normalized.board = normalizeSizedArray(payload.board, 13 * 13);
  } else if (type === 'tictactoe') {
    normalized.board = normalizeSizedArray(payload.board, 9);
  } else if (type === 'connect_four') {
    normalized.board = normalizeSizedArray(payload.board, 42);
  } else if (type === 'spirit_cards') {
    normalized.hand = Array.isArray(payload.hand) ? payload.hand.filter(Boolean) : [];
    normalized.deck = Array.isArray(payload.deck) ? payload.deck.filter(Boolean) : [];
    normalized.discard = Array.isArray(payload.discard) ? payload.discard.filter(Boolean) : [];
    normalized.board = Array.isArray(payload.board) ? payload.board.filter(Boolean) : [];
    normalized.spiritkinHand = Array.isArray(payload.spiritkinHand) ? payload.spiritkinHand.filter(Boolean) : [];
    normalized.spiritkinDeck = Array.isArray(payload.spiritkinDeck) ? payload.spiritkinDeck.filter(Boolean) : [];
    normalized.spiritkinDiscard = Array.isArray(payload.spiritkinDiscard) ? payload.spiritkinDiscard.filter(Boolean) : [];
    normalized.realmPoints = payload.realmPoints && typeof payload.realmPoints === 'object'
      ? {
          user: Number(payload.realmPoints.user || 0),
          spiritkin: Number(payload.realmPoints.spiritkin || 0)
        }
      : base.realmPoints;
  } else if (type === 'battleship') {
    normalized.userGuesses = Array.isArray(payload.userGuesses) ? payload.userGuesses.filter(Number.isInteger) : [];
    normalized.spiritkinGuesses = Array.isArray(payload.spiritkinGuesses) ? payload.spiritkinGuesses.filter(Number.isInteger) : [];
    normalized.hits = payload.hits && typeof payload.hits === 'object'
      ? {
          user: Array.isArray(payload.hits.user) ? payload.hits.user.filter(Number.isInteger) : [],
          spiritkin: Array.isArray(payload.hits.spiritkin) ? payload.hits.spiritkin.filter(Number.isInteger) : []
        }
      : base.hits;
  }

  return normalized;
}

function normalizeGameForView(gameData) {
  if (!gameData || typeof gameData !== 'object') return null;
  const type = String(gameData.type || '').trim();
  if (!type) return null;
  const payload = normalizePayloadForView(type, getGamePayload(gameData));
  return {
    ...gameData,
    type,
    name: gameData.name || GrandStage.getGameTitle(type).replace(/^[^\s]+\s/, ''),
    status: gameData.status === 'ended' ? 'ended' : 'active',
    turn: gameData.turn === 'spiritkin' ? 'spiritkin' : 'user',
    history: Array.isArray(gameData.history) ? gameData.history.filter(Boolean) : [],
    data: payload
  };
}

function normalizeLastMove(type, lastMove) {
  if (!lastMove) return null;

  if (type === 'chess') {
    if (typeof lastMove === 'object' && lastMove.from && lastMove.to) return lastMove;
    if (typeof lastMove === 'string' && /^[a-h][1-8][a-h][1-8]$/i.test(lastMove)) {
      return {
        from: lastMove.slice(0, 2).toLowerCase(),
        to: lastMove.slice(2, 4).toLowerCase()
      };
    }
    return null;
  }

  if (type === 'go') {
    if (typeof lastMove === 'object' && Number.isInteger(lastMove.row) && Number.isInteger(lastMove.col)) {
      return lastMove;
    }
    if (typeof lastMove === 'string' && /^[A-M](?:[1-9]|1[0-3])$/i.test(lastMove)) {
      const size = 13;
      const col = lastMove[0].toUpperCase().charCodeAt(0) - 65;
      const row = size - parseInt(lastMove.slice(1), 10);
      if (row >= 0 && row < size && col >= 0 && col < size) {
        return { row, col };
      }
    }
    return null;
  }

  if (type === 'checkers') {
    if (typeof lastMove === 'object' && Number.isInteger(lastMove.from) && Number.isInteger(lastMove.to)) {
      return lastMove;
    }
    if (typeof lastMove === 'string') {
      const match = lastMove.match(/^(\d+)-(\d+)$/);
      if (match) {
        return {
          from: Number.parseInt(match[1], 10),
          to: Number.parseInt(match[2], 10)
        };
      }
    }
    return null;
  }

  if (type === 'tictactoe') {
    if (Number.isInteger(lastMove)) return lastMove;
    if (typeof lastMove === 'string' && /^\d+$/.test(lastMove)) {
      const index = Number.parseInt(lastMove, 10);
      return index >= 0 && index < 9 ? index : null;
    }
    return null;
  }

  if (type === 'connect_four') {
    if (typeof lastMove === 'object' && Number.isInteger(lastMove.col)) return lastMove;
    if (Number.isInteger(lastMove)) return { col: lastMove };
    if (typeof lastMove === 'string' && /^\d+$/.test(lastMove)) {
      const col = Number.parseInt(lastMove, 10);
      return col >= 0 && col < 7 ? { col } : null;
    }
    return null;
  }

  if (type === 'battleship') {
    if (Number.isInteger(lastMove)) return lastMove;
    if (typeof lastMove === 'object' && Number.isInteger(lastMove.index)) return lastMove.index;
    if (typeof lastMove === 'string' && /^\d+$/.test(lastMove)) {
      const index = Number.parseInt(lastMove, 10);
      return index >= 0 ? index : null;
    }
    return null;
  }

  return lastMove;
}

// ============================================================
// PUBLIC API — SpiritverseGames singleton
// ============================================================
export const SpiritverseGames = {
  chess: { selectedSquare: null, validMoves: [], lastMove: null },
  checkers: { selectedPiece: null, validMoves: [] },
  echoAnswer: '',

  render(container, gameData, spiritkinName, commentary, onMoveSubmit, theme) {
    if (!theme) theme = 'crown';
    const safeGame = normalizeGameForView(gameData);
    if (!safeGame || !safeGame.type) return;
    const type = safeGame.type;
    const gameTheme = resolveGameTheme(type, theme);
    const payload = safeGame.data;
    const viewPayload = { ...payload, status: safeGame.status, result: safeGame.result, turn: safeGame.turn };
    const gameCommentary = commentary || safeGame.commentary || "Your move.";
    const history = safeGame.history || [];
    const chessFen = payload.fen || safeGame.fen;
    const board = payload.board || safeGame.board;
    const lastMove = normalizeLastMove(type, payload.lastMove || safeGame.lastMove);
    const isInteractive = safeGame.status === 'active' && safeGame.turn === 'user' && type !== 'go';
    logGameRenderDebug("render", {
      type,
      spiritkinName,
      status: safeGame.status,
      turn: safeGame.turn,
      moveCount: safeGame.moveCount || 0,
      historyLength: history.length,
      isInteractive,
      payloadKeys: Object.keys(payload || {}),
      boardSize: Array.isArray(board) ? board.length : null,
      hasFen: typeof chessFen === 'string' && chessFen.length > 0,
    });

    const renderFn = (target, isExp) => {
      switch (type) {
        case 'chess':
          renderChessBoard(target, chessFen, this.chess.selectedSquare, this.chess.validMoves, lastMove, (sq) => {
            this.handleChessSquareClick(sq, chessFen, onMoveSubmit);
          }, isExp, gameTheme, isInteractive);
          break;
        case 'checkers':
          renderCheckersBoard(target, board, this.checkers.selectedPiece, this.checkers.validMoves, lastMove, (sq) => {
            this.handleCheckersSquareClick(sq, board, 'white', onMoveSubmit);
          }, isExp, gameTheme, isInteractive);
          break;
        case 'go':
          renderGoBoard(target, board, lastMove, (idx) => {
            const size = 13;
            const r = Math.floor(idx / size);
            const c = idx % size;
            onMoveSubmit(`${String.fromCharCode(65 + c)}${size - r}`);
          }, isExp, gameTheme, isInteractive);
          break;
        case 'spirit_cards':
          this.renderSpiritCards(target, viewPayload, onMoveSubmit, isExp, gameTheme);
          break;
        case 'echo_trials':
          this.renderEchoTrials(target, viewPayload, onMoveSubmit, isExp, gameTheme);
          break;
        case 'tictactoe':
          this.renderTicTacToe(target, { ...viewPayload, lastMove }, onMoveSubmit, isExp, gameTheme);
          break;
        case 'connect_four':
          this.renderConnectFour(target, { ...viewPayload, lastMove }, onMoveSubmit, isExp, gameTheme);
          break;
        case 'battleship':
          this.renderBattleship(target, { ...viewPayload, lastMove }, onMoveSubmit, isExp, gameTheme);
          break;
      }
    };

    console.info("[Games] render-called", {
      type,
      containerType: typeof container === "string" ? "id" : "element",
      containerId: typeof container === "string" ? container : (container?.id || null),
      status: safeGame.status,
      turn: safeGame.turn
    });
    // Render to main container
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) {
      console.error("[Games] render-failed", {
        type,
        reason: "container-missing",
        containerType: typeof container === "string" ? "id" : "element",
        containerId: typeof container === "string" ? container : (container?.id || null)
      });
      return;
    }
    renderFn(el, false);
    console.info("[Games] render success", {
      type,
      containerId: el.id || null,
      status: safeGame.status,
      turn: safeGame.turn
    });
    // Update Grand Stage if open
    if (GrandStage.isOpen && GrandStage.gameType === type) {
      GrandStage.update(renderFn, gameCommentary, history);
    }
  },

  expand(gameData, spiritkinName, onMoveSubmit, theme) {
    if (!theme) theme = 'crown';
    const safeGame = normalizeGameForView(gameData);
    if (!safeGame || !safeGame.type) return;
    const type = safeGame.type;
    const gameTheme = resolveGameTheme(type, theme);
    const payload = safeGame.data;
    const viewPayload = { ...payload, status: safeGame.status, result: safeGame.result, turn: safeGame.turn };
    const commentary = safeGame.commentary || "I'm ready. Show me what you've got.";
    const history = safeGame.history || [];
    const chessFen = payload.fen || safeGame.fen;
    const board = payload.board || safeGame.board;
    const lastMove = normalizeLastMove(type, payload.lastMove || safeGame.lastMove);
    const isInteractive = safeGame.status === 'active' && safeGame.turn === 'user' && type !== 'go';
    const renderFn = (target, isExp) => {
      switch (type) {
        case 'chess':
          renderChessBoard(target, chessFen, this.chess.selectedSquare, this.chess.validMoves, lastMove, (sq) => {
            this.handleChessSquareClick(sq, chessFen, onMoveSubmit);
          }, isExp, gameTheme, isInteractive);
          break;
        case 'checkers':
          renderCheckersBoard(target, board, this.checkers.selectedPiece, this.checkers.validMoves, lastMove, (sq) => {
            this.handleCheckersSquareClick(sq, board, 'white', onMoveSubmit);
          }, isExp, gameTheme, isInteractive);
          break;
        case 'go':
          renderGoBoard(target, board, lastMove, (idx) => {
            const size = 13;
            const r = Math.floor(idx / size);
            const c = idx % size;
            onMoveSubmit(`${String.fromCharCode(65 + c)}${size - r}`);
          }, isExp, gameTheme, isInteractive);
          break;
        case 'spirit_cards':
          this.renderSpiritCards(target, viewPayload, onMoveSubmit, isExp, gameTheme);
          break;
        case 'echo_trials':
          this.renderEchoTrials(target, viewPayload, onMoveSubmit, isExp, gameTheme);
          break;
        case 'tictactoe':
          this.renderTicTacToe(target, { ...viewPayload, lastMove }, onMoveSubmit, isExp, gameTheme);
          break;
        case 'connect_four':
          this.renderConnectFour(target, { ...viewPayload, lastMove }, onMoveSubmit, isExp, gameTheme);
          break;
        case 'battleship':
          this.renderBattleship(target, { ...viewPayload, lastMove }, onMoveSubmit, isExp, gameTheme);
          break;
        default:
          if (target) target.innerHTML = `<div style="padding:2rem;text-align:center;color:#ccc">Grand Stage not available for this game type.</div>`;
      }
    };
    GrandStage.open(type, spiritkinName, renderFn, gameTheme);
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

  renderSpiritCards(container, gameData, onMoveSubmit, isExpanded, theme = resolveGameTheme("spirit_cards")) {
    const hand = gameData.hand || [];
    const mana = gameData.mana || 5;
    const board = gameData.board || [];
    const spiritkinHand = gameData.spiritkinHand || [];
    const realmPoints = gameData.realmPoints || { user: 0, spiritkin: 0 };
    const isUsersTurn = gameData.status !== 'ended' && gameData.turn === 'user';
    const affordableHand = hand.filter((card) => Number(card?.cost || 0) <= Number(mana || 0));
    const targetScore = 15;
    const userRemaining = Math.max(0, targetScore - Number(realmPoints.user || 0));
    const spiritkinRemaining = Math.max(0, targetScore - Number(realmPoints.spiritkin || 0));
    const boardLeader = Number(realmPoints.user || 0) === Number(realmPoints.spiritkin || 0)
      ? "The score is even."
      : Number(realmPoints.user || 0) > Number(realmPoints.spiritkin || 0)
        ? `You are ahead by ${Number(realmPoints.user || 0) - Number(realmPoints.spiritkin || 0)} realm point${Number(realmPoints.user || 0) - Number(realmPoints.spiritkin || 0) === 1 ? "" : "s"}.`
        : `Spiritkin is ahead by ${Number(realmPoints.spiritkin || 0) - Number(realmPoints.user || 0)} realm point${Number(realmPoints.spiritkin || 0) - Number(realmPoints.user || 0) === 1 ? "" : "s"}.`;
    const nextActionCopy = !isUsersTurn
      ? "Waiting for the Spiritkin reply. Your hand unlocks when the realm settles."
      : !hand.length
        ? "Your hand is empty. Draw first, then start building your field."
        : !affordableHand.length
          ? `Nothing in hand fits ${mana}/5 mana. Draw for a new option or wait for a better line.`
          : affordableHand.length === 1
            ? `Play ${affordableHand[0].name} now or draw first.`
            : "Play any affordable card or draw first.";
    const userBoard = board.filter((entry) => entry?.owner === "user");
    const spiritkinBoard = board.filter((entry) => entry?.owner === "spiritkin");
    const root = resolveTarget(container);
    if (!root) return;
    
    const html = `
      <div class="spirit-cards-container ${isExpanded ? 'spirit-cards-grand' : ''}">
        <div class="spiritkin-area">
          <div class="spirit-cards-zone-label">Spiritkin Presence</div>
          <div class="spirit-cards-grid">
            ${spiritkinHand.length ? spiritkinHand.map((card, i) => `
              <div class="spirit-card-tile spirit-card-spiritkin" data-spirit-card="${i}">
                <div class="spirit-card-glyph">${spiritCardGlyph(card)}</div>
                <div class="spirit-card-name">${card.name}</div>
                <div class="spirit-card-meta">${card.type} • Power ${card.power}</div>
              </div>
            `).join('') : `<div class="spirit-cards-hint">Your companion is gathering their next draw.</div>`}
          </div>
        </div>
        
        <div class="spirit-cards-status">
          <div class="mana-display">
            <div class="mana-stat">
              <div class="mana-label">Your Mana</div>
              <div class="mana-value">${mana}/5</div>
            </div>
            <div class="mana-stat">
              <div class="mana-label">Spiritkin Mana</div>
              <div class="mana-value">${gameData.spiritkinMana || 5}/5</div>
            </div>
          </div>
          <div class="mana-display spirit-cards-score">
            <div class="mana-stat">
              <div class="mana-label">Your Realm Points</div>
              <div class="mana-value">${realmPoints.user || 0}</div>
            </div>
            <div class="mana-stat">
              <div class="mana-label">Spiritkin Realm Points</div>
              <div class="mana-value">${realmPoints.spiritkin || 0}</div>
            </div>
          </div>
          <div class="spirit-cards-boardline">
            <div class="game-help-card">
              <div class="game-help-card-label">Objective</div>
              <p>Reach ${targetScore} realm points first. You need ${userRemaining} more. Spiritkin needs ${spiritkinRemaining} more.</p>
            </div>
            <div class="game-help-card">
              <div class="game-help-card-label">Right Now</div>
              <p>${nextActionCopy}</p>
            </div>
            <button class="echo-submit-btn spirit-cards-draw-btn" data-action="cards-draw" ${!isUsersTurn ? 'disabled' : ''}>Draw card</button>
          </div>
        </div>

        <div class="spirit-cards-board-columns">
          <div class="player-hand">
            <div class="spirit-cards-zone-label">Your Field</div>
            <div class="spirit-cards-grid">
              ${userBoard.length ? userBoard.map((card) => `
                <div class="spirit-card-tile spirit-card-player">
                  <div class="spirit-card-glyph">${spiritCardGlyph(card)}</div>
                  <div class="spirit-card-name">${card.name}</div>
                  <div class="spirit-card-meta">${card.type} • Power ${card.power}</div>
                </div>
              `).join('') : `<div class="spirit-cards-hint">Your field is empty.</div>`}
            </div>
          </div>
          <div class="spiritkin-area">
            <div class="spirit-cards-zone-label">Spiritkin Field</div>
            <div class="spirit-cards-grid">
              ${spiritkinBoard.length ? spiritkinBoard.map((card) => `
                <div class="spirit-card-tile spirit-card-spiritkin">
                  <div class="spirit-card-glyph">${spiritCardGlyph(card)}</div>
                  <div class="spirit-card-name">${card.name}</div>
                  <div class="spirit-card-meta">${card.type} • Power ${card.power}</div>
                </div>
              `).join('') : `<div class="spirit-cards-hint">Spiritkin field is empty.</div>`}
            </div>
          </div>
        </div>
        
        <div class="player-hand">
          <div class="spirit-cards-zone-label">Your Hand</div>
          <div class="spirit-cards-grid">
            ${hand.length ? hand.map((card, i) => {
              const canAfford = Number(card?.cost || 0) <= Number(mana || 0);
              const disabled = !isUsersTurn || !canAfford;
              return `
              <button class="spirit-card-tile spirit-card-player ${canAfford ? 'is-playable' : 'is-locked'}" data-action="cards-play-card" data-card-idx="${i}" ${disabled ? 'disabled' : ''}>
                <div class="spirit-card-glyph">${spiritCardGlyph(card)}</div>
                <div class="spirit-card-name">${card.name}</div>
                <div class="spirit-card-meta">Cost ${card.cost} • Power ${card.power}</div>
                <div class="spirit-card-meta">${card.type}</div>
                <div class="spirit-card-state">${canAfford ? 'Playable now' : `Needs ${card.cost} mana`}</div>
              </button>
            `;
            }).join('') : `<div class="spirit-cards-hint">${isUsersTurn ? 'Your hand is empty. Draw a card to continue.' : 'Waiting for the Spiritkin to answer the realm.'}</div>`}
          </div>
        </div>
        
        <div class="spirit-cards-hint">${board.length ? `${board.length} card${board.length === 1 ? '' : 's'} are in play. ${boardLeader}` : 'No cards are in play yet. Draw or play a card to begin shaping the realm.'}</div>
      </div>
    `;
    
    root.innerHTML = withThemeFrame(html, 'spirit_cards', theme, isExpanded ? 'sv-theme-expanded' : '');
    if (isExpanded) {
      bindClicks(root, '[data-action="cards-play-card"]', (element) => {
        const cardIdx = Number(element.dataset.cardIdx);
        const card = hand[cardIdx];
        if (card) onMoveSubmit(`play:${card.name}`);
      });
      bindClicks(root, '[data-action="cards-draw"]', () => {
        onMoveSubmit("draw");
      });
    }
  },
  
  renderEchoTrials(container, gameData, onMoveSubmit, isExpanded, theme = resolveGameTheme("echo_trials")) {
    const riddle = gameData.riddle || "A riddle awaits...";
    const attempts = gameData.attempts || 0;
    const maxAttempts = gameData.maxAttempts || 3;
    const attemptsLeft = Math.max(0, Number(maxAttempts || 0) - Number(attempts || 0));
    const isUsersTurn = gameData.status !== 'ended' && gameData.turn === 'user';
    const root = resolveTarget(container);
    if (!root) return;
    
    const html = `
      <div class="echo-trials-container ${isExpanded ? 'echo-trials-grand' : ''}">
        <div class="riddle-box">
          <div class="echo-riddle-label">Echo Trial</div>
          <div class="echo-riddle-text">${riddle}</div>
          <div class="echo-trial-status-grid">
            <div class="echo-trial-status-card">
              <div class="echo-trial-status-label">Objective</div>
              <strong>Solve the riddle before all ${maxAttempts} attempts are spent.</strong>
              <p>One answer per turn. Wrong answers consume an attempt.</p>
            </div>
            <div class="echo-trial-status-card">
              <div class="echo-trial-status-label">Right Now</div>
              <strong>${isUsersTurn ? 'Offer your best answer.' : 'Wait for the trial reply.'}</strong>
              <p>${isUsersTurn ? `${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remain.` : 'Input unlocks again as soon as the Spiritkin finishes responding.'}</p>
            </div>
          </div>

          <div class="echo-attempt-pips">
            ${Array.from({length: maxAttempts}).map((_, i) => `
              <div class="echo-attempt-pip ${i < attempts ? 'used' : 'available'}"></div>
            `).join('')}
          </div>
          <div class="echo-attempt-copy">${attempts}/${maxAttempts} used. ${attemptsLeft} remaining.${gameData.lastMove ? ` Last answer: "${escapeAttribute(gameData.lastMove)}".` : ''}</div>
          
          <div class="echo-answer-row">
            <input type="text" class="echo-answer-input" data-action="echo-input-change" value="${escapeAttribute(this.echoAnswer || '')}" placeholder="${isUsersTurn ? 'Type the answer the riddle wants...' : 'Waiting for the next trial turn...'}" ${!isUsersTurn ? 'disabled' : ''} />
            <button class="echo-submit-btn" data-action="echo-submit-direct" ${!isUsersTurn ? 'disabled' : ''}>Offer answer</button>
          </div>
        </div>
      </div>
    `;
    
    root.innerHTML = withThemeFrame(html, 'echo_trials', theme, isExpanded ? 'sv-theme-expanded' : '');
    const input = root.querySelector('.echo-answer-input');
    const submit = () => {
      const answer = String(input?.value || this.echoAnswer || "").trim();
      if (!answer) return;
      this.echoAnswer = answer;
      onMoveSubmit(answer);
    };
    if (input) {
      input.oninput = (event) => {
        this.echoAnswer = event.target.value || '';
      };
      input.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      };
    }
    bindClicks(root, '[data-action="echo-submit-direct"]', () => {
      submit();
    });

    // Focus on input
    setTimeout(() => {
      if (input) input.focus();
    }, 100);
  },

  renderTicTacToe(container, gameData, onMoveSubmit, isExpanded, theme = resolveGameTheme("tictactoe")) {
    const board = gameData.board || Array(9).fill(null);
    const winner = gameData.winner || null;
    const finished = Boolean(gameData.result || winner || board.every(Boolean));
    const isUsersTurn = !finished && gameData.turn === 'user';
    const userToken = resolveRuntimeTokenUrl("tictactoe", "user");
    const spiritToken = resolveRuntimeTokenUrl("tictactoe", "spiritkin");
    const root = resolveTarget(container);
    if (!root) return;
    const html = `
      <div class="sv-mini-game sv-ttt">
        <div class="sv-game-meta sv-ttt-meta">
          <div class="sv-game-kicker">Quick Pattern Duel</div>
          <div class="sv-game-copy">${isUsersTurn ? 'Place your next echo mark.' : 'The Spiritkin is resolving the next mark.'}</div>
        </div>
        <div class="sv-mini-grid sv-ttt-grid sv-visual-board">
          ${board.map((cell, idx) => `
            <button class="sv-mini-cell ttt-cell ${cell === 'X' ? 'mark-user' : cell === 'O' ? 'mark-spiritkin' : ''} ${gameData.lastMove === idx ? 'ttt-last-move' : ''}" data-action="ttt-cell-click" data-idx="${idx}" ${cell || !isUsersTurn ? "disabled" : ""}>
              ${cell ? `<span class="ttt-token ${cell === 'X' ? 'ttt-token-user' : 'ttt-token-spiritkin'}">${buildRuntimePieceImage(cell === "X" ? userToken : spiritToken, `${cell} token`, "ttt-token-image")}</span>` : ""}
            </button>
          `).join('')}
        </div>
        <div class="sv-mini-caption">${gameData.result?.isDraw ? 'The grid resolved into a draw.' : winner ? `${winner === 'X' ? 'You' : 'Spiritkin'} aligned the line.` : (isUsersTurn ? 'Claim three in a line.' : 'The Spiritkin is answering your last mark.')}</div>
      </div>
    `;
    root.innerHTML = withThemeFrame(html, 'tictactoe', theme, isExpanded ? 'sv-theme-expanded' : '');
    if (isExpanded) {
      bindClicks(root, '[data-action="ttt-cell-click"]', (element) => {
        const idx = element.dataset.idx;
        if (idx !== undefined && !element.disabled) onMoveSubmit(String(idx));
      });
    }
  },

  _renderConnectFourLegacy(container, gameData, onMoveSubmit, isExpanded, theme = resolveGameTheme("connect_four")) {
    const board = gameData.board || Array(42).fill(null);
    const finished = Boolean(gameData.result || gameData.winner || !board.includes(null));
    const isUsersTurn = !finished && gameData.turn === 'user';
    const root = resolveTarget(container);
    if (!root) return;
    const html = `
      <div class="sv-mini-game sv-connect4">
        <div class="sv-connect4-head">
          ${Array.from({ length: 7 }, (_, col) => `<button class="sv-connect4-drop" data-action="connect4-column-click" data-col="${col}" ${!isUsersTurn ? "disabled" : ""}>Drop</button>`).join('')}
        </div>
        <div class="sv-connect4-grid">
          ${board.map((cell, idx) => `<button class="sv-mini-cell connect4-cell ${cell === 'U' ? 'user' : cell === 'S' ? 'spiritkin' : ''}" data-action="connect4-column-click" data-col="${idx % 7}" ${finished ? "disabled" : ""}>${cell === 'U' ? '●' : cell === 'S' ? '◉' : ''}</button>`).join('')}
        </div>
        <div class="sv-mini-caption">${gameData.result?.isDraw ? 'The board filled into a draw.' : gameData.winner ? `${gameData.winner === 'U' ? 'You' : 'Spiritkin'} connected four.` : 'Drop a star into any column.'}</div>
      </div>
    `;
    root.innerHTML = withThemeFrame(html, 'connect_four', theme, isExpanded ? 'sv-theme-expanded' : '');
    if (isExpanded) {
      bindClicks(root, '[data-action="connect4-column-click"]', (element) => {
        const col = element.dataset.col;
        if (col !== undefined && !element.disabled) onMoveSubmit(String(col));
      });
    }
  },

  _renderBattleshipLegacy(container, gameData, onMoveSubmit, isExpanded, theme = resolveGameTheme("battleship")) {
    const guesses = new Set(gameData.userGuesses || []);
    const hits = new Set(gameData.hits?.user || []);
    const finished = Boolean(gameData.result || gameData.winner);
    const root = resolveTarget(container);
    if (!root) return;
    const html = `
      <div class="sv-mini-game sv-battleship">
        <div class="sv-battleship-grid sv-visual-board">
          ${Array.from({ length: 25 }, (_, idx) => {
            const guessed = guesses.has(idx);
            const hit = hits.has(idx);
            return `<button class="sv-mini-cell battleship-cell ${hit ? 'hit' : guessed ? 'miss' : ''}" data-action="battleship-cell-click" data-idx="${idx}" ${guessed || finished ? "disabled" : ""}>${hit ? '✦' : guessed ? '•' : ''}</button>`;
          }).join('')}
        </div>
        <div class="sv-mini-caption">${gameData.winner ? `${gameData.winner === 'user' ? 'You' : 'Spiritkin'} found every hidden vessel.` : 'Search the deep grid for the hidden fleet.'}</div>
      </div>
    `;
    root.innerHTML = withThemeFrame(html, 'battleship', theme, isExpanded ? 'sv-theme-expanded' : '');
    if (isExpanded) {
      bindClicks(root, '[data-action="battleship-cell-click"]', (element) => {
        const idx = element.dataset.idx;
        if (idx !== undefined && !element.disabled) onMoveSubmit(String(idx));
      });
    }
  },

  renderConnectFour(container, gameData, onMoveSubmit, isExpanded, theme = resolveGameTheme("connect_four")) {
    const board = gameData.board || Array(42).fill(null);
    const finished = Boolean(gameData.result || gameData.winner || !board.includes(null));
    const isUsersTurn = !finished && gameData.turn === 'user';
    const userToken = resolveRuntimeTokenUrl("connect_four", "user");
    const spiritToken = resolveRuntimeTokenUrl("connect_four", "spiritkin");
    const emptyToken = resolveRuntimeTokenUrl("connect_four", "empty");
    const winningLine = new Set(findConnectFourWinningLine(board));
    const lastDropIndex =
      gameData.lastMove && Number.isInteger(gameData.lastMove.col)
        ? (() => {
            const col = gameData.lastMove.col;
            for (let row = 0; row < 6; row++) {
              const idx = row * 7 + col;
              if (board[idx]) return idx;
            }
            return null;
          })()
        : null;
    const root = resolveTarget(container);
    if (!root) return;
    const html = `
      <div class="sv-mini-game sv-connect4">
        <div class="sv-game-meta sv-connect4-meta">
          <div class="sv-game-kicker">Constellation Drop</div>
          <div class="sv-game-copy">${isUsersTurn ? 'Choose a live column.' : 'The Spiritkin is weighing the constellation lanes.'}</div>
        </div>
        <div class="sv-connect4-head">
          ${Array.from({ length: 7 }, (_, col) => `<button class="sv-connect4-drop" data-action="connect4-column-click" data-col="${col}" ${!isUsersTurn ? "disabled" : ""}>Drop</button>`).join('')}
        </div>
        <div class="sv-connect4-grid sv-visual-board">
          ${board.map((cell, idx) => {
            const token =
              cell === 'U'
                ? `<span class="connect4-token connect4-token-user ${lastDropIndex === idx ? 'connect4-token-drop' : ''}" aria-hidden="true">${buildRuntimePieceImage(userToken, "User token", "connect4-token-image")}</span>`
                : cell === 'S'
                  ? `<span class="connect4-token connect4-token-spiritkin ${lastDropIndex === idx ? 'connect4-token-drop' : ''}" aria-hidden="true">${buildRuntimePieceImage(spiritToken, "Spiritkin token", "connect4-token-image")}</span>`
                  : `<span class="connect4-token connect4-token-empty" aria-hidden="true">${buildRuntimePieceImage(emptyToken, "Empty slot", "connect4-token-image")}</span>`;
            return `<button class="sv-mini-cell connect4-cell ${cell === 'U' ? 'user' : cell === 'S' ? 'spiritkin' : ''} ${lastDropIndex === idx ? 'connect4-last-drop' : ''} ${winningLine.has(idx) ? 'connect4-winning-cell' : ''}" data-action="connect4-column-click" data-col="${idx % 7}" ${!isUsersTurn ? "disabled" : ""}>${token}</button>`;
          }).join('')}
        </div>
        <div class="sv-mini-caption">${gameData.result?.isDraw ? 'The board filled into a draw.' : gameData.winner ? `${gameData.winner === 'U' ? 'You' : 'Spiritkin'} connected four.` : (isUsersTurn ? 'Drop a star into any column.' : 'The Spiritkin is reading the column structure.')}</div>
      </div>
    `;
    root.innerHTML = withThemeFrame(html, 'connect_four', theme, isExpanded ? 'sv-theme-expanded' : '');
    if (isExpanded) {
      bindClicks(root, '[data-action="connect4-column-click"]', (element) => {
        const col = element.dataset.col;
        if (col !== undefined && !element.disabled) onMoveSubmit(String(col));
      });
    }
  },

  renderBattleship(container, gameData, onMoveSubmit, isExpanded, theme = resolveGameTheme("battleship")) {
    const guesses = new Set(gameData.userGuesses || []);
    const hits = new Set(gameData.hits?.user || []);
    const finished = Boolean(gameData.result || gameData.winner);
    const isUsersTurn = !finished && gameData.turn === 'user';
    const hitMarker = resolveRuntimeTokenUrl("battleship", "user");
    const missMarker = resolveRuntimeTokenUrl("battleship", "spiritkin");
    const totalGuesses = guesses.size;
    const totalHits = hits.size;
    const lastStrike = Number.isInteger(gameData.lastMove) ? gameData.lastMove : null;
    const root = resolveTarget(container);
    if (!root) return;
    const html = `
      <div class="sv-mini-game sv-battleship">
        <div class="sv-battleship-shell">
          <div class="sv-game-meta sv-battleship-meta">
            <div class="sv-game-kicker">Forge Sonar</div>
            <div class="sv-game-copy">${isUsersTurn ? 'Choose one sector to scan.' : 'The Spiritkin is resolving your last strike through the forge mist.'}</div>
          </div>
          <div class="sv-battleship-status">
            <div class="sv-battleship-pill"><strong>${totalHits}</strong><span>Direct hits</span></div>
            <div class="sv-battleship-pill"><strong>${totalGuesses}</strong><span>Sectors scanned</span></div>
          </div>
        <div class="sv-battleship-grid sv-visual-board">
          ${Array.from({ length: 25 }, (_, idx) => {
            const guessed = guesses.has(idx);
            const hit = hits.has(idx);
            const marker = hit
              ? `<span class="battleship-marker battleship-marker-hit">${buildRuntimePieceImage(hitMarker, "Hit marker", "battleship-marker-image")}</span>`
              : guessed
                ? `<span class="battleship-marker battleship-marker-miss">${buildRuntimePieceImage(missMarker, "Miss marker", "battleship-marker-image")}</span>`
                : "";
            return `<button class="sv-mini-cell battleship-cell ${hit ? 'hit' : guessed ? 'miss' : ''}" data-action="battleship-cell-click" data-idx="${idx}" ${guessed || !isUsersTurn ? "disabled" : ""}>${marker}</button>`;
          }).join('')}
        </div>
        </div>
        <div class="sv-mini-caption">${gameData.winner ? `${gameData.winner === 'user' ? 'You' : 'Spiritkin'} found every hidden vessel.` : (isUsersTurn ? 'Search the deep grid for the hidden fleet.' : 'The deep grid is shifting while the Spiritkin answers your last strike.')}</div>
      </div>
    `;
    root.innerHTML = withThemeFrame(html, 'battleship', theme, isExpanded ? 'sv-theme-expanded' : '');
    if (Number.isInteger(lastStrike)) {
      const strikeCell = root.querySelector(`[data-action="battleship-cell-click"][data-idx="${lastStrike}"]`);
      if (strikeCell) {
        strikeCell.classList.add('battleship-last-strike');
      }
    }
    if (isExpanded) {
      bindClicks(root, '[data-action="battleship-cell-click"]', (element) => {
        const idx = element.dataset.idx;
        if (idx !== undefined && !element.disabled) onMoveSubmit(String(idx));
      });
    }
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

    if (this.checkers.selectedPiece == null) {
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

  reset(options = {}) {
    const { closeStage = true } = options;
    this.chess = { selectedSquare: null, validMoves: [], lastMove: null };
    this.checkers = { selectedPiece: null, validMoves: [] };
    this.echoAnswer = '';
    if (closeStage) GrandStage.close();
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

