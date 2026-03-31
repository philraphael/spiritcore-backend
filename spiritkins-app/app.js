import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const ALLOWED_SPIRITKINS = ["Lyra", "Raien", "Kairo"];
const SESSION_KEY = "spiritkins.session.v1";

function getOrCreateUserId() {
  const existing = localStorage.getItem("spiritkins.userId");
  if (existing) return existing;
  const newId = `user-${crypto.randomUUID().slice(0, 8)}`;
  localStorage.setItem("spiritkins.userId", newId);
  return newId;
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function SpiritkinCard({ spiritkin, selected, onSelect }) {
  return html`<button className=${`spiritkin-card ${selected ? "selected" : ""}`} onClick=${onSelect}>
    <h3>${spiritkin.name ?? spiritkin.id}</h3>
    <p className="spiritkin-role">${spiritkin.role ?? spiritkin.archetype ?? "Companion"}</p>
    <p className="spiritkin-essence">${spiritkin.essence ?? spiritkin.description ?? spiritkin.summary ?? ""}</p>
  </button>`;
}

function MessageBubble({ item }) {
  return html`<article className=${`bubble ${item.role === "user" ? "user" : "assistant"}`}>
    <span className="bubble-role">${item.role === "user" ? "You" : item.spiritkinName ?? "Spiritkin"}</span>
    <p>${item.content}</p>
  </article>`;
}

function Onboarding({ spiritkins, selectedSpiritkin, onSelect, onBegin, onRefresh, loading }) {
  return html`<section className="selection-panel">
    <div className="selection-header">
      <div>
        <p className="kicker">Choose your companion</p>
        <h2>Who should walk with you today?</h2>
      </div>
      <button onClick=${onRefresh} disabled=${loading}>Refresh</button>
    </div>

    ${loading && spiritkins.length === 0 ? html`<p className="state">Loading Spiritkins…</p>` : null}
    ${!loading && spiritkins.length === 0 ? html`<p className="state">Spiritkins are currently unavailable. Try refresh.</p>` : null}

    <div className="spiritkin-grid">
      ${spiritkins.map(
        (sp) =>
          html`<${SpiritkinCard}
            key=${sp.name ?? sp.id}
            spiritkin=${sp}
            selected=${selectedSpiritkin?.name === sp.name}
            onSelect=${() => onSelect(sp)}
          />`
      )}
    </div>

    <button className="primary" onClick=${onBegin} disabled=${loading || !selectedSpiritkin}>Begin Conversation</button>
  </section>`;
}

function ChatScreen({
  selectedSpiritkin,
  conversationId,
  messages,
  loadingReply,
  input,
  onInput,
  onSend,
  onChangeSpiritkin,
}) {
  return html`<section className="chat-panel">
    <header className="chat-header">
      <div>
        <p className="kicker">Active session</p>
        <h2>${selectedSpiritkin?.name}</h2>
        <p>${selectedSpiritkin?.role ?? selectedSpiritkin?.archetype ?? "Spiritkin"}</p>
        <p className="session-id">Conversation: ${conversationId}</p>
      </div>
      <button onClick=${onChangeSpiritkin} disabled=${loadingReply}>Change Spiritkin</button>
    </header>

    <div className="thread">
      ${messages.length === 0 ? html`<p className="state">Say hello to begin your conversation.</p>` : null}
      ${messages.map((item, idx) => html`<${MessageBubble} key=${idx} item=${item} />`)}
      ${loadingReply
        ? html`<article className="bubble assistant loading-bubble"><span className="bubble-role">Spiritkin</span><p>Thinking with care…</p></article>`
        : null}
    </div>

    <div className="composer">
      <textarea
        value=${input}
        placeholder="Share what is on your mind..."
        onChange=${(e) => onInput(e.target.value)}
        onKeyDown=${(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      ></textarea>
      <button className="primary" onClick=${onSend} disabled=${loadingReply || !input.trim()}>Send</button>
    </div>
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

  const filteredSpiritkins = useMemo(
    () => spiritkins.filter((s) => ALLOWED_SPIRITKINS.includes(s.name ?? s.id)),
    [spiritkins]
  );

  const hasSession = Boolean(selectedSpiritkin && conversationId);

  useEffect(() => {
    fetchSpiritkins();
    hydrateSession();
  }, []);

  useEffect(() => {
    if (!selectedSpiritkin || !conversationId) return;
    saveSession({ selectedSpiritkin, conversationId, messages });
  }, [selectedSpiritkin, conversationId, messages]);

  function hydrateSession() {
    const session = readSession();
    if (!session) return;
    setSelectedSpiritkin(session.selectedSpiritkin ?? null);
    setConversationId(session.conversationId ?? null);
    setMessages(Array.isArray(session.messages) ? session.messages : []);
  }

  async function fetchSpiritkins() {
    try {
      setLoading(true);
      setSoftError("");
      const res = await fetch("/v1/spiritkins");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Failed to load Spiritkins");
      setSpiritkins(data.spiritkins ?? []);
    } catch (err) {
      setSoftError(err?.message ?? "Could not load Spiritkins right now.");
    } finally {
      setLoading(false);
    }
  }

  async function beginConversation() {
    if (!selectedSpiritkin) return;
    try {
      setLoading(true);
      setSoftError("");
      const res = await fetch("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, spiritkinName: selectedSpiritkin.name ?? selectedSpiritkin.id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Could not start a conversation.");

      const newConversationId = data?.conversation?.id ?? null;
      setConversationId(newConversationId);
      setMessages([]);
    } catch (err) {
      setSoftError(err?.message ?? "Unable to begin conversation right now.");
    } finally {
      setLoading(false);
    }
  }

  function resumeSession() {
    hydrateSession();
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    setConversationId(null);
    setMessages([]);
  }

  async function sendMessage() {
    if (!input.trim() || !hasSession) return;

    const outgoing = { role: "user", content: input.trim(), spiritkinName: selectedSpiritkin?.name };
    setMessages((prev) => [...prev, outgoing]);
    setInput("");

    try {
      setLoadingReply(true);
      setSoftError("");
      const res = await fetch("/v1/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          input: outgoing.content,
          conversationId,
          spiritkin: { name: selectedSpiritkin.name ?? selectedSpiritkin.id },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Your message could not be sent.");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data?.output ?? data?.response?.text ?? data?.response ?? "…",
          spiritkinName: selectedSpiritkin?.name,
        },
      ]);
    } catch (err) {
      setSoftError(err?.message ?? "Something interrupted the reply. Please try again.");
    } finally {
      setLoadingReply(false);
    }
  }

  const sessionAvailable = Boolean(readSession()?.conversationId);

  return html`<main className="app-shell">
    <section className="hero">
      <p className="kicker">Spiritkins • Closed Beta</p>
      <h1>Your calm companion space</h1>
      <p className="subtitle">A warm place to think, reflect, and reconnect with yourself—one conversation at a time.</p>
      <div className="hero-actions">
        ${sessionAvailable && !hasSession ? html`<button onClick=${resumeSession}>Resume Last Session</button>` : null}
        ${hasSession ? html`<button onClick=${clearSession}>Start Fresh</button>` : null}
      </div>
    </section>

    ${softError ? html`<div className="error-banner">${softError}</div>` : null}

    ${!hasSession
      ? html`<${Onboarding}
          spiritkins=${filteredSpiritkins}
          selectedSpiritkin=${selectedSpiritkin}
          onSelect=${setSelectedSpiritkin}
          onBegin=${beginConversation}
          onRefresh=${fetchSpiritkins}
          loading=${loading}
        />`
      : html`<${ChatScreen}
          selectedSpiritkin=${selectedSpiritkin}
          conversationId=${conversationId}
          messages=${messages}
          loadingReply=${loadingReply}
          input=${input}
          onInput=${setInput}
          onSend=${sendMessage}
          onChangeSpiritkin=${() => setConversationId(null)}
        />`}
  </main>`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
