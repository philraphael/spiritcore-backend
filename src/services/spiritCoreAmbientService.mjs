function clamp01(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function sanitizeText(value, limit = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

export function buildSpiritCoreAmbientFoundation({
  spiritkinIdentity = null,
  worldState = {},
  signals = {},
  surfacePriority = {},
  userModel = {}
} = {}) {
  const spiritkinName = sanitizeText(spiritkinIdentity?.name || "Spiritkin");
  const primarySurface = sanitizeText(surfacePriority?.primary || "presence");
  const worldMood = sanitizeText(worldState?.scene?.mood || "steady");
  const signalIntensity = clamp01(
    (Number(signals?.sadness || 0) * 0.32) +
    (Number(signals?.focus || 0) * 0.18) +
    (Number(signals?.playfulness || 0) * 0.18) +
    (Number(signals?.bonding || 0) * 0.2)
  , 0.34);

  const hospitalityMode = Number(signals?.sadness || 0) > 0.58
    ? "quiet-comfort"
    : Number(signals?.playfulness || 0) > 0.6
      ? "luminous-play"
      : Number(signals?.focus || 0) > 0.62
        ? "clarity-work"
        : "bonded-presence";

  const environmentScene = primarySurface === "games"
    ? "shared-play"
    : primarySurface === "profile"
      ? "bonded-presence"
      : primarySurface === "journal"
        ? "reflective-archive"
        : "ambient-presence";

  return {
    version: 1,
    integrationReady: false,
    spiritkin: spiritkinName,
    environmentScene,
    hospitalityMode,
    worldMood,
    signalIntensity: Number(signalIntensity.toFixed(3)),
    sceneState: {
      label: `${spiritkinName} ${environmentScene}`.trim(),
      priority: primarySurface,
      pacing: sanitizeText(userModel?.interactionStylePreference || "grounded"),
      reduceClutter: !!surfacePriority?.reduceClutter
    },
    outputHints: {
      lightColorMood: Number(signals?.playfulness || 0) > 0.58
        ? "bright-aurora"
        : Number(signals?.sadness || 0) > 0.54
          ? "low-ember"
          : "soft-realm-glow",
      soundscapeMood: Number(signals?.focus || 0) > 0.62 ? "clear-low-motion" : "soft-atmospheric",
      hospitalityCue: hospitalityMode
    },
    futureCapabilities: [
      "light-color-signals",
      "environment-scene-state",
      "hospitality-presence-mode",
      "cinema-focus-mode"
    ],
    safetyNotes: [
      "Descriptive foundation only. No device control is executed here.",
      "Ambient outputs must remain user-authorized and revocable.",
      "Environment state should follow conversation style and surface context, not identity inference."
    ]
  };
}
