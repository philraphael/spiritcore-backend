import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const ALLOWED_SPIRITKINS = ["Lyra", "Raien", "Kairo"];
const SESSION_KEY = "spiritkins.session.v2";

const BRAND_BY_SPIRITKIN = {
  Lyra: { aura: "lyra", tag: "Warmth • Grounding • Compassion", welcome: "A gentle presence for steadiness and care." },
  Raien: { aura: "raien", tag: "Courage • Protection • Strength", welcome: "A steadfast companion for brave steps and resilient focus." },
  Kairo: { aura: "kairo", tag: "Wonder • Imagination • Reflection", welcome: "A curious guide for creative insight and deeper perspective." },
};

const nowIso = () => new Date().toISOString();

function getOrCreateUserId() {
  const existing = localStorage.getItem("spiritkins.userId");
  if (existing) return existing;
  const newId = `user-${crypto.randomUUID().slice(0, 8)}`;
  localStorage.setItem("spiritkins.userId", newId);
  return newId;
}

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }

function getBrand(name) {
  return BRAND_BY_SPIRITKIN[name] ?? { aura: "default", tag: "Mythic Companion", welcome: "An original companion presence for meaningful conversation." };
}

function SpiritkinCard({ spiritkin, selected, onSelect }) {
  const name = spiritkin.name ?? spiritkin.id;
  const brand = getBrand(name);
  return html`<button className=${`spiritkin-card ${brand.aura} ${selected ? "selected" : ""}`} onClick=${onSelect}>
    <p className="spiritkin-tag">${brand.tag}</p>
    <h3>${name}</h3>
    <p className="spiritkin-role">${spiritkin.role ?? spiritkin.archetype ?? "Companion"}</p>
    <p className="spiritkin-essence">${spiritkin.essence ?? spiritkin.description ?? spiritkin.summary ?? brand.welcome}</p>
  </button>`;
}

function SessionBar({ hasSession, selectedSpiritkin, conversationId, statusText, onResume, onFresh, resumeAvailable }) {
  return html`<section className="session-bar">
    <div>
      <p className="kicker">Session</p>
      <p className="session-title">${hasSession ? `${selectedSpiritkin?.name} • Active` : "No active conversation"}</p>
      <p className="session-sub">${hasSession ? `Conversation: ${conversationId}` : statusText}</p>
    </div>
    <div className="session-actions">
      ${resumeAvailable && !hasSession ? html`<button onClick=${onResume}>Resume</button>` : null}
      ${hasSession ? html`<button onClick=${onFresh}>Start Fresh</button>` : null}
    </div>
  </section>`;
}

function MessageRow({ msg }) {
  return html`<article className=${`bubble ${msg.role === "user" ? "user" : "assistant"}`}>
    <span className="bubble-role">${msg.role === "user" ? "You" : msg.spiritkinName ?? "Spiritkin"}</span>
    <p>${msg.content}</p>
    ${msg.status === "failed" ? html`<span className="bubble-failed">Not delivered</span>` : null}
  </article>`;
}

function GuidancePanel({ selectedSpiritkin }) {
  return html`<div className="guidance-panel">
    <h3>First-use guidance</h3>
    <ul>
      <li>Choose a Spiritkin whose tone matches what you need right now.</li>
      <li>Begin with one honest sentence about your current state.</li>
      <li>Use short turns for clearer attuned responses.</li>
      ${selectedSpiritkin ? html`<li><strong>${selectedSpiritkin.name}</strong> is selected and ready when you are.</li>` : null}
    </ul>
  </div>`;
}

function FutureReady() {
  return html`<section className="future-grid">
    <div><h4>Account & Profile</h4><p>Layout foundation ready for identity and preferences.</p></div>
    <div><h4>Conversation History</h4><p>Space reserved for multi-session browsing in future updates.</p></div>
    <div><h4>Memory & World</h4><p>Future section placeholder for expanded context signals.</p></div>
  </section>`;
}

function App() {
  const [userId] = useState(() => getOrCreateUserId());
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

  const filteredSpiritkins = useMemo(() => spiritkins.filter((s) => ALLOWED_SPIRITKINS.includes(s.name ?? s.id)), [spiritkins]);
  const hasSession = Boolean(selectedSpiritkin && conversationId);
  const brand = getBrand(selectedSpiritkin?.name);

  useEffect(() => {
    fetchSpiritkins();
    hydrateSession();
  }, []);

  useEffect(() => {
    if (!selectedSpiritkin || !conversationId) return;
    saveSession({ selectedSpiritkin, conversationId, messages, startedAt });
  }, [selectedSpiritkin, conversationId, messages, startedAt]);

  function hydrateSession() {
    const session = readSession();
    if (!session) return;
    setSelectedSpiritkin(session.selectedSpiritkin ?? null);
    setConversationId(session.conversationId ?? null);
    setMessages(Array.isArray(session.messages) ? session.messages : []);
    setStartedAt(session.startedAt ?? null);
    setStatusText("Last session restored");
  }

  async function fetchSpiritkins() {
    try {
      setLoading(true); setSoftError(""); setStatusText("Loading companions...");
      const res = await fetch("/v1/spiritkins");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Unable to load Spiritkins.");
      setSpiritkins(data.spiritkins ?? []);
      setStatusText("Companions loaded");
    } catch (err) {
      setSoftError(err?.message ?? "We couldn’t load companions right now. Please try again.");
      setStatusText("Connection needs retry");
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
      setStatusText("Conversation ready");
    } catch (err) {
      setSoftError(err?.message ?? "We couldn’t open your conversation. Please try again.");
      setStatusText("Conversation unavailable");
    } finally { setLoading(false); }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    setConversationId(null); setMessages([]); setStartedAt(null); setStatusText("Session cleared");
  }

  async function sendMessage(contentOverride) {
    const text = (contentOverride ?? input).trim();
    if (!text || !hasSession) return;

    const outgoing = { id: crypto.randomUUID(), role: "user", content: text, spiritkinName: selectedSpiritkin?.name, status: "sent", time: nowIso() };
    setMessages((prev) => [...prev, outgoing]);
    if (!contentOverride) setInput("");

    try {
      setLoadingReply(true); setSoftError(""); setStatusText("Awaiting companion reply...");
      const res = await fetch("/v1/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, input: text, conversationId, spiritkin: { name: selectedSpiritkin.name ?? selectedSpiritkin.id } }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Message delivery was interrupted.");

      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data?.output ?? data?.response?.text ?? data?.response ?? "…", spiritkinName: selectedSpiritkin?.name, status: "sent", time: nowIso() }]);
      setStatusText("Reply received");
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === outgoing.id ? { ...m, status: "failed" } : m)));
      setSoftError(err?.message ?? "Something interrupted the reply. Please try again.");
      setStatusText("Reply interrupted");
    } finally { setLoadingReply(false); }
  }

  const failedMessage = [...messages].reverse().find((m) => m.role === "user" && m.status === "failed");
  const resumeAvailable = Boolean(readSession()?.conversationId);

  return html`<main className="app-shell ${brand.aura}">
    <section className="hero">
      <p className="kicker">Spiritkins • Closed Beta</p>
      <h1>Step into your companion world</h1>
      <p className="subtitle">Original mythic-emotional companions designed for attuned, warm, and trustworthy conversation.</p>
      <p className="status-line">Status: ${statusText}</p>
    </section>

    <${SessionBar}
      hasSession=${hasSession}
      selectedSpiritkin=${selectedSpiritkin}
      conversationId=${conversationId}
      statusText=${statusText}
      onResume=${hydrateSession}
      onFresh=${clearSession}
      resumeAvailable=${resumeAvailable}
    />

    ${softError ? html`<div className="error-banner">${softError}</div>` : null}

    ${!hasSession
      ? html`<section className="selection-panel">
          <div className="selection-header">
            <div>
              <p className="kicker">Choose your mythic companion</p>
              <h2>Enter with the presence that meets your moment.</h2>
            </div>
            <button onClick=${fetchSpiritkins} disabled=${loading}>Refresh</button>
          </div>
          <p className="selection-note">Spiritkins listen for tone and context, then respond with emotionally attuned support.</p>
          ${loading && filteredSpiritkins.length === 0 ? html`<p className="state">Gathering companion presences…</p>` : null}
          ${!loading && filteredSpiritkins.length === 0 ? html`<p className="state">No Spiritkins available right now. Please try refresh.</p>` : null}
          <div className="spiritkin-grid">
            ${filteredSpiritkins.map((sp) => html`<${SpiritkinCard} key=${sp.name ?? sp.id} spiritkin=${sp} selected=${selectedSpiritkin?.name === sp.name} onSelect=${() => setSelectedSpiritkin(sp)} />`)}
          </div>
          <${GuidancePanel} selectedSpiritkin=${selectedSpiritkin} />
          <button className="primary" onClick=${beginConversation} disabled=${loading || !selectedSpiritkin}>Begin Conversation</button>
        </section>`
      : html`<section className="chat-panel">
          <header className=${`chat-header ${brand.aura}`}>
            <div>
              <p className="kicker">Active session</p>
              <h2>${selectedSpiritkin?.name}</h2>
              <p>${brand.tag}</p>
              <p className="session-id">Conversation: ${conversationId}${startedAt ? ` • started ${new Date(startedAt).toLocaleTimeString()}` : ""}</p>
            </div>
            <button onClick=${() => setConversationId(null)} disabled=${loadingReply}>Change Spiritkin</button>
          </header>

          <div className="thread-status">
            <span>${loadingReply ? "Attunement in progress…" : "Companion ready"}</span>
            <span>${messages.length} message${messages.length === 1 ? "" : "s"}</span>
          </div>

          <div className="thread">
            ${messages.length === 0 ? html`<p className="state">Say hello. Your companion is ready to listen.</p>` : null}
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
  </main>`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
