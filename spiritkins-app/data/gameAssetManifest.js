const GAME_THEME_ROOT = "Spiritverse_MASTER_ASSETS/Game_Themes";
const GAME_THEME_PUBLIC_ROOT = "/app/game-theme-assets";

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

function sourceAsset(relativePath, options = {}) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  return assetRecord(`${GAME_THEME_ROOT}/${normalized}`, {
    publicPath: `${GAME_THEME_PUBLIC_ROOT}/${normalized}`,
    status: options.status || "placeholder-source",
    notes: options.notes || ""
  });
}

function plannedAsset(relativePath, options = {}) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  return assetRecord(`${GAME_THEME_ROOT}/${normalized}`, {
    status: options.status || "needed",
    notes: options.notes || ""
  });
}

export const GAME_ASSET_MANIFEST = {
  chess: {
    label: "Chess",
    sourceRoot: `${GAME_THEME_ROOT}/Chess`,
    variants: ["crown", "veil", "ember", "astral", "abyssal"],
    board: {
      default: sourceAsset("Chess/boards/chess_board_premium_placeholder.svg", {
        notes: "Named premium rollout placeholder. Replace with final chess board master art when ready."
      })
    },
    pieces: {
      crown: plannedAsset("Chess/pieces_tokens/chess_pieces_crown_master.svg"),
      veil: plannedAsset("Chess/pieces_tokens/chess_pieces_veil_master.svg"),
      ember: plannedAsset("Chess/pieces_tokens/chess_pieces_ember_master.svg"),
      astral: plannedAsset("Chess/pieces_tokens/chess_pieces_astral_master.svg"),
      abyssal: plannedAsset("Chess/pieces_tokens/chess_pieces_abyssal_master.svg")
    },
    cards: {},
    room: {
      default: sourceAsset("Chess/room_backdrops/chess_room_premium_placeholder.svg", {
        notes: "Named premium rollout placeholder for chess environment."
      })
    },
    overlays: {
      moveGlow: plannedAsset("Chess/overlays_effects/chess_move_glow_overlay.png")
    },
    fallback: runtimeFallback("chess", "Current chess renderer uses inline SVG pieces and CSS board themes.")
  },
  checkers: {
    label: "Checkers",
    sourceRoot: `${GAME_THEME_ROOT}/Checkers`,
    variants: ["default"],
    board: {
      default: sourceAsset("Checkers/boards/checkers_board_premium_placeholder.svg")
    },
    pieces: {
      user: plannedAsset("Checkers/pieces_tokens/checkers_piece_user_master.png"),
      spiritkin: plannedAsset("Checkers/pieces_tokens/checkers_piece_spiritkin_master.png"),
      king: plannedAsset("Checkers/pieces_tokens/checkers_piece_king_overlay.png")
    },
    cards: {},
    room: {
      default: sourceAsset("Checkers/room_backdrops/checkers_room_premium_placeholder.svg")
    },
    overlays: {
      selection: plannedAsset("Checkers/overlays_effects/checkers_selection_overlay.png")
    },
    fallback: runtimeFallback("checkers", "Current checkers renderer uses CSS discs and board gradients.")
  },
  tictactoe: {
    label: "TicTacToe of Echoes",
    sourceRoot: `${GAME_THEME_ROOT}/TicTacToe_of_Echoes`,
    variants: ["default"],
    board: {
      default: sourceAsset("TicTacToe_of_Echoes/boards/tictactoe_echoes_board_premium_placeholder.svg")
    },
    pieces: {
      user: plannedAsset("TicTacToe_of_Echoes/pieces_tokens/tictactoe_user_mark_master.svg"),
      spiritkin: plannedAsset("TicTacToe_of_Echoes/pieces_tokens/tictactoe_spiritkin_mark_master.svg")
    },
    cards: {},
    room: {
      default: sourceAsset("TicTacToe_of_Echoes/room_backdrops/tictactoe_room_premium_placeholder.svg")
    },
    overlays: {
      winLine: plannedAsset("TicTacToe_of_Echoes/overlays_effects/tictactoe_winline_overlay.svg")
    },
    fallback: runtimeFallback("tictactoe", "Current tic-tac-toe renderer uses CSS board cells and text marks.")
  },
  connect_four: {
    label: "Connect Four",
    sourceRoot: `${GAME_THEME_ROOT}/Connect_Four`,
    variants: ["default"],
    board: {
      default: sourceAsset("Connect_Four/boards/connect_four_board_premium_placeholder.svg")
    },
    pieces: {
      user: plannedAsset("Connect_Four/pieces_tokens/connect_four_disc_user_master.png"),
      spiritkin: plannedAsset("Connect_Four/pieces_tokens/connect_four_disc_spiritkin_master.png")
    },
    cards: {},
    room: {
      default: sourceAsset("Connect_Four/room_backdrops/connect_four_room_premium_placeholder.svg")
    },
    overlays: {
      dropTrail: plannedAsset("Connect_Four/overlays_effects/connect_four_drop_trail_overlay.png")
    },
    fallback: runtimeFallback("connect_four", "Current connect-four renderer uses CSS board framing and colored tokens.")
  },
  battleship: {
    label: "Battleship",
    sourceRoot: `${GAME_THEME_ROOT}/Battleship`,
    variants: ["default"],
    board: {
      default: sourceAsset("Battleship/boards/battleship_grid_premium_placeholder.svg")
    },
    pieces: {
      shipSet: plannedAsset("Battleship/pieces_tokens/battleship_shipset_master.svg"),
      hitMarker: plannedAsset("Battleship/pieces_tokens/battleship_hit_marker_master.svg"),
      missMarker: plannedAsset("Battleship/pieces_tokens/battleship_miss_marker_master.svg")
    },
    cards: {},
    room: {
      default: sourceAsset("Battleship/room_backdrops/battleship_room_premium_placeholder.svg")
    },
    overlays: {
      sonar: plannedAsset("Battleship/overlays_effects/battleship_sonar_overlay.png")
    },
    fallback: runtimeFallback("battleship", "Current battleship renderer uses CSS grid and marker states.")
  },
  spirit_cards: {
    label: "Spirit Cards",
    sourceRoot: `${GAME_THEME_ROOT}/Spirit_Cards`,
    variants: ["default"],
    board: {
      default: sourceAsset("Spirit_Cards/boards/spirit_cards_table_premium_placeholder.svg")
    },
    pieces: {},
    cards: {
      backs: sourceAsset("Spirit_Cards/cards/spirit_cards_back_placeholder.svg", {
        notes: "Placeholder named card back. Replace with final premium card back art."
      }),
      frames: sourceAsset("Spirit_Cards/cards/spirit_cards_frame_placeholder.svg", {
        notes: "Placeholder named card frame. Replace with final premium frame art."
      }),
      founderSet: sourceAsset("Spirit_Cards/cards/spirit_cards_founder_set_placeholder.svg", {
        notes: "Placeholder founder set atlas. Replace with canon founder card faces."
      })
    },
    room: {
      default: sourceAsset("Spirit_Cards/room_backdrops/spirit_cards_room_premium_placeholder.svg")
    },
    overlays: {
      aura: plannedAsset("Spirit_Cards/overlays_effects/spirit_cards_aura_overlay.png")
    },
    fallback: runtimeFallback("spirit_cards", "Current spirit-cards renderer uses CSS tiles and glyphs.")
  },
  echo_trials: {
    label: "Echo Trials",
    sourceRoot: `${GAME_THEME_ROOT}/Echo_Trials`,
    variants: ["default"],
    board: {
      default: sourceAsset("Echo_Trials/boards/echo_trials_panel_premium_placeholder.svg")
    },
    pieces: {
      glyphs: plannedAsset("Echo_Trials/pieces_tokens/echo_trials_glyph_set_master.svg")
    },
    cards: {
      promptDeck: plannedAsset("Echo_Trials/cards/echo_trials_prompt_cards_master.png")
    },
    room: {
      default: sourceAsset("Echo_Trials/room_backdrops/echo_trials_room_premium_placeholder.svg")
    },
    overlays: {
      resonance: plannedAsset("Echo_Trials/overlays_effects/echo_trials_resonance_overlay.png")
    },
    fallback: runtimeFallback("echo_trials", "Current echo-trials renderer uses HTML/CSS prompt panels.")
  },
  go: {
    label: "Go",
    sourceRoot: `${GAME_THEME_ROOT}/Go`,
    variants: ["default"],
    board: {
      default: sourceAsset("Go/boards/go_board_premium_placeholder.svg")
    },
    pieces: {
      blackStone: plannedAsset("Go/pieces_tokens/go_black_stone_master.png"),
      whiteStone: plannedAsset("Go/pieces_tokens/go_white_stone_master.png")
    },
    cards: {},
    room: {
      default: sourceAsset("Go/room_backdrops/go_room_premium_placeholder.svg")
    },
    overlays: {
      hoshi: plannedAsset("Go/overlays_effects/go_hoshi_overlay.svg")
    },
    fallback: runtimeFallback("go", "Current go renderer uses CSS intersections and stone gradients.")
  },
  grand_stage: {
    label: "Grand Stage",
    sourceRoot: `${GAME_THEME_ROOT}/Grand_Stage`,
    variants: ["default"],
    board: {
      default: sourceAsset("Grand_Stage/boards/grand_stage_platform_premium_placeholder.svg")
    },
    pieces: {},
    cards: {},
    room: {
      default: sourceAsset("Grand_Stage/room_backdrops/grand_stage_room_premium_placeholder.svg")
    },
    overlays: {
      spotlight: plannedAsset("Grand_Stage/overlays_effects/grand_stage_spotlight_overlay.png"),
      frame: plannedAsset("Grand_Stage/overlays_effects/grand_stage_frame_overlay.png")
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

export function resolveGameAssetUrl(gameType, slot, variant = "default") {
  return resolveGameAsset(gameType, slot, variant)?.publicPath || null;
}

export function listGameAssetInventory() {
  return Object.entries(GAME_ASSET_MANIFEST).map(([gameType, entry]) => {
    const implemented = [];
    const missing = [];
    for (const [slotName, slotEntries] of Object.entries({
      board: entry.board,
      pieces: entry.pieces,
      cards: entry.cards,
      room: entry.room,
      overlays: entry.overlays
    })) {
      if (!slotEntries || typeof slotEntries !== "object") continue;
      for (const asset of Object.values(slotEntries)) {
        if (!asset) continue;
        const bucket = `${slotName}:${asset.sourcePath.split("/").pop()}`;
        if (asset.publicPath) {
          implemented.push(bucket);
        } else {
          missing.push(bucket);
        }
      }
    }
    return {
      gameType,
      label: entry.label,
      sourceRoot: entry.sourceRoot,
      implemented,
      missing
    };
  });
}
