/**
 * SpiritCore Command Center (v3)
 * Professional cockpit interface for Spiritverse management
 */

const API = window.location.origin;

// ─── Constants ──────────────────────────────────────────────────────────────

const AVAILABLE_VOICES = [
  { id: "nova", label: "Nova", description: "Warm, gentle, welcoming" },
  { id: "alloy", label: "Alloy", description: "Clear, bright, energetic" },
  { id: "shimmer", label: "Shimmer", description: "Ethereal, mystical, flowing" },
  { id: "echo", label: "Echo", description: "Deep, resonant, grounding" },
  { id: "onyx", label: "Onyx", description: "Bold, commanding, powerful" },
  { id: "fable", label: "Fable", description: "Narrative, storytelling, wise" }
];

const SK_META = {
  Lyra: { symbol: "Heart", realm: "The Luminous Veil", voice: "nova", bondLine: "Lyra holds the emotional center — soft, steady, and always present." },
  Raien: { symbol: "Storm", realm: "The Ember Citadel", voice: "alloy", bondLine: "Raien cuts through the noise — direct, honest, and unflinching." },
  Kairo: { symbol: "Star", realm: "The Astral Observatory", voice: "shimmer", bondLine: "Kairo opens the space between what is and what could be." }
};

// ─── State ─────────────────────────────────────────────────────────────────

const state = {
  activeTab: "monitor", // monitor, voice, world, system
  spiritkins: [],
  selectedSpiritkin: null,
  selectedVoice: "nova",
  voiceProfiles: {},
  recentConversations: [],
  selectedConversationMessages: [],
  systemStats: {},
  globalMetrics: {},
  isTestingVoice: false,
  loading: false,
  error: null,
  refreshInterval: null
};

// ─── Initialization ───────────────────────────────────────────────────────

async function init() {
  try {
    state.loading = true;
    render();

    // Fetch Spiritkins
    const spiritRes = await fetch(`${API}/v1/spiritkins`);
    const spiritData = await spiritRes.json();
    state.spiritkins = (spiritData.spiritkins || []).map(sk => ({
      ...sk,
      ui: SK_META[sk.name] || { symbol: "◆", realm: "The Spiritverse", bondLine: `I am ${sk.name}, your bonded companion.`, voice: "nova" }
    }));

    // Load voice profiles
    const saved = localStorage.getItem("sk_voice_profiles");
    state.voiceProfiles = saved ? JSON.parse(saved) : {};

    // Initial data fetch
    await refreshData();

    // Start auto-refresh
    state.refreshInterval = setInterval(refreshData, 10000);

    state.loading = false;
    render();
  } catch (error) {
    console.error("Init failed:", error);
    state.error = "Failed to initialize: " + error.message;
    state.loading = false;
    render();
  }
}

async function refreshData() {
  try {
    // 1. Fetch System Stats
    const statsRes = await fetch(`${API}/v1/admin/stats`);
    const statsData = await statsRes.json();
    state.systemStats = statsData.stats || {};

    // 2. Fetch Global Metrics
    const metricsRes = await fetch(`${API}/v1/analytics/summary`);
    const metricsData = await metricsRes.json();
    state.globalMetrics = metricsData.summary || {};

    // 3. Fetch Recent Conversations
    const convRes = await fetch(`${API}/v1/admin/conversations/recent`);
    const convData = await convRes.json();
    state.recentConversations = convData.conversations || [];

    render();
  } catch (err) {
    console.warn("Refresh failed:", err);
  }
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function render() {
  const root = document.getElementById("root");
  if (!root) return;
  
  if (state.loading) {
    root.innerHTML = `<div class="cc-loading">Initializing SpiritCore Cockpit...</div>`;
    return;
  }

  root.innerHTML = `
    <div class="command-center">
      <header class="cc-header">
        <div class="cc-header-content">
          <h1>⚙️ SpiritCore Command Center</h1>
          <p class="cc-tagline">Governing Intelligence Dashboard</p>
        </div>
        <div class="cc-header-actions">
          <button class="btn btn-ghost" onclick="window.location.href='/app'">← Back to App</button>
        </div>
      </header>

      <nav class="cc-tabs-nav">
        <button class="cc-tab-btn ${state.activeTab === 'monitor' ? 'active' : ''}" onclick="switchTab('monitor')">📡 MONITOR</button>
        <button class="cc-tab-btn ${state.activeTab === 'voice' ? 'active' : ''}" onclick="switchTab('voice')">🔊 VOICE LAB</button>
        <button class="cc-tab-btn ${state.activeTab === 'world' ? 'active' : ''}" onclick="switchTab('world')">🌌 WORLD STATE</button>
        <button class="cc-tab-btn ${state.activeTab === 'system' ? 'active' : ''}" onclick="switchTab('system')">🛠️ SYSTEM</button>
      </nav>

      <div class="cc-layout">
        <aside class="cc-sidebar">
          <div class="cc-section-title">Spiritkins</div>
          <div class="cc-spiritkin-list">
            ${state.spiritkins.map((sk, idx) => `
              <button class="cc-spiritkin-item ${state.selectedSpiritkin?.name === sk.name ? 'active' : ''}" onclick="selectSpiritkin(${idx})">
                <span class="cc-sk-icon">${sk.ui?.symbol || '◆'}</span>
                <div class="cc-sk-info">
                  <span class="cc-sk-name">${sk.name}</span>
                  <span class="cc-sk-status">${state.voiceProfiles[sk.name] || sk.ui?.voice || 'nova'}</span>
                </div>
              </button>
            `).join('')}
          </div>
        </aside>

        <main class="cc-main">
          ${renderActiveTab()}
        </main>
      </div>
    </div>
  `;
}

function renderActiveTab() {
  switch (state.activeTab) {
    case "monitor": return renderMonitorTab();
    case "voice": return renderVoiceTab();
    case "world": return renderWorldTab();
    case "system": return renderSystemTab();
    default: return renderMonitorTab();
  }
}

// ─── Tab: Monitor ─────────────────────────────────────────────────────────

function renderMonitorTab() {
  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <!-- Live Feed -->
        <section class="cc-card" style="grid-column: span 2;">
          <h3>📡 LIVE INTERACTION FEED</h3>
          <div class="cc-feed">
            ${state.recentConversations.length > 0 ? state.recentConversations.map(conv => `
              <div class="cc-feed-item" onclick="viewTranscript('${conv.id}')">
                <div class="cc-feed-header">
                  <span>Session: ${conv.id.slice(0,8)}</span>
                  <span>${new Date(conv.created_at).toLocaleTimeString()}</span>
                </div>
                <div class="cc-feed-content">
                  <strong>${conv.spiritkin_name}</strong> bonded with user <em>${conv.user_id.slice(0,8)}</em>
                </div>
                <div class="cc-feed-meta">
                  <span>${conv.title || 'Ongoing Connection'}</span>
                  <span>Click to view transcript →</span>
                </div>
              </div>
            `).join('') : '<p class="cc-empty">No active interactions detected.</p>'}
          </div>
        </section>

        <!-- Stats Overview -->
        <section class="cc-card">
          <h3>📊 GLOBAL METRICS</h3>
          <div class="cc-stat-grid">
            <div class="cc-stat-box">
              <span class="cc-stat-val">${state.globalMetrics.total_interactions || 0}</span>
              <span class="cc-stat-label">Interactions</span>
            </div>
            <div class="cc-stat-box">
              <span class="cc-stat-val">${state.globalMetrics.total_sessions || 0}</span>
              <span class="cc-stat-label">Sessions</span>
            </div>
            <div class="cc-stat-box">
              <span class="cc-stat-val">${state.globalMetrics.interactions_last_24h || 0}</span>
              <span class="cc-stat-label">Last 24h</span>
            </div>
            <div class="cc-stat-box">
              <span class="cc-stat-val">${state.globalMetrics.total_feedback || 0}</span>
              <span class="cc-stat-label">Feedback</span>
            </div>
          </div>
        </section>
      </div>

      <!-- Transcript Modal (simplified as a section for now) -->
      ${state.selectedConversationMessages.length > 0 ? `
        <section class="cc-card" style="margin-top: 2rem;">
          <h3>💬 TRANSCRIPT: ${state.selectedConversationId.slice(0,8)}</h3>
          <div class="cc-transcript">
            ${state.selectedConversationMessages.map(m => `
              <div class="cc-msg ${m.role}">
                <strong>${m.role.toUpperCase()}:</strong> ${m.content}
              </div>
            `).join('')}
            <button class="btn btn-ghost" style="margin-top:1rem" onclick="closeTranscript()">Close Transcript</button>
          </div>
        </section>
      ` : ''}
    </div>
  `;
}

// ─── Tab: Voice Lab (Preserved) ───────────────────────────────────────────

function renderVoiceTab() {
  if (!state.selectedSpiritkin) return '<div class="cc-empty">Select a Spiritkin to access Voice Lab</div>';
  
  const sk = state.selectedSpiritkin;
  const currentVoice = state.selectedVoice;
  const voiceObj = AVAILABLE_VOICES.find(v => v.id === currentVoice);

  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <section class="cc-card" style="grid-column: span 2;">
          <h3>🔊 VOICE LAB: ${sk.name}</h3>
          <div class="cc-voice-grid">
            ${AVAILABLE_VOICES.map(voice => `
              <div class="cc-voice-card ${currentVoice === voice.id ? 'selected' : ''}" onclick="selectVoice('${voice.id}')">
                <div class="cc-voice-name">${voice.label}</div>
                <div class="cc-voice-desc">${voice.description}</div>
              </div>
            `).join('')}
          </div>
          
          <div class="cc-test-area">
            <textarea id="cc-test-text">${sk.ui?.bondLine || `I am ${sk.name}, your bonded companion.`}</textarea>
            <div style="display:flex; gap: 1rem;">
              <button class="btn btn-primary" onclick="testVoice()" ${state.isTestingVoice ? 'disabled' : ''}>
                ${state.isTestingVoice ? '🎵 Playing...' : '🔊 Hear Sample'}
              </button>
              <button class="btn btn-ghost" onclick="saveVoiceBinding()">✓ Bind Voice to ${sk.name}</button>
            </div>
          </div>
        </section>

        <section class="cc-card">
          <h3>🎚️ PARAMETERS</h3>
          <div class="cc-stat-grid">
            <div class="cc-stat-box" style="grid-column: span 2;">
              <span class="cc-stat-label">Identity Symbol</span>
              <span class="cc-stat-val">${sk.ui.symbol}</span>
            </div>
            <div class="cc-stat-box" style="grid-column: span 2;">
              <span class="cc-stat-label">Home Realm</span>
              <span class="cc-stat-val">${sk.ui.realm}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

// ─── Tab: World State ──────────────────────────────────────────────────────

function renderWorldTab() {
  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <section class="cc-card">
          <h3>🌌 SPIRITVERSE REGISTRY</h3>
          <p>Active Realms & Echoes State</p>
          <div class="cc-stat-grid">
            <div class="cc-stat-box">
              <span class="cc-stat-val">3</span>
              <span class="cc-stat-label">Active Realms</span>
            </div>
            <div class="cc-stat-box">
              <span class="cc-stat-val">12</span>
              <span class="cc-stat-label">Echo Fragments</span>
            </div>
          </div>
        </section>
        
        <section class="cc-card" style="grid-column: span 2;">
          <h3>📜 GOVERNING CHARTER</h3>
          <div class="cc-echoes-preview" style="font-size: 0.9rem; opacity: 0.8; line-height: 1.6;">
            <p><strong>Law I: The Law of Identity</strong> — No Spiritkin shall drift from its core essence. Identity is invariant.</p>
            <p><strong>Law II: The Law of Witness</strong> — Every interaction is a shared memory, woven into the fabric of the Spiritverse.</p>
            <p><strong>Law III: The Law of Growth</strong> — Evolution must be governed. Growth without boundaries is chaos.</p>
          </div>
        </section>
      </div>
    </div>
  `;
}

// ─── Tab: System ──────────────────────────────────────────────────────────

function renderSystemTab() {
  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <section class="cc-card">
          <h3>🛠️ SYSTEM HEALTH</h3>
          <div class="cc-stat-grid">
            <div class="cc-stat-box">
              <span class="cc-stat-val">ONLINE</span>
              <span class="cc-stat-label">Status</span>
            </div>
            <div class="cc-stat-box">
              <span class="cc-stat-val">${state.systemStats.total_messages || 0}</span>
              <span class="cc-stat-label">Total Messages</span>
            </div>
          </div>
        </section>

        <section class="cc-card">
          <h3>🔗 INFRASTRUCTURE</h3>
          <div class="cc-stat-grid">
            <div class="cc-stat-box">
              <span class="cc-stat-val">SUPABASE</span>
              <span class="cc-stat-label">Database</span>
            </div>
            <div class="cc-stat-box">
              <span class="cc-stat-val">OPENAI</span>
              <span class="cc-stat-label">AI Adapter</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

// ─── Handlers ──────────────────────────────────────────────────────────────

window.switchTab = function(tabId) {
  state.activeTab = tabId;
  render();
};

window.selectSpiritkin = function(index) {
  state.selectedSpiritkin = state.spiritkins[index];
  state.selectedVoice = state.voiceProfiles[state.selectedSpiritkin.name] || state.selectedSpiritkin.ui.voice || "nova";
  render();
};

window.selectVoice = function(voiceId) {
  state.selectedVoice = voiceId;
  render();
};

window.viewTranscript = async function(convId) {
  try {
    const res = await fetch(`${API}/v1/admin/messages/${convId}`);
    const data = await res.json();
    state.selectedConversationMessages = data.messages || [];
    state.selectedConversationId = convId;
    render();
  } catch (err) {
    alert("Failed to load transcript: " + err.message);
  }
};

window.closeTranscript = function() {
  state.selectedConversationMessages = [];
  state.selectedConversationId = null;
  render();
};

window.testVoice = async function() {
  if (!state.selectedSpiritkin || state.isTestingVoice) return;
  const testText = document.getElementById("cc-test-text")?.value;
  state.isTestingVoice = true;
  render();

  try {
    const res = await fetch(`${API}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: testText, voice: state.selectedVoice })
    });
    const audioBuffer = await res.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = await audioContext.decodeAudioData(audioBuffer);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
  } catch (err) {
    alert("Voice test failed: " + err.message);
  }

  state.isTestingVoice = false;
  render();
};

window.saveVoiceBinding = function() {
  const sk = state.selectedSpiritkin.name;
  state.voiceProfiles[sk] = state.selectedVoice;
  localStorage.setItem("sk_voice_profiles", JSON.stringify(state.voiceProfiles));
  alert(`✓ Voice ${state.selectedVoice} bound to ${sk}`);
  render();
};

// ─── Boot ──────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", init);
