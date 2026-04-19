const ACTIVE_ASSET_ROOT = "Spiritverse_MASTER_ASSETS/ACTIVE";
const ACTIVE_ASSET_PUBLIC_ROOT = "/app/active-assets";

function assetRecord(sourcePath, options = {}) {
  return {
    sourcePath,
    publicPath: options.publicPath || null,
    status: options.status || "active",
    notes: options.notes || ""
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
    notes: options.notes || ""
  });
}

export const GAME_ASSET_MANIFEST = {
  chess: {
    label: "Chess",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["crown", "veil", "ember", "astral", "abyssal"],
    board: {
      default: activeAsset("boards", "chess_board_lyra_base.png", {
        notes: "Canonical premium-active chess board surface."
      })
    },
    pieces: {
      default: activeAsset("pieces", "chess_pieces_set.png"),
      crown: activeAsset("pieces", "chess_pieces_set.png"),
      veil: activeAsset("pieces", "chess_pieces_set.png"),
      ember: activeAsset("pieces", "chess_pieces_set.png"),
      astral: activeAsset("pieces", "chess_pieces_set.png"),
      abyssal: activeAsset("pieces", "chess_pieces_set.png")
    },
    cards: {
      default: activeAsset("pieces", "chess_piece_lineup_alt_v2.png")
    },
    room: {
      default: activeAsset("rooms", "room_chess_lyra_celestial_scene.png")
    },
    overlays: {
      moveGlow: activeAsset("fx", "move_highlight_ring_blue_v1.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      check: activeAsset("ui", "chess_check_banner.png"),
      checkmate: activeAsset("ui", "chess_checkmate_banner.png"),
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("chess", "Current chess renderer uses inline SVG pieces and ACTIVE shell art.")
  },
  checkers: {
    label: "Checkers",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("boards", "checkers_board_base_v1.png")
    },
    pieces: {
      default: activeAsset("pieces", "checkers_piece_set_alt_v2.png"),
      user: activeAsset("pieces", "checkers_piece_set_alt_v2.png"),
      spiritkin: activeAsset("pieces", "checkers_piece_set_alt_v2.png"),
      king: activeAsset("pieces", "checkers_piece_set_alt_v2.png")
    },
    cards: {
      default: activeAsset("pieces", "checkers_pieces_set.png")
    },
    room: {
      default: activeAsset("rooms", "room_checkers_dragonforge_scene.png")
    },
    overlays: {
      selection: activeAsset("fx", "move_highlight_ring_gold_v2.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "checkers_you_won_banner.png"),
      loss: activeAsset("ui", "checkers_you_lost_banner.png"),
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("checkers", "Current checkers renderer uses CSS discs over ACTIVE board and room art.")
  },
  tictactoe: {
    label: "TicTacToe of Echoes",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("concepts", "spiritverse_tictactoe_forest_theme.png", {
        notes: "Concept-board layer remains the best available active asset for TicTacToe."
      })
    },
    pieces: {
      default: activeAsset("tokens", "tictactoe_token_set_v1.png"),
      user: activeAsset("tokens", "tictactoe_token_set_v1.png"),
      spiritkin: activeAsset("tokens", "tictactoe_token_set_v1.png")
    },
    cards: {
      default: activeAsset("tokens", "tictactoe_tokens_forest_set.png")
    },
    room: {
      default: activeAsset("rooms", "room_tictactoe_forest_scene.png")
    },
    overlays: {
      winLine: activeAsset("fx", "tictactoe_glow_marks.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("tictactoe", "Current tic-tac-toe renderer uses CSS cells over ACTIVE concept and room art.")
  },
  connect_four: {
    label: "Connect Four",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("boards", "connect4_board_base_v1.png")
    },
    pieces: {
      user: activeAsset("tokens", "connect4_disc_blue.png"),
      spiritkin: activeAsset("tokens", "connect4_disc_purple.png"),
      accent: activeAsset("tokens", "connect4_disc_darkblue.png")
    },
    cards: {
      default: activeAsset("tokens", "connect4_disc_set_v1.png")
    },
    room: {
      default: activeAsset("rooms", "room_connect4_waterfall_scene.png")
    },
    overlays: {
      dropTrail: activeAsset("fx", "portal_beam_fx_blue_v1.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("connect_four", "Current connect-four renderer uses ACTIVE token discs and shell art.")
  },
  battleship: {
    label: "Battleship",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("concepts", "spiritverse_battleship_forge_theme.png", {
        notes: "Battleship still relies on a scene surface because there is no isolated final grid board asset."
      })
    },
    pieces: {
      shipSet: activeAsset("ships", "battleship_ship_set_v2.png")
    },
    cards: {
      default: activeAsset("ships", "battleship_forge_ships_set.png")
    },
    room: {
      default: activeAsset("rooms", "room_battleship_forge_scene.png")
    },
    overlays: {
      sonar: activeAsset("fx", "portal_beam_fx_blue_v1.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("battleship", "Current battleship renderer uses CSS grid markers over ACTIVE forge scene art.")
  },
  spirit_cards: {
    label: "Spirit Cards",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("boards", "spirit_cards_table_premium_placeholder.svg")
    },
    pieces: {},
    cards: {
      backs: activeAsset("ui", "spirit_cards_back_placeholder.svg"),
      frames: activeAsset("ui", "spirit_cards_frame_placeholder.svg"),
      founderSet: activeAsset("ui", "spirit_cards_founder_set_placeholder.svg")
    },
    room: {
      default: activeAsset("rooms", "spirit_cards_room_premium_placeholder.svg")
    },
    overlays: {},
    fallback: runtimeFallback("spirit_cards", "Current spirit-cards renderer uses placeholder card assets preserved in ACTIVE.")
  },
  echo_trials: {
    label: "Echo Trials",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("boards", "echo_trials_panel_premium_placeholder.svg")
    },
    pieces: {},
    cards: {},
    room: {
      default: activeAsset("rooms", "echo_trials_room_premium_placeholder.svg")
    },
    overlays: {},
    fallback: runtimeFallback("echo_trials", "Current echo-trials renderer uses placeholder ACTIVE shell assets.")
  },
  go: {
    label: "Go",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("boards", "go_board_aquatic_base.png")
    },
    pieces: {
      default: activeAsset("tokens", "go_stones_set_v2.png"),
      blackStone: activeAsset("tokens", "go_stones_set_v2.png"),
      whiteStone: activeAsset("tokens", "go_stones_set_v2.png")
    },
    cards: {
      default: activeAsset("tokens", "go_stone_layout_preview_v1.png")
    },
    room: {
      default: activeAsset("rooms", "room_go_aquatic_scene.png")
    },
    overlays: {
      hoshi: activeAsset("fx", "move_highlight_ring_gold_v2.png")
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("go", "Current go renderer uses CSS stones over ACTIVE board and room art.")
  },
  grand_stage: {
    label: "Grand Stage",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("boards", "grand_stage_platform_premium_placeholder.svg")
    },
    pieces: {},
    cards: {},
    room: {
      default: activeAsset("concepts", "full_asset_sheet_reference.png")
    },
    overlays: {
      spotlight: activeAsset("fx", "portal_beam_fx_blue_v1.png"),
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    ui: {
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("grand_stage", "Current grand-stage experience uses ACTIVE fullscreen shell assets.")
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
  return resolveGameAsset(gameType, slot, variant)?.publicPath || null;
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
        implemented.push(`${slotName}:${asset.sourcePath.split("/").pop()}`);
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
