import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const ALLOWED_SPIRITKINS = ["Lyra", "Raien", "Kairo"];
const SESSION_KEY = "spiritkins.session.v7";
const ENTRY_KEY = "spiritkins.entry.accepted";
const NAME_KEY = "spiritkins.profile.name";
const PREFS_KEY = "spiritkins.prefs.v1";
const FEEDBACK_KEY = "spiritkins.feedback.v1";

const STARTER_PROMPTS = [
  "I need help settling my mind today.",
  "Can we reflect on what I am carrying right now?",
  "Help me find one grounded next step.",
];
const SECTION_COPY = {
  companion: {
    title: "Companion Space",
    subtitle: "Stay grounded with continuity, gentle identity cues, and your active Spiritkin relationship.",
  },
  preferences: {
    title: "Preferences",
    subtitle: "Shape how the beta feels for you today. These settings are local and reversible.",
  },
  feedback: {
    title: "Feedback Journal",
    subtitle: "Capture quick product notes and keep a clean local log of your beta impressions.",
  },
};

const BRAND_BY_SPIRITKIN = {
  Lyra: { aura: "lyra", tag: "Warmth • Grounding • Compassion", presence: "Grounded, gentle, and steady." },
  Raien: { aura: "raien", tag: "Courage • Protection • Strength", presence: "Clear, protective, and brave." },
  Kairo: { aura: "kairo", tag: "Wonder • Imagination • Reflection", presence: "Curious, expansive, and reflective." },
};

const nowIso = () => new Date().toISOString();
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const readJson = (k, fallback = null) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? fallback; } catch { return fallback; } };

function getOrCreateUserId() {
  const existing = localStorage.getItem("spiritkins.userId");
  if (existing) return existing;
  const newId = `user-${crypto.randomUUID().slice(0, 8)}`;
  localStorage.setItem("spiritkins.userId", newId);
  return newId;
}

function getBrand(name) {
  return BRAND_BY_SPIRITKIN[name] ?? { aura: "default", tag: "Mythic Companion", presence: "Attuned and thoughtful." };
}

function TopBar({ onContinue, entryAccepted, userName, onEditName }) {
  return html`<header className="topbar">
    <div className="brand">
      <strong>Spiritkins</strong>
      <span>${userName ? `Companion Beta • ${userName}` : "Companion Beta"}</span>
    </div>
    <div className="top-actions">
      ${!entryAccepted ? html`<button onClick=${onContinue}>Continue</button>` : html`<span className="active-pill">${userName ? `Hi, ${userName}` : "Beta User Active"}</span>`}
      <button onClick=${onEditName}>Identity</button>
      <button disabled title="Coming soon">Sign in (Soon)</button>
    </div>
  </header>`;
}

function EntryCard({ onBegin, userNameDraft, onUserNameDraft }) {
  return html`<section className="entry-card">
    <p className="kicker">Welcome</p>
    <h2>Begin with beta access</h2>
    <p>Continue as a beta user now, with sign in and account creation ready to unlock as this beta expands.</p>
    <div className="entry-auth-rail">
      <button disabled title="Coming soon">Sign In (Soon)</button>
      <button disabled title="Coming soon">Create Account (Soon)</button>
      <span>Beta access is active today</span>
    </div>
    <label className="field"><span>Your name (optional)</span><input value=${userNameDraft} placeholder="How should we address you?" onInput=${(e) => onUserNameDraft(e.target.value)} /></label>
    <button className="primary" onClick=${onBegin}>Continue as Beta User</button>
  </section>`;
}

function MessageRow({ msg }) {
  return html`<article className=${`bubble ${msg.role === "user" ? "user" : "assistant"}`}>
    <span className="bubble-role">${msg.role === "user" ? "You" : msg.spiritkinName ?? "Spiritkin"}</span>
    <p>${msg.content}</p>
    ${msg.status === "failed" ? html`<span className="bubble-failed">Not delivered</span>` : html`<span className="bubble-time">${new Date(msg.time).toLocaleTimeString()}</span>`}
  </article>`;
}

function SessionStateBanner({ sessionState }) {
  if (!sessionState) return null;
  return html`<div className=${`session-state session-${sessionState.kind}`}>${sessionState.label}</div>`;
}

function SpiritkinCard({ spiritkin, selected, onSelect }) {
  const name = spiritkin.name ?? spiritkin.id;
  const brand = getBrand(name);
  return html`<button className=${`spiritkin-card ${brand.aura} ${selected ? "selected" : ""}`} onClick=${onSelect}>
    <p className="spiritkin-tag">${brand.tag}</p>
    <h3>${name}</h3>
    <p className="spiritkin-role">${spiritkin.role ?? spiritkin.archetype ?? "Companion"}</p>
    <p className="spiritkin-essence">${spiritkin.essence ?? spiritkin.description ?? spiritkin.summary ?? brand.presence}</p>
  </button>`;
}

function SectionHeader({ title, subtitle }) {
  return html`<header className="section-header"><h3>${title}</h3><p>${subtitle}</p></header>`;
}

function FutureReady() {
  return html`<section className="future-grid">
    <div><h4>Sign In</h4><p>Prepared for secure account login when beta accounts open.</p></div>
    <div><h4>Create Account</h4><p>Reserved for onboarding, profile creation, and consent steps.</p></div>
    <div><h4>Saved Conversations</h4><p>Reserved layout for persistent conversation history.</p></div>
    <div><h4>Memory View</h4><p>UI foundation for memory-aware context panels.</p></div>
    <div><h4>Settings</h4><p>Space for tone, notifications, and preference controls.</p></div>
  </section>`;
}

function App() {
  const [userId] = useState(() => getOrCreateUserId());
  const [userName, setUserName] = useState(localStorage.getItem(NAME_KEY) || "");
  const [userNameDraft, setUserNameDraft] = useState(localStorage.getItem(NAME_KEY) || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeSection, setActiveSection] = useState("companion");

  const [spiritkins, setSpiritkins] = useState([]);
  const [selectedSpiritkin, setSelectedSpiritkin] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingReply, setLoadingReply] = useState(false);
  const [softError, setSoftError] = useState("");
  const [statusText, setStatusText] = useState("Ready");
  const [startedAt, setStartedAt] = useState(null);
  const [entryAccepted, setEntryAccepted] = useState(Boolean(localStorage.getItem(ENTRY_KEY)));
  const [sessionState, setSessionState] = useState(null);

  const [prefs, setPrefs] = useState(readJson(PREFS_KEY, {
    preferredSpiritkin: "",
    appTone: "balanced",
    reminderMode: "off",
  }));
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackItems, setFeedbackItems] = useState(readJson(FEEDBACK_KEY, []));

  const threadRef = useRef(null);
  const selectionRef = useRef(null);

  const filteredSpiritkins = useMemo(() => spiritkins.filter((s) => ALLOWED_SPIRITKINS.includes(s.name ?? s.id)), [spiritkins]);
  const hasSession = Boolean(selectedSpiritkin && conversationId);
  const brand = getBrand(selectedSpiritkin?.name);
  const failedMessage = [...messages].reverse().find((m) => m.role === "user" && m.status === "failed");
  const resumeAvailable = Boolean(readJson(SESSION_KEY)?.conversationId);
  const lastMessageAt = messages.length ? messages[messages.length - 1].time : null;
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const greetingName = userName?.trim() ? `, ${userName.trim()}` : "";
  const identityLabel = userName?.trim() || "Beta User";
  const continuitySummary = lastMessageAt
    ? `Last active ${fmtTime(lastMessageAt)}`
    : "No local conversation activity yet";

  useEffect(() => { fetchSpiritkins(); hydrateSession(); }, []);
  useEffect(() => {
    if (!selectedSpiritkin || !conversationId) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ selectedSpiritkin, conversationId, messages, startedAt }));
  }, [selectedSpiritkin, conversationId, messages, startedAt]);
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);
  useEffect(() => {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackItems));
  }, [feedbackItems]);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loadingReply]);

  function acceptEntry() {
    localStorage.setItem(ENTRY_KEY, "1");
    const normalizedName = userNameDraft.trim();
    localStorage.setItem(NAME_KEY, normalizedName);
    setUserName(normalizedName);
    setEntryAccepted(true);
    setStatusText("Beta access confirmed. You can choose a companion whenever you’re ready.");
    setTimeout(() => selectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function saveName() {
    const normalizedName = userNameDraft.trim();
    localStorage.setItem(NAME_KEY, normalizedName);
    setUserName(normalizedName);
    setIsEditingName(false);
    setStatusText(normalizedName ? `Identity updated for ${normalizedName}.` : "Identity updated.");
  }

  function hydrateSession() {
    const session = readJson(SESSION_KEY);
    if (!session) return;
    setSelectedSpiritkin(session.selectedSpiritkin ?? null);
    setConversationId(session.conversationId ?? null);
    setMessages(Array.isArray(session.messages) ? session.messages : []);
    setStartedAt(session.startedAt ?? null);
    setStatusText(`Welcome back${greetingName} — your session is ready.`);
    setSessionState({ kind: "resumed", label: "Resumed previous session" });
  }

  async function fetchSpiritkins() {
    try {
      setLoading(true); setSoftError(""); setStatusText("Loading companions...");
      const res = await fetch("/v1/spiritkins");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Unable to load Spiritkins.");
      const list = data.spiritkins ?? [];
      setSpiritkins(list);
      if (!selectedSpiritkin && list.length > 0) {
        const preferred = list.find((s) => (s.name ?? s.id) === prefs.preferredSpiritkin);
        const initial = preferred ?? list.find((s) => ALLOWED_SPIRITKINS.includes(s.name ?? s.id)) ?? list[0];
        setSelectedSpiritkin(initial);
      }
      setStatusText("Companions are available. Select the one that fits this moment.");
    } catch (err) {
      setSoftError(err?.message ?? "We couldn’t load companions right now. Please try again.");
      setStatusText("Connection needs retry.");
    } finally { setLoading(false); }
  }

  async function beginConversation() {
    if (!selectedSpiritkin) return;
    try {
      setLoading(true); setSoftError(""); setStatusText("Opening your conversation...");
      const res = await fetch("/v1/conversations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, spiritkinName: selectedSpiritkin.name ?? selectedSpiritkin.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Could not begin a conversation yet.");
      setConversationId(data?.conversation?.id ?? null);
      setMessages([]);
      setStartedAt(nowIso());
      setStatusText("Conversation is ready. You can begin whenever it feels right.");
      setSessionState({ kind: "new", label: "Started a new session" });
      setPrefs((prev) => ({ ...prev, preferredSpiritkin: selectedSpiritkin.name ?? selectedSpiritkin.id }));
    } catch (err) {
      setSoftError(err?.message ?? "We couldn’t open your conversation. Please try again.");
      setStatusText("Conversation unavailable.");
    } finally { setLoading(false); }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    setConversationId(null); setMessages([]); setStartedAt(null);
    setStatusText("Session cleared. Your local preferences and identity are still here.");
    setSessionState({ kind: "cleared", label: "Cleared current session" });
  }

  async function sendMessage(contentOverride) {
    const text = (contentOverride ?? input).trim();
    if (!text || !hasSession) return;

    const outgoing = { id: crypto.randomUUID(), role: "user", content: text, spiritkinName: selectedSpiritkin?.name, status: "sent", time: nowIso() };
    setMessages((prev) => [...prev, outgoing]);
    if (!contentOverride) setInput("");

    try {
      setLoadingReply(true); setSoftError(""); setStatusText("Your companion is preparing a response with care...");
      const res = await fetch("/v1/interact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, input: text, conversationId, spiritkin: { name: selectedSpiritkin.name ?? selectedSpiritkin.id } }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Message delivery was interrupted.");
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data?.output ?? data?.response?.text ?? data?.response ?? "…", spiritkinName: selectedSpiritkin?.name, status: "sent", time: nowIso() }]);
      setStatusText("Reply received.");
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === outgoing.id ? { ...m, status: "failed" } : m)));
      setSoftError(err?.message ?? "Something interrupted the reply. You can retry safely.");
      setStatusText("Reply interrupted. Your message is safe, and retry is available.");
    } finally { setLoadingReply(false); }
  }

  function submitFeedback() {
    const text = feedbackDraft.trim();
    if (!text) return;
    setFeedbackItems((prev) => [{ id: crypto.randomUUID(), text, time: nowIso() }, ...prev].slice(0, 20));
    setFeedbackDraft("");
    setStatusText("Feedback saved locally. Thank you.");
  }

  function clearFeedbackHistory() {
    setFeedbackItems([]);
    setStatusText("Local feedback history cleared.");
  }

  return html`<main className="app-shell ${brand.aura}">
    <${TopBar} onContinue=${acceptEntry} entryAccepted=${entryAccepted} userName=${userName} onEditName=${() => setIsEditingName(true)} />

    ${!entryAccepted ? html`<${EntryCard} onBegin=${acceptEntry} userNameDraft=${userNameDraft} onUserNameDraft=${setUserNameDraft} />` : null}

    <section className="hero">
      <p className="kicker">Spiritkins • Beta</p>
      <h1>${`Welcome${greetingName}`}</h1>
      <p className="subtitle">Emotionally attuned, mythic-emotional companions designed to help you reconnect with clarity and care.</p>
      <p className="status-line">Status: ${statusText}</p>
      <div className="identity-pill-row">
        <span className="identity-pill">${identityLabel}</span>
        <span className="identity-pill subtle">${entryAccepted ? "Beta access active" : "Access not started"}</span>
        <span className="identity-pill subtle">${continuitySummary}</span>
      </div>
      <p className="trust-note">Local-first beta: your preferences, feedback notes, and session continuity stay on this device for now.</p>
    </section>

    <nav className="section-nav">
      ${Object.keys(SECTION_COPY).map((key) => html`
        <button className=${activeSection === key ? "active" : ""} aria-current=${activeSection === key ? "page" : "false"} onClick=${() => setActiveSection(key)}>
          <span>${key.charAt(0).toUpperCase() + key.slice(1)}</span>
          <small>${SECTION_COPY[key].title}</small>
        </button>
      `)}
    </nav>
    <p className="nav-support">Companion for active conversation, Preferences for your defaults, and Feedback for product notes.</p>

    ${isEditingName
      ? html`<section className="identity-edit"><label className="field"><span>Display name</span><input value=${userNameDraft} onInput=${(e) => setUserNameDraft(e.target.value)} placeholder="Name" /></label><div className="identity-actions"><button onClick=${saveName}>Save</button><button onClick=${() => { setIsEditingName(false); setUserNameDraft(userName); }}>Cancel</button></div></section>`
      : null}

    ${activeSection === "companion" ? html`
      <section className="product-panel">
      <${SectionHeader} title=${SECTION_COPY.companion.title} subtitle=${SECTION_COPY.companion.subtitle} />
      <${SessionStateBanner} sessionState=${sessionState} />
      <section className="lifecycle-rail">
        <span className=${`step ${entryAccepted ? "done" : "active"}`}>1. Access</span>
        <span className=${`step ${selectedSpiritkin ? "done" : entryAccepted ? "active" : "idle"}`}>2. Choose Companion</span>
        <span className=${`step ${hasSession ? "done" : selectedSpiritkin ? "active" : "idle"}`}>3. Begin Conversation</span>
      </section>

      <section className="meta-row">
        <div className="meta-card">
          <h4>Identity</h4>
          <p><strong>Name:</strong> ${userName || "Not set"}</p>
          <p><strong>Beta user:</strong> ${userId}</p>
          <p><strong>Session started:</strong> ${fmtTime(startedAt)}</p>
        </div>
        <div className="meta-card">
          <h4>Continuity</h4>
          <p>${lastMessageAt ? `Picking up where we left off (${fmtTime(lastMessageAt)}).` : "Continuity appears here as soon as your first exchange is saved in this device session."}</p>
          <p>${lastUserMessage ? `Last shared: “${lastUserMessage.slice(0, 78)}${lastUserMessage.length > 78 ? "…" : ""}”` : "No prior user message in this local session yet."}</p>
        </div>
      </section>

      <section className="session-bar">
        <div>
          <p className="kicker">Session</p>
          <p className="session-title">${hasSession ? `${selectedSpiritkin?.name} • Active` : "No active conversation"}</p>
          <p className="session-sub">${hasSession ? `Conversation: ${conversationId}` : "Choose a companion to begin."}</p>
        </div>
        <div className="session-actions">
          ${resumeAvailable && !hasSession ? html`<button onClick=${hydrateSession}>Resume</button>` : null}
          ${hasSession ? html`<button onClick=${clearSession}>Start Fresh</button>` : null}
        </div>
      </section>

      ${softError ? html`<div className="error-banner">${softError}</div>` : null}

      ${!hasSession
        ? html`<section className="selection-panel" ref=${selectionRef}>
            <div className="selection-header">
              <div>
                <p className="kicker">Choose your companion</p>
                <h2>Select the presence that fits today.</h2>
              </div>
              <button onClick=${fetchSpiritkins} disabled=${loading}>Refresh</button>
            </div>
            <p className="selection-note">Each Spiritkin keeps continuity through your ongoing session and responds with an attuned tone.</p>
            ${loading && filteredSpiritkins.length === 0 ? html`<p className="state">Gathering companion presences…</p>` : null}
            ${!loading && filteredSpiritkins.length === 0 ? html`<p className="state">No Spiritkins available right now. Please try refresh.</p>` : null}
            <div className="spiritkin-grid">
              ${filteredSpiritkins.map((sp) => html`<${SpiritkinCard} key=${sp.name ?? sp.id} spiritkin=${sp} selected=${selectedSpiritkin?.name === sp.name} onSelect=${() => setSelectedSpiritkin(sp)} />`)}
            </div>
            <button className="primary" onClick=${beginConversation} disabled=${loading || !selectedSpiritkin}>Begin Conversation</button>
          </section>`
        : html`<section className="chat-panel">
            <header className=${`chat-header ${brand.aura}`}>
              <div>
                <p className="kicker">Active Spiritkin</p>
                <h2>${selectedSpiritkin?.name}</h2>
                <p>${brand.tag}</p>
                <p className="session-id">${brand.presence}</p>
              </div>
              <button onClick=${() => setConversationId(null)} disabled=${loadingReply}>Change Spiritkin</button>
            </header>

            <div className="starter-prompts">
              ${messages.length === 0 ? STARTER_PROMPTS.map((prompt) => html`<button onClick=${() => setInput(userName ? `${userName}: ${prompt}` : prompt)}>${prompt}</button>`) : null}
            </div>

            <div className="thread-status">
              <span>${loadingReply ? "Attunement in progress…" : "Companion ready"}</span>
              <span>${messages.length} message${messages.length === 1 ? "" : "s"}</span>
            </div>

            <div className="thread" ref=${threadRef}>
              ${messages.length === 0 ? html`<p className="state">Try one of the starter prompts, or write your own first message.</p>` : null}
              ${messages.map((msg) => html`<${MessageRow} key=${msg.id} msg=${msg} />`)}
              ${loadingReply ? html`<article className="bubble assistant loading-bubble"><span className="bubble-role">${selectedSpiritkin?.name ?? "Spiritkin"}</span><p>Listening… shaping a thoughtful reply.</p></article>` : null}
            </div>

            ${failedMessage ? html`<div className="retry-banner"><span>Last message didn’t send.</span><button onClick=${() => sendMessage(failedMessage.content)} disabled=${loadingReply}>Retry</button></div>` : null}

            <div className="composer">
              <textarea
                value=${input}
                placeholder="Share what you’re feeling, wondering, or working through..."
                onChange=${(e) => setInput(e.target.value)}
                onKeyDown=${(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
              ></textarea>
              <button className="primary" onClick=${() => sendMessage()} disabled=${loadingReply || !input.trim()}>Send</button>
            </div>
          </section>`}
      </section>
    ` : null}

    ${activeSection === "preferences" ? html`<section className="product-panel settings-panel">
      <${SectionHeader} title=${SECTION_COPY.preferences.title} subtitle=${SECTION_COPY.preferences.subtitle} />
      <article className="account-readiness">
        <h4>Account readiness</h4>
        <p>Sign in and account creation are prepared in the UI. Your current beta identity remains local until account rollout begins.</p>
      </article>
      <div className="settings-grid">
        <article>
          <h4>Identity</h4>
          <label className="field"><span>Display name</span><input value=${userNameDraft} onInput=${(e) => setUserNameDraft(e.target.value)} /></label>
          <p className="settings-note">Used in your greeting and prompt suggestions.</p>
        </article>
        <article>
          <h4>Companion defaults</h4>
          <label className="field"><span>Preferred Spiritkin</span><select value=${prefs.preferredSpiritkin} onChange=${(e) => setPrefs((prev) => ({ ...prev, preferredSpiritkin: e.target.value }))}><option value="">Auto</option>${ALLOWED_SPIRITKINS.map((name) => html`<option value=${name}>${name}</option>`)}</select></label>
          <label className="field"><span>App tone readiness</span><select value=${prefs.appTone} onChange=${(e) => setPrefs((prev) => ({ ...prev, appTone: e.target.value }))}><option value="balanced">Balanced</option><option value="gentle">Gentle</option><option value="direct">Direct</option></select></label>
        </article>
        <article>
          <h4>Ritual pacing</h4>
          <label className="field"><span>Reminder placeholder</span><select value=${prefs.reminderMode} onChange=${(e) => setPrefs((prev) => ({ ...prev, reminderMode: e.target.value }))}><option value="off">Off</option><option value="daily">Daily (placeholder)</option><option value="weekly">Weekly (placeholder)</option></select></label>
          <p className="settings-note">Account-linked delivery will ship with sign-in support.</p>
        </article>
      </div>
      <button onClick=${saveName}>Save Local Preferences</button>
    </section>` : null}

    ${activeSection === "feedback" ? html`<section className="product-panel feedback-panel">
      <${SectionHeader} title=${SECTION_COPY.feedback.title} subtitle=${SECTION_COPY.feedback.subtitle} />
      <p className="settings-note">Use this as a lightweight product journal while beta access is local-first.</p>
      <textarea value=${feedbackDraft} placeholder="Share what felt helpful, unclear, or missing..." onChange=${(e) => setFeedbackDraft(e.target.value)}></textarea>
      <div className="feedback-actions">
        <button className="primary" onClick=${submitFeedback} disabled=${!feedbackDraft.trim()}>Save Feedback</button>
        <button onClick=${clearFeedbackHistory} disabled=${feedbackItems.length === 0}>Clear History</button>
      </div>
      <div className="feedback-list">
        ${feedbackItems.length === 0
          ? html`<p className="state">No saved feedback yet. Add your first note to begin a local beta journal.</p>`
          : feedbackItems.map((f) => html`<article><strong>${fmtTime(f.time)}</strong><p>${f.text}</p></article>`)}
      </div>
    </section>` : null}

    <${FutureReady} />
    <footer className="footer-note">Spiritkins beta • A calm, trustworthy companion experience designed to support reflection over time.</footer>
  </main>`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
