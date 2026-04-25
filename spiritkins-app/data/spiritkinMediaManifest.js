const assetUrl = (category, filename) => `/app/assets/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`;

const unavailableVideo = {
  status: "unavailable",
  path: "",
  fallback: "fallbackImage",
};

function imageSlot(path, fileName = "") {
  return {
    kind: "image",
    status: path ? "ready" : "unavailable",
    path,
    fileName,
  };
}

function videoSlot(path, fileName = "") {
  return path
    ? { kind: "video", status: "ready", path, fileName }
    : { kind: "video", ...unavailableVideo };
}

function createFounderMedia({
  portrait,
  portraitFile = "",
  heroImage,
  heroFile = "",
  fallbackImage,
  fallbackFile = "",
  trailerVideo = "",
  trailerFile = "",
}) {
  return {
    portrait: imageSlot(portrait, portraitFile),
    heroImage: imageSlot(heroImage, heroFile),
    trailerVideo: videoSlot(trailerVideo, trailerFile),
    idleVideo: videoSlot(""),
    speakingVideo: videoSlot(""),
    calmVideo: videoSlot(""),
    fallbackImage: imageSlot(fallbackImage || heroImage || portrait, fallbackFile || heroFile || portraitFile),
  };
}

const lyraOpen = assetUrl("ui", "lyra_open.png");
const raienOpen = assetUrl("ui", "raien_open.png");
const kairoOpen = assetUrl("ui", "kairo_open.png");
const solis = assetUrl("concepts", "Solis.png");
const neris = assetUrl("concepts", "Neris.png");
const solisNerisPair = assetUrl("concepts", "Solis Neris pair.png");

export const SPIRITKIN_MEDIA_MANIFEST = {
  Lyra: createFounderMedia({
    portrait: "/portraits/lyra_portrait.png",
    portraitFile: "lyra_portrait.png",
    heroImage: lyraOpen,
    heroFile: "lyra_open.png",
    fallbackImage: assetUrl("ui", "lyra_close.png"),
    fallbackFile: "lyra_close.png",
    trailerVideo: "/videos/lyra_intro.mp4",
    trailerFile: "lyra_intro.mp4",
  }),
  Raien: createFounderMedia({
    portrait: "/portraits/raien_portrait.png",
    portraitFile: "raien_portrait.png",
    heroImage: raienOpen,
    heroFile: "raien_open.png",
    fallbackImage: assetUrl("ui", "raien_close.png"),
    fallbackFile: "raien_close.png",
    trailerVideo: "/videos/raien_intro.mp4",
    trailerFile: "raien_intro.mp4",
  }),
  Kairo: createFounderMedia({
    portrait: "/portraits/kairo_portrait.png",
    portraitFile: "kairo_portrait.png",
    heroImage: kairoOpen,
    heroFile: "kairo_open.png",
    fallbackImage: assetUrl("ui", "kairo_close.png"),
    fallbackFile: "kairo_close.png",
    trailerVideo: "/videos/kairo_intro.mp4",
    trailerFile: "kairo_intro.mp4",
  }),
  Solis: createFounderMedia({
    portrait: solis,
    portraitFile: "Solis.png",
    heroImage: solis,
    heroFile: "Solis.png",
    fallbackImage: solisNerisPair,
    fallbackFile: "Solis Neris pair.png",
  }),
  Neris: createFounderMedia({
    portrait: neris,
    portraitFile: "Neris.png",
    heroImage: neris,
    heroFile: "Neris.png",
    fallbackImage: solisNerisPair,
    fallbackFile: "Solis Neris pair.png",
  }),
};

export const SPIRITKIN_MEDIA_ALIASES = {
  Elaria: "Solis",
  Elaira: "Solis",
  Thalassar: "Neris",
};

export function resolveSpiritkinMediaName(name) {
  const normalized = String(name || "").trim();
  return SPIRITKIN_MEDIA_ALIASES[normalized] || normalized;
}

export function getSpiritkinMediaManifest(name) {
  return SPIRITKIN_MEDIA_MANIFEST[resolveSpiritkinMediaName(name)] || null;
}

export function getSpiritkinMediaSlot(name, slot) {
  return getSpiritkinMediaManifest(name)?.[slot] || null;
}

export function resolveSpiritkinMediaPath(name, slot) {
  const mediaSlot = getSpiritkinMediaSlot(name, slot);
  return mediaSlot?.status === "ready" ? mediaSlot.path || "" : "";
}

export function isSpiritkinVideoAvailable(name, slot) {
  const mediaSlot = getSpiritkinMediaSlot(name, slot);
  return !!(mediaSlot?.kind === "video" && mediaSlot.status === "ready" && mediaSlot.path);
}
