const ACTIVE_ASSET_ROOT = "Spiritverse_MASTER_ASSETS/ACTIVE";
const ACTIVE_ASSET_PUBLIC_ROOT = "/app/assets";

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
      default: activeAsset("pieces", "chess_white_piece_family_v4a.png", {
        notes: "Wave 4A family crop used as premium shell support, not as direct board-piece runtime replacement."
      }),
      crown: activeAsset("pieces", "chess_white_piece_family_v4a.png"),
      veil: activeAsset("pieces", "chess_white_piece_family_v4a.png"),
      ember: activeAsset("pieces", "chess_white_piece_family_v4a.png"),
      astral: activeAsset("pieces", "chess_white_piece_family_v4a.png"),
      abyssal: activeAsset("pieces", "chess_white_piece_family_v4a.png")
    },
    cards: {
      default: activeAsset("pieces", "chess_dark_piece_family_v4a.png", {
        notes: "Wave 4A dark family crop used as support-layer shell art."
      })
    },
    room: {
      default: activeAsset("rooms", "room_chess_lyra_celestial_scene.png")
    },
    overlays: {
      moveGlow: activeAsset("fx", "chess_overlay_set_v4a.png", {
        notes: "Wave 4A overlay family used as shell FX overlay."
      })
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      check: activeAsset("ui", "chess_check_banner.png"),
      checkmate: activeAsset("ui", "chess_checkmate_banner.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png", {
        notes: "Wave 4B ornate board frame is the authoritative shared game frame."
      })
    },
    fallback: runtimeFallback("chess", "Current chess renderer uses inline SVG pieces and ACTIVE shell art.")
  },
  checkers: {
    label: "Checkers",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("boards", "checkers_board_dragonforge_base.png", {
        notes: "Dragonforge board base promoted into live runtime."
      })
    },
    pieces: {
      default: activeAsset("pieces", "checkers_piece_family_v4a.png", {
        notes: "Wave 4A checkers family crop used as shell accent support."
      }),
      user: activeAsset("pieces", "checkers-piece-white.png"),
      spiritkin: activeAsset("pieces", "checkers-piece-black.png"),
      userKing: activeAsset("pieces", "checkers-piece-white-king.png"),
      spiritkinKing: activeAsset("pieces", "checkers-piece-black-king.png"),
      king: activeAsset("pieces", "checkers-piece-white-king.png", {
        notes: "Wave 4B king render promoted for direct runtime use; renderer selects color-specific king slots."
      })
    },
    cards: {
      default: activeAsset("pieces", "checkers_pieces_set.png")
    },
    room: {
      default: activeAsset("rooms", "room_checkers_dragonforge_scene.png")
    },
    overlays: {
      selection: activeAsset("fx", "checkers-overlay-selected.png", {
        notes: "Wave 4B selected overlay replaces the earlier Wave 4A support marker."
      })
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "checkers_you_won_banner.png"),
      loss: activeAsset("ui", "checkers_you_lost_banner.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
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
      default: activeAsset("tokens", "tictactoe_token_family_v4a.png", {
        notes: "Wave 4A token family used as shell accent support."
      }),
      user: activeAsset("tokens", "tictactoe-x.png"),
      spiritkin: activeAsset("tokens", "tictactoe-o.png")
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
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("tictactoe", "Current tic-tac-toe renderer uses CSS cells over ACTIVE concept and room art.")
  },
  connect_four: {
    label: "Connect Four",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("boards", "connect4_board_waterfall_base.png", {
        notes: "Waterfall board base is the current live board shell."
      })
    },
    pieces: {
      default: activeAsset("tokens", "connect4-disc-empty.png", {
        notes: "Wave 4B empty slot disc is now the primary direct runtime placeholder token."
      }),
      user: activeAsset("tokens", "connect4-disc-yellow.png"),
      spiritkin: activeAsset("tokens", "connect4-disc-red.png"),
      empty: activeAsset("tokens", "connect4-disc-empty.png"),
      accent: activeAsset("tokens", "connect4-disc-empty.png")
    },
    cards: {
      default: activeAsset("tokens", "connect4_disc_set_v1.png")
    },
    room: {
      default: activeAsset("rooms", "room_connect4_waterfall_scene.png")
    },
    overlays: {
      dropTrail: activeAsset("fx", "connect4-overlay-hover.png", {
        notes: "Wave 4B column hover overlay replaces the interim Wave 4A FX family for direct board interaction."
      }),
      winLine: activeAsset("fx", "connect4-overlay-win.png", {
        notes: "Wave 4B win overlay used on resolved winning cells."
      })
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("connect_four", "Current connect-four renderer uses ACTIVE token discs and shell art.")
  },
  battleship: {
    label: "Battleship",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("concepts", "spiritverse_battleship_forge_theme.png", {
        notes: "Forge tactical concept art now serves as the primary battleship shell while the live grid remains readable above it."
      })
    },
    pieces: {
      default: activeAsset("ships", "battleship-ship-battleship.png", {
        notes: "Wave 4B isolated battleship-class ship is now the primary shell accent."
      }),
      shipSet: activeAsset("ships", "battleship-ship-carrier.png"),
      user: activeAsset("ships", "battleship-marker-hit.png"),
      spiritkin: activeAsset("ships", "battleship-marker-miss.png")
    },
    cards: {
      default: activeAsset("ships", "battleship-ship-cruiser.png", {
        notes: "Wave 4B cruiser fills the support card slot because the final pack delivers isolated ships rather than a family sheet."
      })
    },
    room: {
      default: activeAsset("rooms", "room_battleship_forge_scene.png")
    },
    overlays: {
      sonar: activeAsset("fx", "battleship_marker_family_v4a.png", {
        notes: "Wave 4A marker family used as support-layer sonar overlay."
      })
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("battleship", "Current battleship renderer uses CSS grid markers over ACTIVE forge scene art.")
  },
  spirit_cards: {
    label: "Spirit Cards",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("concepts", "Book Covers All.png", {
        notes: "Composite codex cover art now replaces the placeholder table as the primary Spirit Cards shell."
      })
    },
    pieces: {},
    cards: {
      default: activeAsset("concepts", "Spiritkins in spiritverse.png", {
        notes: "Founders scene enriches Spirit Cards as support art."
      }),
      backs: activeAsset("ui", "spirit_cards_back_placeholder.svg"),
      frames: activeAsset("ui", "spirit_cards_frame_placeholder.svg"),
      founderSet: activeAsset("ui", "spiritcore-spiritkins-portraits.png")
    },
    room: {
      default: activeAsset("concepts", "Spiritkins in spiritverse.png")
    },
    overlays: {},
    ui: {
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
    fallback: runtimeFallback("spirit_cards", "Current spirit-cards renderer uses placeholder card assets preserved in ACTIVE.")
  },
  echo_trials: {
    label: "Echo Trials",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("concepts", "spiritcore-architecture-layers.png", {
        notes: "Architecture layers concept art now serves as the primary Echo Trials shell."
      })
    },
    pieces: {},
    cards: {},
    room: {
      default: activeAsset("concepts", "Spiritverse_all_games_together_theme.png")
    },
    overlays: {},
    ui: {
      frame: activeAsset("ui", "modal_frame_premium.png")
    },
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
      default: activeAsset("tokens", "go-stone-white.png", {
        notes: "Wave 4B isolated stones replace interim v3 singles for direct runtime use."
      }),
      user: activeAsset("tokens", "go-stone-white.png"),
      spiritkin: activeAsset("tokens", "go-stone-black.png"),
      blackStone: activeAsset("tokens", "go-stone-black.png"),
      whiteStone: activeAsset("tokens", "go-stone-white.png")
    },
    cards: {
      default: activeAsset("tokens", "go_stone_family_v4a_left.png", {
        notes: "Wave 4A support sheet is preserved as shell art because Wave 4B only supplies isolated stones."
      })
    },
    room: {
      default: activeAsset("rooms", "room_go_aquatic_scene.png")
    },
    overlays: {
      hoshi: activeAsset("fx", "go-overlay-hint.png", {
        notes: "Wave 4B hint overlay replaces the earlier Wave 4A preview ring as the direct hover cue."
      })
    },
    ui: {
      yourMove: activeAsset("ui", "your_move_banner_v2.png"),
      thinking: activeAsset("ui", "spiritkin_thinking_banner_v1.png"),
      win: activeAsset("ui", "generic_you_won_banner_large.png"),
      loss: activeAsset("ui", "generic_you_lost_banner_large.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    fallback: runtimeFallback("go", "Current go renderer uses CSS stones over ACTIVE board and room art.")
  },
  grand_stage: {
    label: "Grand Stage",
    sourceRoot: ACTIVE_ASSET_ROOT,
    variants: ["default"],
    board: {
      default: activeAsset("concepts", "spiritcore-architecture-layers.png", {
        notes: "Grand Stage now uses architecture layers art as the primary platform shell."
      })
    },
    pieces: {},
    cards: {},
    room: {
      default: activeAsset("concepts", "Spiritverse_all_games_together_theme.png")
    },
    overlays: {
      spotlight: activeAsset("fx", "portal_beam_fx_blue_v1.png"),
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
    },
    ui: {
      frame: activeAsset("ui", "ui-board-frame-ornate.png")
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
