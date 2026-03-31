import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const ALLOWED_SPIRITKINS = ["Lyra", "Raien", "Kairo"];
const SESSION_KEY = "spiritkins.session.v6";
const ENTRY_KEY = "spiritkins.entry.accepted";
const NAME_KEY = "spiritkins.profile.name";

const STARTER_PROMPTS = [
  "I need help settling my mind today.",
  "Can we reflect on what I am carrying right now?",
  "Help me find one grounded next step.",
];

const BRAND_BY_SPIRITKIN = {
  Lyra: { aura: "lyra", tag: "Warmth • Grounding • Compassion", presence: "Grounded, gentle, and steady." },
  Raien: { aura: "raien", tag: "Courage • Protection • Strength", presence: "Clear, protective, and brave." },
  Kairo: { aura: "kairo", tag: "Wonder • Imagination • Reflection", presence: "Curious, expansive, and reflective." },
};

const nowIso = () => new Date().toISOString();
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const readJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };

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
      <button onClick=${onEditName}>Name</button>
      <button disabled title="Coming soon">Sign in (Soon)</button>
    </div>
  </header>`;
}

function EntryCard({ onBegin, userNameDraft, onUserNameDraft }) {
  return html`<section className="entry-card">
    <p className="kicker">Welcome</p>
    <h2>Begin in one step</h2>
    <p>Continue as a beta user, choose your Spiritkin, and start a calm conversation in minutes.</p>
    <label className="field">
      <span>Your name (optional)</span>
      <input value=${userNameDraft} placeholder="How should we address you?" onInput=${(e) => onUserNameDraft(e.target.value)} />
    </label>
    <button className="primary" onClick=${onBegin}>Continue as Beta User</button>
  </section>`;
}

function SessionStateBanner({ sessionState }) {
  if (!sessionState) return null;
  return html`<div className=${`session-state session-${sessionState.kind}`}>${sessionState.label}</div>`;
}

function LifecycleRail({ entryAccepted, hasSession, selectedSpiritkin }) {
  const stepOne = entryAccepted ? "done" : "active";
  const stepTwo = selectedSpiritkin ? "done" : entryAccepted ? "active" : "idle";
  const stepThree = hasSession ? "done" : selectedSpiritkin ? "active" : "idle";
  return html`<div className="lifecycle-rail">
    <span className=${`step ${stepOne}`}>1. Access</span>
    <span className=${`step ${stepTwo}`}>2. Choose Companion</span>
    <span className=${`step ${stepThree}`}>3. Begin Conversation</span>
  </div>`;
}

function MessageRow({ msg }) {
  return html`<article className=${`bubble ${msg.role === "user" ? "user" : "assistant"}`}>
    <span className="bubble-role">${msg.role === "user" ? "You" : msg.spiritkinName ?? "Spiritkin"}</span>
    <p>${msg.content}</p>
    ${msg.status === "failed" ? html`<span className="bubble-failed">Not delivered</span>` : html`<span className="bubble-time">${new Date(msg.time).toLocaleTimeString()}</span>`}
  </article>`;
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

function FutureReady() {
  return html`<section className="future-grid">
    <div><h4>Account Area</h4><p>Ready for sign-in, profile, and identity controls.</p></div>
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

  useEffect(() => { fetchSpiritkins(); hydrateSession(); }, []);
  useEffect(() => {
    if (!selectedSpiritkin || !conversationId) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ selectedSpiritkin, conversationId, messages, startedAt }));
  }, [selectedSpiritkin, conversationId, messages, startedAt]);
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
        const initial = list.find((s) => ALLOWED_SPIRITKINS.includes(s.name ?? s.id)) ?? list[0];
        setSelectedSpiritkin(initial);
      }
      setStatusText("Companions are available.");
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
      setStatusText("Conversation is ready.");
      setSessionState({ kind: "new", label: "Started a new session" });
    } catch (err) {
      setSoftError(err?.message ?? "We couldn’t open your conversation. Please try again.");
      setStatusText("Conversation unavailable.");
    } finally { setLoading(false); }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    setConversationId(null); setMessages([]); setStartedAt(null);
    setStatusText("Session cleared.");
    setSessionState({ kind: "cleared", label: "Cleared current session" });
  }

  async function sendMessage(contentOverride) {
    const text = (contentOverride ?? input).trim();
    if (!text || !hasSession) return;

    const outgoing = { id: crypto.randomUUID(), role: "user", content: text, spiritkinName: selectedSpiritkin?.name, status: "sent", time: nowIso() };
    setMessages((prev) => [...prev, outgoing]);
    if (!contentOverride) setInput("");

    try {
      setLoadingReply(true); setSoftError(""); setStatusText("Your companion is preparing a response...");
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
      setStatusText("Reply interrupted.");
    } finally { setLoadingReply(false); }
  }

  return html`<main className="app-shell ${brand.aura}">
    <${TopBar} onContinue=${acceptEntry} entryAccepted=${entryAccepted} userName=${userName} onEditName=${() => setIsEditingName(true)} />

    ${!entryAccepted ? html`<${EntryCard} onBegin=${acceptEntry} userNameDraft=${userNameDraft} onUserNameDraft=${setUserNameDraft} />` : null}

    <section className="hero">
      <p className="kicker">Spiritkins • Beta</p>
      <h1>${`Welcome${greetingName}`}</h1>
      <p className="subtitle">Emotionally attuned, mythic-emotional companions designed to help you reconnect with clarity and care.</p>
      <p className="status-line">Status: ${statusText}</p>
    </section>

    <${SessionStateBanner} sessionState=${sessionState} />
    <${LifecycleRail} entryAccepted=${entryAccepted} hasSession=${hasSession} selectedSpiritkin=${selectedSpiritkin} />


    ${isEditingName
      ? html`<section className="identity-edit"><label className="field"><span>Display name</span><input value=${userNameDraft} onInput=${(e) => setUserNameDraft(e.target.value)} placeholder="Name" /></label><div className="identity-actions"><button onClick=${saveName}>Save</button><button onClick=${() => { setIsEditingName(false); setUserNameDraft(userName); }}>Cancel</button></div></section>`
      : null}

    <section className="meta-row">
      <div className="meta-card">
        <h4>Identity</h4>
        <p><strong>Name:</strong> ${userName || "Not set"}</p>
        <p><strong>Beta user:</strong> ${userId}</p>
        <p><strong>Session started:</strong> ${fmtTime(startedAt)}</p>
      </div>
      <div className="meta-card">
        <h4>Continuity</h4>
        <p>${lastMessageAt ? `Picking up where we left off (${fmtTime(lastMessageAt)}).` : "Conversation continuity will appear here as you chat."}</p>
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

    <${FutureReady} />

    <footer className="footer-note">Spiritkins beta • A calm, trustworthy companion experience designed to support reflection over time.</footer>
  </main>`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
