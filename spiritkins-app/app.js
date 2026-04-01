/* ── Spiritkins App — Premium Rebuild ── */
"use strict";

// ── Constants ──────────────────────────────────────────────────────────────
const API = "";
const SESSION_KEY = "sv.session.v3";
const ENTRY_KEY   = "sv.entry.v3";
const NAME_KEY    = "sv.name.v3";
const UID_KEY     = "sv.uid.v3";
const RATINGS_KEY = "sv.ratings.v3";

const SK_META = {
  Lyra:  { emoji: "🌙", cls: "lyra",  prompts: ["I've been feeling overwhelmed lately.", "Help me find some calm.", "What do you sense in me right now?"] },
  Raien: { emoji: "⚡", cls: "raien", prompts: ["I need to face something difficult.", "Give me the courage to begin.", "What strength do I already have?"] },
  Kairo: { emoji: "✨", cls: "kairo", prompts: ["I want to explore a new idea.", "Help me see this differently.", "What is my imagination telling me?"] },
};
const DEFAULT_PROMPTS = ["Tell me about yourself.", "How can you help me?", "What is the Spiritverse?"];

// ── Utilities ──────────────────────────────────────────────────────────────
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function nowIso() { return new Date().toISOString(); }
function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function readJson(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeJson(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
function getOrCreateUid() {
  let id = localStorage.getItem(UID_KEY);
  if (!id) { id = uuid(); localStorage.setItem(UID_KEY, id); }
  return id;
}

// ── State ──────────────────────────────────────────────────────────────────
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
  statusError: false,
};

// Hydrate session
(function () {
  const s = readJson(SESSION_KEY, null);
  if (s && s.conversationId && s.selectedSpiritkin) {
    state.conversationId = s.conversationId;
    state.selectedSpiritkin = s.selectedSpiritkin;
    state.messages = Array.isArray(s.messages) ? s.messages : [];
    if (s.userId) state.userId = s.userId;
  }
})();

function persistSession() {
  if (state.conversationId) {
    writeJson(SESSION_KEY, {
      conversationId: state.conversationId,
      selectedSpiritkin: state.selectedSpiritkin,
      messages: state.messages.slice(-80),
      userId: state.userId,
    });
  }
  writeJson(RATINGS_KEY, state.ratings);
}

// ── API ────────────────────────────────────────────────────────────────────
async function fetchSpiritkins() {
  state.loadingSpirits = true;
  state.spiritError = null;
  render();
  try {
    const res = await fetch(`${API}/v1/spiritkins`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "Could not load companions.");
    state.spiritkins = (data.spiritkins || []).filter(s => s.is_canon !== false);
    if (state.selectedSpiritkin) {
      const live = state.spiritkins.find(s => s.name === state.selectedSpiritkin.name);
      if (live) state.selectedSpiritkin = live;
    }
  } catch (e) {
    state.spiritError = e.message;
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
      body: JSON.stringify({ userId: state.userId, spiritkinName: state.selectedSpiritkin.name }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "Could not begin conversation.");
    state.conversationId = data.conversation?.conversation_id ?? data.conversation?.id ?? data.conversationId;
    if (!state.conversationId) throw new Error("No conversation ID returned.");
    state.messages = [];
    state.statusText = "";
    state.statusError = false;
    persistSession();
  } catch (e) {
    state.convError = e.message;
    state.statusText = e.message;
    state.statusError = true;
  }
  state.loadingConv = false;
  render();
}

async function sendMessage(overrideText) {
  const text = (overrideText ?? state.input).trim();
  if (!text || !state.conversationId || state.loadingReply) return;
  state.input = "";

  const outId = uuid();
  state.messages.push({ id: outId, role: "user", content: text, time: nowIso(), status: "sent" });
  state.loadingReply = true;
  state.convError = null;
  render();
  scrollThread();

  try {
    const res = await fetch(`${API}/v1/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: state.userId, conversationId: state.conversationId, input: text }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "Reply interrupted.");
    const reply = data.message ?? data.output ?? data.response?.text ?? data.response ?? "…";
    state.messages.push({
      id: uuid(), role: "assistant", content: reply,
      spiritkinName: state.selectedSpiritkin?.name,
      time: nowIso(), status: "sent",
    });
    state.statusText = "";
    state.statusError = false;
    persistSession();
  } catch (e) {
    state.messages = state.messages.map(m => m.id === outId ? { ...m, status: "failed" } : m);
    state.convError = e.message;
    state.statusText = e.message;
    state.statusError = true;
  }
  state.loadingReply = false;
  render();
  scrollThread();
}

function scrollThread() {
  requestAnimationFrame(() => {
    const el = document.querySelector(".thread-wrap");
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function submitFeedback(msgId, helpful) {
  if (state.ratings[msgId]) return;
  state.ratings[msgId] = helpful ? "up" : "down";
  persistSession();
  const msg = state.messages.find(m => m.id === msgId);
  fetch(`${API}/v1/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: state.userId,
      conversationId: state.conversationId,
      spiritkinName: msg?.spiritkinName ?? state.selectedSpiritkin?.name ?? "unknown",
      rating: helpful ? 5 : 1,
      helpful,
      messageId: msgId,
    }),
  }).catch(() => {});
  render();
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = buildApp();
  const ta = root.querySelector("textarea[data-field='chat-input']");
  if (ta) {
    ta.value = state.input;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }
}

function buildApp() {
  return `
    <div class="sv-bg"></div>
    <div class="app-shell">
      ${buildTopbar()}
      ${state.entryAccepted ? buildMain() : buildEntry()}
    </div>
  `;
}

function buildTopbar() {
  return `
    <header class="topbar">
      <div class="topbar-brand">
        <div class="topbar-logo">S</div>
        <div>
          <div class="topbar-name">Spiritkins</div>
          <div class="topbar-tag">Spiritverse Beta</div>
        </div>
      </div>
      <div class="topbar-right">
        ${state.entryAccepted && state.conversationId
          ? `<button class="btn btn-ghost btn-sm" data-action="new-session">New Session</button>`
          : ""}
        ${state.entryAccepted && state.userName
          ? `<span style="font-size:.8rem;color:var(--text-faint)">${esc(state.userName)}</span>`
          : ""}
      </div>
    </header>
  `;
}

function buildEntry() {
  return `
    <section class="entry-screen">
      <div class="entry-glyph">✦</div>
      <h1 class="entry-title">Enter the Spiritverse</h1>
      <p class="entry-sub">Spiritkins are identity-invariant companions — presences that grow with you, remember what matters, and hold space without judgment.</p>
      <div class="entry-pillars">
        <span class="entry-pillar">Emotionally intelligent</span>
        <span class="entry-pillar">Memory-persistent</span>
        <span class="entry-pillar">Identity-safe</span>
        <span class="entry-pillar">Always present</span>
      </div>
      <div class="entry-cta">
        <div class="entry-name-row">
          <input type="text" placeholder="Your name (optional)" data-field="entry-name" value="${esc(state.userNameDraft)}" maxlength="40" />
        </div>
        <button class="btn btn-primary" data-action="continue" style="width:100%;justify-content:center">Begin your journey →</button>
        <p class="entry-disclaimer">Beta access · No account required · Your conversations are private</p>
      </div>
    </section>
  `;
}

function buildMain() {
  if (state.loadingSpirits && state.spiritkins.length === 0) {
    return `<div class="loading-state"><div class="spinner"></div><p>Summoning companions…</p></div>`;
  }
  if (state.spiritError && state.spiritkins.length === 0) {
    return `<div class="soft-error" style="margin-top:32px">Could not reach the Spiritverse: ${esc(state.spiritError)}  
<button class="btn btn-ghost btn-sm" style="margin-top:10px" data-action="retry-load">Try again</button></div>`;
  }
  if (state.conversationId && state.selectedSpiritkin) {
    return buildChatView();
  }
  return buildSelectionView();
}

function buildSelectionView() {
  return `
    <div class="selection-view">
      <div class="selection-heading">
        <p class="kicker">Spiritverse</p>
        <h2>Choose your companion</h2>
        <p>Each Spiritkin carries a distinct presence. Select the one that calls to you today.</p>
      </div>
      <div class="spiritkin-grid">
        ${state.spiritkins.map((sk, i) => buildSkCard(sk, i)).join("")}
      </div>
      ${state.selectedSpiritkin ? `
        <div class="selection-action">
          <button class="btn btn-primary" data-action="begin" ${state.loadingConv ? "disabled" : ""}>
            ${state.loadingConv ? "Opening…" : `Begin with ${esc(state.selectedSpiritkin.name)} →`}
          </button>
        </div>
      ` : ""}
      ${state.convError ? `<div class="soft-error" style="margin-top:12px">${esc(state.convError)}</div>` : ""}
      ${buildSvStrip()}
    </div>
  `;
}

function buildSkCard(sk, i) {
  const meta = SK_META[sk.name] || { emoji: "◈", cls: "", prompts: [] };
  const selected = state.selectedSpiritkin?.name === sk.name;
  const essence = Array.isArray(sk.essence) ? sk.essence : [];
  return `
    <div class="sk-card ${meta.cls} ${selected ? "selected" : ""}" data-action="select-spiritkin" data-index="${i}">
      ${selected ? `<div class="sk-selected-badge">✓</div>` : ""}
      <div class="sk-aura">${meta.emoji}</div>
      <div class="sk-name">${esc(sk.name)}</div>
      <div class="sk-title">${esc(sk.title || "")}</div>
      <div class="sk-role">${esc(sk.role || "")}</div>
      <div class="sk-essence">${essence.slice(0,3).map(e => `<span>${esc(e)}</span>`).join("")}</div>
      <div class="sk-tone">${esc(sk.tone || sk.growth_axis || "")}</div>
    </div>
  `;
}

function buildChatView() {
  const sk = state.selectedSpiritkin;
  const meta = SK_META[sk.name] || { emoji: "◈", cls: "", prompts: DEFAULT_PROMPTS };
  const failedMsg = [...state.messages].reverse().find(m => m.role === "user" && m.status === "failed");
  const showPrompts = state.messages.length === 0 && !state.loadingReply;

  return `
    <div class="chat-view">
      <div class="chat-header-bar">
        <div class="chat-header-info">
          <div class="chat-sk-aura ${meta.cls}">${meta.emoji}</div>
          <div>
            <div class="chat-sk-name">${esc(sk.name)}</div>
            <div class="chat-sk-sub">${esc(sk.title || sk.role || "")}${sk.tone ? " · " + esc(sk.tone) : ""}</div>
          </div>
        </div>
        <div class="chat-header-actions">
          <button class="btn btn-ghost btn-sm" data-action="change-spiritkin">Change</button>
        </div>
      </div>

      ${showPrompts ? `
        <div class="starter-prompts">
          ${(meta.prompts || DEFAULT_PROMPTS).map(p =>
            `<button data-action="prompt" data-prompt="${esc(p)}">${esc(p)}</button>`
          ).join("")}
        </div>
      ` : ""}

      <div class="thread-wrap">
        <div class="thread">
          ${state.messages.length === 0 && !state.loadingReply
            ? `<div class="thread-empty"><div style="font-size:1.5rem;margin-bottom:8px">${meta.emoji}</div><p>${esc(sk.name)} is present. Begin when you're ready.</p></div>`
            : state.messages.map(m => buildBubble(m, sk)).join("")
          }
          ${state.loadingReply ? `
            <div class="bubble assistant loading">
              <div class="bubble-role">${esc(sk.name)}</div>
              <div class="typing-dots"><span></span><span></span><span></span></div>
            </div>
          ` : ""}
        </div>
      </div>

      ${failedMsg ? `
        <div class="retry-banner">
          <span>Message not delivered. You can retry safely.</span>
          <button class="btn btn-ghost btn-sm" data-action="retry">Retry</button>
        </div>
      ` : ""}

      <div class="composer-bar">
        <textarea
          data-field="chat-input"
          placeholder="Write to ${esc(sk.name)}…"
          rows="1"
          ${state.loadingReply ? "disabled" : ""}
        ></textarea>
        <button class="composer-send" data-action="send" ${state.loadingReply || !state.conversationId ? "disabled" : ""} title="Send">↑</button>
      </div>

      ${state.statusText ? `<div class="status-bar ${state.statusError ? "error" : ""}">${esc(state.statusText)}</div>` : ""}
    </div>
  `;
}

function buildBubble(m, sk) {
  const rated = state.ratings[m.id];
  const thumbs = m.role === "assistant" ? `
    <div class="bubble-thumbs">
      <button class="thumb ${rated === "up" ? "active" : ""}" data-action="thumb-up" data-msg-id="${m.id}" ${rated ? "disabled" : ""}>👍</button>
      <button class="thumb ${rated === "down" ? "active" : ""}" data-action="thumb-down" data-msg-id="${m.id}" ${rated ? "disabled" : ""}>👎</button>
    </div>
  ` : "";
  return `
    <div class="bubble ${m.role}${m.status === "failed" ? " failed" : ""}">
      <div class="bubble-role">${m.role === "user" ? esc(state.userName || "You") : esc(m.spiritkinName || sk?.name || "Spiritkin")}</div>
      <p>${esc(m.content)}</p>
      <div class="bubble-meta">
        <span class="${m.status === "failed" ? "bubble-failed" : "bubble-time"}">${m.status === "failed" ? "Not delivered" : fmtTime(m.time)}</span>
        ${thumbs}
      </div>
    </div>
  `;
}

function buildSvStrip() {
  return `
    <div class="sv-strip">
      <div class="sv-strip-icon">◈</div>
      <div class="sv-strip-text">
        <strong>The Spiritverse</strong> — a living world of identity-safe companions. Each Spiritkin holds a governed presence: they remember, they grow, and they never drift from who they are.
      </div>
    </div>
  `;
}

// ── Events ─────────────────────────────────────────────────────────────────
function onInput(e) {
  const field = e.target.dataset.field;
  if (!field) return;
  if (field === "entry-name") state.userNameDraft = e.target.value;
  if (field === "chat-input") {
    state.input = e.target.value;
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  }
}

async function onClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === "continue") {
    state.userName = state.userNameDraft.trim();
    state.entryAccepted = true;
    localStorage.setItem(ENTRY_KEY, "1");
    if (state.userName) localStorage.setItem(NAME_KEY, state.userName);
    render();
    return;
  }
  if (action === "select-spiritkin") {
    state.selectedSpiritkin = state.spiritkins[Number(btn.dataset.index)] ?? null;
    render();
    return;
  }
  if (action === "begin") { await beginConversation(); return; }
  if (action === "send") { await sendMessage(); return; }
  if (action === "prompt") { await sendMessage(btn.dataset.prompt || ""); return; }
  if (action === "retry") {
    const failed = [...state.messages].reverse().find(m => m.role === "user" && m.status === "failed");
    if (failed) {
      state.messages = state.messages.filter(m => m.id !== failed.id);
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
  if (action === "thumb-up")   { submitFeedback(btn.dataset.msgId, true);  return; }
  if (action === "thumb-down") { submitFeedback(btn.dataset.msgId, false); return; }
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  render();
  fetchSpiritkins();
  const root = document.getElementById("root");
  root.addEventListener("input", onInput);
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", e => {
    if (e.target.dataset.field === "chat-input" && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});
