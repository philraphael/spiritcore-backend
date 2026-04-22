const VIDEO_ROOT = "/app/spiritkin-videos";

function encodePathPart(value) {
  return encodeURIComponent(String(value || "").replace(/\\/g, "/"));
}

function buildVideoUrl(spiritkin, folder, filename) {
  if (!spiritkin || !folder || !filename) return "";
  return `${VIDEO_ROOT}/${encodePathPart(spiritkin)}/${encodePathPart(folder)}/${encodePathPart(filename)}`;
}

function createSpiritkinVideoSet(name) {
  return {
    name,
    fallbackAvailable: true,
    states: {
      idle: [
        buildVideoUrl(name, "idle", "idle_01.mp4"),
      ],
      speaking: [
        buildVideoUrl(name, "speaking", "speaking_01.mp4"),
      ],
      emotional: {
        calm: [
          buildVideoUrl(name, "emotional", "calm_01.mp4"),
        ],
        excited: [
          buildVideoUrl(name, "emotional", "excited_01.mp4"),
        ],
        serious: [
          buildVideoUrl(name, "emotional", "serious_01.mp4"),
        ],
      },
      special: []
    }
  };
}

const SPIRITKIN_VIDEO_MANIFEST = {
  Lyra: createSpiritkinVideoSet("Lyra"),
  Raien: createSpiritkinVideoSet("Raien"),
  Kairo: createSpiritkinVideoSet("Kairo"),
  Elaria: createSpiritkinVideoSet("Elaria"),
  Thalassar: createSpiritkinVideoSet("Thalassar"),
};

function cloneStateList(entries) {
  return Array.isArray(entries) ? entries.filter(Boolean).map((entry) => String(entry)) : [];
}

export function getSpiritkinVideoSet(spiritkin) {
  const resolvedName = String(spiritkin || "").trim();
  const set = SPIRITKIN_VIDEO_MANIFEST[resolvedName];
  if (!set) return null;
  return {
    name: set.name,
    fallbackAvailable: !!set.fallbackAvailable,
    states: {
      idle: cloneStateList(set.states?.idle),
      speaking: cloneStateList(set.states?.speaking),
      emotional: {
        calm: cloneStateList(set.states?.emotional?.calm),
        excited: cloneStateList(set.states?.emotional?.excited),
        serious: cloneStateList(set.states?.emotional?.serious),
      },
      special: cloneStateList(set.states?.special),
    }
  };
}

export function resolveSpiritkinVideo(spiritkin, state) {
  const set = getSpiritkinVideoSet(spiritkin);
  if (!set) return "";
  const normalizedState = String(state || "").trim().toLowerCase();
  if (normalizedState === "idle") {
    return set.states.idle[0] || "";
  }
  if (normalizedState === "speaking") {
    return set.states.speaking[0] || "";
  }
  if (normalizedState === "calm" || normalizedState === "excited" || normalizedState === "serious") {
    return set.states.emotional[normalizedState][0] || "";
  }
  if (normalizedState === "special") {
    return set.states.special[0] || "";
  }
  return "";
}

export { SPIRITKIN_VIDEO_MANIFEST };
