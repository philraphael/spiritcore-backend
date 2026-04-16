const GAME_THEME_ROOT = "Spiritverse_MASTER_ASSETS/Game_Themes";

function assetRecord(sourcePath, options = {}) {
  return {
    sourcePath,
    publicPath: options.publicPath || null,
    status: options.status || "needed",
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

export const GAME_ASSET_MANIFEST = {
  chess: {
    label: "Chess",
    sourceRoot: `${GAME_THEME_ROOT}/Chess`,
    variants: ["crown", "veil", "ember", "astral", "abyssal"],
    board: {
      default: assetRecord(`${GAME_THEME_ROOT}/Chess/boards/chess_board_master.png`, {
        notes: "Primary premium chess board artwork."
      })
    },
    pieces: {
      crown: assetRecord(`${GAME_THEME_ROOT}/Chess/pieces_tokens/chess_pieces_crown_master.svg`, {
        notes: "Full piece sheet or individually exported set for crown variant."
      }),
      veil: assetRecord(`${GAME_THEME_ROOT}/Chess/pieces_tokens/chess_pieces_veil_master.svg`),
      ember: assetRecord(`${GAME_THEME_ROOT}/Chess/pieces_tokens/chess_pieces_ember_master.svg`),
      astral: assetRecord(`${GAME_THEME_ROOT}/Chess/pieces_tokens/chess_pieces_astral_master.svg`),
      abyssal: assetRecord(`${GAME_THEME_ROOT}/Chess/pieces_tokens/chess_pieces_abyssal_master.svg`)
    },
    cards: {},
    room: {
      default: assetRecord(`${GAME_THEME_ROOT}/Chess/room_backdrops/chess_room_master.png`, {
        notes: "Board-side environment or table scene."
      })
    },
    overlays: {
      moveGlow: assetRecord(`${GAME_THEME_ROOT}/Chess/overlays_effects/chess_move_glow_overlay.png`)
    },
    fallback: runtimeFallback("chess", "Current chess renderer uses inline SVG pieces and CSS board themes.")
  },
  checkers: {
    label: "Checkers",
    sourceRoot: `${GAME_THEME_ROOT}/Checkers`,
    variants: ["default"],
    board: {
      default: assetRecord(`${GAME_THEME_ROOT}/Checkers/boards/checkers_board_master.png`)
    },
    pieces: {
      user: assetRecord(`${GAME_THEME_ROOT}/Checkers/pieces_tokens/checkers_piece_user_master.png`),
      spiritkin: assetRecord(`${GAME_THEME_ROOT}/Checkers/pieces_tokens/checkers_piece_spiritkin_master.png`),
      king: assetRecord(`${GAME_THEME_ROOT}/Checkers/pieces_tokens/checkers_piece_king_overlay.png`)
    },
    cards: {},
    room: {
      default: assetRecord(`${GAME_THEME_ROOT}/Checkers/room_backdrops/checkers_room_master.png`)
    },
    overlays: {
      selection: assetRecord(`${GAME_THEME_ROOT}/Checkers/overlays_effects/checkers_selection_overlay.png`)
    },
    fallback: runtimeFallback("checkers", "Current checkers renderer uses CSS discs and board gradients.")
  },
  tictactoe: {
    label: "TicTacToe of Echoes",
    sourceRoot: `${GAME_THEME_ROOT}/TicTacToe_of_Echoes`,
    variants: ["default"],
    board: {
      default: assetRecord(`${GAME_THEME_ROOT}/TicTacToe_of_Echoes/boards/tictactoe_echoes_board_master.png`)
    },
    pieces: {
      user: assetRecord(`${GAME_THEME_ROOT}/TicTacToe_of_Echoes/pieces_tokens/tictactoe_user_mark_master.svg`),
      spiritkin: assetRecord(`${GAME_THEME_ROOT}/TicTacToe_of_Echoes/pieces_tokens/tictactoe_spiritkin_mark_master.svg`)
    },
    cards: {},
    room: {
      default: assetRecord(`${GAME_THEME_ROOT}/TicTacToe_of_Echoes/room_backdrops/tictactoe_room_master.png`)
    },
    overlays: {
      winLine: assetRecord(`${GAME_THEME_ROOT}/TicTacToe_of_Echoes/overlays_effects/tictactoe_winline_overlay.svg`)
    },
    fallback: runtimeFallback("tictactoe", "Current tic-tac-toe renderer uses CSS board cells and text marks.")
  },
  connect_four: {
    label: "Connect Four",
    sourceRoot: `${GAME_THEME_ROOT}/Connect_Four`,
    variants: ["default"],
    board: {
      default: assetRecord(`${GAME_THEME_ROOT}/Connect_Four/boards/connect_four_board_master.png`)
    },
    pieces: {
      user: assetRecord(`${GAME_THEME_ROOT}/Connect_Four/pieces_tokens/connect_four_disc_user_master.png`),
      spiritkin: assetRecord(`${GAME_THEME_ROOT}/Connect_Four/pieces_tokens/connect_four_disc_spiritkin_master.png`)
    },
    cards: {},
    room: {
      default: assetRecord(`${GAME_THEME_ROOT}/Connect_Four/room_backdrops/connect_four_room_master.png`)
    },
    overlays: {
      dropTrail: assetRecord(`${GAME_THEME_ROOT}/Connect_Four/overlays_effects/connect_four_drop_trail_overlay.png`)
    },
    fallback: runtimeFallback("connect_four", "Current connect-four renderer uses CSS board framing and colored tokens.")
  },
  battleship: {
    label: "Battleship",
    sourceRoot: `${GAME_THEME_ROOT}/Battleship`,
    variants: ["default"],
    board: {
      default: assetRecord(`${GAME_THEME_ROOT}/Battleship/boards/battleship_grid_master.png`)
    },
    pieces: {
      shipSet: assetRecord(`${GAME_THEME_ROOT}/Battleship/pieces_tokens/battleship_shipset_master.svg`),
      hitMarker: assetRecord(`${GAME_THEME_ROOT}/Battleship/pieces_tokens/battleship_hit_marker_master.svg`),
      missMarker: assetRecord(`${GAME_THEME_ROOT}/Battleship/pieces_tokens/battleship_miss_marker_master.svg`)
    },
    cards: {},
    room: {
      default: assetRecord(`${GAME_THEME_ROOT}/Battleship/room_backdrops/battleship_room_master.png`)
    },
    overlays: {
      sonar: assetRecord(`${GAME_THEME_ROOT}/Battleship/overlays_effects/battleship_sonar_overlay.png`)
    },
    fallback: runtimeFallback("battleship", "Current battleship renderer uses CSS grid and marker states.")
  },
  spirit_cards: {
    label: "Spirit Cards",
    sourceRoot: `${GAME_THEME_ROOT}/Spirit_Cards`,
    variants: ["default"],
    board: {
      default: assetRecord(`${GAME_THEME_ROOT}/Spirit_Cards/boards/spirit_cards_table_master.png`)
    },
    pieces: {},
    cards: {
      backs: assetRecord(`${GAME_THEME_ROOT}/Spirit_Cards/cards/spirit_cards_back_master.png`),
      frames: assetRecord(`${GAME_THEME_ROOT}/Spirit_Cards/cards/spirit_cards_frame_master.png`),
      founderSet: assetRecord(`${GAME_THEME_ROOT}/Spirit_Cards/cards/spirit_cards_founder_set_master.png`, {
        notes: "Canon card faces or atlas."
      })
    },
    room: {
      default: assetRecord(`${GAME_THEME_ROOT}/Spirit_Cards/room_backdrops/spirit_cards_room_master.png`)
    },
    overlays: {
      aura: assetRecord(`${GAME_THEME_ROOT}/Spirit_Cards/overlays_effects/spirit_cards_aura_overlay.png`)
    },
    fallback: runtimeFallback("spirit_cards", "Current spirit-cards renderer uses CSS tiles and glyphs.")
  },
  echo_trials: {
    label: "Echo Trials",
    sourceRoot: `${GAME_THEME_ROOT}/Echo_Trials`,
    variants: ["default"],
    board: {
      default: assetRecord(`${GAME_THEME_ROOT}/Echo_Trials/boards/echo_trials_panel_master.png`)
    },
    pieces: {
      glyphs: assetRecord(`${GAME_THEME_ROOT}/Echo_Trials/pieces_tokens/echo_trials_glyph_set_master.svg`)
    },
    cards: {
      promptDeck: assetRecord(`${GAME_THEME_ROOT}/Echo_Trials/cards/echo_trials_prompt_cards_master.png`)
    },
    room: {
      default: assetRecord(`${GAME_THEME_ROOT}/Echo_Trials/room_backdrops/echo_trials_room_master.png`)
    },
    overlays: {
      resonance: assetRecord(`${GAME_THEME_ROOT}/Echo_Trials/overlays_effects/echo_trials_resonance_overlay.png`)
    },
    fallback: runtimeFallback("echo_trials", "Current echo-trials renderer uses HTML/CSS prompt panels.")
  },
  go: {
    label: "Go",
    sourceRoot: `${GAME_THEME_ROOT}/Go`,
    variants: ["default"],
    board: {
      default: assetRecord(`${GAME_THEME_ROOT}/Go/boards/go_board_master.png`)
    },
    pieces: {
      blackStone: assetRecord(`${GAME_THEME_ROOT}/Go/pieces_tokens/go_black_stone_master.png`),
      whiteStone: assetRecord(`${GAME_THEME_ROOT}/Go/pieces_tokens/go_white_stone_master.png`)
    },
    cards: {},
    room: {
      default: assetRecord(`${GAME_THEME_ROOT}/Go/room_backdrops/go_room_master.png`)
    },
    overlays: {
      hoshi: assetRecord(`${GAME_THEME_ROOT}/Go/overlays_effects/go_hoshi_overlay.svg`)
    },
    fallback: runtimeFallback("go", "Current go renderer uses CSS intersections and stone gradients.")
  },
  grand_stage: {
    label: "Grand Stage",
    sourceRoot: `${GAME_THEME_ROOT}/Grand_Stage`,
    variants: ["default"],
    board: {
      default: assetRecord(`${GAME_THEME_ROOT}/Grand_Stage/boards/grand_stage_platform_master.png`)
    },
    pieces: {},
    cards: {},
    room: {
      default: assetRecord(`${GAME_THEME_ROOT}/Grand_Stage/room_backdrops/grand_stage_room_master.png`)
    },
    overlays: {
      spotlight: assetRecord(`${GAME_THEME_ROOT}/Grand_Stage/overlays_effects/grand_stage_spotlight_overlay.png`),
      frame: assetRecord(`${GAME_THEME_ROOT}/Grand_Stage/overlays_effects/grand_stage_frame_overlay.png`)
    },
    fallback: runtimeFallback("grand_stage", "Current grand-stage experience uses CSS fullscreen shell and existing board renderer output.")
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

export function listGameAssetInventory() {
  return Object.entries(GAME_ASSET_MANIFEST).map(([gameType, entry]) => ({
    gameType,
    label: entry.label,
    sourceRoot: entry.sourceRoot,
    needed: [
      ...(entry.board && Object.keys(entry.board).length ? ["board art"] : []),
      ...(entry.pieces && Object.keys(entry.pieces).length ? ["pieces or tokens"] : []),
      ...(entry.cards && Object.keys(entry.cards).length ? ["card art"] : []),
      ...(entry.room && Object.keys(entry.room).length ? ["room or backdrop"] : []),
      ...(entry.overlays && Object.keys(entry.overlays).length ? ["overlays or effects"] : [])
    ]
  }));
}
