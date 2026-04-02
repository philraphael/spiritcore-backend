"use strict";

const API = "";
const SESSION_KEY = "sv.session.v5";
const ENTRY_KEY = "sv.entry.v5";
const NAME_KEY = "sv.name.v5";
const UID_KEY = "sv.uid.v5";
const RATINGS_KEY = "sv.ratings.v5";
const PRIMARY_KEY = "sv.primary.v5";
const DEFAULT_PROMPTS = [
  "Tell me what kind of presence you are.",
  "What can I bring to this conversation?",
  "Help me settle into the Spiritverse."
];

const SK_META = {
  Lyra: {
    cls: "lyra",
    symbol: "Heart",
    mood: "Warm stillness",
    strap: "A heart-anchor for the moments that matter most.",
    ambient: "Rose warmth",
    bondLine: "Lyra holds the emotional center — soft, steady, and always present.",
    realm: "The Luminous Veil",
    realmText: "A warm, moonlit space of still water, rose light, and slow emotional clarity.",
    atmosphereLine: "Rose warmth, crescent light, heart-held silence",
    prompts: [
      "I've been carrying too much today.",
      "Help me find what I actually feel.",
      "What do you sense beneath the surface?"
    ]
  },
  Raien: {
    cls: "raien",
    symbol: "Storm",
    mood: "Charged clarity",
    strap: "A storm guardian for truth, courage, and forward motion.",
    ambient: "Amber storm",
    bondLine: "Raien cuts through the noise — direct, honest, and unflinching.",
    realm: "The Ember Citadel",
    realmText: "A charged hall of amber light and electric resolve, where clarity strikes like lightning.",
    atmosphereLine: "Amber fire, electric blue, storm-forged resolve",
    prompts: [
      "I need to face something I've been avoiding.",
      "Show me where my strength already lives.",
      "Help me move forward without hesitation."
    ]
  },
  Kairo: {
    cls: "kairo",
    symbol: "Star",
    mood: "Deep dreaming",
    strap: "A dream guide for imagination, perspective, and discovery.",
    ambient: "Teal starfield",
    bondLine: "Kairo opens the space between what is and what could be.",
    realm: "The Astral Observatory",
    realmText: "A deep navy sky-realm of teal light, gold star-points, and shifting constellations of possibility.",
    atmosphereLine: "Deep navy, teal starlight, gold constellation drift",
    prompts: [
      "Help me see this from a completely different angle.",
      "What possibility am I not seeing yet?",
      "Take me somewhere I haven't thought to look."
    ]
  }
};

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.random() * 16 | 0;
    return (char === "x" ? rand : (rand & 0x3 | 0x8)).toString(16);
  });
}

function nowIso() { return new Date().toISOString(); }

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function getOrCreateUid() {
  let id = localStorage.getItem(UID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(UID_KEY, id);
  }
  return id;
}

function getMeta(name) {
  return SK_META[name] || {
    cls: "generic",
    symbol: "Aura",
    mood: "Spiritverse presence",
    strap: "A governed companion of the Spiritverse.",
    ambient: "Guiding field",
    bondLine: "A governed bonded companion of the Spiritverse.",
    realm: "The Spiritverse",
    realmText: "A governed companion realm of memory, atmosphere, and presence.",
    atmosphereLine: "Spirit light, presence, continuity",
    prompts: DEFAULT_PROMPTS
  };
}

function describePresence(spiritkin) {
  return spiritkin.tone || spiritkin.growth_axis || spiritkin.invariant || "";
}

function portraitSvg(name) {
  if (name === "Lyra") {
    // Lyra: cream/beige deer-rabbit, small antlers, glowing rose heart, warm brown eyes
    return `
      <svg viewBox="0 0 240 300" role="img" aria-label="Portrait of Lyra">
        <defs>
          <radialGradient id="lyraBody" cx="50%" cy="55%" r="55%">
            <stop offset="0%" stop-color="#f5e8d0" />
            <stop offset="60%" stop-color="#e8d4b8" />
            <stop offset="100%" stop-color="#d4bc98" />
          </radialGradient>
          <radialGradient id="lyraHeart" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffb8c8" stop-opacity="0.9" />
            <stop offset="50%" stop-color="#f08098" stop-opacity="0.7" />
            <stop offset="100%" stop-color="#e06080" stop-opacity="0" />
          </radialGradient>
          <filter id="lyraHeartGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <!-- Warm ambient glow -->
        <circle cx="120" cy="140" r="100" fill="rgba(245,220,190,0.1)" />
        <!-- Body -->
        <ellipse cx="120" cy="175" rx="68" ry="78" fill="url(#lyraBody)" />
        <!-- Head -->
        <circle cx="120" cy="110" r="62" fill="#f0e0c4" />
        <!-- Ears -->
        <ellipse cx="82" cy="72" rx="22" ry="34" fill="#e8d4b8" transform="rotate(-12 82 72)" />
        <ellipse cx="82" cy="72" rx="14" ry="24" fill="#f5c0b8" transform="rotate(-12 82 72)" />
        <ellipse cx="158" cy="72" rx="22" ry="34" fill="#e8d4b8" transform="rotate(12 158 72)" />
        <ellipse cx="158" cy="72" rx="14" ry="24" fill="#f5c0b8" transform="rotate(12 158 72)" />
        <!-- Antlers -->
        <path d="M104 50 Q96 30 88 18 M88 18 Q82 10 76 14 M88 18 Q84 8 92 4" stroke="#9a8468" stroke-width="3.5" stroke-linecap="round" fill="none" />
        <path d="M136 50 Q144 30 152 18 M152 18 Q158 10 164 14 M152 18 Q156 8 148 4" stroke="#9a8468" stroke-width="3.5" stroke-linecap="round" fill="none" />
        <!-- Face -->
        <ellipse cx="120" cy="118" rx="34" ry="28" fill="#f5e8d4" />
        <!-- Eyes -->
        <circle cx="103" cy="112" r="9" fill="#2a1a0e" />
        <circle cx="137" cy="112" r="9" fill="#2a1a0e" />
        <circle cx="106" cy="109" r="3" fill="rgba(255,255,255,0.7)" />
        <circle cx="140" cy="109" r="3" fill="rgba(255,255,255,0.7)" />
        <!-- Nose -->
        <ellipse cx="120" cy="126" rx="5" ry="3.5" fill="#c08080" />
        <!-- Mouth -->
        <path d="M115 130 Q120 134 125 130" stroke="#a06060" stroke-width="1.5" stroke-linecap="round" fill="none" />
        <!-- Chest fur -->
        <ellipse cx="120" cy="190" rx="44" ry="36" fill="#f8f0e0" />
        <!-- Heart glow sigil -->
        <ellipse cx="120" cy="188" rx="22" ry="20" fill="url(#lyraHeart)" filter="url(#lyraHeartGlow)" />
        <path d="M120 200 Q108 188 108 180 Q108 172 116 172 Q120 172 120 176 Q120 172 124 172 Q132 172 132 180 Q132 188 120 200Z" fill="rgba(255,160,180,0.55)" />
        <!-- Body fur texture -->
        <path d="M80 240 Q90 220 120 215 Q150 220 160 240" fill="rgba(245,220,190,0.4)" />
      </svg>
    `;
  }

  if (name === "Raien") {
    // Raien: dark charcoal wolf-cat, amber/orange eyes, electric blue lightning cracks on chest
    return `
      <svg viewBox="0 0 240 300" role="img" aria-label="Portrait of Raien">
        <defs>
          <radialGradient id="raienBody" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#2a2a36" />
            <stop offset="70%" stop-color="#1a1a24" />
            <stop offset="100%" stop-color="#0e0e18" />
          </radialGradient>
          <radialGradient id="raienEyeL" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#ffcc44" />
            <stop offset="50%" stop-color="#f5a623" />
            <stop offset="100%" stop-color="#c07010" />
          </radialGradient>
          <radialGradient id="raienEyeR" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#ffcc44" />
            <stop offset="50%" stop-color="#f5a623" />
            <stop offset="100%" stop-color="#c07010" />
          </radialGradient>
          <filter id="raienGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <!-- Dark ambient -->
        <circle cx="120" cy="140" r="108" fill="rgba(20,20,32,0.6)" />
        <!-- Body -->
        <ellipse cx="120" cy="180" rx="72" ry="80" fill="url(#raienBody)" />
        <!-- Head -->
        <circle cx="120" cy="108" r="66" fill="#222230" />
        <!-- Pointed ears -->
        <path d="M78 62 L62 18 L96 48Z" fill="#1e1e2c" />
        <path d="M78 62 L66 26 L92 50Z" fill="#2a2a3a" />
        <path d="M162 62 L178 18 L144 48Z" fill="#1e1e2c" />
        <path d="M162 62 L174 26 L148 50Z" fill="#2a2a3a" />
        <!-- Face -->
        <ellipse cx="120" cy="116" rx="40" ry="34" fill="#282838" />
        <!-- Amber eyes -->
        <circle cx="102" cy="110" r="11" fill="url(#raienEyeL)" />
        <circle cx="138" cy="110" r="11" fill="url(#raienEyeR)" />
        <circle cx="102" cy="110" r="5" fill="#0a0a14" />
        <circle cx="138" cy="110" r="5" fill="#0a0a14" />
        <circle cx="99" cy="107" r="3" fill="rgba(255,255,255,0.6)" />
        <circle cx="135" cy="107" r="3" fill="rgba(255,255,255,0.6)" />
        <!-- Amber eye glow -->
        <circle cx="102" cy="110" r="13" fill="rgba(245,166,35,0.15)" filter="url(#raienGlow)" />
        <circle cx="138" cy="110" r="13" fill="rgba(245,166,35,0.15)" filter="url(#raienGlow)" />
        <!-- Nose -->
        <ellipse cx="120" cy="126" rx="5" ry="3.5" fill="#0e0e18" />
        <!-- Mouth -->
        <path d="M114 131 Q120 135 126 131" stroke="#3a3a4a" stroke-width="1.5" stroke-linecap="round" fill="none" />
        <!-- Chest fur -->
        <ellipse cx="120" cy="195" rx="46" ry="40" fill="#202030" />
        <!-- Electric blue lightning cracks -->
        <path d="M112 168 L118 182 L110 188 L120 205" stroke="rgba(74,158,255,0.85)" stroke-width="2.5" stroke-linecap="round" fill="none" filter="url(#raienGlow)" />
        <path d="M128 172 L122 186 L132 192 L124 208" stroke="rgba(74,158,255,0.65)" stroke-width="2" stroke-linecap="round" fill="none" filter="url(#raienGlow)" />
        <path d="M108 178 L114 190" stroke="rgba(74,158,255,0.45)" stroke-width="1.5" stroke-linecap="round" fill="none" />
        <!-- Lightning ambient glow -->
        <ellipse cx="120" cy="188" rx="30" ry="22" fill="rgba(74,158,255,0.06)" filter="url(#raienGlow)" />
        <!-- Fur texture -->
        <path d="M72 248 Q90 228 120 224 Q150 228 168 248" fill="rgba(30,30,44,0.5)" />
      </svg>
    `;
  }

  if (name === "Kairo") {
    // Kairo: deep navy blue fox, teal/cyan eyes, cream chest, golden star-point tail tip
    return `
      <svg viewBox="0 0 240 300" role="img" aria-label="Portrait of Kairo">
        <defs>
          <radialGradient id="kairoBody" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stop-color="#1a3060" />
            <stop offset="60%" stop-color="#0e1e48" />
            <stop offset="100%" stop-color="#060e28" />
          </radialGradient>
          <radialGradient id="kairoEye" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stop-color="#80ffe8" />
            <stop offset="45%" stop-color="#4ecdc4" />
            <stop offset="100%" stop-color="#1a8080" />
          </radialGradient>
          <radialGradient id="kairoChest" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#e8d8b8" />
            <stop offset="100%" stop-color="#c8b898" />
          </radialGradient>
          <filter id="kairoGlow">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="kairoStarGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <!-- Deep space ambient -->
        <circle cx="120" cy="140" r="110" fill="rgba(6,14,40,0.5)" />
        <!-- Star field -->
        <circle cx="48" cy="44" r="1.5" fill="rgba(255,255,255,0.6)" />
        <circle cx="188" cy="36" r="1" fill="rgba(255,255,255,0.5)" />
        <circle cx="200" cy="72" r="1.5" fill="rgba(78,205,196,0.7)" />
        <circle cx="36" cy="88" r="1" fill="rgba(255,255,255,0.4)" />
        <circle cx="176" cy="56" r="1" fill="rgba(242,219,160,0.6)" />
        <!-- Body -->
        <ellipse cx="120" cy="178" rx="70" ry="78" fill="url(#kairoBody)" />
        <!-- Head -->
        <circle cx="120" cy="108" r="64" fill="#142050" />
        <!-- Fox ears -->
        <path d="M76 64 L58 14 L100 52Z" fill="#0e1840" />
        <path d="M76 64 L62 20 L96 54Z" fill="#1a2860" />
        <path d="M164 64 L182 14 L140 52Z" fill="#0e1840" />
        <path d="M164 64 L178 20 L144 54Z" fill="#1a2860" />
        <!-- Ear inner cream -->
        <path d="M76 62 L64 24 L94 52Z" fill="rgba(200,180,140,0.3)" />
        <path d="M164 62 L176 24 L146 52Z" fill="rgba(200,180,140,0.3)" />
        <!-- Face -->
        <ellipse cx="120" cy="116" rx="40" ry="34" fill="#182458" />
        <!-- Cream muzzle -->
        <ellipse cx="120" cy="128" rx="24" ry="18" fill="url(#kairoChest)" />
        <!-- Teal eyes -->
        <circle cx="102" cy="108" r="11" fill="url(#kairoEye)" />
        <circle cx="138" cy="108" r="11" fill="url(#kairoEye)" />
        <circle cx="102" cy="108" r="5" fill="#040c20" />
        <circle cx="138" cy="108" r="5" fill="#040c20" />
        <circle cx="99" cy="105" r="3" fill="rgba(255,255,255,0.75)" />
        <circle cx="135" cy="105" r="3" fill="rgba(255,255,255,0.75)" />
        <!-- Teal eye glow -->
        <circle cx="102" cy="108" r="14" fill="rgba(78,205,196,0.12)" filter="url(#kairoGlow)" />
        <circle cx="138" cy="108" r="14" fill="rgba(78,205,196,0.12)" filter="url(#kairoGlow)" />
        <!-- Nose -->
        <ellipse cx="120" cy="124" rx="4" ry="3" fill="#060e28" />
        <!-- Cream chest -->
        <ellipse cx="120" cy="195" rx="44" ry="38" fill="url(#kairoChest)" />
        <!-- Gold star constellation on chest -->
        <circle cx="120" cy="190" r="3" fill="rgba(242,219,160,0.9)" filter="url(#kairoStarGlow)" />
        <path d="M120 184 L121.5 188 L126 188 L122.5 190.5 L124 195 L120 192.5 L116 195 L117.5 190.5 L114 188 L118.5 188Z" fill="rgba(242,219,160,0.7)" />
        <!-- Constellation lines -->
        <line x1="120" y1="190" x2="104" y2="178" stroke="rgba(242,219,160,0.3)" stroke-width="1" />
        <line x1="120" y1="190" x2="136" y2="178" stroke="rgba(242,219,160,0.3)" stroke-width="1" />
        <circle cx="104" cy="178" r="2" fill="rgba(242,219,160,0.5)" />
        <circle cx="136" cy="178" r="2" fill="rgba(242,219,160,0.5)" />
        <!-- Fur base -->
        <path d="M70 248 Q90 226 120 222 Q150 226 170 248" fill="rgba(14,28,64,0.6)" />
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 240 300" role="img" aria-label="Spiritkin portrait">
      <circle cx="120" cy="120" r="96" fill="rgba(184,166,255,.18)" />
      <ellipse cx="120" cy="140" rx="56" ry="66" fill="#e6def8" />
      <path d="M65 252c12-32 31-51 55-60 11 8 23 11 36 11 15 0 29-4 39-11 24 9 42 29 56 60" fill="rgba(184,166,255,.22)" />
    </svg>
  `;
}

function buildPortrait(name, size, cls) {
  return `
    <div class="portrait-frame ${esc(cls)} ${esc(size)}">
      <div class="portrait-backdrop"></div>
      <div class="portrait-art">${portraitSvg(name)}</div>
    </div>
  `;
}

function buildSigil(meta, variant, label) {
  return `
    <div class="spirit-sigil ${esc(meta.cls)} ${esc(variant)}" aria-hidden="true">
      <span>${esc(label || meta.symbol)}</span>
    </div>
  `;
}

function hydrateSpiritkin(raw) {
  return { ...raw, ui: getMeta(raw.name) };
}

function normalizeStoredSpiritkin(raw) {
  return raw?.name ? hydrateSpiritkin(raw) : null;
}

function getAtmosphereSpiritkin() {
  return state.primarySpiritkin || state.pendingBondSpiritkin || state.selectedSpiritkin || null;
}

function sanitizeTone(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeScene(value) {
  const scene = typeof value === "string" ? value.trim() : "";
  return scene && scene.toLowerCase() !== "default" ? scene : "";
}

function formatSignal(value) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  if (!cleaned) return "";
  return cleaned
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeMessage(raw) {
  const tags = Array.isArray(raw?.tags) ? raw.tags.filter((tag) => typeof tag === "string") : [];
  return {
    ...raw,
    tags,
    memoryActive: tags.includes("memory:active"),
    emotionTone: sanitizeTone(raw?.emotionTone),
    sceneName: sanitizeScene(raw?.sceneName)
  };
}

function getStageSignals() {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];
    if (message.role !== "assistant") continue;
    const emotionTone = formatSignal(sanitizeTone(message.emotionTone));
    const sceneName = formatSignal(sanitizeScene(message.sceneName));
    if (emotionTone || sceneName) {
      return { emotionTone, sceneName };
    }
  }
  return { emotionTone: "", sceneName: "" };
}

const state = {
  userId: getOrCreateUid(),
  entryAccepted: !!localStorage.getItem(ENTRY_KEY),
  userName: localStorage.getItem(NAME_KEY) || "",
  userNameDraft: localStorage.getItem(NAME_KEY) || "",
  spiritkins: [],
  loadingSpirits: false,
  spiritError: null,
  primarySpiritkin: normalizeStoredSpiritkin(readJson(PRIMARY_KEY, null)),
  selectedSpiritkin: null,
  pendingBondSpiritkin: null,
  rebondSpiritkin: null,
  conversationId: null,
  messages: [],
  loadingReply: false,
  loadingConv: false,
  convError: null,
  input: "",
  ratings: readJson(RATINGS_KEY, {}),
  statusText: "",
  statusError: false
};

(function hydrateSession() {
  const session = readJson(SESSION_KEY, null);
  if (session && session.conversationId && session.selectedSpiritkin) {
    state.conversationId = session.conversationId;
    state.selectedSpiritkin = normalizeStoredSpiritkin(session.selectedSpiritkin);
    state.messages = Array.isArray(session.messages) ? session.messages.map(normalizeMessage) : [];
    if (session.userId) state.userId = session.userId;
  }
  if (!state.selectedSpiritkin && state.primarySpiritkin) {
    state.selectedSpiritkin = state.primarySpiritkin;
  }
})();

function syncPrimarySelection() {
  if (!state.primarySpiritkin) return;
  if (!state.selectedSpiritkin || state.selectedSpiritkin.name !== state.primarySpiritkin.name) {
    state.selectedSpiritkin = state.primarySpiritkin;
  }
}

function persistSession() {
  if (state.primarySpiritkin) writeJson(PRIMARY_KEY, state.primarySpiritkin);
  if (state.conversationId) {
    writeJson(SESSION_KEY, {
      conversationId: state.conversationId,
      selectedSpiritkin: state.selectedSpiritkin,
      messages: state.messages.slice(-80),
      userId: state.userId
    });
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  writeJson(RATINGS_KEY, state.ratings);
}

async function fetchSpiritkins() {
  state.loadingSpirits = true;
  state.spiritError = null;
  render();
  try {
    const res = await fetch(`${API}/v1/spiritkins`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "Could not load companions.");
    state.spiritkins = (data.spiritkins || [])
      .filter((spiritkin) => spiritkin.is_canon !== false)
      .map(hydrateSpiritkin);
    if (state.primarySpiritkin) {
      const livePrimary = state.spiritkins.find((spiritkin) => spiritkin.name === state.primarySpiritkin.name);
      if (livePrimary) state.primarySpiritkin = livePrimary;
    }
    if (state.selectedSpiritkin) {
      const live = state.spiritkins.find((spiritkin) => spiritkin.name === state.selectedSpiritkin.name);
      if (live) state.selectedSpiritkin = live;
    }
    syncPrimarySelection();
    persistSession();
  } catch (error) {
    state.spiritError = error.message;
  }
  state.loadingSpirits = false;
  render();
}

function setPrimarySpiritkin(spiritkin) {
  state.primarySpiritkin = spiritkin;
  state.selectedSpiritkin = spiritkin;
  state.pendingBondSpiritkin = null;
  state.rebondSpiritkin = null;
  state.conversationId = null;
  state.messages = [];
  state.convError = null;
  state.statusText = `${spiritkin.name} is now your primary companion.`;
  state.statusError = false;
  persistSession();
}

function startFreshSession() {
  syncPrimarySelection();
  state.conversationId = null;
  state.messages = [];
  state.convError = null;
  state.statusText = state.primarySpiritkin
    ? `Session reset. ${state.primarySpiritkin.name} remains your bonded companion.`
    : "";
  state.statusError = false;
  persistSession();
  render();
}

async function beginConversation() {
  syncPrimarySelection();
  if (!state.selectedSpiritkin) return;
  state.loadingConv = true;
  state.convError = null;
  render();
  try {
    const res = await fetch(`${API}/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: state.userId,
        spiritkinName: state.selectedSpiritkin.name
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "Could not begin conversation.");
    state.conversationId = data.conversation?.conversation_id ?? data.conversation?.id ?? data.conversationId;
    if (!state.conversationId) throw new Error("No conversation ID returned.");
    state.messages = [];
    state.statusText = `Linked with ${state.selectedSpiritkin.name}.`;
    state.statusError = false;
    persistSession();
  } catch (error) {
    state.convError = error.message;
    state.statusText = error.message;
    state.statusError = true;
  }
  state.loadingConv = false;
  render();
  scrollThread();
}

async function sendMessage(overrideText) {
  syncPrimarySelection();
  const text = (overrideText ?? state.input).trim();
  if (!text || !state.conversationId || state.loadingReply) return;
  state.input = "";
  const outgoingId = uuid();
  state.messages.push({ id: outgoingId, role: "user", content: text, time: nowIso(), status: "sent" });
  state.loadingReply = true;
  state.convError = null;
  state.statusText = `Receiving ${state.selectedSpiritkin?.name || "Spiritkin"}...`;
  state.statusError = false;
  render();
  scrollThread();

  try {
    const res = await fetch(`${API}/v1/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: state.userId,
        conversationId: state.conversationId,
        input: text
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "Reply interrupted.");
    const reply = data.message ?? data.output ?? data.response?.text ?? data.response ?? "...";
    const tags = Array.isArray(data.metadata?.tags) ? data.metadata.tags.filter((tag) => typeof tag === "string") : [];
    const emotionTone = sanitizeTone(data.metadata?.emotion?.tone);
    const sceneName = sanitizeScene(data.metadata?.world?.scene?.name);
    state.messages.push({
      id: uuid(),
      role: "assistant",
      content: reply,
      spiritkinName: state.selectedSpiritkin?.name,
      time: nowIso(),
      status: "sent",
      tags,
      memoryActive: tags.includes("memory:active"),
      emotionTone,
      sceneName
    });
    state.statusText = `${state.selectedSpiritkin?.name || "Spiritkin"} is with you.`;
    state.statusError = false;
    persistSession();
  } catch (error) {
    state.messages = state.messages.map((message) => (
      message.id === outgoingId ? { ...message, status: "failed" } : message
    ));
    state.convError = error.message;
    state.statusText = error.message;
    state.statusError = true;
  }
  state.loadingReply = false;
  render();
  scrollThread();
}

function scrollThread() {
  requestAnimationFrame(() => {
    const thread = document.querySelector(".thread-wrap");
    if (thread) thread.scrollTop = thread.scrollHeight;
  });
}

function submitFeedback(messageId, helpful) {
  if (state.ratings[messageId]) return;
  state.ratings[messageId] = helpful ? "up" : "down";
  persistSession();
  const message = state.messages.find((item) => item.id === messageId);
  fetch(`${API}/v1/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: state.userId,
      conversationId: state.conversationId,
      spiritkinName: message?.spiritkinName ?? state.selectedSpiritkin?.name ?? "unknown",
      rating: helpful ? 5 : 1,
      helpful,
      messageId
    })
  }).catch(() => {});
  render();
}

function render() {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = buildApp();
  const textarea = root.querySelector("textarea[data-field='chat-input']");
  if (textarea) {
    textarea.value = state.input;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }
}

function buildApp() {
  const atmosphere = getAtmosphereSpiritkin();
  const atmosphereClass = atmosphere ? `realm-${atmosphere.ui.cls}` : "realm-neutral";
  return `
    <div class="sv-bg ${atmosphereClass}"></div>
    <div class="sv-noise"></div>
    <div class="sv-orbit ${atmosphereClass}"></div>
    <div class="app-shell ${atmosphereClass}">
      ${buildTopbar()}
      ${state.entryAccepted ? buildMain() : buildEntry()}
      ${buildBondModal()}
    </div>
  `;
}

function buildTopbar() {
  const active = state.primarySpiritkin;
  return `
    <header class="topbar">
      <div class="topbar-brand">
        <div class="topbar-logo">SV</div>
        <div>
          <div class="topbar-name">Spiritverse</div>
          <div class="topbar-tag">${active ? esc(active.ui.realm) : "Primary Companion Bonding Interface"}</div>
        </div>
      </div>
      <div class="topbar-right">
        ${active ? `<div class="presence-chip ${esc(active.ui.cls)}">Bonded: ${esc(active.name)}</div>` : `<div class="presence-chip">Choose a companion</div>`}
        ${state.entryAccepted && state.primarySpiritkin ? `<button class="btn btn-ghost btn-sm" data-action="open-bond-manager">Manage bond</button>` : ""}
        ${state.entryAccepted && state.conversationId ? `<button class="btn btn-ghost btn-sm" data-action="new-session">New session</button>` : ""}
        ${state.entryAccepted && state.userName ? `<span class="topbar-user">${esc(state.userName)}</span>` : ""}
      </div>
    </header>
  `;
}

function buildEntry() {
  return `
    <section class="entry-screen">
      <div class="entry-copy">
        <div class="entry-glyph-wrap">
          <div class="entry-glyph">SV</div>
          <div class="entry-glyph-line">Spiritkins visual canon</div>
        </div>
        <p class="eyebrow">Spiritverse beta</p>
        <h1 class="entry-title">Choose the companion you want to bond with.</h1>
        <p class="entry-sub">
          Spiritkins are meant to feel bonded, not swappable. Your primary companion stays at the center of your session and conversation space.
        </p>
        <div class="entry-pillars">
          <span class="entry-pillar">One bonded companion</span>
          <span class="entry-pillar">Memory-aware</span>
          <span class="entry-pillar">Intentional rebonding</span>
          <span class="entry-pillar">Preserved conversation flow</span>
        </div>
        <div class="entry-cta">
          <div class="entry-name-row">
            <input
              type="text"
              placeholder="Your name (optional)"
              data-field="entry-name"
              value="${esc(state.userNameDraft)}"
              maxlength="40"
            />
          </div>
          <button class="btn btn-primary btn-wide" data-action="continue">Enter the bond chamber</button>
          <p class="entry-disclaimer">Your primary companion can be changed later, but only through an explicit rebonding step.</p>
        </div>
      </div>
      <div class="entry-gallery">
        <div class="entry-gallery-head">
          <div class="panel-label">Canonical companions</div>
          <div class="entry-gallery-note">Earlier Spiritkins visual language, carried forward into the bonded flow.</div>
        </div>
        ${["Lyra", "Raien", "Kairo"].map((name) => {
          const meta = getMeta(name);
          return `
            <article class="entry-spirit ${esc(meta.cls)}">
              ${buildSigil(meta, "mini", meta.symbol)}
              ${buildPortrait(name, "portrait-mini", meta.cls)}
              <div class="entry-spirit-copy">
                <span>${esc(meta.symbol)}</span>
                <strong>${esc(name)}</strong>
                <p>${esc(meta.realmText)}</p>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function buildMain() {
  if (state.loadingSpirits && state.spiritkins.length === 0) {
    return `<div class="loading-state"><div class="spinner"></div><p>Summoning bonded companions into view...</p></div>`;
  }

  if (state.spiritError && state.spiritkins.length === 0) {
    return `
      <div class="soft-error soft-error-block">
        Could not reach the Spiritverse: ${esc(state.spiritError)}
        <button class="btn btn-ghost btn-sm" data-action="retry-load">Try again</button>
      </div>
    `;
  }

  syncPrimarySelection();

  if (state.conversationId && state.selectedSpiritkin) {
    return buildChatView();
  }

  return state.primarySpiritkin ? buildBondedHomeView() : buildBondSelectionView();
}

function buildBondSelectionView() {
  return `
    <section class="selection-view">
      <div class="selection-hero">
        <div class="selection-copy">
          <p class="eyebrow">Choose your primary companion</p>
          <h2>Bond once. Let one Spiritkin hold the center.</h2>
          <p>
            This choice sets the primary companion for your active sessions. Conversations stay anchored to that bond until you intentionally rebond.
          </p>
        </div>
        ${state.pendingBondSpiritkin ? buildBondPreview(state.pendingBondSpiritkin, true) : `
          <div class="selection-focus selection-placeholder">
            <div class="selection-placeholder-mark">Bond</div>
            <p>Select Lyra, Raien, or Kairo and confirm your primary companion.</p>
          </div>
        `}
      </div>

      <div class="selection-heading">
        <div>
          <div class="panel-label">Companion stage</div>
          <p class="selection-note">The visual canon stays intact: each Spiritkin keeps a distinct sigil, aura, and realm identity.</p>
        </div>
      </div>

      <div class="spiritkin-grid">
        ${state.spiritkins.map((spiritkin, index) => buildBondCard(spiritkin, index, false)).join("")}
      </div>

      <div class="selection-footer">
        <div>
          <div class="mode-pill">Primary companion model</div>
          <p class="selection-note">Your chosen Spiritkin becomes the center of the interface and owns the active conversation.</p>
        </div>
        ${state.pendingBondSpiritkin ? `
          <button class="btn btn-primary" data-action="confirm-primary">
            Bond with ${esc(state.pendingBondSpiritkin.name)}
          </button>
        ` : ""}
      </div>
      ${buildSvStrip()}
    </section>
  `;
}

function buildBondedHomeView() {
  const spiritkin = state.primarySpiritkin;
  return `
    <section class="selection-view bonded-home ${esc(spiritkin.ui.cls)}">
      <div class="selection-hero bonded-hero">
        ${buildBondPreview(spiritkin, false)}
        <div class="bond-home-copy panel-card">
          <p class="eyebrow">Primary companion</p>
          <h2>${esc(spiritkin.name)} holds the center of this space.</h2>
          <div class="bond-home-realm">${esc(spiritkin.ui.realm)}</div>
          <p>
            Sessions and conversations now belong to ${esc(spiritkin.name)}. To switch, use Manage bond and confirm a rebonding decision.
          </p>
          <p class="bond-home-atmosphere">${esc(spiritkin.ui.realmText)}</p>
          <div class="bond-home-atlas">${esc(spiritkin.ui.atmosphereLine)}</div>
          <div class="bonded-actions">
            <button class="btn btn-primary" data-action="begin" ${state.loadingConv ? "disabled" : ""}>
              ${state.loadingConv ? "Opening bonded channel..." : `Begin with ${esc(spiritkin.name)}`}
            </button>
            <button class="btn btn-ghost" data-action="open-bond-manager">Manage bond</button>
          </div>
        </div>
      </div>
      <div class="bonded-secondary-grid">
        ${state.spiritkins.filter((item) => item.name !== spiritkin.name).map((item, index) => buildBondCard(item, index, true)).join("")}
      </div>
      ${state.convError ? `<div class="soft-error">${esc(state.convError)}</div>` : ""}
      ${buildSvStrip()}
    </section>
  `;
}

function buildBondPreview(spiritkin, pending) {
  const essence = Array.isArray(spiritkin.essence) ? spiritkin.essence.slice(0, 3) : [];
  return `
    <div class="selection-focus ${esc(spiritkin.ui.cls)} ${pending ? "pending" : "bonded"}">
      <div class="selection-focus-stage">
        ${buildSigil(spiritkin.ui, "focus", spiritkin.ui.symbol)}
        ${buildPortrait(spiritkin.name, "portrait-focus", spiritkin.ui.cls)}
      </div>
      <div class="selection-focus-copy">
        <div class="focus-kicker">${pending ? "Pending bond" : "Bonded companion"}</div>
        <h3>${esc(spiritkin.name)}</h3>
        <div class="focus-realm">${esc(spiritkin.ui.realm)}</div>
        <p>${esc(spiritkin.title || spiritkin.ui.bondLine)}</p>
        <div class="focus-tags">${essence.map((item) => `<span>${esc(item)}</span>`).join("")}</div>
        <div class="focus-tone">${esc(describePresence(spiritkin) || spiritkin.ui.bondLine)}</div>
        <div class="focus-atmosphere">${esc(spiritkin.ui.realmText)}</div>
      </div>
    </div>
  `;
}

function buildBondCard(spiritkin, index, subdued) {
  const activeBond = state.primarySpiritkin?.name === spiritkin.name;
  const pending = state.pendingBondSpiritkin?.name === spiritkin.name;
  const essence = Array.isArray(spiritkin.essence) ? spiritkin.essence.slice(0, 3) : [];
  const action = activeBond ? "bonded-card" : subdued ? "request-rebond" : "preview-primary";
  return `
    <article class="sk-card ${esc(spiritkin.ui.cls)} ${activeBond ? "bonded" : ""} ${pending ? "pending" : ""} ${subdued ? "subdued" : ""}" data-action="${action}" data-index="${index}" data-name="${esc(spiritkin.name)}">
      <div class="sk-card-top">
        <div>
          <div class="sk-mood">${esc(spiritkin.ui.mood)}</div>
          <div class="sk-name">${esc(spiritkin.name)}</div>
          <div class="sk-title">${esc(spiritkin.title || "")}</div>
        </div>
        ${activeBond ? `<div class="sk-selected-badge">Bonded</div>` : pending ? `<div class="sk-pending-badge">Pending</div>` : ""}
      </div>
      ${buildSigil(spiritkin.ui, "card", spiritkin.ui.symbol)}
      ${buildPortrait(spiritkin.name, "portrait-card", spiritkin.ui.cls)}
      <div class="sk-role">${esc(spiritkin.role || spiritkin.ui.bondLine)}</div>
      <div class="sk-essence">${essence.map((item) => `<span>${esc(item)}</span>`).join("")}</div>
      <p class="sk-tone">${esc(describePresence(spiritkin) || spiritkin.ui.strap)}</p>
      <div class="sk-footer-note">${activeBond ? "This companion owns your active sessions." : subdued ? "Available only through rebonding." : "Preview and confirm to bond."}</div>
    </article>
  `;
}

function buildChatView() {
  const spiritkin = state.selectedSpiritkin;
  const meta = spiritkin.ui;
  const signals = getStageSignals();
  const failed = [...state.messages].reverse().find((message) => message.role === "user" && message.status === "failed");
  const showPrompts = state.messages.length === 0 && !state.loadingReply;
  return `
    <section class="chat-layout ${esc(meta.cls)}">
      <aside class="presence-panel">
        <div class="presence-panel-head">
          <div class="mode-pill strong">Bonded conversation mode</div>
          <button class="btn btn-ghost btn-sm" data-action="open-bond-manager">Manage bond</button>
        </div>
        <div class="presence-stage">
          ${buildSigil(meta, "hero", meta.symbol)}
          ${buildPortrait(spiritkin.name, "portrait-hero", meta.cls)}
        </div>
        <div class="presence-summary">
          <div class="focus-kicker">${esc(meta.ambient)}</div>
          <h2>${esc(spiritkin.name)}</h2>
          <div class="presence-realm">${esc(meta.realm)}</div>
          <p class="presence-title">${esc(spiritkin.title || spiritkin.role || meta.strap)}</p>
          <p class="presence-text">${esc(describePresence(spiritkin) || meta.bondLine)}</p>
          <p class="presence-atmosphere">${esc(meta.realmText)}</p>
        </div>
        <div class="presence-bond-banner">This session is bonded to ${esc(spiritkin.name)}.</div>
        <div class="presence-stats">
          <div><span>Primary companion</span><strong>${esc(spiritkin.name)}</strong></div>
          <div><span>Conversation</span><strong>${esc(state.conversationId)}</strong></div>
        </div>
        <div class="presence-prompts">
          <div class="panel-label">Suggested openings</div>
          ${(meta.prompts || DEFAULT_PROMPTS).map((prompt) => `
            <button class="prompt-card" data-action="prompt" data-prompt="${esc(prompt)}">${esc(prompt)}</button>
          `).join("")}
        </div>
      </aside>

      <div class="chat-stage">
        <div class="chat-header-bar">
          <div class="chat-header-info">
            ${buildSigil(meta, "header", meta.symbol)}
            <div>
            <div class="chat-mode-label">Bonded companion</div>
            <div class="chat-sk-name">${esc(spiritkin.name)}</div>
            <div class="chat-sk-sub">${esc(spiritkin.title || spiritkin.role || "")}</div>
            ${(signals.emotionTone || signals.sceneName) ? `
              <div class="chat-signals">
                ${signals.emotionTone ? `
                  <div class="chat-signal">
                    <span class="chat-signal-label">Resonance</span>
                    <strong>${esc(signals.emotionTone)}</strong>
                  </div>
                ` : ""}
                ${signals.sceneName ? `
                  <div class="chat-signal">
                    <span class="chat-signal-label">Scene</span>
                    <strong>${esc(signals.sceneName)}</strong>
                  </div>
                ` : ""}
              </div>
            ` : ""}
            </div>
          </div>
          <div class="chat-header-right">
            <div class="presence-chip ${esc(meta.cls)}">${esc(meta.symbol)}</div>
            <div class="status-chip ${state.loadingReply ? "live" : ""}">${esc(state.loadingReply ? "Receiving reply" : "Ready for message")}</div>
          </div>
        </div>
        <div class="stage-atmosphere ${esc(meta.cls)}">
          <div class="stage-atmosphere-mark">${esc(meta.realm)}</div>
          <div class="stage-atmosphere-text">
            ${esc(meta.atmosphereLine)}
            ${signals.sceneName ? `<span>Scene held: ${esc(signals.sceneName)}</span>` : ""}
          </div>
        </div>

        ${showPrompts ? `
          <div class="starter-prompts">
            ${(meta.prompts || DEFAULT_PROMPTS).map((prompt) => `
              <button data-action="prompt" data-prompt="${esc(prompt)}">${esc(prompt)}</button>
            `).join("")}
          </div>
        ` : ""}

        <div class="thread-wrap">
          <div class="thread">
            ${state.messages.length === 0 && !state.loadingReply ? `
              <div class="thread-empty">
                <div class="thread-empty-mark">${esc(meta.symbol)}</div>
                <p>${esc(spiritkin.name)} is present as your primary companion. Begin when you are ready.</p>
              </div>
            ` : state.messages.map((message) => buildBubble(message, spiritkin)).join("")}

            ${state.loadingReply ? `
              <div class="bubble assistant loading ${esc(meta.cls)}">
                <div class="bubble-role">${esc(spiritkin.name)}</div>
                <div class="typing-dots"><span></span><span></span><span></span></div>
              </div>
            ` : ""}
          </div>
        </div>

        ${failed ? `
          <div class="retry-banner">
            <span>Message not delivered. Retry within the same bonded conversation.</span>
            <button class="btn btn-ghost btn-sm" data-action="retry">Retry</button>
          </div>
        ` : ""}

        <div class="composer-bar">
          <div class="composer-context">
            <div class="composer-label">Speak with ${esc(spiritkin.name)}</div>
            <div class="composer-sub">This bonded channel stays with your primary companion.</div>
          </div>
          <textarea
            data-field="chat-input"
            placeholder="Type naturally. ${esc(spiritkin.name)} will answer here."
            rows="1"
            ${state.loadingReply ? "disabled" : ""}
          ></textarea>
          <button class="composer-send" data-action="send" ${state.loadingReply || !state.conversationId ? "disabled" : ""} title="Send message">Send</button>
        </div>

        ${state.statusText ? `<div class="status-bar ${state.statusError ? "error" : ""}">${esc(state.statusText)}</div>` : ""}
      </div>
    </section>
  `;
}

function buildBubble(message, spiritkin) {
  const memoryResonance = message.role === "assistant" && message.memoryActive ? `
    <div class="bubble-resonance">
      <span class="bubble-resonance-mark">Memory resonance</span>
    </div>
  ` : "";
  const rated = state.ratings[message.id];
  const feedback = message.role === "assistant" ? `
    <div class="bubble-thumbs">
      <button class="thumb ${rated === "up" ? "active" : ""}" data-action="thumb-up" data-msg-id="${message.id}" ${rated ? "disabled" : ""}>Helpful</button>
      <button class="thumb ${rated === "down" ? "active" : ""}" data-action="thumb-down" data-msg-id="${message.id}" ${rated ? "disabled" : ""}>Off</button>
    </div>
  ` : "";
  return `
    <article class="bubble ${esc(message.role)} ${message.status === "failed" ? "failed" : ""} ${message.role === "assistant" ? esc(spiritkin.ui.cls) : ""}">
      <div class="bubble-role">${message.role === "user" ? esc(state.userName || "You") : esc(message.spiritkinName || spiritkin.name)}</div>
      ${memoryResonance}
      <p>${esc(message.content)}</p>
      <div class="bubble-meta">
        <span class="${message.status === "failed" ? "bubble-failed" : "bubble-time"}">${message.status === "failed" ? "Not delivered" : fmtTime(message.time)}</span>
        ${feedback}
      </div>
    </article>
  `;
}

function buildBondModal() {
  if (!state.rebondSpiritkin) return "";
  const target = state.rebondSpiritkin;
  return `
    <div class="modal-scrim" data-action="close-bond-modal">
      <div class="bond-modal ${esc(target.ui.cls)}" data-action="noop">
        <div class="bond-modal-head">
          <div>
            <div class="eyebrow">Intentional rebonding</div>
            <h3>Switch your primary companion to ${esc(target.name)}?</h3>
          </div>
          <button class="btn btn-ghost btn-sm" data-action="close-bond-modal">Close</button>
        </div>
        <div class="bond-modal-body">
          ${buildPortrait(target.name, "portrait-mini", target.ui.cls)}
          <div>
            <div class="bond-modal-realm">${esc(target.ui.realm)}</div>
            <p>Rebonding will end the current bonded session view, clear the active conversation in this app, and make ${esc(target.name)} the new primary companion.</p>
            <p>This keeps switching intentional instead of casual in-session hopping.</p>
          </div>
        </div>
        <div class="bond-modal-actions">
          <button class="btn btn-ghost" data-action="close-bond-modal">Cancel</button>
          <button class="btn btn-primary" data-action="confirm-rebond">Confirm rebonding</button>
        </div>
      </div>
    </div>
  `;
}

function buildSvStrip() {
  return `
    <div class="sv-strip">
      <div class="sv-strip-icon">SV</div>
      <div class="sv-strip-text">
        <strong>Spiritverse</strong> now treats Spiritkins as bonded companions. One primary companion stays centered until you explicitly choose to rebond.
      </div>
    </div>
  `;
}

function onInput(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  if (field === "entry-name") state.userNameDraft = event.target.value;
  if (field === "chat-input") {
    state.input = event.target.value;
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
  }
}

async function onClick(event) {
  const element = event.target.closest("[data-action]");
  if (!element) return;
  const action = element.dataset.action;

  if (action === "noop") return;

  if (action === "continue") {
    state.userName = state.userNameDraft.trim();
    state.entryAccepted = true;
    localStorage.setItem(ENTRY_KEY, "1");
    if (state.userName) localStorage.setItem(NAME_KEY, state.userName);
    render();
    return;
  }

  if (action === "preview-primary") {
    const candidate = state.spiritkins[Number(element.dataset.index)] ?? null;
    state.pendingBondSpiritkin = candidate;
    state.statusText = candidate ? `${candidate.name} ready to become your primary companion.` : "";
    state.statusError = false;
    render();
    return;
  }

  if (action === "confirm-primary") {
    if (state.pendingBondSpiritkin) setPrimarySpiritkin(state.pendingBondSpiritkin);
    render();
    return;
  }

  if (action === "open-bond-manager") {
    state.conversationId = null;
    state.messages = [];
    state.pendingBondSpiritkin = null;
    state.rebondSpiritkin = null;
    state.statusText = state.primarySpiritkin
      ? `Bond manager opened. ${state.primarySpiritkin.name} remains primary until you confirm a rebonding choice.`
      : "";
    state.statusError = false;
    persistSession();
    render();
    return;
  }

  if (action === "request-rebond") {
    const candidate = state.spiritkins.find((spiritkin) => spiritkin.name === element.dataset.name) ?? null;
    if (candidate) {
      state.rebondSpiritkin = candidate;
      render();
    }
    return;
  }

  if (action === "bonded-card") {
    if (state.primarySpiritkin) {
      state.statusText = `${state.primarySpiritkin.name} is your bonded companion. Use Manage bond to switch intentionally.`;
      state.statusError = false;
      render();
    }
    return;
  }

  if (action === "close-bond-modal") {
    state.rebondSpiritkin = null;
    render();
    return;
  }

  if (action === "confirm-rebond") {
    if (state.rebondSpiritkin) setPrimarySpiritkin(state.rebondSpiritkin);
    render();
    return;
  }

  if (action === "begin") { await beginConversation(); return; }
  if (action === "send") { await sendMessage(); return; }
  if (action === "prompt") { await sendMessage(element.dataset.prompt || ""); return; }

  if (action === "retry") {
    const failed = [...state.messages].reverse().find((message) => message.role === "user" && message.status === "failed");
    if (failed) {
      state.messages = state.messages.filter((message) => message.id !== failed.id);
      await sendMessage(failed.content);
    }
    return;
  }

  if (action === "new-session") {
    startFreshSession();
    return;
  }

  if (action === "retry-load") { await fetchSpiritkins(); return; }
  if (action === "thumb-up") { submitFeedback(element.dataset.msgId, true); return; }
  if (action === "thumb-down") { submitFeedback(element.dataset.msgId, false); }
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  fetchSpiritkins();
  const root = document.getElementById("root");
  root.addEventListener("input", onInput);
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", (event) => {
    if (event.target.dataset.field === "chat-input" && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
});
