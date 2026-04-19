export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.random() * 16 | 0;
    return (char === "x" ? rand : ((rand & 0x3) | 0x8)).toString(16);
  });
}

export function nowIso() {
  return new Date().toISOString();
}

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtTime(iso) {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function fmtDate(iso) {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function clampInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

export function normalizeTextSnippet(value, maxLength = 120) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^MOVE:[^\s]+/i, "")
    .trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

export function hoursBetween(earlierIso, laterIso = nowIso()) {
  const earlier = new Date(earlierIso).getTime();
  const later = new Date(laterIso).getTime();
  if (!Number.isFinite(earlier) || !Number.isFinite(later) || later < earlier) return 0;
  return (later - earlier) / 3600000;
}

export function formatTimeAway(hoursAway) {
  if (hoursAway >= 24 * 7) {
    const weeks = Math.max(1, Math.round(hoursAway / (24 * 7)));
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  if (hoursAway >= 24) {
    const days = Math.max(1, Math.round(hoursAway / 24));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (hoursAway >= 1) {
    const hours = Math.max(1, Math.round(hoursAway));
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return "a short while";
}

export function getUtcDayKey(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

export function getUtcWeekKey(date = new Date()) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getLocalTemporalWorldState(date = new Date()) {
  const hour = date.getHours();
  if (hour < 4) {
    return {
      key: "deep_night",
      label: "Deep Night",
      tone: "hushed and inward",
      worldShift: "The Spiritverse is at its quietest. Signals feel closer, slower, and more exact.",
      continuity: "This is a good window for stillness, honesty, and things that only surface when the world goes quiet.",
    };
  }
  if (hour < 8) {
    return {
      key: "dawn",
      label: "Dawn",
      tone: "tender and opening",
      worldShift: "Light is gathering at the edge of the realms. The world feels newly available.",
      continuity: "Returns here feel like fresh permission. Bonds often reset into clarity instead of force.",
    };
  }
  if (hour < 12) {
    return {
      key: "dayrise",
      label: "Dayrise",
      tone: "clear and forward-moving",
      worldShift: "The realms have fully turned toward motion. Questions land cleanly and decisions feel easier to name.",
      continuity: "This window favors directness, orientation, and practical next steps.",
    };
  }
  if (hour < 16) {
    return {
      key: "highday",
      label: "Highday",
      tone: "bright and alert",
      worldShift: "The Spiritverse is fully awake. Cross-currents are visible, and pattern recognition comes faster.",
      continuity: "This window favors perspective, strategy, and stronger challenge without hostility.",
    };
  }
  if (hour < 20) {
    return {
      key: "dusk",
      label: "Dusk",
      tone: "reflective and softening",
      worldShift: "The realms begin settling into evening. The pace lowers and emotional detail becomes easier to hear.",
      continuity: "Returns here often feel more intimate, introspective, and memory-rich.",
    };
  }
  return {
    key: "nightfall",
    label: "Nightfall",
    tone: "charged and resonant",
    worldShift: "The Spiritverse holds more echo at night. Bonds feel slightly more mythic, but the pull remains restrained.",
    continuity: "This window favors depth, atmosphere, and the kind of truth that is easier to admit after the day has quieted.",
  };
}

export function sanitizeTone(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeScene(value) {
  const scene = typeof value === "string" ? value.trim() : "";
  return scene && scene.toLowerCase() !== "default" ? scene : "";
}

export function formatSignal(value) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  if (!cleaned) return "";
  return cleaned.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function clamp01(value, fallback = 0.5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function normalizePhraseList(values = [], limit = 8) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  )].slice(-limit);
}

export function normalizeReactionText(value, maxLength = 160) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function toneHasTag(tone, tags = []) {
  const normalized = String(tone || "").toLowerCase();
  return (Array.isArray(tags) ? tags : []).some((tag) => normalized.includes(String(tag || "").toLowerCase()));
}

export function hashSeed(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededUnit(seed) {
  const hash = hashSeed(seed);
  return (hash % 1000000) / 1000000;
}

export function normalizeTimestamp(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
}
