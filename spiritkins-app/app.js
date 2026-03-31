import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const ALLOWED_SPIRITKINS = ["Lyra", "Raien", "Kairo"];

function createUserId() {
  const existing = localStorage.getItem("spiritkins.userId");
  if (existing) return existing;
  const newId = `user-${crypto.randomUUID().slice(0, 8)}`;
  localStorage.setItem("spiritkins.userId", newId);
  return newId;
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
    <span className="bubble-role">${item.role === "user" ? "You" : "Spiritkin"}</span>
    <p>${item.content}</p>
  </article>`;
}

function App() {
  const [userId] = useState(() => createUserId());
  const [spiritkins, setSpiritkins] = useState([]);
  const [selectedSpiritkin, setSelectedSpiritkin] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const readyToChat = Boolean(selectedSpiritkin && conversationId);

  const filteredSpiritkins = useMemo(
    () => spiritkins.filter((s) => ALLOWED_SPIRITKINS.includes(s.name ?? s.id)),
    [spiritkins]
  );

  useEffect(() => {
    fetchSpiritkins();
  }, []);

  async function fetchSpiritkins() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/v1/spiritkins");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Failed to load Spiritkins");
      setSpiritkins(data.spiritkins ?? []);
    } catch (err) {
      setError(err?.message ?? "Could not load Spiritkins");
    } finally {
      setLoading(false);
    }
  }

  async function beginConversation() {
    if (!selectedSpiritkin) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          spiritkinName: selectedSpiritkin.name ?? selectedSpiritkin.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Failed to begin conversation");
      setConversationId(data?.conversation?.id ?? null);
      setMessages([]);
    } catch (err) {
      setError(err?.message ?? "Unable to start conversation");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !readyToChat) return;
    const outgoing = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, outgoing]);
    setInput("");

    try {
      setLoading(true);
      setError("");
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
      if (!res.ok || !data?.ok) throw new Error(data?.message ?? "Message failed");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data?.output ?? data?.response?.text ?? data?.response ?? "...",
        },
      ]);
    } catch (err) {
      setError(err?.message ?? "Could not send message");
    } finally {
      setLoading(false);
    }
  }

  return html`<main className="app-shell">
    <section className="hero">
      <h1>Welcome to Spiritkins</h1>
      <p className="subtitle">A gentle companion space for reflection, focus, and inner grounding.</p>
    </section>

    ${error ? html`<div className="error-banner">${error}</div>` : null}

    ${!readyToChat
      ? html`<section className="selection-panel">
          <div className="selection-header">
            <h2>Choose your Spiritkin</h2>
            <button onClick=${fetchSpiritkins} disabled=${loading}>Refresh</button>
          </div>

          ${loading && filteredSpiritkins.length === 0 ? html`<p className="state">Loading Spiritkins…</p>` : null}
          ${!loading && filteredSpiritkins.length === 0 ? html`<p className="state">No Spiritkins available yet.</p>` : null}

          <div className="spiritkin-grid">
            ${filteredSpiritkins.map(
              (sp) =>
                html`<${SpiritkinCard}
                  key=${sp.name ?? sp.id}
                  spiritkin=${sp}
                  selected=${selectedSpiritkin?.name === sp.name}
                  onSelect=${() => setSelectedSpiritkin(sp)}
                />`
            )}
          </div>

          <button className="primary" onClick=${beginConversation} disabled=${loading || !selectedSpiritkin}>
            Begin Conversation
          </button>
        </section>`
      : html`<section className="chat-panel">
          <header className="chat-header">
            <div>
              <h2>${selectedSpiritkin?.name}</h2>
              <p>${selectedSpiritkin?.role ?? selectedSpiritkin?.archetype ?? "Spiritkin"}</p>
            </div>
            <button onClick=${() => setConversationId(null)} disabled=${loading}>Change Spiritkin</button>
          </header>

          <div className="thread">
            ${messages.length === 0
              ? html`<p className="state">Say hello to begin your conversation.</p>`
              : messages.map((item, idx) => html`<${MessageBubble} key=${idx} item=${item} />`)}
          </div>

          <div className="composer">
            <textarea
              value=${input}
              placeholder="Share what is on your mind..."
              onChange=${(e) => setInput(e.target.value)}
              onKeyDown=${(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            ></textarea>
            <button className="primary" onClick=${sendMessage} disabled=${loading || !input.trim()}>Send</button>
          </div>
        </section>`}
  </main>`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
