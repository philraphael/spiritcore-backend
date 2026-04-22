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
      attentive: [],
      reflective: [],
      gameFocused: [],
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
    },
    aliases: {
      attentive: ["attentive", "idle"],
      reflective: ["reflective", "calm", "idle"],
      gameFocused: ["gameFocused", "idle"],
      fallback: ["idle"]
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

function normalizeStateKey(state) {
  return String(state || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function getStateEntries(set, normalizedState) {
  if (!set || !normalizedState) return [];
  if (normalizedState === "idle") return cloneStateList(set.states?.idle);
  if (normalizedState === "speaking") return cloneStateList(set.states?.speaking);
  if (normalizedState === "attentive") return cloneStateList(set.states?.attentive);
  if (normalizedState === "reflective") return cloneStateList(set.states?.reflective);
  if (normalizedState === "game-focused" || normalizedState === "gamefocused") {
    return cloneStateList(set.states?.gameFocused);
  }
  if (normalizedState === "calm" || normalizedState === "excited" || normalizedState === "serious") {
    return cloneStateList(set.states?.emotional?.[normalizedState]);
  }
  if (normalizedState === "special") return cloneStateList(set.states?.special);
  return [];
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
      attentive: cloneStateList(set.states?.attentive),
      reflective: cloneStateList(set.states?.reflective),
      gameFocused: cloneStateList(set.states?.gameFocused),
      emotional: {
        calm: cloneStateList(set.states?.emotional?.calm),
        excited: cloneStateList(set.states?.emotional?.excited),
        serious: cloneStateList(set.states?.emotional?.serious),
      },
      special: cloneStateList(set.states?.special),
    },
    aliases: {
      attentive: [...(set.aliases?.attentive || ["attentive", "idle"])],
      reflective: [...(set.aliases?.reflective || ["reflective", "calm", "idle"])],
      gameFocused: [...(set.aliases?.gameFocused || ["gameFocused", "idle"])],
      fallback: [...(set.aliases?.fallback || ["idle"])]
    }
  };
}

export function getSpiritkinVideoCandidates(spiritkin, state) {
  const set = getSpiritkinVideoSet(spiritkin);
  if (!set) return [];
  const normalizedState = normalizeStateKey(state);
  const aliasMap = {
    attentive: set.aliases?.attentive || ["attentive", "idle"],
    reflective: set.aliases?.reflective || ["reflective", "calm", "idle"],
    "game-focused": set.aliases?.gameFocused || ["gameFocused", "idle"],
    gamefocused: set.aliases?.gameFocused || ["gameFocused", "idle"],
    fallback: set.aliases?.fallback || ["idle"]
  };
  const lookupStates = aliasMap[normalizedState] || [normalizedState];
  const unique = new Set();
  const resolved = [];
  lookupStates.forEach((candidateState) => {
    const entries = getStateEntries(set, normalizeStateKey(candidateState));
    entries.forEach((entry) => {
      if (!entry || unique.has(entry)) return;
      unique.add(entry);
      resolved.push(entry);
    });
  });
  return resolved;
}

export function resolveSpiritkinVideo(spiritkin, state) {
  return getSpiritkinVideoCandidates(spiritkin, state)[0] || "";
}

export { SPIRITKIN_VIDEO_MANIFEST };
