const GAME_THEME_ROOT = "Spiritverse_MASTER_ASSETS/Game_Themes";
const GAME_THEME_PUBLIC_ROOT = "/app/game-theme-assets";
const GAME_CONCEPT_ROOT = "Spiritverse_MASTER_ASSETS/spiritverse_game_concept_assets/spiritverse_game_concepts";
const GAME_CONCEPT_PUBLIC_ROOT = "/app/game-concept-assets";
const PREMIUM_GAME_PACK_ROOT = "Spiritverse_MASTER_ASSETS/spiritverse_premium_game_asset_pack";
const PREMIUM_GAME_PACK_PUBLIC_ROOT = "/app/premium-game-assets";

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

function rootedAsset(root, publicRoot, relativePath, options = {}) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  return assetRecord(`${root}/${normalized}`, {
    publicPath: publicRoot ? `${publicRoot}/${normalized}` : null,
    status: options.status || "implemented",
    notes: options.notes || ""
  });
}

function premiumAsset(relativePath, options = {}) {
  return rootedAsset(PREMIUM_GAME_PACK_ROOT, PREMIUM_GAME_PACK_PUBLIC_ROOT, relativePath, options);
}

function conceptAsset(relativePath, options = {}) {
  return rootedAsset(GAME_CONCEPT_ROOT, GAME_CONCEPT_PUBLIC_ROOT, relativePath, {
    status: options.status || "concept-layer",
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
    sourceRoot: PREMIUM_GAME_PACK_ROOT,
    variants: ["crown", "veil", "ember", "astral", "abyssal"],
    board: {
      default: premiumAsset("boards/chess_board_lyra_base.png", {
        notes: "Premium Phase 1 board base for Lyra-themed chess."
      })
    },
    pieces: {
      default: premiumAsset("pieces/chess_pieces_set.png", {
        notes: "Premium piece-sheet used as visual accent while gameplay keeps readable inline SVG chess pieces."
      }),
      crown: premiumAsset("pieces/chess_pieces_set.png"),
      veil: premiumAsset("pieces/chess_pieces_set.png"),
      ember: premiumAsset("pieces/chess_pieces_set.png"),
      astral: premiumAsset("pieces/chess_pieces_set.png"),
      abyssal: premiumAsset("pieces/chess_pieces_set.png")
    },
    cards: {
      default: premiumAsset("pieces/chess_pieces_set.png", {
        notes: "Phase 1 decorative sheet used for shell chrome."
      })
    },
    room: {
      default: conceptAsset("spiritverse_chess_lyra_theme.png", {
        notes: "Concept scene used as the premium chess chamber backdrop."
      })
    },
    overlays: {
      moveGlow: premiumAsset("fx/move_highlight_ring.png")
    },
    ui: {
      yourMove: premiumAsset("ui/your_move_banner.png"),
      thinking: premiumAsset("ui/spiritkin_thinking_banner.png"),
      win: premiumAsset("ui/generic_you_won_banner_large.png"),
      loss: premiumAsset("ui/generic_you_lost_banner_large.png"),
      check: premiumAsset("ui/chess_check_banner.png"),
      checkmate: premiumAsset("ui/chess_checkmate_banner.png"),
      frame: premiumAsset("ui/modal_frame_premium.png")
    },
    fallback: runtimeFallback("chess", "Current chess renderer uses inline SVG pieces and CSS board themes.")
  },
  checkers: {
    label: "Checkers",
    sourceRoot: PREMIUM_GAME_PACK_ROOT,
    variants: ["default"],
    board: {
      default: premiumAsset("boards/checkers_board_dragonforge_base.png")
    },
    pieces: {
      default: premiumAsset("pieces/checkers_pieces_set.png"),
      user: premiumAsset("pieces/checkers_pieces_set.png"),
      spiritkin: premiumAsset("pieces/checkers_pieces_set.png"),
      king: premiumAsset("pieces/checkers_pieces_set.png")
    },
    cards: {
      default: premiumAsset("pieces/checkers_pieces_set.png")
    },
    room: {
      default: conceptAsset("spiritverse_checkers_dragonforge_theme.png")
    },
    overlays: {
      selection: premiumAsset("fx/move_highlight_ring.png")
    },
    ui: {
      yourMove: premiumAsset("ui/your_move_banner.png"),
      thinking: premiumAsset("ui/spiritkin_thinking_banner.png"),
      win: premiumAsset("ui/checkers_you_won_banner.png"),
      loss: premiumAsset("ui/checkers_you_lost_banner.png"),
      frame: premiumAsset("ui/modal_frame_premium.png")
    },
    fallback: runtimeFallback("checkers", "Current checkers renderer uses CSS discs and board gradients.")
  },
  tictactoe: {
    label: "TicTacToe of Echoes",
    sourceRoot: PREMIUM_GAME_PACK_ROOT,
    variants: ["default"],
    board: {
      default: conceptAsset("spiritverse_tictactoe_forest_theme.png", {
        notes: "Phase 1 concept board used as both backdrop and board reference until a direct isolated board crop is available."
      })
    },
    pieces: {
      default: premiumAsset("tokens/tictactoe_tokens_forest_set.png"),
      user: premiumAsset("tokens/tictactoe_tokens_forest_set.png"),
      spiritkin: premiumAsset("tokens/tictactoe_tokens_forest_set.png")
    },
    cards: {
      default: premiumAsset("tokens/tictactoe_tokens_forest_set.png")
    },
    room: {
      default: conceptAsset("spiritverse_tictactoe_forest_theme.png")
    },
    overlays: {
      winLine: premiumAsset("fx/tictactoe_glow_marks.png")
    },
    ui: {
      yourMove: premiumAsset("ui/your_move_banner.png"),
      thinking: premiumAsset("ui/spiritkin_thinking_banner.png"),
      win: premiumAsset("ui/generic_you_won_banner_large.png"),
      loss: premiumAsset("ui/generic_you_lost_banner_large.png"),
      frame: premiumAsset("ui/modal_frame_premium.png")
    },
    fallback: runtimeFallback("tictactoe", "Current tic-tac-toe renderer uses CSS board cells and text marks.")
  },
  connect_four: {
    label: "Connect Four",
    sourceRoot: PREMIUM_GAME_PACK_ROOT,
    variants: ["default"],
    board: {
      default: premiumAsset("boards/connect4_board_waterfall_base.png")
    },
    pieces: {
      user: premiumAsset("tokens/connect4_disc_blue.png"),
      spiritkin: premiumAsset("tokens/connect4_disc_purple.png"),
      accent: premiumAsset("tokens/connect4_disc_darkblue.png")
    },
    cards: {
      default: premiumAsset("tokens/connect4_disc_darkblue.png")
    },
    room: {
      default: conceptAsset("spiritverse_connect_four_waterfall_theme.png")
    },
    overlays: {
      dropTrail: premiumAsset("fx/portal_beam_fx.png")
    },
    ui: {
      yourMove: premiumAsset("ui/your_move_banner.png"),
      thinking: premiumAsset("ui/spiritkin_thinking_banner.png"),
      win: premiumAsset("ui/generic_you_won_banner_large.png"),
      loss: premiumAsset("ui/generic_you_lost_banner_large.png"),
      frame: premiumAsset("ui/modal_frame_premium.png")
    },
    fallback: runtimeFallback("connect_four", "Current connect-four renderer uses CSS board framing and colored tokens.")
  },
  battleship: {
    label: "Battleship",
    sourceRoot: PREMIUM_GAME_PACK_ROOT,
    variants: ["default"],
    board: {
      default: conceptAsset("spiritverse_battleship_forge_theme.png", {
        notes: "Phase 1 uses the forge tactical scene as the main board surface because no isolated direct grid crop exists in the pack."
      })
    },
    pieces: {
      shipSet: premiumAsset("ships/battleship_forge_ships_set.png")
    },
    cards: {
      default: premiumAsset("ships/battleship_forge_ships_set.png")
    },
    room: {
      default: conceptAsset("spiritverse_battleship_forge_theme.png")
    },
    overlays: {
      sonar: premiumAsset("fx/portal_beam_fx.png")
    },
    ui: {
      yourMove: premiumAsset("ui/your_move_banner.png"),
      thinking: premiumAsset("ui/spiritkin_thinking_banner.png"),
      win: premiumAsset("ui/generic_you_won_banner_large.png"),
      loss: premiumAsset("ui/generic_you_lost_banner_large.png"),
      frame: premiumAsset("ui/modal_frame_premium.png")
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
    sourceRoot: PREMIUM_GAME_PACK_ROOT,
    variants: ["default"],
    board: {
      default: premiumAsset("boards/go_board_aquatic_base.png")
    },
    pieces: {
      default: premiumAsset("tokens/go_stones_set.png"),
      blackStone: premiumAsset("tokens/go_stones_set.png"),
      whiteStone: premiumAsset("tokens/go_stones_set.png")
    },
    cards: {
      default: premiumAsset("tokens/go_stones_set.png")
    },
    room: {
      default: conceptAsset("spiritverse_go_aquatic_theme.png")
    },
    overlays: {
      hoshi: premiumAsset("fx/move_highlight_ring.png")
    },
    ui: {
      yourMove: premiumAsset("ui/your_move_banner.png"),
      thinking: premiumAsset("ui/spiritkin_thinking_banner.png"),
      win: premiumAsset("ui/generic_you_won_banner_large.png"),
      loss: premiumAsset("ui/generic_you_lost_banner_large.png"),
      frame: premiumAsset("ui/modal_frame_premium.png")
    },
    fallback: runtimeFallback("go", "Current go renderer uses CSS intersections and stone gradients.")
  },
  grand_stage: {
    label: "Grand Stage",
    sourceRoot: PREMIUM_GAME_PACK_ROOT,
    variants: ["default"],
    board: {
      default: premiumAsset("concepts/full_asset_sheet_reference.png")
    },
    pieces: {},
    cards: {},
    room: {
      default: premiumAsset("concepts/full_asset_sheet_reference.png")
    },
    overlays: {
      spotlight: premiumAsset("fx/portal_beam_fx.png"),
      frame: premiumAsset("ui/modal_frame_premium.png")
    },
    ui: {
      frame: premiumAsset("ui/modal_frame_premium.png")
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
      overlays: entry.overlays,
      ui: entry.ui
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
