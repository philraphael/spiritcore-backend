import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

const DEFAULT_ENVS = {
  local: "http://localhost:3000",
  staging: "https://staging.spiritcore.internal",
  production: "https://api.spiritcore.internal",
};

function Panel({ title, children }) {
  return html`<section className="panel"><header className="panel-header">${title}</header><div className="panel-body">${children}</div></section>`;
}

function Field({ label, children }) {
  return html`<label className="field"><span className="field-label">${label}</span>${children}</label>`;
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

function MetadataBlock({ title, value }) {
  return html`<div className="metadata-block"><h4>${title}</h4><pre>${typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2)}</pre></div>`;
}

function App() {
  const [environment, setEnvironment] = useState("local");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_ENVS.local);
  const [spiritkins, setSpiritkins] = useState([]);
  const [spiritkinName, setSpiritkinName] = useState("");
  const [userId, setUserId] = useState("operator-user-1");
  const [conversationId, setConversationId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({});
  const [status, setStatus] = useState("idle");

  const canSend = useMemo(
    () => Boolean(input.trim() && userId.trim() && spiritkinName.trim() && conversationId.trim()),
    [input, userId, spiritkinName, conversationId]
  );

  useEffect(() => {
    setBaseUrl(DEFAULT_ENVS[environment]);
  }, [environment]);

  async function checkReady() {
    setStatus("Checking /ready ...");
    const res = await fetch(`${baseUrl}/ready`);
    const data = await res.json();
    setStatus(data?.ok ? "Backend ready" : "Backend not ready");
  }

  async function loadSpiritkins() {
    setStatus("Loading spiritkins ...");
    const res = await fetch(`${baseUrl}/v1/spiritkins`);
    const data = await res.json();
    const list = data?.spiritkins ?? [];
    setSpiritkins(list);
    if (!spiritkinName && list.length > 0) setSpiritkinName(list[0].name ?? list[0].id ?? "");
    setStatus(`Loaded ${list.length} spiritkin(s)`);
  }

  async function createConversation() {
    setStatus("Creating conversation ...");
    const res = await fetch(`${baseUrl}/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId.trim(), spiritkinName: spiritkinName.trim() }),
    });
    const data = await res.json();
    const newId = data?.conversation?.id ?? data?.conversation_id ?? "";
    setConversationId(newId);
    setStatus(newId ? `Conversation created: ${newId}` : "Conversation create returned no id");
  }

  async function sendMessage() {
    if (!canSend) return;
    const outbound = { role: "operator", content: input.trim(), time: new Date().toISOString() };
    setMessages((prev) => [...prev, outbound]);
    setInput("");
    setStatus("Sending /v1/interact ...");

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
    const assistantMsg = {
      role: "assistant",
      content: data?.output ?? data?.response?.text ?? data?.response ?? "(no response)",
      time: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMsg]);
    setMeta(data);
    setStatus(res.ok ? "Interaction complete" : "Interaction failed");
  }

  return html`<main className="layout">
    <${Panel} title="Operator Controls">
      <${Field} label="Environment">
        <select value=${environment} onChange=${(e) => setEnvironment(e.target.value)}>
          ${Object.keys(DEFAULT_ENVS).map((env) => html`<option key=${env} value=${env}>${env}</option>`) }
        </select>
      <//>

      <${Field} label="API Base URL">
        <input value=${baseUrl} onChange=${(e) => setBaseUrl(e.target.value)} />
      <//>

      <div className="button-row">
        <button onClick=${checkReady}>Check /ready</button>
        <button onClick=${loadSpiritkins}>Load Spiritkins</button>
      </div>

      <${Field} label="Spiritkin Selector">
        <select value=${spiritkinName} onChange=${(e) => setSpiritkinName(e.target.value)}>
          <option value="">-- choose spiritkin --</option>
          ${spiritkins.map((s) => html`<option key=${s.name ?? s.id} value=${s.name ?? s.id}>${s.name ?? s.id}</option>`) }
        </select>
      <//>

      <${Field} label="userId"><input value=${userId} onChange=${(e) => setUserId(e.target.value)} /><//>
      <${Field} label="conversationId"><input value=${conversationId} onChange=${(e) => setConversationId(e.target.value)} /><//>

      <button onClick=${createConversation}>Create Conversation</button>
      <p className="status">${status}</p>
    <//>

    <${Panel} title="Interaction">
      <div className="chat-window">
        ${messages.length === 0 ? html`<p className="placeholder">No messages yet.</p>` : null}
        ${messages.map((msg, i) => html`<${MessageItem} key=${`${msg.time}-${i}`} msg=${msg} />`)}
      </div>
      <div className="chat-controls">
        <input
          placeholder="Type an operator message..."
          value=${input}
          onChange=${(e) => setInput(e.target.value)}
          onKeyDown=${(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick=${sendMessage} disabled=${!canSend}>Send</button>
      </div>
    <//>

    <${Panel} title="Response Metadata">
      <${MetadataBlock} title="Raw JSON" value=${meta} />
      <${MetadataBlock} title="Safety" value=${meta?.safety} />
      <${MetadataBlock} title="Governance" value=${meta?.governance} />
      <${MetadataBlock} title="Policy" value=${meta?.policy} />
      <${MetadataBlock} title="World State" value=${meta?.world_state ?? meta?.worldState} />
      <${MetadataBlock} title="Emotion" value=${meta?.emotion} />
      <${MetadataBlock} title="Trace ID" value=${meta?.trace_id ?? meta?.request_id} />
    <//>
  </main>`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
