import { getGameAssetPackage } from "./gameAssetManifest.js";

const baseTheme = {
  boardStyle: "Celestial lacquered board",
  pieceStyle: "Luminous sigils",
  animationStyle: "Measured shimmer",
  associatedSpiritkin: "SpiritCore",
  boardVariant: "crown",
  cssVars: {
    "--game-accent": "#d6c08d",
    "--game-accent-soft": "rgba(214, 192, 141, 0.22)",
    "--game-secondary": "#6e8aa5",
    "--game-secondary-soft": "rgba(110, 138, 165, 0.2)",
    "--game-surface-top": "rgba(20, 30, 46, 0.94)",
    "--game-surface-bottom": "rgba(8, 15, 25, 0.96)",
    "--game-board-top": "#2b394f",
    "--game-board-bottom": "#152032",
    "--game-piece-user": "#f2e2b3",
    "--game-piece-spirit": "#9ec9de",
    "--game-glow": "rgba(214, 192, 141, 0.18)",
    "--game-shadow": "rgba(2, 6, 12, 0.62)"
  }
};

export const GAME_THEMES = {
  chess: {
    boardStyle: "Archive strategy dais",
    pieceStyle: "Forged relic pieces",
    animationStyle: "Deliberate ember rise",
    associatedSpiritkin: "Kairo",
    boardVariant: "ember",
    cssVars: {
      "--game-accent": "#f2c57a",
      "--game-accent-soft": "rgba(242, 197, 122, 0.2)",
      "--game-secondary": "#d77f45",
      "--game-secondary-soft": "rgba(215, 127, 69, 0.18)",
      "--game-surface-top": "rgba(43, 24, 16, 0.94)",
      "--game-surface-bottom": "rgba(18, 10, 12, 0.97)",
      "--game-board-top": "#6c4028",
      "--game-board-bottom": "#2a1715",
      "--game-piece-user": "#f4e0b7",
      "--game-piece-spirit": "#ffb680",
      "--game-glow": "rgba(242, 197, 122, 0.2)",
      "--game-shadow": "rgba(8, 3, 2, 0.72)"
    }
  },
  checkers: {
    boardStyle: "Veil-crossing mosaic",
    pieceStyle: "Pearled shadow discs",
    animationStyle: "Silk-slide drift",
    associatedSpiritkin: "Lyra",
    boardVariant: "veil",
    cssVars: {
      "--game-accent": "#e5c2d9",
      "--game-accent-soft": "rgba(229, 194, 217, 0.2)",
      "--game-secondary": "#b28bc2",
      "--game-secondary-soft": "rgba(178, 139, 194, 0.18)",
      "--game-surface-top": "rgba(44, 28, 42, 0.94)",
      "--game-surface-bottom": "rgba(15, 10, 20, 0.97)",
      "--game-board-top": "#6d4b63",
      "--game-board-bottom": "#271823",
      "--game-piece-user": "#f1dfeb",
      "--game-piece-spirit": "#ceb1f2",
      "--game-glow": "rgba(229, 194, 217, 0.18)",
      "--game-shadow": "rgba(9, 4, 10, 0.68)"
    }
  },
  go: {
    boardStyle: "Observatory star chart",
    pieceStyle: "Orbital star stones",
    animationStyle: "Astral settle pulse",
    associatedSpiritkin: "Raien",
    boardVariant: "astral",
    cssVars: {
      "--game-accent": "#88d8df",
      "--game-accent-soft": "rgba(136, 216, 223, 0.2)",
      "--game-secondary": "#6ca8d9",
      "--game-secondary-soft": "rgba(108, 168, 217, 0.18)",
      "--game-surface-top": "rgba(13, 27, 40, 0.95)",
      "--game-surface-bottom": "rgba(6, 11, 20, 0.98)",
      "--game-board-top": "#35546b",
      "--game-board-bottom": "#172636",
      "--game-piece-user": "#d8f9ff",
      "--game-piece-spirit": "#82b7d9",
      "--game-glow": "rgba(136, 216, 223, 0.2)",
      "--game-shadow": "rgba(3, 7, 14, 0.72)"
    }
  },
  spirit_cards: {
    boardStyle: "Crown-memory spread",
    pieceStyle: "Founder sigil cards",
    animationStyle: "Arcane hand fan",
    associatedSpiritkin: "Elaria",
    boardVariant: "crown",
    cssVars: {
      "--game-accent": "#d7e4a7",
      "--game-accent-soft": "rgba(215, 228, 167, 0.2)",
      "--game-secondary": "#8bc89f",
      "--game-secondary-soft": "rgba(139, 200, 159, 0.18)",
      "--game-surface-top": "rgba(19, 33, 25, 0.95)",
      "--game-surface-bottom": "rgba(8, 16, 14, 0.98)",
      "--game-board-top": "#355742",
      "--game-board-bottom": "#17271f",
      "--game-piece-user": "#f0f7d6",
      "--game-piece-spirit": "#b8dcb2",
      "--game-glow": "rgba(215, 228, 167, 0.18)",
      "--game-shadow": "rgba(3, 8, 5, 0.7)"
    }
  },
  echo_trials: {
    boardStyle: "Resonance chamber",
    pieceStyle: "Echo glyphs",
    animationStyle: "Soft ward bloom",
    associatedSpiritkin: "SpiritCore",
    boardVariant: "crown",
    cssVars: {
      "--game-accent": "#c3c8ff",
      "--game-accent-soft": "rgba(195, 200, 255, 0.18)",
      "--game-secondary": "#8fc4dc",
      "--game-secondary-soft": "rgba(143, 196, 220, 0.18)",
      "--game-surface-top": "rgba(24, 25, 44, 0.95)",
      "--game-surface-bottom": "rgba(10, 11, 20, 0.98)",
      "--game-board-top": "#373f75",
      "--game-board-bottom": "#1a1f36",
      "--game-piece-user": "#eef1ff",
      "--game-piece-spirit": "#a9d7f0",
      "--game-glow": "rgba(195, 200, 255, 0.18)",
      "--game-shadow": "rgba(4, 5, 12, 0.72)"
    }
  },
  tictactoe: {
    boardStyle: "Resonance glyph grid",
    pieceStyle: "Founder marks",
    animationStyle: "Quick sigil flare",
    associatedSpiritkin: "Elaria",
    boardVariant: "crown",
    cssVars: {
      "--game-accent": "#bfe4b7",
      "--game-accent-soft": "rgba(191, 228, 183, 0.18)",
      "--game-secondary": "#8bcfa4",
      "--game-secondary-soft": "rgba(139, 207, 164, 0.18)",
      "--game-surface-top": "rgba(20, 35, 29, 0.95)",
      "--game-surface-bottom": "rgba(9, 17, 14, 0.98)",
      "--game-board-top": "#355244",
      "--game-board-bottom": "#192720",
      "--game-piece-user": "#f0fae8",
      "--game-piece-spirit": "#c4f0d2",
      "--game-glow": "rgba(191, 228, 183, 0.18)",
      "--game-shadow": "rgba(3, 8, 4, 0.68)"
    }
  },
  connect_four: {
    boardStyle: "Constellation lattice",
    pieceStyle: "Falling star discs",
    animationStyle: "Orbital drop trail",
    associatedSpiritkin: "Raien",
    boardVariant: "astral",
    cssVars: {
      "--game-accent": "#8dd6f2",
      "--game-accent-soft": "rgba(141, 214, 242, 0.18)",
      "--game-secondary": "#6ea3d5",
      "--game-secondary-soft": "rgba(110, 163, 213, 0.18)",
      "--game-surface-top": "rgba(16, 28, 46, 0.95)",
      "--game-surface-bottom": "rgba(7, 12, 23, 0.98)",
      "--game-board-top": "#345170",
      "--game-board-bottom": "#18273d",
      "--game-piece-user": "#f1f7ff",
      "--game-piece-spirit": "#9dc0ff",
      "--game-glow": "rgba(141, 214, 242, 0.18)",
      "--game-shadow": "rgba(2, 6, 14, 0.72)"
    }
  },
  battleship: {
    boardStyle: "Abyssal tide map",
    pieceStyle: "Deepwater marks",
    animationStyle: "Submerged pulse wake",
    associatedSpiritkin: "Thalassar",
    boardVariant: "abyssal",
    cssVars: {
      "--game-accent": "#87d6d1",
      "--game-accent-soft": "rgba(135, 214, 209, 0.18)",
      "--game-secondary": "#5e98b8",
      "--game-secondary-soft": "rgba(94, 152, 184, 0.18)",
      "--game-surface-top": "rgba(10, 31, 42, 0.96)",
      "--game-surface-bottom": "rgba(4, 11, 18, 0.99)",
      "--game-board-top": "#234d62",
      "--game-board-bottom": "#0e2532",
      "--game-piece-user": "#dbffff",
      "--game-piece-spirit": "#8fc8df",
      "--game-glow": "rgba(135, 214, 209, 0.18)",
      "--game-shadow": "rgba(1, 6, 10, 0.74)"
    }
  }
};

export function getGameTheme(gameType) {
  return {
    ...baseTheme,
    ...(GAME_THEMES[gameType] || {}),
    assets: getGameAssetPackage(gameType),
    cssVars: {
      ...baseTheme.cssVars,
      ...(GAME_THEMES[gameType]?.cssVars || {})
    }
  };
}
