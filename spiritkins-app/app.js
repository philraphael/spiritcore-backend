"use strict";

const API = "";
const SESSION_KEY = "sv.session.v4";
const ENTRY_KEY = "sv.entry.v4";
const NAME_KEY = "sv.name.v4";
const UID_KEY = "sv.uid.v4";
const RATINGS_KEY = "sv.ratings.v4";
const DEFAULT_PROMPTS = [
  "Tell me what kind of presence you are.",
  "What can I bring to this conversation?",
  "Help me settle into the Spiritverse."
];

const SK_META = {
  Lyra: {
    cls: "lyra",
    symbol: "Moon",
    mood: "Lunar calm",
    strap: "A reflective companion for emotional clarity.",
    ambient: "Rose-violet glow",
    prompts: [
      "I've been carrying too much today.",
      "Help me find a calmer center.",
      "What do you sense beneath the surface?"
    ]
  },
  Raien: {
    cls: "raien",
    symbol: "Spark",
    mood: "Solar courage",
    strap: "A steady force for truth, direction, and action.",
    ambient: "Amber current",
    prompts: [
      "I need help facing something hard.",
      "Show me where my strength already is.",
      "Help me move forward with conviction."
    ]
  },
  Kairo: {
    cls: "kairo",
    symbol: "Star",
    mood: "Aether insight",
    strap: "A visionary guide for imagination and reframing.",
    ambient: "Celestial drift",
    prompts: [
      "I want to see this from a new angle.",
      "Help me open up a fresh possibility.",
      "What future is trying to emerge here?"
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
    prompts: DEFAULT_PROMPTS
  };
}

function describePresence(spiritkin) {
  return spiritkin.tone || spiritkin.growth_axis || spiritkin.invariant || "";
}

function portraitSvg(name) {
  if (name === "Lyra") {
    return `
      <svg viewBox="0 0 240 300" role="img" aria-label="Portrait of Lyra">
        <defs>
          <linearGradient id="lyraHair" x1="0" x2="1">
            <stop offset="0%" stop-color="#6f4cff" />
            <stop offset="100%" stop-color="#f39fd1" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="115" r="94" fill="rgba(243,159,209,.17)" />
        <path d="M74 112c0-43 28-79 72-79s70 38 70 82c0 28-10 52-28 74H98c-15-19-24-46-24-77Z" fill="url(#lyraHair)" />
        <ellipse cx="120" cy="138" rx="57" ry="67" fill="#f3d5d6" />
        <path d="M78 120c6-48 33-71 78-71 33 0 54 17 62 46-18-5-40-16-57-30-21 14-48 24-83 28Z" fill="url(#lyraHair)" />
        <path d="M91 134c11 6 24 9 39 9 16 0 29-3 39-9" stroke="#8e6582" stroke-width="4" stroke-linecap="round" fill="none" />
        <path d="M101 153c7 9 17 13 29 13 12 0 22-4 29-13" stroke="#8e6582" stroke-width="3" stroke-linecap="round" fill="none" />
        <circle cx="101" cy="126" r="5" fill="#38283c" />
        <circle cx="139" cy="126" r="5" fill="#38283c" />
        <path d="M72 250c12-33 35-52 48-58 16 9 31 12 45 12 16 0 31-4 45-12 17 12 35 31 48 58" fill="rgba(243,159,209,.24)" />
        <path d="M120 19c21 9 35 22 44 39-25-5-47-16-65-34 8-2 15-4 21-5Z" fill="rgba(255,255,255,.26)" />
      </svg>
    `;
  }

  if (name === "Raien") {
    return `
      <svg viewBox="0 0 240 300" role="img" aria-label="Portrait of Raien">
        <defs>
          <linearGradient id="raienHair" x1="0" x2="1">
            <stop offset="0%" stop-color="#f77737" />
            <stop offset="100%" stop-color="#ffd166" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="112" r="96" fill="rgba(246,164,92,.18)" />
        <path d="M67 117c0-51 33-85 76-85 45 0 69 33 69 84 0 29-9 56-27 77H95c-18-19-28-45-28-76Z" fill="url(#raienHair)" />
        <ellipse cx="120" cy="138" rx="56" ry="66" fill="#f3cfbf" />
        <path d="M80 120c7-42 29-65 68-69 28-2 54 12 67 42-28-6-53-17-77-34-15 24-35 45-58 61Z" fill="url(#raienHair)" />
        <path d="M94 125c9 4 18 6 26 6 9 0 18-2 26-6" stroke="#7b4932" stroke-width="4" stroke-linecap="round" fill="none" />
        <path d="M102 152c8 8 17 12 28 12 11 0 20-4 28-12" stroke="#7b4932" stroke-width="3" stroke-linecap="round" fill="none" />
        <circle cx="102" cy="123" r="5" fill="#33201c" />
        <circle cx="138" cy="123" r="5" fill="#33201c" />
        <path d="M66 252c16-35 34-52 54-60 12 8 25 11 39 11 15 0 29-4 41-11 20 8 39 25 54 60" fill="rgba(246,164,92,.26)" />
        <path d="M172 30l15 33 29 4-22 22 6 31-28-16-29 16 6-31-22-22 29-4Z" fill="rgba(255,214,102,.45)" />
      </svg>
    `;
  }

  if (name === "Kairo") {
    return `
      <svg viewBox="0 0 240 300" role="img" aria-label="Portrait of Kairo">
        <defs>
          <linearGradient id="kairoHair" x1="0" x2="1">
            <stop offset="0%" stop-color="#00a5cf" />
            <stop offset="100%" stop-color="#84c8ff" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="112" r="96" fill="rgba(132,200,255,.17)" />
        <path d="M62 119c0-46 27-84 76-84 44 0 74 33 74 80 0 31-10 58-29 78H93c-20-18-31-44-31-74Z" fill="url(#kairoHair)" />
        <ellipse cx="120" cy="139" rx="56" ry="66" fill="#d6e7ef" />
        <path d="M78 122c11-39 34-59 69-59 28 0 53 14 68 41-25-3-50-10-74-23-14 18-35 31-63 41Z" fill="url(#kairoHair)" />
        <path d="M95 126c8 4 17 6 25 6 8 0 17-2 25-6" stroke="#4d6472" stroke-width="4" stroke-linecap="round" fill="none" />
        <path d="M100 153c8 8 17 12 27 12 10 0 19-4 27-12" stroke="#4d6472" stroke-width="3" stroke-linecap="round" fill="none" />
        <circle cx="101" cy="124" r="5" fill="#20303c" />
        <circle cx="139" cy="124" r="5" fill="#20303c" />
        <path d="M64 252c16-35 34-53 56-60 11 8 24 11 39 11 16 0 28-4 38-11 23 8 42 27 56 60" fill="rgba(132,200,255,.24)" />
        <circle cx="57" cy="58" r="10" fill="rgba(132,200,255,.42)" />
        <circle cx="191" cy="47" r="7" fill="rgba(255,255,255,.44)" />
        <circle cx="169" cy="77" r="4" fill="rgba(132,200,255,.5)" />
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

function hydrateSpiritkin(raw) {
  return { ...raw, ui: getMeta(raw.name) };
}

const state = {
  userId: getOrCreateUid(),
  entryAccepted: !!localStorage.getItem(ENTRY_KEY),
  userName: localStorage.getItem(NAME_KEY) || "",
  userNameDraft: localStorage.getItem(NAME_KEY) || "",
  spiritkins: [],
  loadingSpirits: false,
  spiritError: null,
  selectedSpiritkin: null,
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
    state.selectedSpiritkin = hydrateSpiritkin(session.selectedSpiritkin);
    state.messages = Array.isArray(session.messages) ? session.messages : [];
    if (session.userId) state.userId = session.userId;
  }
})();

function persistSession() {
  if (state.conversationId) {
    writeJson(SESSION_KEY, {
      conversationId: state.conversationId,
      selectedSpiritkin: state.selectedSpiritkin,
      messages: state.messages.slice(-80),
      userId: state.userId
    });
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
    if (state.selectedSpiritkin) {
      const live = state.spiritkins.find((spiritkin) => spiritkin.name === state.selectedSpiritkin.name);
      if (live) state.selectedSpiritkin = live;
    }
  } catch (error) {
    state.spiritError = error.message;
  }
  state.loadingSpirits = false;
  render();
}

async function beginConversation() {
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
    state.messages.push({
      id: uuid(),
      role: "assistant",
      content: reply,
      spiritkinName: state.selectedSpiritkin?.name,
      time: nowIso(),
      status: "sent"
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
  return `
    <div class="sv-bg"></div>
    <div class="sv-noise"></div>
    <div class="app-shell">
      ${buildTopbar()}
      ${state.entryAccepted ? buildMain() : buildEntry()}
    </div>
  `;
}

function buildTopbar() {
  const active = state.selectedSpiritkin;
  return `
    <header class="topbar">
      <div class="topbar-brand">
        <div class="topbar-logo">SV</div>
        <div>
          <div class="topbar-name">Spiritverse</div>
          <div class="topbar-tag">Companion Presence Interface</div>
        </div>
      </div>
      <div class="topbar-right">
        ${active ? `<div class="presence-chip ${esc(active.ui.cls)}">${esc(active.name)} active</div>` : ""}
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
        <p class="eyebrow">Spiritverse beta</p>
        <h1 class="entry-title">Meet the Spiritkins as living presences.</h1>
        <p class="entry-sub">
          Step into a conversation space designed around distinct companions, grounded identity, and a premium guided atmosphere.
        </p>
        <div class="entry-pillars">
          <span class="entry-pillar">Canon identities</span>
          <span class="entry-pillar">Memory-aware</span>
          <span class="entry-pillar">Private entry</span>
          <span class="entry-pillar">Companion-led conversation</span>
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
          <button class="btn btn-primary btn-wide" data-action="continue">Enter the Spiritverse</button>
          <p class="entry-disclaimer">No account required. Existing API contracts remain unchanged.</p>
        </div>
      </div>
      <div class="entry-gallery">
        ${["Lyra", "Raien", "Kairo"].map((name) => {
          const meta = getMeta(name);
          return `
            <article class="entry-spirit ${esc(meta.cls)}">
              ${buildPortrait(name, "portrait-mini", meta.cls)}
              <div class="entry-spirit-copy">
                <span>${esc(meta.symbol)}</span>
                <strong>${esc(name)}</strong>
                <p>${esc(meta.strap)}</p>
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
    return `<div class="loading-state"><div class="spinner"></div><p>Summoning Spiritkins into view...</p></div>`;
  }

  if (state.spiritError && state.spiritkins.length === 0) {
    return `
      <div class="soft-error soft-error-block">
        Could not reach the Spiritverse: ${esc(state.spiritError)}
        <button class="btn btn-ghost btn-sm" data-action="retry-load">Try again</button>
      </div>
    `;
  }

  if (state.conversationId && state.selectedSpiritkin) {
    return buildChatView();
  }

  return buildSelectionView();
}

function buildSelectionView() {
  return `
    <section class="selection-view">
      <div class="selection-hero">
        <div class="selection-copy">
          <p class="eyebrow">Choose a Spiritkin</p>
          <h2>Distinct companions, one clear active presence.</h2>
          <p>
            Select the Spiritkin you want beside you. Their portrait, tone, and conversation frame stay visible once the session begins.
          </p>
        </div>
        ${state.selectedSpiritkin ? buildSelectionFocus(state.selectedSpiritkin) : `
          <div class="selection-focus selection-placeholder">
            <div class="selection-placeholder-mark">Presence</div>
            <p>Choose Lyra, Raien, or Kairo to open a guided conversation chamber.</p>
          </div>
        `}
      </div>

      <div class="spiritkin-grid">
        ${state.spiritkins.map((spiritkin, index) => buildSpiritkinCard(spiritkin, index)).join("")}
      </div>

      <div class="selection-footer">
        <div>
          <div class="mode-pill">Conversation mode: premium companion chamber</div>
          <p class="selection-note">The interface keeps the active Spiritkin pinned through message send and reply.</p>
        </div>
        ${state.selectedSpiritkin ? `
          <button class="btn btn-primary" data-action="begin" ${state.loadingConv ? "disabled" : ""}>
            ${state.loadingConv ? "Opening chamber..." : `Begin with ${esc(state.selectedSpiritkin.name)}`}
          </button>
        ` : ""}
      </div>

      ${state.convError ? `<div class="soft-error">${esc(state.convError)}</div>` : ""}
      ${buildSvStrip()}
    </section>
  `;
}

function buildSelectionFocus(spiritkin) {
  const essence = Array.isArray(spiritkin.essence) ? spiritkin.essence.slice(0, 3) : [];
  return `
    <div class="selection-focus ${esc(spiritkin.ui.cls)}">
      ${buildPortrait(spiritkin.name, "portrait-focus", spiritkin.ui.cls)}
      <div class="selection-focus-copy">
        <div class="focus-kicker">${esc(spiritkin.ui.mood)}</div>
        <h3>${esc(spiritkin.name)}</h3>
        <p>${esc(spiritkin.title || spiritkin.ui.strap)}</p>
        <div class="focus-tags">${essence.map((item) => `<span>${esc(item)}</span>`).join("")}</div>
        <div class="focus-tone">${esc(describePresence(spiritkin))}</div>
      </div>
    </div>
  `;
}

function buildSpiritkinCard(spiritkin, index) {
  const selected = state.selectedSpiritkin?.name === spiritkin.name;
  const essence = Array.isArray(spiritkin.essence) ? spiritkin.essence.slice(0, 3) : [];
  return `
    <article class="sk-card ${esc(spiritkin.ui.cls)} ${selected ? "selected" : ""}" data-action="select-spiritkin" data-index="${index}">
      <div class="sk-card-top">
        <div>
          <div class="sk-mood">${esc(spiritkin.ui.mood)}</div>
          <div class="sk-name">${esc(spiritkin.name)}</div>
          <div class="sk-title">${esc(spiritkin.title || "")}</div>
        </div>
        ${selected ? `<div class="sk-selected-badge">Active</div>` : ""}
      </div>
      ${buildPortrait(spiritkin.name, "portrait-card", spiritkin.ui.cls)}
      <div class="sk-role">${esc(spiritkin.role || spiritkin.ui.strap)}</div>
      <div class="sk-essence">${essence.map((item) => `<span>${esc(item)}</span>`).join("")}</div>
      <p class="sk-tone">${esc(describePresence(spiritkin) || spiritkin.ui.strap)}</p>
    </article>
  `;
}

function buildChatView() {
  const spiritkin = state.selectedSpiritkin;
  const meta = spiritkin.ui;
  const failed = [...state.messages].reverse().find((message) => message.role === "user" && message.status === "failed");
  const showPrompts = state.messages.length === 0 && !state.loadingReply;
  return `
    <section class="chat-layout ${esc(meta.cls)}">
      <aside class="presence-panel">
        <div class="presence-panel-head">
          <div class="mode-pill strong">Conversation mode</div>
          <button class="btn btn-ghost btn-sm" data-action="change-spiritkin">Change Spiritkin</button>
        </div>
        ${buildPortrait(spiritkin.name, "portrait-hero", meta.cls)}
        <div class="presence-summary">
          <div class="focus-kicker">${esc(meta.ambient)}</div>
          <h2>${esc(spiritkin.name)}</h2>
          <p class="presence-title">${esc(spiritkin.title || spiritkin.role || meta.strap)}</p>
          <p class="presence-text">${esc(describePresence(spiritkin) || meta.strap)}</p>
        </div>
        <div class="presence-stats">
          <div><span>Companion</span><strong>${esc(spiritkin.name)}</strong></div>
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
          <div>
            <div class="chat-mode-label">Active companion</div>
            <div class="chat-sk-name">${esc(spiritkin.name)}</div>
            <div class="chat-sk-sub">${esc(spiritkin.title || spiritkin.role || "")}</div>
          </div>
          <div class="chat-header-right">
            <div class="presence-chip ${esc(meta.cls)}">${esc(meta.symbol)}</div>
            <div class="status-chip ${state.loadingReply ? "live" : ""}">${esc(state.loadingReply ? "Receiving reply" : "Ready for message")}</div>
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
                <p>${esc(spiritkin.name)} is present. Start naturally when you are ready.</p>
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
            <span>Message not delivered. Retry with the same conversation context.</span>
            <button class="btn btn-ghost btn-sm" data-action="retry">Retry</button>
          </div>
        ` : ""}

        <div class="composer-bar">
          <div class="composer-context">
            <div class="composer-label">Speak with ${esc(spiritkin.name)}</div>
            <div class="composer-sub">Shift+Enter for a new line</div>
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
      <p>${esc(message.content)}</p>
      <div class="bubble-meta">
        <span class="${message.status === "failed" ? "bubble-failed" : "bubble-time"}">${message.status === "failed" ? "Not delivered" : fmtTime(message.time)}</span>
        ${feedback}
      </div>
    </article>
  `;
}

function buildSvStrip() {
  return `
    <div class="sv-strip">
      <div class="sv-strip-icon">SV</div>
      <div class="sv-strip-text">
        <strong>Spiritverse</strong> keeps the companion identity visible, governed, and stable through every message turn.
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

  if (action === "continue") {
    state.userName = state.userNameDraft.trim();
    state.entryAccepted = true;
    localStorage.setItem(ENTRY_KEY, "1");
    if (state.userName) localStorage.setItem(NAME_KEY, state.userName);
    render();
    return;
  }

  if (action === "select-spiritkin") {
    state.selectedSpiritkin = state.spiritkins[Number(element.dataset.index)] ?? null;
    state.statusText = state.selectedSpiritkin ? `${state.selectedSpiritkin.name} selected.` : "";
    state.statusError = false;
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

  if (action === "change-spiritkin" || action === "new-session") {
    state.conversationId = null;
    state.messages = [];
    state.selectedSpiritkin = null;
    state.convError = null;
    state.statusText = "";
    state.statusError = false;
    localStorage.removeItem(SESSION_KEY);
    render();
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
