const ALLOWED_SPIRITKINS = ["Lyra", "Raien", "Kairo"];
const SESSION_KEY = "spiritkins.session.v10";
const ENTRY_KEY = "spiritkins.entry.accepted";
const NAME_KEY = "spiritkins.profile.name";
const USER_ID_KEY = "spiritkins.user.id";
const PREFS_KEY = "spiritkins.prefs.v1";

const STARTER_PROMPTS = [
  "I need help settling my mind today.",
  "Can we reflect on what I am carrying right now?",
  "Help me find one grounded next step.",
];

const BRAND_BY_SPIRITKIN = {
  Lyra: { aura: "lyra", tag: "Warmth • Grounding • Compassion", presence: "Gentle, warm, and steady." },
  Raien: { aura: "raien", tag: "Courage • Protection • Strength", presence: "Direct, protective, and brave." },
  Kairo: { aura: "kairo", tag: "Wonder • Imagination • Reflection", presence: "Curious, expansive, and reflective." },
};

const readJson = (k, fallback = null) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};
const nowIso = () => new Date().toISOString();
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const escapeHtml = (s) => String(s ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const uuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const b = new Uint8Array(16);
    globalThis.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }
  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

function getOrCreateUserId() {
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const id = uuid();
  localStorage.setItem(USER_ID_KEY, id);
  return id;
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
  sessionState: null,
  prefs: readJson(PREFS_KEY, { preferredSpiritkin: "" }),
};

function getBrand(name) {
  return BRAND_BY_SPIRITKIN[name] ?? { aura: "", tag: "Mythic companion", presence: "Attuned and thoughtful." };
}

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
  state.sessionState = "resumed";
}

async function fetchSpiritkins() {
  try {
    state.loading = true;
    state.softError = "";
    state.statusText = "Loading companions...";
    render();

    const res = await fetch("/v1/spiritkins");
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Unable to load Spiritkins.");

    state.spiritkins = (data.spiritkins ?? []).filter((s) => ALLOWED_SPIRITKINS.includes(s.name ?? s.id));
    if (!state.selectedSpiritkin && state.spiritkins.length) {
      state.selectedSpiritkin = state.spiritkins.find((s) => (s.name ?? s.id) === state.prefs.preferredSpiritkin) ?? state.spiritkins[0];
    }
    state.statusText = "Companions ready.";
  } catch (err) {
    state.softError = err?.message ?? "Could not load companions.";
    state.statusText = "Retry needed.";
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

    const payload = { userId: state.userId, spiritkinName: state.selectedSpiritkin.name ?? state.selectedSpiritkin.id };
    const res = await fetch("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Could not begin conversation.");

    state.conversationId = data?.conversation?.id ?? null;
    state.messages = [];
    state.startedAt = nowIso();
    state.sessionState = "new";
    state.prefs.preferredSpiritkin = state.selectedSpiritkin.name ?? state.selectedSpiritkin.id;
    state.statusText = "Conversation started.";
    persistState();
  } catch (err) {
    state.softError = err?.message ?? "Could not begin conversation.";
    state.statusText = "Conversation unavailable.";
  } finally {
    state.loading = false;
    render();
  }
}

async function sendMessage(contentOverride) {
  const text = (contentOverride ?? state.input).trim();
  if (!text || !state.conversationId || !state.selectedSpiritkin) return;

  const outgoing = { id: uuid(), role: "user", content: text, spiritkinName: state.selectedSpiritkin.name, status: "sent", time: nowIso() };
  state.messages.push(outgoing);
  state.input = "";
  state.loadingReply = true;
  state.softError = "";
  state.statusText = "Listening...";
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
    <section class="card entry">
      <p class="section-title">Welcome</p>
      <h3>Start your Spiritkins beta session</h3>
      <p>Choose a display name (optional), then continue into the conversation space.</p>
      <ol>
        <li>Set your display name.</li>
        <li>Pick a Spiritkin.</li>
        <li>Begin conversation.</li>
      </ol>
      <label class="field">
        <span>Your name (optional)</span>
        <input data-field="entry-name" value="${escapeHtml(state.userNameDraft)}" placeholder="How should we address you?" />
      </label>
      <button class="primary" data-action="continue">Continue as Beta User</button>
    </section>
  `;
}

function renderSidebar() {
  return `
    <aside class="card sidebar">
      <p class="section-title">Companions</p>
      <div class="spiritkin-grid">
        ${state.spiritkins.map((sp, i) => {
          const name = sp.name ?? sp.id;
          const b = getBrand(name);
          const selected = (state.selectedSpiritkin?.name ?? state.selectedSpiritkin?.id) === name;
          return `
            <button class="spiritkin ${b.aura} ${selected ? "selected" : ""}" data-action="select-spiritkin" data-index="${i}">
              <p class="tag">${b.tag}</p>
              <p class="name">${escapeHtml(name)}</p>
              <p class="essence">${escapeHtml(sp.essence ?? sp.description ?? sp.summary ?? b.presence)}</p>
            </button>
          `;
        }).join("")}
      </div>

      <div class="status ${state.softError ? "error" : state.conversationId ? "good" : ""}">${escapeHtml(state.softError || state.statusText)}</div>

      <div style="display:grid;gap:8px;margin-top:10px;">
        <button data-action="refresh-spiritkins" ${state.loading ? "disabled" : ""}>Refresh companions</button>
        <button class="primary" data-action="begin" ${state.loading || !state.selectedSpiritkin ? "disabled" : ""}>Begin conversation</button>
        ${state.conversationId ? '<button data-action="clear-session">Start fresh</button>' : ""}
        ${readJson(SESSION_KEY)?.conversationId && !state.conversationId ? '<button data-action="resume">Resume previous session</button>' : ""}
      </div>
    </aside>
  `;
}

function renderMain() {
  const hasSession = Boolean(state.selectedSpiritkin && state.conversationId);
  const brand = getBrand(state.selectedSpiritkin?.name);
  const failedMessage = [...state.messages].reverse().find((m) => m.role === "user" && m.status === "failed");

  return `
    <section class="card main">
      <div class="main-header">
        <div>
          <h3>${hasSession ? escapeHtml(state.selectedSpiritkin?.name) : "No active session"}</h3>
          <p>${hasSession ? `${brand.tag} • ${brand.presence}` : "Select a companion and start conversation."}</p>
          <p style="margin:4px 0 0;color:#8a78a7;font-size:.82rem;">Conversation: ${escapeHtml(state.conversationId || "—")}</p>
        </div>
        <div class="pill">Started: ${fmtTime(state.startedAt)}</div>
      </div>

      ${hasSession && state.messages.length === 0 ? `
        <div class="starter-prompts">
          ${STARTER_PROMPTS.map((p) => `<button data-action="prompt" data-prompt="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}
        </div>
      ` : ""}

      <div class="thread">
        ${state.messages.length === 0
          ? '<p style="color:#6d5b88;margin:0;">Try a starter prompt, or write your own message.</p>'
          : state.messages.map((m) => `
            <article class="bubble ${m.role === "user" ? "user" : "assistant"}">
              <span class="role">${m.role === "user" ? "You" : escapeHtml(m.spiritkinName ?? "Spiritkin")}</span>
              <p>${escapeHtml(m.content)}</p>
              <small>${m.status === "failed" ? "Not delivered" : new Date(m.time).toLocaleTimeString()}</small>
            </article>
          `).join("")}
      </div>

      ${failedMessage ? '<div class="status warn" style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;"><span>Last message did not send.</span><button data-action="retry">Retry</button></div>' : ""}

      <div class="composer">
        <textarea data-field="chat-input" placeholder="Share what you’re feeling, wondering, or working through..." ${!hasSession ? "disabled" : ""}>${escapeHtml(state.input)}</textarea>
        <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;">
          <label class="field" style="margin:0;min-width:220px;">
            <span>Display name</span>
            <input data-field="name" value="${escapeHtml(state.userNameDraft)}" placeholder="Optional" />
          </label>
          <button class="primary" data-action="send" ${state.loadingReply || !state.input.trim() || !hasSession ? "disabled" : ""}>Send</button>
        </div>
      </div>
    </section>
  `;
}

function render() {
  const root = document.getElementById("root");
  root.innerHTML = `
    <main class="app">
      <header class="card topbar">
        <div class="brand">
          <h1>Spiritkins</h1>
          <p>${state.userName ? `Companion beta • ${escapeHtml(state.userName)}` : "Companion beta"}</p>
        </div>
        <div class="actions">
          <span class="pill">User: ${escapeHtml(state.userId.slice(0, 8))}</span>
          <button data-action="save-name">Save name</button>
        </div>
      </header>

      <section class="card hero">
        <p class="kicker">Spiritkins • /app</p>
        <h2>Find the right companion for this moment</h2>
        <p>Each Spiritkin has a distinct emotional style. Choose intentionally, then keep a steady conversation with continuity.</p>
      </section>

      ${renderEntry()}

      <section class="layout">
        ${renderSidebar()}
        ${renderMain()}
      </section>

      <footer class="footer">Spiritkins beta • Calm, consistent companion experience.</footer>
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
    state.statusText = "Beta access confirmed.";
  }
  if (action === "save-name") {
    state.userName = state.userNameDraft.trim();
    persistState();
    state.statusText = "Name saved locally.";
  }
  if (action === "refresh-spiritkins") fetchSpiritkins();
  if (action === "select-spiritkin") state.selectedSpiritkin = state.spiritkins[Number(btn.dataset.index)] ?? state.selectedSpiritkin;
  if (action === "begin") beginConversation();
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
    state.statusText = "Session cleared.";
  }
  if (action === "resume") {
    hydrateSession();
    state.statusText = "Resumed previous session.";
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