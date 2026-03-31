import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

const DEFAULT_ENVS = {
  local: "http://localhost:3000",
  staging: "https://staging.spiritcore.internal",
  production: "https://api.spiritcore.internal",
};

const STATUS_KIND = {
  idle: "info",
  success: "success",
  error: "error",
  loading: "loading",
};

function Panel({ title, actions, children, compact = false }) {
  return html`
    <section className=${`panel ${compact ? "panel-compact" : ""}`}>
      <header className="panel-header">
        <h2>${title}</h2>
        <div className="panel-actions">${actions}</div>
      </header>
      <div className="panel-body">${children}</div>
    </section>
  `;
}

function Field({ label, children }) {
  return html`<label className="field"><span className="field-label">${label}</span>${children}</label>`;
}

function StatusBanner({ kind, message }) {
  if (!message) return null;
  return html`<div className=${`status-banner status-${kind}`}>${message}</div>`;
}

function MessageItem({ msg }) {
  return html`<article className="message-item">
    <div className="message-head">
      <span className=${`role role-${msg.role}`}>${msg.role}</span>
      <span className="message-time">${new Date(msg.time).toLocaleTimeString()}</span>
    </div>
    <p>${msg.content}</p>
  </article>`;
}

function MetadataCard({ title, value }) {
  const rendered = typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2);
  return html`<div className="metadata-card"><h4>${title}</h4><pre>${rendered}</pre></div>`;
}

function TraceCard({ traceId }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    if (!traceId || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(traceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return html`<div className="trace-card">
    <h4>Trace ID</h4>
    <code>${traceId || "(none)"}</code>
    <button onClick=${onCopy} disabled=${!traceId}>${copied ? "Copied" : "Copy"}</button>
  </div>`;
}

function SpiritkinCard({ spiritkin, selected, onSelect }) {
  const title = spiritkin?.name ?? spiritkin?.id ?? "Unknown";
  const role = spiritkin?.role ?? spiritkin?.archetype ?? "n/a";
  const essence = spiritkin?.essence ?? spiritkin?.description ?? spiritkin?.summary ?? "No essence provided.";

  return html`<button className=${`spiritkin-card ${selected ? "selected" : ""}`} onClick=${onSelect}>
    <strong>${title}</strong>
    <span className="muted">Role: ${role}</span>
    <p>${String(essence)}</p>
  </button>`;
}

function ConversationRow({ conversation, active, onLoad }) {
  const title = conversation?.title ?? conversation?.id ?? "Untitled";
  const subtitle = conversation?.id ?? "No ID";
  const timestamp = conversation?.created_at ?? conversation?.updated_at ?? null;
  return html`<button className=${`conversation-row ${active ? "active" : ""}`} onClick=${onLoad}>
    <div>
      <strong>${title}</strong>
      <span className="muted mono">${subtitle}</span>
    </div>
    <span className="muted">${timestamp ? new Date(timestamp).toLocaleString() : ""}</span>
  </button>`;
}

function App() {
  const [environment, setEnvironment] = useState("local");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_ENVS.local);
  const [spiritkins, setSpiritkins] = useState([]);
  const [spiritkinName, setSpiritkinName] = useState("");
  const [userId, setUserId] = useState("operator-user-1");
  const [conversationId, setConversationId] = useState("");
  const [conversationList, setConversationList] = useState([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({});
  const [status, setStatus] = useState({ kind: STATUS_KIND.idle, message: "Idle" });

  const canSend = useMemo(
    () => Boolean(input.trim() && userId.trim() && spiritkinName.trim() && conversationId.trim()),
    [input, userId, spiritkinName, conversationId]
  );

  useEffect(() => {
    setBaseUrl(DEFAULT_ENVS[environment]);
  }, [environment]);

  function setSuccess(message) {
    setStatus({ kind: STATUS_KIND.success, message });
  }

  function setError(message) {
    setStatus({ kind: STATUS_KIND.error, message });
  }

  function setLoading(message) {
    setStatus({ kind: STATUS_KIND.loading, message });
  }

  async function checkReady() {
    try {
      setLoading("Checking backend readiness...");
      const res = await fetch(`${baseUrl}/ready`);
      const data = await res.json();
      if (!res.ok || !data?.ok) return setError("Backend ready check failed");
      setSuccess("Backend is ready");
    } catch (err) {
      setError(`Ready check error: ${err?.message ?? err}`);
    }
  }

  async function loadSpiritkins() {
    try {
      setLoading("Loading spiritkin registry...");
      const res = await fetch(`${baseUrl}/v1/spiritkins`);
      const data = await res.json();
      if (!res.ok || !data?.ok) return setError(data?.message ?? "Failed to load spiritkins");
      const list = data?.spiritkins ?? [];
      setSpiritkins(list);
      if (!spiritkinName && list.length > 0) setSpiritkinName(list[0].name ?? list[0].id ?? "");
      setMeta(data);
      setSuccess(`Loaded ${list.length} spiritkin(s)`);
    } catch (err) {
      setError(`Spiritkin load error: ${err?.message ?? err}`);
    }
  }

  async function createConversation() {
    try {
      setLoading("Creating conversation...");
      const res = await fetch(`${baseUrl}/v1/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim(), spiritkinName: spiritkinName.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) return setError(data?.message ?? "Conversation create failed");
      const newId = data?.conversation?.id ?? "";
      setConversationId(newId);
      setMeta(data);
      setSuccess(`Conversation created: ${newId}`);
      await loadConversations();
    } catch (err) {
      setError(`Create conversation error: ${err?.message ?? err}`);
    }
  }

  async function loadConversations() {
    if (!userId.trim()) return setError("Set userId before loading conversations");
    try {
      setLoading("Loading conversation list...");
      const res = await fetch(`${baseUrl}/v1/conversations/${encodeURIComponent(userId.trim())}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) return setError(data?.message ?? "Failed to load conversations");
      const list = data?.conversations ?? [];
      setConversationList(list);
      setMeta(data);
      setSuccess(`Loaded ${list.length} conversation(s)`);
    } catch (err) {
      setError(`Conversation list error: ${err?.message ?? err}`);
    }
  }

  function loadConversationToSession(conversation) {
    const loadedId = conversation?.id ?? "";
    setConversationId(loadedId);
    setSuccess(`Active conversation set: ${loadedId}`);
  }

  async function sendMessage() {
    if (!canSend) return;
    try {
      const outbound = { role: "operator", content: input.trim(), time: new Date().toISOString() };
      setMessages((prev) => [...prev, outbound]);
      setInput("");
      setLoading("Sending interaction...");

      const payload = {
        userId: userId.trim(),
        spiritkin: { name: spiritkinName.trim() },
        input: outbound.content,
        conversationId: conversationId.trim(),
      };

      const res = await fetch(`${baseUrl}/v1/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setMeta(data);
        return setError(data?.message ?? "Interaction failed");
      }

      const assistantMsg = {
        role: "assistant",
        content: data?.output ?? data?.response?.text ?? data?.response ?? "(no response)",
        time: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setMeta(data);
      setSuccess("Interaction complete");
    } catch (err) {
      setError(`Interaction error: ${err?.message ?? err}`);
    }
  }

  const traceId = meta?.trace_id ?? meta?.traceId ?? meta?.request_id ?? null;

  return html`<main className="layout">
    <section className="left-stack">
      <${Panel}
        title="Operator Controls"
        actions=${html`<button onClick=${checkReady}>Check /ready</button>`}
      >
        <${StatusBanner} kind=${status.kind} message=${status.message} />

        <${Field} label="Environment">
          <select value=${environment} onChange=${(e) => setEnvironment(e.target.value)}>
            ${Object.keys(DEFAULT_ENVS).map((env) => html`<option key=${env} value=${env}>${env}</option>`) }
          </select>
        <//>

        <${Field} label="API Base URL"><input value=${baseUrl} onChange=${(e) => setBaseUrl(e.target.value)} /><//>
        <${Field} label="userId"><input value=${userId} onChange=${(e) => setUserId(e.target.value)} /><//>
        <${Field} label="conversationId"><input value=${conversationId} onChange=${(e) => setConversationId(e.target.value)} /><//>

        <div className="button-row">
          <button onClick=${loadSpiritkins}>Load Spiritkins</button>
          <button onClick=${createConversation}>Create Conversation</button>
        </div>
      <//>

      <${Panel}
        title="Conversation List"
        compact=${true}
        actions=${html`<button onClick=${loadConversations}>Refresh</button>`}
      >
        <div className="conversation-list">
          ${conversationList.length === 0
            ? html`<p className="muted">No conversations loaded.</p>`
            : conversationList.map((conv) =>
                html`<${ConversationRow}
                  key=${conv.id}
                  conversation=${conv}
                  active=${conversationId === conv.id}
                  onLoad=${() => loadConversationToSession(conv)}
                />`
              )}
        </div>
      <//>
    </section>

    <${Panel} title="Interaction Console">
      <div className="chat-window">
        ${messages.length === 0 ? html`<p className="placeholder">No messages yet.</p>` : null}
        ${messages.map((msg, i) => html`<${MessageItem} key=${`${msg.time}-${i}`} msg=${msg} />`)}
      </div>

      <div className="chat-controls">
        <${Field} label="Spiritkin">
          <input value=${spiritkinName} onChange=${(e) => setSpiritkinName(e.target.value)} placeholder="Spiritkin name" />
        <//>
        <${Field} label="Input">
          <textarea
            rows="3"
            value=${input}
            onChange=${(e) => setInput(e.target.value)}
            onKeyDown=${(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendMessage();
            }}
            placeholder="Type operator command/message..."
          />
        <//>
        <button className="send-btn" onClick=${sendMessage} disabled=${!canSend}>Send (Ctrl/Cmd + Enter)</button>
      </div>
    <//>

    <section className="right-stack">
      <${Panel} title="Diagnostics" compact=${true}>
        <${TraceCard} traceId=${traceId} />
        <div className="cards-grid">
          <${MetadataCard} title="Safety" value=${meta?.safety} />
          <${MetadataCard} title="Governance" value=${meta?.governance} />
          <${MetadataCard} title="Policy" value=${meta?.policy} />
          <${MetadataCard} title="World State" value=${meta?.world_state ?? meta?.worldState} />
          <${MetadataCard} title="Emotion" value=${meta?.emotion} />
        </div>
      <//>

      <${Panel} title="Spiritkin Registry" compact=${true}>
        <div className="registry-grid">
          ${spiritkins.length === 0
            ? html`<p className="muted">Load spiritkins to inspect registry cards.</p>`
            : spiritkins.map((sp) =>
                html`<${SpiritkinCard}
                  key=${sp.name ?? sp.id}
                  spiritkin=${sp}
                  selected=${spiritkinName === (sp.name ?? sp.id)}
                  onSelect=${() => setSpiritkinName(sp.name ?? sp.id ?? "")}
                />`
              )}
        </div>
      <//>

      <${Panel} title="Raw JSON" compact=${true}>
        <pre className="raw-json">${JSON.stringify(meta ?? null, null, 2)}</pre>
      <//>
    </section>
  </main>`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
