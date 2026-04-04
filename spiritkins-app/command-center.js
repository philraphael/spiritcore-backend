/**
 * SpiritCore Command Center
 * Professional admin interface for managing Spiritkins, voices, and world state
 */

const API = window.location.origin;

// Available professional voices from OpenAI
const AVAILABLE_VOICES = [
  { id: "nova", label: "Nova", description: "Warm, gentle, welcoming" },
  { id: "alloy", label: "Alloy", description: "Clear, bright, energetic" },
  { id: "shimmer", label: "Shimmer", description: "Ethereal, mystical, flowing" },
  { id: "echo", label: "Echo", description: "Deep, resonant, grounding" },
  { id: "onyx", label: "Onyx", description: "Bold, commanding, powerful" },
  { id: "fable", label: "Fable", description: "Narrative, storytelling, wise" }
];

const SK_META = {
  Lyra: {
    symbol: "Heart",
    bondLine: "Lyra holds the emotional center — soft, steady, and always present.",
    realm: "The Luminous Veil",
    voice: "nova"
  },
  Raien: {
    symbol: "Storm",
    bondLine: "Raien cuts through the noise — direct, honest, and unflinching.",
    realm: "The Ember Citadel",
    voice: "alloy"
  },
  Kairo: {
    symbol: "Star",
    bondLine: "Kairo opens the space between what is and what could be.",
    realm: "The Astral Observatory",
    voice: "shimmer"
  }
};

const state = {
  spiritkins: [],
  selectedSpiritkin: null,
  selectedVoice: "nova",
  voiceProfiles: {},
  isTestingVoice: false,
  currentAudio: null,
  systemStatus: {},
  loading: false,
  error: null
};

// ─── Initialization ───────────────────────────────────────────────────────

async function init() {
  try {
    state.loading = true;
    render();

    // Fetch Spiritkins
    const spiritRes = await fetch(`${API}/v1/spiritkins`);
    if (!spiritRes.ok) throw new Error(`Failed to fetch Spiritkins: ${spiritRes.status}`);
    
    const spiritData = await spiritRes.json();
    state.spiritkins = (spiritData.spiritkins || []).map(sk => {
      const meta = SK_META[sk.name] || {
        symbol: "◆",
        realm: "The Spiritverse",
        bondLine: `I am ${sk.name}, your bonded companion.`,
        voice: "nova"
      };
      return {
        ...sk,
        ui: meta
      };
    });

    // Load voice profiles from localStorage
    const saved = localStorage.getItem("sk_voice_profiles");
    state.voiceProfiles = saved ? JSON.parse(saved) : {};

    // Set first Spiritkin as selected
    if (state.spiritkins.length > 0) {
      state.selectedSpiritkin = state.spiritkins[0];
      state.selectedVoice = state.voiceProfiles[state.selectedSpiritkin.name] || state.selectedSpiritkin.ui.voice || "nova";
    }

    state.loading = false;
    render();
  } catch (error) {
    console.error("Init failed:", error);
    state.error = "Failed to load Spiritkins: " + error.message;
    state.loading = false;
    render();
  }
}

// ─── Render ───────────────────────────────────────────────────────────────

function render() {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = buildCommandCenter();
  attachEventListeners();
}

function buildCommandCenter() {
  if (state.loading) {
    return `<div class="cc-loading">Loading SpiritCore Command Center...</div>`;
  }

  return `
    <div class="command-center">
      <header class="cc-header">
        <div class="cc-header-content">
          <h1>⚙️ SpiritCore Command Center</h1>
          <p class="cc-tagline">Manage Spiritkins, voices, and the Spiritverse</p>
        </div>
        <button class="btn btn-ghost" onclick="window.location.href='/app'">← Back to App</button>
      </header>

      <div class="cc-layout">
        <!-- Sidebar: Spiritkin Selection -->
        <aside class="cc-sidebar">
          <div class="cc-section-title">Spiritkins</div>
          <div class="cc-spiritkin-list">
            ${state.spiritkins.map((sk, idx) => `
              <button
                class="cc-spiritkin-item ${state.selectedSpiritkin?.name === sk.name ? 'active' : ''}"
                onclick="selectSpiritkin(${idx})"
              >
                <span class="cc-sk-icon">${sk.ui?.symbol || '◆'}</span>
                <span class="cc-sk-name">${sk.name}</span>
                <span class="cc-sk-voice">${state.voiceProfiles[sk.name] || sk.ui?.voice || 'nova'}</span>
              </button>
            `).join('')}
          </div>
        </aside>

        <!-- Main Content: Voice Lab -->
        <main class="cc-main">
          ${state.selectedSpiritkin ? buildVoiceLab() : '<div class="cc-empty">Select a Spiritkin to begin</div>'}
        </main>
      </div>
    </div>
  `;
}

function buildVoiceLab() {
  const sk = state.selectedSpiritkin;
  const currentVoice = state.selectedVoice;
  const voiceObj = AVAILABLE_VOICES.find(v => v.id === currentVoice);

  return `
    <div class="cc-voice-lab">
      <!-- Spiritkin Profile -->
      <section class="cc-section">
        <h2>${sk.name}</h2>
        <div class="cc-spiritkin-profile">
          <div class="cc-profile-info">
            <div class="cc-profile-row">
              <span class="cc-label">Realm:</span>
              <span class="cc-value">${sk.ui?.realm || 'Unknown'}</span>
            </div>
            <div class="cc-profile-row">
              <span class="cc-label">Symbol:</span>
              <span class="cc-value">${sk.ui?.symbol || '◆'}</span>
            </div>
            <div class="cc-profile-row">
              <span class="cc-label">Current Voice:</span>
              <span class="cc-value cc-voice-badge">${voiceObj?.label || currentVoice}</span>
            </div>
            <div class="cc-profile-row">
              <span class="cc-label">Voice Description:</span>
              <span class="cc-value">${voiceObj?.description || ''}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Voice Selection -->
      <section class="cc-section">
        <h3>Select a Voice</h3>
        <div class="cc-voice-grid">
          ${AVAILABLE_VOICES.map(voice => `
            <div class="cc-voice-card ${currentVoice === voice.id ? 'selected' : ''}" onclick="selectVoice('${voice.id}')">
              <div class="cc-voice-name">${voice.label}</div>
              <div class="cc-voice-desc">${voice.description}</div>
              ${currentVoice === voice.id ? '<div class="cc-voice-checkmark">✓</div>' : ''}
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Voice Testing -->
      <section class="cc-section">
        <h3>Test Voice</h3>
        <div class="cc-test-area">
          <textarea
            id="cc-test-text"
            class="cc-test-input"
            placeholder="Enter text to hear ${sk.name} speak in the selected voice..."
          >${sk.ui?.bondLine || `I am ${sk.name}, your bonded companion.`}</textarea>
          <button
            id="cc-test-btn"
            class="btn btn-primary cc-test-btn"
            onclick="testVoice()"
            ${state.isTestingVoice ? 'disabled' : ''}
          >
            ${state.isTestingVoice ? '🎵 Playing...' : '🔊 Hear Sample'}
          </button>
        </div>
      </section>

      <!-- Tone Parameters (Advanced) -->
      <section class="cc-section">
        <h3>Voice Tone Parameters</h3>
        <div class="cc-tone-controls">
          <div class="cc-tone-row">
            <label>Speed</label>
            <input type="range" min="0.5" max="1.5" step="0.1" value="1" class="cc-slider" onchange="updateToneParam('speed', this.value)">
            <span id="cc-speed-val">1.0x</span>
          </div>
          <div class="cc-tone-row">
            <label>Tone</label>
            <select class="cc-select" onchange="updateToneParam('tone', this.value)">
              <option value="warm">Warm</option>
              <option value="neutral">Neutral</option>
              <option value="sharp">Sharp</option>
              <option value="ethereal">Ethereal</option>
            </select>
          </div>
          <div class="cc-tone-row">
            <label>Presence</label>
            <select class="cc-select" onchange="updateToneParam('presence', this.value)">
              <option value="gentle">Gentle</option>
              <option value="neutral">Neutral</option>
              <option value="commanding">Commanding</option>
              <option value="mystical">Mystical</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Save & Bind Voice -->
      <section class="cc-section">
        <button class="btn btn-primary cc-save-btn" onclick="saveVoiceBinding()">
          ✓ Bind Voice to ${sk.name}
        </button>
        <p class="cc-help-text">This will permanently attach the selected voice to ${sk.name} across the entire app.</p>
      </section>

      ${state.error ? `<div class="cc-error">${state.error}</div>` : ''}
    </div>
  `;
}

// ─── Event Handlers ───────────────────────────────────────────────────────

window.selectSpiritkin = function(index) {
  state.selectedSpiritkin = state.spiritkins[index];
  state.selectedVoice = state.voiceProfiles[state.selectedSpiritkin.name] || state.selectedSpiritkin.ui.voice || "nova";
  state.error = null;
  render();
};

window.selectVoice = function(voiceId) {
  state.selectedVoice = voiceId;
  render();
};

window.testVoice = async function() {
  if (!state.selectedSpiritkin || state.isTestingVoice) return;

  const testText = document.getElementById("cc-test-text")?.value || state.selectedSpiritkin.ui?.bondLine;
  if (!testText) {
    state.error = "Please enter text to test";
    render();
    return;
  }

  state.isTestingVoice = true;
  render();

  try {
    const res = await fetch(`${API}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: testText, voice: state.selectedVoice })
    });

    if (!res.ok) throw new Error(`Speech API failed: ${res.status}`);

    const audioBuffer = await res.arrayBuffer();
    await playAudio(audioBuffer);
  } catch (error) {
    state.error = "Voice test failed: " + error.message;
  }

  state.isTestingVoice = false;
  render();
};

window.updateToneParam = function(param, value) {
  if (!state.selectedSpiritkin) return;
  
  // Update display
  if (param === "speed") {
    const display = document.getElementById("cc-speed-val");
    if (display) display.textContent = parseFloat(value).toFixed(1) + "x";
  }
};

window.saveVoiceBinding = async function() {
  if (!state.selectedSpiritkin) return;

  const sk = state.selectedSpiritkin.name;
  state.voiceProfiles[sk] = state.selectedVoice;

  // Save to localStorage
  localStorage.setItem("sk_voice_profiles", JSON.stringify(state.voiceProfiles));

  state.error = null;
  render();

  // Show confirmation
  setTimeout(() => {
    alert(`✓ Voice binding saved!\n\n${sk} will now speak in ${state.selectedVoice} voice.`);
  }, 100);
};

async function playAudio(arrayBuffer) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
  } catch (err) {
    console.error("Audio playback failed:", err);
    throw new Error("Audio playback failed. Please check your speakers.");
  }
}

function attachEventListeners() {
  // Event listeners are attached via onclick attributes in HTML
}

// ─── Initialize on Load ───────────────────────────────────────────────────

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
