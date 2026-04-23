const ACTIVE_ASSET_ROOT = "Spiritverse_MASTER_ASSETS/ACTIVE";
const ACTIVE_ASSET_PUBLIC_ROOT = "/app/assets";
const GAME_THEME_ASSET_ROOT = "Spiritverse_MASTER_ASSETS/Game_Themes";
const GAME_THEME_ASSET_PUBLIC_ROOT = "/app/game-theme-assets";

function assetRecord(sourcePath, options = {}) {
  return {
    sourcePath,
    publicPath: options.publicPath || null,
    status: options.status || "active",
    notes: options.notes || "",
    fallbackAsset: options.fallbackAsset || null
  };
}

function runtimeFallback(type, notes) {
  return {
    type: "runtime",
    renderer: "inline-css-svg",
    fallbackKey: type,
    notes
  };
}

function activeAsset(category, relativePath, options = {}) {
  const normalizedCategory = String(category || "").replace(/\\/g, "/");
  const normalizedPath = String(relativePath || "").replace(/\\/g, "/");
  return assetRecord(`${ACTIVE_ASSET_ROOT}/${normalizedCategory}/${normalizedPath}`, {
    publicPath: `${ACTIVE_ASSET_PUBLIC_ROOT}/${normalizedCategory}/${normalizedPath}`,
    status: options.status || "active",
    notes: options.notes || "",
    fallbackAsset: options.fallbackAsset || null
  });
}

function gameThemeAsset(gameDir, category, filename, options = {}) {
  const normalizedGameDir = String(gameDir || "").replace(/\\/g, "/");
  const normalizedCategory = String(category || "").replace(/\\/g, "/");
  const normalizedFilename = String(filename || "").replace(/\\/g, "/");
  return assetRecord(`${GAME_THEME_ASSET_ROOT}/${normalizedGameDir}/${normalizedCategory}/${normalizedFilename}`, {
    publicPath: `${GAME_THEME_ASSET_PUBLIC_ROOT}/${encodeURIComponent(normalizedGameDir)}/${encodeURIComponent(normalizedCategory)}/${encodeURIComponent(normalizedFilename)}`,
    status: options.status || "live placeholder source",
    notes: options.notes || "",
    fallbackAsset: options.fallbackAsset || null
  });
}

function resolveAssetPublicPath(asset) {
  if (!asset) return null;
  if (asset.publicPath) return asset.publicPath;
  return asset.fallbackAsset?.publicPath || null;
}

const THEME_VARIANT_ENVIRONMENT = {
  crown: {
    room: activeAsset("ui", "spiritcore-media-hero.png"),
    accent: activeAsset("ui", "welcome_open.png")
  },
  archive: {
    room: activeAsset("concepts", "Solis.png"),
    accent: activeAsset("concepts", "Solis.png")
  },
  veil: {
    room: activeAsset("rooms", "room_chess_lyra_celestial_scene.png"),
    board: activeAsset("concepts", "spiritverse_chess_lyra_theme.png"),
    accent: activeAsset("ui", "lyra_close.png")
  },
  ember: {
    room: activeAsset("rooms", "room_battleship_forge_scene.png"),
    board: activeAsset("concepts", "spiritverse_battleship_forge_theme.png"),
    accent: activeAsset("ui", "kairo_close.png")
  },
  astral: {
    room: activeAsset("rooms", "room_connect4_waterfall_scene.png"),
    board: activeAsset("concepts", "spiritverse_connect_four_waterfall_theme.png"),
    accent: activeAsset("ui", "raien_close.png")
  },
  abyssal: {
    room: activeAsset("rooms", "room_go_aquatic_scene.png"),
    board: activeAsset("concepts", "spiritverse_go_aquatic_theme.png"),
    accent: activeAsset("concepts", "Neris.png")
  }
};

export const GAME_ASSET_MANIFEST = {
  chess: {
    label: "Chess",
    sourceRoot: GAME_THEME_ASSET_ROOT,
    variants: ["crown", "veil", "ember", "astral", "abyssal"],
    board: {
      default: gameThemeAsset("Chess", "boards", "chess_board_premium_placeholder.svg", {
        notes: "Premium board placeholder is now the primary named source file for chess.",
        fallbackAsset: activeAsset("boards", "chess_board_lyra_base.png", {
          notes: "ACTIVE chess board remains the live fallback if the premium placeholder is unavailable."
        })
      })
    },
    pieces: {
      default: activeAsset("pieces", "chess_white_piece_family_v4a.png", {
        notes: "Premium chess piece sheets still need final authored assets; runtime SVG pieces remain the functional fallback."
      }),
      crown: activeAsset("pieces", "chess_white_piece_family_v4a.png"),
      veil: activeAsset("pieces", "chess_white_piece_family_v4a.png"),
      ember: activeAsset("pieces", "chess_white_piece_family_v4a.png"),
      astral: activeAsset("pieces", "chess_white_piece_family_v4a.png"),
      abyssal: activeAsset("pieces", "chess_white_piece_family_v4a.png")
    },
    cards: {
      default: activeAsset("pieces", "chess_dark_piece_family_v4a.png", {
        notes: "Support-layer family art remains available for shell treatment."
      })
    },
    room: {
      default: gameThemeAsset("Chess", "room_backdrops", "chess_room_premium_placeholder.svg", {
        notes: "Premium chess chamber placeholder is now manifest-driven.",
        fallbackAsset: activeAsset("rooms", "room_chess_lyra_celestial_scene.png")
      })
    },
    overlays: {
      moveGlow: activeAsset("fx", "chess_overlay_set_v4a.png"),
      selected: activeAsset("fx", "chess-overlay-selected.png"),
      validMove: activeAsset("fx", "chess-overlay-valid-move.png"),
      capture: activeAsset("fx", "chess-overlay-capture.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      check: activeAsset("ui", "chess_check_banner.png"),
      checkmate: activeAsset("ui", "chess_checkmate_banner.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("chess", "Current chess renderer keeps inline SVG pieces as the no-regression fallback.")
  },
  checkers: {
    label: "Checkers",
    sourceRoot: GAME_THEME_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: gameThemeAsset("Checkers", "boards", "checkers_board_premium_placeholder.svg", {
        notes: "Premium checkers board placeholder is now the primary named source file.",
        fallbackAsset: activeAsset("boards", "checkers_board_dragonforge_base.png")
      })
    },
    pieces: {
      default: activeAsset("pieces", "checkers_piece_family_v4a.png"),
      user: activeAsset("pieces", "checkers-piece-white.png"),
      spiritkin: activeAsset("pieces", "checkers-piece-black.png"),
      userKing: activeAsset("pieces", "checkers-piece-white-king.png"),
      spiritkinKing: activeAsset("pieces", "checkers-piece-black-king.png"),
      king: activeAsset("pieces", "checkers-piece-white-king.png")
    },
    cards: {
      default: activeAsset("pieces", "checkers_pieces_set.png")
    },
    room: {
      default: gameThemeAsset("Checkers", "room_backdrops", "checkers_room_premium_placeholder.svg", {
        notes: "Premium checkers chamber placeholder is manifest-driven.",
        fallbackAsset: activeAsset("rooms", "room_checkers_dragonforge_scene.png")
      })
    },
    overlays: {
      selection: activeAsset("fx", "checkers-overlay-selected.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "checkers_you_won_banner.png"),
      loss: activeAsset("ui", "checkers_you_lost_banner.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("checkers", "Current checkers renderer keeps CSS disc styling if premium piece art is missing.")
  },
  tictactoe: {
    label: "TicTacToe of Echoes",
    sourceRoot: GAME_THEME_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: gameThemeAsset("TicTacToe_of_Echoes", "boards", "tictactoe_echoes_board_premium_placeholder.svg", {
        notes: "Premium TicTacToe board placeholder is now the primary named source file.",
        fallbackAsset: activeAsset("concepts", "spiritverse_tictactoe_forest_theme.png")
      })
    },
    pieces: {
      default: activeAsset("tokens", "tictactoe_token_family_v4a.png"),
      user: activeAsset("tokens", "tictactoe-x.png"),
      spiritkin: activeAsset("tokens", "tictactoe-o.png")
    },
    cards: {
      default: activeAsset("tokens", "tictactoe_tokens_forest_set.png")
    },
    room: {
      default: gameThemeAsset("TicTacToe_of_Echoes", "room_backdrops", "tictactoe_room_premium_placeholder.svg", {
        notes: "Premium TicTacToe room placeholder is manifest-driven.",
        fallbackAsset: activeAsset("rooms", "room_tictactoe_forest_scene.png")
      })
    },
    overlays: {
      winLine: activeAsset("fx", "tictactoe_glow_marks.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("tictactoe", "Current TicTacToe renderer keeps CSS grid and token fallbacks.")
  },
  connect_four: {
    label: "Connect Four",
    sourceRoot: GAME_THEME_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: gameThemeAsset("Connect_Four", "boards", "connect_four_board_premium_placeholder.svg", {
        notes: "Premium Connect Four board placeholder is now the primary named source file.",
        fallbackAsset: activeAsset("boards", "connect4_board_waterfall_base.png")
      })
    },
    pieces: {
      default: activeAsset("tokens", "connect4-disc-empty.png"),
      user: activeAsset("tokens", "connect4-disc-yellow.png"),
      spiritkin: activeAsset("tokens", "connect4-disc-red.png"),
      empty: activeAsset("tokens", "connect4-disc-empty.png"),
      accent: activeAsset("tokens", "connect4-disc-empty.png")
    },
    cards: {
      default: activeAsset("tokens", "connect4_disc_set_v1.png")
    },
    room: {
      default: gameThemeAsset("Connect_Four", "room_backdrops", "connect_four_room_premium_placeholder.svg", {
        notes: "Premium Connect Four room placeholder is manifest-driven.",
        fallbackAsset: activeAsset("rooms", "room_connect4_waterfall_scene.png")
      })
    },
    overlays: {
      dropTrail: activeAsset("fx", "connect4-overlay-hover.png"),
      winLine: activeAsset("fx", "connect4-overlay-win.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("connect_four", "Current Connect Four runtime keeps existing token and column interaction fallbacks.")
  },
  battleship: {
    label: "Battleship",
    sourceRoot: GAME_THEME_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: gameThemeAsset("Battleship", "boards", "battleship_grid_premium_placeholder.svg", {
        notes: "Premium Battleship grid placeholder is now the primary named source file.",
        fallbackAsset: activeAsset("concepts", "spiritverse_battleship_forge_theme.png")
      })
    },
    pieces: {
      default: activeAsset("ships", "battleship-ship-battleship.png"),
      shipSet: activeAsset("ships", "battleship-ship-carrier.png"),
      user: activeAsset("ships", "battleship-marker-hit.png"),
      spiritkin: activeAsset("ships", "battleship-marker-miss.png")
    },
    cards: {
      default: activeAsset("ships", "battleship-ship-cruiser.png")
    },
    room: {
      default: gameThemeAsset("Battleship", "room_backdrops", "battleship_room_premium_placeholder.svg", {
        notes: "Premium Battleship room placeholder is manifest-driven.",
        fallbackAsset: activeAsset("rooms", "room_battleship_forge_scene.png")
      })
    },
    overlays: {
      sonar: activeAsset("fx", "battleship_marker_family_v4a.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("battleship", "Current Battleship grid and markers remain the functional fallback layer.")
  },
  spirit_cards: {
    label: "Spirit Cards",
    sourceRoot: GAME_THEME_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: gameThemeAsset("Spirit_Cards", "boards", "spirit_cards_table_premium_placeholder.svg", {
        notes: "Premium Spirit Cards table placeholder is now the primary named source file.",
        fallbackAsset: activeAsset("concepts", "Book Covers All.png")
      })
    },
    pieces: {},
    cards: {
      default: gameThemeAsset("Spirit_Cards", "cards", "spirit_cards_founder_set_placeholder.svg", {
        notes: "Founder set placeholder now drives premium card treatment.",
        fallbackAsset: activeAsset("concepts", "Spiritkins in spiritverse.png")
      }),
      backs: gameThemeAsset("Spirit_Cards", "cards", "spirit_cards_back_placeholder.svg", {
        notes: "Manifest-driven premium placeholder for card backs.",
        fallbackAsset: activeAsset("ui", "spirit_cards_back_placeholder.svg")
      }),
      frames: gameThemeAsset("Spirit_Cards", "cards", "spirit_cards_frame_placeholder.svg", {
        notes: "Manifest-driven premium placeholder for card frames.",
        fallbackAsset: activeAsset("ui", "spirit_cards_frame_placeholder.svg")
      }),
      founderSet: gameThemeAsset("Spirit_Cards", "cards", "spirit_cards_founder_set_placeholder.svg", {
        notes: "Manifest-driven founder set placeholder.",
        fallbackAsset: activeAsset("ui", "spiritcore-spiritkins-portraits.png")
      })
    },
    room: {
      default: gameThemeAsset("Spirit_Cards", "room_backdrops", "spirit_cards_room_premium_placeholder.svg", {
        notes: "Premium Spirit Cards room placeholder is manifest-driven.",
        fallbackAsset: activeAsset("concepts", "Spiritkins in spiritverse.png")
      })
    },
    overlays: {},
    ui: {
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("spirit_cards", "Current Spirit Cards layout and game-state logic remain the fallback if premium card art is missing.")
  },
  echo_trials: {
    label: "Echo Trials",
    sourceRoot: GAME_THEME_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: gameThemeAsset("Echo_Trials", "boards", "echo_trials_panel_premium_placeholder.svg", {
        notes: "Premium Echo Trials panel placeholder is now the primary named source file.",
        fallbackAsset: activeAsset("concepts", "spiritcore-architecture-layers.png")
      })
    },
    pieces: {},
    cards: {},
    room: {
      default: gameThemeAsset("Echo_Trials", "room_backdrops", "echo_trials_room_premium_placeholder.svg", {
        notes: "Premium Echo Trials room placeholder is manifest-driven.",
        fallbackAsset: activeAsset("concepts", "Spiritverse_all_games_together_theme.png")
      })
    },
    overlays: {},
    ui: {
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("echo_trials", "Current Echo Trials panel/input renderer remains active if premium assets are missing.")
  },
  go: {
    label: "Go",
    sourceRoot: GAME_THEME_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: gameThemeAsset("Go", "boards", "go_board_premium_placeholder.svg", {
        notes: "Premium Go board placeholder is now the primary named source file.",
        fallbackAsset: activeAsset("boards", "go_board_aquatic_base.png")
      })
    },
    pieces: {
      default: activeAsset("tokens", "go-stone-white.png"),
      user: activeAsset("tokens", "go-stone-white.png"),
      spiritkin: activeAsset("tokens", "go-stone-black.png"),
      blackStone: activeAsset("tokens", "go-stone-black.png"),
      whiteStone: activeAsset("tokens", "go-stone-white.png")
    },
    cards: {
      default: activeAsset("tokens", "go_stone_family_v4a_left.png")
    },
    room: {
      default: gameThemeAsset("Go", "room_backdrops", "go_room_premium_placeholder.svg", {
        notes: "Premium Go room placeholder is manifest-driven.",
        fallbackAsset: activeAsset("rooms", "room_go_aquatic_scene.png")
      })
    },
    overlays: {
      hoshi: activeAsset("fx", "go-overlay-hint.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("go", "Current Go intersections and stones remain the functional fallback layer.")
  },
  grand_stage: {
    label: "Grand Stage",
    sourceRoot: GAME_THEME_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: gameThemeAsset("Grand_Stage", "boards", "grand_stage_platform_premium_placeholder.svg", {
        notes: "Premium Grand Stage platform placeholder is now the primary named source file.",
        fallbackAsset: activeAsset("concepts", "spiritcore-architecture-layers.png")
      })
    },
    pieces: {},
    cards: {},
    room: {
      default: gameThemeAsset("Grand_Stage", "room_backdrops", "grand_stage_room_premium_placeholder.svg", {
        notes: "Premium Grand Stage room placeholder is manifest-driven.",
        fallbackAsset: activeAsset("concepts", "Spiritverse_all_games_together_theme.png")
      })
    },
    overlays: {
      spotlight: activeAsset("fx", "portal_beam_fx_blue_v1.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    ui: {
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("grand_stage", "Grand Stage keeps the existing fullscreen shell if premium platform art is missing.")
  }
};

const GAME_TYPE_ALIASES = {
  "spirit-cards": "spirit_cards",
  "echo-trials": "echo_trials",
  tic_tac_toe: "tictactoe",
  grandstage: "grand_stage"
};

export function normalizeGameAssetType(gameType) {
  const key = String(gameType || "").trim().toLowerCase();
  return GAME_TYPE_ALIASES[key] || key;
}

export function getGameAssetPackage(gameType) {
  const normalized = normalizeGameAssetType(gameType);
  const entry = GAME_ASSET_MANIFEST[normalized] || null;
  if (!entry) return null;
  return {
    gameType: normalized,
    ...entry
  };
}

export function resolveGameAsset(gameType, slot, variant = "default") {
  const assetPackage = getGameAssetPackage(gameType);
  if (!assetPackage || !slot) return null;
  const slotEntries = assetPackage[slot];
  if (!slotEntries || typeof slotEntries !== "object") return null;
  return slotEntries[variant] || slotEntries.default || null;
}

export function resolveGameAssetUrl(gameType, slot, variant = "default") {
  return resolveAssetPublicPath(resolveGameAsset(gameType, slot, variant));
}

export function resolveGameThemeEnvironment(variant) {
  const key = String(variant || "").trim().toLowerCase();
  const environment = THEME_VARIANT_ENVIRONMENT[key];
  if (!environment) return null;
  return {
    room: environment.room || null,
    board: environment.board || null,
    accent: environment.accent || null
  };
}

export function listGameAssetInventory() {
  return Object.entries(GAME_ASSET_MANIFEST).map(([gameType, entry]) => {
    const implemented = [];
    for (const [slotName, slotEntries] of Object.entries({
      board: entry.board,
      pieces: entry.pieces,
      cards: entry.cards,
      room: entry.room,
      overlays: entry.overlays,
      ui: entry.ui
    })) {
      if (!slotEntries || typeof slotEntries !== "object") continue;
      for (const asset of Object.values(slotEntries)) {
        if (!asset) continue;
        const assetName = asset.sourcePath?.split("/").pop() || "";
        implemented.push(`${slotName}:${assetName}`);
      }
    }
    return {
      gameType,
      label: entry.label,
      sourceRoot: entry.sourceRoot,
      implemented
    };
  });
}
