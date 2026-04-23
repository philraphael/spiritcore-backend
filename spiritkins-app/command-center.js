const API = window.location.origin;

const AVAILABLE_VOICES = [
  { id: "nova", label: "Nova", description: "Warm, gentle, welcoming" },
  { id: "alloy", label: "Alloy", description: "Clear, bright, energetic" },
  { id: "shimmer", label: "Shimmer", description: "Ethereal, mystical, flowing" },
  { id: "echo", label: "Echo", description: "Deep, resonant, grounding" },
  { id: "onyx", label: "Onyx", description: "Bold, commanding, powerful" },
  { id: "fable", label: "Fable", description: "Narrative, storytelling, wise" },
];

const SK_META = {
  Lyra: { symbol: "Heart", realm: "The Luminous Veil", voice: "nova", bondLine: "Lyra holds the emotional center - soft, steady, and always present." },
  Raien: { symbol: "Storm", realm: "The Ember Citadel", voice: "alloy", bondLine: "Raien cuts through the noise - direct, honest, and unflinching." },
  Kairo: { symbol: "Star", realm: "The Astral Observatory", voice: "shimmer", bondLine: "Kairo opens the space between what is and what could be." },
  Elaria: { symbol: "Archive", realm: "The Ember Archive", voice: "fable", bondLine: "Solis names what is true with luminous precision." },
  Thalassar: { symbol: "Tide", realm: "The Abyssal Chorus", voice: "onyx", bondLine: "Neris listens for the deeper current before he speaks." },
};

const state = {
  activeTab: "monitor",
  spiritkins: [],
  selectedSpiritkin: null,
  selectedVoice: "nova",
  voiceProfiles: {},
  recentConversations: [],
  selectedConversationMessages: [],
  selectedConversationId: null,
  systemStats: {},
  globalMetrics: {},
  recentIssueReports: [],
  issueDigest: null,
  repairHandoff: null,
  generatorSummary: null,
  generatorJobs: [],
  isTestingVoice: false,
  loading: false,
  error: null,
  refreshInterval: null,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeSpiritkinUi(spiritkin) {
  return {
    ...spiritkin,
    ui: SK_META[spiritkin.name] || {
      symbol: "Sigil",
      realm: "The Spiritverse",
      voice: "nova",
      bondLine: `I am ${spiritkin.name}, your bonded companion.`,
    },
  };
}

async function init() {
  try {
    state.loading = true;
    render();

    const spiritRes = await fetch(`${API}/v1/spiritkins`);
    const spiritData = await spiritRes.json();
    state.spiritkins = (spiritData.spiritkins || []).map(normalizeSpiritkinUi);
    state.selectedSpiritkin = state.spiritkins[0] || null;

    const savedProfiles = localStorage.getItem("sk_voice_profiles");
    state.voiceProfiles = savedProfiles ? JSON.parse(savedProfiles) : {};
    if (state.selectedSpiritkin) {
      state.selectedVoice = state.voiceProfiles[state.selectedSpiritkin.name] || state.selectedSpiritkin.ui.voice || "nova";
    }

    await refreshData();
    state.refreshInterval = window.setInterval(refreshData, 10000);
    state.loading = false;
    render();
  } catch (error) {
    console.error("Command Center init failed", error);
    state.error = `Failed to initialize: ${error.message}`;
    state.loading = false;
    render();
  }
}

async function refreshData() {
  try {
    const [statsRes, metricsRes, convRes, recentRes, digestRes, handoffRes, generatorSummaryRes, generatorJobsRes] = await Promise.all([
      fetch(`${API}/v1/admin/stats`),
      fetch(`${API}/v1/analytics/summary`),
      fetch(`${API}/v1/admin/conversations/recent`),
      fetch(`${API}/v1/admin/issues/recent`),
      fetch(`${API}/v1/admin/issues/digest`),
      fetch(`${API}/v1/admin/issues/repair-handoff`),
      fetch(`${API}/v1/admin/generator/summary`),
      fetch(`${API}/v1/admin/generator/jobs`),
    ]);

    const statsData = await statsRes.json();
    const metricsData = await metricsRes.json();
    const convData = await convRes.json();
    const recentData = await recentRes.json();
    const digestData = await digestRes.json();
    const handoffData = await handoffRes.json();
    const generatorSummaryData = await generatorSummaryRes.json();
    const generatorJobsData = await generatorJobsRes.json();

    state.systemStats = statsData.stats || {};
    state.globalMetrics = metricsData.summary || {};
    state.recentConversations = convData.conversations || [];
    state.recentIssueReports = recentData.reports || [];
    state.issueDigest = digestData.digest || null;
    state.repairHandoff = handoffData.handoff || null;
    state.generatorSummary = generatorSummaryData.summary || null;
    state.generatorJobs = generatorJobsData.jobs || [];

    render();
  } catch (error) {
    console.warn("Command Center refresh failed", error);
  }
}

function render() {
  const root = document.getElementById("root");
  if (!root) return;

  if (state.loading) {
    root.innerHTML = `<div class="cc-loading">Initializing SpiritCore Command Center...</div>`;
    return;
  }

  if (state.error) {
    root.innerHTML = `<div class="cc-loading">${escapeHtml(state.error)}</div>`;
    return;
  }

  root.innerHTML = `
    <div class="command-center">
      <header class="cc-header">
        <div class="cc-header-content">
          <h1>SpiritCore Command Center</h1>
          <p class="cc-tagline">Governance, repair review, and generator orchestration</p>
        </div>
        <div class="cc-header-actions">
          <button class="btn btn-ghost" onclick="window.location.href='/app'">Back to App</button>
        </div>
      </header>

      <nav class="cc-tabs-nav">
        <button class="cc-tab-btn ${state.activeTab === "repair" ? "active" : ""}" onclick="switchTab('repair')">Repair Review</button>
        <button class="cc-tab-btn ${state.activeTab === "monitor" ? "active" : ""}" onclick="switchTab('monitor')">Monitor</button>
        <button class="cc-tab-btn ${state.activeTab === "voice" ? "active" : ""}" onclick="switchTab('voice')">Voice Lab</button>
        <button class="cc-tab-btn ${state.activeTab === "generator" ? "active" : ""}" onclick="switchTab('generator')">Generator</button>
        <button class="cc-tab-btn ${state.activeTab === "world" ? "active" : ""}" onclick="switchTab('world')">World State</button>
        <button class="cc-tab-btn ${state.activeTab === "system" ? "active" : ""}" onclick="switchTab('system')">System</button>
      </nav>

      <div class="cc-layout">
        <aside class="cc-sidebar">
          <div class="cc-section-title">Spiritkins</div>
          <div class="cc-spiritkin-list">
            ${state.spiritkins.map((spiritkin, index) => `
              <button class="cc-spiritkin-item ${state.selectedSpiritkin?.name === spiritkin.name ? "active" : ""}" onclick="selectSpiritkin(${index})">
                <span class="cc-sk-icon">${escapeHtml(spiritkin.ui.symbol)}</span>
                <div class="cc-sk-info">
                  <span class="cc-sk-name">${escapeHtml(spiritkin.name)}</span>
                  <span class="cc-sk-status">${escapeHtml(state.voiceProfiles[spiritkin.name] || spiritkin.ui.voice || "nova")}</span>
                </div>
              </button>
            `).join("")}
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
    case "generator": return renderGeneratorTab();
    case "world": return renderWorldTab();
    case "repair": return renderRepairTab();
    case "system": return renderSystemTab();
    default: return renderMonitorTab();
  }
}

function renderMonitorTab() {
  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <section class="cc-card" style="grid-column: span 2;">
          <h3>Live Interaction Feed</h3>
          <div class="cc-feed">
            ${state.recentConversations.length ? state.recentConversations.map((conv) => `
              <div class="cc-feed-item" onclick="viewTranscript('${conv.id}')">
                <div class="cc-feed-header">
                  <span>Session ${escapeHtml(conv.id.slice(0, 8))}</span>
                  <span>${escapeHtml(new Date(conv.created_at).toLocaleTimeString())}</span>
                </div>
                <div class="cc-feed-content">
                  <strong>${escapeHtml(conv.spiritkin_name || "Unknown")}</strong> bonded with user <em>${escapeHtml((conv.user_id || "").slice(0, 8))}</em>
                </div>
                <div class="cc-feed-meta">
                  <span>${escapeHtml(conv.title || "Ongoing connection")}</span>
                  <span>Open transcript</span>
                </div>
              </div>
            `).join("") : '<p class="cc-empty">No active interactions detected.</p>'}
          </div>
        </section>

        <section class="cc-card">
          <h3>Global Metrics</h3>
          <div class="cc-stat-grid">
            <div class="cc-stat-box"><span class="cc-stat-val">${state.globalMetrics.total_interactions || 0}</span><span class="cc-stat-label">Interactions</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${state.globalMetrics.total_sessions || 0}</span><span class="cc-stat-label">Sessions</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${state.globalMetrics.interactions_last_24h || 0}</span><span class="cc-stat-label">Last 24h</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${state.globalMetrics.total_feedback || 0}</span><span class="cc-stat-label">Feedback</span></div>
          </div>
        </section>

        ${state.selectedConversationMessages.length ? `
          <section class="cc-card" style="grid-column: span 2;">
            <h3>Transcript ${escapeHtml((state.selectedConversationId || "").slice(0, 8))}</h3>
            <div class="cc-transcript">
              ${state.selectedConversationMessages.map((message) => `
                <div class="cc-msg ${escapeHtml(message.role || "assistant")}">
                  <strong>${escapeHtml(String(message.role || "assistant").toUpperCase())}:</strong> ${escapeHtml(message.content || "")}
                </div>
              `).join("")}
              <button class="btn btn-ghost" style="margin-top:1rem" onclick="closeTranscript()">Close Transcript</button>
            </div>
          </section>
        ` : ""}
      </div>
    </div>
  `;
}

function renderVoiceTab() {
  if (!state.selectedSpiritkin) {
    return '<div class="cc-empty">Select a Spiritkin to access Voice Lab.</div>';
  }

  const spiritkin = state.selectedSpiritkin;
  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <section class="cc-card" style="grid-column: span 2;">
          <h3>Voice Lab: ${escapeHtml(spiritkin.name)}</h3>
          <div class="cc-voice-grid">
            ${AVAILABLE_VOICES.map((voice) => `
              <div class="cc-voice-card ${state.selectedVoice === voice.id ? "selected" : ""}" onclick="selectVoice('${voice.id}')">
                <div class="cc-voice-name">${escapeHtml(voice.label)}</div>
                <div class="cc-voice-desc">${escapeHtml(voice.description)}</div>
              </div>
            `).join("")}
          </div>
          <div class="cc-test-area">
            <textarea id="cc-test-text">${escapeHtml(spiritkin.ui?.bondLine || `I am ${spiritkin.name}, your bonded companion.`)}</textarea>
            <div style="display:flex; gap: 1rem;">
              <button class="btn btn-primary" onclick="testVoice()" ${state.isTestingVoice ? "disabled" : ""}>
                ${state.isTestingVoice ? "Playing..." : "Hear Sample"}
              </button>
              <button class="btn btn-ghost" onclick="saveVoiceBinding()">Bind Voice to ${escapeHtml(spiritkin.name)}</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderGeneratorTab() {
  const spiritkin = state.selectedSpiritkin;
  const summary = state.generatorSummary;
  const reviewQueue = summary?.reviewQueue || [];
  const assignments = summary?.assignments || {};
  const selectedAssignment = spiritkin ? assignments[spiritkin.name] : null;
  const selectedJobs = spiritkin ? state.generatorJobs.filter((job) => job.spiritkinKey === spiritkin.name) : state.generatorJobs;
  const providerStatus = summary?.providers || {};
  const imageProviderLabel = providerStatus?.image?.primary
    ? `${providerStatus.image.primary}${providerStatus?.image?.fallback ? ` + ${providerStatus.image.fallback}` : ""}`
    : "not configured";
  const videoProviderLabel = providerStatus?.video?.primary || "not configured";

  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <section class="cc-card" style="grid-column: span 2;">
          <div class="cc-section-head">
            <div>
              <h3>Spiritkins Generator Foundation V1</h3>
              <p class="cc-section-sub">Image and video generation orchestration is live: specs, prompt packages, provider execution, stored outputs, review controls, canonical attachments, and version history.</p>
            </div>
            <div class="cc-governance-pill">Image: ${escapeHtml(imageProviderLabel)} | Video: ${escapeHtml(videoProviderLabel)}</div>
          </div>
          <div class="cc-stat-grid">
            <div class="cc-stat-box"><span class="cc-stat-val">${summary?.totals?.imageJobs || 0}</span><span class="cc-stat-label">Image Jobs</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${summary?.totals?.videoJobs || 0}</span><span class="cc-stat-label">Video Jobs</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${summary?.totals?.reviewQueue || 0}</span><span class="cc-stat-label">Review Queue</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${summary?.totals?.attachedOutputs || 0}</span><span class="cc-stat-label">Attached Outputs</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${summary?.totals?.failedOutputs || 0}</span><span class="cc-stat-label">Failed Outputs</span></div>
          </div>
        </section>

        <section class="cc-card">
          <h3>Image Generator</h3>
          <form class="cc-generator-form" onsubmit="submitImageGenerator(event)">
            <label>Spiritkin name<input name="spiritkinName" value="${escapeHtml(spiritkin?.name || "")}" required /></label>
            <label>Archetype / class<input name="archetypeClass" value="${escapeHtml(spiritkin?.title || "")}" /></label>
            <label>Colors<input name="colors" placeholder="gold, black, rose" /></label>
            <label>Element / theme<input name="elementTheme" value="${escapeHtml(spiritkin?.ui?.realm || "")}" /></label>
            <label>Mood / personality<input name="moodPersonality" value="${escapeHtml(spiritkin?.tone || "")}" /></label>
            <label>Pose<input name="pose" value="centered portrait reveal" /></label>
            <label>Environment<input name="environment" value="${escapeHtml(spiritkin?.ui?.realm || "Spiritverse chamber")}" /></label>
            <label>Render style<input name="renderStyle" value="premium spiritverse portrait illustration" /></label>
            <label>Rarity / tier<input name="rarityTier" value="premium" /></label>
            <label>Style profile<input name="styleProfile" value="spiritverse_premium" /></label>
            <label>Seed<input type="number" name="seed" value="" placeholder="auto" /></label>
            <label>Slot
              <select name="slotName">
                <option value="portrait">portrait</option>
                <option value="ambientStill">ambientStill</option>
                <option value="bondCard">bondCard</option>
              </select>
            </label>
            <label>Audience
              <select name="targetAudience">
                <option value="internal">internal</option>
                <option value="premium">premium</option>
              </select>
            </label>
            <label><input type="checkbox" name="executeNow" checked /> Execute immediately if provider is configured</label>
            <button class="btn btn-primary" type="submit">Create image job</button>
          </form>
        </section>

        <section class="cc-card">
          <h3>Video Generator</h3>
          <form class="cc-generator-form" onsubmit="submitVideoGenerator(event)">
            <label>Spiritkin name<input name="spiritkinName" value="${escapeHtml(spiritkin?.name || "")}" required /></label>
            <label>Trailer type
              <select name="trailerType">
                <option value="intro_trailer">intro trailer</option>
                <option value="reveal_video">reveal video</option>
                <option value="bond_scene">bond scene</option>
                <option value="ambient_loop">ambient loop</option>
              </select>
            </label>
            <label>Duration (sec)<input type="number" name="durationSec" value="18" min="6" max="90" /></label>
            <label>Shot style<input name="shotStyle" value="cinematic reveal" /></label>
            <label>Script / voice line<textarea name="scriptVoiceLine" rows="3">${escapeHtml(spiritkin?.ui?.bondLine || "")}</textarea></label>
            <label>Music mood<input name="musicMood" value="mythic restrained wonder" /></label>
            <label>Attached assets<textarea name="attachedAssets" rows="2" placeholder="/app/assets/..., /generated-spiritkins/..."></textarea></label>
            <label>Seed<input type="number" name="seed" value="" placeholder="auto" /></label>
            <label>Slot
              <select name="slotName">
                <option value="introTrailer">introTrailer</option>
                <option value="bondTrailer">bondTrailer</option>
                <option value="ambientLoop">ambientLoop</option>
              </select>
            </label>
            <label>Audience
              <select name="targetAudience">
                <option value="internal">internal</option>
                <option value="premium">premium</option>
              </select>
            </label>
            <label><input type="checkbox" name="executeNow" checked /> Execute immediately if provider is configured</label>
            <button class="btn btn-primary" type="submit">Create video job</button>
          </form>
        </section>

        <section class="cc-card" style="grid-column: span 2;">
          <h3>Review Queue</h3>
          <div class="cc-generator-list">
            ${reviewQueue.length ? reviewQueue.map((output) => `
              <article class="cc-generator-item">
                <div class="cc-issue-top">
                  <strong>${escapeHtml(output.spiritkinKey)}</strong>
                  <span class="cc-confidence">${escapeHtml(output.mediaKind)} / ${escapeHtml(output.slotName)}</span>
                </div>
                <div class="cc-issue-summary">Output ${escapeHtml(output.id.slice(0, 8))} is waiting for review. Provider state: ${escapeHtml(output.providerStatus)}.${output.artifactPath ? ` Artifact: ${escapeHtml(output.artifactPath)}` : ""}</div>
                <div class="cc-generator-actions">
                  <button class="btn btn-ghost btn-sm" onclick="reviewGeneratorOutput('${output.id}','approve')">Approve</button>
                  <button class="btn btn-ghost btn-sm" onclick="reviewGeneratorOutput('${output.id}','mark_canonical')">Mark canonical</button>
                  <button class="btn btn-ghost btn-sm" onclick="reviewGeneratorOutput('${output.id}','attach')">Attach</button>
                  <button class="btn btn-ghost btn-sm" onclick="reviewGeneratorOutput('${output.id}','reject')">Reject</button>
                </div>
              </article>
            `).join("") : '<p class="cc-empty">No outputs are waiting for review.</p>'}
          </div>
        </section>

        <section class="cc-card">
          <h3>Selected Spiritkin Runtime Media</h3>
          ${spiritkin ? `
            <div class="cc-generator-selected">${escapeHtml(spiritkin.name)}</div>
            ${selectedAssignment?.mediaSlots ? Object.entries(selectedAssignment.mediaSlots).map(([slotName, slot]) => `
              <div class="cc-generator-attachment">
                <strong>${escapeHtml(slotName)}</strong>
                <span>${escapeHtml(slot.mediaKind)} / ${escapeHtml(slot.reviewStatus)}</span>
                <span>${slot.canonical ? "canonical" : "non-canonical"} / ${slot.outputId ? escapeHtml(slot.outputId.slice(0, 8)) : "no output"}</span>
                ${slot.artifactPath ? `<span>${escapeHtml(slot.artifactPath)}</span>` : ""}
              </div>
            `).join("") : '<p class="cc-empty">No runtime media attached yet.</p>'}
          ` : '<p class="cc-empty">Select a Spiritkin to inspect runtime slots.</p>'}
        </section>

        <section class="cc-card">
          <h3>Generation History</h3>
          <div class="cc-generator-list">
            ${selectedJobs.length ? selectedJobs.slice(0, 12).map((job) => `
              <article class="cc-generator-item">
                <div class="cc-issue-top">
                  <strong>${escapeHtml(job.spiritkinName)}</strong>
                  <span class="cc-confidence">${escapeHtml(job.type)} / ${escapeHtml(job.slotName)}</span>
                </div>
                <div class="cc-issue-summary">${escapeHtml(job.promptPackage?.prompt || "Prompt package ready.")}</div>
                <div class="cc-issue-meta">Audience ${escapeHtml(job.targetAudience)} / Gate ${escapeHtml(job.entitlementGate)} / Status ${escapeHtml(job.status)} / Provider ${escapeHtml(job.providerStatus)}${job.spec?.seed !== null && job.spec?.seed !== undefined ? ` / Seed ${escapeHtml(job.spec.seed)}` : ""}</div>
                ${job.lastExecution?.error?.message ? `<div class="cc-issue-summary">Last error: ${escapeHtml(job.lastExecution.error.message)}</div>` : ""}
                <div class="cc-generator-actions">
                  <button class="btn btn-ghost btn-sm" onclick="executeGeneratorJob('${job.id}','${job.type === "image" ? "generateImage" : "generateVideo"}')">Execute</button>
                  <button class="btn btn-ghost btn-sm" onclick="retryGeneratorJob('${job.id}')">Retry</button>
                </div>
              </article>
            `).join("") : '<p class="cc-empty">No generator jobs recorded yet.</p>'}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderWorldTab() {
  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <section class="cc-card">
          <h3>Spiritverse Registry</h3>
          <p>Active realms and governance remain online.</p>
          <div class="cc-stat-grid">
            <div class="cc-stat-box"><span class="cc-stat-val">5</span><span class="cc-stat-label">Founders</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">4</span><span class="cc-stat-label">Runtime media families</span></div>
          </div>
        </section>
        <section class="cc-card" style="grid-column: span 2;">
          <h3>Governing Charter</h3>
          <div class="cc-echoes-preview" style="font-size: 0.9rem; opacity: 0.82; line-height: 1.6;">
            <p><strong>Law of Identity</strong> - no Spiritkin should drift from core essence.</p>
            <p><strong>Law of Witness</strong> - every interaction becomes governed continuity.</p>
            <p><strong>Law of Growth</strong> - evolution must remain reviewable and bounded.</p>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderSystemTab() {
  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <section class="cc-card">
          <h3>System Health</h3>
          <div class="cc-stat-grid">
            <div class="cc-stat-box"><span class="cc-stat-val">ONLINE</span><span class="cc-stat-label">Status</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${state.systemStats.total_messages || 0}</span><span class="cc-stat-label">Total Messages</span></div>
          </div>
        </section>
        <section class="cc-card">
          <h3>Infrastructure</h3>
          <div class="cc-stat-grid">
            <div class="cc-stat-box"><span class="cc-stat-val">SUPABASE</span><span class="cc-stat-label">Database</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">OPENAI</span><span class="cc-stat-label">Adapter</span></div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderRepairTab() {
  const digest = state.issueDigest;
  const handoff = state.repairHandoff;
  if (!digest || !handoff) {
    return `
      <div class="cc-tab-content">
        <section class="cc-card">
          <h3>Repair Review</h3>
          <p class="cc-empty">Issue review data is not available yet.</p>
        </section>
      </div>
    `;
  }

  const recurring = handoff.top_recurring_bugs || [];
  const severe = handoff.highest_severity_issues || [];
  const emerging = handoff.newly_emerging_issues || [];
  const areas = handoff.repeat_complaints_by_system_area || [];
  const packets = handoff.repair_packets || [];
  const reviewSummary = handoff.review_summary || digest.review_summary || {};
  const priorityQueue = handoff.priority_queue || [];

  return `
    <div class="cc-tab-content">
      <div class="cc-dashboard">
        <section class="cc-card" style="grid-column: span 2;">
          <div class="cc-section-head">
            <div>
              <h3>Owner Review Status</h3>
              <p class="cc-section-sub">Review only. No autonomous patching or deployment is enabled.</p>
            </div>
            <div class="cc-governance-pill">Owner Approval Required</div>
          </div>
          <div class="cc-stat-grid">
            <div class="cc-stat-box"><span class="cc-stat-val">${handoff.total_repair_packets || 0}</span><span class="cc-stat-label">Repair Packets</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${(digest.unresolved_issues || []).length}</span><span class="cc-stat-label">Unresolved Issues</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${(digest.grouped_recurring_issues || []).length}</span><span class="cc-stat-label">Recurring Clusters</span></div>
            <div class="cc-stat-box"><span class="cc-stat-val">${Object.keys(digest.top_bug_themes || {}).length}</span><span class="cc-stat-label">Bug Areas</span></div>
          </div>
          <div class="cc-review-summary">
            <div class="cc-review-callout">
              <strong>${escapeHtml(reviewSummary.owner_action || "Review priority packets first, then validate reproduction in production before preparing a manual repair brief.")}</strong>
            </div>
            <div class="cc-review-pills">
              <span class="cc-governance-pill">Urgent ${reviewSummary.urgent_packets ?? reviewSummary.urgent_clusters ?? 0}</span>
              <span class="cc-governance-pill">High ${reviewSummary.high_priority_packets ?? reviewSummary.high_priority_clusters ?? 0}</span>
              <span class="cc-governance-pill">Watch ${reviewSummary.watch_packets ?? reviewSummary.watch_clusters ?? 0}</span>
            </div>
          </div>
        </section>

        <section class="cc-card" style="grid-column: span 2;">
          <h3>Priority Review Queue</h3>
          <div class="cc-issue-list">
            ${priorityQueue.length ? priorityQueue.map((item) => `
              <div class="cc-issue-item">
                <div class="cc-issue-top">
                  <strong>${escapeHtml(item.affected_system || item.probable_area || "general_app")}</strong>
                  <span class="cc-priority cc-priority-${escapeHtml(item.priority_label || "routine")}">${escapeHtml(item.priority_label || "routine")}</span>
                </div>
                <div class="cc-issue-summary">${escapeHtml(item.summary)}</div>
                <div class="cc-issue-meta">${escapeHtml(item.probable_area || "general_app")} / ${item.related_reports || 0} related reports / confidence ${Number(item.confidence || 0).toFixed(2)}</div>
                <div class="cc-issue-meta">${escapeHtml(item.recommended_next_action || "")}</div>
              </div>
            `).join("") : '<p class="cc-empty">No priority queue items are available.</p>'}
          </div>
        </section>

        <section class="cc-card">
          <h3>Top Recurring Bugs</h3>
          <div class="cc-issue-list">
            ${recurring.length ? recurring.map((item) => `
              <div class="cc-issue-item">
                <div class="cc-issue-top"><strong>${escapeHtml(item.affected_system || item.probable_area)}</strong><span class="cc-severity ${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span></div>
                <div class="cc-issue-summary">${escapeHtml(item.summary)}</div>
                <div class="cc-issue-meta">${escapeHtml(item.probable_area || "general_app")} / ${item.related_reports} related reports / confidence ${Number(item.confidence || 0).toFixed(2)}</div>
              </div>
            `).join("") : '<p class="cc-empty">No recurring bugs queued.</p>'}
          </div>
        </section>

        <section class="cc-card">
          <h3>Highest Severity Issues</h3>
          <div class="cc-issue-list">
            ${severe.length ? severe.map((item) => `
              <div class="cc-issue-item">
                <div class="cc-issue-top"><strong>${escapeHtml(item.affected_system || item.feature_context?.affected_system || item.feature_context?.probable_area || "general_app")}</strong><span class="cc-severity ${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span></div>
                <div class="cc-issue-summary">${escapeHtml(item.summary)}</div>
                <div class="cc-issue-meta">${escapeHtml(item.feature_context?.probable_area || "general_app")} / ${item.recent_related_reports?.length || 0} linked reports</div>
              </div>
            `).join("") : '<p class="cc-empty">No high-severity issues detected.</p>'}
          </div>
        </section>

        <section class="cc-card">
          <h3>Newly Emerging Issues</h3>
          <div class="cc-issue-list">
            ${emerging.length ? emerging.map((item) => `
              <div class="cc-issue-item">
                <div class="cc-issue-top"><strong>${escapeHtml(item.affected_system || item.feature_context?.affected_system || item.feature_context?.probable_area || "general_app")}</strong><span class="cc-confidence">confidence ${Number(item.confidence || 0).toFixed(2)}</span></div>
                <div class="cc-issue-summary">${escapeHtml(item.summary)}</div>
              </div>
            `).join("") : '<p class="cc-empty">No emerging issues yet.</p>'}
          </div>
        </section>

        <section class="cc-card">
          <h3>Repeat Complaints by System Area</h3>
          <div class="cc-issue-list">
            ${areas.length ? areas.map((item) => `
              <div class="cc-issue-item">
                <div class="cc-issue-top"><strong>${escapeHtml(item.probable_area)}</strong><span class="cc-confidence">${item.complaints} complaints</span></div>
                <div class="cc-issue-meta">${item.clusters} active cluster${item.clusters === 1 ? "" : "s"} / priority ${escapeHtml(item.highest_priority || "routine")}</div>
              </div>
            `).join("") : '<p class="cc-empty">No system-area repeats yet.</p>'}
          </div>
        </section>

        <section class="cc-card" style="grid-column: span 2;">
          <h3>Recent Reports</h3>
          <div class="cc-issue-list">
            ${state.recentIssueReports.length ? state.recentIssueReports.slice(0, 10).map((report) => `
              <div class="cc-issue-item">
                <div class="cc-issue-top"><strong>${escapeHtml(report.repair_summary?.affected_system || report.context?.current_feature || report.repair_summary?.probable_area || "general_app")}</strong><span class="cc-severity ${escapeHtml(report.severity || "low")}">${escapeHtml(report.severity || "low")}</span></div>
                <div class="cc-issue-summary">${escapeHtml(report.repair_summary?.owner_digest_line || report.summary || "Report received.")}</div>
                <div class="cc-issue-meta">
                  ${escapeHtml(report.repair_summary?.probable_area || report.context?.current_feature || "general_app")} / ${escapeHtml(report.classification || "unknown")} / ${escapeHtml(report.status || "logged")} / ${escapeHtml(new Date(report.created_at).toLocaleString())}
                  ${report.conversation_id ? ` / <button class="btn btn-ghost btn-sm" onclick="viewTranscript('${report.conversation_id}')">Open transcript</button>` : ""}
                </div>
              </div>
            `).join("") : '<p class="cc-empty">No recent reports available.</p>'}
          </div>
        </section>

        <section class="cc-card" style="grid-column: span 2;">
          <h3>Repair Packets</h3>
          <div class="cc-packet-list">
            ${packets.length ? packets.map((packet) => `
              <article class="cc-packet-card">
                <div class="cc-issue-top">
                  <strong>${escapeHtml(packet.affected_system || packet.feature_context?.affected_system || packet.feature_context?.probable_area || "general_app")}</strong>
                  <div class="cc-packet-badges">
                    <span class="cc-priority cc-priority-${escapeHtml(packet.priority_label || "routine")}">${escapeHtml(packet.priority_label || "routine")}</span>
                    <span class="cc-severity ${escapeHtml(packet.severity)}">${escapeHtml(packet.severity)}</span>
                  </div>
                </div>
                <h4>${escapeHtml(packet.summary)}</h4>
                <div class="cc-issue-meta">${escapeHtml(packet.feature_context?.probable_area || "general_app")} / confidence ${Number(packet.confidence || 0).toFixed(2)} / ${escapeHtml(packet.owner_review_summary || "")}</div>
                <div class="cc-packet-grid">
                  <div>
                    <div class="cc-packet-label">Reproduction hints</div>
                    <ul class="cc-packet-listing">${(packet.reproduction_hints || []).map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}</ul>
                  </div>
                  <div>
                    <div class="cc-packet-label">Grouped related issues</div>
                    <ul class="cc-packet-listing">${(packet.grouped_related_issues || []).map((report) => `<li>${escapeHtml(report.summary)}</li>`).join("")}</ul>
                  </div>
                  <div>
                    <div class="cc-packet-label">Production diagnostics</div>
                    <ul class="cc-packet-listing">${(packet.diagnostics || []).map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}</ul>
                  </div>
                  <div>
                    <div class="cc-packet-label">User recovery guidance</div>
                    <ul class="cc-packet-listing">${(packet.user_recovery_guidance || []).map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}</ul>
                  </div>
                </div>
                <div class="cc-issue-meta">${escapeHtml(packet.recommended_next_action || "")}</div>
              </article>
            `).join("") : '<p class="cc-empty">No repair packets available.</p>'}
          </div>
        </section>
      </div>
    </div>
  `;
}

window.switchTab = function switchTab(tabId) {
  state.activeTab = tabId;
  render();
};

window.selectSpiritkin = function selectSpiritkin(index) {
  state.selectedSpiritkin = state.spiritkins[index] || null;
  if (state.selectedSpiritkin) {
    state.selectedVoice = state.voiceProfiles[state.selectedSpiritkin.name] || state.selectedSpiritkin.ui.voice || "nova";
  }
  render();
};

window.selectVoice = function selectVoice(voiceId) {
  state.selectedVoice = voiceId;
  render();
};

window.viewTranscript = async function viewTranscript(conversationId) {
  try {
    const res = await fetch(`${API}/v1/admin/messages/${conversationId}`);
    const data = await res.json();
    state.selectedConversationMessages = data.messages || [];
    state.selectedConversationId = conversationId;
    state.activeTab = "monitor";
    render();
  } catch (error) {
    alert(`Failed to load transcript: ${error.message}`);
  }
};

window.closeTranscript = function closeTranscript() {
  state.selectedConversationMessages = [];
  state.selectedConversationId = null;
  render();
};

window.testVoice = async function testVoice() {
  if (!state.selectedSpiritkin || state.isTestingVoice) return;
  const text = document.getElementById("cc-test-text")?.value || state.selectedSpiritkin.ui.bondLine;
  state.isTestingVoice = true;
  render();
  try {
    const res = await fetch(`${API}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: state.selectedVoice }),
    });
    const audioBuffer = await res.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = await audioContext.decodeAudioData(audioBuffer);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
  } catch (error) {
    alert(`Voice test failed: ${error.message}`);
  }
  state.isTestingVoice = false;
  render();
};

window.saveVoiceBinding = function saveVoiceBinding() {
  if (!state.selectedSpiritkin) return;
  state.voiceProfiles[state.selectedSpiritkin.name] = state.selectedVoice;
  localStorage.setItem("sk_voice_profiles", JSON.stringify(state.voiceProfiles));
  alert(`Voice ${state.selectedVoice} bound to ${state.selectedSpiritkin.name}`);
  render();
};

window.submitImageGenerator = async function submitImageGenerator(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    spiritkinName: form.spiritkinName.value.trim(),
    archetypeClass: form.archetypeClass.value.trim(),
    colors: form.colors.value.split(",").map((item) => item.trim()).filter(Boolean),
    elementTheme: form.elementTheme.value.trim(),
    moodPersonality: form.moodPersonality.value.trim(),
    pose: form.pose.value.trim(),
    environment: form.environment.value.trim(),
    renderStyle: form.renderStyle.value.trim(),
    rarityTier: form.rarityTier.value.trim(),
    styleProfile: form.styleProfile.value.trim(),
    seed: form.seed.value ? Number(form.seed.value) : undefined,
    slotName: form.slotName.value,
    targetAudience: form.targetAudience.value,
    entitlementGate: form.targetAudience.value === "premium" ? "premium_ready" : "admin_only",
    execute: !!form.executeNow.checked,
  };
  try {
    const res = await fetch(`${API}/v1/admin/generator/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.message || "Image job creation failed.");
    await refreshData();
    if (data.execution?.ok === false) {
      alert(`Image job saved for ${payload.spiritkinName}, but execution failed: ${data.execution.error?.message || "Provider unavailable."}`);
    } else if (data.execution?.ok === true) {
      alert(`Image job created and executed for ${payload.spiritkinName}. Output ${data.output.id.slice(0, 8)} is ready for review.`);
    } else {
      alert(`Image job created for ${payload.spiritkinName}. Output slot ${data.output.id.slice(0, 8)} is awaiting provider execution.`);
    }
  } catch (error) {
    alert(error.message);
  }
};

window.submitVideoGenerator = async function submitVideoGenerator(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    spiritkinName: form.spiritkinName.value.trim(),
    trailerType: form.trailerType.value,
    durationSec: Number(form.durationSec.value || 18),
    shotStyle: form.shotStyle.value.trim(),
    scriptVoiceLine: form.scriptVoiceLine.value.trim(),
    musicMood: form.musicMood.value.trim(),
    attachedAssets: form.attachedAssets.value.split(",").map((item) => item.trim()).filter(Boolean),
    seed: form.seed.value ? Number(form.seed.value) : undefined,
    slotName: form.slotName.value,
    targetAudience: form.targetAudience.value,
    entitlementGate: form.targetAudience.value === "premium" ? "premium_ready" : "admin_only",
    execute: !!form.executeNow.checked,
  };
  try {
    const res = await fetch(`${API}/v1/admin/generator/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.message || "Video job creation failed.");
    await refreshData();
    if (data.execution?.ok === false) {
      alert(`Video job saved for ${payload.spiritkinName}, but execution failed: ${data.execution.error?.message || "Provider unavailable."}`);
    } else if (data.execution?.ok === true) {
      alert(`Video job created and executed for ${payload.spiritkinName}. Output ${data.output.id.slice(0, 8)} is ready for review.`);
    } else {
      alert(`Video job created for ${payload.spiritkinName}. Output slot ${data.output.id.slice(0, 8)} is awaiting provider execution.`);
    }
  } catch (error) {
    alert(error.message);
  }
};

window.executeGeneratorJob = async function executeGeneratorJob(jobId, operation) {
  try {
    const res = await fetch(`${API}/v1/admin/generator/jobs/${jobId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.message || "Generator execution failed.");
    await refreshData();
    if (data.error?.message) {
      alert(`Execution failed: ${data.error.message}`);
      return;
    }
    alert(`Execution complete for job ${jobId.slice(0, 8)}.`);
  } catch (error) {
    alert(error.message);
  }
};

window.retryGeneratorJob = async function retryGeneratorJob(jobId) {
  try {
    const res = await fetch(`${API}/v1/admin/generator/jobs/${jobId}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.message || "Generator retry failed.");
    await refreshData();
    if (data.error?.message) {
      alert(`Retry failed: ${data.error.message}`);
      return;
    }
    alert(`Retry complete for job ${jobId.slice(0, 8)}.`);
  } catch (error) {
    alert(error.message);
  }
};

window.reviewGeneratorOutput = async function reviewGeneratorOutput(outputId, decision) {
  const note = window.prompt(`Optional review note for ${decision}:`, "") || "";
  try {
    const res = await fetch(`${API}/v1/admin/generator/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outputId,
        decision,
        note,
        markCanonical: decision === "mark_canonical",
        attachToRuntime: decision === "attach" || decision === "mark_canonical",
      }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.message || "Review update failed.");
    await refreshData();
  } catch (error) {
    alert(error.message);
  }
};

window.addEventListener("DOMContentLoaded", init);
