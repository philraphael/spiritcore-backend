import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const ALLOWED_SPIRITKINS = ["Lyra", "Raien", "Kairo"];
const SESSION_KEY = "spiritkins.session.v1";

const BRAND_BY_SPIRITKIN = {
  Lyra: {
    aura: "lyra",
    tag: "Warmth • Grounding • Compassion",
    welcome: "A gentle presence for steadiness, care, and calm clarity.",
  },
  Raien: {
    aura: "raien",
    tag: "Courage • Protection • Strength",
    welcome: "A steadfast companion for brave steps and resilient focus.",
  },
  Kairo: {
    aura: "kairo",
    tag: "Wonder • Imagination • Reflection",
    welcome: "A curious guide for creative insight and deeper perspective.",
  },
};

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

function getSpiritkinBrand(name) {
  return BRAND_BY_SPIRITKIN[name] ?? {
    aura: "default",
    tag: "Mythic Companion",
    welcome: "An original companion presence for meaningful conversation.",
  };
}

function SpiritkinCard({ spiritkin, selected, onSelect }) {
  const identityName = spiritkin.name ?? spiritkin.id;
  const brand = getSpiritkinBrand(identityName);

  return html`<button className=${`spiritkin-card ${brand.aura} ${selected ? "selected" : ""}`} onClick=${onSelect}>
    <p className="spiritkin-tag">${brand.tag}</p>
    <h3>${identityName}</h3>
    <p className="spiritkin-role">${spiritkin.role ?? spiritkin.archetype ?? "Companion"}</p>
    <p className="spiritkin-essence">${spiritkin.essence ?? spiritkin.description ?? spiritkin.summary ?? brand.welcome}</p>
  </button>`;
}

function MessageBubble({ item }) {
  return html`<article className=${`bubble ${item.role === "user" ? "user" : "assistant"}`}>
    <span className="bubble-role">${item.role === "user" ? "You" : item.spiritkinName ?? "Spiritkin"}</span>
    <p>${item.content}</p>
  </article>`;
}

function Onboarding({ spiritkins, selectedSpiritkin, onSelect, onBegin, onRefresh, loading }) {
  const brand = getSpiritkinBrand(selectedSpiritkin?.name);

  return html`<section className="selection-panel">
    <div className="selection-header">
      <div>
        <p className="kicker">Choose your mythic companion</p>
        <h2>Enter with the presence that meets your moment.</h2>
      </div>
      <button onClick=${onRefresh} disabled=${loading}>Refresh</button>
    </div>

    <p className="selection-note">Each Spiritkin is an original companion being—emotionally attuned, mythic in tone, and here to support your path.</p>

    ${loading && spiritkins.length === 0 ? html`<p className="state">Gathering companion presences…</p>` : null}
    ${!loading && spiritkins.length === 0 ? html`<p className="state">No Spiritkins available right now. Please try refresh.</p>` : null}

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

    ${selectedSpiritkin
      ? html`<div className=${`selected-preview ${brand.aura}`}>
          <strong>${selectedSpiritkin.name}</strong>
          <p>${brand.welcome}</p>
        </div>`
      : null}

    <button className="primary" onClick=${onBegin} disabled=${loading || !selectedSpiritkin}>
      Begin Conversation
    </button>
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
  const brand = getSpiritkinBrand(selectedSpiritkin?.name);

  return html`<section className="chat-panel">
    <header className=${`chat-header ${brand.aura}`}>
      <div>
        <p className="kicker">Active session</p>
        <h2>${selectedSpiritkin?.name}</h2>
        <p>${brand.tag}</p>
        <p className="session-id">Conversation: ${conversationId}</p>
      </div>
      <button onClick=${onChangeSpiritkin} disabled=${loadingReply}>Change Spiritkin</button>
    </header>

    <div className="thread">
      ${messages.length === 0 ? html`<p className="state">Say hello. Your companion is ready to listen.</p>` : null}
      ${messages.map((item, idx) => html`<${MessageBubble} key=${idx} item=${item} />`)}
      ${loadingReply
        ? html`<article className="bubble assistant loading-bubble"><span className="bubble-role">${selectedSpiritkin?.name ?? "Spiritkin"}</span><p>Listening… shaping a thoughtful reply.</p></article>`
        : null}
    </div>

    <div className="composer">
      <textarea
        value=${input}
        placeholder="Share what you’re feeling, wondering, or working through..."
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
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Unable to load Spiritkins.");
      setSpiritkins(data.spiritkins ?? []);
    } catch (err) {
      setSoftError(err?.message ?? "We couldn’t load companions right now. Please try again.");
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
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Could not begin a conversation yet.");

      const newConversationId = data?.conversation?.id ?? null;
      setConversationId(newConversationId);
      setMessages([]);
    } catch (err) {
      setSoftError(err?.message ?? "We couldn’t open your conversation. Please try again.");
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
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Message delivery was interrupted.");

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
      <h1>Step into your companion world</h1>
      <p className="subtitle">Spiritkins are original mythic-emotional companion beings—here to support clarity, courage, and inner wonder.</p>
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
