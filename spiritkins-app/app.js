const ALLOWED_SPIRITKINS = ["Lyra", "Raien", "Kairo"];
const SESSION_KEY = "spiritkins.session.v11";
const ENTRY_KEY = "spiritkins.entry.accepted";
const NAME_KEY = "spiritkins.profile.name";
const USER_ID_KEY = "spiritkins.user.id";
const PREFS_KEY = "spiritkins.prefs.v1";

const STARTER_PROMPTS = [
  "I need help settling my mind today.",
  "Help me find one grounded next step.",
  "Can we name what I might be avoiding?",
];

const BRAND = {
  Lyra: {
    aura: "lyra",
    title: "Lyra",
    essence: "Warmth • Grounding • Compassion",
    presence: "A calm, gentle companion for emotional steadiness.",
    fallbackImage: "",
  },
  Raien: {
    aura: "raien",
    title: "Raien",
    essence: "Courage • Clarity • Protection",
    presence: "A bold, focused companion for difficult decisions.",
    fallbackImage: "",
  },
  Kairo: {
    aura: "kairo",
    title: "Kairo",
    essence: "Wonder • Reflection • Imagination",
    presence: "A curious, expansive companion for perspective shifts.",
    fallbackImage: "",
  },
};

const readJson = (key, fallback = null) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};

const nowIso = () => new Date().toISOString();
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const escapeHtml = (s) => String(s ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const fallback = () => `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (!globalThis.crypto?.getRandomValues) return fallback();
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
};

function getOrCreateUserId() {
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const id = uuid();
  localStorage.setItem(USER_ID_KEY, id);
  return id;
}

function getBrand(name) {
  return BRAND[name] ?? {
    aura: "default",
    title: name || "Spiritkin",
    essence: "Mythic Companion",
    presence: "A reflective, emotionally attuned presence.",
    fallbackImage: "",
  };
}

function pickSpiritkinImage(sp) {
  return sp?.imageUrl || sp?.image_url || sp?.portraitUrl || sp?.portrait_url || sp?.avatar || sp?.image || "";
}

const state = {
  userId: getOrCreateUserId(),
  entryAccepted: Boolean(localStorage.getItem(ENTRY_KEY)),
  userName: localStorage.getItem(NAME_KEY) || "",
  userNameDraft: localStorage.getItem(NAME_KEY) || "",
  spiritkins: [],
  selectedSpiritkin: null,
  conversationId: null,
  messages: [],
  input: "",
  loading: false,
  loadingReply: false,
  softError: "",
  statusText: "Ready",
  startedAt: null,
  prefs: readJson(PREFS_KEY, { preferredSpiritkin: "" }),
  stage: "choose",
};

function persistState() {
  localStorage.setItem(NAME_KEY, state.userName);
  localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
  if (state.selectedSpiritkin && state.conversationId) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      selectedSpiritkin: state.selectedSpiritkin,
      conversationId: state.conversationId,
      messages: state.messages,
      startedAt: state.startedAt,
    }));
  }
}

function hydrateSession() {
  const session = readJson(SESSION_KEY);
  if (!session) return;
  state.selectedSpiritkin = session.selectedSpiritkin ?? null;
  state.conversationId = session.conversationId ?? null;
  state.messages = Array.isArray(session.messages) ? session.messages : [];
  state.startedAt = session.startedAt ?? null;
  state.stage = state.conversationId ? "chat" : "choose";
  state.statusText = "Welcome back. Your session is ready.";
}

async function fetchSpiritkins() {
  try {
    state.loading = true;
    state.softError = "";
    state.statusText = "Loading Spiritkins...";
    render();

    const res = await fetch("/v1/spiritkins");
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Unable to load Spiritkins.");

    state.spiritkins = (data.spiritkins ?? []).filter((s) => ALLOWED_SPIRITKINS.includes(s.name ?? s.id));

    if (!state.selectedSpiritkin && state.spiritkins.length) {
      state.selectedSpiritkin = state.spiritkins.find((s) => (s.name ?? s.id) === state.prefs.preferredSpiritkin) ?? state.spiritkins[0];
    }

    state.statusText = "Choose the companion that fits your moment.";
  } catch (err) {
    state.softError = err?.message ?? "Could not load Spiritkins.";
    state.statusText = "Connection needs retry.";
  } finally {
    state.loading = false;
    render();
  }
}

async function beginConversation() {
  if (!state.selectedSpiritkin) return;
  try {
    state.loading = true;
    state.softError = "";
    state.statusText = "Opening conversation...";
    render();

    const payload = {
      userId: state.userId,
      spiritkinName: state.selectedSpiritkin.name ?? state.selectedSpiritkin.id,
    };

    const res = await fetch("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Could not start conversation.");

    state.conversationId = data?.conversation?.id ?? null;
    state.messages = [];
    state.startedAt = nowIso();
    state.stage = "chat";
    state.prefs.preferredSpiritkin = state.selectedSpiritkin.name ?? state.selectedSpiritkin.id;
    state.statusText = "Conversation started. You can begin when ready.";
    persistState();
  } catch (err) {
    state.softError = err?.message ?? "Could not start conversation.";
    state.statusText = "Conversation unavailable.";
  } finally {
    state.loading = false;
    render();
  }
}

async function sendMessage(contentOverride) {
  const text = (contentOverride ?? state.input).trim();
  if (!text || !state.conversationId || !state.selectedSpiritkin) return;

  const outgoing = {
    id: uuid(),
    role: "user",
    content: text,
    spiritkinName: state.selectedSpiritkin.name,
    status: "sent",
    time: nowIso(),
  };

  state.messages.push(outgoing);
  state.input = "";
  state.loadingReply = true;
  state.softError = "";
  state.statusText = "Your Spiritkin is responding...";
  persistState();
  render();

  try {
    const payload = { userId: state.userId, input: text, conversationId: state.conversationId };
    const res = await fetch("/v1/interact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Message interrupted.");

    state.messages.push({
      id: uuid(),
      role: "assistant",
      content: data?.output ?? data?.response?.text ?? data?.response ?? "…",
      spiritkinName: state.selectedSpiritkin.name,
      status: "sent",
      time: nowIso(),
    });

    state.statusText = "Reply received.";
  } catch (err) {
    state.messages = state.messages.map((m) => (m.id === outgoing.id ? { ...m, status: "failed" } : m));
    state.softError = err?.message ?? "Reply interrupted.";
    state.statusText = "Retry available.";
  } finally {
    state.loadingReply = false;
    persistState();
    render();
  }
}

function renderEntry() {
  if (state.entryAccepted) return "";
  return `
    <section class="entry card">
      <p class="eyebrow">Spiritkins Beta</p>
      <h2>Welcome to Spiritverse</h2>
      <p>Choose your display name and enter a premium companion experience designed for reflection.</p>
      <label class="field">
        <span>Your name (optional)</span>
        <input data-field="entry-name" value="${escapeHtml(state.userNameDraft)}" placeholder="How should we address you?" />
      </label>
      <button class="primary" data-action="continue">Enter Spiritverse</button>
    </section>
  `;
}

function renderSpiritkinCard(sp, index) {
  const name = sp.name ?? sp.id;
  const brand = getBrand(name);
  const selected = (state.selectedSpiritkin?.name ?? state.selectedSpiritkin?.id) === name;
  const image = pickSpiritkinImage(sp) || brand.fallbackImage;

  return `
    <button class="spiritkin-card ${brand.aura} ${selected ? "selected" : ""}" data-action="select-spiritkin" data-index="${index}">
      <div class="spiritkin-art ${image ? "has-image" : ""}">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" />` : `<span>${escapeHtml(name.slice(0, 1))}</span>`}
      </div>
      <div class="spiritkin-meta">
        <p class="spiritkin-eyebrow">${escapeHtml(brand.essence)}</p>
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(sp.essence ?? sp.description ?? brand.presence)}</p>
      </div>
    </button>
  `;
}

function renderChatStage() {
  const hasSession = Boolean(state.selectedSpiritkin && state.conversationId);
  const brand = getBrand(state.selectedSpiritkin?.name);
  const failedMessage = [...state.messages].reverse().find((m) => m.role === "user" && m.status === "failed");

  return `
    <section class="chat-stage card ${brand.aura}">
      <header class="chat-header">
        <div>
          <p class="eyebrow">Active Companion</p>
          <h2>${escapeHtml(state.selectedSpiritkin?.name || "Spiritkin")}</h2>
          <p class="presence">${escapeHtml(brand.presence)}</p>
        </div>
        <div class="session-meta">
          <p><strong>Conversation</strong><span>${escapeHtml(state.conversationId || "—")}</span></p>
          <p><strong>Started</strong><span>${fmtTime(state.startedAt)}</span></p>
          <button data-action="change-companion" ${state.loadingReply ? "disabled" : ""}>Change Spiritkin</button>
        </div>
      </header>

      ${hasSession && state.messages.length === 0 ? `
        <div class="starter-prompts">
          ${STARTER_PROMPTS.map((p) => `<button data-action="prompt" data-prompt="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}
        </div>
      ` : ""}

      <section class="thread" id="thread">
        ${state.messages.length === 0
          ? `<p class="empty-thread">This is your new conversation space. Send your first message below.</p>`
          : state.messages.map((m) => `
            <article class="bubble ${m.role === "user" ? "user" : "assistant"}">
              <span class="role">${m.role === "user" ? "You" : escapeHtml(m.spiritkinName || "Spiritkin")}</span>
              <p>${escapeHtml(m.content)}</p>
              <small>${m.status === "failed" ? "Not delivered" : new Date(m.time).toLocaleTimeString()}</small>
            </article>
          `).join("")}
      </section>

      ${failedMessage ? `<div class="warning"><span>Last message failed to send.</span><button data-action="retry">Retry</button></div>` : ""}

      <section class="composer-wrap">
        <label for="composerInput">Message</label>
        <textarea id="composerInput" data-field="chat-input" placeholder="Share what you’re feeling, wondering, or working through..." ${!hasSession ? "disabled" : ""}>${escapeHtml(state.input)}</textarea>
        <div class="composer-actions">
          <small>${escapeHtml(state.statusText)}</small>
          <button class="primary" data-action="send" ${state.loadingReply || !state.input.trim() || !hasSession ? "disabled" : ""}>Send</button>
        </div>
      </section>
    </section>
  `;
}

function renderChooserStage() {
  return `
    <section class="chooser card">
      <div class="chooser-head">
        <div>
          <p class="eyebrow">Choose your Spiritkin</p>
          <h2>Three distinct presences, one conversation at a time</h2>
          <p>Pick the emotional style that fits this moment, then begin chat.</p>
        </div>
        <div class="chooser-actions">
          <button data-action="refresh-spiritkins" ${state.loading ? "disabled" : ""}>Refresh</button>
          <button class="primary" data-action="begin" ${state.loading || !state.selectedSpiritkin ? "disabled" : ""}>Begin Conversation</button>
        </div>
      </div>
      <div class="spiritkin-grid">${state.spiritkins.map(renderSpiritkinCard).join("")}</div>
    </section>
  `;
}

function render() {
  const root = document.getElementById("root");
  const selectedBrand = getBrand(state.selectedSpiritkin?.name);

  root.innerHTML = `
    <main class="app ${selectedBrand.aura}">
      <header class="topbar card">
        <div>
          <h1>Spiritkins</h1>
          <p>${state.userName ? `Welcome, ${escapeHtml(state.userName)}` : "Premium Beta"}</p>
        </div>
        <div class="top-actions">
          <span class="pill">User ${escapeHtml(state.userId.slice(0, 8))}</span>
          ${state.conversationId ? '<button data-action="clear-session">Start Fresh</button>' : ""}
          ${readJson(SESSION_KEY)?.conversationId && !state.conversationId ? '<button data-action="resume">Resume Session</button>' : ""}
        </div>
      </header>

      ${renderEntry()}

      <section class="hero card">
        <p class="eyebrow">Spiritverse Beta</p>
        <h2>Emotionally attuned companions for grounded reflection</h2>
        <p class="hero-copy">A warm, globally appealing companion experience with distinct Spiritkin identity and clear conversation flow.</p>
      </section>

      ${state.softError ? `<section class="error card">${escapeHtml(state.softError)}</section>` : ""}

      ${state.stage === "chat" ? renderChatStage() : renderChooserStage()}
    </main>
  `;
}

function onRootInput(e) {
  const field = e.target.dataset.field;
  if (!field) return;
  if (field === "entry-name" || field === "name") state.userNameDraft = e.target.value;
  if (field === "chat-input") state.input = e.target.value;
  persistState();
  render();
}

async function onRootClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === "continue") {
    localStorage.setItem(ENTRY_KEY, "1");
    state.entryAccepted = true;
    state.userName = state.userNameDraft.trim();
    localStorage.setItem(NAME_KEY, state.userName);
    state.statusText = "Access confirmed.";
  }

  if (action === "refresh-spiritkins") fetchSpiritkins();
  if (action === "select-spiritkin") state.selectedSpiritkin = state.spiritkins[Number(btn.dataset.index)] ?? state.selectedSpiritkin;
  if (action === "begin") beginConversation();
  if (action === "change-companion") {
    state.stage = "choose";
    state.conversationId = null;
    state.messages = [];
    state.startedAt = null;
    state.statusText = "Select another Spiritkin to begin again.";
  }
  if (action === "send") sendMessage();
  if (action === "prompt") state.input = btn.dataset.prompt || "";
  if (action === "retry") {
    const failed = [...state.messages].reverse().find((m) => m.role === "user" && m.status === "failed");
    if (failed) sendMessage(failed.content);
  }

  if (action === "clear-session") {
    localStorage.removeItem(SESSION_KEY);
    state.conversationId = null;
    state.messages = [];
    state.startedAt = null;
    state.stage = "choose";
    state.statusText = "Session cleared.";
  }

  if (action === "resume") {
    hydrateSession();
  }

  render();
}

document.addEventListener("DOMContentLoaded", () => {
  hydrateSession();
  fetchSpiritkins();
  render();

  const root = document.getElementById("root");
  root.addEventListener("input", onRootInput);
  root.addEventListener("change", onRootInput);
  root.addEventListener("click", (e) => { onRootClick(e); });
  root.addEventListener("keydown", (e) => {
    if (e.target.dataset.field === "chat-input" && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});
