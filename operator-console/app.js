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

const state = {
  baseUrl: "",
  ready: null,
  spiritkins: [],
  conversations: [],
  selectedConversation: "",
  userId: uuid(),
  input: "",
  selectedSpiritkin: "Lyra",
  messages: [],
  issueReports: [],
  issueDigest: null,
  issueAccess: { available: null, message: "Report review not checked yet." },
  status: { kind: "info", message: "Operator console ready." },
  raw: null,
  loading: false,
  debug: { jsLoaded: true, handlersAttached: false, lastAction: "init", lastPayload: null, lastResponse: null, lastError: null },
};

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const api = (path) => `${state.baseUrl}${path}`;

function setStatus(kind, message) {
  state.status = { kind, message };
}

async function request(path, options = {}) {
  state.debug.lastPayload = { path, options };
  const res = await fetch(api(path), options);
  const data = await res.json().catch(() => ({}));
  state.debug.lastResponse = data;
  if (!res.ok || data?.ok === false) throw new Error(data?.message || `Request failed: ${path}`);
  state.raw = data;
  state.debug.lastError = null;
  return data;
}

async function checkReady() {
  try {
    state.debug.lastAction = "checkReady:start";
    const res = await fetch(api("/ready"));
    state.ready = await res.json();
    setStatus("ok", "Ready check succeeded.");
  } catch (err) {
    setStatus("error", err.message);
    state.debug.lastError = err.message;
  }
  render();
}

async function loadSpiritkins() {
  try {
    state.debug.lastAction = "loadSpiritkins:start";
    state.loading = true; render();
    const data = await request("/v1/spiritkins");
    state.spiritkins = data.spiritkins || [];
    if (state.spiritkins.length && !state.spiritkins.find((s) => (s.name ?? s.id) === state.selectedSpiritkin)) {
      state.selectedSpiritkin = state.spiritkins[0].name ?? state.spiritkins[0].id;
    }
    setStatus("ok", "Loaded spiritkin registry.");
  } catch (err) {
    setStatus("error", err.message);
    state.debug.lastError = err.message;
  } finally {
    state.loading = false;
    render();
  }
}

async function loadConversations() {
  try {
    state.debug.lastAction = "loadConversations:start";
    const data = await request(`/v1/conversations/${encodeURIComponent(state.userId)}`);
    state.conversations = data.conversations || [];
    setStatus("ok", "Loaded conversations.");
  } catch (err) {
    setStatus("error", err.message);
    state.debug.lastError = err.message;
  }
  render();
}

async function createConversation() {
  try {
    state.debug.lastAction = "createConversation:start";
    const data = await request("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: state.userId, spiritkinName: state.selectedSpiritkin }),
    });
    state.selectedConversation = data?.conversation?.conversation_id ?? data?.conversation?.id ?? "";
    await loadConversations();
    setStatus("ok", "Created new conversation.");
  } catch (err) {
    setStatus("error", err.message);
    state.debug.lastError = err.message;
    render();
  }
}

async function loadIssueReports() {
  try {
    state.debug.lastAction = "loadIssueReports:start";
    const [recentData, digestData] = await Promise.all([
      request("/v1/admin/issues/recent"),
      request("/v1/admin/issues/digest"),
    ]);
    state.issueReports = recentData.reports || [];
    state.issueDigest = digestData.digest || null;
    state.issueAccess = {
      available: true,
      message: `Loaded ${state.issueReports.length} recent report${state.issueReports.length === 1 ? "" : "s"}.`,
    };
    setStatus("ok", "Loaded reporting pipeline review data.");
  } catch (err) {
    state.issueAccess = {
      available: false,
      message: err.message,
    };
    setStatus("error", `Reporting review unavailable: ${err.message}`);
    state.debug.lastError = err.message;
  }
  render();
}

async function sendMessage() {
  const text = state.input.trim();
  if (!text || !state.selectedConversation) {
    setStatus("warn", "Select or create a conversation before sending.");
    render();
    return;
  }
  const userMsg = { role: "user", content: text, time: new Date().toLocaleTimeString() };
  state.messages.push(userMsg);
  state.input = "";
  render();
  try {
    state.debug.lastAction = "sendMessage:start";
    const data = await request("/v1/interact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: state.userId,
        conversationId: state.selectedConversation,
        input: text,
      }),
    });
    state.messages.push({ role: "assistant", content: data.message ?? data.output ?? data.response?.text ?? "…", time: new Date().toLocaleTimeString() });
    setStatus("ok", "Interaction complete.");
  } catch (err) {
    state.messages.push({ role: "assistant", content: `Error: ${err.message}`, time: new Date().toLocaleTimeString() });
    setStatus("error", err.message);
    state.debug.lastError = err.message;
  }
  render();
}

function render() {
  const root = document.getElementById("root");
  root.innerHTML = `
    <main class="operator-shell">
      <header class="hero"><h1>Operator Console</h1><p>Interactive runtime console for SpiritCore /v1 endpoints.</p></header>
      <section class="panel">
        <h2>Connection</h2>
        <div class="field-grid">
          <label><span>API Base URL</span><input data-field="baseUrl" value="${escapeHtml(state.baseUrl)}" placeholder="(empty for same origin)" /></label>
          <label><span>userId</span><input data-field="userId" value="${escapeHtml(state.userId)}" /></label>
          <label><span>conversationId</span><input data-field="conversationId" value="${escapeHtml(state.selectedConversation)}" /></label>
          <label><span>Spiritkin</span><select data-field="spiritkin">${(state.spiritkins.length ? state.spiritkins : [{ name: "Lyra" }, { name: "Raien" }, { name: "Kairo" }]).map((s) => { const n = s.name ?? s.id; return `<option value="${escapeHtml(n)}" ${n === state.selectedSpiritkin ? "selected" : ""}>${escapeHtml(n)}</option>`; }).join("")}</select></label>
        </div>
        <div class="button-row"><button id="checkReadyBtn">Check /ready</button><button id="loadSpiritkinsBtn">Load Spiritkins</button><button id="loadConversationsBtn">Load Conversations</button><button id="createConversationBtn">Create Conversation</button></div>
        <p class="status ${state.status.kind}">${escapeHtml(state.status.message)}</p>
      </section>

      <section class="panel">
        <h2>Conversations</h2>
        <div class="conversation-list">
          ${state.conversations.length === 0 ? '<p class="empty">No conversations loaded.</p>' : state.conversations.map((c) => `<button class="conversation-row ${c.id === state.selectedConversation ? "active" : ""}" data-action="pick-conversation" data-id="${escapeHtml(c.id)}"><strong>${escapeHtml(c.id)}</strong><span>${escapeHtml(c.spiritkin_name ?? c.spiritkinName ?? "Spiritkin")}</span></button>`).join("")}
        </div>
      </section>

      <section class="panel">
        <h2>Interaction Console</h2>
        <div class="thread">${state.messages.length === 0 ? '<p class="empty">No messages yet.</p>' : state.messages.map((m) => `<article class="message ${m.role}"><div class="meta">${m.role}</div><p>${escapeHtml(m.content)}</p><span>${m.time}</span></article>`).join("")}</div>
        <label><span>Input</span><textarea data-field="input" placeholder="Type an operator message...">${escapeHtml(state.input)}</textarea></label>
        <button id="sendInteractionBtn" class="send-btn">Send</button>
      </section>

      <section class="panel">
        <h2>Issue Reports</h2>
        <div class="button-row"><button id="loadIssueReportsBtn">Refresh Reports</button></div>
        <p class="status ${state.issueAccess.available === false ? "error" : "info"}">${escapeHtml(state.issueAccess.message)}</p>
        ${(state.issueDigest || state.issueReports.length) ? `
          <div class="conversation-list">
            ${(state.issueReports || []).slice(0, 8).map((report) => `
              <div class="conversation-row">
                <div>
                  <strong>${escapeHtml(report.repair_summary?.owner_digest_line || report.summary || "Report received.")}</strong>
                  <div>${escapeHtml(report.classification || "unknown")} • ${escapeHtml(report.status || "logged")} • ${escapeHtml(report.context?.current_feature || "general_app")}</div>
                </div>
                <span>${escapeHtml(String(report.severity || "low"))}</span>
              </div>
            `).join("")}
          </div>
          <pre>${escapeHtml(JSON.stringify({
            unresolved: state.issueDigest?.unresolved_issues?.length || 0,
            recurring: state.issueDigest?.grouped_recurring_issues?.length || 0,
            queue: state.issueDigest?.queue?.length || 0,
          }, null, 2))}</pre>
        ` : '<p class="empty">No report review data loaded.</p>'}
      </section>

      <section class="panel"><h2>Raw JSON</h2><pre>${escapeHtml(JSON.stringify(state.raw ?? {}, null, 2))}</pre></section>
      <section class="panel"><h2>Debug</h2><p><strong>JS loaded:</strong> ${state.debug.jsLoaded ? "yes" : "no"}</p><p><strong>Handlers attached:</strong> ${state.debug.handlersAttached ? "yes" : "no"}</p><p><strong>Last action:</strong> ${escapeHtml(state.debug.lastAction)}</p><p><strong>Last error:</strong> ${escapeHtml(state.debug.lastError || "none")}</p><pre>${escapeHtml(JSON.stringify({ payload: state.debug.lastPayload, response: state.debug.lastResponse }, null, 2))}</pre></section>
    </main>
  `;
  wireCriticalHandlers();
}

function wireCriticalHandlers() {
  const ready = document.getElementById("checkReadyBtn");
  if (ready) ready.onclick = () => { state.debug.lastAction = "click:checkReadyBtn"; checkReady(); };
  const loadSpiritkinsEl = document.getElementById("loadSpiritkinsBtn");
  if (loadSpiritkinsEl) loadSpiritkinsEl.onclick = () => { state.debug.lastAction = "click:loadSpiritkinsBtn"; loadSpiritkins(); };
  const loadConversationsEl = document.getElementById("loadConversationsBtn");
  if (loadConversationsEl) loadConversationsEl.onclick = () => { state.debug.lastAction = "click:loadConversationsBtn"; loadConversations(); };
  const createConversationEl = document.getElementById("createConversationBtn");
  if (createConversationEl) createConversationEl.onclick = () => { state.debug.lastAction = "click:createConversationBtn"; createConversation(); };
  const sendEl = document.getElementById("sendInteractionBtn");
  if (sendEl) sendEl.onclick = () => { state.debug.lastAction = "click:sendInteractionBtn"; sendMessage(); };
  const loadIssueReportsEl = document.getElementById("loadIssueReportsBtn");
  if (loadIssueReportsEl) loadIssueReportsEl.onclick = () => { state.debug.lastAction = "click:loadIssueReportsBtn"; loadIssueReports(); };
}

function onInput(e) {
  const field = e.target.dataset.field;
  if (!field) return;
  if (field === "baseUrl") state.baseUrl = e.target.value.trim();
  if (field === "userId") state.userId = e.target.value;
  if (field === "conversationId") state.selectedConversation = e.target.value;
  if (field === "spiritkin") state.selectedSpiritkin = e.target.value;
  if (field === "input") state.input = e.target.value;
}

async function onClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  state.debug.lastAction = `click:${action}`;
  if (action === "check-ready") return checkReady();
  if (action === "load-spiritkins") return loadSpiritkins();
  if (action === "load-conversations") return loadConversations();
  if (action === "create-conversation") return createConversation();
  if (action === "pick-conversation") { state.selectedConversation = btn.dataset.id; return render(); }
  if (action === "send-message") return sendMessage();
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  const root = document.getElementById("root");
  root.addEventListener("input", (e) => { onInput(e); render(); });
  root.addEventListener("change", (e) => { onInput(e); render(); });
  root.addEventListener("click", (e) => { onClick(e); });
  root.addEventListener("keydown", (e) => {
    if (e.target.dataset.field === "input" && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  });
  state.debug.handlersAttached = true;
  render();

  checkReady();
  loadSpiritkins();
  loadIssueReports();
});
