const ALLOWED_SPIRITKINS = ["Lyra", "Raien", "Kairo"];
const SESSION_KEY = "spiritkins.session.v10";
const ENTRY_KEY = "spiritkins.entry.accepted";
const NAME_KEY = "spiritkins.profile.name";
const USER_ID_KEY = "spiritkins.user.id";
const PREFS_KEY = "spiritkins.prefs.v1";
const FEEDBACK_KEY = "spiritkins.feedback.v1";

const STARTER_PROMPTS = [
  "I need help settling my mind today.",
  "Can we reflect on what I am carrying right now?",
  "Help me find one grounded next step.",
];

const SECTION_COPY = {
  companion: { title: "Companion Space", subtitle: "Stay grounded with continuity and your active Spiritkin relationship." },
  preferences: { title: "Preferences", subtitle: "Shape how the beta feels for you today. Settings are local and reversible." },
  feedback: { title: "Feedback Journal", subtitle: "Capture product notes as you use Spiritkins in beta." },
};

const BRAND_BY_SPIRITKIN = {
  Lyra: { aura: "lyra", tag: "Warmth • Grounding • Compassion", presence: "Grounded, gentle, and steady." },
  Raien: { aura: "raien", tag: "Courage • Protection • Strength", presence: "Clear, protective, and brave." },
  Kairo: { aura: "kairo", tag: "Wonder • Imagination • Reflection", presence: "Curious, expansive, and reflective." },
};

const nowIso = () => new Date().toISOString();
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const readJson = (k, fallback = null) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? fallback; } catch { return fallback; } };
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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

function getBrand(name) {
  return BRAND_BY_SPIRITKIN[name] ?? { aura: "default", tag: "Mythic Companion", presence: "Attuned and thoughtful." };
}

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
  isEditingName: false,
  activeSection: "companion",
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
  prefs: readJson(PREFS_KEY, { preferredSpiritkin: "", appTone: "balanced", reminderMode: "off" }),
  feedbackDraft: "",
  feedbackItems: readJson(FEEDBACK_KEY, []),
  debug: { jsLoaded: true, handlersAttached: false, lastAction: "init", lastPayload: null, lastResponse: null, lastError: null },
};

function persistState() {
  localStorage.setItem(NAME_KEY, state.userName);
  localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(state.feedbackItems));
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
  state.sessionState = { kind: "resumed", label: "Resumed previous session" };
  state.statusText = `Welcome back${state.userName ? `, ${state.userName}` : ""} — your session is ready.`;
}

async function fetchSpiritkins() {
  try {
    state.debug.lastAction = "fetchSpiritkins:start";
    state.loading = true;
    state.softError = "";
    state.statusText = "Loading companions...";
    render();
    const res = await fetch("/v1/spiritkins");
    const data = await res.json();
    state.debug.lastPayload = { method: "GET", path: "/v1/spiritkins" };
    state.debug.lastResponse = data;
    state.debug.lastError = null;
    if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Unable to load Spiritkins.");
    state.spiritkins = (data.spiritkins ?? []).filter((s) => ALLOWED_SPIRITKINS.includes(s.name ?? s.id));
    if (!state.selectedSpiritkin && state.spiritkins.length > 0) {
      state.selectedSpiritkin = state.spiritkins.find((s) => (s.name ?? s.id) === state.prefs.preferredSpiritkin) ?? state.spiritkins[0];
    }
    state.statusText = "Companions are available. Select the one that fits this moment.";
  } catch (err) {
    state.softError = err?.message ?? "We couldn’t load companions right now.";
    state.statusText = "Connection needs retry.";
    state.debug.lastError = state.softError;
  } finally {
    state.loading = false;
    render();
  }
}

async function beginConversation() {
  if (!state.selectedSpiritkin) return;
  try {
    state.debug.lastAction = "beginConversation:start";
    state.loading = true;
    state.softError = "";
    state.statusText = "Opening your conversation...";
    render();
    const payload = { userId: state.userId, spiritkinName: state.selectedSpiritkin.name ?? state.selectedSpiritkin.id };
    const res = await fetch("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    state.debug.lastPayload = { method: "POST", path: "/v1/conversations", body: payload };
    state.debug.lastResponse = data;
    state.debug.lastError = null;
    if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Could not begin a conversation yet.");
    state.conversationId = data?.conversation?.id ?? null;
    state.messages = [];
    state.startedAt = nowIso();
    state.sessionState = { kind: "new", label: "Started a new session" };
    state.prefs.preferredSpiritkin = state.selectedSpiritkin.name ?? state.selectedSpiritkin.id;
    state.statusText = "Conversation is ready. You can begin whenever it feels right.";
    persistState();
  } catch (err) {
    state.softError = err?.message ?? "We couldn’t open your conversation.";
    state.statusText = "Conversation unavailable.";
    state.debug.lastError = state.softError;
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
  state.statusText = "Your companion is preparing a response with care...";
  persistState();
  render();
  try {
    state.debug.lastAction = "sendMessage:start";
    const payload = {
      userId: state.userId,
      input: text,
      conversationId: state.conversationId,
    };
    const res = await fetch("/v1/interact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    state.debug.lastPayload = { method: "POST", path: "/v1/interact", body: payload };
    state.debug.lastResponse = data;
    state.debug.lastError = null;
    if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Message delivery was interrupted.");
    state.messages.push({ id: uuid(), role: "assistant", content: data?.output ?? data?.response?.text ?? data?.response ?? "…", spiritkinName: state.selectedSpiritkin.name, status: "sent", time: nowIso() });
    state.statusText = "Reply received.";
  } catch (err) {
    state.messages = state.messages.map((m) => (m.id === outgoing.id ? { ...m, status: "failed" } : m));
    state.softError = err?.message ?? "Something interrupted the reply. You can retry safely.";
    state.statusText = "Reply interrupted. Your message is safe, and retry is available.";
    state.debug.lastError = state.softError;
  } finally {
    state.loadingReply = false;
    persistState();
    render();
  }
}

function render() {
  const root = document.getElementById("root");
  const brand = getBrand(state.selectedSpiritkin?.name);
  const hasSession = Boolean(state.selectedSpiritkin && state.conversationId);
  const lastMessageAt = state.messages.length ? state.messages[state.messages.length - 1].time : null;
  const failedMessage = [...state.messages].reverse().find((m) => m.role === "user" && m.status === "failed");
  const filteredSpiritkins = state.spiritkins;

  root.innerHTML = `
    <main class="app-shell ${brand.aura}">
      <header class="topbar">
        <div class="brand"><strong>Spiritkins</strong><span>${state.userName ? `Companion Beta • ${escapeHtml(state.userName)}` : "Companion Beta"}</span></div>
        <div class="top-actions">
          ${!state.entryAccepted ? '<button data-action="continue">Continue</button>' : `<span class="active-pill">${state.userName ? `Hi, ${escapeHtml(state.userName)}` : "Beta User Active"}</span>`}
          <button data-action="toggle-name">Identity</button>
          <button disabled title="Coming soon">Sign in (Soon)</button>
        </div>
      </header>

      ${!state.entryAccepted ? `
        <section class="entry-card">
          <p class="kicker">Welcome</p>
          <h2>Begin your Spiritkins beta session</h2>
          <p>Spiritkins is for reflective, emotionally attuned check-ins. Start with beta access now, then continue with account features as invites expand.</p>
          <ol class="entry-steps"><li>Set your display name (optional).</li><li>Continue as Beta User.</li><li>Choose a Spiritkin and begin your first grounded conversation.</li></ol>
          <div class="entry-auth-rail"><button disabled>Sign In (Soon)</button><button disabled>Create Account (Soon)</button><span>Invite-based beta access is active today</span></div>
          <label class="field"><span>Your name (optional)</span><input data-field="entry-name" value="${escapeHtml(state.userNameDraft)}" placeholder="How should we address you?" /></label>
          <button class="primary" data-action="continue">Continue as Beta User</button>
        </section>` : ""}

      <section class="hero">
        <p class="kicker">Spiritkins • Beta</p><h1>Welcome${state.userName ? `, ${escapeHtml(state.userName)}` : ""}</h1>
        <p class="subtitle">Emotionally attuned, mythic-emotional companions designed to help you reconnect with clarity and care.</p>
        <p class="status-line">Status: ${escapeHtml(state.statusText)}</p>
      </section>

      <nav class="section-nav">
        ${Object.keys(SECTION_COPY).map((k) => `<button data-action="switch-section" data-section="${k}" class="${state.activeSection === k ? "active" : ""}"><span>${k[0].toUpperCase() + k.slice(1)}</span><small>${SECTION_COPY[k].title}</small></button>`).join("")}
      </nav>

      ${state.isEditingName ? `<section class="identity-edit"><label class="field"><span>Display name</span><input data-field="name" value="${escapeHtml(state.userNameDraft)}" /></label><div class="identity-actions"><button data-action="save-name">Save</button><button data-action="cancel-name">Cancel</button></div></section>` : ""}

      ${state.activeSection === "companion" ? `
      <section class="product-panel">
        ${state.sessionState ? `<div class="session-state session-${state.sessionState.kind}">${state.sessionState.label}</div>` : ""}
        <section class="lifecycle-rail"><span class="step ${state.entryAccepted ? "done" : "active"}">1. Access</span><span class="step ${state.selectedSpiritkin ? "done" : "active"}">2. Choose Companion</span><span class="step ${hasSession ? "done" : "active"}">3. Begin Conversation</span></section>
        <section class="meta-row"><div class="meta-card"><h4>Identity</h4><p><strong>Name:</strong> ${escapeHtml(state.userName || "Not set")}</p><p><strong>Beta user:</strong> ${escapeHtml(state.userId)}</p><p><strong>Session started:</strong> ${fmtTime(state.startedAt)}</p></div><div class="meta-card"><h4>Continuity</h4><p>${lastMessageAt ? `Picking up where we left off (${fmtTime(lastMessageAt)}).` : "Continuity appears once your first exchange is saved."}</p></div></section>
        <section class="session-bar"><div><p class="kicker">Session</p><p class="session-title">${hasSession ? `${escapeHtml(state.selectedSpiritkin?.name)} • Active` : "No active conversation"}</p><p class="session-sub">${hasSession ? `Conversation: ${escapeHtml(state.conversationId)}` : "Choose a companion to begin."}</p></div><div class="session-actions">${readJson(SESSION_KEY)?.conversationId && !hasSession ? '<button data-action="resume">Resume</button>' : ""}${hasSession ? '<button data-action="clear-session">Start Fresh</button>' : ""}</div></section>
        ${state.softError ? `<div class="error-banner">${escapeHtml(state.softError)}</div>` : ""}

        ${!hasSession ? `
          <section class="selection-panel"><div class="selection-header"><div><p class="kicker">Choose your companion</p><h2>Select the presence that fits today.</h2></div><button data-action="refresh-spiritkins" ${state.loading ? "disabled" : ""}>Refresh</button></div>
          <div class="spiritkin-grid">${filteredSpiritkins.map((sp, i) => { const name = sp.name ?? sp.id; const b = getBrand(name); return `<button id="spiritkin-${i}" class="spiritkin-card ${b.aura} ${(state.selectedSpiritkin?.name ?? state.selectedSpiritkin?.id) === name ? "selected" : ""}" data-index="${i}"><p class="spiritkin-tag">${b.tag}</p><h3>${escapeHtml(name)}</h3><p class="spiritkin-role">${escapeHtml(sp.role ?? sp.archetype ?? "Companion")}</p><p class="spiritkin-essence">${escapeHtml(sp.essence ?? sp.description ?? sp.summary ?? b.presence)}</p></button>`; }).join("")}</div>
          <button id="beginConversationBtn" class="primary" ${state.loading || !state.selectedSpiritkin ? "disabled" : ""}>Begin Conversation</button></section>` : `
          <section class="chat-panel">
            <header class="chat-header ${brand.aura}"><div><p class="kicker">Active Spiritkin</p><h2>${escapeHtml(state.selectedSpiritkin?.name)}</h2><p>${brand.tag}</p><p class="session-id">${brand.presence}</p></div><button data-action="change-spiritkin" ${state.loadingReply ? "disabled" : ""}>Change Spiritkin</button></header>
            <div class="starter-prompts">${state.messages.length === 0 ? STARTER_PROMPTS.map((p) => `<button data-action="prompt" data-prompt="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("") : ""}</div>
            <div class="thread">${state.messages.length === 0 ? '<p class="state">Try a starter prompt, or write your own message.</p>' : state.messages.map((m) => `<article class="bubble ${m.role === "user" ? "user" : "assistant"}"><span class="bubble-role">${m.role === "user" ? "You" : escapeHtml(m.spiritkinName ?? "Spiritkin")}</span><p>${escapeHtml(m.content)}</p>${m.status === "failed" ? '<span class="bubble-failed">Not delivered</span>' : `<span class="bubble-time">${new Date(m.time).toLocaleTimeString()}</span>`}</article>`).join("")}</div>
            ${failedMessage ? '<div class="retry-banner"><span>Last message didn’t send.</span><button data-action="retry">Retry</button></div>' : ""}
            <div class="composer"><textarea data-field="chat-input" placeholder="Share what you’re feeling, wondering, or working through...">${escapeHtml(state.input)}</textarea><button class="primary" data-action="send" ${state.loadingReply || !state.input.trim() ? "disabled" : ""}>Send</button></div>
          </section>`}
      </section>` : ""}

      ${state.activeSection === "preferences" ? `<section class="product-panel settings-panel"><h3>${SECTION_COPY.preferences.title}</h3><p class="settings-note">${SECTION_COPY.preferences.subtitle}</p><label class="field"><span>Display name</span><input data-field="name" value="${escapeHtml(state.userNameDraft)}" /></label><label class="field"><span>Preferred Spiritkin</span><select data-field="pref-spiritkin"><option value="">Auto</option>${ALLOWED_SPIRITKINS.map((n) => `<option ${state.prefs.preferredSpiritkin === n ? "selected" : ""} value="${n}">${n}</option>`).join("")}</select></label><label class="field"><span>App tone readiness</span><select data-field="pref-tone"><option value="balanced" ${state.prefs.appTone === "balanced" ? "selected" : ""}>Balanced</option><option value="gentle" ${state.prefs.appTone === "gentle" ? "selected" : ""}>Gentle</option><option value="direct" ${state.prefs.appTone === "direct" ? "selected" : ""}>Direct</option></select></label><button data-action="save-name">Save Local Preferences</button></section>` : ""}

      ${state.activeSection === "feedback" ? `<section class="product-panel feedback-panel"><h3>${SECTION_COPY.feedback.title}</h3><p class="settings-note">${SECTION_COPY.feedback.subtitle}</p><textarea data-field="feedback" placeholder="Share what felt helpful, unclear, or missing...">${escapeHtml(state.feedbackDraft)}</textarea><div class="feedback-actions"><button class="primary" data-action="save-feedback" ${!state.feedbackDraft.trim() ? "disabled" : ""}>Save Feedback</button><button data-action="clear-feedback" ${state.feedbackItems.length === 0 ? "disabled" : ""}>Clear History</button></div><div class="feedback-list">${state.feedbackItems.length === 0 ? '<p class="state">No saved feedback yet.</p>' : state.feedbackItems.map((f) => `<article><strong>${fmtTime(f.time)}</strong><p>${escapeHtml(f.text)}</p></article>`).join("")}</div></section>` : ""}

      <section class="product-panel">
        <h4>Debug</h4>
        <p><strong>JS loaded:</strong> ${state.debug.jsLoaded ? "yes" : "no"}</p>
        <p><strong>Handlers attached:</strong> ${state.debug.handlersAttached ? "yes" : "no"}</p>
        <p><strong>Last action:</strong> ${escapeHtml(state.debug.lastAction)}</p>
        <p><strong>Last error:</strong> ${escapeHtml(state.debug.lastError || "none")}</p>
        <pre>${escapeHtml(JSON.stringify({ payload: state.debug.lastPayload, response: state.debug.lastResponse }, null, 2))}</pre>
      </section>

      <section class="future-grid"><div><h4>Invite Flow</h4><p>Prepared for invitation and beta cohort onboarding.</p></div><div><h4>Sign In</h4><p>Prepared for secure account login when beta accounts open.</p></div><div><h4>Create Account</h4><p>Reserved for onboarding and consent steps.</p></div><div><h4>Saved Conversations</h4><p>Reserved layout for persistent history.</p></div><div><h4>Memory View</h4><p>UI foundation for memory-aware context.</p></div><div><h4>Settings</h4><p>Space for tone, notifications, and controls.</p></div></section>
      <footer class="footer-note">Spiritkins beta • A calm, trustworthy companion experience designed to support reflection over time.</footer>
    </main>`;
  wireCriticalHandlers();
}

function wireCriticalHandlers() {
  const beginBtn = document.getElementById("beginConversationBtn");
  if (beginBtn) {
    beginBtn.onclick = () => {
      state.debug.lastAction = "click:beginConversationBtn";
      beginConversation();
    };
  }
  state.spiritkins.forEach((_, i) => {
    const btn = document.getElementById(`spiritkin-${i}`);
    if (btn) {
      btn.onclick = () => {
        state.debug.lastAction = `click:spiritkin-${i}`;
        state.selectedSpiritkin = state.spiritkins[i] ?? state.selectedSpiritkin;
        render();
      };
    }
  });
}

function onRootInput(e) {
  const field = e.target.dataset.field;
  if (!field) return;
  if (field === "entry-name" || field === "name") state.userNameDraft = e.target.value;
  if (field === "chat-input") state.input = e.target.value;
  if (field === "feedback") state.feedbackDraft = e.target.value;
  if (field === "pref-spiritkin") state.prefs.preferredSpiritkin = e.target.value;
  if (field === "pref-tone") state.prefs.appTone = e.target.value;
  persistState();
  render();
}

async function onRootClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  state.debug.lastAction = `click:${action}`;
  if (action === "continue") {
    localStorage.setItem(ENTRY_KEY, "1");
    state.entryAccepted = true;
    state.userName = state.userNameDraft.trim();
    localStorage.setItem(NAME_KEY, state.userName);
    state.statusText = "Beta access confirmed. You can choose a companion whenever you’re ready.";
    render();
    return;
  }
  if (action === "toggle-name") state.isEditingName = !state.isEditingName;
  if (action === "cancel-name") { state.isEditingName = false; state.userNameDraft = state.userName; }
  if (action === "save-name") { state.userName = state.userNameDraft.trim(); state.isEditingName = false; state.statusText = state.userName ? `Identity updated for ${state.userName}.` : "Identity updated."; persistState(); }
  if (action === "switch-section") state.activeSection = btn.dataset.section;
  if (action === "refresh-spiritkins") fetchSpiritkins();
  if (action === "select-spiritkin") state.selectedSpiritkin = state.spiritkins[Number(btn.dataset.index)] ?? state.selectedSpiritkin;
  if (action === "begin") beginConversation();
  if (action === "change-spiritkin") { state.conversationId = null; state.messages = []; }
  if (action === "send") sendMessage();
  if (action === "prompt") { state.input = btn.dataset.prompt || ""; }
  if (action === "retry") { const failed = [...state.messages].reverse().find((m) => m.role === "user" && m.status === "failed"); if (failed) sendMessage(failed.content); }
  if (action === "clear-session") { localStorage.removeItem(SESSION_KEY); state.conversationId = null; state.messages = []; state.startedAt = null; state.statusText = "Session cleared. You can create a new conversation at any time."; }
  if (action === "resume") hydrateSession();
  if (action === "save-feedback") { const text = state.feedbackDraft.trim(); if (text) { state.feedbackItems = [{ id: uuid(), text, time: nowIso() }, ...state.feedbackItems].slice(0, 20); state.feedbackDraft = ""; state.statusText = "Feedback saved locally. Thank you."; persistState(); } }
  if (action === "clear-feedback") { state.feedbackItems = []; persistState(); }
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
  state.debug.handlersAttached = true;
  render();
});
