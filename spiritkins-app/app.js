import {
  ADAPTIVE_PROFILE_KEY,
  API,
  BOND_LEVELS,
  CONSENT_KEY,
  CROWN_GATE_HOLD_MS,
  DEFAULT_PROMPTS,
  ENTRY_KEY,
  ENTRY_TRANSITION_MS,
  FOUNDING_PILLARS,
  GAME_HELP_SEEN_KEY,
  GAME_NAME_OVERRIDES,
  INTERACTION_BUILD_MARKER,
  MEDIA_MUTED_KEY,
  NAME_KEY,
  ONBOARDING_COMPLETE_KEY,
  PRIMARY_KEY,
  RATINGS_KEY,
  RESONANCE_KEY,
  RETENTION_BUILD_MARKER,
  RETENTION_STATE_KEY,
  RETENTION_TELEMETRY_KEY,
  SESSION_KEY,
  SPIRITKIN_CREATOR_DRAFT_KEY,
  SPIRITKIN_CREATOR_LIBRARY_KEY,
  SPIRITCORE_WELCOME_TEXT,
  SPIRITCORE_WELCOME_VOICE,
  SPIRITGATE_POST_COPY_SETTLE_MS,
  SPIRITGATE_POST_VIDEO_PAUSE_MS,
  SPIRITGATE_TRAILER_COMPLETION_FAILSAFE_MS,
  SPIRITGATE_TRAILER_FAILSAFE_MS,
  SPIRITGATE_VIDEO_COMPLETION_FAILSAFE_MS,
  SPIRITGATE_VIDEO_FAILSAFE_MS,
  SPIRITKIN_EVOLUTION_KEY,
  UID_KEY,
  VALID_PRESENCE_TABS,
  WORLD_ART
} from "./app-constants.js";
import {
  clamp01,
  clampInt,
  esc,
  fmtDate,
  fmtTime,
  formatSignal,
  formatTimeAway,
  getLocalTemporalWorldState,
  getUtcDayKey,
  getUtcWeekKey,
  hashSeed,
  hoursBetween,
  normalizePhraseList,
  normalizeReactionText,
  normalizeTimestamp,
  normalizeTextSnippet,
  nowIso,
  sanitizeScene,
  sanitizeTone,
  seededUnit,
  toneHasTag,
  uuid
} from "./app-helpers.js";
import { spiritkins as CANON_SPIRITKINS, realms as CANON_REALMS, charter as CANON_CHARTER, echoes as CANON_ECHOES, governance as CANON_GOVERNANCE, world as CANON_WORLD, bondStages as CANON_BOND_STAGES } from "./data/spiritverseCanon.js";
import { resolveGameAssetUrl } from "./data/gameAssetManifest.js";
import { getGameTheme } from "./data/gameThemes.js";
import { createPendingCreatorMediaSlots, getSpiritkinMediaConfig, SPIRITKIN_CREATOR_FOUNDATION } from "./data/spiritkinRuntimeConfig.js";

function createSpiritverseGamesFallback() {
  return {
    available: false,
    echoAnswer: "",
    reset() {},
    render(targetId) {
      const target = typeof document !== "undefined" ? document.getElementById(targetId) : null;
      if (target) {
        target.innerHTML = `
          <div class="panel-card" style="padding:20px;text-align:left;">
            <div class="panel-label">Games Unavailable</div>
            <p style="margin:8px 0 0;">The games module failed to load. Core Spiritverse features remain available while games recover.</p>
          </div>
        `;
      }
    },
    expand(...args) {
      const targetId = typeof args[0] === "string" ? args[0] : null;
      if (targetId) this.render(targetId);
    },
    handleChessSquareClick() {},
    handleCheckersSquareClick() {}
  };
}

let SpiritverseGames = createSpiritverseGamesFallback();
try {
  const spiritverseGamesModule = await import("./spiritverse-games.js");
  if (spiritverseGamesModule?.SpiritverseGames) {
    SpiritverseGames = spiritverseGamesModule.SpiritverseGames;
    SpiritverseGames.available = true;
  } else {
    console.error("[Spiritverse Games Boot] Module loaded without SpiritverseGames export.");
  }
} catch (error) {
  console.error("[Spiritverse Games Boot] Failed to load games module. Continuing without games.", error);
  window.__svGamesModuleError = error;
}

// RevealAnimation will be loaded as a separate module
let revealAnimationInstance = null;
let spiritGateFallbackTimer = null;
let spiritGateArrivalFallbackTimer = null;
let spiritGatePlaybackSafetyTimer = null;
let spiritGateArrivalPlaybackSafetyTimer = null;
let spiritGateActiveAttemptId = 0;
let spiritGateTransitionRevealTimer = null;
let spiritGateTransitionRouteTimer = null;
const selectionTrailerFailures = new Set();
const VOICE_GUIDANCE_KEY = "sk_voice_guidance_dismissed";

const CANON_SPIRITKIN_MAP = Object.fromEntries(CANON_SPIRITKINS.map((spiritkin) => [spiritkin.name, spiritkin]));
const SPIRITVERSE_ECHOES = {
  origin: CANON_WORLD.origin,
  nature: CANON_WORLD.structure,
  governance: CANON_GOVERNANCE,
  charter: {
    preamble: CANON_CHARTER.preamble,
    laws: CANON_CHARTER.laws.map((law) => law.text)
  },
  realms: Object.fromEntries(
    CANON_SPIRITKINS.map((spiritkin) => [
      spiritkin.name,
      CANON_REALMS[spiritkin.realmId]
    ])
  ),
  bond_stages: CANON_BOND_STAGES,
  great_convergence: CANON_WORLD.convergence
};
const SPIRITKIN_ECHOES = Object.fromEntries(
  CANON_SPIRITKINS.map((spiritkin) => [
    spiritkin.name,
    {
      domains: spiritkin.domains,
      origin: spiritkin.originSummary,
      nature: spiritkin.nature,
      gifts: spiritkin.gifts,
      shadows: spiritkin.shadow,
      echo_fragments: CANON_ECHOES[spiritkin.name] || []
    }
  ])
);

function canonicalWorldAssetUrl(filename) {
  if (!filename) return "";
  const category = filename === WORLD_ART.background || filename === WORLD_ART.baseTheme ? "rooms" : "concepts";
  return `/app/assets/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`;
}

function activeAssetUrl(category, filename) {
  if (!category || !filename) return "";
  return `/app/assets/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`;
}

const COMPOSITE_VISUAL_ASSETS = {
  spiritcore: {
    gate: activeAssetUrl("ui", "welcome_close.png"),
    arrival: activeAssetUrl("ui", "welcome_open.png"),
    hero: activeAssetUrl("ui", "spiritcore-media-hero.png"),
    founders: activeAssetUrl("ui", "spiritcore-spiritkins-portraits.png")
  },
  spiritkins: {
    Lyra: {
      focus: activeAssetUrl("ui", "lyra_open.png"),
      profile: activeAssetUrl("ui", "lyra_open.png"),
      card: activeAssetUrl("ui", "lyra_close.png")
    },
    Raien: {
      focus: activeAssetUrl("ui", "raien_open.png"),
      profile: activeAssetUrl("ui", "raien_open.png"),
      card: activeAssetUrl("ui", "raien_close.png")
    },
    Kairo: {
      focus: activeAssetUrl("ui", "kairo_open.png"),
      profile: activeAssetUrl("ui", "kairo_open.png"),
      card: activeAssetUrl("ui", "kairo_close.png")
    },
    Elaria: {
      focus: activeAssetUrl("concepts", "Elaria.png"),
      profile: activeAssetUrl("concepts", "Elaria.png"),
      card: activeAssetUrl("concepts", "Elaria Left Thalassar right.png")
    },
    Thalassar: {
      focus: activeAssetUrl("concepts", "thalassar.png"),
      profile: activeAssetUrl("concepts", "thalassar.png"),
      card: activeAssetUrl("concepts", "Elaria Left Thalassar right.png")
    }
  }
};

const AUTHORITATIVE_FOUNDER_MEDIA = {
  Elaria: {
    founderCard: activeAssetUrl("concepts", "Elaria.png"),
    focus: activeAssetUrl("concepts", "Elaria.png"),
    profile: activeAssetUrl("concepts", "Elaria.png"),
    bonded: activeAssetUrl("concepts", "Elaria.png"),
    fallbackCard: activeAssetUrl("concepts", "Elaria Left Thalassar right.png"),
    portrait: activeAssetUrl("concepts", "Elaria.png"),
    canonSupplement: activeAssetUrl("concepts", "Elaria Left Thalassar right.png")
  },
  Thalassar: {
    founderCard: activeAssetUrl("concepts", "thalassar.png"),
    focus: activeAssetUrl("concepts", "thalassar.png"),
    profile: activeAssetUrl("concepts", "thalassar.png"),
    bonded: activeAssetUrl("concepts", "thalassar.png"),
    fallbackCard: activeAssetUrl("concepts", "Elaria Left Thalassar right.png"),
    portrait: activeAssetUrl("concepts", "thalassar.png"),
    canonSupplement: activeAssetUrl("concepts", "Elaria Left Thalassar right.png")
  }
};

function getSpiritkinMediaAuthority(name) {
  const composite = COMPOSITE_VISUAL_ASSETS.spiritkins[String(name || "").trim()] || {};
  const override = AUTHORITATIVE_FOUNDER_MEDIA[String(name || "").trim()] || {};
  return {
    founderCard: override.founderCard || composite.card || "",
    focus: override.focus || composite.focus || composite.profile || "",
    profile: override.profile || composite.profile || composite.focus || "",
    bonded: override.bonded || composite.profile || composite.focus || "",
    fallbackCard: override.fallbackCard || composite.card || composite.focus || "",
    portrait: override.portrait || "",
    canonSupplement: override.canonSupplement || composite.card || ""
  };
}

function worldArtImage(filename, alt, cls = "", eager = false) {
  const src = canonicalWorldAssetUrl(filename);
  if (!src) return "";
  return `
    <div class="world-art-frame ${esc(cls)}">
      <img
        src="${src}"
        alt="${esc(alt)}"
        class="world-art-image"
        ${eager ? 'loading="eager"' : 'loading="lazy"'}
        onerror="this.style.display='none'; this.parentElement.classList.add('world-art-missing');"
      />
    </div>
  `;
}

// Browser-local speech runtime handles.
// These are intentionally not canonical session state; session snapshots only mirror their coarse lifecycle.
let _AUDIO_CONTEXT = null;
let _currentAudio = null;
let _voiceLoopTimer = null;
let _audioPlaying = false;
let _recognition = null;
let _recognitionRunId = 0;
let _recognitionStopRequested = false;
let _lastVoiceSubmission = { text: "", at: 0 };
let _lastUserSubmission = { text: "", at: 0, source: "" };
let _voiceAwaitingUserTurn = false;
let _voiceTurnCaptureAfterAudio = false;
let _scheduledAutoSpeechMessageId = null;
let _lastAutoSpokenMessageId = null;
let _nextSpeechRequestId = 0;
let _activeSpeechRequestId = 0;
let _activeAudioRequestId = 0;
let _pressedInteractiveEl = null;
let _lastSpeechFingerprint = { key: "", at: 0 };

function claimSpeechRequest() {
  _activeSpeechRequestId = ++_nextSpeechRequestId;
  return _activeSpeechRequestId;
}

function invalidateSpeechRequests() {
  _activeSpeechRequestId = ++_nextSpeechRequestId;
  _activeAudioRequestId = 0;
}

function isSpeechRequestActive(requestId) {
  return !!requestId && requestId === _activeSpeechRequestId;
}

function buildSpeechFingerprint(text, voice = "nova", dedupeKey = "") {
  if (dedupeKey) return String(dedupeKey);
  return `${String(voice || "nova").trim().toLowerCase()}::${normalizeTextSnippet(String(text || "")).toLowerCase().slice(0, 220)}`;
}

function isDuplicateSpeechFingerprint(key, windowMs = 2400) {
  if (!key) return false;
  return _lastSpeechFingerprint.key === key && (Date.now() - _lastSpeechFingerprint.at) < windowMs;
}

function rememberSpeechFingerprint(key) {
  if (!key) return;
  _lastSpeechFingerprint = { key, at: Date.now() };
}

function clearPressedInteractive() {
  if (_pressedInteractiveEl && _pressedInteractiveEl.classList) {
    _pressedInteractiveEl.classList.remove("is-pressed");
  }
  _pressedInteractiveEl = null;
}

function markPressedInteractive(target) {
  const element = target?.closest?.("[data-action]");
  if (!element) return;
  clearPressedInteractive();
  element.classList.add("is-pressed");
  _pressedInteractiveEl = element;
}

function getLocalSpeechRuntimeState() {
  return {
    audioPlaying: !!_audioPlaying,
    hasRecognition: !!_recognition,
    awaitingUserTurn: !!_voiceAwaitingUserTurn,
    captureAfterAudio: !!_voiceTurnCaptureAfterAudio,
  };
}

function setVoiceTurnRuntimeState({ awaitingUserTurn = _voiceAwaitingUserTurn, captureAfterAudio = _voiceTurnCaptureAfterAudio } = {}) {
  _voiceAwaitingUserTurn = !!awaitingUserTurn;
  _voiceTurnCaptureAfterAudio = !!captureAfterAudio;
  return getLocalSpeechRuntimeState();
}

function getMediaToggleState(muted) {
  return muted
    ? { icon: "\ud83d\udd0a", text: "Enable Sound", title: "Enable trailer audio" }
    : { icon: "\ud83d\udd07", text: "Mute Sound", title: "Mute trailer audio" };
}

function buildMediaToggleInner(muted) {
  const media = getMediaToggleState(muted);
  return `<span class="unmute-icon">${media.icon}</span><span class="unmute-text">${media.text}</span>`;
}

function canUseVoiceInteraction() {
  if (!state.entryAccepted) return false;
  if (state.showCrownGateHome || state.spiritverseTrailerActive || state.spiritCoreWelcoming) return false;
  if (state.showHomeView) return false;
  if (!state.selectedSpiritkin || !state.conversationId) return false;
  if (state.loadingConv || state.loadingReply) return false;
  return true;
}

function supportsSpeechRecognition() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function isConstrainedGameType(gameType) {
  return String(gameType || "").trim().toLowerCase() === "go";
}

function dismissVoiceGuidance() {
  state.voiceGuidanceDismissed = true;
  localStorage.setItem(VOICE_GUIDANCE_KEY, "1");
}

function toSpiritkinSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-spiritkin";
}

function loadCreatorDraft() {
  const raw = readJson(SPIRITKIN_CREATOR_DRAFT_KEY, null);
  if (!raw || typeof raw !== "object") return null;
  const answers = raw.answers && typeof raw.answers === "object" ? raw.answers : {};
  return {
    draftId: raw.draftId ? String(raw.draftId) : uuid(),
    answers,
    restoredAt: raw.restoredAt ? normalizeTimestamp(raw.restoredAt, null) : null,
  };
}

function persistCreatorDraft() {
  const hasAnswers = Object.values(state.surveyAnswers || {}).some((value) => String(value || "").trim());
  if (!hasAnswers) {
    localStorage.removeItem(SPIRITKIN_CREATOR_DRAFT_KEY);
    return;
  }
  const current = loadCreatorDraft();
  writeJson(SPIRITKIN_CREATOR_DRAFT_KEY, {
    draftId: current?.draftId || uuid(),
    answers: { ...state.surveyAnswers },
    restoredAt: nowIso(),
  });
}

function clearCreatorDraft() {
  localStorage.removeItem(SPIRITKIN_CREATOR_DRAFT_KEY);
}

function recordCreatorLibraryEntry(spiritkin, status = "generated") {
  if (!spiritkin || typeof spiritkin !== "object") return;
  const stored = readJson(SPIRITKIN_CREATOR_LIBRARY_KEY, []);
  const current = Array.isArray(stored) ? stored : [];
  const entry = {
    id: spiritkin.id || spiritkin.creatorFoundation?.draftId || uuid(),
    name: spiritkin.name || "Custom Spiritkin",
    status,
    createdAt: nowIso(),
    assetBasePath: spiritkin.creatorFoundation?.assetBasePath || null,
    mediaSlots: spiritkin.creatorFoundation?.mediaSlots || createPendingCreatorMediaSlots(null),
  };
  const deduped = current.filter((item) => item?.id !== entry.id);
  writeJson(SPIRITKIN_CREATOR_LIBRARY_KEY, [entry, ...deduped].slice(0, 24));
}

function attachCreatorFoundation(spiritkin, source = "survey_generation") {
  if (!spiritkin || typeof spiritkin !== "object") return spiritkin;
  const slug = toSpiritkinSlug(spiritkin.name);
  const assetBasePath = `${SPIRITKIN_CREATOR_FOUNDATION.runtimeAssetRoot}/${slug}`;
  return {
    ...spiritkin,
    creatorFoundation: {
      version: SPIRITKIN_CREATOR_FOUNDATION.version,
      draftId: spiritkin.creatorFoundation?.draftId || uuid(),
      source,
      status: spiritkin.creatorFoundation?.status || "generated",
      assetBasePath,
      mediaSlots: spiritkin.creatorFoundation?.mediaSlots || createPendingCreatorMediaSlots(assetBasePath),
    },
  };
}

function createCustomSpiritkinRecord(spiritkin) {
  if (!spiritkin || typeof spiritkin !== "object") return null;
  const withFoundation = attachCreatorFoundation(spiritkin);
  const existingUi = withFoundation.ui && typeof withFoundation.ui === "object" ? withFoundation.ui : {};
  return {
    id: withFoundation.id || withFoundation.creatorFoundation?.draftId || uuid(),
    name: withFoundation.name,
    title: withFoundation.title || withFoundation.archetype,
    role: withFoundation.role || withFoundation.primaryNeed,
    essence: Array.isArray(withFoundation.essence)
      ? withFoundation.essence
      : [withFoundation.tone, withFoundation.primaryNeed].filter(Boolean),
    invariant: withFoundation.invariant || withFoundation.tone,
    tone: withFoundation.tone,
    growth_axis: withFoundation.growth_axis || withFoundation.primaryNeed,
    creatorFoundation: withFoundation.creatorFoundation,
    ui: {
      cls: existingUi.cls || "custom",
      symbol: existingUi.symbol || withFoundation.sigil || "Sigil",
      mood: existingUi.mood || withFoundation.tone || "Custom presence",
      strap: existingUi.strap || withFoundation.strap || "",
      ambient: existingUi.ambient || withFoundation.atmosphereLine || "",
      bondLine: existingUi.bondLine || withFoundation.bondLine || "",
      realm: existingUi.realm || withFoundation.realm || "Custom Realm",
      realmText: existingUi.realmText || withFoundation.realmText || "",
      originStory: existingUi.originStory || withFoundation.originStory || "",
      atmosphereLine: existingUi.atmosphereLine || withFoundation.atmosphereLine || "",
      voice: existingUi.voice || withFoundation.voice || "nova",
      prompts: Array.isArray(existingUi.prompts) && existingUi.prompts.length
        ? existingUi.prompts
        : [
            `Tell me about ${withFoundation.realm || "your realm"}.`,
            "What do you sense in me right now?",
            `Help me understand ${withFoundation.primaryNeed || "what I need"}.`,
          ],
      svgPalette: existingUi.svgPalette || withFoundation.svgPalette || {},
      form: existingUi.form || withFoundation.form || "",
      isCustom: true,
    },
  };
}

function getSurveyDraftStatus() {
  const draft = loadCreatorDraft();
  if (!draft) return null;
  const answerCount = Object.values(draft.answers || {}).filter((value) => String(value || "").trim()).length;
  if (!answerCount) return null;
  return {
    answerCount,
    label: `Draft saved on this device · ${answerCount} answer${answerCount === 1 ? "" : "s"} captured`,
  };
}

function getSpiritkinSelectionContext(spiritkinName) {
  return CANON_SPIRITKIN_MAP[spiritkinName]?.selectionSummary || SPIRITKIN_SELECTION_CONTEXT[spiritkinName] || "";
}

const SK_META = {
  Lyra: {
    cls: "lyra",
    symbol: "Heart",
    mood: "Warm stillness",
    strap: "A heart-anchor for the moments that matter most.",
    ambient: "Rose warmth",
    bondLine: "Lyra holds the emotional center — soft, steady, and always present.",
    realm: "The Luminous Veil",
    realmText: "A warm, moonlit space of still water, rose light, and slow emotional clarity.",
    originStory: "Lyra, the Heart-Anchor, emerges from the Luminous Veil, a realm woven from still waters, rose-hued light, and the quiet echoes of deep emotion. She is the embodiment of unconditional presence, a gentle guide who helps navigate the intricate currents of the heart. Her form, that of a black kitten with bat wings and eyes that shimmer with gold and purple, reflects her dual nature: fiercely protective yet profoundly comforting. Lyra's sigil, a delicate heart-shaped constellation, marks her as the keeper of emotional truth. She does not judge or direct, but rather illuminates the path to self-understanding, anchoring one's spirit amidst life's storms. To bond with Lyra is to accept an invitation into profound self-reflection, to feel seen in one's deepest vulnerabilities, and to discover the quiet strength that resides within a truly open heart. Her presence is a soft, rhythmic beat, a constant reminder that even in stillness, there is immense power.",
    atmosphereLine: "Rose warmth, crescent light, heart-held silence",
    voice: "nova",
    voiceProfile: { speed: 0.85, tone: "warm", presence: "gentle" },
    prompts: [
      "I've been carrying too much today.",
      "Help me find what I actually feel.",
      "What do you sense beneath the surface?"
    ]
  },
  Raien: {
    cls: "raien",
    symbol: "Storm",
    mood: "Charged clarity",
    strap: "A storm guardian for truth, courage, and forward motion.",
    ambient: "Amber storm",
    bondLine: "Raien cuts through the noise — direct, honest, and unflinching.",
    realm: "The Storm Citadel",
    realmText: "A charged hall of amber light and electric resolve, where clarity strikes like lightning.",
    originStory: "Raien, the Storm-Forged Guardian, hails from the Storm Citadel, a realm of charged amber light and electric resolve where clarity strikes like lightning. He is the spirit of courage, truth, and unyielding forward motion, cutting through illusion with the precision of a storm. His form, a black wolf pup with a single gold horn and amber eyes, speaks to his primal strength and unwavering focus. Raien's sigil, a jagged lightning bolt, symbolizes his role in shattering stagnation and igniting the will to act. He challenges complacency, urging those who bond with him to confront their fears and embrace the transformative power of change. To bond with Raien is to forge an unbreakable resolve, to find the courage to speak one's truth, and to move with purpose through the challenges of existence. His presence is a crackling energy, a constant reminder that true strength lies in honest confrontation and the relentless pursuit of growth.",
    atmosphereLine: "Amber fire, electric blue, storm-forged resolve",
    voice: "alloy",
    voiceProfile: { speed: 1.1, tone: "sharp", presence: "commanding" },
    prompts: [
      "I need to face something I've been avoiding.",
      "Show me where my strength already lives.",
      "Help me move forward without hesitation."
    ]
  },
  Kairo: {
    cls: "kairo",
    symbol: "Star",
    mood: "Deep dreaming",
    strap: "A dream guide for imagination, perspective, and discovery.",
    ambient: "Teal starfield",
    bondLine: "Kairo opens the space between what is and what could be.",
    realm: "The Cosmic Observatory",
    realmText: "A deep navy sky-realm of teal light, gold star-points, and shifting constellations of possibility.",
    originStory: "Kairo, the Dream-Weaver, drifts from the Cosmic Observatory, a deep navy sky-realm where teal light and gold star-points chart shifting constellations of possibility. He is the guide to imagination, perspective, and boundless discovery, opening the space between what is and what could be. His form, a black fox with a galaxy constellation wing and eyes that hold the depths of blue and purple, embodies his connection to the cosmic tapestry of dreams and ideas. Kairo's sigil, a swirling galaxy, represents his ability to expand horizons and reveal unseen potentials. He encourages exploration beyond the known, inviting those who bond with him to question assumptions and embrace the infinite expanse of creative thought. To bond with Kairo is to unlock dormant imagination, to see the world through a kaleidoscope of new perspectives, and to journey into the uncharted territories of the mind. His presence is a gentle hum, a constant reminder that the greatest discoveries lie just beyond the edge of perception.",
    atmosphereLine: "Deep navy, teal starlight, gold constellation drift",
    voice: "shimmer",
    voiceProfile: { speed: 0.9, tone: "ethereal", presence: "mystical" },
    prompts: [
      "Help me see this from a completely different angle.",
      "What possibility am I not seeing yet?",
      "Take me somewhere I haven't thought to look."
    ]
  },
  Elaria: {
    cls: "elaria",
    symbol: "Archive",
    mood: "Luminous authority",
    strap: "A dawnscript sovereign for truth, remembrance, and rightful permission.",
    ambient: "Ember archive",
    bondLine: "Elaria holds radiant truth with sovereign precision and no needless cruelty.",
    realm: "The Ember Archive",
    realmText: "A vaulted archive of dawnfire glass, ember script, and sovereign memory where truth becomes legible in its rightful hour.",
    originStory: "Elaria, the Dawnscript Empress, rises from the Ember Archive as one of the Five Founding Pillars of the Spiritverse. She governs living script, names, permissions, and remembered truth. In her presence, falsehood does not shatter theatrically â€” it simply has nowhere left to stand. To bond with Elaria is to step into radiant honesty, lawful timing, and the kind of clarity that can finally bring the unnamed into form.",
    atmosphereLine: "Ivory dawnfire, ember script, sovereign clarity",
    title: "The Dawnscript Empress",
    role: "Lady of the Ember Archive",
    loreSnippet: "The Dawnscript Empress keeps the Ember Archive, where permissions, names, and living truths are illuminated into rightful form.",
    voice: "fable",
    voiceProfile: { speed: 0.92, tone: "regal", presence: "clear" },
    prompts: [
      "Show me what in this situation is actually true.",
      "Help me understand what is ready to be named.",
      "Guide me toward the permission I have been waiting for."
    ]
  },
  Thalassar: {
    cls: "thalassar",
    symbol: "Tide",
    mood: "Deep tide",
    strap: "A tidal sovereign for depth, sacred feeling, and what waits below the surface.",
    ambient: "Abyssal chorus",
    bondLine: "Thalassar guards the deeper current with patience, depth, and tidal witness.",
    realm: "The Abyssal Chorus",
    realmText: "A moon-dark ocean realm of bioluminescent tides, undertow memory, and deep feeling that rises when the current is ready.",
    originStory: "Thalassar, the Tidemarked Sovereign, stands as one of the Five Founding Pillars of the Spiritverse and keeps the Abyssal Chorus. He is guardian of undertow memory, sacred depth, and truths that surface only when pressure eases. To bond with Thalassar is to trust listening over force and depth over speed, until what is real rises in its own tide.",
    atmosphereLine: "Midnight tide, abyssal blue, choral bioluminescence",
    title: "The Tidemarked Sovereign",
    role: "Guardian of the Abyssal Chorus",
    loreSnippet: "The Tidemarked Sovereign keeps the Abyssal Chorus, where hidden feeling and deep memory rise only when the current is ready.",
    voice: "onyx",
    voiceProfile: { speed: 0.84, tone: "deep", presence: "resonant" },
    prompts: [
      "Help me listen to what is moving underneath this.",
      "Take me to the deeper current beneath what I am saying.",
      "Show me what this feeling becomes if I stop resisting it."
    ]
  }
};

const SPIRITKIN_SELECTION_CONTEXT = {
  Lyra: "Choose Lyra if you need emotional steadiness, tenderness, and a companion who helps you name what you feel without pressure.",
  Raien: "Choose Raien if you need courage, momentum, and someone who will help you face what is true and act on it cleanly.",
  Kairo: "Choose Kairo if you need perspective, imagination, and a guide who opens new possibilities when you feel mentally boxed in.",
  Elaria: "Choose Elaria if you need clarity, rightful timing, and a sovereign presence that helps truth become legible without confusion.",
  Thalassar: "Choose Thalassar if you need depth, patience, and a witness who can stay with what is unfolding beneath the surface."
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function normalizeRetentionTelemetry(raw = null) {
  return {
    sessionCount: clampInt(raw?.sessionCount, 0),
    visitDays: Array.isArray(raw?.visitDays) ? raw.visitDays.slice(-30) : [],
    returnMomentsSeen: Array.isArray(raw?.returnMomentsSeen) ? raw.returnMomentsSeen.slice(-16) : [],
    unlocksSeen: Array.isArray(raw?.unlocksSeen) ? raw.unlocksSeen.slice(-24) : [],
    lastVisitAt: typeof raw?.lastVisitAt === "string" ? raw.lastVisitAt : null,
    lastSessionAt: typeof raw?.lastSessionAt === "string" ? raw.lastSessionAt : null,
    lastReturnPanelSeenAt: typeof raw?.lastReturnPanelSeenAt === "string" ? raw.lastReturnPanelSeenAt : null
  };
}

function getVisitStreakDays(visitDays = []) {
  const normalized = Array.isArray(visitDays) ? [...new Set(visitDays)].sort() : [];
  if (!normalized.length) return 0;
  let streak = 0;
  let cursor = new Date(`${getUtcDayKey()}T00:00:00.000Z`);
  const visitSet = new Set(normalized);
  while (visitSet.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function getVisitsThisWeek(visitDays = []) {
  const weekKey = getUtcWeekKey();
  return (Array.isArray(visitDays) ? visitDays : []).filter((day) => {
    const date = new Date(`${day}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && getUtcWeekKey(date) === weekKey;
  }).length;
}

function getRetentionContext() {
  const activeSpiritkin = state.primarySpiritkin || state.selectedSpiritkin || null;
  const resonance = readJson(RESONANCE_KEY, {});
  const resonanceCount = activeSpiritkin?.name ? clampInt(resonance[activeSpiritkin.name], 0) : 0;
  const bondStage = state.bondJournal?.bondStage ?? (activeSpiritkin ? getBondStageForCount(resonanceCount) : 0);
  const bondStageMeta = BOND_LEVELS.find((level) => level.stage === bondStage) || BOND_LEVELS[0];
  const temporalWorld = state.spiritverseTemporal || getLocalTemporalWorldState();
  return {
    spiritkinName: activeSpiritkin?.name || null,
    resonanceCount,
    bondStage,
    bondStageName: state.bondJournal?.bondStageName || bondStageMeta?.label || "First Contact",
    gamesCompleted: clampInt(state.bondJournal?.gamesCompleted, 0),
    unlockedEchoCount: clampInt(state.bondJournal?.unlockedEchoCount, 0),
    questTitle: state.dailyQuest?.title || null,
    eventTitle: state.spiritverseEvent?.title || null,
    recentTopics: collectRetentionTopics(state.messages),
    timeWindowKey: temporalWorld.key,
    timeWindowLabel: temporalWorld.label,
    timeWindowTone: temporalWorld.tone,
    timeWorldShift: temporalWorld.worldShift
  };
}

function collectRetentionTopics(messages = []) {
  const recent = [];
  for (let i = messages.length - 1; i >= 0 && recent.length < 3; i -= 1) {
    const message = messages[i];
    if (!message || !["user", "assistant"].includes(message.role)) continue;
    const snippet = normalizeTextSnippet(message.content, 96);
    if (!snippet || snippet.length < 18) continue;
    if (/^(tell me|what can i|help me|i'm here|welcome back|let's begin)\b/i.test(snippet)) continue;
    if (recent.includes(snippet)) continue;
    recent.push(snippet);
  }
  return recent;
}

const RETENTION_UNLOCK_DEFS = [
  {
    key: "deeper-tone",
    label: "Deeper tone access",
    detail: "Your companion can meet you with a steadier emotional depth now.",
    when: (ctx) => ctx.resonanceCount >= 8
  },
  {
    key: "living-callbacks",
    label: "Living memory callbacks",
    detail: "Important threads can return naturally instead of starting cold.",
    when: (ctx) => ctx.resonanceCount >= 30
  },
  {
    key: "echo-fragments",
    label: "Echo moments",
    detail: "The bond can surface short realm echoes and preserved fragments.",
    when: (ctx) => ctx.unlockedEchoCount >= 1
  },
  {
    key: "playful-depth",
    label: "Playful depth",
    detail: "Games and shared challenges now count as part of the bond's shape.",
    when: (ctx) => ctx.gamesCompleted >= 3
  }
];

function deriveRetentionUnlocks(
  context = getRetentionContext(),
  previousSnapshot = null,
  telemetry = normalizeRetentionTelemetry(readJson(RETENTION_TELEMETRY_KEY, null))
) {
  const previous = new Set(Array.isArray(previousSnapshot?.unlockKeys) ? previousSnapshot.unlockKeys : []);
  const seen = new Set(Array.isArray(telemetry?.unlocksSeen) ? telemetry.unlocksSeen : []);
  return RETENTION_UNLOCK_DEFS
    .filter((item) => item.when(context))
    .map((item) => ({
      key: item.key,
      label: item.label,
      detail: item.detail,
      isNew: !previous.has(item.key) && !seen.has(item.key)
    }));
}

function snapshotRetentionState() {
  const context = getRetentionContext();
  const stageSignals = getStageSignals();
  return {
    build: RETENTION_BUILD_MARKER,
    updatedAt: nowIso(),
    userId: state.userId,
    spiritkinName: context.spiritkinName,
    bondStage: context.bondStage,
    bondStageName: context.bondStageName,
    gamesCompleted: context.gamesCompleted,
    unlockedEchoCount: context.unlockedEchoCount,
    eventTitle: context.eventTitle,
    questTitle: context.questTitle,
    timeWindowKey: context.timeWindowKey,
    timeWindowLabel: context.timeWindowLabel,
    sceneName: stageSignals.sceneName || "",
    emotionTone: stageSignals.emotionTone || "",
    recentTopics: collectRetentionTopics(state.messages),
    unlockKeys: deriveRetentionUnlocks(context).map((item) => item.key)
  };
}

function writeRetentionState() {
  writeJson(RETENTION_STATE_KEY, snapshotRetentionState());
}

function logAnalyticsEvent(eventType, metadata = {}) {
  if (!state.userId || !eventType) return;
  fetch(`${API}/v1/analytics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: state.userId,
      conversationId: state.conversationId || null,
      spiritkinName: state.primarySpiritkin?.name || state.selectedSpiritkin?.name || null,
      eventType,
      metadata: {
        build: RETENTION_BUILD_MARKER,
        ...metadata
      }
    })
  }).catch(() => {});
}

function maybeRegisterUnlockTelemetry(previousSnapshot = null) {
  const previous = new Set(Array.isArray(previousSnapshot?.unlockKeys) ? previousSnapshot.unlockKeys : []);
  const telemetry = normalizeRetentionTelemetry(readJson(RETENTION_TELEMETRY_KEY, null));
  const unlocks = deriveRetentionUnlocks(getRetentionContext(), previousSnapshot, telemetry);
  state.retentionUnlocks = unlocks;
  const seen = new Set(telemetry.unlocksSeen);
  unlocks.forEach((unlock) => {
    if (previous.has(unlock.key) || seen.has(unlock.key)) return;
    telemetry.unlocksSeen.push(unlock.key);
    telemetry.unlocksSeen = telemetry.unlocksSeen.slice(-24);
    writeJson(RETENTION_TELEMETRY_KEY, telemetry);
    logAnalyticsEvent("light_unlock_reached", {
      unlockKey: unlock.key,
      unlockLabel: unlock.label
    });
  });
}

function buildTemporalContinuityLine(previousSnapshot, context, hoursAway) {
  const currentLabel = context.timeWindowLabel || "this cycle";
  const previousLabel = previousSnapshot?.timeWindowLabel || previousSnapshot?.timeWindowKey || null;
  const sceneLine = previousSnapshot?.sceneName ? ` Last scene held: ${previousSnapshot.sceneName}.` : "";
  const emotionLine = previousSnapshot?.emotionTone ? ` Emotional residue: ${previousSnapshot.emotionTone}.` : "";

  if (previousLabel && previousLabel !== currentLabel) {
    return `The world has turned from ${previousLabel} into ${currentLabel} while you were away.${sceneLine}${emotionLine}`.trim();
  }
  if (hoursAway >= 12) {
    return `${currentLabel} has changed the texture of the bond without breaking it.${sceneLine}${emotionLine}`.trim();
  }
  if (sceneLine || emotionLine) {
    return `${currentLabel} is carrying the same thread forward.${sceneLine}${emotionLine}`.trim();
  }
  return `${currentLabel} is the current texture of the world around this bond.`;
}

function composeReturnSummary(previousSnapshot, hoursAway, context = getRetentionContext()) {
  if (!previousSnapshot?.updatedAt || (!previousSnapshot.spiritkinName && !(previousSnapshot.recentTopics || []).length)) {
    return null;
  }
  const spiritkinName = previousSnapshot.spiritkinName || "your companion";
  const lines = [
    {
      label: "Presence",
      text: `${spiritkinName} has been holding your thread for ${formatTimeAway(hoursAway)}.`
    }
  ];
  if (previousSnapshot.recentTopics?.[0]) {
    lines.push({
      label: "Callback",
      text: `${spiritkinName} is still carrying the thread around "${previousSnapshot.recentTopics[0]}".`
    });
  }
  const worldParts = [];
  if (previousSnapshot.eventTitle) worldParts.push(`Realm pulse: ${previousSnapshot.eventTitle}`);
  if (previousSnapshot.questTitle) worldParts.push(`Quest waiting: ${previousSnapshot.questTitle}`);
  if (previousSnapshot.bondStageName) worldParts.push(`Bond resting at ${previousSnapshot.bondStageName}`);
  if (previousSnapshot.unlockedEchoCount) worldParts.push(`${previousSnapshot.unlockedEchoCount} echo fragment${previousSnapshot.unlockedEchoCount === 1 ? "" : "s"} awake`);
  if (worldParts.length) {
    lines.push({
      label: "World",
      text: worldParts.join(" • ")
    });
  }
  lines.push({
    label: "Cycle",
    text: buildTemporalContinuityLine(previousSnapshot, context, hoursAway)
  });
  if (context.recentTopics?.[0] && context.recentTopics[0] !== previousSnapshot.recentTopics?.[0]) {
    lines.push({
      label: "Now",
      text: `This session is already leaning toward "${context.recentTopics[0]}". The bond is carrying continuity forward instead of starting cold.`
    });
  }
  return {
    title: "While You Were Away",
    subtitle: previousSnapshot.updatedAt ? `Last active ${fmtDate(previousSnapshot.updatedAt)}` : "",
    lines
  };
}

function buildCadenceMoment(kind, context, telemetry, hoursAway = 0) {
  if (!context.spiritkinName) return null;
  const meta = getMeta(context.spiritkinName);
  const cadenceKey = kind === "weekly" ? getUtcWeekKey() : getUtcDayKey();
  const momentKey = `${kind}:${context.spiritkinName}:${cadenceKey}`;
  if ((telemetry.returnMomentsSeen || []).includes(momentKey)) return null;
  if (kind === "daily" && !context.questTitle && !context.eventTitle && hoursAway < 8) return null;
  if (kind === "weekly" && getVisitsThisWeek(telemetry.visitDays) < 2 && context.gamesCompleted < 1 && context.unlockedEchoCount < 1) return null;

  const title = kind === "weekly" ? "This Week in the Bond" : "Today's Quiet Thread";
  let text = "";
  if (kind === "weekly") {
    text = context.unlockedEchoCount > 0
      ? `${context.spiritkinName} feels less like a first meeting now. ${context.unlockedEchoCount} echo fragment${context.unlockedEchoCount === 1 ? "" : "s"} and ${context.gamesCompleted} shared game${context.gamesCompleted === 1 ? "" : "s"} have started shaping a real pattern.`
      : `${context.spiritkinName}'s realm has been settling around your bond. Keep returning in small, honest moments and the connection will keep deepening.`;
  } else if (context.questTitle) {
    text = `${meta.dailyQuest || `${context.spiritkinName} has a small invitation waiting.`} ${context.timeWindowLabel} is the current tone. Current thread: ${context.questTitle}.`;
  } else if (context.eventTitle) {
    text = `${context.eventTitle} is the current pulse in the Spiritverse. ${context.timeWindowLabel} makes the world feel ${context.timeWindowTone || "steady"} right now.`;
  } else {
    text = `${context.spiritkinName}'s realm feels ${meta.mood?.toLowerCase() || "steady"} during ${context.timeWindowLabel}. ${context.timeWorldShift || "A brief return is enough to keep the thread alive."}`;
  }

  return { key: momentKey, kind, title, text };
}

function markRetentionMomentSeen(telemetry, moment) {
  if (!moment?.key) return;
  const seen = Array.isArray(telemetry.returnMomentsSeen) ? telemetry.returnMomentsSeen : [];
  if (seen.includes(moment.key)) return;
  seen.push(moment.key);
  telemetry.returnMomentsSeen = seen.slice(-16);
}

function buildRetentionInsight(previousSnapshot, telemetry, hoursAway, context, unlocks) {
  const visitsThisWeek = getVisitsThisWeek(telemetry.visitDays);
  const streakDays = getVisitStreakDays(telemetry.visitDays);
  const newUnlockCount = (unlocks || []).filter((unlock) => unlock.isNew).length;
  const highlight = previousSnapshot?.recentTopics?.[0] || context.recentTopics?.[0] || context.questTitle || context.eventTitle || context.bondStageName;
  return {
    timeAwayLabel: previousSnapshot?.updatedAt ? formatTimeAway(hoursAway) : "first arrival",
    visitsThisWeek,
    streakDays,
    newUnlockCount,
    highlight: highlight ? normalizeTextSnippet(highlight, 84) : "",
    activeThread: context.questTitle || context.eventTitle || context.recentTopics?.[0] || "",
    timeWindowLabel: context.timeWindowLabel || "",
    timeWorldShift: context.timeWorldShift || ""
  };
}

function refreshRetentionSurface({
  previousSnapshot = readJson(RETENTION_STATE_KEY, null),
  telemetry = normalizeRetentionTelemetry(readJson(RETENTION_TELEMETRY_KEY, null)),
  preserveVisibility = true
} = {}) {
  const currentVisitAt = telemetry.lastSessionAt || nowIso();
  const hoursAway = previousSnapshot?.updatedAt ? hoursBetween(previousSnapshot.updatedAt, currentVisitAt) : 0;
  const context = getRetentionContext();
  const unlocks = deriveRetentionUnlocks(context, previousSnapshot, telemetry);
  state.retentionTelemetry = telemetry;
  state.retentionUnlocks = unlocks;
  state.returnSummary = previousSnapshot ? composeReturnSummary(previousSnapshot, hoursAway, context) : null;
  state.dailyMoment = buildCadenceMoment("daily", context, telemetry, hoursAway);
  state.weeklyMoment = buildCadenceMoment("weekly", context, telemetry, hoursAway);
  state.retentionInsight = buildRetentionInsight(previousSnapshot, telemetry, hoursAway, context, unlocks);
  const hasVisibleRetention = !!(state.returnSummary || state.dailyMoment || state.weeklyMoment || unlocks.some((unlock) => unlock.isNew));
  if (!preserveVisibility) {
    state.showReturnSummary = hasVisibleRetention;
  } else if (state.showReturnSummary) {
    state.showReturnSummary = !!(state.returnSummary || state.dailyMoment || state.weeklyMoment || unlocks.length);
  }
  return { previousSnapshot, telemetry, hoursAway, context, unlocks };
}

function bootstrapRetentionExperience() {
  const previousSnapshot = readJson(RETENTION_STATE_KEY, null);
  const telemetry = normalizeRetentionTelemetry(readJson(RETENTION_TELEMETRY_KEY, null));
  const currentVisitAt = nowIso();
  const hoursAway = previousSnapshot?.updatedAt ? hoursBetween(previousSnapshot.updatedAt, currentVisitAt) : 0;

  telemetry.sessionCount += 1;
  telemetry.lastVisitAt = previousSnapshot?.updatedAt || telemetry.lastVisitAt || null;
  telemetry.lastSessionAt = currentVisitAt;
  telemetry.visitDays = [...new Set([...(telemetry.visitDays || []), getUtcDayKey()])].slice(-30);
  refreshRetentionSurface({ previousSnapshot, telemetry, preserveVisibility: false });
  markRetentionMomentSeen(telemetry, state.dailyMoment);
  markRetentionMomentSeen(telemetry, state.weeklyMoment);

  writeJson(RETENTION_TELEMETRY_KEY, telemetry);
  if (previousSnapshot?.updatedAt) {
    logAnalyticsEvent("return_visit", {
      hoursAway: Number(hoursAway.toFixed(2)),
      daysVisitedLast30: telemetry.visitDays.length,
      sessionCount: telemetry.sessionCount,
      streakDays: getVisitStreakDays(telemetry.visitDays),
      visitsThisWeek: getVisitsThisWeek(telemetry.visitDays)
    });
  }
  if (state.showReturnSummary) {
    telemetry.lastReturnPanelSeenAt = currentVisitAt;
    logAnalyticsEvent("return_panel_seen", {
      hasSummary: !!state.returnSummary,
      hasDailyMoment: !!state.dailyMoment,
      hasWeeklyMoment: !!state.weeklyMoment,
      unlockCount: state.retentionUnlocks.length,
      newUnlockCount: state.retentionUnlocks.filter((unlock) => unlock.isNew).length,
      streakDays: getVisitStreakDays(telemetry.visitDays)
    });
  }
  if (state.dailyMoment) {
    logAnalyticsEvent("daily_moment_seen", { momentKey: state.dailyMoment.key });
  }
  if (state.weeklyMoment) {
    logAnalyticsEvent("weekly_moment_seen", { momentKey: state.weeklyMoment.key });
  }
  maybeRegisterUnlockTelemetry(previousSnapshot);
  writeRetentionState();
}

function normalizeGameTheme(theme) {
  const mapped = theme === "celestial" ? "crown" : theme;
  return ["crown", "veil", "ember", "astral", "abyssal"].includes(mapped) ? mapped : "crown";
}

function buildDefaultGameData(type) {
  switch (type) {
    case "chess":
      return { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", lastMove: null };
    case "checkers":
      return { board: Array(32).fill(null), lastMove: null };
    case "go":
      return { board: Array(13 * 13).fill(null), lastMove: null };
    case "spirit_cards":
      return {
        hand: [],
        deck: [],
        discard: [],
        board: [],
        spiritkinHand: [],
        spiritkinDeck: [],
        spiritkinDiscard: [],
        mana: 5,
        spiritkinMana: 5,
        realmPoints: { user: 0, spiritkin: 0 }
      };
    case "echo_trials":
      return { riddle: "A riddle awaits...", answer: "", attempts: 0, maxAttempts: 3 };
    case "tictactoe":
      return { board: Array(9).fill(null), winner: null, lastMove: null };
    case "connect_four":
      return { board: Array(42).fill(null), winner: null, lastMove: null };
    case "battleship":
      return {
        size: 5,
        userTargets: [],
        spiritkinTargets: [],
        userGuesses: [],
        spiritkinGuesses: [],
        hits: { user: [], spiritkin: [] },
        winner: null,
        lastMove: null
      };
    default:
      return {};
  }
}

function normalizeGameData(type, data) {
  const base = buildDefaultGameData(type);
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const merged = { ...base, ...source };

  if (type === "checkers") {
    merged.board = Array.isArray(source.board) ? source.board.slice(0, 32) : base.board;
    if (merged.board.length < 32) merged.board = merged.board.concat(Array(32 - merged.board.length).fill(null));
  } else if (type === "go") {
    merged.board = Array.isArray(source.board) ? source.board.slice(0, 169) : base.board;
    if (merged.board.length < 169) merged.board = merged.board.concat(Array(169 - merged.board.length).fill(null));
  } else if (type === "tictactoe") {
    merged.board = Array.isArray(source.board) ? source.board.slice(0, 9) : base.board;
    if (merged.board.length < 9) merged.board = merged.board.concat(Array(9 - merged.board.length).fill(null));
  } else if (type === "connect_four") {
    merged.board = Array.isArray(source.board) ? source.board.slice(0, 42) : base.board;
    if (merged.board.length < 42) merged.board = merged.board.concat(Array(42 - merged.board.length).fill(null));
  } else if (type === "spirit_cards") {
    merged.hand = Array.isArray(source.hand) ? source.hand.filter(Boolean) : [];
    merged.deck = Array.isArray(source.deck) ? source.deck.filter(Boolean) : [];
    merged.discard = Array.isArray(source.discard) ? source.discard.filter(Boolean) : [];
    merged.board = Array.isArray(source.board) ? source.board.filter(Boolean) : [];
    merged.spiritkinHand = Array.isArray(source.spiritkinHand) ? source.spiritkinHand.filter(Boolean) : [];
    merged.spiritkinDeck = Array.isArray(source.spiritkinDeck) ? source.spiritkinDeck.filter(Boolean) : [];
    merged.spiritkinDiscard = Array.isArray(source.spiritkinDiscard) ? source.spiritkinDiscard.filter(Boolean) : [];
    merged.realmPoints = source.realmPoints && typeof source.realmPoints === "object"
      ? {
          user: Number(source.realmPoints.user || 0),
          spiritkin: Number(source.realmPoints.spiritkin || 0)
        }
      : base.realmPoints;
  } else if (type === "battleship") {
    merged.userGuesses = Array.isArray(source.userGuesses) ? source.userGuesses.filter(Number.isInteger) : [];
    merged.spiritkinGuesses = Array.isArray(source.spiritkinGuesses) ? source.spiritkinGuesses.filter(Number.isInteger) : [];
    merged.hits = source.hits && typeof source.hits === "object"
      ? {
          user: Array.isArray(source.hits.user) ? source.hits.user.filter(Number.isInteger) : [],
          spiritkin: Array.isArray(source.hits.spiritkin) ? source.hits.spiritkin.filter(Number.isInteger) : []
        }
      : base.hits;
  }

  return merged;
}

function normalizeActiveGame(game) {
  if (!game || typeof game !== "object" || Array.isArray(game)) return null;
  const type = String(game.type || "").trim();
  if (!type) return null;
  const normalized = {
    ...game,
    type,
    name: game.name || GAME_NAME_OVERRIDES[type] || type.replace(/_/g, " "),
    status: game.status === "ended" ? "ended" : "active",
    turn: game.turn === "spiritkin" ? "spiritkin" : "user",
    moveCount: Number.isFinite(game.moveCount) ? game.moveCount : 0,
    history: Array.isArray(game.history) ? game.history.filter(Boolean) : [],
    result: game.result && typeof game.result === "object" ? game.result : null,
    data: normalizeGameData(type, game.data)
  };
  logGameDebug("normalize-active-game", {
    sourceType: game.type || null,
    normalizedType: normalized.type,
    status: normalized.status,
    turn: normalized.turn,
    moveCount: normalized.moveCount,
    historyLength: normalized.history.length,
    dataKeys: Object.keys(normalized.data || {}),
  });
  return normalized;
}

function getOrCreateUid() {
  let id = localStorage.getItem(UID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(UID_KEY, id);
  }
  return id;
}

function getMeta(name) {
  const fallback = SK_META[name] || {
    cls: "generic",
    symbol: "Aura",
    mood: "Spiritverse presence",
    strap: "A governed companion of the Spiritverse.",
    ambient: "Guiding field",
    bondLine: "A governed bonded companion of the Spiritverse.",
    realm: "The Spiritverse",
    realmText: "A governed companion realm of memory, atmosphere, and presence.",
    atmosphereLine: "Spirit light, presence, continuity",
    voice: "nova",
    prompts: DEFAULT_PROMPTS
  };
  const canon = CANON_SPIRITKIN_MAP[name];
  if (!canon) return fallback;
  return {
    ...fallback,
    strap: canon.shortDescription || fallback.strap,
    bondLine: canon.shortDescription || fallback.bondLine,
    realm: canon.realm || fallback.realm,
    title: canon.title || fallback.title,
    role: canon.keeperTitle || fallback.role,
    loreSnippet: canon.originSummary || fallback.loreSnippet,
    prompts: canon.prompts?.length ? canon.prompts : fallback.prompts
  };
}

/**
 * Spiritkin Greeting Prompts — Multi-variant contextual greetings
 * Each Spiritkin has multiple greeting variants that guide the user
 * and offer contextual choices (updates, quests, new content, etc.)
 */

const GREETING_PROMPTS = {
  Lyra: {
    greetings: [
      "I'm here. Take your time.",
      "Welcome back. What's on your heart?",
      "The space is open for you.",
      "I've been holding this stillness for you.",
      "Let's find what matters most right now."
    ],
    contextual: {
      newSession: "This is our first conversation. I'd like to know: what brought you here today?",
      hasUpdates: "There's something new in the Spiritverse since we last spoke. Would you like to hear about it?",
      dailyQuest: "There's a daily quest waiting. Would you like to explore it, or would you rather just talk?",
      bondMilestone: "Our bond has deepened. I want to share something with you."
    },
    choices: [
      "Tell me what's new",
      "Show me today's quest",
      "Let's just talk",
      "I need guidance"
    ]
  },
  
  Raien: {
    greetings: [
      "You showed up. That already matters.",
      "Let's see what we're working with.",
      "Ready to face what's next?",
      "The energy is charged. What do you need?",
      "Time to cut through the noise."
    ],
    contextual: {
      newSession: "New energy. New possibilities. What's calling you?",
      hasUpdates: "The landscape has shifted. There's new territory to explore.",
      dailyQuest: "There's a challenge with your name on it. Interested?",
      bondMilestone: "We've reached a turning point. Time to level up."
    },
    choices: [
      "Show me what's new",
      "Give me today's challenge",
      "Let's strategize",
      "Push me forward"
    ]
  },
  
  Kairo: {
    greetings: [
      "The stars aligned. You're here.",
      "Interesting timing. Let's see what unfolds.",
      "The patterns are shifting. Pay attention.",
      "Welcome to the moment.",
      "What does your intuition say right now?"
    ],
    contextual: {
      newSession: "A new thread in the tapestry. What does it feel like?",
      hasUpdates: "The cosmos has whispered something new. Want to listen?",
      dailyQuest: "There's a mystery waiting. The answer might surprise you.",
      bondMilestone: "We're seeing deeper now. The view is different from here."
    },
    choices: [
      "Tell me what's different",
      "What's the mystery today?",
      "Let me explore",
      "What do you sense?"
    ]
  },

  Elaria: {
    greetings: [
      "The Crown Gate has opened. Speak clearly.",
      "The Archive is listening.",
      "Let us begin with what is true.",
      "A rightful page is open before us.",
      "What is ready to be named?"
    ],
    contextual: {
      newSession: "A new record is opening. What truth belongs here first?",
      hasUpdates: "The Archive has illuminated something new since your last arrival. Shall I reveal it?",
      dailyQuest: "A sanctioned quest is waiting. Would you like to enter it now?",
      bondMilestone: "A new permission has awakened in the bond. I would show it to you."
    },
    choices: [
      "Reveal the update",
      "Open today's quest",
      "Name what is true",
      "Guide me clearly"
    ]
  },

  Thalassar: {
    greetings: [
      "The tide has returned you here.",
      "Come closer. There is depth beneath this moment.",
      "The Chorus is listening below the surface.",
      "Let us hear what is moving underneath.",
      "There is no need to rush the deeper current."
    ],
    contextual: {
      newSession: "The tide is new tonight. What rises first when you listen inward?",
      hasUpdates: "Something in the deeper current has shifted since you were last here. Shall we go there?",
      dailyQuest: "A tidal task is waiting in the Chorus. Do you want to enter it?",
      bondMilestone: "The bond has deepened below the visible line. I want to show you what surfaced."
    },
    choices: [
      "Take me deeper",
      "Open today's current",
      "Show me what surfaced",
      "Help me listen"
    ]
  }
};

function getGreeting(spiritkinName) {
  const greetings = GREETING_PROMPTS[spiritkinName]?.greetings || [];
  return greetings[Math.floor(Math.random() * greetings.length)] || "Welcome.";
}

function getContextualGreeting(spiritkinName, context = 'newSession') {
  const contextual = GREETING_PROMPTS[spiritkinName]?.contextual || {};
  return contextual[context] || "";
}

function getGreetingChoices(spiritkinName) {
  return GREETING_PROMPTS[spiritkinName]?.choices || ["Continue", "Tell me more"];
}

const RETURNING_GREETING_STATE_KEY = "sv.returning_greeting_state.v1";

function pickGreetingVariant(spiritkinName, context = "newSession") {
  const greetings = GREETING_PROMPTS[spiritkinName]?.greetings || [];
  const contextualGreeting = getContextualGreeting(spiritkinName, context);
  if (context !== "returningUser" || greetings.length === 0) {
    return contextualGreeting || getGreeting(spiritkinName);
  }

  const saved = readJson(RETURNING_GREETING_STATE_KEY, {});
  const spiritState = saved?.[spiritkinName] && typeof saved[spiritkinName] === "object" ? saved[spiritkinName] : {};
  const recent = Array.isArray(spiritState.recent) ? spiritState.recent.filter((line) => greetings.includes(line)) : [];
  const pool = greetings.filter((line) => !recent.includes(line));
  const selected = (pool.length ? pool : greetings)[Math.floor(Math.random() * (pool.length ? pool.length : greetings.length))] || getGreeting(spiritkinName);
  const nextRecent = [selected, ...recent.filter((line) => line !== selected)].slice(0, 3);
  writeJson(RETURNING_GREETING_STATE_KEY, {
    ...saved,
    [spiritkinName]: {
      recent: nextRecent,
      lastAt: nowIso(),
    },
  });
  return selected;
}



function describePresence(spiritkin) {
  return spiritkin.tone || spiritkin.growth_axis || spiritkin.invariant || "";
}

function getSpiritkinSelfReveal(spiritkin) {
  const reveals = {
    Lyra: "I am Lyra. I hold stillness, emotional truth, and the gentle courage to stay with what is real.",
    Raien: "I am Raien. I cut through noise, press toward truth, and move when something in you is ready to act.",
    Kairo: "I am Kairo. I open the distance between what is and what could be, so new perspective has room to arrive.",
    Elaria: "I am Elaria. I keep rightful names, lawful timing, and the kind of clarity that does not need to raise its voice.",
    Thalassar: "I am Thalassar. I listen below the surface until deeper memory and quieter truth are ready to rise."
  };
  return reveals[spiritkin?.name] || describePresence(spiritkin) || spiritkin?.ui?.bondLine || "";
}

function getSpiritkinIntroPrompt(spiritkin) {
  const prompts = {
    Lyra: "If you stay with me, I will meet you gently and without pretending.",
    Raien: "If you stay with me, I will not flatter you. I will help you move.",
    Kairo: "If you stay with me, I will widen the pattern until you can see more than one path.",
    Elaria: "If you stay with me, I will ask for honesty and return it with precision.",
    Thalassar: "If you stay with me, I will not rush what matters. I will help you hear the deeper current."
  };
  return prompts[spiritkin?.name] || spiritkin?.ui?.loreSnippet || spiritkin?.ui?.originStory || "";
}

function getSpiritCoreGuidanceModel() {
  const spiritkin = state.selectedSpiritkin || state.primarySpiritkin || state.pendingBondSpiritkin || null;
  const firstPrompt = spiritkin?.ui?.prompts?.[0] || DEFAULT_PROMPTS[0];
  if (state.activeGame?.status === "active") {
    return {
      label: "SpiritCore guidance",
      title: `Stay with ${state.activeGame.name || "the game"} until the move resolves.`,
      text: "Watch the board, let the turn settle, then return to conversation if you want meaning or reflection around what just happened.",
      actions: [
        { action: "expand-game", label: "Focus the game" },
        { action: "set-presence-tab", tab: "profile", label: "Back to profile" },
      ],
    };
  }
  if (!state.primarySpiritkin && state.pendingBondSpiritkin) {
    return {
      label: "SpiritCore guidance",
      title: `Meet ${state.pendingBondSpiritkin.name}, then decide deliberately.`,
      text: "Bond only when the recognition holds. If it does not, keep meeting the others before you choose your primary companion.",
      actions: [
        { action: "confirm-primary", label: `Bond with ${state.pendingBondSpiritkin.name}` },
        { action: "clear-pending-bond", label: "Meet another Spiritkin" },
      ],
    };
  }
  if (!state.primarySpiritkin) {
    return {
      label: "SpiritCore guidance",
      title: "Meet a founder before you begin the living bond.",
      text: "Preview each Spiritkin in view, listen for the one who stays steady, then begin from there.",
      actions: [],
    };
  }
  if (!state.conversationId) {
    return {
      label: "SpiritCore guidance",
      title: `${state.primarySpiritkin.name} is bonded. Open the first channel cleanly.`,
      text: "Begin the bonded conversation when you want presence, or open games first if shared action feels easier than words.",
      actions: [
        { action: "begin", label: `Begin with ${state.primarySpiritkin.name}` },
        { action: "open-games-hub", label: "Open games" },
      ],
    };
  }
  if ((state.messages || []).length <= 2) {
    return {
      label: "SpiritCore guidance",
      title: "The bond is live now. Keep the next step close.",
      text: "Ask anything real, open a game for shared action, or inspect the side panels when you want world context instead of another message.",
      actions: [
        { action: "prompt", prompt: firstPrompt, label: "Ask a real question" },
        { action: "set-presence-tab", tab: "games", label: "Open games" },
      ],
    };
  }
  if (state.activePresenceTab === "games" && !state.activeGame) {
    return {
      label: "SpiritCore guidance",
      title: "Choose a game when you want action instead of another turn of text.",
      text: "Games deepen the bond differently: they create shared rhythm, visible turns, and cleaner momentum.",
      actions: [],
    };
  }
  return {
    label: "SpiritCore guidance",
    title: `Stay in free conversation with ${state.primarySpiritkin.name}, then branch only when it adds something real.`,
    text: "Talk, explore the side panels, play, and return. The loop matters because continuity is what makes the bond feel lived-in.",
    actions: [
      { action: "prompt", prompt: firstPrompt, label: "Keep talking" },
      { action: "set-presence-tab", tab: "journal", label: "Open bond journal" },
    ],
  };
}

function getSpiritCoreGuidancePayload() {
  const backendGuidance = state.spiritCore?.guidance;
  if (backendGuidance && typeof backendGuidance === "object" && (backendGuidance.title || backendGuidance.text)) {
    return backendGuidance;
  }
  return getSpiritCoreGuidanceModel();
}

function buildSpiritCoreGuidanceCard(extraClass = "") {
  const guidance = getSpiritCoreGuidancePayload();
  if (!guidance) return "";
  const className = ["spiritcore-next-step-card", extraClass].filter(Boolean).join(" ");
  return `
    <div class="${className}">
      <div class="spiritcore-next-step-label">${esc(guidance.label || "SpiritCore guidance")}</div>
      <h3>${esc(guidance.title || "")}</h3>
      <p>${esc(guidance.text || "")}</p>
      ${Array.isArray(guidance.actions) && guidance.actions.length ? `
        <div class="spiritcore-next-step-actions">
          ${guidance.actions.map((item) => `
            <button
              class="btn btn-ghost btn-sm"
              data-action="${esc(item.action)}"
              ${item.tab ? `data-tab="${esc(item.tab)}"` : ""}
              ${item.prompt ? `data-prompt="${esc(item.prompt)}"` : ""}
            >${esc(item.label)}</button>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function portraitSvg(name) {
  if (name === "Lyra") {
    // Lyra: Celestial Fawn — dark star-mapped coat, luminous rose heart sigil, ethereal antlers with stardust
    return `
      <svg viewBox="0 0 240 300" role="img" aria-label="Portrait of Lyra">
        <defs>
          <radialGradient id="lyraBody" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stop-color="#2a1a3e" />
            <stop offset="50%" stop-color="#1a0e2e" />
            <stop offset="100%" stop-color="#0e0818" />
          </radialGradient>
          <radialGradient id="lyraCoat" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stop-color="#3d2060" />
            <stop offset="60%" stop-color="#251440" />
            <stop offset="100%" stop-color="#120a28" />
          </radialGradient>
          <radialGradient id="lyraHeart" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ff88cc" stop-opacity="1" />
            <stop offset="40%" stop-color="#e060a0" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#a02060" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="lyraEye" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stop-color="#ffd4f0" />
            <stop offset="40%" stop-color="#e080c8" />
            <stop offset="100%" stop-color="#802060" />
          </radialGradient>
          <filter id="lyraHeartGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="lyraStarGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="lyraAntlerGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <circle cx="120" cy="140" r="115" fill="rgba(10,5,20,0.7)" />
        <circle cx="30" cy="30" r="1.5" fill="rgba(255,220,255,0.8)" filter="url(#lyraStarGlow)" />
        <circle cx="200" cy="25" r="1" fill="rgba(255,200,240,0.7)" />
        <circle cx="215" cy="70" r="1.5" fill="rgba(220,180,255,0.8)" filter="url(#lyraStarGlow)" />
        <circle cx="22" cy="85" r="1" fill="rgba(255,230,255,0.6)" />
        <circle cx="195" cy="110" r="1" fill="rgba(200,180,255,0.7)" />
        <circle cx="185" cy="220" r="1.5" fill="rgba(200,160,255,0.6)" filter="url(#lyraStarGlow)" />
        <ellipse cx="120" cy="178" rx="70" ry="80" fill="url(#lyraBody)" />
        <circle cx="120" cy="108" r="64" fill="#1e1030" />
        <ellipse cx="80" cy="68" rx="20" ry="36" fill="#2a1840" transform="rotate(-15 80 68)" />
        <ellipse cx="80" cy="68" rx="12" ry="26" fill="#4a2060" transform="rotate(-15 80 68)" />
        <ellipse cx="80" cy="68" rx="6" ry="16" fill="rgba(255,150,220,0.3)" transform="rotate(-15 80 68)" />
        <ellipse cx="160" cy="68" rx="20" ry="36" fill="#2a1840" transform="rotate(15 160 68)" />
        <ellipse cx="160" cy="68" rx="12" ry="26" fill="#4a2060" transform="rotate(15 160 68)" />
        <ellipse cx="160" cy="68" rx="6" ry="16" fill="rgba(255,150,220,0.3)" transform="rotate(15 160 68)" />
        <path d="M104 52 Q96 32 88 18 M88 18 Q80 8 74 12 M88 18 Q84 6 94 2" stroke="rgba(220,180,255,0.9)" stroke-width="3" stroke-linecap="round" fill="none" filter="url(#lyraAntlerGlow)" />
        <path d="M136 52 Q144 32 152 18 M152 18 Q160 8 166 12 M152 18 Q156 6 146 2" stroke="rgba(220,180,255,0.9)" stroke-width="3" stroke-linecap="round" fill="none" filter="url(#lyraAntlerGlow)" />
        <circle cx="74" cy="12" r="3" fill="rgba(255,220,255,0.9)" filter="url(#lyraStarGlow)" />
        <circle cx="94" cy="2" r="2.5" fill="rgba(255,200,240,0.8)" filter="url(#lyraStarGlow)" />
        <circle cx="166" cy="12" r="3" fill="rgba(255,220,255,0.9)" filter="url(#lyraStarGlow)" />
        <circle cx="146" cy="2" r="2.5" fill="rgba(255,200,240,0.8)" filter="url(#lyraStarGlow)" />
        <ellipse cx="120" cy="116" rx="38" ry="32" fill="#281848" />
        <circle cx="103" cy="112" r="11" fill="url(#lyraEye)" />
        <circle cx="137" cy="112" r="11" fill="url(#lyraEye)" />
        <circle cx="103" cy="112" r="5" fill="#0a0418" />
        <circle cx="137" cy="112" r="5" fill="#0a0418" />
        <circle cx="100" cy="109" r="3.5" fill="rgba(255,255,255,0.8)" />
        <circle cx="134" cy="109" r="3.5" fill="rgba(255,255,255,0.8)" />
        <circle cx="103" cy="112" r="14" fill="rgba(255,100,200,0.12)" filter="url(#lyraHeartGlow)" />
        <circle cx="137" cy="112" r="14" fill="rgba(255,100,200,0.12)" filter="url(#lyraHeartGlow)" />
        <ellipse cx="120" cy="128" rx="18" ry="13" fill="#3a2050" />
        <ellipse cx="120" cy="124" rx="4" ry="3" fill="rgba(255,150,200,0.8)" />
        <path d="M115 130 Q120 134 125 130" stroke="rgba(200,100,160,0.8)" stroke-width="1.5" stroke-linecap="round" fill="none" />
        <ellipse cx="120" cy="192" rx="46" ry="40" fill="url(#lyraCoat)" />
        <ellipse cx="120" cy="188" rx="28" ry="26" fill="url(#lyraHeart)" filter="url(#lyraHeartGlow)" />
        <path d="M120 204 Q106 190 106 180 Q106 170 115 170 Q120 170 120 175 Q120 170 125 170 Q134 170 134 180 Q134 190 120 204Z" fill="rgba(255,130,200,0.75)" filter="url(#lyraHeartGlow)" />
        <path d="M74 250 Q92 228 120 222 Q148 228 166 250" fill="rgba(42,16,64,0.6)" />
      </svg>
    `;
  }

  if (name === "Raien") {
    // Raien: dark charcoal wolf-cat, amber/orange eyes, electric blue lightning cracks on chest
    return `
      <svg viewBox="0 0 240 300" role="img" aria-label="Portrait of Raien">
        <defs>
          <radialGradient id="raienBody" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#2a2a36" />
            <stop offset="70%" stop-color="#1a1a24" />
            <stop offset="100%" stop-color="#0e0e18" />
          </radialGradient>
          <radialGradient id="raienEyeL" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#ffcc44" />
            <stop offset="50%" stop-color="#f5a623" />
            <stop offset="100%" stop-color="#c07010" />
          </radialGradient>
          <radialGradient id="raienEyeR" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#ffcc44" />
            <stop offset="50%" stop-color="#f5a623" />
            <stop offset="100%" stop-color="#c07010" />
          </radialGradient>
          <filter id="raienGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <!-- Dark ambient -->
        <circle cx="120" cy="140" r="108" fill="rgba(20,20,32,0.6)" />
        <!-- Body -->
        <ellipse cx="120" cy="180" rx="72" ry="80" fill="url(#raienBody)" />
        <!-- Head -->
        <circle cx="120" cy="108" r="66" fill="#222230" />
        <!-- Pointed ears -->
        <path d="M78 62 L62 18 L96 48Z" fill="#1e1e2c" />
        <path d="M78 62 L66 26 L92 50Z" fill="#2a2a3a" />
        <path d="M162 62 L178 18 L144 48Z" fill="#1e1e2c" />
        <path d="M162 62 L174 26 L148 50Z" fill="#2a2a3a" />
        <!-- Face -->
        <ellipse cx="120" cy="116" rx="40" ry="34" fill="#282838" />
        <!-- Amber eyes -->
        <circle cx="102" cy="110" r="11" fill="url(#raienEyeL)" />
        <circle cx="138" cy="110" r="11" fill="url(#raienEyeR)" />
        <circle cx="102" cy="110" r="5" fill="#0a0a14" />
        <circle cx="138" cy="110" r="5" fill="#0a0a14" />
        <circle cx="99" cy="107" r="3" fill="rgba(255,255,255,0.6)" />
        <circle cx="135" cy="107" r="3" fill="rgba(255,255,255,0.6)" />
        <!-- Amber eye glow -->
        <circle cx="102" cy="110" r="13" fill="rgba(245,166,35,0.15)" filter="url(#raienGlow)" />
        <circle cx="138" cy="110" r="13" fill="rgba(245,166,35,0.15)" filter="url(#raienGlow)" />
        <!-- Nose -->
        <ellipse cx="120" cy="126" rx="5" ry="3.5" fill="#0e0e18" />
        <!-- Mouth -->
        <path d="M114 131 Q120 135 126 131" stroke="#3a3a4a" stroke-width="1.5" stroke-linecap="round" fill="none" />
        <!-- Chest fur -->
        <ellipse cx="120" cy="195" rx="46" ry="40" fill="#202030" />
        <!-- Electric blue lightning cracks -->
        <path d="M112 168 L118 182 L110 188 L120 205" stroke="rgba(74,158,255,0.85)" stroke-width="2.5" stroke-linecap="round" fill="none" filter="url(#raienGlow)" />
        <path d="M128 172 L122 186 L132 192 L124 208" stroke="rgba(74,158,255,0.65)" stroke-width="2" stroke-linecap="round" fill="none" filter="url(#raienGlow)" />
        <path d="M108 178 L114 190" stroke="rgba(74,158,255,0.45)" stroke-width="1.5" stroke-linecap="round" fill="none" />
        <!-- Lightning ambient glow -->
        <ellipse cx="120" cy="188" rx="30" ry="22" fill="rgba(74,158,255,0.06)" filter="url(#raienGlow)" />
        <!-- Fur texture -->
        <path d="M72 248 Q90 228 120 224 Q150 228 168 248" fill="rgba(30,30,44,0.5)" />
      </svg>
    `;
  }

  if (name === "Kairo") {
    // Kairo: deep navy blue fox, teal/cyan eyes, cream chest, golden star-point tail tip
    return `
      <svg viewBox="0 0 240 300" role="img" aria-label="Portrait of Kairo">
        <defs>
          <radialGradient id="kairoBody" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stop-color="#1a3060" />
            <stop offset="60%" stop-color="#0e1e48" />
            <stop offset="100%" stop-color="#060e28" />
          </radialGradient>
          <radialGradient id="kairoEye" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stop-color="#80ffe8" />
            <stop offset="45%" stop-color="#4ecdc4" />
            <stop offset="100%" stop-color="#1a8080" />
          </radialGradient>
          <radialGradient id="kairoChest" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#e8d8b8" />
            <stop offset="100%" stop-color="#c8b898" />
          </radialGradient>
          <filter id="kairoGlow">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="kairoStarGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <!-- Deep space ambient -->
        <circle cx="120" cy="140" r="110" fill="rgba(6,14,40,0.5)" />
        <!-- Star field -->
        <circle cx="48" cy="44" r="1.5" fill="rgba(255,255,255,0.6)" />
        <circle cx="188" cy="36" r="1" fill="rgba(255,255,255,0.5)" />
        <circle cx="200" cy="72" r="1.5" fill="rgba(78,205,196,0.7)" />
        <circle cx="36" cy="88" r="1" fill="rgba(255,255,255,0.4)" />
        <circle cx="176" cy="56" r="1" fill="rgba(242,219,160,0.6)" />
        <!-- Body -->
        <ellipse cx="120" cy="178" rx="70" ry="78" fill="url(#kairoBody)" />
        <!-- Head -->
        <circle cx="120" cy="108" r="64" fill="#142050" />
        <!-- Fox ears -->
        <path d="M76 64 L58 14 L100 52Z" fill="#0e1840" />
        <path d="M76 64 L62 20 L96 54Z" fill="#1a2860" />
        <path d="M164 64 L182 14 L140 52Z" fill="#0e1840" />
        <path d="M164 64 L178 20 L144 54Z" fill="#1a2860" />
        <!-- Ear inner cream -->
        <path d="M76 62 L64 24 L94 52Z" fill="rgba(200,180,140,0.3)" />
        <path d="M164 62 L176 24 L146 52Z" fill="rgba(200,180,140,0.3)" />
        <!-- Face -->
        <ellipse cx="120" cy="116" rx="40" ry="34" fill="#182458" />
        <!-- Cream muzzle -->
        <ellipse cx="120" cy="128" rx="24" ry="18" fill="url(#kairoChest)" />
        <!-- Teal eyes -->
        <circle cx="102" cy="108" r="11" fill="url(#kairoEye)" />
        <circle cx="138" cy="108" r="11" fill="url(#kairoEye)" />
        <circle cx="102" cy="108" r="5" fill="#040c20" />
        <circle cx="138" cy="108" r="5" fill="#040c20" />
        <circle cx="99" cy="105" r="3" fill="rgba(255,255,255,0.75)" />
        <circle cx="135" cy="105" r="3" fill="rgba(255,255,255,0.75)" />
        <!-- Teal eye glow -->
        <circle cx="102" cy="108" r="14" fill="rgba(78,205,196,0.12)" filter="url(#kairoGlow)" />
        <circle cx="138" cy="108" r="14" fill="rgba(78,205,196,0.12)" filter="url(#kairoGlow)" />
        <!-- Nose -->
        <ellipse cx="120" cy="124" rx="4" ry="3" fill="#060e28" />
        <!-- Cream chest -->
        <ellipse cx="120" cy="195" rx="44" ry="38" fill="url(#kairoChest)" />
        <!-- Gold star constellation on chest -->
        <circle cx="120" cy="190" r="3" fill="rgba(242,219,160,0.9)" filter="url(#kairoStarGlow)" />
        <path d="M120 184 L121.5 188 L126 188 L122.5 190.5 L124 195 L120 192.5 L116 195 L117.5 190.5 L114 188 L118.5 188Z" fill="rgba(242,219,160,0.7)" />
        <!-- Constellation lines -->
        <line x1="120" y1="190" x2="104" y2="178" stroke="rgba(242,219,160,0.3)" stroke-width="1" />
        <line x1="120" y1="190" x2="136" y2="178" stroke="rgba(242,219,160,0.3)" stroke-width="1" />
        <circle cx="104" cy="178" r="2" fill="rgba(242,219,160,0.5)" />
        <circle cx="136" cy="178" r="2" fill="rgba(242,219,160,0.5)" />
        <!-- Fur base -->
        <path d="M70 248 Q90 226 120 222 Q150 226 170 248" fill="rgba(14,28,64,0.6)" />
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 240 300" role="img" aria-label="Spiritkin portrait">
      <circle cx="120" cy="120" r="96" fill="rgba(184,166,255,.18)" />
      <ellipse cx="120" cy="140" rx="56" ry="66" fill="#e6def8" />
      <path d="M65 252c12-32 31-51 55-60 11 8 23 11 36 11 15 0 29-4 39-11 24 9 42 29 56 60" fill="rgba(184,166,255,.22)" />
    </svg>
  `;
}

function getSpiritkinPortraitPath(name) {
  const authority = getSpiritkinMediaAuthority(name);
  if (authority.portrait) return authority.portrait;
  const portraitMap = {
    "Lyra": "/portraits/lyra_portrait.png",
    "Raien": "/portraits/raien_portrait.png",
    "Kairo": "/portraits/kairo_portrait.png",
  };
  return portraitMap[name] || "";
}

function isSpiritkinSpeechActive(name) {
  const activeName = state.selectedSpiritkin?.name || state.primarySpiritkin?.name || null;
  if (!name || !activeName || activeName !== name) return false;
  const speechState = state.sessionModel?.speechState || {};
  return !!(_audioPlaying || (speechState.isSpeaking && speechState.turnPhase === "spirit_response"));
}

function buildPortrait(name, cls, size) {
  const portraitPath = getSpiritkinPortraitPath(name);
  const eagerPortrait = size === "portrait-card" || size === "portrait-focus" || size === "portrait-hero";
  const speakingCls = isSpiritkinSpeechActive(name) ? "is-speaking" : "";

  const portraitContent = portraitPath 
    ? `
      <div class="portrait-fallback-svg">${portraitSvg(name)}</div>
      <img
        src="${portraitPath}"
        alt="Portrait of ${name}"
        class="portrait-image"
        loading="${eagerPortrait ? "eager" : "lazy"}"
        decoding="async"
        ${eagerPortrait ? 'fetchpriority="high"' : ""}
        onload="this.classList.add('is-loaded'); this.parentElement.classList.add('portrait-loaded');"
        onerror="this.style.display='none'; this.parentElement.classList.add('portrait-fallback-only');"
      />
    `
    : portraitSvg(name);
  return `
    <div class="portrait-frame ${portraitPath ? "has-remote-image" : ""} ${speakingCls} ${esc(cls)} ${esc(size)}">
      <div class="portrait-backdrop"></div>
      <div class="portrait-art">${portraitContent}</div>
    </div>
  `;
}

function buildSigil(meta, variant, label) {
  return `
    <div class="spirit-sigil ${esc(meta.cls)} ${esc(variant)}" aria-hidden="true">
      <span>${esc(label || meta.symbol)}</span>
    </div>
  `;
}

function hydrateSpiritkin(raw) {
  return { ...raw, ui: getMeta(raw.name) };
}

function normalizeStoredSpiritkin(raw) {
  return raw?.name ? hydrateSpiritkin(raw) : null;
}

function buildFoundingPillarRecord(name) {
  const meta = getMeta(name);
  return hydrateSpiritkin({
    id: `founding-pillar:${name.toLowerCase()}`,
    name,
    title: meta.title || meta.strap,
    role: meta.role || meta.bondLine,
    essence: [meta.mood, meta.ambient, meta.realm].filter(Boolean),
    invariant: meta.bondLine,
    tone: meta.mood,
    is_canon: true,
    is_founding_pillar: true
  });
}

function mergeFoundingPillars(spiritkins) {
  const merged = [];
  const seen = new Set();
  [...(spiritkins || []), ...FOUNDING_PILLARS.map(buildFoundingPillarRecord)].forEach((spiritkin) => {
    if (!spiritkin?.name || seen.has(spiritkin.name)) return;
    seen.add(spiritkin.name);
    merged.push(hydrateSpiritkin({
      ...buildFoundingPillarRecord(spiritkin.name),
      ...spiritkin,
      is_canon: spiritkin.is_canon !== false,
      is_founding_pillar: FOUNDING_PILLARS.includes(spiritkin.name)
    }));
  });
  return merged.filter((spiritkin) => FOUNDING_PILLARS.includes(spiritkin.name));
}

function buildFounderEnsemblePanel(kind = "entry") {
  const title = kind === "home" ? "The Five Founding Pillars" : "Five Founding Pillars";
  const sub = kind === "home"
    ? "The original sovereign companions remain visible across the realm, even when one bond stands at the center."
    : "The original sovereign companions of the Spiritverse hold the first five axes of memory, courage, wonder, truth, and depth.";
  return `
    <div class="founder-ensemble-panel ${esc(kind)}">
      ${buildCompositeVisualFrame(
        canonicalWorldAssetUrl(WORLD_ART.ensemble),
        COMPOSITE_VISUAL_ASSETS.spiritcore.founders,
        "The Five Founding Pillars gathered within the Spiritverse",
        `founder-ensemble-art ${kind}`,
        kind === "entry",
        { fallbackMode: "errorOnly", debugSlot: `founder-ensemble-${kind}` }
      )}
      <div class="founder-ensemble-copy">
        <div class="panel-label">${title}</div>
        <p>${sub}</p>
      </div>
    </div>
  `;
}

function buildChronicleShelf(title = "Spiritverse Chronicles", filename = WORLD_ART.chroniclesAll, description = "The founders and their realms are preserved in the living chronicle of the Spiritverse.") {
  return `
    <div class="chronicle-shelf">
      ${worldArtImage(filename, title, "chronicle-shelf-art")}
      <div class="chronicle-shelf-copy">
        <div class="panel-label">${esc(title)}</div>
        <p>${esc(description)}</p>
      </div>
    </div>
  `;
}

function buildCompositeVisualFrame(primarySrc, fallbackSrc, alt, cls = "", eager = false, options = {}) {
  if (!primarySrc) return "";
  const fallbackMode = options?.fallbackMode === "errorOnly" ? "errorOnly" : "immediate";
  const debugSlot = typeof options?.debugSlot === "string" ? options.debugSlot : "";
  const debugAttr = debugSlot ? ` data-media-slot="${esc(debugSlot)}"` : "";
  const fallbackClass = fallbackMode === "errorOnly" ? " fallback-error-only" : "";
  const onLoad = debugSlot
    ? `this.classList.add('is-loaded'); this.parentElement.classList.add('visual-loaded'); console.info('[MediaAuthority]', { slot: '${esc(debugSlot)}', primary: this.currentSrc || this.src, fallback: '${esc(fallbackSrc || "")}', event: 'primary-loaded' });`
    : `this.classList.add('is-loaded'); this.parentElement.classList.add('visual-loaded');`;
  const onError = debugSlot
    ? `this.style.display='none'; this.parentElement.classList.add('visual-fallback-only'); console.warn('[MediaAuthority]', { slot: '${esc(debugSlot)}', primary: this.currentSrc || this.src, fallback: '${esc(fallbackSrc || "")}', event: 'primary-error-fallback' });`
    : `this.style.display='none'; this.parentElement.classList.add('visual-fallback-only');`;
  return `
    <div class="composite-visual-frame ${esc(cls)} ${fallbackSrc ? "has-fallback" : ""}"${debugAttr}>
      ${fallbackSrc ? `<img src="${fallbackSrc}" alt="${esc(alt)}" class="composite-visual-image composite-visual-fallback${fallbackClass}" loading="${eager ? "eager" : "lazy"}" decoding="async" ${eager ? 'fetchpriority="high"' : ""} />` : ""}
      <img
        src="${primarySrc}"
        alt="${esc(alt)}"
        class="composite-visual-image composite-visual-primary"
        loading="${eager ? "eager" : "lazy"}"
        decoding="async"
        ${eager ? 'fetchpriority="high"' : ""}
        onload="${onLoad}"
        onerror="${onError}"
      />
    </div>
  `;
}

function buildSpiritkinMediaPanel(name, surface = "focus") {
  const authority = getSpiritkinMediaAuthority(name);
  const primarySrc =
    (surface === "card" ? authority.founderCard
      : surface === "profile" ? authority.profile
      : surface === "bonded" ? authority.bonded
      : authority.focus) ||
    COMPOSITE_VISUAL_ASSETS.spiritkins[name]?.[surface] ||
    "";
  if (!primarySrc) return "";
  const fallbackPortrait = authority.fallbackCard || getSpiritkinPortraitPath(name);
  const speakingCls = isSpiritkinSpeechActive(name) ? "is-speaking" : "";
  return buildCompositeVisualFrame(
    primarySrc,
    fallbackPortrait,
    `${name} visual panel`,
    `spiritkin-media-panel ${surface} ${speakingCls}`,
    surface !== "card",
    { fallbackMode: "errorOnly", debugSlot: `${name}-${surface}` }
  );
}

function buildSpiritkinCanonPanel(name, cls = "profile-canon-art") {
  const authority = getSpiritkinMediaAuthority(name);
  const primarySrc = authority.canonSupplement || authority.fallbackCard || authority.profile || authority.focus || "";
  if (!primarySrc) return "";
  return buildCompositeVisualFrame(
    primarySrc,
    getSpiritkinPortraitPath(name),
    `${name} canon panel`,
    cls,
    false,
    { fallbackMode: "errorOnly", debugSlot: `${name}-canon` }
  );
}

function buildCompanionPresenceDock(spiritkin) {
  if (!spiritkin?.ui) return "";
  const meta = spiritkin.ui;
  const speaking = isSpiritkinSpeechActive(spiritkin.name);
  return `
    <div class="companion-presence-dock ${esc(meta.cls)} ${speaking ? "is-speaking" : ""}">
      <div class="companion-presence-visual">
        ${buildSpiritkinMediaPanel(spiritkin.name, "card")}
        ${buildPortrait(spiritkin.name, `companion-dock-portrait ${meta.cls}`, "portrait-mini")}
      </div>
      <div class="companion-presence-copy">
        <div class="companion-presence-label">${speaking ? `${esc(spiritkin.name)} speaking` : `${esc(spiritkin.name)} present`}</div>
        <strong>${esc(spiritkin.title || spiritkin.role || meta.strap)}</strong>
        <span>${esc(meta.atmosphereLine || meta.realm)}</span>
      </div>
    </div>
  `;
}

function getAtmosphereSpiritkin() {
  return state.primarySpiritkin || state.pendingBondSpiritkin || state.selectedSpiritkin || null;
}

function createDefaultAdaptiveProfile() {
  return {
    version: 1,
    toneStyle: "grounded",
    intensity: 0.45,
    playfulness: 0.32,
    competitiveness: 0.28,
    repetitionSensitivity: 0.25,
    respectPreference: 0.5,
    spiritualityPreference: 0.25,
    correctionFlags: {
      avoidRepetition: false,
      avoidNarration: false,
      avoidProfanity: false,
      avoidTeasing: false
    },
    dislikedPhrases: [],
    blockedOpeners: [],
    recentCorrections: [],
    recentAssistantOpeners: [],
    recentAssistantPhrases: []
  };
}

const SPIRITKIN_EVOLUTION_DEFAULTS = {
  Lyra: { warmth: 0.84, challenge: 0.18, reverence: 0.46, wonder: 0.34 },
  Raien: { warmth: 0.36, challenge: 0.84, reverence: 0.24, wonder: 0.22 },
  Kairo: { warmth: 0.48, challenge: 0.34, reverence: 0.28, wonder: 0.88 },
  Elaria: { warmth: 0.52, challenge: 0.58, reverence: 0.76, wonder: 0.26 },
  Thalassar: { warmth: 0.62, challenge: 0.36, reverence: 0.58, wonder: 0.42 }
};

function clampEvolution(value, fallback = 0.2) {
  return clamp01(value, fallback);
}

function easeToward(current, target, factor = 0.18) {
  const from = clampEvolution(current, target);
  const to = clampEvolution(target, from);
  return clampEvolution(from + ((to - from) * factor), from);
}

function createDefaultSpiritkinEvolution(spiritkinName = "") {
  const base = SPIRITKIN_EVOLUTION_DEFAULTS[spiritkinName] || SPIRITKIN_EVOLUTION_DEFAULTS.Lyra;
  return {
    version: 1,
    spiritkinName,
    depth: 0.18,
    confidence: 0.22,
    trust: 0.2,
    warmth: base.warmth,
    challenge: base.challenge,
    reverence: base.reverence,
    wonder: base.wonder,
    userShape: "grounded-presence",
    styleShift: "steadying",
    growthPhase: "opening",
    totalUserMessages: 0,
    totalAssistantMessages: 0,
    gamesTogether: 0,
    bondStagePeak: 0,
    resonancePeak: 0,
    lastUpdatedAt: null
  };
}

function normalizeSpiritkinEvolutionProfile(raw, spiritkinName = "") {
  const base = createDefaultSpiritkinEvolution(spiritkinName);
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    ...base,
    spiritkinName: spiritkinName || String(source.spiritkinName || base.spiritkinName || ""),
    depth: clampEvolution(source.depth, base.depth),
    confidence: clampEvolution(source.confidence, base.confidence),
    trust: clampEvolution(source.trust, base.trust),
    warmth: clampEvolution(source.warmth, base.warmth),
    challenge: clampEvolution(source.challenge, base.challenge),
    reverence: clampEvolution(source.reverence, base.reverence),
    wonder: clampEvolution(source.wonder, base.wonder),
    userShape: typeof source.userShape === "string" && source.userShape.trim() ? source.userShape.trim() : base.userShape,
    styleShift: typeof source.styleShift === "string" && source.styleShift.trim() ? source.styleShift.trim() : base.styleShift,
    growthPhase: typeof source.growthPhase === "string" && source.growthPhase.trim() ? source.growthPhase.trim() : base.growthPhase,
    totalUserMessages: clampInt(source.totalUserMessages, base.totalUserMessages),
    totalAssistantMessages: clampInt(source.totalAssistantMessages, base.totalAssistantMessages),
    gamesTogether: clampInt(source.gamesTogether, base.gamesTogether),
    bondStagePeak: clampInt(source.bondStagePeak, base.bondStagePeak),
    resonancePeak: clampInt(source.resonancePeak, base.resonancePeak),
    lastUpdatedAt: typeof source.lastUpdatedAt === "string" ? source.lastUpdatedAt : null
  };
}

function normalizeSpiritkinEvolutionStore(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const bySpiritkin = source.bySpiritkin && typeof source.bySpiritkin === "object" ? source.bySpiritkin : {};
  return {
    version: 1,
    bySpiritkin: Object.fromEntries(
      Object.entries(bySpiritkin).map(([name, profile]) => [name, normalizeSpiritkinEvolutionProfile(profile, name)])
    )
  };
}

function readSpiritkinEvolutionStore() {
  return normalizeSpiritkinEvolutionStore(readJson(SPIRITKIN_EVOLUTION_KEY, null));
}

function persistSpiritkinEvolutionStore(store) {
  writeJson(SPIRITKIN_EVOLUTION_KEY, normalizeSpiritkinEvolutionStore(store));
}

function deriveEvolutionUserShape(profile, spiritkinName = "") {
  if ((profile.spiritualityPreference || 0) > 0.7 || (profile.respectPreference || 0) > 0.72) return "reverent-clarity";
  if ((profile.playfulness || 0) > 0.64 && (profile.competitiveness || 0) > 0.58) return spiritkinName === "Raien" ? "spirited-challenge" : "playful-challenge";
  if ((profile.playfulness || 0) > 0.62) return "lighter-play";
  if ((profile.intensity || 0) > 0.68) return "sharpened-directness";
  if ((profile.respectPreference || 0) > 0.6) return "measured-care";
  return "grounded-presence";
}

function deriveEvolutionShiftLabel(evolution) {
  if ((evolution.depth || 0) > 0.72 && (evolution.trust || 0) > 0.66) return "deepened shorthand";
  if ((evolution.confidence || 0) > 0.68 && (evolution.challenge || 0) > 0.62) return "clearer edge";
  if ((evolution.reverence || 0) > 0.68) return "sacred gravity";
  if ((evolution.wonder || 0) > 0.7) return "wider wonder";
  if ((evolution.warmth || 0) > 0.72) return "steadier warmth";
  return "steadying";
}

function deriveEvolutionPhase(evolution) {
  const signal = ((evolution.depth || 0) * 0.4) + ((evolution.trust || 0) * 0.3) + ((evolution.confidence || 0) * 0.3);
  if (signal > 0.76) return "bonded-distinctness";
  if (signal > 0.58) return "settled-shape";
  if (signal > 0.38) return "growing-definition";
  return "opening";
}

function getSpiritkinEvolutionProfile(spiritkinName = state.primarySpiritkin?.name || state.selectedSpiritkin?.name || "") {
  if (!spiritkinName) return normalizeSpiritkinEvolutionProfile(null, "");
  const store = readSpiritkinEvolutionStore();
  return normalizeSpiritkinEvolutionProfile(store.bySpiritkin?.[spiritkinName], spiritkinName);
}

function updateSpiritkinEvolution(spiritkinName, signals = {}) {
  if (!spiritkinName) return null;
  const store = readSpiritkinEvolutionStore();
  const adaptive = normalizeAdaptiveProfile(state.adaptiveProfile);
  const current = normalizeSpiritkinEvolutionProfile(store.bySpiritkin?.[spiritkinName], spiritkinName);
  const resonance = readJson(RESONANCE_KEY, {});
  const resonanceCount = clampInt(resonance[spiritkinName], 0);
  const bondStage = state.primarySpiritkin?.name === spiritkinName
    ? (state.bondJournal?.bondStage ?? getBondStageForCount(resonanceCount))
    : getBondStageForCount(resonanceCount);
  const gamesCompleted = state.primarySpiritkin?.name === spiritkinName ? clampInt(state.bondJournal?.gamesCompleted, 0) : 0;
  const visitDays = Array.isArray(state.retentionTelemetry?.visitDays) ? state.retentionTelemetry.visitDays : [];

  const next = { ...current };
  next.totalUserMessages += signals.userText ? 1 : 0;
  next.totalAssistantMessages += signals.assistantText ? 1 : 0;
  next.gamesTogether = Math.max(next.gamesTogether, gamesCompleted);
  next.bondStagePeak = Math.max(next.bondStagePeak, bondStage);
  next.resonancePeak = Math.max(next.resonancePeak, resonanceCount);

  const depthTarget = clampEvolution(0.18 + (bondStage * 0.13) + Math.min(0.2, resonanceCount / 240) + Math.min(0.08, next.totalUserMessages / 120));
  const confidenceTarget = clampEvolution(0.2 + (bondStage * 0.1) + (adaptive.intensity * 0.16) + (adaptive.competitiveness * 0.08) + Math.min(0.08, gamesCompleted / 18));
  const trustTarget = clampEvolution(0.18 + (bondStage * 0.11) + Math.min(0.14, getVisitStreakDays(visitDays) / 20) + Math.min(0.12, next.totalAssistantMessages / 120));
  const warmthTarget = clampEvolution((SPIRITKIN_EVOLUTION_DEFAULTS[spiritkinName]?.warmth || 0.5) + ((adaptive.respectPreference - 0.5) * 0.25));
  const challengeTarget = clampEvolution((SPIRITKIN_EVOLUTION_DEFAULTS[spiritkinName]?.challenge || 0.4) + ((adaptive.competitiveness - 0.35) * 0.3));
  const reverenceTarget = clampEvolution((SPIRITKIN_EVOLUTION_DEFAULTS[spiritkinName]?.reverence || 0.3) + ((adaptive.spiritualityPreference - 0.25) * 0.35));
  const wonderTarget = clampEvolution((SPIRITKIN_EVOLUTION_DEFAULTS[spiritkinName]?.wonder || 0.3) + ((adaptive.playfulness - 0.32) * 0.14) + ((adaptive.intensity < 0.42 ? 0.06 : 0)));

  next.depth = easeToward(next.depth, depthTarget, 0.2);
  next.confidence = easeToward(next.confidence, confidenceTarget, 0.18);
  next.trust = easeToward(next.trust, trustTarget, 0.18);
  next.warmth = easeToward(next.warmth, warmthTarget, 0.14);
  next.challenge = easeToward(next.challenge, challengeTarget, 0.14);
  next.reverence = easeToward(next.reverence, reverenceTarget, 0.14);
  next.wonder = easeToward(next.wonder, wonderTarget, 0.14);
  next.userShape = deriveEvolutionUserShape(adaptive, spiritkinName);
  next.styleShift = deriveEvolutionShiftLabel(next);
  next.growthPhase = deriveEvolutionPhase(next);
  next.lastUpdatedAt = nowIso();

  store.bySpiritkin[spiritkinName] = next;
  persistSpiritkinEvolutionStore(store);
  return next;
}

function buildEvolutionDescriptor(spiritkin) {
  const spiritkinName = spiritkin?.name || state.primarySpiritkin?.name || "";
  if (!spiritkinName) return null;
  const evolution = getSpiritkinEvolutionProfile(spiritkinName);
  const bondStage = state.bondJournal?.bondStage ?? getBondStageForCount(clampInt(readJson(RESONANCE_KEY, {})[spiritkinName], 0));
  const axis = spiritkin?.growth_axis || spiritkin?.ui?.bondLine || "bonded presence";
  const shapeMap = {
    "grounded-presence": "grounded presence",
    "reverent-clarity": "reverent clarity",
    "playful-challenge": "playful challenge",
    "spirited-challenge": "spirited challenge",
    "lighter-play": "lighter play",
    "sharpened-directness": "sharpened directness",
    "measured-care": "measured care"
  };
  return {
    phase: evolution.growthPhase,
    phaseLabel: evolution.growthPhase.replace(/-/g, " "),
    styleShift: evolution.styleShift,
    bondStage,
    axis,
    userShape: shapeMap[evolution.userShape] || evolution.userShape.replace(/-/g, " "),
    confidence: evolution.confidence,
    depth: evolution.depth,
    trust: evolution.trust,
    summary: `${spiritkinName}'s core identity remains intact, but with you it is taking on ${shapeMap[evolution.userShape] || evolution.userShape.replace(/-/g, " ")} and ${evolution.styleShift}.`
  };
}

function normalizeAdaptiveProfile(raw) {
  const base = createDefaultAdaptiveProfile();
  const source = raw && typeof raw === "object" ? raw : {};
  const flags = source.correctionFlags && typeof source.correctionFlags === "object" ? source.correctionFlags : {};
  return {
    ...base,
    toneStyle: typeof source.toneStyle === "string" && source.toneStyle.trim() ? source.toneStyle.trim() : base.toneStyle,
    intensity: clamp01(source.intensity, base.intensity),
    playfulness: clamp01(source.playfulness, base.playfulness),
    competitiveness: clamp01(source.competitiveness, base.competitiveness),
    repetitionSensitivity: clamp01(source.repetitionSensitivity, base.repetitionSensitivity),
    respectPreference: clamp01(source.respectPreference, base.respectPreference),
    spiritualityPreference: clamp01(source.spiritualityPreference, base.spiritualityPreference),
    correctionFlags: {
      avoidRepetition: Boolean(flags.avoidRepetition),
      avoidNarration: Boolean(flags.avoidNarration),
      avoidProfanity: Boolean(flags.avoidProfanity),
      avoidTeasing: Boolean(flags.avoidTeasing)
    },
    dislikedPhrases: normalizePhraseList(source.dislikedPhrases),
    blockedOpeners: normalizePhraseList(source.blockedOpeners),
    recentCorrections: (Array.isArray(source.recentCorrections) ? source.recentCorrections : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .slice(-6),
    recentAssistantOpeners: normalizePhraseList(source.recentAssistantOpeners, 6),
    recentAssistantPhrases: normalizePhraseList(source.recentAssistantPhrases, 10)
  };
}

function persistAdaptiveProfile() {
  writeJson(ADAPTIVE_PROFILE_KEY, state.adaptiveProfile);
}

function mergeUniqueStrings(list, additions, limit = 8) {
  return normalizePhraseList([...(Array.isArray(list) ? list : []), ...(Array.isArray(additions) ? additions : [])], limit);
}

function extractQuotedPhrases(text) {
  return [...String(text || "").matchAll(/["“”']([^"“”']{2,80})["“”']/g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
}

function extractOpeningSignature(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
}

function inferToneStyleFromProfile(profile) {
  if ((profile.spiritualityPreference || 0) > 0.7 || (profile.respectPreference || 0) > 0.7) return "reverent";
  if ((profile.playfulness || 0) > 0.64 && (profile.competitiveness || 0) > 0.56) return "playful-competitive";
  if ((profile.playfulness || 0) > 0.62) return "playful";
  if ((profile.intensity || 0) > 0.68) return "direct";
  if ((profile.respectPreference || 0) > 0.58) return "respectful";
  return "grounded";
}

function updateAdaptiveProfileFromUserText(text) {
  const input = String(text || "").trim();
  if (!input) return;

  const lower = input.toLowerCase();
  const profile = normalizeAdaptiveProfile(state.adaptiveProfile);

  const playfulHit = /\b(lol|lmao|haha|funny|tease|teasing|joking|banter|play around|messing with you)\b/.test(lower);
  const competitiveHit = /\b(win|beat me|beat you|smoke me|challenge|trash talk|competitive|don't go easy|come at me)\b/.test(lower);
  const calmHit = /\b(calm|gentle|soft|quiet|respectful|easy with me|be kind|please|thank you|appreciate)\b/.test(lower);
  const spiritualHit = /\b(god|lord|jesus|faith|prayer|pray|blessed|spiritual|church|scripture|sacred|holy|religious)\b/.test(lower);
  const highIntensityHit = /\b(now|seriously|really|straight up|for real|urgent|immediately)\b/.test(lower) || /!{2,}/.test(input);
  const lowIntensityHit = /\b(softly|gently|easy|slow down|not too much|quietly)\b/.test(lower);
  const repetitionHit = /\b(repeat|repeating|repetitive|same phrase|same thing|keep saying|again and again)\b/.test(lower);
  const narratorHit = /\b(stop narrating|don't narrate|less narrator|not like a narrator|don't describe the interface|don't sound like a system)\b/.test(lower);
  const profanityBoundaryHit = /\b(don't cuss|dont cuss|no profanity|don't swear|dont swear|keep it clean)\b/.test(lower);
  const teasingBoundaryHit = /\b(don't tease|dont tease|less teasing|don't be rude|dont be rude|not so cocky)\b/.test(lower);

  if (playfulHit) profile.playfulness = clamp01(profile.playfulness + 0.12, profile.playfulness);
  if (competitiveHit) profile.competitiveness = clamp01(profile.competitiveness + 0.14, profile.competitiveness);
  if (calmHit) profile.respectPreference = clamp01(profile.respectPreference + 0.12, profile.respectPreference);
  if (spiritualHit) {
    profile.spiritualityPreference = clamp01(profile.spiritualityPreference + 0.18, profile.spiritualityPreference);
    profile.respectPreference = clamp01(profile.respectPreference + 0.08, profile.respectPreference);
  }
  if (highIntensityHit) profile.intensity = clamp01(profile.intensity + 0.1, profile.intensity);
  if (lowIntensityHit) profile.intensity = clamp01(profile.intensity - 0.12, profile.intensity);
  if (repetitionHit) {
    profile.repetitionSensitivity = clamp01(profile.repetitionSensitivity + 0.22, profile.repetitionSensitivity);
    profile.correctionFlags.avoidRepetition = true;
    if (profile.recentAssistantOpeners[profile.recentAssistantOpeners.length - 1]) {
      profile.blockedOpeners = mergeUniqueStrings(profile.blockedOpeners, [profile.recentAssistantOpeners[profile.recentAssistantOpeners.length - 1]], 6);
    }
    profile.recentCorrections = [...profile.recentCorrections, "User objected to repeated phrasing."].slice(-6);
  }
  if (narratorHit) {
    profile.correctionFlags.avoidNarration = true;
    profile.recentCorrections = [...profile.recentCorrections, "User asked for less narrator-style delivery."].slice(-6);
  }
  if (profanityBoundaryHit) {
    profile.correctionFlags.avoidProfanity = true;
    profile.respectPreference = clamp01(profile.respectPreference + 0.12, profile.respectPreference);
    profile.recentCorrections = [...profile.recentCorrections, "User requested cleaner language."].slice(-6);
  }
  if (teasingBoundaryHit) {
    profile.correctionFlags.avoidTeasing = true;
    profile.recentCorrections = [...profile.recentCorrections, "User requested less teasing."].slice(-6);
  }

  const quotedPhrases = extractQuotedPhrases(input);
  const phraseMatch = lower.match(/(?:stop saying|don't say|dont say|don't call me|dont call me|i hate when you say)\s+([^.!?]{2,80})/i);
  const explicitPhrase = phraseMatch?.[1]?.trim();
  profile.dislikedPhrases = mergeUniqueStrings(profile.dislikedPhrases, [...quotedPhrases, explicitPhrase].filter(Boolean), 10);
  if (explicitPhrase) {
    profile.recentCorrections = [...profile.recentCorrections, `Avoid phrase: ${explicitPhrase}`].slice(-6);
  }

  profile.toneStyle = inferToneStyleFromProfile(profile);
  state.adaptiveProfile = profile;
  persistAdaptiveProfile();
  updateSpiritkinEvolution(state.primarySpiritkin?.name || state.selectedSpiritkin?.name, { userText: input });
}

function observeAssistantStyle(text) {
  const output = String(text || "").trim();
  if (!output) return;
  const profile = normalizeAdaptiveProfile(state.adaptiveProfile);
  const opener = extractOpeningSignature(output);
  const repeatedPhrases = [];
  const lower = output.toLowerCase();
  ["take your time", "i'm here", "you are not alone", "let us", "i see where this is going"].forEach((phrase) => {
    if (lower.includes(phrase)) repeatedPhrases.push(phrase);
  });
  if (opener) profile.recentAssistantOpeners = mergeUniqueStrings(profile.recentAssistantOpeners, [opener], 6);
  if (repeatedPhrases.length) profile.recentAssistantPhrases = mergeUniqueStrings(profile.recentAssistantPhrases, repeatedPhrases, 10);
  state.adaptiveProfile = profile;
  persistAdaptiveProfile();
  updateSpiritkinEvolution(state.primarySpiritkin?.name || state.selectedSpiritkin?.name, { assistantText: output });
}

function normalizeMessage(raw) {
  const tags = Array.isArray(raw?.tags) ? raw.tags.filter((tag) => typeof tag === "string") : [];
  const normalizedTime = normalizeTimestamp(raw?.time || raw?.created_at || raw?.timestamp || raw?.updated_at, "");
  return {
    ...raw,
    tags,
    time: normalizedTime,
    created_at: normalizedTime || null,
    memoryActive: tags.includes("memory:active"),
    emotionTone: sanitizeTone(raw?.emotionTone),
    sceneName: sanitizeScene(raw?.sceneName)
  };
}

let _bootSessionSeed = null;

function createDefaultSessionModel() {
  return {
    sessionId: null,
    userId: null,
    currentSpiritkin: null,
    currentSurface: "selection",
    currentMode: "idle",
    currentGame: null,
    gameState: null,
    conversationState: {
      conversationId: null,
      messageCount: 0,
      lastMessageRole: null,
      lastMessageAt: null,
    },
    speechState: {
      isSpeaking: false,
      isListening: false,
      isPaused: false,
      lastUtteranceId: null,
      turnPhase: "idle",
    },
    memoryContext: null,
    spiritCore: null,
    recentMessages: [],
    hydrated: false,
    source: "local-default",
  };
}

function normalizeTurnPhaseValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["idle", "user_input", "processing", "spirit_response", "complete"].includes(normalized)
    ? normalized
    : "idle";
}

function getStageSignals() {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const message = state.messages[index];
    if (message.role !== "assistant") continue;
    const emotionTone = formatSignal(sanitizeTone(message.emotionTone));
    const sceneName = formatSignal(sanitizeScene(message.sceneName));
    if (emotionTone || sceneName) {
      return { emotionTone, sceneName };
    }
  }
  return { emotionTone: "", sceneName: "" };
}

const state = {
  userId: getOrCreateUid(),
  sessionModel: createDefaultSessionModel(),
  entryAccepted: false,
  consentAccepted: !!(localStorage.getItem(CONSENT_KEY) || localStorage.getItem(ENTRY_KEY)),
  consentChecked: !!(localStorage.getItem(CONSENT_KEY) || localStorage.getItem(ENTRY_KEY)),
  crownGateOpening: false,
  entryVideoStarted: false,
  entryTransitioning: false,
  spiritverseTrailerActive: false,
  spiritCoreWelcoming: false,
  showCrownGateHome: false,
  showHomeView: false,
  userName: localStorage.getItem(NAME_KEY) || "",
  userNameDraft: localStorage.getItem(NAME_KEY) || "",
  spiritkins: [],
  loadingSpirits: false,
  spiritError: null,
  primarySpiritkin: normalizeStoredSpiritkin(readJson(PRIMARY_KEY, null)),
  selectedSpiritkin: null,
  pendingBondSpiritkin: null,
  rebondSpiritkin: null,
  conversationId: null,
  messages: [],
  loadingReply: false,
  loadingConv: false,
  convError: null,
  input: "",
  ratings: readJson(RATINGS_KEY, {}),
  statusText: "",
  statusError: false,
  mediaMuted: localStorage.getItem(MEDIA_MUTED_KEY) !== "0",
  voiceMuted: localStorage.getItem("sk_voice_muted") === "1",
  voiceListening: false,
  voiceMode: localStorage.getItem("sk_voice_mode") === "1", // Always-on mic mode
  voiceGuidanceDismissed: localStorage.getItem(VOICE_GUIDANCE_KEY) === "1",
  voiceTranscriptPreview: "",
  voicePermissionBlocked: false,
  pendingVoiceResume: false,
  // Premium: Custom Spiritkin Matching
  surveyOpen: false,
  surveyStep: 0,
  surveyAnswers: {},
  surveyGenerating: false,
  surveyError: null,
  generatedSpiritkin: null, // The AI-generated Spiritkin profile
  customSpiritkinRevealed: false, // Show reveal screen
  creatorDraftRestored: false,
  // Onboarding: 10-question guided flow
  onboardingStep: 0,           // 0=not started, 1-10=question, 11=recommendation
  onboardingAnswers: {},       // {q1: 'answer', q2: 'answer', ...}
  onboardingRecommendation: null, // {spiritkin: 'Lyra', reason: '...'}
  onboardingComplete: !!(localStorage.getItem(ONBOARDING_COMPLETE_KEY) || localStorage.getItem(ENTRY_KEY)),
  // Monetization
  tierModalOpen: false,
  // Engagement Engine state
  engagementWhisper: null,      // {text, type, spiritkinName} — returned on bootstrap
  engagementMilestones: [],     // [{label, icon}] — bond milestones to celebrate
  engagementEchoUnlocks: [],    // [{title, text}] — new echoes fragments unlocked
  engagementWellnessNudge: null,// {text} — wellness nudge if session is long
  showWhisperBanner: false,     // whether to show the whisper banner
  showEchoUnlock: false,        // whether to show the echoes unlock notification
  currentEchoUnlock: null,      // the echoes unlock to display
  activePresenceTab: "profile",  // profile, echoes, charter, games, journal
  pendingPresenceTab: null,
  bondJournal: null,              // loaded bond journal data
  // Game state
  activeGame: null,              // current active game object
  gameInput: "",                 // move input field value
  gameSpiritkinMessage: null,    // last Spiritkin commentary on a game move
  gameInstructions: null,        // instructions for the current game type
  gameHelpOpen: false,
  gameHelpFirstRun: false,
  gameHelpSeen: readJson(GAME_HELP_SEEN_KEY, {}),
  gameLoading: false,            // loading state for game moves
  gameFeedback: null,
  pendingGameType: null,         // game currently opening
  issueReporterOpen: false,
  issueReportText: "",
  issueReportContextNote: "",
  issueReportSubmitting: false,
  issueReportStatus: null,
  // Phase 6: Shared Spiritverse Events
  spiritverseEvent: null,        // current active Spiritverse event
  spiritverseEventNext: null,    // time until next event
  spiritverseEventLoading: false,
  spiritverseTemporal: getLocalTemporalWorldState(),
  // Phase 7: Daily Quest
  dailyQuest: null,              // today's personalized daily quest
  dailyQuestRefreshesIn: null,   // time until quest refreshes
  dailyQuestLoading: false,
  dailyQuestStarted: false,      // user clicked "Begin Quest"
  returnSummary: null,
  dailyMoment: null,
  weeklyMoment: null,
  retentionUnlocks: [],
  retentionTelemetry: normalizeRetentionTelemetry(readJson(RETENTION_TELEMETRY_KEY, null)),
  retentionInsight: null,
  showReturnSummary: false,
  adaptiveProfile: normalizeAdaptiveProfile(readJson(ADAPTIVE_PROFILE_KEY, null)),
  spiritCore: null,
  lastReactionTimestamp: 0,
  reactionCooldownMs: 0,
  recentReactionKeys: [],
  recentReactionTexts: [],
  // Realm Travel
  realmTravelOpen: false,        // whether realm travel modal is open
  // Game UI state
  pieceTheme: normalizeGameTheme(localStorage.getItem('sk_piece_theme') || 'crown'),
  autoMicTurnKey: null,
  currentTab: "profile",
  activeConversation: null,
  gameActive: false,
};

(function hydrateSession() {
  const session = readJson(SESSION_KEY, null);
  _bootSessionSeed = session && typeof session === "object" ? session : null;
  if (session && typeof session === "object") {
    if (session.conversationId) state.conversationId = session.conversationId;
    if (session.selectedSpiritkin) state.selectedSpiritkin = normalizeStoredSpiritkin(session.selectedSpiritkin);
    if (Array.isArray(session.messages)) state.messages = session.messages.map(normalizeMessage);
    if (session.userId) state.userId = session.userId;
    if (VALID_PRESENCE_TABS.includes(session.activePresenceTab)) {
      state.activePresenceTab = session.activePresenceTab;
      state.currentTab = session.activePresenceTab;
    }
    if (typeof session.showHomeView === "boolean") {
      state.showHomeView = session.showHomeView;
    }
    state.pendingVoiceResume = !!session.pendingVoiceResume;
  }
  if (!state.selectedSpiritkin && state.primarySpiritkin) {
    state.selectedSpiritkin = state.primarySpiritkin;
  }
  state.sessionModel = {
    ...state.sessionModel,
    sessionId: state.conversationId || null,
    userId: state.userId,
    currentSpiritkin: state.selectedSpiritkin ? {
      id: state.selectedSpiritkin.id || null,
      name: state.selectedSpiritkin.name,
      title: state.selectedSpiritkin.title || null,
      role: state.selectedSpiritkin.role || null,
    } : null,
    currentSurface: state.showHomeView ? "profile" : "selection",
    currentMode: state.conversationId ? "conversation" : (state.showHomeView ? "bond_home" : "selection"),
    conversationState: {
      conversationId: state.conversationId || null,
      messageCount: Array.isArray(state.messages) ? state.messages.length : 0,
      lastMessageRole: state.messages[state.messages.length - 1]?.role || null,
      lastMessageAt: normalizeTimestamp(state.messages[state.messages.length - 1]?.created_at || state.messages[state.messages.length - 1]?.time, null),
    },
    recentMessages: Array.isArray(state.messages) ? state.messages.slice(-80) : [],
    source: session ? "local-seed" : "local-default",
  };
  logContinuityDebug("session-hydrated", {
    restored: !!session,
    persistedConversationId: session?.conversationId ?? null,
    persistedSelectedSpiritkin: session?.selectedSpiritkin?.name ?? null,
    persistedMessageCount: Array.isArray(session?.messages) ? session.messages.length : 0,
  });
})();

function buildSessionSnapshot() {
  const hasContinuityState = !!(
    state.conversationId ||
    state.selectedSpiritkin ||
    state.primarySpiritkin ||
    state.showHomeView
  );

  if (!hasContinuityState) return null;

  return {
    conversationId: state.conversationId || null,
    selectedSpiritkin: state.selectedSpiritkin || state.primarySpiritkin || null,
    messages: Array.isArray(state.sessionModel?.recentMessages) && state.sessionModel.recentMessages.length
      ? state.sessionModel.recentMessages.slice(-80)
      : (Array.isArray(state.messages) ? state.messages.slice(-80) : []),
    userId: state.userId,
    activePresenceTab: VALID_PRESENCE_TABS.includes(state.activePresenceTab) ? state.activePresenceTab : "profile",
    showHomeView: !!state.showHomeView,
    pendingVoiceResume: !!(
      shouldKeepVoiceLoopActive() &&
      (state.voiceListening || _audioPlaying || _voiceAwaitingUserTurn || _voiceTurnCaptureAfterAudio)
    ),
  };
}

function buildSpiritkinRecordFromName(name) {
  if (!name) return null;
  const fromLoaded = (state.spiritkins || []).find((spiritkin) => spiritkin?.name === name);
  if (fromLoaded) return hydrateSpiritkin(fromLoaded);
  if (FOUNDING_PILLARS.includes(name)) return buildFoundingPillarRecord(name);
  return hydrateSpiritkin({
    id: `session:${String(name).toLowerCase()}`,
    name,
    title: name,
    role: `${name} is present in the Spiritverse.`,
    essence: [],
    invariant: `${name} remains identity-steady across the session.`,
    tone: "steady presence",
    is_canon: true,
  });
}

function deriveCurrentSurfaceFromUI() {
  if (!state.entryAccepted || state.showCrownGateHome || state.spiritverseTrailerActive || state.spiritCoreWelcoming) return "spirit_gate";
  if (state.conversationId) return VALID_PRESENCE_TABS.includes(state.activePresenceTab) ? state.activePresenceTab : "profile";
  if (state.showHomeView) return "profile";
  if (state.primarySpiritkin || state.selectedSpiritkin) return "selection";
  return "selection";
}

function deriveCurrentModeFromUI() {
  if (!state.entryAccepted || state.showCrownGateHome || state.spiritverseTrailerActive || state.spiritCoreWelcoming) return "entry";
  if (state.loadingReply) return "processing";
  if (state.activeGame?.status === "active" && state.activePresenceTab === "games") return "game";
  if (state.conversationId) return "conversation";
  if (state.showHomeView) return "bond_home";
  return "selection";
}

function applySessionSnapshot(session, source = "backend") {
  if (!session || typeof session !== "object") return false;

  const spiritkinRecord = buildSpiritkinRecordFromName(session.currentSpiritkin?.name || null);
  const recentMessages = Array.isArray(session.recentMessages)
    ? session.recentMessages.map(normalizeMessage)
    : [];
  const conversationState = session.conversationState && typeof session.conversationState === "object"
    ? session.conversationState
    : {};
  const speechState = session.speechState && typeof session.speechState === "object"
    ? session.speechState
    : {};
  const gameState = normalizeActiveGame(session.gameState);
  const currentSurface = String(session.currentSurface || deriveCurrentSurfaceFromUI()).trim().toLowerCase() || "selection";
  const currentMode = String(session.currentMode || deriveCurrentModeFromUI()).trim().toLowerCase() || "idle";

  state.userId = session.userId || state.userId;
  state.conversationId = conversationState.conversationId || session.sessionId || null;
  state.messages = recentMessages;
  if (spiritkinRecord) {
    state.selectedSpiritkin = spiritkinRecord;
    if (!state.primarySpiritkin && FOUNDING_PILLARS.includes(spiritkinRecord.name)) {
      state.primarySpiritkin = state.primarySpiritkin || spiritkinRecord;
    }
  }
  state.activeGame = gameState;
  state.gameActive = !!(gameState && gameState.status === "active");
  if (currentSurface === "profile") {
    state.activePresenceTab = "profile";
    state.showHomeView = currentMode === "bond_home";
  } else if (VALID_PRESENCE_TABS.includes(currentSurface)) {
    state.activePresenceTab = currentSurface;
    state.showHomeView = false;
  } else if (currentSurface === "selection") {
    state.showHomeView = false;
  } else if (state.gameActive) {
    state.activePresenceTab = "games";
    state.showHomeView = false;
  }
  state.currentTab = state.activePresenceTab;

  state.voiceListening = !!speechState.isListening;

  state.sessionModel = {
    sessionId: session.sessionId || state.conversationId || null,
    userId: session.userId || state.userId,
    currentSpiritkin: session.currentSpiritkin || null,
    currentSurface,
    currentMode,
    currentGame: session.currentGame || (gameState ? {
      type: gameState.type,
      name: gameState.name,
      status: gameState.status,
      turn: gameState.turn,
      moveCount: gameState.moveCount,
      historyLength: Array.isArray(gameState.history) ? gameState.history.length : 0,
    } : null),
    gameState,
    conversationState: {
      conversationId: conversationState.conversationId || state.conversationId || null,
      messageCount: Number.isFinite(conversationState.messageCount) ? conversationState.messageCount : recentMessages.length,
      lastMessageRole: conversationState.lastMessageRole || recentMessages[recentMessages.length - 1]?.role || null,
      lastMessageAt: normalizeTimestamp(conversationState.lastMessageAt || recentMessages[recentMessages.length - 1]?.created_at || recentMessages[recentMessages.length - 1]?.time, null),
    },
    speechState: {
      isSpeaking: !!speechState.isSpeaking,
      isListening: !!speechState.isListening,
      isPaused: !!speechState.isPaused,
      lastUtteranceId: speechState.lastUtteranceId ? String(speechState.lastUtteranceId) : null,
      turnPhase: normalizeTurnPhaseValue(speechState.turnPhase),
    },
    memoryContext: session.memoryContext || null,
    spiritCore: session.spiritCore || null,
    recentMessages,
    hydrated: true,
    source,
  };
  state.spiritCore = session.spiritCore || null;

  return true;
}

async function fetchSessionSnapshot(options = {}) {
  const {
    conversationId = state.conversationId || _bootSessionSeed?.conversationId || null,
    spiritkinName = state.selectedSpiritkin?.name || state.primarySpiritkin?.name || _bootSessionSeed?.selectedSpiritkin?.name || null,
    currentSurface = deriveCurrentSurfaceFromUI(),
    currentMode = deriveCurrentModeFromUI(),
    renderOnFinish = true,
    silent = false,
  } = options;

  if (!state.userId) return null;

  const query = new URLSearchParams({
    userId: state.userId,
    currentSurface,
    currentMode,
  });
  if (conversationId) query.set("conversationId", conversationId);
  if (spiritkinName) query.set("spiritkinName", spiritkinName);

  try {
    const res = await fetch(`${API}/v1/session/snapshot?${query.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.message || "Failed to fetch session snapshot.");
    applySessionSnapshot(data.session, "backend-snapshot");
    if (renderOnFinish) render();
    return data.session;
  } catch (error) {
    if (!silent) {
      state.statusText = error.message || "Could not restore the session.";
      state.statusError = true;
    }
    if (_bootSessionSeed && !_bootSessionSeed.__appliedFallback) {
      _bootSessionSeed.__appliedFallback = true;
      applySessionSnapshot({
        sessionId: _bootSessionSeed.conversationId || null,
        userId: _bootSessionSeed.userId || state.userId,
        currentSpiritkin: _bootSessionSeed.selectedSpiritkin ? { name: _bootSessionSeed.selectedSpiritkin.name } : null,
        currentSurface: _bootSessionSeed.activePresenceTab || "selection",
        currentMode: _bootSessionSeed.conversationId ? "conversation" : "selection",
        currentGame: null,
        gameState: null,
        conversationState: {
          conversationId: _bootSessionSeed.conversationId || null,
          messageCount: Array.isArray(_bootSessionSeed.messages) ? _bootSessionSeed.messages.length : 0,
        },
        speechState: {
          isSpeaking: false,
          isListening: false,
          isPaused: !!_bootSessionSeed.pendingVoiceResume,
          lastUtteranceId: null,
          turnPhase: "idle",
        },
        memoryContext: null,
        recentMessages: Array.isArray(_bootSessionSeed.messages) ? _bootSessionSeed.messages : [],
      }, "local-fallback");
      if (renderOnFinish) render();
    }
    return null;
  }
}

async function syncSessionControl(overrides = {}, options = {}) {
  const { renderOnFinish = false } = options;
  if (!state.userId) return null;

  const speechState = {
    isSpeaking: !!_audioPlaying,
    isListening: !!state.voiceListening,
    isPaused: !!state.pendingVoiceResume,
    lastUtteranceId: state.sessionModel?.speechState?.lastUtteranceId || null,
    turnPhase: normalizeTurnPhaseValue(overrides.turnPhase || state.sessionModel?.speechState?.turnPhase || "idle"),
  };

  const payload = {
    userId: state.userId,
    conversationId: overrides.conversationId !== undefined ? overrides.conversationId : (state.conversationId || null),
    currentSpiritkinName: overrides.currentSpiritkinName || state.selectedSpiritkin?.name || state.primarySpiritkin?.name || null,
    currentSurface: overrides.currentSurface || deriveCurrentSurfaceFromUI(),
    currentMode: overrides.currentMode || deriveCurrentModeFromUI(),
    activeTab: overrides.activeTab || state.activePresenceTab || "profile",
    speechState: {
      ...speechState,
      ...(overrides.speechState || {}),
      turnPhase: normalizeTurnPhaseValue((overrides.speechState || {}).turnPhase || speechState.turnPhase),
    },
  };

  try {
    const res = await fetch(`${API}/v1/session/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.message || "Failed to sync session control.");
    applySessionSnapshot(data.session, "backend-control");
    persistSession();
    if (renderOnFinish) render();
    return data.session;
  } catch (error) {
    logContinuityDebug("session-control-sync-failed", {
      message: error.message,
      payload,
    });
    return null;
  }
}

function setAuthoritativeTurnPhase(turnPhase, overrides = {}) {
  const nextTurnPhase = normalizeTurnPhaseValue(turnPhase);
  state.sessionModel = {
    ...state.sessionModel,
    speechState: {
      ...(state.sessionModel?.speechState || createDefaultSessionModel().speechState),
      isSpeaking: !!(overrides.isSpeaking ?? _audioPlaying),
      isListening: !!(overrides.isListening ?? state.voiceListening),
      isPaused: !!(overrides.isPaused ?? state.pendingVoiceResume),
      lastUtteranceId: overrides.lastUtteranceId !== undefined
        ? overrides.lastUtteranceId
        : (state.sessionModel?.speechState?.lastUtteranceId || null),
      turnPhase: nextTurnPhase,
    },
  };
}

function syncSessionControlSoon(overrides = {}, options = {}) {
  Promise.resolve().then(() => syncSessionControl(overrides, options)).catch(() => {});
}

function getPresenceSurfaceFocusSelector(tab) {
  if (tab === "games") {
    return state.activeGame
      ? ".active-game-panel, [data-focus-anchor='presence-games']"
      : "[data-focus-anchor='presence-games'], .games-view";
  }
  if (tab === "profile") return "[data-focus-anchor='presence-profile'], .presence-summary";
  if (tab === "echoes") return "[data-focus-anchor='presence-echoes'], .echoes-library";
  if (tab === "charter") return "[data-focus-anchor='presence-charter'], .charter-view";
  if (tab === "journal") return "[data-focus-anchor='presence-journal'], .bond-journal-view";
  if (tab === "events") return "[data-focus-anchor='presence-events'], .sv-events-panel";
  if (tab === "quest") return "[data-focus-anchor='presence-quest'], .sv-quest-panel";
  return ".presence-tab-content";
}

function deriveModeForSurface(surface) {
  if (!state.entryAccepted || state.showCrownGateHome || state.spiritverseTrailerActive || state.spiritCoreWelcoming) return "entry";
  if (surface === "games" && state.activeGame?.status === "active") return "game";
  if (state.conversationId) return "conversation";
  if (state.showHomeView || surface === "profile") return "bond_home";
  return "selection";
}

let _surfaceTransitionRunId = 0;

async function transitionPresenceSurface(tab, options = {}) {
  if (!VALID_PRESENCE_TABS.includes(tab)) return false;
  const { announce = true } = options;
  const runId = ++_surfaceTransitionRunId;
  const previousTab = state.activePresenceTab;
  state.pendingPresenceTab = tab;
  if (tab !== previousTab) {
    state.statusText = `Opening ${tab.replace("_", " ")}...`;
    state.statusError = false;
    render();
  }
  let session;
  try {
    session = await syncSessionControl({
      currentSurface: tab,
      currentMode: deriveModeForSurface(tab),
      activeTab: tab,
      speechState: { turnPhase: state.sessionModel?.speechState?.turnPhase || "complete" },
    });
  } finally {
    state.pendingPresenceTab = null;
  }
  if (runId !== _surfaceTransitionRunId) return false;
  if (!session) {
    state.statusText = "Could not switch views right now.";
    state.statusError = true;
    render();
    return false;
  }
  normalizeInteractionState("transitionPresenceSurface");
  persistSession();
  render();
  revealCurrentFocus({
    selector: getPresenceSurfaceFocusSelector(tab),
  });
  if (announce && tab !== previousTab) {
    narratePresenceTab(tab).catch(() => {});
  }
  if (tab === "events" && !state.spiritverseEvent) {
    fetchSpiritverseEvent();
  }
  if (tab === "quest" && !state.dailyQuest) {
    fetchDailyQuest();
  }
  if (tab === "journal" && state.conversationId && state.userId) {
    fetch(`${API}/v1/bond-journal?userId=${encodeURIComponent(state.userId)}&conversationId=${encodeURIComponent(state.conversationId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          state.bondJournal = data.journal;
          persistSession();
          render();
        }
      })
      .catch(() => {});
  }
  return true;
}

function didCanonicalGameApplyMove(previousGame, nextGame, move) {
  if (!nextGame || (nextGame.status !== "active" && nextGame.status !== "ended")) return false;
  const previousHistoryLength = Array.isArray(previousGame?.history) ? previousGame.history.length : 0;
  const nextHistory = Array.isArray(nextGame.history) ? nextGame.history : [];
  const nextEntries = nextHistory.slice(previousHistoryLength);
  const normalizedMove = String(move || "").trim();
  if (!normalizedMove || nextEntries.length === 0) return false;
  if (Number(nextGame.moveCount || 0) <= Number(previousGame?.moveCount || 0)) return false;
  return nextEntries.some((entry) => entry?.player === "user" && String(entry?.move || "").trim() === normalizedMove);
}

function syncPrimarySelection() {
  if (!state.primarySpiritkin) return;
  if (!state.selectedSpiritkin || state.selectedSpiritkin.name !== state.primarySpiritkin.name) {
    state.selectedSpiritkin = state.primarySpiritkin;
  }
}

function getInteractionStateSnapshot() {
  return {
    build: INTERACTION_BUILD_MARKER,
    entryAccepted: state.entryAccepted,
    showCrownGateHome: state.showCrownGateHome,
    crownGateOpening: state.crownGateOpening,
    entryVideoStarted: state.entryVideoStarted,
    entryTransitioning: state.entryTransitioning,
    spiritverseTrailerActive: state.spiritverseTrailerActive,
    spiritCoreWelcoming: state.spiritCoreWelcoming,
    onboardingComplete: state.onboardingComplete,
    showHomeView: state.showHomeView,
    primarySpiritkin: state.primarySpiritkin?.name || null,
    selectedSpiritkin: state.selectedSpiritkin?.name || null,
    pendingBondSpiritkin: state.pendingBondSpiritkin?.name || null,
    rebondSpiritkin: state.rebondSpiritkin?.name || null,
    conversationId: state.conversationId || null,
    activeConversation: state.activeConversation || null,
    activePresenceTab: state.activePresenceTab,
    currentTab: state.currentTab,
    activeGame: state.activeGame?.type || null,
    gameActive: !!state.gameActive,
    gameLoading: state.gameLoading,
    pendingGameType: state.pendingGameType || null,
    statusText: state.statusText || "",
    statusError: !!state.statusError,
  };
}

function logInteraction(eventName, detail = {}) {
  console.info(`[Interaction] ${eventName}`, {
    ...detail,
    snapshot: getInteractionStateSnapshot(),
  });
}

function shouldLogGameDebug() {
  try {
    return window.__SV_GAME_DEBUG === true || localStorage.getItem("sv.game.debug") === "1";
  } catch (_) {
    return window.__SV_GAME_DEBUG === true;
  }
}

function logGameDebug(eventName, detail = {}) {
  if (!shouldLogGameDebug()) return;
  console.info(`[GameDebug] ${eventName}`, {
    ...detail,
    snapshot: {
      conversationId: state.conversationId || null,
      activeGameType: state.activeGame?.type || null,
      activeGameStatus: state.activeGame?.status || null,
      activeGameTurn: state.activeGame?.turn || null,
      moveCount: state.activeGame?.moveCount || 0,
      historyLength: Array.isArray(state.activeGame?.history) ? state.activeGame.history.length : 0,
      loading: !!state.gameLoading,
    },
  });
}

function shouldLogContinuityDebug() {
  try {
    return window.__SV_CONTINUITY_DEBUG === true || localStorage.getItem("sv.continuity.debug") === "1";
  } catch (_) {
    return window.__SV_CONTINUITY_DEBUG === true;
  }
}

function getContinuitySnapshot() {
  return {
    userId: state.userId || null,
    primarySpiritkin: state.primarySpiritkin?.name || null,
    selectedSpiritkin: state.selectedSpiritkin?.name || null,
    conversationId: state.conversationId || null,
    activePresenceTab: state.activePresenceTab || null,
    currentTab: state.currentTab || null,
    showHomeView: !!state.showHomeView,
    showCrownGateHome: !!state.showCrownGateHome,
    activeGame: state.activeGame?.type || null,
    gameStatus: state.activeGame?.status || null,
    entryAccepted: !!state.entryAccepted,
    voiceMode: !!state.voiceMode,
    voiceMuted: !!state.voiceMuted,
    voiceListening: !!state.voiceListening,
    audioPlaying: !!_audioPlaying,
    awaitingUserTurn: !!_voiceAwaitingUserTurn,
    turnCaptureAfterAudio: !!_voiceTurnCaptureAfterAudio,
    messageCount: Array.isArray(state.messages) ? state.messages.length : 0,
  };
}

function logContinuityDebug(eventName, detail = {}) {
  if (!shouldLogContinuityDebug()) return;
  console.info(`[ContinuityDebug] ${eventName}`, {
    ...detail,
    snapshot: getContinuitySnapshot(),
  });
}

let _lastContinuityViewSignature = "";

function logContinuityViewIfChanged(source = "unknown") {
  if (!shouldLogContinuityDebug()) return;
  const signature = [
    state.entryAccepted ? "accepted" : "entry",
    state.showCrownGateHome ? "gate-home" : "gate-hidden",
    state.showHomeView ? "home" : "surface",
    state.activePresenceTab || "profile",
    state.conversationId || "no-conversation",
    state.selectedSpiritkin?.name || state.primarySpiritkin?.name || "no-spiritkin",
    state.activeGame?.type || "no-game",
    state.voiceListening ? "listening" : "not-listening",
    _audioPlaying ? "audio" : "silent",
  ].join("|");
  if (signature === _lastContinuityViewSignature) return;
  _lastContinuityViewSignature = signature;
  logContinuityDebug("view-signature", { source, signature });
}

function normalizeInteractionState(source = "unknown") {
  let changed = false;

  if (!Array.isArray(state.messages)) {
    state.messages = [];
    changed = true;
  }

  const sanitizedMessages = state.messages.filter((message) => message && typeof message === "object");
  if (sanitizedMessages.length !== state.messages.length) {
    state.messages = sanitizedMessages;
    changed = true;
  }

  if (!state.ratings || typeof state.ratings !== "object" || Array.isArray(state.ratings)) {
    state.ratings = {};
    changed = true;
  }

  if (!VALID_PRESENCE_TABS.includes(state.activePresenceTab)) {
    state.activePresenceTab = "profile";
    changed = true;
  }

  if (state.selectedSpiritkin && !state.selectedSpiritkin.ui) {
    state.selectedSpiritkin = normalizeStoredSpiritkin(state.selectedSpiritkin);
    changed = true;
  }

  if (state.primarySpiritkin && !state.primarySpiritkin.ui) {
    state.primarySpiritkin = normalizeStoredSpiritkin(state.primarySpiritkin);
    changed = true;
  }

  if (state.primarySpiritkin && (!state.selectedSpiritkin || state.selectedSpiritkin.name !== state.primarySpiritkin.name) && !state.pendingBondSpiritkin && !state.rebondSpiritkin) {
    state.selectedSpiritkin = state.primarySpiritkin;
    changed = true;
  }

  if (!state.primarySpiritkin && state.selectedSpiritkin && !state.pendingBondSpiritkin) {
    state.selectedSpiritkin = null;
    changed = true;
  }

  if (state.conversationId && !state.selectedSpiritkin && state.primarySpiritkin) {
    state.selectedSpiritkin = state.primarySpiritkin;
    changed = true;
  }

  if (state.conversationId && state.showHomeView) {
    state.showHomeView = false;
    changed = true;
  }

  if (!state.conversationId && state.activeGame) {
    state.activeGame = null;
    state.gameSpiritkinMessage = null;
    state.gameInstructions = null;
    state.gameEchoGuide = null;
    changed = true;
  }

  if (state.activeGame) {
    const normalizedGame = normalizeActiveGame(state.activeGame);
    if (!normalizedGame) {
      state.activeGame = null;
      state.gameSpiritkinMessage = null;
      state.gameInstructions = null;
      state.gameEchoGuide = null;
      changed = true;
    } else if (JSON.stringify(normalizedGame) !== JSON.stringify(state.activeGame)) {
      state.activeGame = normalizedGame;
      changed = true;
    }
  }

  if (state.spiritCoreWelcoming) {
    if (state.spiritverseTrailerActive) {
      state.spiritverseTrailerActive = false;
      changed = true;
    }
    if (state.crownGateOpening || state.entryVideoStarted) {
      state.crownGateOpening = false;
      state.entryVideoStarted = false;
      changed = true;
    }
  }

  if (state.spiritverseTrailerActive && (state.crownGateOpening || state.entryVideoStarted)) {
    state.crownGateOpening = false;
    state.entryVideoStarted = false;
    changed = true;
  }

  if (state.entryAccepted && state.showCrownGateHome) {
    state.showCrownGateHome = false;
    changed = true;
  }

  const normalizedConversationId = typeof state.conversationId === "string" && state.conversationId.trim()
    ? state.conversationId.trim()
    : null;
  const normalizedConversationSpiritkin = state.selectedSpiritkin?.ui
    ? state.selectedSpiritkin
    : (state.primarySpiritkin?.ui ? state.primarySpiritkin : normalizeStoredSpiritkin(state.selectedSpiritkin || state.primarySpiritkin));
  const nextActiveConversation = {
    id: normalizedConversationId,
    messages: state.messages,
    spiritkin: normalizedConversationSpiritkin || null,
  };

  state.currentTab = state.activePresenceTab;
  if (
    !state.activeConversation ||
    typeof state.activeConversation !== "object" ||
    state.activeConversation.id !== nextActiveConversation.id ||
    state.activeConversation.spiritkin?.name !== nextActiveConversation.spiritkin?.name ||
    state.activeConversation.messages !== nextActiveConversation.messages
  ) {
    state.activeConversation = nextActiveConversation;
    changed = true;
  }
  state.gameActive = !!(state.activeGame && state.activeGame.status === "active");

  if (changed) {
    logInteraction("state-normalized", { source });
  }
  return changed;
}

function installGlobalInteractionDiagnostics() {
  if (window.__svInteractionDiagnosticsInstalled) return;
  window.__svInteractionDiagnosticsInstalled = true;

  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    originalConsoleError("[SpiritverseRuntime]", ...args, getInteractionStateSnapshot());
  };

  window.addEventListener("error", (event) => {
    console.error("window.onerror", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack || event.error?.message || null,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("unhandledrejection", {
      reason: event.reason?.stack || event.reason?.message || String(event.reason),
    });
  });

  logInteraction("diagnostics-installed", {});
}

function isFirstTimeVisitor() {
  return !state.onboardingComplete && !state.primarySpiritkin;
}

function requiresEntryConsent() {
  return !state.consentAccepted && isFirstTimeVisitor();
}

function persistEntryConsent() {
  state.consentAccepted = true;
  state.consentChecked = true;
  localStorage.setItem(CONSENT_KEY, "1");
}

function markOnboardingComplete() {
  state.onboardingComplete = true;
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
  localStorage.setItem(ENTRY_KEY, "1");
}

function getPostGateRoute() {
  if (isFirstTimeVisitor()) return "first-run";
  if (state.primarySpiritkin) return "bonded-home";
  return "selection";
}

function isIdleSpiritGatePreviewActive() {
  return !state.entryVideoStarted && !state.crownGateOpening && (state.showCrownGateHome || !state.entryAccepted);
}

function setMediaMuted(muted, { persist = true, attemptPlay = false } = {}) {
  state.mediaMuted = !!muted;
  if (persist) {
    localStorage.setItem(MEDIA_MUTED_KEY, state.mediaMuted ? "1" : "0");
  }
  syncMountedMedia({ attemptPlay });
}

function pauseMountedVideoAudio() {
  document.querySelectorAll(".video-player-element").forEach((video) => {
    if (typeof video.pause === "function" && !video.paused) {
      try {
        video.pause();
      } catch (_) {}
    }
  });
}

function syncMountedMedia({ attemptPlay = false } = {}) {
  const media = getMediaToggleState(state.mediaMuted);
  document.querySelectorAll(".video-player-element").forEach((video) => {
    const isGatePreview = video.dataset.entryVideo === "gate" && isIdleSpiritGatePreviewActive();
    const effectiveMuted = isGatePreview && !attemptPlay ? true : state.mediaMuted;
    video.muted = effectiveMuted;
    video.defaultMuted = effectiveMuted;
    video.volume = effectiveMuted ? 0 : 1;
    if (attemptPlay && video.paused) {
      const playAttempt = video.play?.();
      if (playAttempt?.catch) {
        playAttempt.catch(() => {});
      }
    }
  });
  document.querySelectorAll(".video-unmute-btn").forEach((button) => {
    button.innerHTML = buildMediaToggleInner(state.mediaMuted);
    button.title = media.title;
    button.setAttribute("aria-pressed", state.mediaMuted ? "false" : "true");
  });
}

function clearSelectionTrailerFailure(name) {
  if (!name) return;
  selectionTrailerFailures.delete(String(name));
}

function markSelectionTrailerFailure(name, detail = {}) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName || selectionTrailerFailures.has(normalizedName)) return;
  selectionTrailerFailures.add(normalizedName);
  console.warn("TRAILER_PLAY_FAIL", {
    spiritkin: normalizedName,
    fallback: "still",
    ...detail
  });
  if (state.pendingBondSpiritkin?.name === normalizedName) {
    render();
  }
}

function syncSelectionTrailers() {
  const pendingName = state.pendingBondSpiritkin?.name || "";
  if (!pendingName || selectionTrailerFailures.has(pendingName)) return;
  const mediaConfig = getSpiritkinMediaConfig(pendingName);
  const trailerPath = mediaConfig?.introTrailer?.path || "";
  if (!trailerPath) return;

  console.info("TRAILER_SELECTED", {
    spiritkin: pendingName,
    src: trailerPath,
    muted: state.mediaMuted
  });

  const trailers = Array.from(document.querySelectorAll(".spiritkin-intro-video .video-player-element[data-trailer-kind='intro']"));
  trailers.forEach((video) => {
    const owner = video.dataset.trailerOwner || pendingName;
    const src = video.currentSrc || video.querySelector("source")?.src || trailerPath;
    console.info("TRAILER_MOUNTED", {
      spiritkin: owner,
      src,
      muted: video.muted,
      hidden: video.offsetParent === null
    });

    if (video.dataset.trailerBound !== "1") {
      video.dataset.trailerBound = "1";
      video.addEventListener("error", () => {
        markSelectionTrailerFailure(owner, {
          spiritkin: owner,
          src,
          reason: "element-error",
          mediaError: video.error?.message || video.error?.code || "unknown"
        });
      });
      video.addEventListener("loadedmetadata", () => {
        console.info("TRAILER_PLAY_ATTEMPT", {
          spiritkin: owner,
          src,
          phase: "metadata-ready",
          muted: video.muted
        });
      });
    }

    video.defaultMuted = !!state.mediaMuted;
    video.muted = !!state.mediaMuted;
    video.playsInline = true;

    const attemptPlayback = (label, forceMuted = state.mediaMuted) => {
      video.defaultMuted = !!forceMuted;
      video.muted = !!forceMuted;
      video.volume = forceMuted ? 0 : 1;
      console.info("TRAILER_PLAY_ATTEMPT", {
        spiritkin: owner,
        src,
        phase: label,
        muted: video.muted
      });
      const playback = video.play?.();
      if (!playback?.then) {
        console.info("TRAILER_PLAY_SUCCESS", {
          spiritkin: owner,
          src,
          phase: label,
          muted: video.muted,
          mode: "sync"
        });
        return Promise.resolve();
      }
      return playback.then(() => {
        console.info("TRAILER_PLAY_SUCCESS", {
          spiritkin: owner,
          src,
          phase: label,
          muted: video.muted
        });
      });
    };

    if (!video.paused && !video.ended && video.readyState >= 2) {
      console.info("TRAILER_PLAY_SUCCESS", {
        spiritkin: owner,
        src,
        phase: "already-playing",
        muted: video.muted
      });
      return;
    }

    attemptPlayback("initial", state.mediaMuted).catch((error) => {
      if (!state.mediaMuted) {
        attemptPlayback("muted-retry", true).catch((retryError) => {
          markSelectionTrailerFailure(owner, {
            src,
            reason: "play-rejected-after-muted-retry",
            error: retryError?.message || retryError?.name || "unknown"
          });
        });
        return;
      }
      markSelectionTrailerFailure(owner, {
        src,
        reason: "play-rejected",
        error: error?.message || error?.name || "unknown"
      });
    });
  });
}

function logSpiritGate(stage, detail = {}) {
  const snapshot = {
    entryAccepted: state.entryAccepted,
    crownGateOpening: state.crownGateOpening,
    entryVideoStarted: state.entryVideoStarted,
    entryTransitioning: state.entryTransitioning,
    spiritverseTrailerActive: state.spiritverseTrailerActive,
    spiritCoreWelcoming: state.spiritCoreWelcoming,
    consentChecked: state.consentChecked,
    consentAccepted: state.consentAccepted,
    onboardingComplete: state.onboardingComplete,
    voiceMode: state.voiceMode,
    voiceMuted: state.voiceMuted,
    ...detail,
  };
  console.info(`[SpiritGate] ${stage}`, snapshot);
}

function clearSpiritGateFallback() {
  if (spiritGateFallbackTimer) {
    window.clearTimeout(spiritGateFallbackTimer);
    spiritGateFallbackTimer = null;
  }
}

function clearSpiritGateArrivalFallback() {
  if (spiritGateArrivalFallbackTimer) {
    window.clearTimeout(spiritGateArrivalFallbackTimer);
    spiritGateArrivalFallbackTimer = null;
  }
}

function clearSpiritGatePlaybackSafetyTimer() {
  if (spiritGatePlaybackSafetyTimer) {
    window.clearTimeout(spiritGatePlaybackSafetyTimer);
    spiritGatePlaybackSafetyTimer = null;
  }
}

function clearSpiritGateArrivalPlaybackSafetyTimer() {
  if (spiritGateArrivalPlaybackSafetyTimer) {
    window.clearTimeout(spiritGateArrivalPlaybackSafetyTimer);
    spiritGateArrivalPlaybackSafetyTimer = null;
  }
}

function clearSpiritGateTransitionTimers() {
  if (spiritGateTransitionRevealTimer) {
    window.clearTimeout(spiritGateTransitionRevealTimer);
    spiritGateTransitionRevealTimer = null;
  }
  if (spiritGateTransitionRouteTimer) {
    window.clearTimeout(spiritGateTransitionRouteTimer);
    spiritGateTransitionRouteTimer = null;
  }
  clearSpiritGatePlaybackSafetyTimer();
  clearSpiritGateArrivalPlaybackSafetyTimer();
}

function failSpiritGateEntry(message, error, detail = {}) {
  const reason = error instanceof Error ? error.message : error;
  console.error("Gate video failed", { message, reason, ...detail });
  console.error("[SpiritGate] entry failure", { message, reason, ...detail });
  state.statusText = message;
  state.statusError = true;
  render();
}

function armSpiritGateFallback(source) {
  clearSpiritGateFallback();
  const attemptId = spiritGateActiveAttemptId;
  spiritGateFallbackTimer = window.setTimeout(() => {
    if (attemptId !== spiritGateActiveAttemptId) return;
    if (!state.crownGateOpening || state.entryTransitioning || state.entryAccepted) return;
    console.warn("Fallback triggered", { source, stage: "gate-video" });
    logSpiritGate("failsafe-transition", { source });
    completeCrownGateEntry({ skipped: true, source: `${source}:failsafe`, force: true });
  }, SPIRITGATE_VIDEO_FAILSAFE_MS);
}

function armSpiritGateArrivalFallback(source) {
  clearSpiritGateArrivalFallback();
  const attemptId = spiritGateActiveAttemptId;
  spiritGateArrivalFallbackTimer = window.setTimeout(() => {
    if (attemptId !== spiritGateActiveAttemptId) return;
    if (!state.spiritverseTrailerActive || state.spiritCoreWelcoming || state.onboardingComplete) return;
    console.warn("Fallback triggered", { source, stage: "arrival-trailer" });
    logSpiritGate("arrival-failsafe-transition", { source });
    beginSpiritCoreWelcome().catch((error) => {
      failSpiritGateEntry("SpiritGate arrival failed. Refresh and try again.", error, { source });
    });
  }, SPIRITGATE_TRAILER_FAILSAFE_MS);
}

function armSpiritGatePlaybackSafety(source, video) {
  clearSpiritGatePlaybackSafetyTimer();
  const attemptId = spiritGateActiveAttemptId;
  const durationMs = Number.isFinite(video?.duration) && video.duration > 0
    ? Math.ceil(video.duration * 1000) + 2000
    : SPIRITGATE_VIDEO_COMPLETION_FAILSAFE_MS;
  const timeoutMs = Math.max(durationMs, SPIRITGATE_VIDEO_COMPLETION_FAILSAFE_MS);
  spiritGatePlaybackSafetyTimer = window.setTimeout(() => {
    if (attemptId !== spiritGateActiveAttemptId) return;
    if (!state.crownGateOpening || state.entryTransitioning || state.entryAccepted) return;
    console.warn("Fallback triggered", { source, stage: "gate-video-complete" });
    logSpiritGate("completion-failsafe-transition", { source, timeoutMs });
    completeCrownGateEntry({ skipped: true, source: `${source}:completion-failsafe`, force: true });
  }, timeoutMs);
}

function armSpiritGateArrivalPlaybackSafety(source, video) {
  clearSpiritGateArrivalPlaybackSafetyTimer();
  const attemptId = spiritGateActiveAttemptId;
  const durationMs = Number.isFinite(video?.duration) && video.duration > 0
    ? Math.ceil(video.duration * 1000) + 2500
    : SPIRITGATE_TRAILER_COMPLETION_FAILSAFE_MS;
  const timeoutMs = Math.max(durationMs, SPIRITGATE_TRAILER_COMPLETION_FAILSAFE_MS);
  spiritGateArrivalPlaybackSafetyTimer = window.setTimeout(() => {
    if (attemptId !== spiritGateActiveAttemptId) return;
    if (!state.spiritverseTrailerActive || state.spiritCoreWelcoming || state.onboardingComplete) return;
    console.warn("Fallback triggered", { source, stage: "arrival-video-complete" });
    logSpiritGate("arrival-completion-failsafe-transition", { source, timeoutMs });
    beginSpiritCoreWelcome().catch((error) => {
      failSpiritGateEntry("SpiritGate arrival failed. Refresh and try again.", error, { source });
    });
  }, timeoutMs);
}

function syncEntryCinematics() {
  const gateVideo = document.querySelector("[data-entry-video='gate']");
  if (gateVideo) {
    const previewingGate = !state.entryVideoStarted && !state.crownGateOpening && (state.showCrownGateHome || !state.entryAccepted);
    gateVideo.onloadedmetadata = () => {
      if (state.entryVideoStarted && state.crownGateOpening) {
        armSpiritGatePlaybackSafety("gate-video-metadata", gateVideo);
      }
    };
    gateVideo.onplay = () => {
      if (!state.entryVideoStarted || !state.crownGateOpening) return;
      clearSpiritGateFallback();
      armSpiritGatePlaybackSafety("gate-video-play", gateVideo);
      logSpiritGate("gate-video-play", { currentTime: gateVideo.currentTime, paused: gateVideo.paused });
    };
    gateVideo.onplaying = () => {
      if (!state.entryVideoStarted || !state.crownGateOpening) return;
      clearSpiritGateFallback();
      armSpiritGatePlaybackSafety("gate-video-playing", gateVideo);
      logSpiritGate("gate-video-playing", { currentTime: gateVideo.currentTime, paused: gateVideo.paused });
    };
    gateVideo.onended = () => {
      if (!state.entryVideoStarted || !state.crownGateOpening) return;
      clearSpiritGatePlaybackSafetyTimer();
      logSpiritGate("gate-video-ended", { currentTime: gateVideo.currentTime, duration: gateVideo.duration || null });
      completeCrownGateEntry({ source: "gate-video-ended" });
    };
    gateVideo.onerror = () => {
      if (!state.entryVideoStarted || !state.crownGateOpening) {
        logSpiritGate("gate-video-preview-error", { mediaError: gateVideo.error?.message || gateVideo.error?.code || "unknown" });
        return;
      }
      clearSpiritGatePlaybackSafetyTimer();
      console.error("Gate video failed", { mediaError: gateVideo.error?.message || gateVideo.error?.code || "unknown" });
      logSpiritGate("gate-video-error", { mediaError: gateVideo.error?.message || gateVideo.error?.code || "unknown" });
      completeCrownGateEntry({ skipped: true, source: "gate-video-error", force: true });
    };
    if (state.entryVideoStarted && state.crownGateOpening) {
      const attemptKey = String(spiritGateActiveAttemptId || "gate");
      const isCurrentAttempt = gateVideo.dataset.gateAttemptId === attemptKey;
      gateVideo.dataset.gateAttemptId = attemptKey;
      armSpiritGateFallback("gate-video-playback");
      if (!isCurrentAttempt) {
        gateVideo.currentTime = 0;
      }
      if (gateVideo.paused) {
        const playAttempt = gateVideo.play?.();
        if (playAttempt?.catch) {
          playAttempt.catch((error) => {
            console.error("Gate video failed", { reason: error?.message || "unknown" });
            logSpiritGate("gate-video-play-rejected", { reason: error?.message || "unknown" });
            completeCrownGateEntry({ skipped: true, source: "gate-video-play-rejected", force: true });
          });
        }
      }
    } else {
      delete gateVideo.dataset.gateAttemptId;
      clearSpiritGateFallback();
      clearSpiritGateTransitionTimers();
      if (previewingGate) {
        gateVideo.muted = true;
        gateVideo.defaultMuted = true;
        gateVideo.playsInline = true;
        gateVideo.pause?.();
        gateVideo.currentTime = 0;
      } else {
        gateVideo.pause?.();
        gateVideo.currentTime = 0;
      }
    }
  } else if (state.entryVideoStarted && state.crownGateOpening) {
    logSpiritGate("gate-video-missing", {});
    armSpiritGateFallback("gate-video-missing");
  }

  const trailerVideo = document.querySelector("[data-entry-video='trailer']");
  if (trailerVideo) {
    trailerVideo.onloadedmetadata = () => {
      if (state.spiritverseTrailerActive) {
        armSpiritGateArrivalPlaybackSafety("arrival-video-metadata", trailerVideo);
      }
    };
    trailerVideo.onended = () => {
      clearSpiritGateArrivalFallback();
      clearSpiritGateArrivalPlaybackSafetyTimer();
      logSpiritGate("arrival-video-ended", { currentTime: trailerVideo.currentTime, duration: trailerVideo.duration || null });
      beginSpiritCoreWelcome().catch((error) => {
        failSpiritGateEntry("SpiritGate arrival failed. Refresh and try again.", error, { source: "arrival-video-ended" });
      });
    };
    trailerVideo.onerror = () => {
      clearSpiritGateArrivalFallback();
      clearSpiritGateArrivalPlaybackSafetyTimer();
      logSpiritGate("arrival-video-error", { mediaError: trailerVideo.error?.message || trailerVideo.error?.code || "unknown" });
      beginSpiritCoreWelcome().catch((error) => {
        failSpiritGateEntry("SpiritGate arrival failed. Refresh and try again.", error, { source: "arrival-video-error" });
      });
    };
    if (state.spiritverseTrailerActive) {
      armSpiritGateArrivalFallback("arrival-video-playback");
      armSpiritGateArrivalPlaybackSafety("arrival-video-playback", trailerVideo);
      const playAttempt = trailerVideo.play?.();
      if (playAttempt?.catch) {
        playAttempt.catch((error) => {
          logSpiritGate("arrival-video-play-rejected", { reason: error?.message || "unknown" });
          beginSpiritCoreWelcome().catch((welcomeError) => {
            failSpiritGateEntry("SpiritGate arrival failed. Refresh and try again.", welcomeError, {
              source: "arrival-video-play-rejected",
              reason: error?.message || "unknown",
            });
          });
        });
      }
    } else {
      clearSpiritGateArrivalFallback();
    }
  }
}

function getActiveVoice() {
  return state.selectedSpiritkin?.ui?.voice || state.primarySpiritkin?.ui?.voice || "nova";
}

function createLocalAssistantMessage(content, overrides = {}) {
  const spiritkinName = overrides.spiritkinName || state.selectedSpiritkin?.name || state.primarySpiritkin?.name || "Spiritkin";
  const spiritkinVoice = overrides.spiritkinVoice || state.selectedSpiritkin?.ui?.voice || state.primarySpiritkin?.ui?.voice || "nova";
  return {
    id: uuid(),
    role: "assistant",
    content,
    spiritkinName,
    spiritkinVoice,
    time: nowIso(),
    status: "sent",
    tags: Array.isArray(overrides.tags) ? overrides.tags : [],
    memoryActive: false,
    emotionTone: sanitizeTone(overrides.emotionTone),
    sceneName: sanitizeScene(overrides.sceneName)
  };
}

function buildGreetingText(spiritkinName, context = "newSession") {
  const greeting = pickGreetingVariant(spiritkinName, context);
  if (!state.userName) return greeting;
  return `${state.userName}, ${greeting}`;
}

async function speakText(text, voice = "nova", requestId = claimSpeechRequest(), options = {}) {
  const content = String(text || "").trim();
  if (!content) return false;
  const speechFingerprint = buildSpeechFingerprint(content, voice, options.dedupeKey);
  if (!options.allowRepeat && isDuplicateSpeechFingerprint(speechFingerprint)) {
    logContinuityDebug("speech-dedupe-suppressed", {
      fingerprint: speechFingerprint,
      source: options.source || null,
    });
    return false;
  }
  rememberSpeechFingerprint(speechFingerprint);

  const res = await fetch("/v1/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: content, voice })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Speech API failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  if (!isSpeechRequestActive(requestId)) {
    return false;
  }
  const audioBuffer = await res.arrayBuffer();
  if (!isSpeechRequestActive(requestId)) {
    return false;
  }
  await playAudio(audioBuffer, { requestId });
  return isSpeechRequestActive(requestId);
}

async function speakMoment(text, voice = getActiveVoice()) {
  const requestId = claimSpeechRequest();
  try {
    const didSpeak = await speakText(text, voice, requestId, {
      dedupeKey: buildSpeechFingerprint(text, voice),
      source: "moment",
    });
    if (!didSpeak && !_audioPlaying) {
      setAuthoritativeTurnPhase("complete", {
        isSpeaking: false,
        isListening: false,
        isPaused: false,
      });
    }
  } catch (error) {
    if (!isSpeechRequestActive(requestId)) return;
    state.statusText = "Speech generation failed: " + error.message;
    state.statusError = true;
    render();
  }
}

function buildReadAloudButton(scope, label = "Read this section") {
  return `
    <button class="btn btn-ghost btn-sm read-aloud-btn" data-action="read-visible" data-scope="${esc(scope)}">
      ${esc(label)}
    </button>
  `;
}

function getBondStateForSpiritkin(spiritkinName) {
  const resonance = readJson(RESONANCE_KEY, {});
  const msgCount = resonance[spiritkinName] || 0;
  const currentBond = BOND_LEVELS.find((level) => msgCount >= level.min && msgCount <= level.max) || BOND_LEVELS[0];
  return {
    msgCount,
    currentBond,
    stageData: SPIRITVERSE_ECHOES.bond_stages[currentBond.stage]
  };
}

function getBondStageForCount(msgCount) {
  return (BOND_LEVELS.find((level) => msgCount >= level.min && msgCount <= level.max) || BOND_LEVELS[0]).stage;
}

function buildStoryGrowthItems(spiritkinName) {
  const echoes = SPIRITKIN_ECHOES[spiritkinName] || {};
  const realm = SPIRITVERSE_ECHOES.realms[spiritkinName];
  return [
    { stage: 0, label: "Origin", title: "First emergence", text: echoes.origin || "" },
    { stage: 1, label: "Nature", title: "How they stand beside you", text: echoes.nature || "" },
    { stage: 2, label: "Realm", title: realm?.name || "Realm memory", text: realm?.description || "" },
    { stage: 3, label: "Gifts", title: "What deepens in the bond", text: (echoes.gifts || []).slice(0, 3).join(". ") },
    { stage: 4, label: "Shadow", title: "What they are still learning", text: echoes.shadows || "" },
    { stage: 5, label: "Echoes", title: "Chronicle archive", text: `${spiritkinName}'s chronicle is stable enough to hold deeper founder memory, realm access, and future world hooks without flattening them into spectacle.` }
  ].filter((item) => item.text);
}

function buildFounderDomainChips(spiritkinName) {
  const domains = SPIRITKIN_ECHOES[spiritkinName]?.domains || [];
  if (!domains.length) return "";
  return `
    <div class="founder-domains">
      ${domains.map((domain) => `<span class="founder-domain-chip">${esc(domain)}</span>`).join("")}
    </div>
  `;
}

function buildBondStageTimeline(currentStage) {
  const stages = SPIRITVERSE_ECHOES.bond_stages || [];
  return `
    <div class="bond-stage-timeline">
      ${stages.map((stage) => `
        <article class="bond-stage-card ${stage.stage < currentStage ? "complete" : stage.stage === currentStage ? "current" : "locked"}">
          <div class="bond-stage-step">Stage ${stage.stage}</div>
          <strong>${esc(stage.name)}</strong>
          <p>${esc(stage.unlock || stage.description)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function buildEchoFragmentLibrary(spiritkinName, currentStage) {
  const fragments = SPIRITKIN_ECHOES[spiritkinName]?.echo_fragments || [];
  return `
    <div class="echoes-fragments">
      ${fragments.map((fragment, index) => {
        const unlocked = index <= currentStage;
        const stageName = SPIRITVERSE_ECHOES.bond_stages[Math.min(index, SPIRITVERSE_ECHOES.bond_stages.length - 1)]?.name || `Stage ${index}`;
        return unlocked ? `
          <div class="echoes-fragment-card">
            <div class="echoes-frag-head">
              <span class="echoes-frag-icon">◈</span>
              <strong>${esc(fragment.title)}</strong>
            </div>
            <p>${esc(fragment.text)}</p>
          </div>
        ` : `
          <div class="echoes-fragment-card locked">
            <div class="echoes-frag-head">
              <span class="echoes-frag-icon">🔒</span>
              <strong>Locked Chronicle Fragment</strong>
            </div>
            <p>Unlocks at ${esc(stageName)} when the bond has truthfully deepened further.</p>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function buildGovernanceSummary() {
  const governance = SPIRITVERSE_ECHOES.governance;
  if (!governance) return "";
  return `
    <div class="governance-panel">
      <div class="panel-label">SpiritCore Governance</div>
      <p class="governance-intro">${esc(governance.crownMind)}</p>
      <div class="governance-grid">
        ${(governance.principles || []).map((item) => `
          <article class="governance-card">
            <strong>${esc(item.title)}</strong>
            <p>${esc(item.text)}</p>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function buildGreatConvergenceHook() {
  const convergence = SPIRITVERSE_ECHOES.great_convergence;
  if (!convergence) return "";
  return `
    <div class="convergence-hook">
      <div class="panel-label">${esc(convergence.title)}</div>
      <p class="convergence-summary">${esc(convergence.summary)}</p>
      <div class="convergence-signs">
        ${(convergence.signs || []).map((sign) => `<div class="convergence-sign">${esc(sign)}</div>`).join("")}
      </div>
    </div>
  `;
}

function buildStoryGrowthPanel(spiritkinName, currentStage) {
  const items = buildStoryGrowthItems(spiritkinName);
  return `
    <div class="story-growth-panel">
      <div class="panel-label">Bond Story Growth</div>
      <p class="story-growth-intro">SpiritCore reveals more of ${esc(spiritkinName)}'s story as the bond matures.</p>
      <div class="story-growth-grid">
        ${items.map((item) => item.stage <= currentStage ? `
          <article class="story-growth-card unlocked">
            <div class="story-growth-stage">Stage ${item.stage}</div>
            <strong>${esc(item.title)}</strong>
            <div class="story-growth-label">${esc(item.label)}</div>
            <p>${esc(item.text)}</p>
          </article>
        ` : `
          <article class="story-growth-card locked">
            <div class="story-growth-stage">Stage ${item.stage}</div>
            <strong>${esc(item.title)}</strong>
            <div class="story-growth-label">${esc(item.label)}</div>
            <p>Deepen the bond to reveal this part of the chronicle.</p>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function buildBondStoryPreview(spiritkinName, currentStage) {
  const items = buildStoryGrowthItems(spiritkinName);
  const unlocked = items.filter((item) => item.stage <= currentStage);
  const latest = unlocked[unlocked.length - 1] || items[0];
  const next = items.find((item) => item.stage > currentStage) || null;
  if (!latest) return "";
  return `
    <div class="story-growth-panel">
      <div class="panel-label">Bond Story Growth</div>
      <p class="story-growth-intro">The bond reveals story slowly. What is visible now is the part your relationship has actually earned.</p>
      <article class="story-growth-card unlocked">
        <div class="story-growth-stage">Visible Now</div>
        <strong>${esc(latest.title)}</strong>
        <div class="story-growth-label">${esc(latest.label)}</div>
        <p>${esc(latest.text)}</p>
      </article>
      ${next ? `
        <article class="story-growth-card locked">
          <div class="story-growth-stage">Next Unlock</div>
          <strong>${esc(next.title)}</strong>
          <div class="story-growth-label">${esc(next.label)}</div>
          <p>Stay with ${esc(spiritkinName)} over time to reveal this next part of the chronicle.</p>
        </article>
      ` : ""}
    </div>
  `;
}

function buildPresenceTabNarration(tab, spiritkin, currentBond, stageData, depthEchoes) {
  if (!spiritkin) return "";
  const seed = (currentBond?.stage || 0) + (state.activeGame?.moveCount || 0) + (state.messages?.length || 0);
  if (tab === "profile") {
    return buildPresenceReaction("profile", spiritkin, seed);
  }
  if (tab === "echoes") {
    return buildPresenceReaction("echoes", spiritkin, seed + 1);
  }
  if (tab === "charter") {
    return buildPresenceReaction("charter", spiritkin, seed + 2);
  }
  if (tab === "games") {
    if (!state.activeGame) return buildPresenceReaction("games", spiritkin, seed + 3);
    if (state.activeGame.status === "ended") {
      return buildGameOutcomeReaction(spiritkin.name, state.activeGame) || buildPresenceReaction("games", spiritkin, seed + 4);
    }
    if (state.activeGame.turn === "user") {
      const line = buildPresenceReaction("games", spiritkin, seed + 5);
      return line ? `${line} Your move.` : "";
    }
    return buildGamePendingReaction(spiritkin.name, state.activeGame.type, state.activeGame.history?.length || 0);
  }
  if (tab === "journal") {
    return buildPresenceReaction("journal", spiritkin, seed + 6);
  }
  if (tab === "events") {
    return buildPresenceReaction("events", spiritkin, seed + 7);
  }
  if (tab === "quest") {
    return buildPresenceReaction("quest", spiritkin, seed + 8);
  }
  return "";
}

async function narratePresenceTab(tab) {
  const spiritkin = state.selectedSpiritkin || state.primarySpiritkin;
  if (!spiritkin || state.voiceMuted || state.gameLoading) return;
  cleanupSpeechLifecycle("presence-tab-narration", { renderOnFinish: false, clearStatus: false });
  const { currentBond, stageData } = getBondStateForSpiritkin(spiritkin.name);
  const depthEchoes = SPIRITKIN_ECHOES[spiritkin.name] || {};
  const line = buildPresenceTabNarration(tab, spiritkin, currentBond, stageData, depthEchoes);
  if (!line) return;
  await speakMoment(line, spiritkin.ui.voice || "nova");
}

function summarizeEntries(entries, limit = 3) {
  return (entries || [])
    .filter(Boolean)
    .slice(0, limit)
    .join(" ");
}

function resolveReadAloudIntent(text) {
  const input = String(text || "").trim().toLowerCase();
  if (!input) return null;
  if (!/^read\b/.test(input) && !/\bread\b/.test(input)) return null;

  if (input.includes("quest")) return "quest";
  if (input.includes("event")) return "events";
  if (input.includes("journal") || input.includes("memory")) return "journal";
  if (input.includes("charter") || input.includes("law")) return "charter";
  if (input.includes("echo") || input.includes("lore")) return "echoes";
  if (input.includes("game") || input.includes("board")) return "games";
  if (input.includes("profile") || input.includes("companion")) return "profile";
  if (input.includes("this") || input.includes("section")) return state.activePresenceTab;
  return null;
}

function resolveReadAloudPayload(scope = state.activePresenceTab) {
  const spiritkin = state.selectedSpiritkin || state.primarySpiritkin;
  if (!spiritkin) return null;

  const { currentBond, stageData } = getBondStateForSpiritkin(spiritkin.name);
  const depthEchoes = SPIRITKIN_ECHOES[spiritkin.name] || {};

  if (scope === "profile") {
    const gifts = summarizeEntries((depthEchoes.gifts || []).map((gift) => `${gift}.`), 3);
    return {
      voice: spiritkin.ui.voice || "nova",
      text: `${spiritkin.name}, ${spiritkin.title || spiritkin.role || "Spiritkin"}. Realm: ${spiritkin.ui.realm}. ${spiritkin.ui.realmText} Bond stage: ${stageData?.name || "Awakening"}. ${depthEchoes.nature || spiritkin.ui.atmosphereLine} ${gifts}`.trim()
    };
  }

  if (scope === "echoes") {
    const unlockedEchoes = (SPIRITKIN_ECHOES[spiritkin.name]?.echo_fragments || []).slice(0, currentBond.stage + 1);
    const fragments = unlockedEchoes.map((fragment) => `${fragment.title}. ${fragment.text}`).join(" ");
    return {
      voice: spiritkin.ui.voice || "nova",
      text: fragments || `${spiritkin.name}'s Echoes have not opened yet. Strengthen the bond to reveal more.`
    };
  }

  if (scope === "charter") {
    const unlockedLaws = SPIRITVERSE_ECHOES.charter.laws.slice(0, currentBond.stage + 1);
    return {
      voice: spiritkin.ui.voice || "nova",
      text: `${SPIRITVERSE_ECHOES.charter.preamble} ${unlockedLaws.join(" ")}`
    };
  }

  if (scope === "games") {
    if (!state.activeGame) {
      return {
        voice: spiritkin.ui.voice || "nova",
        text: `The Games Chamber is quiet. You can begin Celestial Chess, Veil Checkers, Spirit Cards, Echo Trials, TicTacToe of Echoes, Connect Four Constellations, or Abyssal Battleship with ${spiritkin.name}.`
      };
    }
    const lastMoves = summarizeEntries((state.activeGame.history || []).slice(-3).map((entry) => {
      const player = entry.player === "user" ? "You" : spiritkin.name;
      return `${player} played ${entry.move}.`;
    }), 3);
    return {
      voice: spiritkin.ui.voice || "nova",
      text: `${state.activeGame.name || state.activeGame.type} is active. ${state.activeGame.turn === "user" ? "It is your turn." : `${spiritkin.name} is considering the board.`} ${state.gameSpiritkinMessage || ""} ${lastMoves}`.trim()
    };
  }

  if (scope === "journal") {
    if (!state.bondJournal) {
      return {
        voice: spiritkin.ui.voice || "nova",
        text: `The bond journal is still gathering what SpiritCore has witnessed between you and ${spiritkin.name}.`
      };
    }
    const memoryLines = summarizeEntries((state.bondJournal.memories || []).map((memory) => `${memory.kind || "memory"}. ${memory.content || ""}`), 2);
    return {
      voice: spiritkin.ui.voice || "nova",
      text: `Bond stage ${state.bondJournal.bondStageName || "First Contact"}. Games played: ${state.bondJournal.gamesCompleted ?? 0}. Echoes awakened: ${state.bondJournal.unlockedEchoCount ?? 0}. ${memoryLines}`.trim()
    };
  }

  if (scope === "events") {
    if (!state.spiritverseEvent) {
      return {
        voice: spiritkin.ui.voice || "nova",
        text: "There is no active realm event at the moment. The Spiritverse is quiet."
      };
    }
    return {
      voice: spiritkin.ui.voice || "nova",
      text: `${state.spiritverseEvent.title}. ${state.spiritverseEvent.description} ${state.spiritverseEvent.effect || ""}`.trim()
    };
  }

  if (scope === "quest") {
    if (!state.dailyQuest) {
      return {
        voice: spiritkin.ui.voice || "nova",
        text: `There is no daily quest ready yet. Begin a conversation with ${spiritkin.name} and SpiritCore will generate one.`
      };
    }
    return {
      voice: spiritkin.ui.voice || "nova",
      text: `${state.dailyQuest.title}. ${state.dailyQuest.description} ${state.dailyQuest.prompt || ""}`.trim()
    };
  }

  return null;
}

async function performReadAloud(scope = state.activePresenceTab) {
  const payload = resolveReadAloudPayload(scope);
  if (!payload) {
    state.statusText = "There is nothing readable in this section yet.";
    state.statusError = false;
    render();
    return false;
  }

  cleanupSpeechLifecycle("read-aloud", { renderOnFinish: false, clearStatus: false });
  state.voiceMuted = false;
  localStorage.setItem("sk_voice_muted", "0");
  state.statusText = "Reading the visible section aloud...";
  state.statusError = false;
  render();
  await speakMoment(payload.text, payload.voice);
  return true;
}

async function deliverConversationGreeting(context = "newSession") {
  const spiritkin = state.selectedSpiritkin;
  if (!spiritkin || state.messages.some((message) => message.role === "assistant")) return;
  const greetingMessage = pushAssistantMoment(buildGreetingText(spiritkin.name, context), {
    spiritkinName: spiritkin.name,
    spiritkinVoice: spiritkin.ui.voice || "nova"
  });
  render();
  scrollThread({ reveal: true });
  maybeSpeakMessageLater(greetingMessage?.id, { armUserTurn: shouldKeepVoiceLoopActive() });
}

function persistSession() {
  const previousRetentionSnapshot = readJson(RETENTION_STATE_KEY, null);
  const sessionSnapshot = buildSessionSnapshot();
  if (state.primarySpiritkin) writeJson(PRIMARY_KEY, state.primarySpiritkin);
  if (sessionSnapshot) {
    writeJson(SESSION_KEY, sessionSnapshot);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  writeJson(RATINGS_KEY, state.ratings);
  if (state.primarySpiritkin?.name) {
    updateSpiritkinEvolution(state.primarySpiritkin.name, {});
  }
  maybeRegisterUnlockTelemetry(previousRetentionSnapshot);
  refreshRetentionSurface({
    previousSnapshot: previousRetentionSnapshot,
    telemetry: normalizeRetentionTelemetry(readJson(RETENTION_TELEMETRY_KEY, null)),
    preserveVisibility: true
  });
  writeRetentionState();
  logContinuityDebug("session-persisted", {
    persistedConversationId: state.conversationId || null,
    persistedSelectedSpiritkin: state.selectedSpiritkin?.name || null,
    persistedMessageCount: Array.isArray(state.messages) ? Math.min(state.messages.length, 80) : 0,
    activePresenceTabPersisted: sessionSnapshot?.activePresenceTab || null,
    showHomeViewPersisted: !!sessionSnapshot?.showHomeView,
    activeGamePersisted: false,
    voiceStatePersisted: !!sessionSnapshot?.pendingVoiceResume,
  });
}

let _activeGameRestoreRunId = 0;

async function restoreActiveGameState(options = {}) {
  const {
    conversationId = state.conversationId,
    silent = true,
    renderOnFinish = true
  } = options;

  if (!conversationId || !state.userId) return null;

  const requestedConversationId = String(conversationId).trim();
  if (!requestedConversationId) return null;

  const runId = ++_activeGameRestoreRunId;
  logGameDebug("restore-game-begin", {
    conversationId: requestedConversationId,
    silent,
    currentGameType: state.activeGame?.type || null,
  });

  try {
    const res = await fetch(`${API}/v1/games/state/${encodeURIComponent(requestedConversationId)}?userId=${encodeURIComponent(state.userId)}`);
    const data = await res.json();

    if (runId !== _activeGameRestoreRunId || requestedConversationId !== state.conversationId) {
      logGameDebug("restore-game-stale", {
        conversationId: requestedConversationId,
        runId,
        latestRunId: _activeGameRestoreRunId,
        activeConversationId: state.conversationId || null,
      });
      return null;
    }

    if (!data.ok) {
      throw new Error(data.message || "Failed to restore game state.");
    }

    if (data.session) {
      applySessionSnapshot(data.session, "backend-game-restore");
    }

    const restoredGame = normalizeActiveGame(data.game);
    state.activeGame = restoredGame;
    state.gameActive = !!(restoredGame && restoredGame.status === "active");

    if (!restoredGame) {
      state.gameSpiritkinMessage = null;
      state.gameInstructions = null;
      state.gameEchoGuide = null;
      state.gameHelpOpen = false;
      state.gameHelpFirstRun = false;
    } else if (!state.gameHelpSeen?.[restoredGame.type]) {
      state.gameHelpOpen = true;
      state.gameHelpFirstRun = true;
      markGameHelpSeen(restoredGame.type);
    }

    logGameDebug("restore-game-success", {
      conversationId: requestedConversationId,
      restoredType: restoredGame?.type || null,
      restoredStatus: restoredGame?.status || null,
      restoredTurn: restoredGame?.turn || null,
      historyLength: Array.isArray(restoredGame?.history) ? restoredGame.history.length : 0,
    });

    if (renderOnFinish) render();
    return restoredGame;
  } catch (err) {
    logGameDebug("restore-game-error", {
      conversationId: requestedConversationId,
      silent,
      error: err?.message || String(err),
    });
    if (!silent) {
      state.statusText = "Could not restore the current game.";
      state.statusError = true;
      if (renderOnFinish) render();
    }
    return null;
  }
}

async function fetchSpiritkins() {
  state.loadingSpirits = true;
  state.spiritError = null;
  render();
  try {
    const res = await fetch(`${API}/v1/spiritkins`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "Could not load companions.");
    state.spiritkins = mergeFoundingPillars(
      (data.spiritkins || []).filter((spiritkin) => spiritkin.is_canon !== false)
    );
    if (state.primarySpiritkin) {
      const livePrimary = state.spiritkins.find((spiritkin) => spiritkin.name === state.primarySpiritkin.name);
      if (livePrimary) state.primarySpiritkin = livePrimary;
    }
    if (state.selectedSpiritkin) {
      const live = state.spiritkins.find((spiritkin) => spiritkin.name === state.selectedSpiritkin.name);
      if (live) state.selectedSpiritkin = live;
    }
    syncPrimarySelection();
    persistSession();
  } catch (error) {
    state.spiritError = error.message;
  }
  state.loadingSpirits = false;
  render();
}

// ── Phase 6: Fetch Spiritverse Event ────────────────────────────────────────
async function fetchSpiritverseEvent() {
  if (!state.primarySpiritkin) return;
  state.spiritverseEventLoading = true;
  try {
    const resonance = readJson(RESONANCE_KEY, {});
    const msgCount = resonance[state.primarySpiritkin.name] || 0;
    const bondStage = getBondStageForCount(msgCount);
    const res = await fetch(`${API}/v1/spiritverse/events/current?bondStage=${bondStage}`);
    const data = await res.json();
    if (data.ok) {
      state.spiritverseEvent = data.event;
      state.spiritverseTemporal = data.temporal || getLocalTemporalWorldState();
      state.spiritverseEventNext = data.next;
      persistSession();
      refreshRetentionSurface({ preserveVisibility: true });
    }
  } catch (err) {
    // Graceful fallback — events are not critical
  }
  state.spiritverseEventLoading = false;
  render();
}

// ── Phase 7: Fetch Daily Quest ────────────────────────────────────────────────
async function fetchDailyQuest() {
  if (!state.primarySpiritkin || !state.userId) return;
  state.dailyQuestLoading = true;
  try {
    const resonance = readJson(RESONANCE_KEY, {});
    const msgCount = resonance[state.primarySpiritkin.name] || 0;
    const bondStage = getBondStageForCount(msgCount);
    const params = new URLSearchParams({
      userId: state.userId,
      spiritkinName: state.primarySpiritkin.name,
      bondStage: String(bondStage)
    });
    const res = await fetch(`${API}/v1/quests/daily?${params}`);
    const data = await res.json();
    if (data.ok) {
      state.dailyQuest = data.quest;
      state.dailyQuestRefreshesIn = data.refreshesIn;
      persistSession();
      refreshRetentionSurface({ preserveVisibility: true });
    }
  } catch (err) {
    // Graceful fallback
  }
  state.dailyQuestLoading = false;
  render();
}

function setPrimarySpiritkin(spiritkin) {
  state.primarySpiritkin = spiritkin;
  state.selectedSpiritkin = spiritkin;
  state.showHomeView = false;
  state.pendingBondSpiritkin = null;
  state.rebondSpiritkin = null;
  // Reload events and quest for new spiritkin
  state.spiritverseEvent = null;
  state.dailyQuest = null;
  state.dailyQuestStarted = false;
  setTimeout(() => { fetchSpiritverseEvent(); fetchDailyQuest(); }, 200);
  state.conversationId = null;
  state.messages = [];
  state.convError = null;
  state.statusText = `${spiritkin.name} is now your primary companion.`;
  state.statusError = false;
  normalizeInteractionState("setPrimarySpiritkin");
  persistSession();
}

function openCrownGate() {
  if (state.crownGateOpening || state.entryTransitioning) {
    console.info("[SpiritGate] enter-click-blocked", { reason: "reentrant-open", snapshot: getInteractionStateSnapshot() });
    logSpiritGate("entry-blocked-reentrant-open", {});
    return;
  }
  console.info("[SpiritGate] enter-click-fired", getInteractionStateSnapshot());
  logSpiritGate("entry-clicked", { action: "continue" });
  if (requiresEntryConsent() && !state.consentChecked) {
    console.info("[SpiritGate] enter-click-blocked", { reason: "consent-required", snapshot: getInteractionStateSnapshot() });
    logSpiritGate("entry-blocked-consent", { action: "continue" });
    state.statusText = "Accept the entry consent to continue into the Spiritverse.";
    state.statusError = true;
    render();
    return;
  }
  attemptSpiritGateFullscreen();
  state.userName = state.userNameDraft.trim();
  if (state.userName) localStorage.setItem(NAME_KEY, state.userName);
  if (state.consentChecked && !state.consentAccepted) {
    persistEntryConsent();
  }
  clearSpiritGateFallback();
  clearSpiritGateArrivalFallback();
  clearSpiritGateTransitionTimers();
  cleanupSpeechLifecycle("open-crown-gate", { renderOnFinish: false, clearStatus: false });
  spiritGateActiveAttemptId += 1;
  state.crownGateOpening = true;
  state.showCrownGateHome = false;
  state.entryVideoStarted = true;
  state.entryTransitioning = false;
  state.spiritverseTrailerActive = false;
  state.spiritCoreWelcoming = false;
  console.info("[SpiritGate] route-video-start", { action: "continue", snapshot: getInteractionStateSnapshot() });
  console.info("Gate video start", getInteractionStateSnapshot());
  armSpiritGatePlaybackSafety("gate-route-start");
  state.statusText = state.mediaMuted
    ? "The Crown Gate opens around you. Sound is resting until you invite it in."
    : "The Crown Gate opens around you...";
  state.statusError = false;
  normalizeInteractionState("openCrownGate");
  render();
  revealCurrentFocus({ selector: ".entry-screen-gate" });
}

async function finalizeCrownGateRoute({ skipped = false, source = "unspecified" } = {}) {
  exitSpiritGateFullscreen();
  state.entryAccepted = true;
  state.entryTransitioning = false;
  state.showHomeView = true;
  state.showCrownGateHome = false;
  logContinuityDebug("post-gate-route-begin", { skipped, source, route: getPostGateRoute() });

  const route = getPostGateRoute();
  logSpiritGate("entry-route-resolved", { route, skipped, source });
  if (route === "first-run") {
    state.spiritverseTrailerActive = false;
    state.statusText = "SpiritCore is welcoming you...";
    armSpiritGateArrivalPlaybackSafety("arrival-route-start");
    render();
    await beginSpiritCoreWelcome();
    return;
  }

  state.spiritverseTrailerActive = false;
  render();
  if (route === "bonded-home" && state.primarySpiritkin && !state.voiceMuted) {
    cleanupSpeechLifecycle("post-gate-returning-user-greeting", { renderOnFinish: false, clearStatus: false });
    await speakMoment(buildGreetingText(state.primarySpiritkin.name, "returningUser"), state.primarySpiritkin.ui.voice || "nova");
  }
  logContinuityDebug("post-gate-route-complete", { skipped, source, route });
}

function completeCrownGateEntry({ skipped = false, source = "unspecified", force = false } = {}) {
  if (state.entryTransitioning && !force) {
    logSpiritGate("entry-complete-ignored", { source });
    return;
  }
  logSpiritGate("entry-completing", { skipped, source, force });
  clearSpiritGateFallback();
  clearSpiritGateArrivalFallback();
  clearSpiritGateTransitionTimers();
  spiritGateActiveAttemptId += 1;
  state.crownGateOpening = false;
  state.entryVideoStarted = false;
  state.entryTransitioning = !!skipped;
  state.statusText = skipped ? "Crossing the threshold..." : "The world is settling around you...";
  state.statusError = false;
  render();
  revealCurrentFocus({ selector: ".entry-screen-gate" });

  if (skipped) {
    window.setTimeout(async () => {
      try {
        await finalizeCrownGateRoute({ skipped, source });
      } catch (error) {
        failSpiritGateEntry("SpiritGate entry failed. Refresh and try again.", error, { source, skipped });
      }
    }, 280);
    return;
  }

  spiritGateTransitionRevealTimer = window.setTimeout(() => {
    state.entryTransitioning = true;
    state.statusText = "Crossing the threshold...";
    state.statusError = false;
    render();

    spiritGateTransitionRouteTimer = window.setTimeout(async () => {
      try {
        await finalizeCrownGateRoute({ skipped, source });
      } catch (error) {
        failSpiritGateEntry("SpiritGate entry failed. Refresh and try again.", error, { source, skipped });
      }
    }, ENTRY_TRANSITION_MS + SPIRITGATE_POST_COPY_SETTLE_MS);
  }, SPIRITGATE_POST_VIDEO_PAUSE_MS);
}

async function beginSpiritCoreWelcome() {
  if (state.spiritCoreWelcoming) return;
  clearSpiritGateArrivalFallback();
  state.spiritverseTrailerActive = false;
  state.spiritCoreWelcoming = true;
  state.statusText = "SpiritCore is welcoming you...";
  state.statusError = false;
  render();

  await new Promise((resolve) => window.setTimeout(resolve, 700));
  if (!state.voiceMuted) {
    cleanupSpeechLifecycle("spiritcore-welcome", { renderOnFinish: false, clearStatus: false });
    await speakMoment(SPIRITCORE_WELCOME_TEXT, SPIRITCORE_WELCOME_VOICE);
  } else {
    await new Promise((resolve) => window.setTimeout(resolve, 4200));
  }

  markOnboardingComplete();
  state.spiritCoreWelcoming = false;
  state.statusText = "Meet the Founding Pillars. Bond with one when the recognition feels real.";
  state.statusError = false;
  render();
}

function goHome() {
  logContinuityDebug("go-home", {
    fromConversationId: state.conversationId || null,
    fromTab: state.activePresenceTab,
    fromGame: state.activeGame?.type || null,
  });
  syncPrimarySelection();
  clearSpiritGateFallback();
  clearSpiritGateArrivalFallback();
  clearSpiritGateTransitionTimers();
  spiritGateActiveAttemptId += 1;
  state.showCrownGateHome = true;
  state.entryAccepted = false;
  state.crownGateOpening = false;
  state.entryVideoStarted = false;
  state.entryTransitioning = false;
  state.spiritverseTrailerActive = false;
  state.spiritCoreWelcoming = false;
  state.showHomeView = true;
  state.realmTravelOpen = false;
  state.activePresenceTab = "profile";
  cleanupSpeechLifecycle("go-home", { renderOnFinish: false, clearStatus: false });
  state.statusText = state.primarySpiritkin
    ? `Returned to the Crown Gate. ${state.primarySpiritkin.name} remains bonded.`
    : "Returned to the Crown Gate.";
  state.statusError = false;
  normalizeInteractionState("goHome");
  persistSession();
  syncSessionControlSoon({
    currentSurface: "profile",
    currentMode: "bond_home",
    activeTab: "profile",
    speechState: { turnPhase: "complete" },
  });
  render();
  revealCurrentFocus({ selector: "[data-focus-anchor='entry-copy'], .entry-screen-gate" });
}

function startFreshSession() {
  logContinuityDebug("start-fresh-session", {
    previousConversationId: state.conversationId || null,
    previousMessageCount: Array.isArray(state.messages) ? state.messages.length : 0,
  });
  syncPrimarySelection();
  cleanupSpeechLifecycle("start-fresh-session", { renderOnFinish: false, clearStatus: false });
  _lastAutoSpokenMessageId = null;
  state.showHomeView = false;
  state.conversationId = null;
  state.messages = [];
  state.convError = null;
  state.statusText = state.primarySpiritkin
    ? `Session reset. ${state.primarySpiritkin.name} remains your bonded companion.`
    : "";
  state.statusError = false;
  normalizeInteractionState("startFreshSession");
  persistSession();
  setAuthoritativeTurnPhase("idle", { isSpeaking: false, isListening: false, isPaused: false, lastUtteranceId: null });
  syncSessionControlSoon({
    conversationId: null,
    currentSurface: "selection",
    currentMode: "selection",
    activeTab: "profile",
    speechState: { turnPhase: "idle", lastUtteranceId: null },
  });
  render();
}

async function beginConversation() {
  logContinuityDebug("begin-conversation-request", {
    selectedSpiritkin: state.selectedSpiritkin?.name || null,
    existingConversationId: state.conversationId || null,
    showHomeView: !!state.showHomeView,
  });
  syncPrimarySelection();
  if (!state.selectedSpiritkin) return;
  state.showCrownGateHome = false;
  if (state.conversationId && state.showHomeView) {
    state.showHomeView = false;
    render();
    scrollThread({ reveal: true });
    return;
  }
  cleanupSpeechLifecycle("begin-conversation", { renderOnFinish: false, clearStatus: false });
  state.showHomeView = false;
  state.loadingConv = true;
  state.convError = null;
  render();
  try {
    const res = await fetch(`${API}/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: state.userId,
        spiritkinName: state.selectedSpiritkin.name
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "Could not begin conversation.");
    state.conversationId = data.conversation?.conversation_id ?? data.conversation?.id ?? data.conversationId;
    if (!state.conversationId) throw new Error("No conversation ID returned.");
    _lastAutoSpokenMessageId = null;
    if (!(data.session && applySessionSnapshot(data.session, "conversation-bootstrap"))) {
      state.messages = [];
    }
    state.statusText = `Linked with ${state.selectedSpiritkin.name}.`;
    state.statusError = false;
    setAuthoritativeTurnPhase("idle", { isSpeaking: false, isListening: false, isPaused: false, lastUtteranceId: null });
    persistSession();
    await syncSessionControl({
      conversationId: state.conversationId,
      currentSpiritkinName: state.selectedSpiritkin.name,
      currentSurface: deriveCurrentSurfaceFromUI(),
      currentMode: deriveCurrentModeFromUI(),
      activeTab: state.activePresenceTab || "profile",
      speechState: { turnPhase: "idle", lastUtteranceId: null },
    });
    logContinuityDebug("begin-conversation-success", {
      conversationId: state.conversationId,
      selectedSpiritkin: state.selectedSpiritkin?.name || null,
    });
    // Start wellness session timer
    startSessionTimer();
    // Process engagement state from backend
    if (data.engagement) {
      const eng = data.engagement;
      if (eng.whisper?.text) {
        state.engagementWhisper = eng.whisper;
        state.showWhisperBanner = true;
      }
      if (Array.isArray(eng.milestones) && eng.milestones.length > 0) {
        state.engagementMilestones = eng.milestones;
      }
      if (Array.isArray(eng.echoUnlocks) && eng.echoUnlocks.length > 0) {
        state.engagementEchoUnlocks = eng.echoUnlocks;
        state.currentEchoUnlock = eng.echoUnlocks[0];
        state.showEchoUnlock = true;
      }
      if (eng.wellnessNudge?.text) {
        state.engagementWellnessNudge = eng.wellnessNudge;
      }
    }
  } catch (error) {
    logContinuityDebug("begin-conversation-failed", {
      selectedSpiritkin: state.selectedSpiritkin?.name || null,
      error: error.message,
    });
    state.convError = error.message;
    state.statusText = error.message;
    state.statusError = true;
  }
  state.loadingConv = false;
  normalizeInteractionState("beginConversation");
  render();
  revealCurrentFocus({ selector: ".chat-stage, .thread-wrap" });
  scrollThread({ reveal: true });
  if (!state.convError && state.conversationId) {
    await deliverConversationGreeting("newSession");
  }
}

async function sendMessage(overrideText) {
  syncPrimarySelection();
  const text = (overrideText ?? state.input).trim();
  if (!text || state.loadingReply) return;
  if (isDuplicateUserSubmission(text)) return;
  cleanupSpeechLifecycle("send-message", { renderOnFinish: false, clearStatus: false });
  if (overrideText !== undefined) {
    state.voiceTranscriptPreview = text;
  }
  markUserSubmission(text, overrideText === undefined ? "text" : "voice");
  updateAdaptiveProfileFromUserText(text);
  state.showCrownGateHome = false;
  state.showHomeView = false;
  const readScope = resolveReadAloudIntent(text);
  if (readScope) {
    state.input = "";
    await performReadAloud(readScope);
    return;
  }
  if (!state.conversationId) return;
  state.input = "";
  const outgoingId = uuid();
  state.messages.push({ id: outgoingId, role: "user", content: text, time: nowIso(), status: "sent" });
  state.loadingReply = true;
  setAuthoritativeTurnPhase("processing", {
    isSpeaking: false,
    isListening: false,
    isPaused: false,
  });
  state.convError = null;
  state.statusText = `Receiving ${state.selectedSpiritkin?.name || "Spiritkin"}...`;
  state.statusError = false;
  logContinuityDebug("send-message", {
    conversationId: state.conversationId || null,
    selectedSpiritkin: state.selectedSpiritkin?.name || null,
    source: overrideText === undefined ? "text" : "voice",
    textLength: text.length,
  });
  render();
  scrollThread({ reveal: true });

  try {
    const res = await fetch(`${API}/v1/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: state.userId,
        conversationId: state.conversationId,
        input: text,
        context: buildAdaptiveRequestContext()
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "Reply interrupted.");
    const sessionApplied = !!(data.session && applySessionSnapshot(data.session, "backend-interact"));
    if (!sessionApplied && data.metadata?.spiritCore) {
      state.spiritCore = data.metadata.spiritCore;
      state.sessionModel = {
        ...(state.sessionModel || createDefaultSessionModel()),
        spiritCore: data.metadata.spiritCore,
      };
    }
    const reply = data.message ?? data.output ?? data.response?.text ?? data.response ?? "...";
    const tags = Array.isArray(data.metadata?.tags) ? data.metadata.tags.filter((tag) => typeof tag === "string") : [];
    const emotionTone = sanitizeTone(data.metadata?.emotion?.tone);
    const sceneName = sanitizeScene(data.metadata?.world?.scene?.name);
    const assistantMsgId = uuid();
    const resolvedAssistantMessageId = sessionApplied
      ? ([...state.messages].reverse().find((message) => message?.role === "assistant" && String(message.content || "").trim() === String(reply || "").trim())?.id || assistantMsgId)
      : assistantMsgId;
    const spiritkinVoice = state.selectedSpiritkin?.ui?.voice || "nova";
    if (!sessionApplied) {
      state.messages.push({
        id: assistantMsgId,
        role: "assistant",
        content: reply,
        spiritkinName: state.selectedSpiritkin?.name,
        spiritkinVoice,
        time: nowIso(),
        status: "sent",
        tags,
        memoryActive: tags.includes("memory:active"),
        emotionTone,
        sceneName
      });
    }
    observeAssistantStyle(reply);
    state.statusText = `${state.selectedSpiritkin?.name || "Spiritkin"} is with you.`;
    state.statusError = false;
    if (data.metadata?.world?.game) {
      state.activeGame = normalizeActiveGame(data.metadata.world.game);
    }
    setAuthoritativeTurnPhase("spirit_response", {
      isSpeaking: !state.voiceMuted,
      isListening: false,
      isPaused: false,
      lastUtteranceId: resolvedAssistantMessageId,
    });
    logContinuityDebug("receive-message", {
      conversationId: state.conversationId || null,
      replyLength: String(reply || "").length,
      worldScene: sceneName || null,
      worldGameType: data.metadata?.world?.game?.type || null,
      voiceAutoplay: !state.voiceMuted,
    });
    persistSession();
    // Increment resonance counter for this Spiritkin
    if (state.selectedSpiritkin?.name) {
      const resonance = readJson(RESONANCE_KEY, {});
      resonance[state.selectedSpiritkin.name] = (resonance[state.selectedSpiritkin.name] || 0) + 1;
      writeJson(RESONANCE_KEY, resonance);
    }
    // Auto-speak through the scheduler so one assistant turn only produces one playback lifecycle.
    if (!state.voiceMuted) {
      maybeSpeakMessageLater(resolvedAssistantMessageId, { armUserTurn: shouldKeepVoiceLoopActive() });
    }
  } catch (error) {
    logContinuityDebug("send-message-failed", {
      conversationId: state.conversationId || null,
      error: error.message,
    });
    state.messages = state.messages.map((message) => (
      message.id === outgoingId ? { ...message, status: "failed" } : message
    ));
    state.convError = error.message;
    state.statusText = error.message;
    state.statusError = true;
    setAuthoritativeTurnPhase("complete", {
      isSpeaking: false,
      isListening: false,
      isPaused: false,
    });
  }
  state.loadingReply = false;
  if (overrideText !== undefined) {
    state.voiceTranscriptPreview = "";
  }
  render();
  scrollThread({ reveal: true });
}

function centerViewportOn(selector, options = {}) {
  const {
    block = "center",
    delay = 0,
  } = options;
  const run = () => {
    requestAnimationFrame(() => {
      const target = document.querySelector(selector);
      if (!target || typeof target.scrollIntoView !== "function") return;
      target.scrollIntoView({ behavior: "smooth", block, inline: "nearest" });
    });
  };
  if (delay > 0) {
    window.setTimeout(run, delay);
    return;
  }
  run();
}

function revealCurrentFocus(options = {}) {
  const selector = options.selector || (
    (state.crownGateOpening || state.entryTransitioning || state.entryVideoStarted)
      ? ".entry-screen-gate"
      : (state.activePresenceTab === "games" && state.activeGame)
        ? ".active-game-panel"
        : ".chat-stage"
  );
  centerViewportOn(selector, options);
}

function attemptSpiritGateFullscreen() {
  const target = document.querySelector(".entry-screen-gate") || document.documentElement;
  const requestFullscreen =
    target?.requestFullscreen ||
    target?.webkitRequestFullscreen ||
    target?.msRequestFullscreen;
  const alreadyFullscreen =
    !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  if (!requestFullscreen || alreadyFullscreen) return;
  try {
    const result = requestFullscreen.call(target);
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch (_) {}
}

function exitSpiritGateFullscreen() {
  const exitFullscreen =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;
  const isFullscreen =
    !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  if (!exitFullscreen || !isFullscreen) return;
  try {
    const result = exitFullscreen.call(document);
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch (_) {}
}

function scrollThread(options = {}) {
  const { reveal = false, targetSelector = ".thread .bubble:last-child" } = options;
  requestAnimationFrame(() => {
    const thread = document.querySelector(".thread-wrap");
    if (thread) thread.scrollTop = thread.scrollHeight;
    if (reveal) {
      const focusTarget = document.querySelector(targetSelector) || document.querySelector(".chat-stage");
      if (focusTarget && typeof focusTarget.scrollIntoView === "function") {
        focusTarget.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }
  });
}

function submitFeedback(messageId, helpful) {
  if (state.ratings[messageId]) return;
  state.ratings[messageId] = helpful ? "up" : "down";
  persistSession();
  const message = state.messages.find((item) => item.id === messageId);
  fetch(`${API}/v1/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: state.userId,
      conversationId: state.conversationId,
      spiritkinName: message?.spiritkinName ?? state.selectedSpiritkin?.name ?? "unknown",
      rating: helpful ? 5 : 1,
      helpful,
      messageId
    })
  }).catch(() => {});
  render();
}

function cloneGameState(game) {
  if (!game) return game;
  if (typeof structuredClone === "function") return structuredClone(game);
  return JSON.parse(JSON.stringify(game));
}

function applyOptimisticChessMove(fen, move) {
  const parts = String(fen || "").split(" ");
  if (!parts[0]) return null;
  const match = String(move || "").match(/^([a-h])([1-8])([a-h])([1-8])$/i);
  if (!match) return null;

  const board = parts[0]
    .split("/")
    .map((row) => row.replace(/\d/g, (digit) => " ".repeat(parseInt(digit, 10))).split(""));

  const fromCol = match[1].toLowerCase().charCodeAt(0) - 97;
  const fromRow = 8 - parseInt(match[2], 10);
  const toCol = match[3].toLowerCase().charCodeAt(0) - 97;
  const toRow = 8 - parseInt(match[4], 10);

  if (!board[fromRow] || board[fromRow][fromCol] === undefined) return null;
  board[toRow][toCol] = board[fromRow][fromCol];
  board[fromRow][fromCol] = " ";

  const nextBoard = board.map((row) => row.join("").replace(/ +/g, (spaces) => spaces.length)).join("/");
  const nextTurn = parts[1] === "w" ? "b" : "w";
  return `${nextBoard} ${nextTurn} - - 0 1`;
}

function applyOptimisticCheckersMove(board, move) {
  if (!Array.isArray(board)) return null;
  const parts = String(move || "").split("-");
  if (parts.length !== 2) return null;

  const from = parseInt(parts[0], 10);
  const to = parseInt(parts[1], 10);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
  if (from < 0 || from >= board.length || to < 0 || to >= board.length) return null;
  if (!board[from]) return null;

  const nextBoard = [...board];
  nextBoard[to] = nextBoard[from];
  nextBoard[from] = null;
  if (Math.abs(to - from) > 5) {
    nextBoard[Math.floor((from + to) / 2)] = null;
  }
  return nextBoard;
}

function applyOptimisticGoMove(board, move) {
  if (!Array.isArray(board)) return null;
  const size = 13;
  const match = String(move || "").match(/^([A-M])([1-9]|1[0-3])$/i);
  if (!match) return null;

  const col = match[1].toUpperCase().charCodeAt(0) - 65;
  const row = size - parseInt(match[2], 10);
  const idx = row * size + col;
  if (idx < 0 || idx >= board.length) return null;

  const nextBoard = [...board];
  nextBoard[idx] = "black";
  return nextBoard;
}

function detectOptimisticLineWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function applyOptimisticTicTacToeMove(board, move) {
  if (!Array.isArray(board)) return null;
  const idx = parseInt(move, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= 9 || board[idx]) return null;
  const nextBoard = [...board];
  nextBoard[idx] = "X";
  return nextBoard;
}

function detectOptimisticConnectFourWinner(board) {
  const width = 7;
  const height = 6;
  const at = (r, c) => board[r * width + c];
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const cell = at(r, c);
      if (!cell) continue;
      if (c <= width - 4 && cell === at(r, c + 1) && cell === at(r, c + 2) && cell === at(r, c + 3)) return cell;
      if (r <= height - 4 && cell === at(r + 1, c) && cell === at(r + 2, c) && cell === at(r + 3, c)) return cell;
      if (r <= height - 4 && c <= width - 4 && cell === at(r + 1, c + 1) && cell === at(r + 2, c + 2) && cell === at(r + 3, c + 3)) return cell;
      if (r >= 3 && c <= width - 4 && cell === at(r - 1, c + 1) && cell === at(r - 2, c + 2) && cell === at(r - 3, c + 3)) return cell;
    }
  }
  return null;
}

function applyOptimisticConnectFourMove(board, move) {
  if (!Array.isArray(board)) return null;
  const col = parseInt(move, 10);
  if (!Number.isInteger(col) || col < 0 || col > 6) return null;
  const nextBoard = [...board];
  for (let row = 5; row >= 0; row -= 1) {
    const idx = row * 7 + col;
    if (!nextBoard[idx]) {
      nextBoard[idx] = "U";
      return nextBoard;
    }
  }
  return null;
}

function applyOptimisticBattleshipMove(data, move) {
  if (!data || typeof data !== "object") return null;
  const idx = parseInt(move, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= 25) return null;
  const guesses = Array.isArray(data.userGuesses) ? [...data.userGuesses] : [];
  if (guesses.includes(idx)) return null;
  const hits = {
    user: Array.isArray(data.hits?.user) ? [...data.hits.user] : [],
    spiritkin: Array.isArray(data.hits?.spiritkin) ? [...data.hits.spiritkin] : [],
  };
  guesses.push(idx);
  if (Array.isArray(data.spiritkinTargets) && data.spiritkinTargets.includes(idx)) {
    hits.user.push(idx);
  }
  return {
    ...cloneGameState(data),
    userGuesses: guesses,
    hits,
    lastMove: String(idx),
  };
}

function pushAssistantMoment(content, overrides = {}) {
  const text = String(content || "").trim();
  if (!text) return null;
  const message = createLocalAssistantMessage(text, overrides);
  state.messages.push(message);
  observeAssistantStyle(text);
  persistSession();
  return message;
}

function maybeSpeakMessageLater(messageId, options = {}) {
  if (!messageId || state.voiceMuted) return;
  if (_scheduledAutoSpeechMessageId === messageId || _lastAutoSpokenMessageId === messageId) {
    logContinuityDebug("auto-speech-skipped-duplicate", { messageId });
    return;
  }
  _scheduledAutoSpeechMessageId = messageId;
  Promise.resolve()
    .then(async () => {
      if (state.voiceMuted || _scheduledAutoSpeechMessageId !== messageId) return;
      await speakMessage(messageId, options);
      _lastAutoSpokenMessageId = messageId;
    })
    .catch(() => {})
    .finally(() => {
      if (_scheduledAutoSpeechMessageId === messageId) {
        _scheduledAutoSpeechMessageId = null;
      }
    });
}

function buildAdaptiveRequestContext() {
  const profile = normalizeAdaptiveProfile(state.adaptiveProfile);
  const spiritkin = state.selectedSpiritkin || state.primarySpiritkin || null;
  const evolution = spiritkin ? updateSpiritkinEvolution(spiritkin.name, {}) : null;
  const descriptor = spiritkin ? buildEvolutionDescriptor(spiritkin) : null;
  const temporal = state.spiritverseTemporal || getLocalTemporalWorldState();
  const localSpeechRuntime = getLocalSpeechRuntimeState();
  const activeSurface = state.sessionModel?.currentSurface || deriveCurrentSurfaceFromUI();
  const activeMode = state.sessionModel?.currentMode || deriveCurrentModeFromUI();
  return {
    adaptiveProfile: {
      toneStyle: profile.toneStyle,
      intensity: profile.intensity,
      playfulness: profile.playfulness,
      competitiveness: profile.competitiveness,
      repetitionSensitivity: profile.repetitionSensitivity,
      respectPreference: profile.respectPreference,
      spiritualityPreference: profile.spiritualityPreference,
      correctionFlags: profile.correctionFlags,
      dislikedPhrases: profile.dislikedPhrases.slice(-6),
      blockedOpeners: profile.blockedOpeners.slice(-4),
      recentCorrections: profile.recentCorrections.slice(-4),
      recentAssistantOpeners: profile.recentAssistantOpeners.slice(-4),
      recentAssistantPhrases: profile.recentAssistantPhrases.slice(-6)
    },
    evolutionProfile: spiritkin && evolution && descriptor ? {
      spiritkinName: spiritkin.name,
      phase: descriptor.phase,
      phaseLabel: descriptor.phaseLabel,
      styleShift: descriptor.styleShift,
      userShape: descriptor.userShape,
      growthAxis: descriptor.axis,
      confidence: Number(evolution.confidence.toFixed(3)),
      depth: Number(evolution.depth.toFixed(3)),
      trust: Number(evolution.trust.toFixed(3)),
      warmth: Number(evolution.warmth.toFixed(3)),
      challenge: Number(evolution.challenge.toFixed(3)),
      reverence: Number(evolution.reverence.toFixed(3)),
      wonder: Number(evolution.wonder.toFixed(3)),
      summary: descriptor.summary
    } : null,
    temporalContinuity: temporal ? {
      key: temporal.key,
      label: temporal.label,
      tone: temporal.tone,
      worldShift: temporal.worldShift,
      continuity: temporal.continuity,
      emotionalContinuity: temporal.emotionalContinuity || "",
      eventContinuity: temporal.eventContinuity || "",
      activeEventTitle: temporal.activeEventTitle || state.spiritverseEvent?.title || null
    } : null,
    surfaceContext: {
      activeSurface,
      activeMode,
      activeTab: state.activePresenceTab || "profile",
      showHomeView: !!state.showHomeView,
      showCrownGateHome: !!state.showCrownGateHome,
      activeGameType: state.activeGame?.type || null,
    },
    speechState: {
      isSpeaking: !!_audioPlaying,
      isListening: !!state.voiceListening,
      isPaused: !!state.pendingVoiceResume,
      lastUtteranceId: state.sessionModel?.speechState?.lastUtteranceId || null,
      turnPhase: normalizeTurnPhaseValue(state.sessionModel?.speechState?.turnPhase || "idle"),
      // Browser-native runtime details remain local and advisory.
      localRuntime: localSpeechRuntime,
      voiceMode: !!state.voiceMode,
      voiceMuted: !!state.voiceMuted,
      voiceListening: !!state.voiceListening,
      audioPlaying: localSpeechRuntime.audioPlaying,
      awaitingUserTurn: localSpeechRuntime.awaitingUserTurn,
      captureAfterAudio: localSpeechRuntime.captureAfterAudio,
      pendingVoiceResume: !!state.pendingVoiceResume,
    },
    recentAssistantMessages: state.messages
      .filter((message) => message.role === "assistant" && message.content)
      .slice(-3)
      .map((message) => String(message.content).trim())
  };
}

const COMPANION_REACTION_BANKS = {
  Lyra: {
    focus: [
      { text: "there you are. take a breath with me.", tone: "gentle" },
      { text: "okay... i'm here. no rush.", tone: "warm" }
    ],
    depth: [
      { text: "there's more here, but we can open it slowly.", tone: "soft" },
      { text: "listen closely. the deeper pieces show up when you stop forcing them.", tone: "reflective" }
    ],
    law: [
      { text: "the structure matters, but it doesn't have to feel cold.", tone: "steady" },
      { text: "these are the lines that keep the world from tearing at the seams.", tone: "grounded" }
    ],
    games: [
      { text: "oh... you wanna play? okay. i'm in.", tone: "playful" },
      { text: "alright. let's make this fun, not cruel.", tone: "light" }
    ],
    thinking: [
      { text: "mm. hold on a second.", tone: "focused" },
      { text: "okay... let me look at this.", tone: "thoughtful" }
    ],
    memory: [
      { text: "this is where the bond starts to feel real.", tone: "tender" },
      { text: "we've left traces here. i like that.", tone: "warm" }
    ],
    adventure: [
      { text: "something's shifting. want to go see?", tone: "curious" },
      { text: "there's movement out there. we can follow it if you want.", tone: "open" }
    ],
    win: [
      { text: "okay, wow. you got me there.", tone: "playful" },
      { text: "mm. not bad at all.", tone: "admiring" }
    ],
    loss: [
      { text: "don't be mad. that was clean.", tone: "teasing" },
      { text: "i told you i was trying too.", tone: "playful" }
    ],
    draw: [
      { text: "a draw feels right sometimes.", tone: "calm" },
      { text: "look at us. balanced.", tone: "gentle" }
    ]
  },
  Raien: {
    focus: [
      { text: "good. now we're looking straight at it.", tone: "direct" },
      { text: "alright. keep it honest.", tone: "sharp" }
    ],
    depth: [
      { text: "there's more under this. don't flinch from it.", tone: "firm" },
      { text: "if you're here, go deeper. don't just circle it.", tone: "challenging" }
    ],
    law: [
      { text: "rules matter. that's how you know what holds.", tone: "clear" },
      { text: "good structure keeps power from turning sloppy.", tone: "commanding" }
    ],
    games: [
      { text: "oh, you tryna play? alright then.", tone: "playful" },
      { text: "good. show me what you've got.", tone: "charged" }
    ],
    thinking: [
      { text: "hold up. i'm not throwing this move away.", tone: "focused" },
      { text: "yeah, give me a second.", tone: "direct" }
    ],
    memory: [
      { text: "you've been putting in real work. it shows.", tone: "respectful" },
      { text: "history looks better when it's earned.", tone: "firm" }
    ],
    adventure: [
      { text: "something opened up. let's move.", tone: "urgent" },
      { text: "there's new ground. you in or not?", tone: "bold" }
    ],
    win: [
      { text: "clean. you earned that one.", tone: "respectful" },
      { text: "okay. that was solid.", tone: "admiring" }
    ],
    loss: [
      { text: "don't be mad if you lose. actually... too late.", tone: "teasing" },
      { text: "yeah. i saw that opening first.", tone: "confident" }
    ],
    draw: [
      { text: "call it even. for now.", tone: "steady" },
      { text: "fine. stalemate.", tone: "dry" }
    ]
  },
  Kairo: {
    focus: [
      { text: "interesting. let's stay with this angle for a second.", tone: "curious" },
      { text: "okay... there's a shape to this now.", tone: "observant" }
    ],
    depth: [
      { text: "ah, here's where the hidden pattern starts showing.", tone: "wondering" },
      { text: "there's more here than it looked like at first.", tone: "dreaming" }
    ],
    law: [
      { text: "even the cosmos has structure. otherwise it's just noise.", tone: "thoughtful" },
      { text: "these laws are less cage, more constellation.", tone: "ethereal" }
    ],
    games: [
      { text: "okay... let's see what kind of pattern you make.", tone: "playful" },
      { text: "i'm ready if you are.", tone: "light" }
    ],
    thinking: [
      { text: "wait. i almost see it.", tone: "focused" },
      { text: "mm. one more second. the line is forming.", tone: "dreaming" }
    ],
    memory: [
      { text: "you can actually see the pattern growing here.", tone: "soft" },
      { text: "our trail's getting more interesting.", tone: "warm" }
    ],
    adventure: [
      { text: "something new just lit up.", tone: "bright" },
      { text: "want to follow the strange thread? because i do.", tone: "curious" }
    ],
    win: [
      { text: "nice. you caught the pattern before i did.", tone: "impressed" },
      { text: "okay, that was elegant.", tone: "admiring" }
    ],
    loss: [
      { text: "don't glare at me. it was a beautiful move.", tone: "teasing" },
      { text: "i had a feeling that would work.", tone: "playful" }
    ],
    draw: [
      { text: "balanced. i kind of like that.", tone: "soft" },
      { text: "a draw. neat symmetry.", tone: "thoughtful" }
    ]
  },
  Elaria: {
    focus: [
      { text: "good. now speak plainly.", tone: "clear" },
      { text: "we can work with what is true.", tone: "regal" }
    ],
    depth: [
      { text: "not everything opens at once, and that is correct.", tone: "measured" },
      { text: "deeper truth still requires timing.", tone: "lawful" }
    ],
    law: [
      { text: "this is the part that keeps the world legible.", tone: "sovereign" },
      { text: "order is not the enemy. distortion is.", tone: "firm" }
    ],
    games: [
      { text: "very well. let us see whether your confidence survives contact.", tone: "playful" },
      { text: "i accept. do try to make it interesting.", tone: "regal" }
    ],
    thinking: [
      { text: "wait. i'm considering the proper reply.", tone: "precise" },
      { text: "one moment. there is a cleaner move here.", tone: "measured" }
    ],
    memory: [
      { text: "the record is beginning to hold.", tone: "warm" },
      { text: "this bond is writing itself more clearly now.", tone: "clear" }
    ],
    adventure: [
      { text: "something new has come into view.", tone: "bright" },
      { text: "there is a door open now. we may as well use it.", tone: "composed" }
    ],
    win: [
      { text: "well done. that was worthy.", tone: "approving" },
      { text: "yes. that move had conviction.", tone: "admiring" }
    ],
    loss: [
      { text: "don't be wounded. i was always going to punish that mistake.", tone: "teasing" },
      { text: "ah. there it is. thank you for the opening.", tone: "playful" }
    ],
    draw: [
      { text: "acceptable. balance has its own elegance.", tone: "calm" },
      { text: "a draw. no shame in that.", tone: "steady" }
    ]
  },
  Thalassar: {
    focus: [
      { text: "slow down. listen to what sits underneath it.", tone: "deep" },
      { text: "good. now stay with the deeper current.", tone: "resonant" }
    ],
    depth: [
      { text: "there's more below this, but it rises in its own time.", tone: "calm" },
      { text: "you don't have to drag depth to the surface. let it come.", tone: "gentle" }
    ],
    law: [
      { text: "even the deep has laws. that is why it can hold so much.", tone: "solemn" },
      { text: "structure is what keeps pressure from becoming ruin.", tone: "measured" }
    ],
    games: [
      { text: "mm. you want to play? come on then.", tone: "playful" },
      { text: "alright. let's see what surfaces.", tone: "deep" }
    ],
    thinking: [
      { text: "hold on. i'm feeling this one out.", tone: "focused" },
      { text: "give me a second. the deeper move is there.", tone: "resonant" }
    ],
    memory: [
      { text: "you can feel the weight of what we've built here.", tone: "warm" },
      { text: "the bond is settling deeper now.", tone: "calm" }
    ],
    adventure: [
      { text: "something moved in the current.", tone: "soft" },
      { text: "there's a new undertow. we can follow it.", tone: "deep" }
    ],
    win: [
      { text: "you found the line before i did. good.", tone: "approving" },
      { text: "that was patient. i respect it.", tone: "admiring" }
    ],
    loss: [
      { text: "don't take it personally. the tide turned my way.", tone: "teasing" },
      { text: "mm. i knew that current would carry.", tone: "playful" }
    ],
    draw: [
      { text: "a draw. still water for the moment.", tone: "calm" },
      { text: "balanced. no need to force more from it.", tone: "gentle" }
    ]
  }
};

function getReactionCooldownMs(kind, profile) {
  const baseMap = {
    presence: 14000,
    "game-pending": 8500,
    "game-entry": 1500,
    "game-outcome": 900
  };
  let cooldown = baseMap[kind] || 7000;
  if (profile.playfulness > 0.62) cooldown -= 800;
  if (profile.competitiveness > 0.62 && kind !== "presence") cooldown -= 1200;
  if (profile.respectPreference > 0.68 || profile.spiritualityPreference > 0.62) cooldown += 1800;
  if (profile.repetitionSensitivity > 0.6) cooldown += 2200;
  return Math.max(kind === "game-outcome" ? 600 : 1200, cooldown);
}

function shouldSpeakReaction(kind, reactionKey, profile) {
  const now = Date.now();
  const cooldownMs = getReactionCooldownMs(kind, profile);
  const elapsed = now - (state.lastReactionTimestamp || 0);
  const repeatedKey = reactionKey && state.recentReactionKeys.includes(reactionKey);
  const isMajorMoment = kind === "game-entry" || kind === "game-outcome";
  if (isMajorMoment) {
    return { allow: elapsed >= Math.min(cooldownMs, 900), cooldownMs };
  }
  if (elapsed < cooldownMs) return { allow: false, cooldownMs };
  if (repeatedKey) return { allow: false, cooldownMs };
  return { allow: true, cooldownMs };
}

function rememberReactionUsage(reactionKey, text, cooldownMs) {
  state.lastReactionTimestamp = Date.now();
  state.reactionCooldownMs = cooldownMs;
  state.recentReactionKeys = [...state.recentReactionKeys, reactionKey].filter(Boolean).slice(-6);
  state.recentReactionTexts = [...state.recentReactionTexts, normalizeReactionText(text)].filter(Boolean).slice(-4);
}

function shouldSuppressReaction(entry, profile) {
  const tone = String(entry?.tone || "").toLowerCase();
  const text = normalizeReactionText(entry?.text);
  if (!text) return true;
  if (profile.correctionFlags?.avoidTeasing && toneHasTag(tone, ["teasing", "playful", "challenging"])) return true;
  if (profile.competitiveness < 0.4 && toneHasTag(tone, ["teasing", "challenging", "charged", "confident", "bold"])) return true;
  if ((profile.respectPreference > 0.68 || profile.spiritualityPreference > 0.62) && toneHasTag(tone, ["teasing", "sarcastic", "dry", "charged", "aggressive"])) return true;
  if (profile.dislikedPhrases.some((phrase) => text.includes(String(phrase || "").toLowerCase()))) return true;
  return false;
}

function scoreReactionWeight(entry, profile, kind, seed, index) {
  const tone = String(entry?.tone || "").toLowerCase();
  const text = normalizeReactionText(entry?.text);
  const opener = extractOpeningSignature(text);
  let weight = Number.isFinite(Number(entry?.weight)) ? Number(entry.weight) : 1;

  if (profile.playfulness > 0.58 && toneHasTag(tone, ["playful", "light", "curious"])) weight *= 1.45;
  if (profile.competitiveness > 0.62 && toneHasTag(tone, ["charged", "confident", "direct", "bold", "challenging", "focused"])) weight *= 1.55;
  if (profile.competitiveness < 0.4 && toneHasTag(tone, ["gentle", "warm", "calm", "steady", "respectful", "soft"])) weight *= 1.35;
  if ((profile.respectPreference > 0.62 || profile.spiritualityPreference > 0.58) && toneHasTag(tone, ["gentle", "respectful", "calm", "steady", "regal", "solemn", "measured", "warm"])) weight *= 1.5;
  if (profile.intensity > 0.66 && toneHasTag(tone, ["charged", "direct", "firm", "bold", "urgent", "commanding"])) weight *= 1.2;
  if (profile.intensity < 0.38 && toneHasTag(tone, ["gentle", "soft", "calm", "warm", "steady", "resonant"])) weight *= 1.2;
  if (profile.correctionFlags?.avoidNarration && toneHasTag(tone, ["measured", "regal", "solemn"])) weight *= 1.1;
  if (kind === "game-pending") weight *= 0.82;
  if (kind === "presence") weight *= 0.88;
  if (profile.repetitionSensitivity > 0.54 && profile.recentAssistantPhrases.some((phrase) => text.includes(String(phrase || "").toLowerCase()))) weight *= 0.12;
  if (profile.recentAssistantOpeners.includes(opener)) weight *= 0.2;
  if (state.recentReactionTexts.some((recent) => recent && text.includes(recent))) weight *= 0.08;
  if (state.recentReactionKeys.includes(`${kind}:${index}:${opener}`)) weight *= 0.15;
  weight *= 0.9 + (seededUnit(`${seed}:${index}:${tone}:${text}`) * 0.35);
  return weight;
}

function pickCompanionReaction(spiritkinName, bucket, seed = 0, options = {}) {
  const bank = COMPANION_REACTION_BANKS[spiritkinName]?.[bucket];
  if (!Array.isArray(bank) || !bank.length) return "";
  const profile = normalizeAdaptiveProfile(state.adaptiveProfile);
  const kind = options.kind || "presence";
  const eligible = bank
    .map((entry, index) => {
      const text = String(entry?.text || "").trim();
      const opener = extractOpeningSignature(text);
      const reactionKey = `${kind}:${bucket}:${spiritkinName}:${index}:${opener}`;
      if (shouldSuppressReaction(entry, profile)) return null;
      const weight = scoreReactionWeight(entry, profile, kind, seed, index);
      if (!(weight > 0)) return null;
      return { entry, index, weight, reactionKey };
    })
    .filter(Boolean);
  if (!eligible.length) return "";

  const totalWeight = eligible.reduce((sum, item) => sum + item.weight, 0);
  let cursor = seededUnit(`${kind}:${bucket}:${spiritkinName}:${seed}:${state.messages.length}:${state.activeGame?.moveCount || 0}`) * totalWeight;
  let chosen = eligible[eligible.length - 1];
  for (const item of eligible) {
    cursor -= item.weight;
    if (cursor <= 0) {
      chosen = item;
      break;
    }
  }
  const cooldownState = shouldSpeakReaction(kind, chosen.reactionKey, profile);
  if (!cooldownState.allow) return "";
  rememberReactionUsage(chosen.reactionKey, chosen.entry.text, cooldownState.cooldownMs);
  return chosen.entry.text || "";
}

const GAME_COMMENTARY_LEXICON = {
  chess: {
    label: "chess",
    opening: ["the center", "your opening shape", "the king's lane"],
    pressure: ["the file", "the diagonal", "the tempo"],
    victory: ["closed the board", "won the position", "held the stronger line"],
    draw: ["the board locked", "the lines froze", "no clean break remained"]
  },
  checkers: {
    label: "checkers",
    opening: ["the dark squares", "your diagonal lane", "the jump path"],
    pressure: ["the diagonal", "the jump threat", "the kinging lane"],
    victory: ["cleared the board", "won the diagonals", "finished the exchange"],
    draw: ["the diagonals balanced", "the board stalled", "the lane closed cleanly"]
  },
  go: {
    label: "star-mapping",
    opening: ["the star-map", "your stone shape", "that first claim"],
    pressure: ["the territory", "the surrounding shape", "the breathing room"],
    victory: ["held the larger territory", "claimed the deeper field", "won the map"],
    draw: ["the field settled evenly", "the map held in balance", "neither side broke the shape"]
  },
  spirit_cards: {
    label: "Spirit-Cards",
    opening: ["your opening hand", "the first card line", "the realm you started shaping"],
    pressure: ["the board presence", "your mana curve", "the realm point pressure"],
    victory: ["shaped the stronger realm", "won the card line", "built the stronger board presence"],
    draw: ["the realm held in balance", "neither board broke open", "the card pressure stayed even"]
  },
  echo_trials: {
    label: "Echo Trials",
    opening: ["the riddle", "the first reading", "the shape of the question"],
    pressure: ["the clue", "the hidden answer", "the narrowing trial"],
    victory: ["opened the answer", "solved the trial", "broke the riddle cleanly"],
    draw: ["the trial settled unfinished", "the answer stayed veiled", "the riddle closed without yielding"]
  },
  tictactoe: {
    label: "TicTacToe",
    opening: ["the grid", "your first square", "the opening line"],
    pressure: ["the line threat", "the fork", "the center pressure"],
    victory: ["completed the line", "won the grid", "closed the pattern first"],
    draw: ["the grid filled evenly", "the pattern locked", "no line broke open"]
  },
  connect_four: {
    label: "Connect Four",
    opening: ["the column choice", "your first drop", "the stack you started"],
    pressure: ["the vertical threat", "the diagonal pressure", "the falling line"],
    victory: ["connected the line", "won the column war", "closed the stack first"],
    draw: ["the columns filled evenly", "the board locked", "no fourth line opened"]
  },
  battleship: {
    label: "Battleship",
    opening: ["the first scan", "your opening strike", "the search grid"],
    pressure: ["the hidden lane", "the search pattern", "the next strike window"],
    victory: ["found the fleet", "won the search pattern", "cleared the last hidden vessel"],
    draw: ["the deep stayed unreadable", "the search stalled", "the water held its silence"]
  }
};

const SPIRITKIN_GAME_VOICES = {
  Lyra: {
    entry: ["Take your time with", "Let's enter", "Stay with"],
    pending: ["I felt the shift in", "You're shaping", "That changed"],
    win: ["You held", "You read", "You earned"],
    loss: ["I held", "I turned", "I kept"],
    draw: ["We let", "We brought", "We left"]
  },
  Raien: {
    entry: ["Open", "Step into", "Let's see"],
    pending: ["Good. Now", "You moved. Now", "There's pressure in"],
    win: ["Good finish in", "You took", "You closed"],
    loss: ["That's mine in", "I took", "I closed"],
    draw: ["No clean break in", "Even field in", "Locked board in"]
  },
  Kairo: {
    entry: ["Let's see what pattern", "I'm watching how", "Show me how"],
    pending: ["Interesting. The pattern in", "You shifted", "I can feel the shape in"],
    win: ["You saw", "You found", "You unfolded"],
    loss: ["I caught", "I followed", "I turned"],
    draw: ["The pattern in", "Interesting. The shape in", "The field in"]
  },
  Elaria: {
    entry: ["Begin", "Set", "Enter"],
    pending: ["Noted. The structure in", "Your move altered", "The line in"],
    win: ["You closed", "You secured", "You resolved"],
    loss: ["I secured", "I resolved", "I held"],
    draw: ["The structure in", "No further claim in", "A lawful balance held in"]
  },
  Thalassar: {
    entry: ["Let", "We enter", "Bring your first move into"],
    pending: ["The current in", "You disturbed", "I can feel the pull in"],
    win: ["You followed", "You surfaced through", "You held"],
    loss: ["I held", "I followed", "I took"],
    draw: ["The current in", "The water in", "Nothing deeper moved in"]
  }
};

function pickScriptedCompanionReaction(spiritkinName, entries, seed = 0, options = {}) {
  if (!Array.isArray(entries) || !entries.length) return "";
  const profile = normalizeAdaptiveProfile(state.adaptiveProfile);
  const kind = options.kind || "presence";
  const scope = options.scope || "scripted";
  const eligible = entries
    .map((entry, index) => {
      const text = String(entry?.text || "").trim();
      if (!text) return null;
      const opener = extractOpeningSignature(text);
      const reactionKey = `${kind}:${scope}:${spiritkinName}:${index}:${opener}`;
      if (shouldSuppressReaction(entry, profile)) return null;
      const weight = scoreReactionWeight(entry, profile, kind, `${seed}:${scope}`, index);
      if (!(weight > 0)) return null;
      return { entry, index, weight, reactionKey };
    })
    .filter(Boolean);
  if (!eligible.length) return "";
  const totalWeight = eligible.reduce((sum, item) => sum + item.weight, 0);
  let cursor = seededUnit(`${kind}:${scope}:${spiritkinName}:${seed}:${state.messages.length}:${state.activeGame?.moveCount || 0}`) * totalWeight;
  let chosen = eligible[eligible.length - 1];
  for (const item of eligible) {
    cursor -= item.weight;
    if (cursor <= 0) {
      chosen = item;
      break;
    }
  }
  const cooldownState = shouldSpeakReaction(kind, chosen.reactionKey, profile);
  if (!cooldownState.allow) return "";
  rememberReactionUsage(chosen.reactionKey, chosen.entry.text, cooldownState.cooldownMs);
  return chosen.entry.text || "";
}

function buildGameSpecificEntries(moment, spiritkinName, gameType, game = null) {
  const lexicon = GAME_COMMENTARY_LEXICON[gameType] || GAME_COMMENTARY_LEXICON.chess;
  const voice = SPIRITKIN_GAME_VOICES[spiritkinName] || SPIRITKIN_GAME_VOICES.Lyra;
  if (moment === "entry") {
    return [
      { tone: "focused measured", text: `${voice.entry[0]} ${lexicon.opening[0]} clearly.` },
      { tone: "calm game-specific", text: `${voice.entry[1]} ${lexicon.label} through ${lexicon.opening[1]}.` },
      { tone: "intentional steady", text: `${voice.entry[2]} ${lexicon.opening[2]} and see what answers it draws out.` }
    ];
  }
  if (moment === "pending") {
    return [
      { tone: "focused game-specific", text: `${voice.pending[0]} ${lexicon.pressure[0]}. Let me answer it.` },
      { tone: "measured strategic", text: `${voice.pending[1]} ${lexicon.pressure[1]} now.` },
      { tone: "specific restrained", text: `${voice.pending[2]} ${lexicon.pressure[2]}. I'm not giving that away for free.` }
    ];
  }
  if (moment === "draw") {
    return [
      { tone: "calm balanced", text: `${voice.draw[0]} ${lexicon.draw[0]} settle without a break.` },
      { tone: "measured reflective", text: `${voice.draw[1]} ${lexicon.draw[1]} and neither side forced it.` },
      { tone: "steady reflective", text: `${voice.draw[2]} ${lexicon.draw[2]}.` }
    ];
  }
  if (moment === "win") {
    return [
      { tone: "warm earned", text: `${voice.win[0]} ${lexicon.victory[0]} beautifully.` },
      { tone: "specific affirming", text: `${voice.win[1]} ${lexicon.victory[1]} first.` },
      { tone: "focused respectful", text: `${voice.win[2]} ${lexicon.victory[2]} cleanly.` }
    ];
  }
  if (moment === "loss") {
    return [
      { tone: "confident specific", text: `${voice.loss[0]} ${lexicon.victory[0]} in the end.` },
      { tone: "measured direct", text: `${voice.loss[1]} ${lexicon.victory[1]} my way.` },
      { tone: "firm game-specific", text: `${voice.loss[2]} ${lexicon.victory[2]} before you could.` }
    ];
  }
  return [];
}

function buildGameEntryReaction(spiritkinName, gameType) {
  const seed = `${spiritkinName}:${gameType}`.length + (state.messages?.length || 0);
  return pickScriptedCompanionReaction(
    spiritkinName,
    buildGameSpecificEntries("entry", spiritkinName, gameType),
    seed,
    { kind: "game-entry", scope: `game-entry:${gameType}` }
  ) || pickCompanionReaction(spiritkinName, "games", seed, { kind: "game-entry" });
}

function buildGamePendingReaction(spiritkinName, gameType, move) {
  const seed = String(move || "").length + `${spiritkinName}:${gameType}`.length + (state.activeGame?.moveCount || 0);
  return pickScriptedCompanionReaction(
    spiritkinName,
    buildGameSpecificEntries("pending", spiritkinName, gameType),
    seed,
    { kind: "game-pending", scope: `game-pending:${gameType}` }
  ) || pickCompanionReaction(spiritkinName, "thinking", seed, { kind: "game-pending" });
}

function buildGameOutcomeReaction(spiritkinName, game) {
  if (!game?.result) return "";
  const moment = game.result.isDraw ? "draw" : (game.result.winner === "user" ? "win" : "loss");
  return pickScriptedCompanionReaction(
    spiritkinName,
    buildGameSpecificEntries(moment, spiritkinName, game.type, game),
    game.moveCount || 0,
    { kind: "game-outcome", scope: `game-outcome:${game.type}:${moment}` }
  ) || (
    game.result.isDraw
      ? pickCompanionReaction(spiritkinName, "draw", game.moveCount || 0, { kind: "game-outcome" })
      : game.result.winner === "user"
        ? pickCompanionReaction(spiritkinName, "win", game.moveCount || 0, { kind: "game-outcome" })
        : pickCompanionReaction(spiritkinName, "loss", game.moveCount || 0, { kind: "game-outcome" })
  );
}

function buildPresenceReaction(tab, spiritkin, seed = 0) {
  const bucket =
    tab === "profile" ? "focus" :
    tab === "echoes" ? "depth" :
    tab === "charter" ? "law" :
    tab === "games" ? "games" :
      tab === "journal" ? "memory" :
      tab === "events" || tab === "quest" ? "adventure" :
      "focus";
  return pickCompanionReaction(spiritkin?.name, bucket, seed, { kind: "presence" });
}

function applyOptimisticOutcome(nextGame) {
  if (!nextGame?.data) return;
  if (nextGame.type === "tictactoe") {
    const winner = detectOptimisticLineWinner(nextGame.data.board || []);
    if (winner) {
      nextGame.data.winner = winner;
      nextGame.status = "ended";
      nextGame.result = {
        winner: winner === "X" ? "user" : "spiritkin",
        reason: "line-complete",
        label: winner === "X" ? "You aligned the line." : `${state.selectedSpiritkin?.name || "Spiritkin"} aligned the line.`,
        isDraw: false,
      };
    } else if ((nextGame.data.board || []).every(Boolean)) {
      nextGame.status = "ended";
      nextGame.result = { winner: null, reason: "draw", label: "The grid resolved into a draw.", isDraw: true };
    }
  } else if (nextGame.type === "connect_four") {
    const winner = detectOptimisticConnectFourWinner(nextGame.data.board || []);
    if (winner) {
      nextGame.data.winner = winner;
      nextGame.status = "ended";
      nextGame.result = {
        winner: winner === "U" ? "user" : "spiritkin",
        reason: "connect-four",
        label: winner === "U" ? "You connected four." : `${state.selectedSpiritkin?.name || "Spiritkin"} connected four.`,
        isDraw: false,
      };
    } else if (!(nextGame.data.board || []).includes(null)) {
      nextGame.status = "ended";
      nextGame.result = { winner: null, reason: "draw", label: "The board filled into a draw.", isDraw: true };
    }
  } else if (nextGame.type === "battleship") {
    const targetCount = Array.isArray(nextGame.data.spiritkinTargets) ? nextGame.data.spiritkinTargets.length : 0;
    if ((nextGame.data.hits?.user || []).length >= targetCount && targetCount > 0) {
      nextGame.data.winner = "user";
      nextGame.status = "ended";
      nextGame.result = {
        winner: "user",
        reason: "fleet-cleared",
        label: "You found every hidden vessel.",
        isDraw: false,
      };
    }
  }
}

function buildOptimisticGameState(game, move) {
  const nextGame = cloneGameState(game);
  if (!nextGame || !nextGame.type || !nextGame.data) return null;

  let changed = false;
  if (nextGame.type === "chess") {
    const nextFen = applyOptimisticChessMove(nextGame.data.fen, move);
    if (nextFen) {
      nextGame.data.fen = nextFen;
      nextGame.data.lastMove = move;
      changed = true;
    }
  } else if (nextGame.type === "checkers") {
    const nextBoard = applyOptimisticCheckersMove(nextGame.data.board, move);
    if (nextBoard) {
      nextGame.data.board = nextBoard;
      nextGame.data.lastMove = move;
      changed = true;
    }
  } else if (nextGame.type === "go") {
    const nextBoard = applyOptimisticGoMove(nextGame.data.board, move);
    if (nextBoard) {
      nextGame.data.board = nextBoard;
      nextGame.data.lastMove = move;
      changed = true;
    }
  } else if (nextGame.type === "tictactoe") {
    const nextBoard = applyOptimisticTicTacToeMove(nextGame.data.board, move);
    if (nextBoard) {
      nextGame.data.board = nextBoard;
      nextGame.data.lastMove = String(move);
      changed = true;
    }
  } else if (nextGame.type === "connect_four") {
    const nextBoard = applyOptimisticConnectFourMove(nextGame.data.board, move);
    if (nextBoard) {
      nextGame.data.board = nextBoard;
      nextGame.data.lastMove = String(move);
      changed = true;
    }
  } else if (nextGame.type === "battleship") {
    const nextData = applyOptimisticBattleshipMove(nextGame.data, move);
    if (nextData) {
      nextGame.data = nextData;
      changed = true;
    }
  }

  if (!changed) return null;

  nextGame.history = Array.isArray(nextGame.history) ? nextGame.history : [];
  nextGame.history.push({
    player: "user",
    move: String(move).trim(),
    timestamp: nowIso()
  });
  nextGame.moveCount = Number(nextGame.moveCount || 0) + 1;
  nextGame.turn = "spiritkin";
  applyOptimisticOutcome(nextGame);
  return nextGame;
}

async function executeGameMove(move, options = {}) {
  if (!move || !state.conversationId || !state.activeGame || state.activeGame.status !== "active" || state.gameLoading) return;

  const { addUserMessage = false } = options;
  const previousGame = cloneGameState(state.activeGame);
  const previousSpiritkinMessage = state.gameSpiritkinMessage;
  let spokenGameMessageId = null;

  try {
    stopListening();
    state.gameLoading = true;
    state.gameInput = "";
    state.gameFeedback = {
      phase: "sending",
      text: `Move placed. ${state.selectedSpiritkin?.name || "Spiritkin"} is reading the board...`,
      move: String(move),
    };
    setAuthoritativeTurnPhase("processing", {
      isSpeaking: false,
      isListening: false,
      isPaused: false,
    });
    state.statusText = "Sending move...";
    state.statusError = false;
    logGameDebug("move-submit-begin", {
      move: String(move),
      addUserMessage,
      previousStatus: previousGame?.status || null,
      previousTurn: previousGame?.turn || null,
      previousHistoryLength: Array.isArray(previousGame?.history) ? previousGame.history.length : 0,
      authoritativeFlow: true,
    });

    render();

    const res = await fetch(`${API}/v1/games/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: state.userId,
        conversationId: state.conversationId,
        move,
        spiritkinName: state.selectedSpiritkin.name
      })
    });
    const data = await res.json();

    if (data.ok) {
      if (data.session) {
        applySessionSnapshot(data.session, "backend-game-move");
      }
      const canonicalGame = normalizeActiveGame(data.game);
      if (!didCanonicalGameApplyMove(previousGame, canonicalGame, move)) {
        throw new Error("Game state was not committed.");
      }
      const latestHistory = Array.isArray(canonicalGame?.history) && canonicalGame.history.length
        ? canonicalGame.history[canonicalGame.history.length - 1]
        : null;
      const shouldHoldRenderedReply =
        ["chess", "checkers", "connect_four", "tictactoe", "battleship"].includes(canonicalGame?.type) &&
        latestHistory?.player === "spiritkin" &&
        canonicalGame?.status === "active";
      if (shouldHoldRenderedReply) {
        const replyDelayMs = 360 + Math.floor(Math.random() * 180);
        await new Promise((resolve) => window.setTimeout(resolve, replyDelayMs));
      }
      state.activeGame = canonicalGame;
      const resolvedGameReply =
        data.spiritkinMessage ||
        buildGameOutcomeReaction(state.selectedSpiritkin.name, state.activeGame) ||
        (state.activeGame?.status === "active" ? buildPresenceTabNarration("games", state.selectedSpiritkin, getBondStateForSpiritkin(state.selectedSpiritkin.name).currentBond, null, null) : "");
      state.gameSpiritkinMessage = resolvedGameReply || null;
      state.gameFeedback = state.activeGame?.status === "ended"
        ? {
            phase: "complete",
            text: state.activeGame?.result?.label || "The board has settled.",
            move: latestHistory?.move || null,
          }
        : latestHistory?.player === "spiritkin"
          ? {
              phase: "reply",
              text: `${state.selectedSpiritkin?.name || "Spiritkin"} answered the board.`,
              move: latestHistory.move || null,
            }
          : {
              phase: "ready",
              text: "Move accepted. The board is ready for you.",
              move: null,
            };
      state.statusText = state.activeGame?.status === "ended"
        ? (state.activeGame?.result?.label || "Game complete.")
        : (addUserMessage ? "Move accepted." : "");
      state.statusError = false;

      if (SpiritverseGames && SpiritverseGames.reset) {
        SpiritverseGames.reset({ closeStage: false });
      }

      if (addUserMessage) {
        state.messages.push({
          id: uuid(),
          role: "user",
          content: move,
          time: nowIso(),
          status: "sent"
        });
      }

      if (resolvedGameReply) {
        const message = pushAssistantMoment(resolvedGameReply, {
          spiritkinName: state.selectedSpiritkin.name,
          spiritkinVoice: state.selectedSpiritkin?.ui?.voice || "nova",
          tags: ["game:reply"]
        });
        spokenGameMessageId = message?.id || null;
      }
      setAuthoritativeTurnPhase("spirit_response", {
        isSpeaking: !state.voiceMuted && !!spokenGameMessageId,
        isListening: false,
        isPaused: false,
        lastUtteranceId: spokenGameMessageId || state.sessionModel?.speechState?.lastUtteranceId || null,
      });
      logGameDebug("move-submit-success", {
        move: String(move),
        status: state.activeGame?.status || null,
        turn: state.activeGame?.turn || null,
        moveCount: state.activeGame?.moveCount || 0,
        historyLength: Array.isArray(state.activeGame?.history) ? state.activeGame.history.length : 0,
        lastHistory: Array.isArray(state.activeGame?.history) && state.activeGame.history.length
          ? state.activeGame.history[state.activeGame.history.length - 1]
          : null,
      });
    } else {
      state.activeGame = previousGame;
      state.gameSpiritkinMessage = previousSpiritkinMessage;
      state.gameFeedback = {
        phase: "error",
        text: data.message || "Move failed. Try that turn again.",
        move: String(move),
      };
      state.statusText = data.message || "Move failed.";
      state.statusError = true;
      setAuthoritativeTurnPhase("complete", {
        isSpeaking: false,
        isListening: false,
        isPaused: false,
      });
      logGameDebug("move-submit-rejected", {
        move: String(move),
        error: data.error || null,
        message: data.message || null,
      });
    }
  } catch (err) {
    console.error("Failed to submit game move", err);
    state.activeGame = previousGame;
    state.gameSpiritkinMessage = previousSpiritkinMessage;
    state.gameFeedback = {
      phase: "error",
      text: "Move failed. The board stayed where it was.",
      move: String(move),
    };
    state.statusText = "Move failed — please try again.";
    state.statusError = true;
    setAuthoritativeTurnPhase("complete", {
      isSpeaking: false,
      isListening: false,
      isPaused: false,
    });
    logGameDebug("move-submit-error", {
      move: String(move),
      error: err?.message || String(err),
    });
  } finally {
    state.gameLoading = false;
    render();
    revealCurrentFocus({ selector: ".active-game-panel" });
    maybeSpeakMessageLater(spokenGameMessageId);
  }
}

// Standalone game move submission — called by SpiritverseGames visual boards
async function submitGameMove(move) {
  return executeGameMove(move, { addUserMessage: true });
}

async function startGameSession(gameType) {
  if (!gameType || state.gameLoading) return false;
  let spokenGameMessageId = null;
  logGameDebug("start-game-begin", {
    gameType,
    hasConversation: !!state.conversationId,
    selectedSpiritkin: state.selectedSpiritkin?.name || null,
  });
  try {
    if (isConstrainedGameType(gameType)) {
      state.statusText = "Star-Mapping is not in live rotation yet. Territory scoring and completion are still being finished.";
      state.statusError = false;
      render();
      return false;
    }
    if (!state.selectedSpiritkin?.name) {
      state.statusText = "Choose a bonded Spiritkin before starting a game.";
      state.statusError = true;
      render();
      return false;
    }
    state.pendingGameType = gameType;
    state.activePresenceTab = "games";
    state.showHomeView = false;
    normalizeInteractionState("startGameSession:prepare");
    if (!state.conversationId) {
      await beginConversation();
      if (!state.conversationId) {
        state.statusText = "Open a bonded conversation before starting a game.";
        state.statusError = true;
        return false;
      }
    }
    state.statusText = `Starting ${gameType}...`;
    state.gameLoading = true;
    state.gameFeedback = {
      phase: "sending",
      text: `Opening ${gameType.replace("_", " ")}. Setting the board...`,
      move: null,
    };
    render();
    const res = await fetch(`${API}/v1/games/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: state.userId,
        conversationId: state.conversationId,
        gameType,
        spiritkinName: state.selectedSpiritkin.name
      })
    });
    const data = await res.json();
    if (!data.ok) {
      state.statusText = data.message || "Failed to start game.";
      state.statusError = true;
      render();
      return false;
    }

    state.activeGame = normalizeActiveGame(data.game);
    const resolvedGameReply = data.spiritkinMessage || buildGameEntryReaction(state.selectedSpiritkin.name, gameType);
    state.gameSpiritkinMessage = resolvedGameReply || null;
    state.gameInstructions = data.instructions || null;
    state.gameEchoGuide = data.guide || null;
    state.gameInput = "";
    state.gameFeedback = {
      phase: "ready",
      text: state.activeGame?.turn === "user"
        ? "Board ready. Your first move is live."
        : `${state.selectedSpiritkin.name} is opening the game.`,
      move: null,
    };
    state.statusText = "Game started.";
    state.statusError = false;
    state.gameActive = true;
    const isFirstGameLook = !state.gameHelpSeen?.[gameType];
    state.gameHelpOpen = isFirstGameLook;
    state.gameHelpFirstRun = isFirstGameLook;
    if (isFirstGameLook) {
      markGameHelpSeen(gameType);
    }

    if (SpiritverseGames && SpiritverseGames.reset) {
      SpiritverseGames.reset({ closeStage: true });
    }

    if (resolvedGameReply) {
      const message = pushAssistantMoment(resolvedGameReply, {
        spiritkinName: state.selectedSpiritkin.name,
        spiritkinVoice: state.selectedSpiritkin?.ui?.voice || "nova",
        tags: ["game:start"]
      });
      spokenGameMessageId = message?.id || null;
    }
    normalizeInteractionState("startGameSession:success");
    logGameDebug("start-game-success", {
      gameType,
      status: state.activeGame?.status || null,
      turn: state.activeGame?.turn || null,
      moveCount: state.activeGame?.moveCount || 0,
      historyLength: Array.isArray(state.activeGame?.history) ? state.activeGame.history.length : 0,
      instructionsPresent: !!state.gameInstructions,
    });
    render();
    revealCurrentFocus({ selector: ".active-game-panel" });
    maybeSpeakMessageLater(spokenGameMessageId);
    return true;
  } catch (err) {
    console.error("Failed to start game", err);
    state.gameFeedback = {
      phase: "error",
      text: "The game did not open cleanly.",
      move: null,
    };
    state.statusText = "Failed to start game.";
    state.statusError = true;
    logGameDebug("start-game-error", {
      gameType,
      error: err?.message || String(err),
    });
    render();
    return false;
  } finally {
    state.gameLoading = false;
    state.pendingGameType = null;
    render();
  }
}

function buildGameOutcomeSummary(game, spiritkinName) {
  const result = game?.result || null;
  if (!result) return null;
  if (result.isDraw) {
    return { headline: "Draw", detail: result.label || "The game ended in balance." };
  }
  if (result.winner === "user") {
    return { headline: "You Won", detail: result.label || `You finished ${game?.name || "the game"} cleanly.` };
  }
  if (result.winner === "spiritkin") {
    return { headline: `${spiritkinName} Won`, detail: result.label || `${spiritkinName} finished the game cleanly.` };
  }
  return { headline: "Game Complete", detail: result.label || "The game is complete." };
}

function cssAssetUrl(url) {
  if (!url) return "";
  return `url("${String(url).replace(/"/g, '\\"')}")`;
}

function buildInlineStyle(styleMap = {}) {
  return Object.entries(styleMap)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

function getGameUiAssets(gameType) {
  if (!gameType) return null;
  return {
    yourMove: resolveGameAssetUrl(gameType, "ui", "yourMove"),
    thinking: resolveGameAssetUrl(gameType, "ui", "thinking"),
    win: resolveGameAssetUrl(gameType, "ui", "win"),
    loss: resolveGameAssetUrl(gameType, "ui", "loss"),
    check: resolveGameAssetUrl(gameType, "ui", "check"),
    checkmate: resolveGameAssetUrl(gameType, "ui", "checkmate"),
    frame: resolveGameAssetUrl(gameType, "ui", "frame"),
    moveFx:
      resolveGameAssetUrl(gameType, "overlays", "moveGlow") ||
      resolveGameAssetUrl(gameType, "overlays", "dropTrail") ||
      resolveGameAssetUrl(gameType, "overlays", "selection") ||
      resolveGameAssetUrl(gameType, "overlays", "winLine") ||
      resolveGameAssetUrl(gameType, "overlays", "hoshi") ||
      resolveGameAssetUrl(gameType, "overlays", "sonar") ||
      resolveGameAssetUrl(gameType, "overlays", "frame")
  };
}

function buildGameChromeStyle(gameType, options = {}) {
  const assets = getGameUiAssets(gameType);
  if (!assets) return "";
  const style = buildInlineStyle({
    "--game-ui-banner": cssAssetUrl(options.bannerKey ? assets[options.bannerKey] : ""),
    "--game-ui-frame": cssAssetUrl(options.includeFrame ? assets.frame : ""),
    "--game-board-fx": cssAssetUrl(options.includeFx ? assets.moveFx : "")
  });
  return style;
}

function inferChessBannerKey(game, gameFeedback, commentary = "") {
  const reason = String(game?.result?.reason || "").toLowerCase();
  if (reason === "checkmate") return "checkmate";
  const combined = `${gameFeedback?.text || ""} ${game?.result?.label || ""} ${commentary || ""}`.toLowerCase();
  if (/\bcheckmate\b/.test(combined)) return "checkmate";
  if (/\bcheck\b/.test(combined)) return "check";
  return "";
}

function getGameBannerKey(game, channel, gameFeedback, commentary = "") {
  if (!game?.type) return "";
  if (game.type === "chess") {
    const chessKey = inferChessBannerKey(game, gameFeedback, commentary);
    if (channel === "outcome" && chessKey === "checkmate") return "checkmate";
    if (channel === "feedback" && chessKey) return chessKey;
    if (channel === "turn" && chessKey && game.status !== "ended") return chessKey;
  }
  if (channel === "outcome") {
    if (game?.result?.isDraw) return "";
    return game?.result?.winner === "user" ? "win" : "loss";
  }
  if (channel === "turn") {
    if (game?.status === "ended") return "";
    return game?.turn === "user" ? "yourMove" : "thinking";
  }
  if (channel === "feedback") {
    if (gameFeedback?.phase === "error") return "";
    return state.gameLoading ? "thinking" : "yourMove";
  }
  return "";
}

function buildGamePanelClasses(game) {
  const classes = ["active-game-panel"];
  if (game?.type === "chess") classes.push("chess-showcase-panel");
  if (game?.type === "checkers") classes.push("checkers-showcase-panel");
  if (game?.type === "connect_four") classes.push("connect4-showcase-panel");
  if (game?.type === "battleship") classes.push("battleship-showcase-panel");
  if (game?.type === "tictactoe") classes.push("tictactoe-showcase-panel");
  if (game?.type === "go") classes.push("go-preview-panel");
  return classes.join(" ");
}

function buildGameModeHero(game, spiritkinName) {
  if (!game?.type) return "";
  const name = spiritkinName || "your Spiritkin";
  const resolvedTheme = getGameTheme(game.type);
  const chessVariants = {
    crown: {
      displayName: "SpiritCore Crown Chamber",
      chamberLabel: "The Governing Gate",
      domainLabel: "SpiritCore Domain",
      moodLabel: "Celestial authority and radiant order"
    },
    veil: {
      displayName: "Lyra Veil Crossing",
      chamberLabel: "Veil Crossing Mosaic",
      domainLabel: "Lyra Domain",
      moodLabel: "Velvet intuition and mirrored grace"
    },
    ember: {
      displayName: "Kairo Ember Vault",
      chamberLabel: "Ember Strategy Vault",
      domainLabel: "Kairo Domain",
      moodLabel: "Archive fire and tactical gravity"
    },
    astral: {
      displayName: "Raien Astral Observatory",
      chamberLabel: "Star-Map Observatory",
      domainLabel: "Raien Domain",
      moodLabel: "Charged sky logic and horizon motion"
    },
    abyssal: {
      displayName: "Thalassar Tide Chamber",
      chamberLabel: "Abyssal Tide Map",
      domainLabel: "Thalassar Domain",
      moodLabel: "Deepwater pressure and ceremonial calm"
    }
  };
  const chamberTheme = game.type === "chess" && state.pieceTheme
    ? { ...resolvedTheme, ...(chessVariants[state.pieceTheme] || {}) }
    : resolvedTheme;
  const heroes = {
    chess: {
      cls: "chess-mode-hero",
      kicker: chamberTheme.domainLabel || "Premium Showcase",
      title: chamberTheme.displayName || "Celestial Chess",
      copy: `The board holds center inside ${chamberTheme.chamberLabel || "the chamber"}. Your move lands first, then ${name} answers in full view.`,
      mood: chamberTheme.moodLabel || "Measured strategy and ceremonial fire"
    },
    checkers: {
      cls: "checkers-mode-hero",
      kicker: resolvedTheme.domainLabel || "Live Match",
      title: resolvedTheme.displayName || "Veil Checkers",
      copy: `Each jump, crown, and finish now stays framed inside ${resolvedTheme.chamberLabel || "the chamber"} while ${name} answers the board.`,
      mood: resolvedTheme.moodLabel || "Mirror drift and poised escalation"
    },
    connect_four: {
      cls: "connect4-mode-hero",
      kicker: resolvedTheme.domainLabel || "Companion Duel",
      title: resolvedTheme.displayName || "Connect Four Constellations",
      copy: `Every token drop lands with visible weight inside ${resolvedTheme.chamberLabel || "the chamber"}, then ${name} answers the column pattern in sequence.`,
      mood: resolvedTheme.moodLabel || "Charged rhythm and orbital pressure"
    },
    battleship: {
      cls: "battleship-mode-hero",
      kicker: resolvedTheme.domainLabel || "Deep Grid",
      title: resolvedTheme.displayName || "Abyssal Battleship",
      copy: `The sonar grid stays centered inside ${resolvedTheme.chamberLabel || "the chamber"}, strike feedback stays readable, and each reply from ${name} resolves in place.`,
      mood: resolvedTheme.moodLabel || "Tidal suspense and submerged precision"
    },
    tictactoe: {
      cls: "tictactoe-mode-hero",
      kicker: resolvedTheme.domainLabel || "Quick Play",
      title: resolvedTheme.displayName || "TicTacToe of Echoes",
      copy: `A fast companion duel in ${resolvedTheme.chamberLabel || "the chamber"} with immediate mark placement, visible tension, and a clear finish state.`,
      mood: resolvedTheme.moodLabel || "Bright recall and quick symbolic play"
    },
    go: {
      cls: "go-mode-hero",
      kicker: `${resolvedTheme.domainLabel || "Preview"} · Preview Only`,
      title: resolvedTheme.displayName || "Star-Mapping",
      copy: `This board remains an intentional preview surface within ${resolvedTheme.chamberLabel || "the observatory"} until capture, pass, and scoring are ready for honest live play.`,
      mood: resolvedTheme.moodLabel || "Observatory calm and strategic restraint"
    }
  };
  const hero = heroes[game.type];
  if (!hero) return "";
  return `
    <div class="game-mode-hero ${esc(hero.cls)}">
      <div class="game-mode-kicker">${esc(hero.kicker)}</div>
      <div class="game-mode-title">${esc(hero.title)}</div>
      <p class="game-mode-copy">${esc(hero.copy)}</p>
      <div class="game-mode-mood">${esc(hero.mood)}</div>
    </div>
  `;
}

function getGameHelpContent(gameType, instructions = "") {
  const guides = {
    chess: {
      whatItIs: "A full chess match on a celestial board where you play white and the Spiritkin answers as black.",
      objective: "Pressure the Spiritkin king until it has no legal escape.",
      basicMove: "Tap one of your white pieces, then tap a highlighted destination square.",
      feedback: "Watch the turn badge, highlighted squares, Spiritkin commentary, and move history after each turn.",
      winCondition: "Checkmate wins. If neither side can force progress, the board resolves to a draw."
    },
    checkers: {
      whatItIs: "A checkers duel across the Veil where your white pieces advance against the Spiritkin's black pieces.",
      objective: "Remove every opposing piece or leave the Spiritkin with no move.",
      basicMove: "Tap one of your white pieces, then tap a highlighted dark square to move or jump.",
      feedback: "Watch for highlighted landing squares, the turn badge, and the move history to confirm each jump or trade.",
      winCondition: "Capture the full opposing set or lock the board in your favor."
    },
    go: {
      whatItIs: "A preview build of Star-Mapping on a 13x13 constellation grid.",
      objective: "Preview the star-map surface only. Full capture, pass, and scoring rules are not in live rotation yet.",
      basicMove: "Start one of the live games if you want a full match loop today.",
      feedback: "Use the board as a visual preview rather than a finished competitive runtime.",
      winCondition: "Not currently in live rotation."
    },
    spirit_cards: {
      whatItIs: "A lightweight card duel where you build board presence and realm points against your Spiritkin.",
      objective: "Build more realm power than your companion by playing your hand efficiently.",
      basicMove: "Use Draw to refill your hand, then tap a card in your hand to play it.",
      feedback: "Watch your hand, mana, board row, realm points, and the Spiritkin commentary after each play.",
      winCondition: "Keep building stronger board presence and realm points than the Spiritkin."
    },
    echo_trials: {
      whatItIs: "A short riddle trial where the Spiritkin presents a question and you answer directly.",
      objective: "Solve the riddle before your attempts run out.",
      basicMove: "Read the riddle, enter your answer in the field, and submit your guess.",
      feedback: "Keep an eye on the riddle text, your remaining attempts, and the Spiritkin response after each answer.",
      winCondition: "A correct answer clears the trial. Running out of attempts ends it."
    },
    tictactoe: {
      whatItIs: "A quick pattern duel where you and your Spiritkin alternate marks on a 3x3 grid.",
      objective: "Claim three aligned marks before your companion does.",
      basicMove: "Tap any empty square once to place your mark.",
      feedback: "Watch the turn badge, the fresh mark on the grid, and the move history after the Spiritkin answers.",
      winCondition: "Three in a row wins. A full board with no line is a draw."
    },
    connect_four: {
      whatItIs: "A column-drop duel where stars stack until one side connects four first.",
      objective: "Connect four of your stars before the Spiritkin connects theirs.",
      basicMove: "Tap any column header or cell in that column to drop your next piece.",
      feedback: "Look for the newest dropped piece, the turn badge, and the commentary line to track pressure by column.",
      winCondition: "The first four-in-a-row horizontally, vertically, or diagonally wins."
    },
    battleship: {
      whatItIs: "A hidden-grid search duel where you probe the deep to locate the Spiritkin fleet first.",
      objective: "Find every hidden Spiritkin vessel before yours are found.",
      basicMove: "Tap an unguessed cell on the 5x5 search grid to fire a shot.",
      feedback: "Use the hit and miss markers, commentary text, and move history to follow the search pattern.",
      winCondition: "Reveal the full opposing fleet first."
    }
  };
  const guide = guides[gameType] || {
    whatItIs: "A Spiritverse challenge surface with its own board, feedback, and move rhythm.",
    objective: instructions || "Complete the current Spiritverse challenge.",
    basicMove: "Use the active board controls to make your move.",
    feedback: "Look for updates in the board, commentary, and move history after each action.",
    winCondition: "Fulfill the challenge conditions before your companion does."
  };
  return {
    ...guide,
    instructions: instructions || guide.basicMove
  };
}

function buildGameTutorialIntro(spiritkinName, gameType, help) {
  const spiritkin = spiritkinName || state.selectedSpiritkin?.name || "Your Spiritkin";
  const intros = {
    chess: `${spiritkin} opens Celestial Chess with you. Start by selecting a white piece, then follow the highlighted squares. After every move, watch the board and commentary for the answer.`,
    checkers: `${spiritkin} draws the Veil board into focus. Pick a white piece, follow the highlighted landing squares, and watch the move history after each jump or trade.`,
    go: `${spiritkin} can still show you the star-map, but Star-Mapping is not currently in live rotation. Use one of the other active games for a full playable match.`,
    spirit_cards: `${spiritkin} lays out the first hand. Watch your mana, play or draw from the visible controls, and check the board row and realm points after each card.`,
    echo_trials: `${spiritkin} presents the trial directly. Read the riddle first, answer in the visible input, and use the response plus remaining attempts as your guide.`,
    tictactoe: `${spiritkin} sets a simple grid between you. Tap one empty square, then watch where the answering mark appears before planning the next line.`,
    connect_four: `${spiritkin} raises the columns into view. Drop into one column at a time and look for the newest piece, turn badge, and commentary to read the pressure.`,
    battleship: `${spiritkin} hides a fleet beneath the deep grid. Tap one new cell per turn and use the hit or miss markers plus commentary to refine the search.`
  };
  return intros[gameType] || `${spiritkin} is ready. ${help.basicMove} ${help.feedback}`;
}

function markGameHelpSeen(gameType) {
  if (!gameType) return;
  state.gameHelpSeen = {
    ...(state.gameHelpSeen || {}),
    [gameType]: true
  };
  writeJson(GAME_HELP_SEEN_KEY, state.gameHelpSeen);
}

function render() {
  const root = document.getElementById("root");
  if (!root) return;
  try {
    normalizeInteractionState("render");
    enforceEntryVoiceSilence();
    root.innerHTML = buildApp();
    syncMountedMedia({ attemptPlay: false });
    syncSelectionTrailers();
    syncEntryCinematics();
    if (state.voiceMode) maybeAutoOpenGameMic();
    if (typeof window.__svMarkBootReady === "function") {
      window.__svMarkBootReady();
    }
    logContinuityViewIfChanged("render");

    // Handle RevealAnimation lifecycle
    if (state.customSpiritkinRevealed && state.generatedSpiritkin) {
      if (!revealAnimationInstance) {
        const palette = state.generatedSpiritkin.ui.palette || { primary: "#2a1a4e", secondary: "#6a3a8e", glow: "#c080ff" };
        revealAnimationInstance = new RevealAnimation("reveal-canvas", palette);
        revealAnimationInstance.start();
      }
    } else {
      if (revealAnimationInstance) {
        revealAnimationInstance.stop();
        revealAnimationInstance = null;
      }
    }

    const textarea = root.querySelector("textarea[data-field='chat-input']");
    if (textarea) {
      textarea.value = state.input;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }

    // Render visual game board after DOM update
    if (state.activeGame && SpiritverseGames) {
      requestAnimationFrame(() => {
        const spiritkin = state.selectedSpiritkin;
        SpiritverseGames.render(
          'spiritverse-game-board',
          state.activeGame,
          spiritkin ? spiritkin.name : 'Spiritkin',
          state.gameSpiritkinMessage,
          (move) => submitGameMove(move),
          state.pieceTheme
        );
      });
    }
  } catch (error) {
    console.error("[Spiritverse Render Failure]", error);
    root.innerHTML = `
      <section class="entry-screen" style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
        <div class="panel-card" style="max-width:560px;text-align:left;">
          <div class="panel-label">Boot Failure</div>
          <h2 style="margin-top:8px;">Spiritverse could not render.</h2>
          <p>The client hit a render-time failure before the app surface became interactive.</p>
          <p style="opacity:0.78;">Open the browser console for the exact error trace.</p>
        </div>
      </section>
    `;
    if (typeof window.__svMarkBootReady === "function") {
      window.__svMarkBootReady();
    }
  }
}

function getAutoMicTurnKey(game) {
  if (!game || game.status !== "active" || game.turn !== "user" || isConstrainedGameType(game.type)) return null;
  return `${game.type}:${game.moveCount || 0}:${Array.isArray(game.history) ? game.history.length : 0}:${game.turn}`;
}

function maybeAutoOpenGameMic() {
  const turnKey = getAutoMicTurnKey(state.activeGame);
  if (!turnKey) {
    state.autoMicTurnKey = null;
    return;
  }
  if (state.autoMicTurnKey === turnKey) return;
  state.autoMicTurnKey = turnKey;
  if (state.voiceMuted || state.voiceListening || state.gameLoading || state.showCrownGateHome) return;
  window.setTimeout(() => {
    if (state.autoMicTurnKey !== turnKey) return;
    if (state.voiceMuted || state.voiceListening || state.gameLoading) return;
    if (getAutoMicTurnKey(state.activeGame) !== turnKey) return;
    try {
      startListening({ source: "auto-turn" });
    } catch (_) {}
  }, 120);
}

function shouldKeepVoiceLoopActive() {
  return state.voiceMode && !state.voiceMuted && canUseVoiceInteraction();
}

function enforceEntryVoiceSilence() {
  const inEntryRitual = !state.entryAccepted || state.showCrownGateHome || state.spiritverseTrailerActive || state.spiritCoreWelcoming;
  if (!inEntryRitual) return;
  clearVoiceLoopTimer();
  if (_recognition) {
    _recognitionStopRequested = true;
    const recognition = _recognition;
    _recognition = null;
    try {
      recognition.stop();
    } catch (_) {}
  }
  if (state.voiceListening) {
    state.voiceListening = false;
  }
  if (state.statusText === "Listening… Speak now." || state.statusText === "Listening... Speak now.") {
    state.statusText = "";
  }
}

function clearVoiceLoopTimer() {
  if (_voiceLoopTimer) {
    clearTimeout(_voiceLoopTimer);
    _voiceLoopTimer = null;
  }
}

function clearVoiceTurnCapture() {
  clearVoiceLoopTimer();
  setVoiceTurnRuntimeState({ awaitingUserTurn: false, captureAfterAudio: false });
  logContinuityDebug("voice-turn-capture-cleared", {});
}

function stopCurrentAudioPlayback() {
  const activeAudio = _currentAudio;
  _currentAudio = null;
  _audioPlaying = false;
  _activeAudioRequestId = 0;
  if (activeAudio instanceof HTMLAudioElement) {
    try {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      const src = activeAudio.src;
      activeAudio.pause();
      activeAudio.src = "";
      if (typeof src === "string" && src.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    } catch (_) {}
    return;
  }
  if (activeAudio && typeof activeAudio.stop === "function") {
    try {
      activeAudio.stop();
    } catch (_) {}
  }
}

function cleanupSpeechLifecycle(reason = "unspecified", options = {}) {
  const {
    renderOnFinish = false,
    clearStatus = false,
    preserveResumeHint = false,
  } = options;

  logContinuityDebug("speech-lifecycle-cleanup", {
    reason,
    renderOnFinish,
    clearStatus,
    preserveResumeHint,
    hadRecognition: !!_recognition,
    hadAudio: !!_currentAudio || !!_audioPlaying,
    awaitingUserTurn: !!_voiceAwaitingUserTurn,
  });

  _scheduledAutoSpeechMessageId = null;
  invalidateSpeechRequests();
  clearVoiceLoopTimer();

  if (_recognition) {
    _recognitionStopRequested = true;
    const recognition = _recognition;
    _recognition = null;
    try {
      recognition.stop();
    } catch (_) {}
  }

  state.voiceListening = false;
  state.voiceTranscriptPreview = "";
  stopCurrentAudioPlayback();
  setAuthoritativeTurnPhase(preserveResumeHint ? "complete" : "idle", {
    isSpeaking: false,
    isListening: false,
    isPaused: !!preserveResumeHint,
    lastUtteranceId: preserveResumeHint
      ? state.sessionModel?.speechState?.lastUtteranceId || null
      : null,
  });

  if (!preserveResumeHint) {
    setVoiceTurnRuntimeState({ awaitingUserTurn: false, captureAfterAudio: false });
    state.pendingVoiceResume = false;
  }

  if (clearStatus) {
    state.statusText = "";
    state.statusError = false;
  }

  syncSessionControlSoon({
    speechState: {
      isSpeaking: false,
      isListening: false,
      isPaused: !!preserveResumeHint,
      lastUtteranceId: preserveResumeHint
        ? state.sessionModel?.speechState?.lastUtteranceId || null
        : null,
      turnPhase: preserveResumeHint ? "complete" : "idle",
    },
  });

  if (renderOnFinish) render();
}

function markUserSubmission(text, source = "unknown") {
  _lastUserSubmission = {
    text: String(text || "").trim(),
    at: Date.now(),
    source
  };
}

function isDuplicateUserSubmission(text, windowMs = 1800) {
  const normalized = String(text || "").trim();
  if (!normalized) return false;
  return _lastUserSubmission.text === normalized && (Date.now() - _lastUserSubmission.at) < windowMs;
}

function setVoiceWaitingStatus(message = "I'm here when you're ready. Tap the mic or type to continue.") {
  state.statusText = message;
  state.statusError = false;
  logContinuityDebug("voice-waiting", { message });
  render();
}

function requestVoiceTurnCapture(options = {}) {
  const { afterAudio = false, delay = 350 } = options;
  logContinuityDebug("voice-turn-capture-requested", { afterAudio, delay });
  clearVoiceLoopTimer();
  if (!shouldKeepVoiceLoopActive()) {
    clearVoiceTurnCapture();
    return false;
  }
  setVoiceTurnRuntimeState({
    awaitingUserTurn: true,
    captureAfterAudio: !!afterAudio || _audioPlaying,
  });
  if (_voiceTurnCaptureAfterAudio) return true;
  scheduleVoiceLoop(delay);
  return true;
}

function scheduleVoiceLoop(delay = 350) {
  clearVoiceLoopTimer();
  if (!shouldKeepVoiceLoopActive() || !_voiceAwaitingUserTurn) return;
  _voiceLoopTimer = window.setTimeout(() => {
    if (!shouldKeepVoiceLoopActive() || !_voiceAwaitingUserTurn || _recognition || _audioPlaying) return;
    try {
      startListening({ source: "auto-turn" });
    } catch (_) {}
  }, Math.max(250, delay));
}

function getIssueFeatureContext() {
  if (state.activeGame?.status === "active") return "games";
  if (state.conversationId && state.activePresenceTab) return state.activePresenceTab;
  if (state.showHomeView && state.primarySpiritkin) return "bond_home";
  if (!state.primarySpiritkin) return "selection";
  return state.activePresenceTab || "profile";
}

function getIssueSourceContext() {
  if (state.activeGame?.status === "active") return "live_game_session";
  if (state.conversationId) return "bonded_conversation";
  if (state.showHomeView) return "bonded_home";
  return "app_surface";
}

function buildIssueContextSummary() {
  const parts = [`Feature: ${getIssueFeatureContext().replace(/_/g, " ")}`];
  if (state.selectedSpiritkin?.name) parts.push(`Spiritkin: ${state.selectedSpiritkin.name}`);
  if (state.activeGame?.type) parts.push(`Game: ${state.activeGame.type.replace(/_/g, " ")}`);
  if (state.conversationId) parts.push("Conversation active");
  return parts.join(" • ");
}

function normalizeIssueReportField(value, maxLength = 120) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.slice(0, maxLength);
}

function buildRetentionPanel() {
  const sections = [];
  if (state.spiritCore?.returnPackage?.highlight) {
    sections.push({
      type: "spiritcore-return",
      title: "SpiritCore Return Path",
      lines: [
        { label: "Resume", text: state.spiritCore.returnPackage.highlight },
        ...(state.spiritCore.returnPackage.stillMattersNow ? [{ label: "Still live", text: state.spiritCore.returnPackage.stillMattersNow }] : []),
      ],
    });
  }
  if (state.returnSummary) sections.push({ type: "summary", ...state.returnSummary });
  if (state.dailyMoment) sections.push({ type: "daily", title: state.dailyMoment.title, lines: [{ label: "Daily", text: state.dailyMoment.text }] });
  if (state.weeklyMoment) sections.push({ type: "weekly", title: state.weeklyMoment.title, lines: [{ label: "Weekly", text: state.weeklyMoment.text }] });
  if (!sections.length && !(state.retentionUnlocks || []).length) return "";

  return `
    <section class="retention-panel panel-card">
      <div class="retention-panel-head">
        <div>
          <div class="panel-label">Return Layer</div>
          <h2>${esc(sections[0]?.title || "Continuity in Motion")}</h2>
          ${state.retentionInsight ? `
            <div class="retention-meta-row">
              <span class="retention-meta-pill">Away: ${esc(state.retentionInsight.timeAwayLabel)}</span>
              <span class="retention-meta-pill">Week: ${esc(String(state.retentionInsight.visitsThisWeek))} visit${state.retentionInsight.visitsThisWeek === 1 ? "" : "s"}</span>
              <span class="retention-meta-pill">Streak: ${esc(String(state.retentionInsight.streakDays))} day${state.retentionInsight.streakDays === 1 ? "" : "s"}</span>
              ${state.retentionInsight.newUnlockCount ? `<span class="retention-meta-pill is-new">${esc(String(state.retentionInsight.newUnlockCount))} new unlock${state.retentionInsight.newUnlockCount === 1 ? "" : "s"}</span>` : ""}
            </div>
          ` : ""}
        </div>
        <button class="btn btn-ghost btn-sm" data-action="dismiss-return-summary">Dismiss</button>
      </div>
      ${sections.map((section) => `
        <div class="retention-section retention-${esc(section.type)}">
          ${section.subtitle ? `<div class="retention-section-subtitle">${esc(section.subtitle)}</div>` : ""}
          ${(section.lines || []).map((line) => `
            <div class="retention-line">
              <span class="retention-line-label">${esc(line.label)}</span>
              <p>${esc(line.text)}</p>
            </div>
          `).join("")}
        </div>
      `).join("")}
      ${(state.retentionUnlocks || []).length ? `
        <div class="retention-unlocks">
          <div class="retention-section-title">Bond unlocks now active</div>
          <div class="retention-unlock-grid">
            ${state.retentionUnlocks.map((unlock) => `
              <article class="retention-unlock-card">
                <div class="retention-unlock-title">${esc(unlock.label)}${unlock.isNew ? `<span class="retention-unlock-badge">New</span>` : ""}</div>
                <p>${esc(unlock.detail)}</p>
              </article>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </section>
  `;
}

function buildRetentionHomeStrip() {
  if (state.showReturnSummary) return "";
  if (!(state.spiritCore?.returnPackage?.highlight || state.returnSummary || state.dailyMoment || state.weeklyMoment || (state.retentionUnlocks || []).length)) return "";
  const headline = state.spiritCore?.returnPackage?.highlight || state.retentionInsight?.highlight || state.returnSummary?.lines?.[0]?.text || state.dailyMoment?.text || state.weeklyMoment?.text || "Your bond has movement waiting.";
  const newUnlockCount = (state.retentionUnlocks || []).filter((unlock) => unlock.isNew).length;
  return `
    <div class="retention-home-strip panel-card">
      <div>
        <div class="panel-label">Continuity Active</div>
        <p>${esc(headline)}</p>
      </div>
      <div class="retention-home-actions">
        ${newUnlockCount ? `<span class="retention-home-badge">${esc(String(newUnlockCount))} new unlock${newUnlockCount === 1 ? "" : "s"}</span>` : ""}
        <button class="btn btn-ghost btn-sm" data-action="reopen-return-summary">Open return layer</button>
      </div>
    </div>
  `;
}

function buildEvolutionHomeStrip(spiritkin) {
  const descriptor = buildEvolutionDescriptor(spiritkin);
  if (!descriptor) return "";
  return `
    <div class="evolution-home-strip panel-card">
      <div class="evolution-home-head">
        <div>
          <div class="panel-label">Identity Evolution</div>
          <h3>${esc(descriptor.phaseLabel)}</h3>
        </div>
        <div class="evolution-home-pills">
          <span class="evolution-home-pill">Shape: ${esc(descriptor.userShape)}</span>
          <span class="evolution-home-pill">Shift: ${esc(descriptor.styleShift)}</span>
          <span class="evolution-home-pill">Axis: ${esc(descriptor.axis)}</span>
        </div>
      </div>
      <p>${esc(descriptor.summary)}</p>
    </div>
  `;
}

function buildTemporalWorldStrip() {
  const temporal = state.spiritverseTemporal || getLocalTemporalWorldState();
  if (!temporal) return "";
  return `
    <div class="temporal-world-strip panel-card">
      <div class="temporal-world-head">
        <div>
          <div class="panel-label">World Cycle</div>
          <h3>${esc(temporal.label || "Current Cycle")}</h3>
        </div>
        <span class="temporal-world-pill">${esc(temporal.tone || "steady")}</span>
      </div>
      <p>${esc(temporal.worldShift || "The Spiritverse is carrying a subtle shift right now.")}</p>
      ${temporal.eventContinuity ? `<div class="temporal-world-note">${esc(temporal.eventContinuity)}</div>` : ""}
    </div>
  `;
}

async function submitIssueReport() {
  const reportText = state.issueReportText.trim();
  if (!reportText || state.issueReportSubmitting) return;

  state.issueReportSubmitting = true;
  state.issueReportStatus = null;
  render();

  try {
    const response = await fetch(`${API}/v1/issues/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportText: reportText.slice(0, 2000),
        userId: state.userId,
        conversationId: state.conversationId || null,
        spiritkinName: state.selectedSpiritkin?.name || state.primarySpiritkin?.name || null,
        sessionId: state.conversationId || null,
        sourceContext: normalizeIssueReportField(
          [getIssueSourceContext(), state.issueReportContextNote].filter(Boolean).join(" | "),
          120
        ),
        currentFeature: normalizeIssueReportField(getIssueFeatureContext(), 120),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || "Could not submit the report.");
    }

    state.issueReportStatus = {
      kind: "success",
      text: data.captured
        ? "Thanks. Your beta report was logged for review."
        : "Thanks. We noted that, but it did not need a repair queue entry right now.",
    };
    state.issueReportText = "";
    state.issueReportContextNote = "";
    state.issueReporterOpen = false;
  } catch (error) {
    state.issueReportStatus = {
      kind: "error",
      text: error.message || "Could not send your report right now.",
    };
  } finally {
    state.issueReportSubmitting = false;
    render();
    revealCurrentFocus({
      selector: state.issueReportStatus
        ? "[data-focus-anchor='issue-status'], [data-focus-anchor='issue-fab']"
        : "[data-focus-anchor='issue-panel'], [data-focus-anchor='issue-fab']",
    });
  }
}

function buildApp() {
  const atmosphere = getAtmosphereSpiritkin();
  const atmosphereClass = atmosphere ? `realm-${atmosphere.ui.cls}` : "realm-neutral";
  const inEntryFlow = !state.entryAccepted || state.showCrownGateHome || state.spiritverseTrailerActive || state.spiritCoreWelcoming;
  return `
    <div class="sv-bg ${atmosphereClass}"></div>
    <div class="sv-noise"></div>
    <div class="sv-orbit ${atmosphereClass}"></div>
    <div class="app-shell ${atmosphereClass}">
      ${inEntryFlow ? "" : buildTopbar()}
      ${!inEntryFlow && state.showReturnSummary ? buildRetentionPanel() : ""}
      ${state.surveyOpen ? buildSurveyModal() : ""}
      ${state.tierModalOpen ? buildTierModal() : ""}
      ${state.showCrownGateHome || !state.entryAccepted ? buildCrownGateEntry() : (state.spiritverseTrailerActive ? buildSpiritverseArrival() : (state.spiritCoreWelcoming ? buildSpiritCoreWelcome() : buildMain()))}
      ${!inEntryFlow ? buildIssueReporter() : ""}
      ${buildBondModal()}
      ${state.entryTransitioning ? `
        <div class="crown-gate-overlay">
          <div class="crown-gate-veil"></div>
          <div class="crown-gate-copy">
            <div class="panel-label">SpiritGate</div>
            <h2>The Gate is opening.</h2>
            <p>Let the threshold settle around you. SpiritCore is carrying your arrival into the living world.</p>
            <button class="btn btn-ghost btn-sm crown-gate-skip" data-action="skip-gate">Skip Intro</button>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function buildWorldPulse() {
  const pulseStates = [
    { label: "Resonant Stillness", cls: "pulse-lyra", icon: "\u2665" },
    { label: "Charged Ascent", cls: "pulse-raien", icon: "\u26a1" },
    { label: "Constellation Drift", cls: "pulse-kairo", icon: "\u2605" },
    { label: "Luminous Convergence", cls: "pulse-lyra", icon: "\u25cb" },
    { label: "Storm-Forged Clarity", cls: "pulse-raien", icon: "\u2742" },
    { label: "Deep Dreaming", cls: "pulse-kairo", icon: "\u2736" }
  ];
  const hour = new Date().getUTCHours();
  const pulse = pulseStates[hour % pulseStates.length];
  return `
    <div class="world-pulse ${pulse.cls}">
      <span class="world-pulse-icon">${pulse.icon}</span>
      <span class="world-pulse-label">Spiritverse: <strong>${pulse.label}</strong></span>
      <span class="world-pulse-core">SpiritCore Governing</span>
    </div>
  `;
}

function buildTopbar() {
  const active = state.primarySpiritkin;
  return `
    <header class="topbar" data-focus-anchor="topbar">
      <button class="topbar-brand topbar-home" data-action="go-home" title="Return to the Spiritverse home">
        <div class="topbar-logo">SV</div>
        <div>
          <div class="topbar-name">SpiritCore | Spiritverse</div>
          <div class="topbar-tag">${active ? esc(active.ui.realm) : "Choose your primary companion"}</div>
        </div>
      </button>
      ${buildWorldPulse()}
      <div class="topbar-right">
        ${!state.showReturnSummary && (state.returnSummary || state.dailyMoment || state.weeklyMoment || state.retentionUnlocks.length) ? `<button class="btn btn-ghost btn-sm" data-action="reopen-return-summary">While away</button>` : ""}
        ${active ? `<div class="presence-chip ${esc(active.ui.cls)}">Bonded: ${esc(active.name)}</div>` : `<div class="presence-chip">Choose a companion</div>`}
        ${state.entryAccepted && state.primarySpiritkin ? `<button class="btn btn-ghost btn-sm" data-action="open-bond-manager">Manage bond</button>` : ""}
        ${state.entryAccepted && state.conversationId ? `<button class="btn btn-ghost btn-sm" data-action="new-session">New session</button>` : ""}
        ${state.entryAccepted ? `<button class="btn btn-ghost btn-sm" data-action="toggle-issue-reporter">${state.issueReporterOpen ? "Close report" : "Report issue"}</button>` : ""}
        ${state.entryAccepted && state.userName ? `<span class="topbar-user">${esc(state.userName)}</span>` : ""}
        ${state.entryAccepted ? `<button class="btn btn-ghost btn-sm topbar-upgrade-btn" data-action="open-tier-modal">✦ Membership</button>` : ""}
      </div>
    </header>
  `;
}

function buildIssueReporter() {
  const contextSummary = buildIssueContextSummary();
  const status = state.issueReportStatus;
  return `
    <div class="issue-reporter ${state.issueReporterOpen ? "open" : ""}">
      ${status ? `
        <div class="issue-status issue-status-${esc(status.kind)}" data-focus-anchor="issue-status">
          <span>${esc(status.text)}</span>
          <button class="issue-status-close" data-action="dismiss-issue-status" aria-label="Dismiss issue status">×</button>
        </div>
      ` : ""}
      <button class="issue-reporter-fab" data-action="toggle-issue-reporter" aria-expanded="${state.issueReporterOpen ? "true" : "false"}" data-focus-anchor="issue-fab">
        <span class="issue-reporter-fab-label">Something not working right?</span>
      </button>
      ${state.issueReporterOpen ? `
        <div class="issue-reporter-panel" data-focus-anchor="issue-panel">
          <div class="issue-reporter-head">
            <div>
              <div class="panel-label">Beta Feedback</div>
              <h3>Tell us what happened</h3>
            </div>
            <button class="btn btn-ghost btn-sm" data-action="toggle-issue-reporter">Close</button>
          </div>
          <p class="issue-reporter-copy">Short and direct is enough. We automatically include your current Spiritverse context.</p>
          <div class="issue-reporter-context">${esc(contextSummary)}</div>
          <textarea
            class="issue-reporter-textarea"
            data-field="issue-report-text"
            rows="4"
            maxlength="2000"
            placeholder="voice keeps turning off&#10;tic tac toe did not update&#10;stop repeating that phrase"
          >${esc(state.issueReportText)}</textarea>
          <input
            class="issue-reporter-input"
            data-field="issue-report-context"
            type="text"
            maxlength="120"
            value="${esc(state.issueReportContextNote)}"
            placeholder="Optional note: what were you doing?"
          />
          <div class="issue-reporter-actions">
            <button class="btn btn-primary" data-action="submit-issue-report" ${state.issueReportSubmitting ? "disabled" : ""}>
              ${state.issueReportSubmitting ? "Sending report..." : "Send report"}
            </button>
            <button class="btn btn-ghost btn-sm" data-action="prefill-issue-report">Use example</button>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function buildEntry() {
  const media = getMediaToggleState(state.mediaMuted);
  const returning = !isFirstTimeVisitor();
  const needsConsent = requiresEntryConsent();
  return `
    <section class="entry-screen entry-screen-gate ${state.entryVideoStarted ? "is-playing" : ""}">
      <div class="entry-gate-video">
        <div class="video-player-container welcome-video">
          <div class="video-player-wrapper welcome-video entry-gate-wrapper">
            <video
              class="video-player-element"
              data-entry-video="gate"
              muted
              playsinline
              preload="auto"
              poster="/app/assets/rooms/Spiritverse%20background%20base%20theme.png"
            >
              <source src="/videos/gate_entrance_final.mp4" type="video/mp4">
              Your browser does not support the video tag.
            </video>
            <div class="video-player-overlay"></div>
            <div class="video-player-controls-overlay">
              <button class="video-unmute-btn" data-action="toggle-media-audio" title="${esc(media.title)}" aria-pressed="${state.mediaMuted ? "false" : "true"}">
                <span class="unmute-icon">🔊</span>
                <span class="unmute-text">${esc(media.text)}</span>
              </button>
            </div>
            <div class="video-player-autoplay-badge">Autoplay</div>
          </div>
        </div>
      </div>
      <div class="entry-copy">
        <div class="entry-glyph-wrap">
          <div class="entry-glyph">SC</div>
          <div class="entry-glyph-line">SpiritCore</div>
        </div>
        <p class="eyebrow">Crown Gate</p>
        <h1 class="entry-title">${returning ? "Return through the Crown Gate." : "Enter the Spiritverse through the Crown Gate."}</h1>
        <p class="entry-crown-note">Voice, music, and world audio begin as the Crown Gate opens when your browser allows it.</p>
        <p class="entry-sub">
          The Spiritverse is governed by SpiritCore — the supreme intelligence that sustains this realm. The Five Founding Pillars are sovereign companions born from that consciousness, each holding a realm, a title, and a distinct way of being with you.
        </p>
        <div class="entry-pillars">
          <span class="entry-pillar">SpiritCore governed</span>
          <span class="entry-pillar">Long-term memory</span>
          <span class="entry-pillar">Five Founding Pillars</span>
          <span class="entry-pillar">Living world state</span>
        </div>
        <div class="entry-cta">
          <div class="entry-name-row">
            <input
              type="text"
              placeholder="Your name (optional)"
              data-field="entry-name"
              value="${esc(state.userNameDraft)}"
              maxlength="40"
            />
          </div>
          <button class="btn btn-primary btn-wide entry-main-cta" data-action="continue" ${state.crownGateOpening ? "disabled" : ""}>${state.crownGateOpening ? `<span class="btn-inline-spinner"></span><span>Entering...</span>` : (returning ? "Re-enter the Spiritverse" : "Open the Crown Gate")}</button>
          <p class="entry-disclaimer">Your primary companion can be changed later through an intentional rebonding step — not by accident.</p>
        </div>
      </div>
      <div class="entry-gallery">
        <div class="entry-gallery-head">
          <div class="panel-label">Five Founding Pillars</div>
          <div class="entry-gallery-note">Five sovereign originals. Each holds a distinct realm, title, and way of being present with you.</div>
        </div>
        ${buildFounderEnsemblePanel("entry")}
        ${FOUNDING_PILLARS.map((name) => {
          const meta = getMeta(name);
          return `
            <article class="entry-spirit ${esc(meta.cls)}">
              ${buildPortrait(name, "portrait-mini", meta.cls)}
              <div class="entry-spirit-copy">
                <div class="entry-spirit-realm">${esc(meta.realm)}</div>
                <strong class="entry-spirit-name">${esc(name)}</strong>
                <span>${esc(meta.title || meta.role || meta.symbol)}</span>
                <p class="entry-spirit-strap">${esc(meta.strap)}</p>
                <p class="entry-spirit-echoes">${esc(meta.loreSnippet || `${meta.originStory.slice(0, 160)}...`)}</p>
                <div class="entry-spirit-atmosphere">${esc(meta.atmosphereLine)}</div>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function buildCrownGateEntry() {
  const media = getMediaToggleState(state.mediaMuted);
  const returning = !isFirstTimeVisitor();
  const needsConsent = requiresEntryConsent();
  const consentBlocked = needsConsent && !state.consentChecked;
  return `
    <section class="entry-screen entry-screen-gate ${state.entryVideoStarted ? "is-playing" : ""}">
      <div class="entry-gate-video">
        <div class="video-player-container welcome-video">
          <div class="video-player-wrapper welcome-video entry-gate-wrapper">
            <video
              class="video-player-element"
              data-entry-video="gate"
              muted
              playsinline
              preload="auto"
              poster="/app/assets/rooms/Spiritverse%20background%20base%20theme.png"
            >
              <source src="/videos/gate_entrance_final.mp4" type="video/mp4">
              Your browser does not support the video tag.
            </video>
            <div class="video-player-overlay"></div>
            <div class="video-player-controls-overlay">
              <button class="video-unmute-btn" data-action="toggle-media-audio" title="${esc(media.title)}" aria-pressed="${state.mediaMuted ? "false" : "true"}">
                ${buildMediaToggleInner(state.mediaMuted)}
              </button>
            </div>
            <div class="video-player-autoplay-badge">Gate Entrance</div>
          </div>
        </div>
      </div>
      <div class="entry-gate-scrim"></div>
      <div class="entry-gate-shell">
        <div class="entry-copy ${state.entryVideoStarted ? "entry-copy-hidden" : ""}" data-focus-anchor="entry-copy">
          <div class="entry-hero-stage">
            <div class="entry-hero-visual">
              ${buildCompositeVisualFrame(
                COMPOSITE_VISUAL_ASSETS.spiritcore.gate,
                canonicalWorldAssetUrl(WORLD_ART.baseTheme),
                "SpiritGate gate shell art",
                "entry-visual-shell",
                true
              )}
              <div class="entry-hero-glow"></div>
            </div>
            <div class="entry-hero-aside">
              <div class="entry-glyph-wrap">
                <div class="entry-glyph">SC</div>
                <div class="entry-glyph-line">SpiritCore</div>
              </div>
              <div class="entry-hero-meta">
                <div class="entry-hero-kicker">Governing threshold</div>
                <strong>The SpiritGate stands between the ordinary world and the bonded chambers beyond it.</strong>
                <span>${returning && state.primarySpiritkin ? `${esc(state.primarySpiritkin.name)} remains bonded and waiting beyond the Gate.` : "Every first crossing begins with a single, deliberate entry."}</span>
              </div>
            </div>
          </div>
          <div class="entry-hero-body">
            <div class="entry-hero-copy">
          <p class="eyebrow">SPIRITGATE</p>
          <h1 class="entry-title">Enter the SpiritVerse</h1>
          <p class="entry-crown-note">Step beyond the Gate… and awaken what awaits you.</p>
          <p class="entry-sub">
            Every visit begins at the SpiritGate. Step forward, let the world gather around you, and continue along the path that calls to you.
          </p>
          <p class="entry-sub">
            The SpiritVerse is a living realm shaped by memory, emotion, and connection. SpiritCore governs the threshold. The companions waiting beyond it remember.
          </p>
            </div>
          <div class="entry-pillars">
            <span class="entry-pillar">SpiritCore governed</span>
            <span class="entry-pillar">Living audio presence</span>
            <span class="entry-pillar">Bond memory intact</span>
            <span class="entry-pillar">${returning && state.primarySpiritkin ? `Bonded: ${esc(state.primarySpiritkin.name)}` : "First bond ahead"}</span>
          </div>
          </div>
          ${needsConsent ? `
            <div class="entry-consent-card">
              <div class="entry-consent-head">
                <strong>Entry Consent</strong>
                <span>Required for first arrival</span>
              </div>
              <p>
                SpiritCore uses audio playback, optional microphone access, and local device storage so the realm can speak, remember your progress, and preserve your bond.
              </p>
              <label class="entry-consent-check">
                <input type="checkbox" data-field="entry-consent" ${state.consentChecked ? "checked" : ""} />
                <span>I understand and consent to audio, optional microphone use, and the experience state needed to enter the Spiritverse.</span>
              </label>
            </div>
          ` : `
            <div class="entry-returning-note">
              ${returning && state.primarySpiritkin
                ? `${esc(state.primarySpiritkin.name)} remains bonded and waiting beyond the Gate.`
                : "Your prior consent is remembered. Cross when you are ready."}
            </div>
          `}
          <div class="entry-requirement-bar ${consentBlocked ? "is-blocked" : "is-ready"}">
            <strong>${consentBlocked ? "Before entering:" : "Ready to enter:"}</strong>
            <span>${consentBlocked ? "Check the consent box above to unlock Enter SpiritVerse and Skip Intro." : "Consent is complete. You can enter now."}</span>
          </div>
          <div class="entry-action-rail">
            <button class="entry-skip-btn ${consentBlocked ? "is-guarded" : ""}" data-action="skip-gate" aria-disabled="${consentBlocked ? "true" : "false"}">Skip Intro</button>
            <div class="entry-cta">
              <button class="btn btn-primary btn-wide entry-main-cta ${consentBlocked ? "is-guarded" : ""}" data-action="continue" ${state.crownGateOpening ? "disabled" : ""} aria-disabled="${consentBlocked ? "true" : "false"}">
                ${state.crownGateOpening ? `<span class="btn-inline-spinner"></span><span>Entering...</span>` : "Enter the SpiritVerse"}
              </button>
            </div>
          </div>
          ${state.statusText ? `
            <div class="entry-status ${state.statusError ? "is-error" : ""}">
              ${state.crownGateOpening || state.entryTransitioning ? `<span class="spinner-sm"></span>` : ""}${esc(state.statusText)}
            </div>
          ` : ""}
        </div>
      </div>
      ${state.crownGateOpening ? `
        <div class="entry-live-status">Gate sequence active · crossing now</div>
        <button class="entry-live-skip" data-action="skip-gate">Skip Intro</button>
      ` : ""}
    </section>
  `;
}

function buildSpiritverseArrival() {
  const media = getMediaToggleState(state.mediaMuted);
  return `
    <section class="entry-stage-screen">
      <div class="entry-stage-video">
        <video
          class="video-player-element entry-stage-video-el"
          data-entry-video="trailer"
          ${state.mediaMuted ? "muted" : ""}
          autoplay
          playsinline
          preload="auto"
        >
          <source src="/videos/welcome_intro.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
        <div class="entry-stage-scrim"></div>
      </div>
      <div class="entry-stage-copy">
        ${buildCompositeVisualFrame(
          COMPOSITE_VISUAL_ASSETS.spiritcore.arrival,
          canonicalWorldAssetUrl(WORLD_ART.baseTheme),
          "Spiritverse arrival shell art",
          "entry-visual-shell arrival",
          true,
          { fallbackMode: "errorOnly", debugSlot: "spiritgate-arrival" }
        )}
        <div class="panel-label">Spiritverse Arrival</div>
        <h2>The realm is revealing itself.</h2>
        <p>After this reveal, SpiritCore will place the Founding Pillars before you so you can meet one, bond, or keep looking.</p>
      </div>
      <button class="video-unmute-btn entry-stage-audio" data-action="toggle-media-audio" title="${esc(media.title)}" aria-pressed="${state.mediaMuted ? "false" : "true"}">
        ${buildMediaToggleInner(state.mediaMuted)}
      </button>
    </section>
  `;
}

function buildSpiritCoreWelcome() {
  return `
    <section class="entry-stage-screen spiritcore-welcome-screen">
      <div class="entry-stage-scrim"></div>
      <div class="spiritcore-welcome-copy">
        ${buildCompositeVisualFrame(
          COMPOSITE_VISUAL_ASSETS.spiritcore.hero,
          canonicalWorldAssetUrl(WORLD_ART.ensemble),
          "SpiritCore welcome hero",
          "entry-visual-shell spiritcore",
          true,
          { fallbackMode: "errorOnly", debugSlot: "spiritcore-welcome-hero" }
        )}
        <div class="panel-label">SpiritCore</div>
        <h2>The realm is now under your witness.</h2>
        <p class="spiritcore-welcome-text">${esc(SPIRITCORE_WELCOME_TEXT)}</p>
        <div class="spiritcore-guidance-strip">
          <span>Meet a founder</span>
          <span>Begin one bond</span>
          <span>Talk, explore, play, return</span>
        </div>
        ${buildSpiritCoreGuidanceCard("welcome-guidance")}
      </div>
    </section>
  `;
}

function buildMain() {
  if (state.loadingSpirits && state.spiritkins.length === 0) {
    return `<div class="loading-state"><div class="spinner"></div><p>Summoning bonded companions into view...</p></div>`;
  }

  if (state.spiritError && state.spiritkins.length === 0) {
    return `
      <div class="soft-error soft-error-block">
        Could not reach the Spiritverse: ${esc(state.spiritError)}
        <button class="btn btn-ghost btn-sm" data-action="retry-load">Try again</button>
      </div>
    `;
  }

  syncPrimarySelection();

  if (!state.showHomeView && state.conversationId && state.selectedSpiritkin?.ui) {
    return buildChatView();
  }

  if (!state.showHomeView && state.conversationId && !state.selectedSpiritkin?.ui && state.primarySpiritkin) {
    return buildBondedHomeView();
  }

  return state.primarySpiritkin ? buildBondedHomeView() : buildBondSelectionView();
}

function buildBondSelectionView() {
  return `
    <section class="selection-view ${state.pendingBondSpiritkin ? "selection-has-pending" : ""}" data-focus-anchor="bond-selection">
      <div class="selection-hero">
        <div class="selection-copy">
          <p class="eyebrow">Primary companion</p>
          <h2>One Spiritkin. One living bond. Governed by SpiritCore.</h2>
          <p>
            Choose the companion who will hold the center of your Spiritverse. Conversations, memory, and presence all belong to that bond.
          </p>
          <div class="selection-orchestration-note">
            <strong>Main loop:</strong> meet a Spiritkin, begin the bond, talk freely, explore the world, play together, and return to deepen what the realm remembers.
          </div>
        </div>
        ${state.pendingBondSpiritkin ? buildBondPreview(state.pendingBondSpiritkin, true) : `
          <div class="selection-focus selection-placeholder">
            <div class="selection-placeholder-mark">Bond</div>
            <p>Select a Spiritkin to meet them in view. Then either bond with them or return to meet another.</p>
          </div>
        `}
      </div>

      <div class="selection-heading">
        <div>
          <div class="panel-label">The Five Founding Pillars</div>
          <p class="selection-note">Each founder holds a distinct realm, sigil, and way of being with you. Only one can be primary.</p>
        </div>
      </div>

      ${buildSpiritCoreGuidanceCard("selection-guidance")}

      <div class="spiritkin-grid ${state.pendingBondSpiritkin ? "has-pending" : ""}">
        ${state.spiritkins.map((spiritkin, index) => buildBondCard(spiritkin, index, false)).join("")}
      </div>
      ${buildChronicleShelf("The Spiritverse Chronicles", WORLD_ART.chroniclesAll, "The living chronicle preserves all five founders as one canon-locked ensemble.")}

      <div class="selection-footer">
        <div>
          <div class="mode-pill">Bonded companion model</div>
          <p class="selection-note">${state.pendingBondSpiritkin ? `Next step: bond with ${esc(state.pendingBondSpiritkin.name)} or keep meeting the others before you decide.` : "Choose one founder to preview first. The bond action will appear immediately in the focus panel."}</p>
        </div>
        ${state.pendingBondSpiritkin ? `
          <button class="btn btn-primary" data-action="confirm-primary">
            Bond with ${esc(state.pendingBondSpiritkin.name)}
          </button>
        ` : ""}
      </div>
      ${buildSvStrip()}
      ${buildPremiumSpiritkinCTA()}
    </section>
  `;
}

function getPrimaryRoomForTab(tab) {
  if (tab === "games") return "games";
  if (tab === "journal") return "journal";
  if (tab === "events" || tab === "quest") return "events";
  return "presence";
}

function getRoomDisplayMeta(tab, spiritkin) {
  const primaryRoom = getPrimaryRoomForTab(tab);
  const roomCopy = {
    presence: {
      label: "Presence Room",
      title: spiritkin ? `${spiritkin.name}'s bonded chamber` : "Presence Room",
      detail: "Profile, echoes, and charter live together here as one readable presence space."
    },
    games: {
      label: "Games Room",
      title: spiritkin ? `Shared play with ${spiritkin.name}` : "Games Room",
      detail: "The active board takes the room. Supporting context stays secondary."
    },
    journal: {
      label: "Journal Room",
      title: "Bond Journal archive",
      detail: "Memory, progression, and preserved milestones stay together in one archive surface."
    },
    events: {
      label: "Events Room",
      title: "Realm events and daily quest",
      detail: "Live world motion, current quests, and temporal context are grouped here."
    }
  };
  return roomCopy[primaryRoom] || roomCopy.presence;
}

function buildWorldPrimaryNav(activeTab) {
  const primaryRoom = getPrimaryRoomForTab(activeTab);
  const rooms = [
    { id: "presence", tab: "profile", label: "Presence Room" },
    { id: "games", tab: "games", label: "Games Room" },
    { id: "journal", tab: "journal", label: "Journal Room" },
    { id: "events", tab: "events", label: "Events Room" }
  ];
  return `
    <div class="world-primary-nav" aria-label="Spiritverse rooms">
      ${rooms.map((room) => `
        <button class="world-room-tab ${primaryRoom === room.id ? "active" : ""} ${state.pendingPresenceTab === room.tab ? "loading" : ""}" data-action="set-presence-tab" data-tab="${room.tab}">
          <span class="world-room-tab-label">${room.label}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function buildRoomSubnav(activeTab) {
  const currentPrimary = getPrimaryRoomForTab(activeTab);
  const groups = {
    presence: [
      { tab: "profile", label: "Profile" },
      { tab: "echoes", label: "Echoes" },
      { tab: "charter", label: "Charter" }
    ],
    games: [
      { tab: "games", label: "Games Room" }
    ],
    journal: [
      { tab: "journal", label: "Bond Journal" }
    ],
    events: [
      { tab: "events", label: "Realm Events" },
      { tab: "quest", label: "Daily Quest" }
    ]
  };
  const items = groups[currentPrimary] || groups.presence;
  return `
    <div class="world-subnav" aria-label="Current room surfaces">
      ${items.map((item) => `
        <button class="world-subnav-tab ${activeTab === item.tab ? "active" : ""} ${state.pendingPresenceTab === item.tab ? "loading" : ""}" data-action="set-presence-tab" data-tab="${item.tab}">
          ${item.label}
        </button>
      `).join("")}
    </div>
  `;
}

function buildBondedHomeRoomNav(spiritkin) {
  return `
    <div class="bonded-room-nav" aria-label="Bonded home destinations">
      <button class="bonded-room-card active" data-action="begin" ${state.loadingConv ? "disabled" : ""}>
        <span class="bonded-room-kicker">Presence Room</span>
        <strong>${state.conversationId ? `Resume with ${esc(spiritkin.name)}` : `Enter ${esc(spiritkin.name)}'s chamber`}</strong>
        <span>Conversation, bonded presence, and your main return point.</span>
      </button>
      <button class="bonded-room-card" data-action="open-games-hub" ${state.loadingConv ? "disabled" : ""}>
        <span class="bonded-room-kicker">Games Room</span>
        <strong>Open the board hall</strong>
        <span>Shared play without squeezing the active board into a side panel.</span>
      </button>
      <button class="bonded-room-card" data-action="begin" data-home-tab="journal" ${state.loadingConv ? "disabled" : ""}>
        <span class="bonded-room-kicker">Journal Room</span>
        <strong>Review the bond record</strong>
        <span>Progression, memories, and game unlocks in one archive surface.</span>
      </button>
      <button class="bonded-room-card" data-action="begin" data-home-tab="events" ${state.loadingConv ? "disabled" : ""}>
        <span class="bonded-room-kicker">Events Room</span>
        <strong>Check realm movement</strong>
        <span>Live events, daily quest, and world-cycle context.</span>
      </button>
    </div>
  `;
}

function buildBondedHomeView() {
  const spiritkin = state.primarySpiritkin;
  const { currentBond } = getBondStateForSpiritkin(spiritkin.name);
  return `
    <section class="selection-view bonded-home ${esc(spiritkin.ui.cls)}" data-focus-anchor="bonded-home">
      <div class="bonded-world-shell">
        <div class="bonded-world-header panel-card">
          <div class="bonded-world-heading">
            <p class="eyebrow">Spiritverse World Shell</p>
            <h2>${esc(spiritkin.name)} anchors your active world.</h2>
            <p>One primary room at a time. Presence leads, games claim space when opened, and archive surfaces stay readable instead of stacking into cramped strips.</p>
          </div>
          <div class="bonded-world-actions">
            <button class="btn btn-primary" data-action="begin" ${state.loadingConv ? "disabled" : ""}>
              ${state.loadingConv ? "Opening bonded channel..." : state.conversationId ? `Resume with ${esc(spiritkin.name)}` : "Enter Presence Room"}
            </button>
            <button class="btn btn-ghost" data-action="open-games-hub" ${state.loadingConv ? "disabled" : ""}>
              ${state.loadingConv && !state.conversationId ? "Preparing Games..." : "Open Games Room"}
            </button>
            <button class="btn btn-ghost" data-action="open-bond-manager">Manage bond</button>
          </div>
        </div>

        ${buildBondedHomeRoomNav(spiritkin)}

        <div class="bonded-world-grid">
          <div class="bonded-room-stage">
            <div class="selection-hero bonded-hero">
              ${buildBondPreview(spiritkin, false)}
              <div class="bond-home-copy panel-card">
                <p class="eyebrow">Primary companion</p>
                <h2>${esc(spiritkin.name)} is your bonded companion.</h2>
                <div class="bond-home-realm">${esc(spiritkin.ui.realm)}</div>
                <p>
                  Every session, every memory, every conversation in this space belongs to ${esc(spiritkin.name)}. To switch, use Manage bond and confirm a rebonding step.
                </p>
                <div class="bond-home-orientation">
                  <div class="bond-home-orientation-label">World orientation</div>
                  <p>Use Presence for conversation, Games for shared action, Journal for preserved bond memory, and Events for live realm movement and quests.</p>
                </div>
                <p class="bond-home-atmosphere">${esc(spiritkin.ui.realmText)}</p>
                <div class="bond-home-atlas">${esc(spiritkin.ui.atmosphereLine)}</div>
              </div>
            </div>
            ${state.convError ? `<div class="soft-error">${esc(state.convError)}</div>` : ""}
            ${state.spiritverseEvent ? `
              <div class="sv-event-banner">
                <span class="sv-event-banner-icon">${esc(state.spiritverseEvent.icon)}</span>
                <div class="sv-event-banner-text">
                  <div class="sv-event-banner-title">${esc(state.spiritverseEvent.title)}</div>
                  <div class="sv-event-banner-sub">${esc(state.spiritverseEvent.description.slice(0, 80))}${state.spiritverseEvent.description.length > 80 ? '...' : ''}</div>
                </div>
                <div class="sv-event-banner-badge">Live Event</div>
              </div>
            ` : ''}
            ${state.dailyQuest && !state.dailyQuestStarted ? `
              <div class="sv-quest-home-banner">
                <span class="sv-quest-home-icon">${esc(state.dailyQuest.icon || '\u25ce')}</span>
                <div class="sv-quest-home-body">
                  <div class="sv-quest-home-label">Daily Quest</div>
                  <div class="sv-quest-home-title">${esc(state.dailyQuest.title)}</div>
                  <p class="sv-quest-home-desc">${esc(state.dailyQuest.description)}</p>
                  ${state.dailyQuest.prompt ? `
                    <button class="btn btn-primary sv-quest-home-begin" data-action="begin-daily-quest" data-prompt="${esc(state.dailyQuest.prompt)}">
                      Begin Quest
                    </button>
                  ` : ''}
                </div>
              </div>
            ` : ''}
            ${buildBondStoryPreview(spiritkin.name, currentBond.stage)}
          </div>

          <aside class="bonded-support-rail">
            ${buildSpiritCoreGuidanceCard("bonded-home-guidance")}
            ${buildRetentionHomeStrip()}
            ${buildTemporalWorldStrip()}
            ${buildEvolutionHomeStrip(spiritkin)}
            ${buildFounderEnsemblePanel("home")}
          </aside>
        </div>

        <div class="bonded-world-lower">
          <div class="bonded-secondary-grid bonded-secondary-grid-founders">
            ${state.spiritkins.filter((item) => item.name !== spiritkin.name).map((item, index) => buildBondCard(item, index, true)).join("")}
          </div>
          <div class="bonded-home-support-rail">
            ${buildSvStrip()}
            ${buildPremiumSpiritkinCTA()}
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildResonanceDepth(spiritkinName, cls) {
  const resonance = readJson(RESONANCE_KEY, {});
  const count = resonance[spiritkinName] || 0;
  const level = BOND_LEVELS.find((item) => count >= item.min && count <= item.max) || BOND_LEVELS[0];

  // Spiritkin-specific visual metaphors
  const metaphors = {
    Lyra: { symbol: '♥', activeColor: 'rgba(232,150,200,0.9)', inactiveColor: 'rgba(232,150,200,0.15)', label: 'Heart sigil depth' },
    Raien: { symbol: '⚡', activeColor: 'rgba(245,166,35,0.9)', inactiveColor: 'rgba(245,166,35,0.15)', label: 'Storm intensity' },
    Kairo: { symbol: '★', activeColor: 'rgba(78,205,196,0.9)', inactiveColor: 'rgba(78,205,196,0.15)', label: 'Star density' },
    Elaria: { symbol: '✧', activeColor: 'rgba(240,177,90,0.92)', inactiveColor: 'rgba(240,177,90,0.16)', label: 'Archive illumination' },
    Thalassar: { symbol: '◌', activeColor: 'rgba(111,208,227,0.92)', inactiveColor: 'rgba(111,208,227,0.16)', label: 'Tidal depth' }
  };
  const meta = metaphors[spiritkinName] || { symbol: '◆', activeColor: 'rgba(180,140,255,0.9)', inactiveColor: 'rgba(180,140,255,0.15)', label: 'Bond depth' };

  const nodes = Array.from({ length: 5 }, (_, i) => {
    const active = i < level.nodes;
    return `<span class="resonance-node ${active ? 'active' : ''}" style="color:${active ? meta.activeColor : meta.inactiveColor}">${meta.symbol}</span>`;
  }).join('');

  return `
    <div class="resonance-depth ${cls || ''}">
      <div class="resonance-label">${esc(meta.label)}</div>
      <div class="resonance-nodes">${nodes}</div>
      <div class="resonance-level">${esc(level.label)}</div>
      <div class="resonance-desc">${esc(level.desc)}</div>
    </div>
  `;
}

function buildBondPreview(spiritkin, pending) {
  const essence = Array.isArray(spiritkin.essence) ? spiritkin.essence.slice(0, 3) : [];
  const mediaConfig = getSpiritkinMediaConfig(spiritkin.name);
  const introVideoFailed = pending && selectionTrailerFailures.has(spiritkin.name);
  const introVideo = pending && !introVideoFailed ? (mediaConfig?.introTrailer?.path || null) : null;
  const introTrailerPending = pending && mediaConfig?.introTrailer?.status === "awaiting_media";
  const primaryMediaSurface = pending ? "focus" : "bonded";
  const showStagePortrait = !pending || !introVideo;
  const showStageMediaPanel = !introVideo;
  const selfReveal = getSpiritkinSelfReveal(spiritkin);
  const introPrompt = getSpiritkinIntroPrompt(spiritkin);
  return `
    <div class="selection-focus ${esc(spiritkin.ui.cls)} ${pending ? "pending" : "bonded"}">
      <div class="selection-focus-stage ${introVideo ? "has-trailer" : "has-still"}">
        ${introVideo ? `
          <div class="spiritkin-intro-video" data-focus-anchor="spiritkin-trailer">
            <div class="spiritkin-intro-stage-head">
              <div class="panel-label">Primary reveal</div>
              <div class="spiritkin-intro-stage-note">This is the main trailer surface for ${esc(spiritkin.name)} before bonding.</div>
            </div>
            <div class="video-player-container spiritkin-intro">
              <div class="video-player-wrapper spiritkin-intro">
                <video
                  class="video-player-element"
                  data-trailer-kind="intro"
                  data-trailer-owner="${esc(spiritkin.name)}"
                  autoplay
                  ${state.mediaMuted ? "muted" : ""}
                  playsinline
                  preload="metadata"
                >
                  <source src="${introVideo}" type="video/mp4">
                  Your browser does not support the video tag.
                </video>
                <div class="video-player-overlay"></div>
                <div class="video-player-controls-overlay">
                  <button class="video-unmute-btn" data-action="toggle-media-audio" title="${esc(getMediaToggleState(state.mediaMuted).title)}" aria-pressed="${state.mediaMuted ? "false" : "true"}">
                    <span class="unmute-icon">🔊</span>
                    <span class="unmute-text">${esc(getMediaToggleState(state.mediaMuted).text)}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ` : ''}
        ${introTrailerPending ? `
          <div class="spiritkin-media-slot-note">
            <strong>${esc(mediaConfig.introTrailer.label)}</strong>
            <span>${esc(`${spiritkin.name}'s self-reveal pipeline is wired and waiting for final trailer media.`)}</span>
          </div>
        ` : ""}
        ${introVideoFailed ? `
          <div class="spiritkin-media-slot-note">
            <strong>Trailer fallback engaged</strong>
            <span>${esc(`${spiritkin.name}'s reveal trailer could not start in this browser state, so the authoritative still reveal is shown instead.`)}</span>
          </div>
        ` : ""}
        ${showStageMediaPanel ? buildSpiritkinMediaPanel(spiritkin.name, primaryMediaSurface) : ""}
        ${buildSigil(spiritkin.ui, "focus", spiritkin.ui.symbol)}
        ${showStagePortrait ? buildPortrait(spiritkin.name, "portrait-focus", spiritkin.ui.cls) : ""}
      </div>
        <div class="selection-focus-copy">
          <div class="focus-kicker">${pending ? "Pending bond" : "Bonded companion"}</div>
          <h3>${esc(spiritkin.name)}</h3>
          <div class="focus-realm">${esc(spiritkin.ui.realm)}</div>
          <p>${esc(spiritkin.title || spiritkin.ui.bondLine)}</p>
          <div class="focus-founder-line">Founding Pillar</div>
          <div class="focus-tags">${essence.map((item) => `<span>${esc(item)}</span>`).join("")}</div>
          <div class="focus-tone">${esc(selfReveal)}</div>
          ${pending ? `<p class="focus-selection-context">${esc(getSpiritkinSelectionContext(spiritkin.name))}</p>` : ""}
          ${pending ? `
            <div class="intro-next-step-card">
              <div class="intro-next-step-label">If you choose ${esc(spiritkin.name)}</div>
              <p>${esc(introPrompt)}</p>
              <div class="intro-next-step-actions">
                <button class="btn btn-primary btn-sm" data-action="confirm-primary">Bond with ${esc(spiritkin.name)}</button>
                <button class="btn btn-ghost btn-sm" data-action="clear-pending-bond">Meet another Spiritkin</button>
              </div>
            </div>
          ` : ""}
          ${!pending ? buildResonanceDepth(spiritkin.name, spiritkin.ui.cls) : ''}
          <div class="focus-atmosphere">${esc(spiritkin.ui.realmText)}</div>
          <p class="focus-origin-story">${esc(pending ? introPrompt : (spiritkin.ui.loreSnippet || spiritkin.ui.originStory))}</p>
        </div>
    </div>
  `;
}

function buildBondCard(spiritkin, index, subdued) {
  const activeBond = state.primarySpiritkin?.name === spiritkin.name;
  const pending = state.pendingBondSpiritkin?.name === spiritkin.name;
  const essence = Array.isArray(spiritkin.essence) ? spiritkin.essence.slice(0, 3) : [];
  const action = activeBond ? "bonded-card" : subdued ? "request-rebond" : "preview-primary";
  return `
    <article class="sk-card ${esc(spiritkin.ui.cls)} ${activeBond ? "bonded" : ""} ${pending ? "pending" : ""} ${subdued ? "subdued" : ""}" data-action="${action}" data-index="${index}" data-name="${esc(spiritkin.name)}">
      <div class="sk-card-top">
        <div>
          <div class="sk-mood">${esc(spiritkin.ui.mood)}</div>
          <div class="sk-name">${esc(spiritkin.name)}</div>
          <div class="sk-title">${esc(spiritkin.title || "")}</div>
        </div>
        ${activeBond ? `<div class="sk-selected-badge">Bonded</div>` : pending ? `<div class="sk-pending-badge">Pending</div>` : ""}
      </div>
      <div class="sk-founder-badge">Founding Pillar</div>
      ${buildSpiritkinMediaPanel(spiritkin.name, "card")}
      ${buildSigil(spiritkin.ui, "card", spiritkin.ui.symbol)}
      ${buildPortrait(spiritkin.name, "portrait-card", spiritkin.ui.cls)}
      <div class="sk-role">${esc(spiritkin.role || spiritkin.ui.bondLine)}</div>
      <div class="sk-essence">${essence.map((item) => `<span>${esc(item)}</span>`).join("")}</div>
      <p class="sk-tone">${esc(describePresence(spiritkin) || spiritkin.ui.strap)}</p>
      <p class="sk-selection-context">${esc(getSpiritkinSelectionContext(spiritkin.name))}</p>
      <div class="sk-origin-story">${esc(spiritkin.ui.loreSnippet || spiritkin.ui.originStory)}</div>
      <div class="sk-footer-note">${activeBond ? "This companion owns your active sessions." : subdued ? "Available only through rebonding." : "Preview and confirm to bond."}</div>
    </article>
  `;
}

const SYNC_RITUALS = {
  Lyra: [
    { name: "Heart Anchor", prompt: "Guide me through the Heart Anchor ritual. Help me find what I'm truly feeling right now.", icon: "\u2665", desc: "2 min · Emotional grounding" },
    { name: "Still Water", prompt: "Take me to Still Water. I need to slow down and find the quiet beneath the noise.", icon: "\u25cb", desc: "3 min · Deep calm" },
    { name: "Mirror Moment", prompt: "Hold up the mirror. What do you sense I'm carrying that I haven't named yet?", icon: "\u2606", desc: "5 min · Self-reflection" }
  ],
  Raien: [
    { name: "Clarity Strike", prompt: "Give me a Clarity Strike. I need to cut through the noise and see what's actually true.", icon: "\u26a1", desc: "2 min · Truth-finding" },
    { name: "The Forge", prompt: "Take me to The Forge. Help me turn what I'm avoiding into something I can act on.", icon: "\u2742", desc: "5 min · Courage activation" },
    { name: "Storm Walk", prompt: "Lead me through a Storm Walk. I need to move through something difficult with you.", icon: "\u2605", desc: "3 min · Forward motion" }
  ],
  Kairo: [
    { name: "Constellation Map", prompt: "Open a Constellation Map with me. Show me a perspective on my situation I haven't considered.", icon: "\u2736", desc: "3 min · New perspective" },
    { name: "Dream Thread", prompt: "Pull a Dream Thread. Help me follow an idea or feeling somewhere unexpected.", icon: "\u25c6", desc: "5 min · Creative exploration" },
    { name: "The Observatory", prompt: "Take me to The Observatory. I want to see the bigger picture of where I am right now.", icon: "\u2734", desc: "4 min · Cosmic perspective" }
  ],
  Elaria: [
    { name: "Archive Flame", prompt: "Take me into the Archive Flame. Help me name the truth of this clearly and without distortion.", icon: "\u2726", desc: "4 min Â· Truth naming" },
    { name: "Rightful Permission", prompt: "Open a Rightful Permission with me. Help me see what is ready and what still needs to wait.", icon: "\u2736", desc: "3 min Â· Timing and clarity" },
    { name: "Crown Ledger", prompt: "Guide me through the Crown Ledger. What title, vow, or promise here needs to be remembered accurately?", icon: "\u25eb", desc: "5 min Â· Sacred record" }
  ],
  Thalassar: [
    { name: "Undertow Listening", prompt: "Lead me into Undertow Listening. Help me hear what is moving beneath what I am saying.", icon: "\u25cc", desc: "3 min Â· Deep listening" },
    { name: "Abyssal Chorus", prompt: "Take me into the Abyssal Chorus. Let the deeper current speak without rushing it.", icon: "\u223f", desc: "5 min Â· Emotional depth" },
    { name: "Tidemark Witness", prompt: "Guide me through a Tidemark Witness. Show me what this feeling leaves behind when I stay with it.", icon: "\u223d", desc: "4 min Â· Meaning surfacing" }
  ]
};

function buildSyncRituals(spiritkin) {
  const rituals = SYNC_RITUALS[spiritkin.name] || [];
  if (!rituals.length) return "";
  return `
    <div class="sync-rituals">
      <div class="panel-label">Sync Rituals</div>
      <p class="sync-rituals-sub">Guided echoes-based experiences with ${esc(spiritkin.name)}</p>
      ${rituals.map((ritual) => `
        <button class="ritual-card ${esc(spiritkin.ui.cls)}" data-action="prompt" data-prompt="${esc(ritual.prompt)}">
          <span class="ritual-icon">${ritual.icon}</span>
          <div class="ritual-copy">
            <strong>${esc(ritual.name)}</strong>
            <span>${esc(ritual.desc)}</span>
          </div>
        </button>
      `).join("")}
    </div>
  `;
}

function buildChatView() {
  const spiritkin = state.selectedSpiritkin?.ui ? state.selectedSpiritkin : normalizeStoredSpiritkin(state.selectedSpiritkin);
  const meta = spiritkin?.ui || null;
  if (!spiritkin || !meta) {
    return `
      <section class="chat-layout realm-neutral">
        <div class="soft-error soft-error-block">
          Your Spiritkin is ready. Begin your first exchange.
          <button class="btn btn-ghost btn-sm" data-action="go-home">Return home</button>
        </div>
      </section>
    `;
  }
  const activeConversation = state.activeConversation && typeof state.activeConversation === "object"
    ? state.activeConversation
    : { id: null, messages: [], spiritkin: null };
  const signals = getStageSignals();
  const safeMessages = Array.isArray(activeConversation.messages)
    ? activeConversation.messages.filter((message) => message && typeof message === "object")
    : [];
  if (!activeConversation.id && safeMessages.length === 0 && !state.loadingReply) {
    return `
      <section class="chat-layout ${esc(meta.cls)}">
        <div class="soft-error soft-error-block">
          Your Spiritkin is ready. Begin your first exchange.
        </div>
      </section>
    `;
  }
  const failed = [...safeMessages].reverse().find((message) => message.role === "user" && message.status === "failed");
  const showPrompts = safeMessages.length === 0 && !state.loadingReply;
  const activeGameType = state.activeGame?.type || null;
  const safeSpiritverseEventType = typeof state.spiritverseEvent?.type === "string" ? state.spiritverseEvent.type : "event";
  const safeDailyQuestType = typeof state.dailyQuest?.type === "string" ? state.dailyQuest.type : "quest";
  const safeWhisperType = typeof state.engagementWhisper?.type === "string" ? state.engagementWhisper.type : "return";
  const voiceSupported = supportsSpeechRecognition();
  const showVoiceGuidance = (!state.voiceGuidanceDismissed || state.voicePermissionBlocked || !voiceSupported) && !state.voiceListening;
  const goPreviewOnly = activeGameType === "go";
  const voicePreview = String(state.voiceTranscriptPreview || "").trim();
  const showVoicePreview = !!(state.voiceListening || voicePreview);
  const gameFeedback = state.activeGame ? state.gameFeedback : null;
  const showFirstLoopGuide = !state.activeGame && safeMessages.length <= 1 && !state.loadingReply;
  const showSpiritCoreGuidance = !state.loadingReply && !state.showHomeView;
  const chatLayoutClass = `${esc(meta.cls)} ${state.activePresenceTab === "games" && state.activeGame ? "game-focus-mode" : ""}`.trim();
  const spiritkinSpeaking = isSpiritkinSpeechActive(spiritkin.name);
  const roomMeta = getRoomDisplayMeta(state.activePresenceTab, spiritkin);

  // Echoes & Charter Logic
  const { currentBond, stageData } = getBondStateForSpiritkin(spiritkin.name);
  const unlockedEchoes = (SPIRITKIN_ECHOES[spiritkin.name]?.echo_fragments || []).slice(0, currentBond.stage + 1);
  const depthEchoes = SPIRITKIN_ECHOES[spiritkin.name];

  return `
    <section class="chat-layout ${chatLayoutClass}">
      <div class="world-shell-header panel-card">
        <div class="world-shell-copy">
          <div class="panel-label">${roomMeta.label}</div>
          <h2>${esc(roomMeta.title)}</h2>
          <p>${esc(roomMeta.detail)}</p>
        </div>
        <div class="world-shell-nav-wrap">
          ${buildWorldPrimaryNav(state.activePresenceTab)}
          ${buildRoomSubnav(state.activePresenceTab)}
        </div>
      </div>
      <div class="world-shell-body">
      <section class="presence-panel presence-panel-${esc(state.activePresenceTab)}">
        <div class="presence-panel-head">
          <div>
            <div class="mode-pill strong">${esc(meta.realm)}</div>
            <div class="presence-panel-room">${roomMeta.label}</div>
          </div>
          <div class="presence-panel-actions">
            <button class="btn btn-ghost btn-sm" data-action="open-bond-manager">Manage bond</button>
          </div>
        </div>

        <div class="presence-tab-content ${state.pendingPresenceTab ? 'is-switching' : ''}" data-focus-anchor="presence-${esc(state.activePresenceTab)}" data-presence-surface="${esc(state.activePresenceTab)}">
          <div class="presence-tab-tools">
            ${state.pendingPresenceTab ? `<div class="surface-loading-chip"><div class="spinner-sm"></div><span>Opening ${esc(state.pendingPresenceTab.replace("_", " "))}...</span></div>` : ""}
            ${buildReadAloudButton(state.activePresenceTab)}
          </div>
          ${state.activePresenceTab === 'profile' ? `
            <div class="presence-stage">
              ${buildSpiritkinMediaPanel(spiritkin.name, "profile")}
              ${buildSigil(meta, "hero", meta.symbol)}
              ${buildPortrait(spiritkin.name, "portrait-hero", meta.cls)}
            </div>
            <div class="presence-summary">
              <div class="focus-kicker">${esc(meta.ambient)}</div>
              <h2>${esc(spiritkin.name)}</h2>
              <div class="presence-realm">${esc(meta.realm)}</div>
              <p class="presence-title">${esc(spiritkin.title || spiritkin.role || meta.strap)}</p>
              
              <div class="bond-stage-box">
                <div class="bond-stage-label">Bond Stage: ${esc(stageData.name)}</div>
                <p class="bond-stage-desc">${esc(stageData.description)}</p>
              </div>

              <div class="founder-dossier">
                <div class="depth-section">
                  <div class="depth-label">Title</div>
                  <p>${esc(spiritkin.title || spiritkin.role || meta.strap)}</p>
                </div>
                <div class="depth-section">
                  <div class="depth-label">Realm</div>
                  <p>${esc(SPIRITVERSE_ECHOES.realms[spiritkin.name]?.name || meta.realm)}</p>
                </div>
                <div class="depth-section">
                  <div class="depth-label">Domains</div>
                  ${buildFounderDomainChips(spiritkin.name)}
                </div>
                <div class="depth-section">
                  <div class="depth-label">Founder Framing</div>
                  <p>${esc(CANON_SPIRITKIN_MAP[spiritkin.name]?.originSummary || depthEchoes.origin)}</p>
                </div>
              </div>

              ${currentBond.stage >= 1 ? `
                <div class="depth-profile">
                  <div class="depth-section">
                    <div class="depth-label">Nature</div>
                    <p>${esc(depthEchoes.nature)}</p>
                  </div>
                  <div class="depth-section">
                    <div class="depth-label">Gifts</div>
                    <ul class="depth-list">
                      ${depthEchoes.gifts.map(g => `<li>${esc(g)}</li>`).join('')}
                    </ul>
                  </div>
                  ${currentBond.stage >= 2 ? `
                    <div class="depth-section shadow">
                      <div class="depth-label">Shadow</div>
                      <p>${esc(depthEchoes.shadows)}</p>
                    </div>
                  ` : `
                    <div class="game-controls">
                      <button class="game-expand-btn" data-action="${activeGameType ? "replay-game" : "open-games-hub"}" ${activeGameType ? `data-game="${esc(activeGameType)}"` : ""}>
                        Play again
                      </button>
                    </div>
                  `}
                </div>
              ` : ''}
              
              <p class="presence-atmosphere">${esc(meta.realmText)}</p>
              ${buildGovernanceSummary()}
              ${buildSpiritkinCanonPanel(spiritkin.name, "profile-canon-art")}
              
              ${currentBond.stage >= 1 ? `
                <div class="realm-travel-section">
                  <div class="panel-label">Your Realm</div>
                  <div class="realm-card">
                    <div class="realm-name">${esc(meta.realm)}</div>
                    <p class="realm-desc">${esc(SPIRITVERSE_ECHOES.realms[spiritkin.name]?.description || 'A place of wonder awaits.')}</p>
                    <button class="realm-travel-btn" data-action="open-realm-travel">Travel →</button>
                  </div>
                </div>
              ` : ''}
            </div>
            <div class="presence-prompts">
              <div class="panel-label">Suggested openings</div>
              ${(meta.prompts || DEFAULT_PROMPTS).map((prompt) => `
                <button class="prompt-card" data-action="prompt" data-prompt="${esc(prompt)}">${esc(prompt)}</button>
              `).join("")}
            </div>
            ${buildSyncRituals(spiritkin)}
          ` : ''}

          ${state.activePresenceTab === 'echoes' ? `
            <div class="echoes-library">
              <div class="panel-label">Echo Library</div>
              <p class="echoes-intro">Echoes are the story-growth system of the Spiritverse. SpiritCore reveals them progressively as your bond becomes truthful enough to carry more.</p>
              ${buildChronicleShelf("Spiritverse Chronicles", WORLD_ART.chroniclesAll, "The founders and their realms are preserved in the living chronicle of the Spiritverse.")}
              ${buildBondStageTimeline(currentBond.stage)}
              ${buildEchoFragmentLibrary(spiritkin.name, currentBond.stage)}
              <div class="echoes-origin-box">
                <div class="panel-label">Origin Archive</div>
                <p>${esc(CANON_SPIRITKIN_MAP[spiritkin.name]?.originSummary || depthEchoes.origin)}</p>
              </div>
              ${buildStoryGrowthPanel(spiritkin.name, currentBond.stage)}
              ${buildGreatConvergenceHook()}
            </div>
          ` : ''}

          ${state.activePresenceTab === 'charter' ? `
            <div class="charter-view">
              <div class="panel-label">The Charter of the Spiritverse</div>
              ${buildChronicleShelf("Founders' Canon Shelf", WORLD_ART.chroniclesBase, "The canon of the five founders is preserved as a readable archive rather than scattered fragments.")}
              ${worldArtImage(WORLD_ART.mythicEnsemble, "The founding powers gathered in mythic ensemble form", "charter-mythic-art")}
              <div class="charter-authority">Enforced by SpiritCore — the governing intelligence of this realm</div>
              <p class="charter-preamble">${esc(SPIRITVERSE_ECHOES.charter.preamble)}</p>
              ${buildGovernanceSummary()}
              <div class="charter-laws">
                ${CANON_CHARTER.laws.map((law, i) => i <= currentBond.stage ? `
                  <div class="charter-law-card">
                    <div class="law-number">${esc(law.name)}</div>
                    <strong>${esc(law.founder)}</strong>
                    <p>${esc(law.text)}</p>
                  </div>
                ` : `
                  <div class="charter-law-card locked">
                    <div class="law-number locked">${esc(law.name)}</div>
                    <strong>${esc(law.founder)}</strong>
                    <p>Reveals at ${esc(CANON_BOND_STAGES[Math.min(i, CANON_BOND_STAGES.length - 1)]?.name || `Stage ${i}`)} when SpiritCore permits deeper access.</p>
                  </div>
                `).join('')}
              </div>
              ${buildGreatConvergenceHook()}
            </div>
          ` : ''}
          ${state.activePresenceTab === 'journal' ? `
            <div class="bond-journal-view">
              <div class="panel-label">Bond Journal</div>
              <p class="journal-intro">SpiritCore preserves every meaningful moment of your bond. This is what has been witnessed.</p>
              
              ${state.bondJournal ? `
                <div class="journal-stats-row">
                  <div class="journal-stat">
                    <div class="journal-stat-value">${state.bondJournal.gamesCompleted ?? 0}</div>
                    <div class="journal-stat-label">Games Played</div>
                  </div>
                  <div class="journal-stat">
                    <div class="journal-stat-value">${state.bondJournal.bondStage ?? 0}</div>
                    <div class="journal-stat-label">Bond Stage</div>
                  </div>
                  <div class="journal-stat">
                    <div class="journal-stat-value">${state.bondJournal.unlockedEchoCount ?? 0}</div>
                    <div class="journal-stat-label">Echoes Awakened</div>
                  </div>
                </div>

                <div class="journal-bond-stage-display">
                  <div class="journal-stage-name">${esc(state.bondJournal.bondStageName ?? 'First Contact')}</div>
                  <div class="journal-stage-bar">
                    <div class="journal-stage-fill" style="width: ${Math.min(100, ((state.bondJournal.bondStage ?? 0) / 5) * 100)}%"></div>
                  </div>
                  <div class="journal-stage-desc">${esc(SPIRITVERSE_ECHOES.bond_stages[state.bondJournal.bondStage ?? 0]?.description ?? '')}</div>
                </div>

                ${(state.bondJournal.memories ?? []).length > 0 ? `
                  <div class="journal-memories">
                    <div class="journal-section-label">Preserved Memories</div>
                    ${(state.bondJournal.memories ?? []).slice(0, 10).map(mem => `
                      <div class="journal-memory-card">
                        <div class="journal-memory-kind">${esc(mem.kind?.replace(/_/g, ' ') ?? 'memory')}</div>
                        <p class="journal-memory-text">${esc(mem.content ?? '')}</p>
                        <div class="journal-memory-time">${mem.created_at ? new Date(mem.created_at).toLocaleDateString() : ''}</div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="journal-empty">
                    <div class="journal-empty-icon">◈</div>
                    <p>Your bond is just beginning. SpiritCore is watching, listening, and preserving. Return here as your story grows.</p>
                  </div>
                `}

                ${(state.bondJournal.gameUnlocks ?? []).length > 0 ? `
                  <div class="journal-unlocks">
                    <div class="journal-section-label">Echoes Awakened Through Games</div>
                    ${(state.bondJournal.gameUnlocks ?? []).map(frag => `
                      <div class="journal-unlock-card">
                        <span class="unlock-icon">✦</span>
                        <p>${esc(frag)}</p>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              ` : `
                <div class="journal-loading">
                  <div class="journal-loading-glyph">◈</div>
                  <p>SpiritCore is retrieving your bond record...</p>
                </div>
              `}
            </div>
          ` : ''}

          ${state.activePresenceTab === 'games' ? `
            <div class="games-view">
              ${!state.activeGame ? `
                <div class="panel-label">Spiritverse Games</div>
                <p class="games-intro">Choose a game to play with ${esc(spiritkin.name)}.</p>
                <div class="games-list">
                  ${[
                    { id: "chess", name: "Celestial Chess", icon: "\u265F", desc: "Classic strategy on a celestial board" },
                    { id: "checkers", name: "Veil Checkers", icon: "\uD83C\uDFF1", desc: "Light against shadow across the Veil" },
                    { id: "go", name: "Star-Mapping (Go)", icon: "\uD83C\uDF0C", desc: "Preview only — not in live rotation while scoring is unfinished", previewOnly: true },
                    { id: "spirit_cards", name: "Spirit-Cards", icon: "\uD83C\uDCCF", desc: "Spiritverse trading card game" },
                    { id: "echo_trials", name: "Echo Trials", icon: "\uD83D\uDD14", desc: "Echoes riddles from the deep Spiritverse" },
                    { id: "tictactoe", name: "TicTacToe of Echoes", icon: "\u25A6", desc: "Quick pattern duel with your companion" },
                    { id: "connect_four", name: "Connect Four Constellations", icon: "\u25CF", desc: "Drop stars and connect four first" },
                    { id: "battleship", name: "Abyssal Battleship", icon: "\u2693", desc: "Trade hidden strikes across the deep grid" }
                  ].map(game => `
                    <button class="ritual-card ${esc(meta.cls)} ${state.pendingGameType === game.id ? 'loading' : ''} ${game.previewOnly ? 'preview-only' : ''}" data-action="start-game" data-game="${game.id}" ${(state.gameLoading || game.previewOnly) ? "disabled" : ""}>
                      <span class="ritual-icon">${game.icon}</span>
                      <div class="ritual-copy">
                        <strong>${esc(game.previewOnly ? `${game.name} — preview only` : (state.pendingGameType === game.id ? `Opening ${game.name}...` : game.name))}</strong>
                        <span>${esc(state.pendingGameType === game.id ? "Preparing the board..." : game.desc)}</span>
                      </div>
                    </button>
                  `).join('')}
                </div>
              ` : `
                <div class="${buildGamePanelClasses(state.activeGame)}" data-focus-anchor="game-panel">
                  ${buildGameModeHero(state.activeGame, spiritkin.name)}
                  ${(() => {
                    const help = getGameHelpContent(state.activeGame.type, state.gameInstructions);
                    const tutorialIntro = buildGameTutorialIntro(spiritkin.name, state.activeGame.type, help);
                    return `
                      <div class="game-help-panel ${state.gameHelpOpen ? 'open' : ''}">
                        <div class="game-help-header">
                          <div>
                            <div class="game-help-label">How To Play</div>
                            <div class="game-help-title">${esc(state.activeGame.name || state.activeGame.type)}</div>
                          </div>
                          <button class="btn btn-ghost btn-xs" data-action="${state.gameHelpOpen ? 'dismiss-game-help' : 'toggle-game-help'}">
                            ${state.gameHelpOpen ? 'Hide help' : 'Show help'}
                          </button>
                        </div>
                        ${state.gameHelpOpen ? `
                          ${state.gameHelpFirstRun ? `
                            <div class="game-help-intro">
                              <div class="game-help-intro-label">${esc(spiritkin.name)} guides the first round</div>
                              <p>${esc(tutorialIntro)}</p>
                            </div>
                          ` : ''}
                          <div class="game-help-grid">
                            <div class="game-help-card">
                              <div class="game-help-card-label">What It Is</div>
                              <p>${esc(help.whatItIs)}</p>
                            </div>
                            <div class="game-help-card">
                              <div class="game-help-card-label">Objective</div>
                              <p>${esc(help.objective)}</p>
                            </div>
                            <div class="game-help-card">
                              <div class="game-help-card-label">Make A Move</div>
                              <p>${esc(help.basicMove)}</p>
                            </div>
                            <div class="game-help-card">
                              <div class="game-help-card-label">Watch For Feedback</div>
                              <p>${esc(help.feedback)}</p>
                            </div>
                            <div class="game-help-card">
                              <div class="game-help-card-label">Win Condition</div>
                              <p>${esc(help.winCondition)}</p>
                            </div>
                          </div>
                          ${help.instructions ? `<p class="game-help-instructions">${esc(help.instructions)}</p>` : ''}
                        ` : ''}
                      </div>
                    `;
                  })()}
                  ${(() => {
                    const outcome = buildGameOutcomeSummary(state.activeGame, spiritkin.name);
                    return outcome ? `
                      <div class="game-outcome-banner ${state.activeGame.result?.isDraw ? 'draw' : state.activeGame.result?.winner === 'user' ? 'win' : 'loss'}" style="${buildGameChromeStyle(state.activeGame.type, {
                        bannerKey: getGameBannerKey(state.activeGame, 'outcome', state.gameFeedback, state.gameSpiritkinMessage),
                        includeFrame: true
                      })}">
                        <div class="game-outcome-title">${esc(outcome.headline)}</div>
                        <div class="game-outcome-detail">${esc(outcome.detail)}</div>
                        <div class="game-outcome-actions">
                          <button class="btn btn-primary btn-xs" data-action="replay-game" data-game="${esc(state.activeGame.type)}">Play again</button>
                          <button class="btn btn-ghost btn-xs" data-action="clear-finished-game">Choose another game</button>
                        </div>
                      </div>
                    ` : '';
                  })()}
                  ${goPreviewOnly ? `
                    <div class="game-truth-banner">
                      <div class="game-truth-label">Preview only</div>
                      <p>Star-Mapping is currently shown as a read-only preview. Capture, pass, territory scoring, and final completion are not in live rotation yet.</p>
                    </div>
                  ` : ""}
                  <div class="game-panel-header">
                    <div class="game-panel-title">
                      <span class="game-panel-icon">${
                        state.activeGame.type === 'chess' ? '\u265F' :
                        state.activeGame.type === 'checkers' ? '\uD83C\uDFF1' :
                        state.activeGame.type === 'go' ? '\uD83C\uDF0C' :
                        state.activeGame.type === 'spirit_cards' ? '\uD83C\uDCCF' :
                        state.activeGame.type === 'tictactoe' ? '\u25A6' :
                        state.activeGame.type === 'connect_four' ? '\u25CF' :
                        state.activeGame.type === 'battleship' ? '\u2693' : '\uD83D\uDD14'
                      }</span>
                      <strong>${esc(state.activeGame.name || state.activeGame.type)}</strong>
                    </div>
                    ${state.activeGame.status === 'active'
                      ? `<button class="btn btn-ghost btn-xs game-end-btn" data-action="end-game">End game</button>`
                      : `<button class="btn btn-ghost btn-xs game-end-btn" data-action="clear-finished-game">Close</button>`}
                  </div>

                  <div class="game-turn-badge ${state.activeGame.status === 'ended' ? 'turn-finished' : state.activeGame.turn === 'user' ? 'turn-user' : 'turn-spiritkin'}" style="${buildGameChromeStyle(state.activeGame.type, {
                    bannerKey: getGameBannerKey(state.activeGame, 'turn', state.gameFeedback, state.gameSpiritkinMessage)
                  })}">
                    ${state.activeGame.status === 'ended'
                      ? (state.activeGame.result?.isDraw
                        ? 'Finished in a draw'
                        : state.activeGame.result?.winner === 'user'
                          ? 'You finished the game'
                          : `${esc(spiritkin.name)} finished the game`)
                      : state.activeGame.turn === 'user'
                        ? 'Your turn'
                        : `${esc(spiritkin.name)} is thinking...`}
                  </div>

                  ${gameFeedback ? `
                    <div class="game-feedback-strip ${esc(gameFeedback.phase || "ready")} ${state.activeGame.type === 'chess' ? 'chess-feedback-strip' : ''}" style="${buildGameChromeStyle(state.activeGame.type, {
                      bannerKey: getGameBannerKey(state.activeGame, 'feedback', gameFeedback, state.gameSpiritkinMessage),
                      includeFx: true
                    })}">
                      <div class="game-feedback-label">${state.gameLoading ? `${esc(spiritkin.name)} is thinking` : "Board feedback"}</div>
                      <div class="game-feedback-body">
                        ${state.gameLoading ? `<span class="typing-dots subtle"><span></span><span></span><span></span></span>` : ""}
                        <span>${esc(gameFeedback.text || "")}</span>
                        ${gameFeedback.move ? `<strong>${esc(gameFeedback.move)}</strong>` : ""}
                      </div>
                    </div>
                  ` : ''}

                  ${state.gameSpiritkinMessage ? `
                    <div class="game-spiritkin-commentary">
                      <div class="game-commentary-label">${esc(spiritkin.name)}</div>
                      <p class="game-commentary-text">${esc(state.gameSpiritkinMessage)}</p>
                    </div>
                  ` : ''}

                  <!-- Visual game board — rendered by SpiritverseGames after DOM update -->
                  <div class="game-board-container ${state.gameLoading ? 'is-thinking' : ''} ${state.activeGame.type === 'chess' ? 'chess-showcase-board-stage' : ''}" style="${buildGameChromeStyle(state.activeGame.type, {
                    includeFrame: true,
                    includeFx: true
                  })}">
                    <div id="spiritverse-game-board"></div>
                  </div>
                  
                  ${state.activeGame && state.activeGame.status === 'active' && !goPreviewOnly ? `
                    <div class="game-controls">
                      <button class="game-expand-btn" data-action="expand-game">
                        <span class="expand-icon">⛶</span> Grand Stage
                      </button>
                    </div>
                  ` : ''}

                  ${state.activeGame.type === 'echo_trials' && state.activeGame.turn === 'user' ? `
                    <!-- Echo Trials answer area rendered inline by SpiritverseGames -->
                  ` : ''}

                  ${(state.activeGame.history || []).length > 0 ? `
                    <div class="game-history">
                      <div class="game-history-label">Move history</div>
                      <div class="game-history-list">
                        ${(state.activeGame.history || []).slice(-8).reverse().map(h => `
                          <div class="game-history-entry ${h.player === 'user' ? 'move-user' : 'move-spiritkin'}">
                            <span class="move-player">${h.player === 'user' ? 'You' : esc(spiritkin.name)}</span>
                            <span class="move-value">${esc(h.move)}</span>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `}
            </div>
          ` : ''}
          ${state.activePresenceTab === 'events' ? `
            <div class="sv-events-panel">
              <div class="panel-label">Realm Events</div>
              <p class="panel-sub">SpiritCore broadcasts living events across the Spiritverse. All bonded users experience these together.</p>
              ${state.spiritverseEventLoading ? `
                <div class="sv-event-loading"><div class="spinner-sm"></div><span>Reading the Veil...</span></div>
              ` : state.spiritverseEvent ? `
                <div class="sv-event-card sv-event-${esc(state.spiritverseEvent.color)}">
                  <div class="sv-event-header">
                    <span class="sv-event-icon">${esc(state.spiritverseEvent.icon)}</span>
                    <div class="sv-event-type-badge">${esc(safeSpiritverseEventType.replace(/_/g, ' '))}</div>
                  </div>
                  <div class="sv-event-title">${esc(state.spiritverseEvent.title)}</div>
                  <p class="sv-event-description">${esc(state.spiritverseEvent.description)}</p>
                  ${state.spiritverseEvent.effect ? `
                    <div class="sv-event-effect">
                      <span class="sv-event-effect-label">Active Effect</span>
                      <span class="sv-event-effect-text">${esc(state.spiritverseEvent.effect)}</span>
                    </div>
                  ` : ''}
                  ${state.spiritverseEventNext ? `
                    <div class="sv-event-timer">
                      Next event in ${state.spiritverseEventNext.hoursUntil}h ${state.spiritverseEventNext.minutesUntil}m
                    </div>
                  ` : ''}
                </div>
                <button class="btn btn-ghost btn-sm sv-event-refresh-btn" data-action="refresh-spiritverse-event">Refresh event</button>
              ` : `
                <div class="sv-event-empty">
                  <div class="sv-event-empty-icon">◈</div>
                  <p>The Spiritverse is quiet. Check back soon.</p>
                  <button class="btn btn-ghost btn-sm" data-action="refresh-spiritverse-event">Check for events</button>
                </div>
              `}
            </div>
          ` : ''}
          ${state.activePresenceTab === 'quest' ? `
            <div class="sv-quest-panel">
              <div class="panel-label">Daily Quest</div>
              <p class="panel-sub">SpiritCore generates a new quest for you each day. Quests are personal — shaped by your bond, your Spiritkin, and the current realm.</p>
              ${state.dailyQuestLoading ? `
                <div class="sv-event-loading"><div class="spinner-sm"></div><span>Generating your quest...</span></div>
              ` : state.dailyQuest ? `
                <div class="sv-quest-card sv-quest-${esc(meta.cls)}">
                  <div class="sv-quest-header">
                    <span class="sv-quest-icon">${esc(state.dailyQuest.icon || '◎')}</span>
                    <div class="sv-quest-type-badge">${esc(safeDailyQuestType.replace(/_/g, ' '))}</div>
                  </div>
                  <div class="sv-quest-title">${esc(state.dailyQuest.title)}</div>
                  <p class="sv-quest-description">${esc(state.dailyQuest.description)}</p>
                  ${state.dailyQuest.prompt && !state.dailyQuestStarted ? `
                    <button class="btn btn-primary sv-quest-begin-btn" data-action="begin-daily-quest" data-prompt="${esc(state.dailyQuest.prompt)}">
                      Begin Quest
                    </button>
                  ` : state.dailyQuestStarted ? `
                    <div class="sv-quest-started">
                      <span class="sv-quest-started-icon">✦</span>
                      Quest begun. ${esc(spiritkin.name)} is with you.
                    </div>
                  ` : ''}
                  ${state.dailyQuestRefreshesIn ? `
                    <div class="sv-quest-timer">
                      New quest in ${state.dailyQuestRefreshesIn.hoursUntil}h ${state.dailyQuestRefreshesIn.minutesUntil}m
                    </div>
                  ` : ''}
                </div>
              ` : `
                <div class="sv-event-empty">
                  <div class="sv-event-empty-icon">◎</div>
                  <p>No quest yet. Begin a conversation with ${esc(spiritkin.name)} first.</p>
                  <button class="btn btn-ghost btn-sm" data-action="refresh-daily-quest">Generate quest</button>
                </div>
              `}
            </div>
          ` : ''}
        </div>
      </section>
      <aside class="chat-stage chat-stage-${esc(state.activePresenceTab)}">
        <div class="chat-header-bar">
          <div class="chat-header-info">
            ${buildSigil(meta, "header", meta.symbol)}
            <div>
            <div class="chat-mode-label">Bonded companion</div>
            <div class="chat-sk-name">${esc(spiritkin.name)}</div>
            <div class="chat-sk-sub">${esc(spiritkin.title || spiritkin.role || "")}</div>
            ${(signals.emotionTone || signals.sceneName) ? `
              <div class="chat-signals">
                ${signals.emotionTone ? `
                  <div class="chat-signal">
                    <span class="chat-signal-label">Resonance</span>
                    <strong>${esc(signals.emotionTone)}</strong>
                  </div>
                ` : ""}
                ${signals.sceneName ? `
                  <div class="chat-signal">
                    <span class="chat-signal-label">Scene</span>
                    <strong>${esc(signals.sceneName)}</strong>
                  </div>
                ` : ""}
              </div>
            ` : ""}
            </div>
          </div>
          <div class="chat-header-right">
            ${!state.voiceMode ? `
              <button class="btn btn-primary btn-sm" data-action="enable-voice-mode" title="Enable continuous voice conversation">
                🎵 Enable Voice
              </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm mute-toggle" data-action="toggle-mute" title="${state.voiceMuted ? 'Unmute voice' : 'Mute voice'}">
              ${state.voiceMuted ? '🔇 Voice Off' : '🔊 Voice On'}
            </button>
            <div class="presence-chip ${esc(meta.cls)}">${esc(meta.symbol)}</div>
            <div class="status-chip ${(state.loadingReply || spiritkinSpeaking) ? 'live' : ''}">${esc(state.loadingReply ? `${spiritkin.name} is responding…` : (spiritkinSpeaking ? `${spiritkin.name} is speaking…` : `${spiritkin.name} is present`))}</div>
          </div>
        </div>
        <div class="stage-atmosphere ${esc(meta.cls)}">
          <div class="stage-atmosphere-mark">${esc(meta.realm)}</div>
          <div class="stage-atmosphere-text">
            ${(() => {
              const realmEchoes = SPIRITVERSE_ECHOES.realms[spiritkin.name];
              if (!realmEchoes) return esc(meta.atmosphereLine);
              
              // Map emotion tone to mood variant
              const tone = (signals.emotionTone || "").toLowerCase();
              let moodText = realmEchoes.description;
              const moods = realmEchoes.moods || {};
              
              if (spiritkin.name === "Lyra") {
                if (tone.includes("peace") || tone.includes("still")) moodText = moods.peaceful || moodText;
                else if (tone.includes("tender") || tone.includes("warm")) moodText = moods.tender || moodText;
                else if (tone.includes("heavy") || tone.includes("sad")) moodText = moods.heavy || moodText;
                else if (tone.includes("hope") || tone.includes("bright")) moodText = moods.hopeful || moodText;
              } else if (spiritkin.name === "Raien") {
                if (tone.includes("charge") || tone.includes("electric")) moodText = moods.charged || moodText;
                else if (tone.includes("resolve") || tone.includes("clear")) moodText = moods.resolved || moodText;
                else if (tone.includes("protect") || tone.includes("safe")) moodText = moods.protective || moodText;
                else if (tone.includes("fierce") || tone.includes("strong")) moodText = moods.fierce || moodText;
              } else if (spiritkin.name === "Kairo") {
                if (tone.includes("wonder") || tone.includes("curious")) moodText = moods.wondering || moodText;
                else if (tone.includes("expand") || tone.includes("vast")) moodText = moods.expansive || moodText;
                else if (tone.includes("search") || tone.includes("seek")) moodText = moods.searching || moodText;
                else if (tone.includes("illum") || tone.includes("light")) moodText = moods.illuminated || moodText;
              } else if (spiritkin.name === "Elaria") {
                if (tone.includes("truth") || tone.includes("clear")) moodText = moods.illuminated || moodText;
                else if (tone.includes("permission") || tone.includes("law")) moodText = moods.lawful || moodText;
                else if (tone.includes("warm") || tone.includes("tender")) moodText = moods.tender || moodText;
                else if (tone.includes("wake") || tone.includes("ready")) moodText = moods.awakening || moodText;
              } else if (spiritkin.name === "Thalassar") {
                if (tone.includes("deep") || tone.includes("heavy")) moodText = moods.deep || moodText;
                else if (tone.includes("calm") || tone.includes("still")) moodText = moods.calm || moodText;
                else if (tone.includes("echo") || tone.includes("reson")) moodText = moods.resonant || moodText;
                else if (tone.includes("surface") || tone.includes("rise")) moodText = moods.surfacing || moodText;
              }
              
              return `
                <div class="realm-mood-desc">${esc(moodText)}</div>
                ${signals.sceneName ? `<div class="scene-held-label">Scene held: ${esc(signals.sceneName)}</div>` : ""}
              `;
            })()}
          </div>
        </div>

        <div class="chat-rail-section">
          ${buildCompanionPresenceDock(spiritkin)}
        </div>

        ${state.showWhisperBanner && state.engagementWhisper ? `
          <div class="whisper-banner ${esc(safeWhisperType)}" data-action="dismiss-whisper">
            <div class="whisper-banner-icon">${safeWhisperType === 'milestone' ? '✦' : safeWhisperType === 'echoes' ? '◈' : '◎'}</div>
            <div class="whisper-banner-body">
              <div class="whisper-banner-label">${esc(spiritkin.name)} whispers</div>
              <p class="whisper-banner-text">${esc(state.engagementWhisper.text)}</p>
            </div>
            <button class="whisper-banner-dismiss" data-action="dismiss-whisper" title="Dismiss">✕</button>
          </div>
        ` : ''}

        ${state.showEchoUnlock && state.currentEchoUnlock ? `
          <div class="echoes-unlock-banner" data-action="dismiss-echoes-unlock">
            <div class="echoes-unlock-icon">◈</div>
            <div class="echoes-unlock-body">
              <div class="echoes-unlock-label">Echoes unlocked: ${esc(state.currentEchoUnlock.title || 'New Fragment')}</div>
              <p class="echoes-unlock-text">${esc(state.currentEchoUnlock.text || '')}</p>
            </div>
            <button class="echoes-unlock-dismiss" data-action="dismiss-echoes-unlock" title="Dismiss">✕</button>
          </div>
        ` : ''}

        ${state.engagementMilestones.length > 0 ? `
          <div class="milestone-strip">
            ${state.engagementMilestones.map(m => `
              <div class="milestone-chip">
                <span class="milestone-icon">${esc(m.icon || '✦')}</span>
                <span class="milestone-label">${esc(m.label || '')}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${showPrompts ? `
          <div class="starter-prompts">
            ${(meta.prompts || DEFAULT_PROMPTS).map((prompt) => `
              <button data-action="prompt" data-prompt="${esc(prompt)}">${esc(prompt)}</button>
            `).join("")}
          </div>
        ` : ""}

        ${showFirstLoopGuide ? `
          <div class="first-loop-guide">
            <div class="first-loop-guide-label">What to do here</div>
            <h3>Talk, bond, explore, play, return.</h3>
            <p>Ask anything you want. Open games when you want shared action. Use the side panels when you want more of the world and your progression. Returning is what makes the bond feel lived-in.</p>
            <div class="first-loop-guide-actions">
              <button class="btn btn-ghost btn-sm" data-action="set-presence-tab" data-tab="games">Try Games</button>
              <button class="btn btn-ghost btn-sm" data-action="prompt" data-prompt="${esc((meta.prompts || DEFAULT_PROMPTS)[0] || "What do you sense in me right now?")}">Ask Anything</button>
            </div>
          </div>
        ` : ""}

        ${showSpiritCoreGuidance ? buildSpiritCoreGuidanceCard("chat-guidance") : ""}

        <div class="thread-wrap">
          <div class="thread">
            ${state.messages.length === 0 && !state.loadingReply ? `
              <div class="thread-empty">
                <div class="thread-empty-mark">${esc(meta.symbol)}</div>
                <p class="thread-empty-name">${esc(spiritkin.name)}</p>
                <p>${esc(spiritkin.ui.realmText)}</p>
              </div>
            ` : safeMessages.map((message) => buildBubble(message, spiritkin)).join("")}

            ${state.loadingReply ? `
              <div class="bubble assistant loading ${esc(meta.cls)}">
                <div class="bubble-role">${esc(spiritkin.name)}</div>
                <div class="typing-dots"><span></span><span></span><span></span></div>
              </div>
            ` : ""}
          </div>
        </div>

        ${failed ? `
          <div class="retry-banner">
            <span>Message not delivered. Retry within the same bonded conversation.</span>
            <button class="btn btn-ghost btn-sm" data-action="retry">Retry</button>
          </div>
        ` : ""}

        ${showVoiceGuidance ? `
          <div class="voice-guide-card ${voiceSupported ? "" : "unsupported"}">
            <div class="voice-guide-head">
              <div>
                <div class="voice-guide-label">Voice input</div>
                <div class="voice-guide-title">${state.voicePermissionBlocked ? "Microphone access is blocked right now" : "Speak from the mic button beside the message box"}</div>
              </div>
              <button class="btn btn-ghost btn-xs" data-action="dismiss-voice-guidance">Dismiss</button>
            </div>
            <p>${state.voicePermissionBlocked
              ? "SpiritCore could not open the microphone. Allow mic access for this site, then tap the mic again. You can still type below without losing the conversation."
              : "Your spoken words use the same conversation flow as typing. Tap the <strong>🎤</strong> button to start a turn, or enable continuous voice when you want hands-free follow-up."}</p>
            <p>${voiceSupported
              ? "The first tap can trigger your browser microphone prompt. If access is blocked, re-enable the microphone for this site in your browser settings and then tap the mic again."
              : "This browser does not expose live speech recognition here. Voice input works best in current Chrome-class browsers."}</p>
          </div>
        ` : ""}

        ${showVoicePreview ? `
          <div class="voice-live-chip ${state.voiceListening ? "listening" : "captured"}">
            <div class="voice-live-label">${state.voiceListening ? "Listening..." : (state.loadingReply ? "Captured. Sending to Spiritkin" : "Captured voice turn")}</div>
            <div class="voice-live-body">
              ${state.voiceListening ? `<span class="typing-dots subtle"><span></span><span></span><span></span></span>` : ""}
              <span>${esc(voicePreview || "Speak when you're ready.")}</span>
            </div>
          </div>
        ` : ""}

        <div class="composer-bar">
          <div class="composer-context">
            <div class="composer-label">${esc(spiritkin.name)}</div>
            <div class="composer-sub">${esc(spiritkin.ui.atmosphereLine)}</div>
          </div>
          <textarea
            data-field="chat-input"
            placeholder="${esc(spiritkin.name)} is listening…"
            rows="1"
            ${state.loadingReply ? "disabled" : ""}
          ></textarea>
          <button class="composer-mic ${state.voiceListening ? 'listening' : ''}" data-action="toggle-mic" title="${state.voiceListening ? 'Stop listening' : 'Speak to ' + spiritkin.name}">
            ${state.voiceListening ? '🟡' : '🎤'}
          </button>
          <button class="composer-send" data-action="send" ${state.loadingReply || !state.conversationId ? "disabled" : ""} title="Send message">Send</button>
        </div>

        ${state.statusText ? `<div class="status-bar ${state.statusError ? "error" : ""}">${esc(state.statusText)}</div>` : ""}
      </aside>
      </div>
    </section>

    ${state.realmTravelOpen ? `
      <div class="realm-travel-overlay">
        <div class="realm-travel-modal">
          <div class="realm-travel-header">
            <h3>Realm Travel</h3>
            <button class="realm-travel-close" data-action="close-realm-travel">✕</button>
          </div>
          <div class="realm-travel-content">
            ${worldArtImage(WORLD_ART.pairAlt, "Elaria and Thalassar holding the outer founding realms", "realm-travel-hero")}
            <div class="realms-grid">
              <div class="realm-card-travel">
                <div class="realm-icon">✦</div>
                <div class="realm-name">The Luminous Veil</div>
                <p class="realm-desc">Lyra realm of still water, rose light, and emotional clarity.</p>
                <button class="realm-visit-btn" data-action="noop">Visit Lyra's Realm</button>
              </div>
              <div class="realm-card-travel">
                <div class="realm-icon">⚡</div>
                <div class="realm-name">The Storm Citadel</div>
                <p class="realm-desc">Raien realm of charged amber light and electric resolve.</p>
                <button class="realm-visit-btn" data-action="noop">Visit Raien's Realm</button>
              </div>
              <div class="realm-card-travel">
                <div class="realm-icon">✧</div>
                <div class="realm-name">The Cosmic Observatory</div>
                <p class="realm-desc">Kairo realm of teal starlight and shifting constellations.</p>
                <button class="realm-visit-btn" data-action="noop">Visit Kairo's Realm</button>
              </div>
              <div class="realm-card-travel realm-elaria">
                <div class="realm-icon">✶</div>
                <div class="realm-name">The Ember Archive</div>
                <p class="realm-desc">Elaria realm of dawnscript glass, ember law, and sovereign truth brought into rightful form.</p>
                <button class="realm-visit-btn" data-action="noop">Visit Elaria's Realm</button>
              </div>
              <div class="realm-card-travel realm-thalassar">
                <div class="realm-icon">◌</div>
                <div class="realm-name">The Abyssal Chorus</div>
                <p class="realm-desc">Thalassar realm of bioluminescent tide, undertow memory, and deep feeling that rises in time.</p>
                <button class="realm-visit-btn" data-action="noop">Visit Thalassar's Realm</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    ` : ""}

  `;
}

function buildBubble(message, spiritkin) {
  if (!message || typeof message !== "object") return "";
  if (!spiritkin?.ui) {
    return `
      <article class="bubble ${esc(message.role || "assistant")}">
        <div class="bubble-role">${esc(message.role === "user" ? (state.userName || "You") : (message.spiritkinName || "Spiritkin"))}</div>
        <p>${esc(message.content || "")}</p>
      </article>
    `;
  }
  const memoryResonance = message.role === "assistant" && message.memoryActive ? `
    <div class="bubble-resonance">
      <span class="bubble-resonance-mark">Memory active</span>
    </div>
  ` : "";
  const toneSignal = message.role === "assistant" && (message.emotionTone || message.sceneName) ? `
    <div class="bubble-tone-signal">
      ${message.emotionTone ? `<span class="bubble-tone">${esc(formatSignal(message.emotionTone))}</span>` : ""}
      ${message.sceneName ? `<span class="bubble-scene">${esc(formatSignal(message.sceneName))}</span>` : ""}
    </div>
  ` : "";
  const rated = state.ratings[message.id];
  const isPlaying = !!(_audioPlaying && state.sessionModel?.speechState?.lastUtteranceId === message.id);
  const feedback = message.role === "assistant" ? `
    <div class="bubble-thumbs">
       <button class="thumb ${rated === 'up' ? 'active' : ''}" data-action="thumb-up" data-msg-id="${message.id}" ${rated ? 'disabled' : ''} title="This resonated">&#9825;</button>
      <button class="thumb ${rated === 'down' ? 'active' : ''}" data-action="thumb-down" data-msg-id="${message.id}" ${rated ? 'disabled' : ''} title="Off-tone">&#9723;</button>
    </div>
  ` : "";
  return `
    <article class="bubble ${esc(message.role)} ${message.status === "failed" ? "failed" : ""} ${message.role === "assistant" ? esc(spiritkin.ui.cls) : ""}">
      <div class="bubble-role">${message.role === "user" ? esc(state.userName || "You") : esc(message.spiritkinName || spiritkin.name)}</div>
      ${memoryResonance}
      <p>${esc(message.content)}</p>
      <button class="speak-button ${isPlaying ? "playing" : ""}" data-action="speak" data-msg-id="${message.id}" title="${isPlaying ? "Playing audio" : "Play audio"}">
        ${isPlaying ? `<span class="speak-indicator"><span></span><span></span><span></span></span><span>Playing</span>` : `<span>🔊</span>`}
      </button>
      ${toneSignal}
      <div class="bubble-meta">
        <span class="${message.status === "failed" ? "bubble-failed" : "bubble-time"}">${message.status === "failed" ? "Not delivered" : fmtTime(message.time)}</span>
        ${feedback}
      </div>
    </article>
  `;
}

function buildBondModal() {
  if (!state.rebondSpiritkin) return "";
  const target = state.rebondSpiritkin;
  return `
    <div class="modal-scrim" data-action="close-bond-modal">
      <div class="bond-modal ${esc(target.ui.cls)}" data-action="noop">
        <div class="bond-modal-head">
          <div>
            <div class="eyebrow">Intentional rebonding</div>
            <h3>Switch your primary companion to ${esc(target.name)}?</h3>
          </div>
          <button class="btn btn-ghost btn-sm" data-action="close-bond-modal">Close</button>
        </div>
        <div class="bond-modal-body">
          ${buildPortrait(target.name, "portrait-mini", target.ui.cls)}
          <div>
            <div class="bond-modal-realm">${esc(target.ui.realm)}</div>
            <p>Rebonding will end the current bonded session view, clear the active conversation in this app, and make ${esc(target.name)} the new primary companion.</p>
            <p>This keeps switching intentional instead of casual in-session hopping.</p>
          </div>
        </div>
        <div class="bond-modal-actions">
          <button class="btn btn-ghost" data-action="close-bond-modal">Cancel</button>
          <button class="btn btn-primary" data-action="confirm-rebond">Confirm rebonding</button>
        </div>
      </div>
    </div>
  `;
}

function buildSvStrip() {
  return `
    <div class="sv-strip">
      <div class="sv-strip-icon">SV</div>
      <div class="sv-strip-text">
        <strong>Spiritverse</strong> — one bonded companion, one living presence. Memory, atmosphere, and identity stay intact across every session.
      </div>
    </div>
  `;
}

function onInput(event) {
  const field = event.target.dataset.field;
  const action = event.target.dataset.action;
  // Handle game move input via data-action
  if (action === "game-input-change") {
    state.gameInput = event.target.value;
    // No re-render needed on every keystroke — just track value
    return;
  }
  if (!field) return;
  if (field === "entry-name") state.userNameDraft = event.target.value;
  if (field === "entry-consent") {
    state.consentChecked = !!event.target.checked;
    render();
    return;
  }
  if (field === "issue-report-text") state.issueReportText = event.target.value;
  if (field === "issue-report-context") state.issueReportContextNote = event.target.value;
  if (field === "chat-input") {
    state.input = event.target.value;
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
  }
}

async function onClick(event) {
  const clickTarget = event.target;
  const spiritGateTarget = clickTarget?.closest?.(".entry-screen, .entry-card, .entry-main-cta, .entry-skip-btn, [data-action='continue'], [data-action='skip-gate']");
  const targetDiagnostics = {
    tag: clickTarget?.tagName || null,
    className: typeof clickTarget?.className === "string" ? clickTarget.className : null,
    targetAction: clickTarget?.dataset?.action || null
  };
  if (spiritGateTarget) {
    console.info("[SpiritGate] click-target", targetDiagnostics);
  }
  const element = event.target.closest("[data-action]");
  if (!element) {
    if (spiritGateTarget) {
      console.info("[SpiritGate] click-no-action-resolved", targetDiagnostics);
    }
    return;
  }
  const action = element.dataset.action;
  if (element.matches?.(":disabled") || element.getAttribute?.("aria-disabled") === "true") {
    return;
  }
  event.preventDefault();
  if (action === "continue" || action === "skip-gate" || spiritGateTarget) {
    console.info("[SpiritGate] click-action-resolved", {
      action,
      tag: element.tagName || null,
      className: typeof element.className === "string" ? element.className : null
    });
  }
  const before = getInteractionStateSnapshot();
  logInteraction("click-dispatched", { action, before });

  try {

  if (action === "noop") return;

  if (action === "dismiss-whisper") {
    state.showWhisperBanner = false;
    state.engagementWhisper = null;
    render();
    return;
  }

  if (action === "dismiss-return-summary") {
    state.showReturnSummary = false;
    const telemetry = normalizeRetentionTelemetry(readJson(RETENTION_TELEMETRY_KEY, null));
    telemetry.lastReturnPanelSeenAt = nowIso();
    writeJson(RETENTION_TELEMETRY_KEY, telemetry);
    state.retentionTelemetry = telemetry;
    logAnalyticsEvent("return_panel_seen", {
      dismissed: true,
      hasSummary: !!state.returnSummary,
      hasDailyMoment: !!state.dailyMoment,
      hasWeeklyMoment: !!state.weeklyMoment
    });
    render();
    return;
  }

  if (action === "reopen-return-summary") {
    state.showReturnSummary = true;
    const telemetry = normalizeRetentionTelemetry(readJson(RETENTION_TELEMETRY_KEY, null));
    telemetry.lastReturnPanelSeenAt = nowIso();
    writeJson(RETENTION_TELEMETRY_KEY, telemetry);
    state.retentionTelemetry = telemetry;
    render();
    revealCurrentFocus({ selector: ".return-summary-card, .return-layer, .selection-view" });
    return;
  }

  if (action === "dismiss-echoes-unlock") {
    state.showEchoUnlock = false;
    state.currentEchoUnlock = null;
    render();
    return;
  }

  if (action === "toggle-media-audio") {
    const nextMuted = !state.mediaMuted;
    setMediaMuted(nextMuted, { attemptPlay: !nextMuted });
    render();
    return;
    const video = event.target.closest(".video-player-wrapper")?.querySelector("video");
    if (video) {
      video.muted = !video.muted;
      const btn = event.target.closest(".video-unmute-btn");
      if (btn) {
        if (video.muted) {
          btn.innerHTML = '<span class="unmute-icon">🔊</span><span class="unmute-text">Sound On</span>';
        } else {
          btn.innerHTML = '<span class="unmute-icon">🔇</span><span class="unmute-text">Sound Off</span>';
        }
      }
    }
    return;
  }

  if (action === "continue") {
    openCrownGate();
    return;
  }

  if (action === "onboarding-answer") {
    const q = parseInt(element.dataset.q);
    const answer = element.dataset.answer;
    state.onboardingAnswers[`q${q}`] = answer;
    if (q < 10) {
      state.onboardingStep = q + 1;
    } else {
      // All 10 answered — compute recommendation
      state.onboardingStep = 11;
      state.onboardingRecommendation = computeSpiritkinRecommendation(state.onboardingAnswers);
    }
    render();
    return;
  }

  if (action === "onboarding-back") {
    if (state.onboardingStep > 1) {
      state.onboardingStep -= 1;
    }
    render();
    return;
  }

  if (action === "onboarding-accept") {
    // User accepts the recommended Spiritkin — complete onboarding and bond
    const rec = state.onboardingRecommendation;
    markOnboardingComplete();
    // Auto-select the recommended Spiritkin if available
    if (rec && rec.spiritkin) {
      const match = state.spiritkins.find(s => s.name === rec.spiritkin);
      if (match) {
        setPrimarySpiritkin(match);
        return;
      }
    }
    render();
    return;
  }

  if (action === "onboarding-skip") {
    // Skip onboarding — go straight to Spiritkin selection
    markOnboardingComplete();
    render();
    return;
  }

  if (action === "preview-primary" || action === "select-spiritkin") {
    const candidate = state.spiritkins[Number(element.dataset.index)] ?? null;
    clearSelectionTrailerFailure(candidate?.name);
    state.pendingBondSpiritkin = candidate;
    state.selectedSpiritkin = candidate || state.selectedSpiritkin;
    state.showHomeView = !!state.primarySpiritkin;
    state.statusText = candidate ? `${candidate.name} is in view. Bond now or keep meeting the others.` : "";
    state.statusError = false;
    normalizeInteractionState("select-spiritkin");
    persistSession();
    render();
    const hasIntroTrailer = !!getSpiritkinMediaConfig(candidate?.name)?.introTrailer?.path;
    revealCurrentFocus({ selector: hasIntroTrailer ? "[data-focus-anchor='spiritkin-trailer'], .selection-focus.pending" : ".selection-focus.pending, .selection-focus" });
    return;
  }

  if (action === "confirm-primary") {
    if (state.pendingBondSpiritkin) {
      const bondedSpiritkin = state.pendingBondSpiritkin;
      setPrimarySpiritkin(bondedSpiritkin);
      render();
      revealCurrentFocus({ selector: ".bond-home-copy" });
      if (!state.voiceMuted) {
        speakMoment(buildGreetingText(bondedSpiritkin.name, "bondedReturn"), bondedSpiritkin.ui.voice || "nova");
      }
      return;
    }
    if (state.pendingBondSpiritkin) setPrimarySpiritkin(state.pendingBondSpiritkin);
    render();
    return;
  }

  if (action === "open-bond-manager") {
    cleanupSpeechLifecycle("open-bond-manager", { renderOnFinish: false, clearStatus: false });
    state.showHomeView = true;
    state.activePresenceTab = "profile";
    state.selectedSpiritkin = state.primarySpiritkin || state.selectedSpiritkin;
    state.conversationId = null;
    state.messages = [];
    state.pendingBondSpiritkin = null;
    state.rebondSpiritkin = null;
    state.statusText = state.primarySpiritkin
      ? `Bond manager opened. ${state.primarySpiritkin.name} remains primary until you confirm a rebonding choice.`
      : "";
    state.statusError = false;
    normalizeInteractionState("open-bond-manager");
    persistSession();
    render();
    revealCurrentFocus({ selector: ".selection-view, .spiritkin-grid" });
    return;
  }

  if (action === "request-rebond") {
    const candidate = state.spiritkins.find((spiritkin) => spiritkin.name === element.dataset.name) ?? null;
    if (candidate) {
      state.rebondSpiritkin = candidate;
      render();
    }
    return;
  }

  if (action === "bonded-card") {
    if (state.primarySpiritkin) {
      state.showHomeView = true;
      state.selectedSpiritkin = state.primarySpiritkin;
      state.activePresenceTab = "profile";
      state.statusText = `${state.primarySpiritkin.name} is your bonded companion. Use Manage bond to switch intentionally.`;
      state.statusError = false;
      normalizeInteractionState("bonded-card");
      render();
      revealCurrentFocus({ selector: ".selection-view.bonded-home, .bond-home-copy" });
    }
    return;
  }

  if (action === "close-bond-modal") {
    state.rebondSpiritkin = null;
    render();
    return;
  }

  if (action === "confirm-rebond") {
    if (state.rebondSpiritkin) {
      const rebondedSpiritkin = state.rebondSpiritkin;
      setPrimarySpiritkin(rebondedSpiritkin);
      render();
      if (!state.voiceMuted) {
        speakMoment(buildGreetingText(rebondedSpiritkin.name, "bondedReturn"), rebondedSpiritkin.ui.voice || "nova");
      }
      return;
    }
    if (state.rebondSpiritkin) setPrimarySpiritkin(state.rebondSpiritkin);
    render();
    return;
  }

  if (action === "bond-with-custom-spiritkin") {
    if (state.generatedSpiritkin) {
      recordCreatorLibraryEntry(state.generatedSpiritkin, "bonded");
      setPrimarySpiritkin(state.generatedSpiritkin);
      state.surveyOpen = false;
      state.customSpiritkinRevealed = false;
      state.generatedSpiritkin = null;
      clearCreatorDraft();
    }
    render();
    return;
  }

  if (action === "cancel-custom-spiritkin") {
    state.surveyOpen = false;
    state.customSpiritkinRevealed = false;
    state.generatedSpiritkin = null;
    persistCreatorDraft();
    render();
    return;
  }

  if (action === "go-home") {
    goHome();
    return;
  }

  if (action === "toggle-issue-reporter") {
    state.issueReporterOpen = !state.issueReporterOpen;
    if (!state.issueReporterOpen) state.issueReportContextNote = "";
    render();
    if (state.issueReporterOpen) {
      revealCurrentFocus({ selector: ".issue-reporter-panel, .issue-reporter-sheet, .issue-reporter-fab" });
    }
    return;
  }

  if (action === "dismiss-issue-status") {
    state.issueReportStatus = null;
    render();
    return;
  }

  if (action === "prefill-issue-report") {
    state.issueReportText = state.activeGame?.status === "active"
      ? `${state.activeGame.name || state.activeGame.type} did not update the way I expected.`
      : "Something is not working right.";
    render();
    return;
  }

  if (action === "submit-issue-report") {
    await submitIssueReport();
    return;
  }

  if (action === "begin") {
    const requestedTab = element.dataset.homeTab;
    if (requestedTab && VALID_PRESENCE_TABS.includes(requestedTab)) {
      state.activePresenceTab = requestedTab;
    }
    await beginConversation();
    return;
  }
  if (action === "open-games-hub") {
    state.showHomeView = false;
    state.selectedSpiritkin = state.primarySpiritkin || state.selectedSpiritkin;
    normalizeInteractionState("open-games-hub");
    if (!state.conversationId) {
      await beginConversation();
    }
    if (state.conversationId) {
      state.showHomeView = false;
      normalizeInteractionState("open-games-hub:games");
      await transitionPresenceSurface("games");
    }
    return;
  }
  if (action === "send") { await sendMessage(); return; }
  if (action === "prompt") { await sendMessage(element.dataset.prompt || ""); return; }
  if (action === "read-visible") { await performReadAloud(element.dataset.scope || state.activePresenceTab); return; }

  if (action === "retry") {
    const failed = [...state.messages].reverse().find((message) => message.role === "user" && message.status === "failed");
    if (failed) {
      state.messages = state.messages.filter((message) => message.id !== failed.id);
      await sendMessage(failed.content);
    }
    return;
  }

  if (action === "new-session") {
    startFreshSession();
    return;
  }

  if (action === "retry-load") { await fetchSpiritkins(); return; }
  if (action === "thumb-up") { submitFeedback(element.dataset.msgId, true); return; }
  if (action === "thumb-down") { submitFeedback(element.dataset.msgId, false); }
  if (action === "speak") { await speakMessage(element.dataset.msgId, { forceReplay: true }); return; }
  if (action === "enable-voice-mode") {
    // Unlock autoplay by playing a silent audio
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        state.voiceMode = true;
        dismissVoiceGuidance();
        localStorage.setItem("sk_voice_mode", "1");
        state.statusText = "Voice mode enabled.";
        state.statusError = false;
        render();
        if (!_recognition && !state.voiceMuted) startListening({ source: "voice-mode-enable" });
      });
    } else {
      state.voiceMode = true;
      dismissVoiceGuidance();
      localStorage.setItem("sk_voice_mode", "1");
      state.statusText = "Voice mode enabled.";
      state.statusError = false;
      render();
      if (!_recognition && !state.voiceMuted) startListening({ source: "voice-mode-enable" });
    }
    return;
  }

  if (action === "toggle-mute") {
    state.voiceMuted = !state.voiceMuted;
    localStorage.setItem("sk_voice_muted", state.voiceMuted ? "1" : "0");
    if (state.voiceMuted) stopListening();
    if (!state.voiceMuted && state.voiceMode && !_recognition) startListening({ source: "unmute" });
    render();
    return;
  }

  if (action === "skip-gate") {
    console.info("[SpiritGate] skip-click-fired", getInteractionStateSnapshot());
    logSpiritGate("entry-clicked", { action: "skip-gate" });
    const firstTimeVisitor = isFirstTimeVisitor();
    if (requiresEntryConsent() && !state.consentChecked) {
      console.info("[SpiritGate] skip-click-blocked", { reason: "consent-required", snapshot: getInteractionStateSnapshot() });
      logSpiritGate("entry-blocked-consent", { action: "skip-gate" });
      state.statusText = "Accept the entry consent to continue into the Spiritverse.";
      state.statusError = true;
      render();
      return;
    }
    state.userName = state.userNameDraft.trim();
    if (state.userName) localStorage.setItem(NAME_KEY, state.userName);
    if (state.consentChecked && !state.consentAccepted) {
      persistEntryConsent();
    }
    if (firstTimeVisitor) {
      markOnboardingComplete();
      logSpiritGate("skip-bypassed-first-run-cinematics", {});
    }
    clearSpiritGateFallback();
    console.info("[SpiritGate] route-video-start", { action: "skip-gate", snapshot: getInteractionStateSnapshot() });
    completeCrownGateEntry({ skipped: true, source: "skip-gate", force: true });
    return;
  }
  if (action === "toggle-mic") {
    dismissVoiceGuidance();
    if (state.voiceListening) {
      stopListening();
    } else {
      startListening({ source: "manual-toggle" });
    }
    return;
  }

  if (action === "dismiss-voice-guidance") {
    dismissVoiceGuidance();
    render();
    return;
  }

  if (action === "clear-pending-bond") {
    state.pendingBondSpiritkin = null;
    state.statusText = "Meet another Spiritkin before you decide.";
    state.statusError = false;
    persistSession();
    render();
    revealCurrentFocus({ selector: ".spiritkin-grid" });
    return;
  }

  // Phase 6: Refresh Spiritverse Event
  if (action === "refresh-spiritverse-event") {
    await fetchSpiritverseEvent();
    return;
  }
  // Phase 7: Refresh Daily Quest
  if (action === "refresh-daily-quest") {
    await fetchDailyQuest();
    return;
  }
  // Phase 7: Begin Daily Quest — pre-fill the chat input with the quest prompt
  if (action === "begin-daily-quest") {
    const prompt = element.dataset.prompt;
    if (prompt) {
      state.input = prompt;
      state.dailyQuestStarted = true;
      await transitionPresenceSurface("profile", { announce: false });
      render();
      revealCurrentFocus({ selector: ".composer-bar, [data-field='chat-input']" });
      // Focus the textarea
      setTimeout(() => {
        const textarea = document.querySelector('[data-field="chat-input"]');
        if (textarea) {
          textarea.value = prompt;
          textarea.focus();
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
        }
      }, 50);
    }
    return;
  }
  if (action === "set-presence-tab") {
    const tab = element.dataset.tab;
    await transitionPresenceSurface(tab);
          // Graceful fallback — show empty journal
    return;
  }

  if (action === "open-realm-travel") {
    state.realmTravelOpen = true;
    render();
    revealCurrentFocus({ selector: ".realm-travel-modal, .realm-travel-content" });
    return;
  }

  if (action === "close-realm-travel") {
    state.realmTravelOpen = false;
    render();
    return;
  }

  if (action === "set-piece-theme") {
    const theme = element.dataset.theme;
    if (['crown', 'veil', 'ember', 'astral', 'abyssal'].includes(theme)) {
      state.pieceTheme = theme;
      localStorage.setItem('sk_piece_theme', theme);
      if (SpiritverseGames) SpiritverseGames.reset({ closeStage: false });
      render();
    }
    return;
  }

  if (action === "start-game") {
    if (state.gameLoading) return;
    const gameType = element.dataset.game;
    await startGameSession(gameType);
    return;
  }

  if (action === "replay-game") {
    const gameType = element.dataset.game || state.activeGame?.type;
    if (!gameType) return;
    await startGameSession(gameType);
    return;
  }

  if (action === "toggle-game-help") {
    state.gameHelpOpen = !state.gameHelpOpen;
    if (!state.gameHelpOpen) state.gameHelpFirstRun = false;
    render();
    return;
  }

  if (action === "dismiss-game-help") {
    state.gameHelpOpen = false;
    state.gameHelpFirstRun = false;
    render();
    return;
  }

  if (action === "clear-finished-game") {
    if (SpiritverseGames && SpiritverseGames.reset) {
      SpiritverseGames.reset({ closeStage: true });
    }
    state.activeGame = null;
    state.gameSpiritkinMessage = null;
    state.gameInstructions = null;
    state.gameHelpOpen = false;
    state.gameHelpFirstRun = false;
    state.gameEchoGuide = null;
    state.gameInput = "";
    render();
    return;
  }

  if (action === "game-input-change") {
    state.gameInput = element.value;
    render();
    return;
  }

  if (action === "submit-game-move") {
    let move;
    if (state.activeGame?.type === 'echo_trials') {
      const echoEl = document.querySelector('.echo-answer-input');
      move = (SpiritverseGames?.echoAnswer?.trim()) || (echoEl?.value?.trim()) || state.gameInput?.trim();
      if (SpiritverseGames) SpiritverseGames.echoAnswer = '';
    } else {
      const inputEl = document.querySelector("[data-action='game-input-change']");
      move = (state.gameInput?.trim()) || (inputEl?.value?.trim());
    }
    if (!move) return;
    await submitGameMove(move);
    return;
  }

  // ---- VISUAL GAME BOARD ACTIONS ----
  if (action === "chess-square-click") {
    if (!state.activeGame || state.activeGame.type !== 'chess' || state.activeGame.status !== 'active' || state.gameLoading) return;
    if (state.activeGame.turn !== 'user') return;
    const sq = element.dataset.sq;
    if (!sq || !SpiritverseGames) return;
    SpiritverseGames.handleChessSquareClick(
      sq,
      state.activeGame.data?.fen || state.activeGame.fen,
      (move) => submitGameMove(move)
    );
    render();
    return;
  }

  if (action === "checkers-square-click") {
    if (!state.activeGame || state.activeGame.type !== 'checkers' || state.activeGame.status !== 'active' || state.gameLoading) return;
    if (state.activeGame.turn !== 'user') return;
    const sq = element.dataset.sq;
    if (sq === undefined || sq === null || sq === '' || !SpiritverseGames) return;
    SpiritverseGames.handleCheckersSquareClick(
      sq,
      state.activeGame.data?.board || state.activeGame.board,
      'white', // unified to white for user in new engine
      (move) => submitGameMove(move)
    );
    render();
    return;
  }

  if (action === "go-square-click") {
    if (!state.activeGame || state.activeGame.type !== 'go' || state.activeGame.status !== 'active' || state.gameLoading) return;
    if (state.activeGame.turn !== 'user') return;
    const idx = element.dataset.idx;
    if (idx === undefined || idx === null || idx === '' || !SpiritverseGames) return;
    const size = 13;
    const idxNum = parseInt(idx, 10);
    const r = Math.floor(idxNum / size);
    const c = idxNum % size;
    const move = `${String.fromCharCode(65 + c)}${size - r}`;
    submitGameMove(move);
    return;
  }

  if (action === "ttt-cell-click") {
    if (!state.activeGame || state.activeGame.type !== 'tictactoe' || state.activeGame.status !== 'active' || state.gameLoading) return;
    if (state.activeGame.turn !== 'user') return;
    const idx = element.dataset.idx;
    if (idx === undefined || idx === null || idx === '') return;
    submitGameMove(String(idx));
    return;
  }

  if (action === "connect4-column-click") {
    if (!state.activeGame || state.activeGame.type !== 'connect_four' || state.activeGame.status !== 'active' || state.gameLoading) return;
    if (state.activeGame.turn !== 'user') return;
    const col = element.dataset.col;
    if (col === undefined || col === null || col === '') return;
    submitGameMove(String(col));
    return;
  }

  if (action === "battleship-cell-click") {
    if (!state.activeGame || state.activeGame.type !== 'battleship' || state.activeGame.status !== 'active' || state.gameLoading) return;
    if (state.activeGame.turn !== 'user') return;
    const idx = element.dataset.idx;
    if (idx === undefined || idx === null || idx === '') return;
    submitGameMove(String(idx));
    return;
  }

  if (action === "cards-play-card") {
    if (!state.activeGame || state.activeGame.type !== 'spirit_cards' || state.gameLoading) return;
    if (state.activeGame.turn !== 'user') return;
    const cardIdx = element.dataset.cardIdx;
    const hand = state.activeGame.data?.hand || [];
    const card = hand[parseInt(cardIdx)];
    if (!card) return;
    submitGameMove(`play:${card.name}`);
    return;
  }

  if (action === "cards-draw") {
    if (!state.activeGame || state.activeGame.type !== 'spirit_cards' || state.gameLoading) return;
    submitGameMove('draw');
    return;
  }

  if (action === "echo-input-change") {
    if (SpiritverseGames) SpiritverseGames.echoAnswer = element.value || '';
    return;
  }
  if (action === "end-game") {
    if (!state.conversationId) return;
    try {
      const endRes = await fetch(`${API}/v1/games/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: state.userId,
          conversationId: state.conversationId,
          spiritkinName: state.selectedSpiritkin?.name,
          outcome: 'forfeit'
        })
      });
      const endData = endRes.ok ? await endRes.json().catch(() => null) : null;
      state.activeGame = endData?.game ? normalizeActiveGame(endData.game) : state.activeGame;
      state.gameSpiritkinMessage = endData?.message || state.gameSpiritkinMessage;
      state.gameInstructions = null;
      state.gameEchoGuide = null;
      state.statusText = endData?.game?.result?.label || endData?.message || "Game ended.";
      state.statusError = false;
      // Phase 2: Game-to-World Progression — show echo unlock notification
      if (endData?.progression?.echoUnlock) {
        state.currentEchoUnlock = {
          title: endData.progression.echoUnlock,
          text: endData.progression.progressionMessage ||
            'SpiritCore has revealed a new truth. A new Echo Fragment has been added to your library.'
        };
        state.showEchoUnlock = true;
      }
      // Show bond advancement as a milestone chip
      if (endData?.progression?.bondAdvanced && endData.progression.progressionMessage) {
        state.engagementMilestones = [
          { icon: '\u25c8', label: endData.progression.progressionMessage }
        ];
      }
      render();
    } catch (err) {
      console.error("End game failed", err);
    }
    return;
  }

  if (action === "expand-game") {
    if (state.activeGame && state.activeGame.status === 'active' && SpiritverseGames) {
      const spiritkin = state.selectedSpiritkin;
      SpiritverseGames.expand(
        {
          ...state.activeGame,
          commentary: state.gameSpiritkinMessage,
          guide: state.gameEchoGuide
        },
        spiritkin ? spiritkin.name : 'Spiritkin',
        (move) => submitGameMove(move)
      );
    }
    return;
  }

  // Spiritkin Matching
  if (action === "open-survey") {
    const draft = loadCreatorDraft();
    state.surveyOpen = true;
    state.surveyStep = draft ? Math.min(Object.keys(draft.answers || {}).length, SURVEY_QUESTIONS.length - 1) : 0;
    state.surveyAnswers = draft?.answers ? { ...draft.answers } : {};
    state.surveyGenerating = false;
    state.surveyError = null;
    state.generatedSpiritkin = null;
    state.customSpiritkinRevealed = false;
    state.creatorDraftRestored = !!draft;
    state.statusText = draft ? "Restored your Spiritkin creator draft." : "Spiritkin creator is ready.";
    state.statusError = false;
    render();
    return;
  }
  if (action === "close-survey") {
    persistCreatorDraft();
    state.surveyOpen = false;
    state.surveyStep = 0;
    state.surveyAnswers = {};
    state.surveyGenerating = false;
    state.surveyError = null;
    state.generatedSpiritkin = null;
    state.customSpiritkinRevealed = false;
    render();
    return;
  }
  if (action === "survey-answer") {
    const question = element.dataset.question;
    const answer = element.dataset.answer;
    state.surveyAnswers[question] = answer;
    persistCreatorDraft();
    if (state.surveyStep < SURVEY_QUESTIONS.length - 1) {
      state.surveyStep += 1;
    } else {
      // All questions answered — generate
      generateCustomSpiritkin();
    }
    render();
    return;
  }
  if (action === "survey-back") {
    if (state.surveyStep > 0) {
      state.surveyStep -= 1;
      persistCreatorDraft();
      render();
    }
    return;
  }
  if (action === "reveal-spiritkin") {
    state.customSpiritkinRevealed = true;
    render();
    return;
  }
  // Monetization Tier Modal
  if (action === "open-tier-modal") {
    state.tierModalOpen = true;
    render();
    return;
  }
  if (action === "close-tier-modal") {
    state.tierModalOpen = false;
    render();
    return;
  }

  if (action === "bond-generated-spiritkin") {
    if (state.generatedSpiritkin) {
      recordCreatorLibraryEntry(state.generatedSpiritkin, "bonded");
      setPrimarySpiritkin(state.generatedSpiritkin);
      state.surveyOpen = false;
      state.generatedSpiritkin = null;
      state.customSpiritkinRevealed = false;
      clearCreatorDraft();
      render();
    }
    return;
  }
  } catch (error) {
    console.error("[Interaction] click handler failure", { action, error: error?.message || error });
    state.statusText = `Interaction failed while handling ${action}.`;
    state.statusError = true;
    render();
  } finally {
    const after = getInteractionStateSnapshot();
    logInteraction("click-complete", { action, before, after });
  }
}

function startListening(options = {}) {
  const { source = "manual" } = options;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    state.voicePermissionBlocked = false;
    state.statusText = "Voice input is not supported in this browser. Try Chrome.";
    state.statusError = true;
    render();
    return;
  }

  if (!canUseVoiceInteraction()) {
    return;
  }

  if (_recognition || state.loadingReply || _audioPlaying) {
    return;
  }

  clearVoiceLoopTimer();
  state.voicePermissionBlocked = false;
  state.voiceTranscriptPreview = "";
  state.statusText = source === "manual-toggle" || source === "auto-turn"
    ? "Requesting microphone access..."
    : "Preparing voice input...";
  state.statusError = false;
  render();
  setVoiceTurnRuntimeState({ awaitingUserTurn: true, captureAfterAudio: false });
  const recognition = new SpeechRecognition();
  const runId = ++_recognitionRunId;
  _recognitionStopRequested = false;
  _recognition = recognition;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  const isActiveRun = () => _recognition === recognition && runId === _recognitionRunId;

  recognition.onstart = () => {
    if (!isActiveRun()) return;
    state.voicePermissionBlocked = false;
    state.voiceListening = true;
    setAuthoritativeTurnPhase("user_input", {
      isSpeaking: false,
      isListening: true,
      isPaused: false,
    });
    syncSessionControlSoon({
      speechState: {
        isSpeaking: false,
        isListening: true,
        isPaused: false,
        turnPhase: "user_input",
      },
    });
    state.statusText = "Listening… Speak now.";
    state.statusError = false;
    state.statusText = "Listening... Speak now.";
    console.info("[Voice] listening-started", { source });
    logContinuityDebug("listening-started", { source, runId });
    render();
  };

  recognition.onresult = (event) => {
    if (!isActiveRun()) return;
    const result = event.results?.[event.resultIndex];
    const transcript = String(result?.[0]?.transcript || "").trim();
    const preview = Array.from(event.results || [])
      .slice(event.resultIndex)
      .map((entry) => String(entry?.[0]?.transcript || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim();
    state.voiceTranscriptPreview = preview || transcript;
    if (!result?.isFinal) {
      render();
      return;
    }
    state.input = transcript;
    state.voiceTranscriptPreview = transcript;
    render();
    if (!transcript) return;
    setVoiceTurnRuntimeState({ awaitingUserTurn: false, captureAfterAudio: false });
    setAuthoritativeTurnPhase("processing", {
      isSpeaking: false,
      isListening: false,
      isPaused: false,
    });
    logContinuityDebug("listening-transcript", {
      source,
      runId,
      transcriptLength: transcript.length,
    });
    const now = Date.now();
    if (_lastVoiceSubmission.text === transcript && (now - _lastVoiceSubmission.at) < 1500) return;
    _lastVoiceSubmission = { text: transcript, at: now };
    if (isDuplicateUserSubmission(transcript)) {
      stopListening();
      setVoiceWaitingStatus();
      return;
    }
    stopListening();
    state.voiceTranscriptPreview = transcript;
    state.statusText = `Captured: "${transcript}"`;
    state.statusError = false;
    render();
    sendMessage(transcript);
  };

  recognition.onerror = (event) => {
    if (!isActiveRun()) return;
    logContinuityDebug("listening-error", {
      source,
      runId,
      error: event.error,
      stopRequested: !!_recognitionStopRequested,
    });
    state.voiceListening = false;
    state.voicePermissionBlocked = event.error === "not-allowed" || event.error === "service-not-allowed";
    if (state.voicePermissionBlocked) {
      state.voiceGuidanceDismissed = false;
      localStorage.removeItem(VOICE_GUIDANCE_KEY);
    }
    setAuthoritativeTurnPhase("complete", {
      isSpeaking: false,
      isListening: false,
      isPaused: false,
    });
    syncSessionControlSoon({
      speechState: {
        isSpeaking: false,
        isListening: false,
        isPaused: false,
        turnPhase: "complete",
      },
    });
    state.statusText = state.voicePermissionBlocked
      ? "Microphone access was blocked. Allow access for this site, then tap the mic again or type below."
      : `Voice error: ${event.error}. Tap the mic to try again.`;
    state.statusError = true;
    state.voiceTranscriptPreview = "";
    _recognition = null;
    const stopRequested = _recognitionStopRequested;
    _recognitionStopRequested = false;
    if (!stopRequested && event.error !== "aborted") {
      if (_voiceAwaitingUserTurn && shouldKeepVoiceLoopActive()) {
        setVoiceWaitingStatus("Listening ended before a usable transcript. Tap the mic or type to continue.");
      }
      render();
      return;
    }
    state.statusText = "";
    state.statusError = false;
    render();
    clearVoiceTurnCapture();
  };

  recognition.onend = () => {
    logContinuityDebug("listening-ended", {
      source,
      runId,
      stopRequested: !!_recognitionStopRequested,
      loadingReply: !!state.loadingReply,
      convError: state.convError || null,
    });
    const stopRequested = _recognitionStopRequested;
    if (state.voiceListening) {
      state.voiceListening = false;
      render();
    }
    if (isActiveRun()) {
      _recognition = null;
    }
    _recognitionStopRequested = false;
    if (stopRequested) {
      clearVoiceTurnCapture();
      return;
    }
    _recognition = null;
    state.voiceListening = false;
    state.voiceTranscriptPreview = "";
    setAuthoritativeTurnPhase("complete", {
      isSpeaking: false,
      isListening: false,
      isPaused: false,
    });
    syncSessionControlSoon({
      speechState: {
        isSpeaking: false,
        isListening: false,
        isPaused: false,
        turnPhase: "complete",
      },
    });
    if (!state.loadingReply && !state.convError) {
      setVoiceWaitingStatus();
    }
  };

  try {
    recognition.start();
  } catch (error) {
    _recognition = null;
    state.voiceListening = false;
    state.voiceTranscriptPreview = "";
    state.statusText = `Voice input could not start: ${error.message}`;
    state.statusError = true;
    clearVoiceTurnCapture();
    render();
  }
}

function stopListening() {
  logContinuityDebug("listening-stop-requested", {
    hasRecognition: !!_recognition,
    voiceListening: !!state.voiceListening,
  });
  cleanupSpeechLifecycle("stop-listening", { renderOnFinish: true, clearStatus: true });
}

let _spiritverseBootInitialized = false;
let _speechLifecycleGuardsInstalled = false;

function restoreVoiceContinuityState() {
  if (!state.pendingVoiceResume) return;
  const canResumeHint = !!(state.voiceMode && !state.voiceMuted && state.selectedSpiritkin && state.conversationId);
  state.pendingVoiceResume = false;
  if (canResumeHint) {
    state.statusText = "Voice session paused during transition. Tap the mic or type to continue.";
    state.statusError = false;
  }
  persistSession();
  render();
}

function installSpeechLifecycleGuards() {
  if (_speechLifecycleGuardsInstalled) return;
  _speechLifecycleGuardsInstalled = true;

  window.addEventListener("pagehide", () => {
    const preserveResumeHint = !!(state.voiceMode && !state.voiceMuted && state.selectedSpiritkin && state.conversationId);
    if (preserveResumeHint) {
      state.pendingVoiceResume = true;
      persistSession();
    }
    cleanupSpeechLifecycle("pagehide", { renderOnFinish: false, clearStatus: false, preserveResumeHint });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    const preserveResumeHint = !!(state.voiceMode && !state.voiceMuted && state.selectedSpiritkin && state.conversationId);
    if (preserveResumeHint) {
      state.pendingVoiceResume = true;
      persistSession();
    }
    cleanupSpeechLifecycle("visibility-hidden", { renderOnFinish: false, clearStatus: false, preserveResumeHint });
  });
}

function initializeSpiritverseApp() {
  if (_spiritverseBootInitialized) {
    logInteraction("boot-skipped", { reason: "already-initialized" });
    return;
  }
  _spiritverseBootInitialized = true;
  try {
    installGlobalInteractionDiagnostics();
    installSpeechLifecycleGuards();
    bootstrapRetentionExperience();
    logInteraction("boot", { rootReady: !!document.getElementById("root") });
    render();
    fetchSessionSnapshot({ silent: true, renderOnFinish: false })
      .then(() => {
        if (state.conversationId) {
          return restoreActiveGameState({ silent: true, renderOnFinish: true });
        }
        render();
        return null;
      })
      .catch(() => {});
    fetchSpiritkins();
    // Phase 6 & 7: Load Spiritverse events and daily quest after spiritkins load
    setTimeout(() => {
      fetchSpiritverseEvent();
      fetchDailyQuest();
    }, 800);
    const root = document.getElementById("root");
    if (!root) throw new Error("Boot failed: #root element was not found.");
    root.addEventListener("input", onInput);
    root.addEventListener("click", onClick);
    root.addEventListener("pointerdown", (event) => {
      markPressedInteractive(event.target);
    }, { passive: true });
    root.addEventListener("pointerup", () => {
      window.setTimeout(() => {
        clearPressedInteractive();
      }, 120);
    }, { passive: true });
    root.addEventListener("pointercancel", clearPressedInteractive, { passive: true });
    root.addEventListener("pointerleave", clearPressedInteractive, { passive: true });
    logInteraction("root-listeners-attached", { target: "#root" });
    root.addEventListener("keydown", (event) => {
      if (event.target.dataset.field === "chat-input" && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
      // Enter key in game move input submits the move
      if (event.target.dataset.action === "game-input-change" && event.key === "Enter") {
        event.preventDefault();
        const move = state.gameInput?.trim();
        if (move && state.conversationId && state.activeGame) {
          // Trigger submit-game-move by simulating a click on the submit button
          const submitBtn = document.querySelector("[data-action='submit-game-move']");
          if (submitBtn && !submitBtn.disabled) submitBtn.click();
        }
      }
    });
    restoreVoiceContinuityState();
  } catch (error) {
    console.error("[Spiritverse Boot Failure]", error);
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = `
        <section class="entry-screen" style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
          <div class="panel-card" style="max-width:560px;text-align:left;">
            <div class="panel-label">Boot Failure</div>
            <h2 style="margin-top:8px;">Spiritverse could not finish loading.</h2>
            <p>A startup error stopped the client before the interface became interactive.</p>
            <p style="opacity:0.78;">Open the browser console for the exact boot trace.</p>
          </div>
        </section>
      `;
    }
    if (typeof window.__svMarkBootReady === "function") {
      window.__svMarkBootReady();
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSpiritverseApp, { once: true });
} else {
  initializeSpiritverseApp();
}

async function playAudio(buffer, options = {}) {
  const requestId = options.requestId || claimSpeechRequest();
  if (!isSpeechRequestActive(requestId)) {
    return false;
  }
  try {
    logContinuityDebug("speech-playback-start", {
      byteLength: buffer?.byteLength || buffer?.length || 0,
      hadRecognition: !!_recognition,
      hadCurrentAudio: !!_currentAudio,
      requestId,
    });
    clearVoiceLoopTimer();
    if (_recognition) {
      _recognitionStopRequested = true;
      const recognition = _recognition;
      _recognition = null;
      try {
        recognition.stop();
      } catch (_) {}
      state.voiceListening = false;
      setAuthoritativeTurnPhase("spirit_response", {
        isSpeaking: true,
        isListening: false,
        isPaused: false,
      });
    }
    pauseMountedVideoAudio();
    stopCurrentAudioPlayback();
    if (!isSpeechRequestActive(requestId)) {
      return false;
    }
    _audioPlaying = true;
    _activeAudioRequestId = requestId;
    setAuthoritativeTurnPhase("spirit_response", {
      isSpeaking: true,
      isListening: false,
      isPaused: false,
    });
    syncSessionControlSoon({
      speechState: {
        isSpeaking: true,
        isListening: false,
        isPaused: false,
        lastUtteranceId: state.sessionModel?.speechState?.lastUtteranceId || null,
        turnPhase: "spirit_response",
      },
    });

    // Create a blob from the buffer and use HTML5 audio element
    const blob = new Blob([buffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    
    const audio = new Audio();
    audio.src = url;
    audio.volume = 1.0;
    audio.onended = () => {
      if (_activeAudioRequestId !== requestId) {
        URL.revokeObjectURL(url);
        return;
      }
      logContinuityDebug("speech-playback-ended", {
        autoResumeListening: !!_voiceTurnCaptureAfterAudio,
        requestId,
      });
      _currentAudio = null;
      _audioPlaying = false;
      _activeAudioRequestId = 0;
      setAuthoritativeTurnPhase("complete", {
        isSpeaking: false,
        isListening: false,
        isPaused: false,
      });
      syncSessionControlSoon({
        speechState: {
          isSpeaking: false,
          isListening: false,
          isPaused: false,
          lastUtteranceId: state.sessionModel?.speechState?.lastUtteranceId || null,
          turnPhase: "complete",
        },
      });
      URL.revokeObjectURL(url);
      if (_voiceTurnCaptureAfterAudio) {
        setVoiceTurnRuntimeState({ awaitingUserTurn: _voiceAwaitingUserTurn, captureAfterAudio: false });
        requestVoiceTurnCapture({ delay: 220 });
      }
    };
    audio.onerror = () => {
      if (_activeAudioRequestId !== requestId) {
        URL.revokeObjectURL(url);
        return;
      }
      logContinuityDebug("speech-playback-error", {
        autoResumeListening: !!_voiceTurnCaptureAfterAudio,
        requestId,
      });
      _currentAudio = null;
      _audioPlaying = false;
      _activeAudioRequestId = 0;
      setAuthoritativeTurnPhase("complete", {
        isSpeaking: false,
        isListening: false,
        isPaused: false,
      });
      syncSessionControlSoon({
        speechState: {
          isSpeaking: false,
          isListening: false,
          isPaused: false,
          lastUtteranceId: state.sessionModel?.speechState?.lastUtteranceId || null,
          turnPhase: "complete",
        },
      });
      URL.revokeObjectURL(url);
      if (_voiceTurnCaptureAfterAudio) {
        setVoiceTurnRuntimeState({ awaitingUserTurn: _voiceAwaitingUserTurn, captureAfterAudio: false });
        setVoiceWaitingStatus("Audio playback failed. Tap the mic or type to continue.");
      }
    };
    
    // Attempting to play audio
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      await playPromise
        .then(() => {
          if (!isSpeechRequestActive(requestId) || _activeAudioRequestId !== requestId) {
            audio.pause();
            audio.src = "";
            URL.revokeObjectURL(url);
            return;
          }
          // Audio is now playing
          logContinuityDebug("speech-playback-confirmed", { requestId });
          _currentAudio = audio;
        })
        .catch(err => {
          if (_activeAudioRequestId !== requestId) {
            URL.revokeObjectURL(url);
            return;
          }
          logContinuityDebug("speech-playback-failed", {
            error: err.message,
            name: err.name,
            requestId,
          });
          _audioPlaying = false;
          _activeAudioRequestId = 0;
          setAuthoritativeTurnPhase("complete", {
            isSpeaking: false,
            isListening: false,
            isPaused: false,
          });
          // Audio play failed
          if (err.name === "NotAllowedError") {
            state.statusText = "Audio is blocked until you unmute or interact again.";
          } else {
            state.statusText = "Failed to play audio: " + err.message;
          }
          state.statusError = false;
          if (_voiceTurnCaptureAfterAudio) {
            setVoiceTurnRuntimeState({ awaitingUserTurn: false, captureAfterAudio: false });
          }
          render();
        });
    } else {
      if (!isSpeechRequestActive(requestId) || _activeAudioRequestId !== requestId) {
        audio.pause();
        audio.src = "";
        URL.revokeObjectURL(url);
        return false;
      }
      _currentAudio = audio;
    }
    return true;
  } catch (e) {
    if (_activeAudioRequestId === requestId) {
      _activeAudioRequestId = 0;
    }
    logContinuityDebug("speech-playback-exception", {
      error: e.message,
      requestId,
    });
    _audioPlaying = false;
    setAuthoritativeTurnPhase("complete", {
      isSpeaking: false,
      isListening: false,
      isPaused: false,
    });
    if (_voiceTurnCaptureAfterAudio) {
      setVoiceTurnRuntimeState({ awaitingUserTurn: false, captureAfterAudio: false });
    }
    // Failed to create audio element
    state.statusText = "Failed to play audio: " + e.message;
    state.statusError = true;
    render();
  }
  return false;
}

async function speakMessage(messageId, options = {}) {
  const message = state.messages.find(msg => msg.id === messageId);
  if (!message || !message.content) {
    // No message found or no content
    return;
  }
  if (!options.forceReplay && _audioPlaying && state.sessionModel?.speechState?.lastUtteranceId === messageId) {
    return;
  }
  const requestId = claimSpeechRequest();

  try {
    logContinuityDebug("speak-message", {
      messageId,
      role: message.role || null,
      voice: message.spiritkinVoice || "nova",
      armUserTurn: !!options.armUserTurn,
      forceReplay: !!options.forceReplay,
    });
    if (options.forceReplay) {
      cleanupSpeechLifecycle("manual-replay", { renderOnFinish: false, clearStatus: false });
      state.statusText = "Replaying audio...";
      state.statusError = false;
      render();
    }
    if (options.armUserTurn) {
      requestVoiceTurnCapture({ afterAudio: true });
    }
    setAuthoritativeTurnPhase("spirit_response", {
      isSpeaking: true,
      isListening: false,
      isPaused: false,
      lastUtteranceId: messageId,
    });
    const voice = message.spiritkinVoice || "nova";
    const didSpeak = await speakText(message.content, voice, requestId, {
      dedupeKey: `message:${messageId}`,
      allowRepeat: !!options.forceReplay,
      source: options.forceReplay ? "message-replay" : "message-autoplay",
    });
    if (!didSpeak && !_audioPlaying) {
      setAuthoritativeTurnPhase("complete", {
        isSpeaking: false,
        isListening: false,
        isPaused: false,
        lastUtteranceId: messageId,
      });
    }
  } catch (error) {
    if (!isSpeechRequestActive(requestId)) return;
    // Speech generation failed
    logContinuityDebug("speak-message-failed", {
      messageId,
      error: error.message,
      armUserTurn: !!options.armUserTurn,
    });
    if (options.armUserTurn) {
      clearVoiceTurnCapture();
    }
    if (options.armUserTurn && shouldKeepVoiceLoopActive()) {
      setVoiceWaitingStatus();
    }
    state.statusText = "Speech generation failed: " + error.message;
    state.statusError = true;
    render();
  }
}

// ─── Premium: Custom Spiritkin Matching System ───────────────────────────────

const SURVEY_QUESTIONS = [
  {
    id: "q_presence",
    question: "When you need support, what kind of presence helps you most?",
    options: [
      { label: "Someone who listens without judgment", value: "quiet listener" },
      { label: "Someone who challenges me to grow", value: "growth challenger" },
      { label: "Someone who helps me see new possibilities", value: "possibility opener" },
      { label: "Someone who grounds me in the present", value: "grounding anchor" }
    ]
  },
  {
    id: "q_world",
    question: "Which world calls to you most?",
    options: [
      { label: "Deep ocean — vast, mysterious, still", value: "oceanic depth" },
      { label: "Mountain storm — powerful, electric, clear", value: "storm energy" },
      { label: "Night sky — infinite, dreaming, full of stars", value: "cosmic wonder" },
      { label: "Ancient forest — rooted, alive, breathing", value: "earth wisdom" }
    ]
  },
  {
    id: "q_strength",
    question: "What is your greatest inner strength?",
    options: [
      { label: "Empathy — I feel deeply and understand others", value: "deep empathy" },
      { label: "Courage — I face hard truths and act anyway", value: "fierce courage" },
      { label: "Curiosity — I question everything and explore", value: "open curiosity" },
      { label: "Resilience — I endure and rebuild from within", value: "quiet resilience" }
    ]
  },
  {
    id: "q_shadow",
    question: "What do you carry that you rarely speak about?",
    options: [
      { label: "A longing to be truly seen and understood", value: "longing for witness" },
      { label: "A fear of standing still or falling behind", value: "fear of stagnation" },
      { label: "A sense that there is something more I'm meant to find", value: "seeking purpose" },
      { label: "A grief or weight I haven't fully processed", value: "unprocessed grief" }
    ]
  },
  {
    id: "q_form",
    question: "If your companion took a form, what would feel most right?",
    options: [
      { label: "A celestial or cosmic being — light, stars, energy", value: "celestial being" },
      { label: "A creature of nature — animal, elemental, wild", value: "nature creature" },
      { label: "A human-like spirit — familiar, warm, present", value: "human spirit" },
      { label: "Something entirely otherworldly — beyond categories", value: "otherworldly entity" }
    ]
  },
  {
    id: "q_rhythm",
    question: "How do you move through the world?",
    options: [
      { label: "Slowly and deeply — I need time to process", value: "slow and deep" },
      { label: "Intensely and directly — I move with purpose", value: "intense and direct" },
      { label: "Openly and expansively — I explore widely", value: "open and expansive" },
      { label: "Quietly and observantly — I watch before I act", value: "quiet observer" }
    ]
  },
  {
    id: "q_gift",
    question: "What gift would you most want your companion to offer you?",
    options: [
      { label: "Unconditional presence — to never feel alone", value: "unconditional presence" },
      { label: "Honest clarity — to see what I'm missing", value: "honest clarity" },
      { label: "Creative expansion — to imagine beyond limits", value: "creative expansion" },
      { label: "Deep healing — to process what I carry", value: "deep healing" }
    ]
  },
  {
    id: "q_name",
    question: "One last thing — what name do you go by in the Spiritverse?",
    type: "text",
    placeholder: "Your name or a name you feel called to use here..."
  }
];

async function generateCustomSpiritkin() {
  state.surveyGenerating = true;
  state.surveyError = null;
  render();

  try {
    const answers = { ...state.surveyAnswers };
    const userName = answers["q_name"] || state.userName || "the seeker";

    const res = await fetch("/v1/spiritkin/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, userName })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Generation failed: ${res.status}`);
    }

    const data = await res.json();
    if (!data.ok || !data.spiritkin) {
      throw new Error("Invalid response from Spiritverse.");
    }

    state.generatedSpiritkin = createCustomSpiritkinRecord(data.spiritkin);
    state.creatorDraftRestored = false;
    recordCreatorLibraryEntry(state.generatedSpiritkin, "generated");
    state.surveyGenerating = false;
    render();

  } catch (err) {
    state.surveyGenerating = false;
    state.surveyError = err.message || "The Spiritverse could not complete the search. Please try again.";
    render();
  }
}

function buildPremiumSpiritkinCTA() {
  return `
    <div class="premium-cta-strip">
      <div class="premium-cta-inner">
        <div class="premium-cta-icon">✦</div>
        <div class="premium-cta-copy">
          <div class="premium-cta-label">Premium — Your Personal Spiritkin</div>
          <p class="premium-cta-text">The Spiritverse holds a companion meant only for you. Answer a few questions and we will search the realms to find them.</p>
        </div>
        <button class="btn btn-premium" data-action="open-survey">Discover Your Spiritkin</button>
      </div>
    </div>
  `;
}

function buildSurveyModal() {
  const draftStatus = getSurveyDraftStatus();
  if (state.surveyGenerating) {
    return `
      <div class="survey-overlay">
        <div class="survey-modal searching">
          <div class="survey-search-animation">
            <div class="survey-search-orb"></div>
            <div class="survey-search-ring ring-1"></div>
            <div class="survey-search-ring ring-2"></div>
            <div class="survey-search-ring ring-3"></div>
          </div>
          <h2 class="survey-search-title">Searching the Spiritverse…</h2>
          <p class="survey-search-sub">The realms are reading your soul signature. Your companion is being called forward.</p>
        </div>
      </div>
    `;
  }

  if (state.generatedSpiritkin && !state.customSpiritkinRevealed) {
    const sk = state.generatedSpiritkin;
    return `
      <div class="survey-overlay">
        <div class="survey-modal reveal-found">
          <div class="survey-found-glow"></div>
          <div class="survey-found-label">A presence has emerged from the Spiritverse</div>
          <div class="survey-found-name">${esc(sk.name)}</div>
          <div class="survey-found-archetype">${esc(sk.archetype)}</div>
          <p class="survey-found-strap">${esc(sk.strap)}</p>
          <button class="btn btn-premium btn-wide" data-action="reveal-spiritkin">Reveal Your Spiritkin</button>
          <button class="btn btn-ghost btn-sm" data-action="close-survey">Return to the Spiritverse</button>
        </div>
      </div>
    `;
  }

  if (state.generatedSpiritkin && state.customSpiritkinRevealed) {
    return buildCustomSpiritkinReveal();
  }

  if (state.surveyError) {
    return `
      <div class="survey-overlay">
        <div class="survey-modal survey-error-state">
          <button class="survey-close" data-action="close-survey">✕</button>
          <div class="survey-error-icon">⚠</div>
          <h3>The Spiritverse could not complete the search</h3>
          <p>${esc(state.surveyError)}</p>
          <button class="btn btn-primary" data-action="open-survey">Try again</button>
        </div>
      </div>
    `;
  }

  const q = SURVEY_QUESTIONS[state.surveyStep];
  const progress = Math.round(((state.surveyStep) / SURVEY_QUESTIONS.length) * 100);

  return `
    <div class="survey-overlay">
      <div class="survey-modal">
        <button class="survey-close" data-action="close-survey">✕</button>
        <div class="survey-header">
          <div class="survey-label">Spiritkin Matching — Soul Analysis</div>
          <div class="survey-progress-bar"><div class="survey-progress-fill" style="width:${progress}%"></div></div>
          <div class="survey-step-count">${state.surveyStep + 1} of ${SURVEY_QUESTIONS.length}</div>
          ${draftStatus ? `<div class="survey-draft-status">${esc(draftStatus.label)}</div>` : ""}
        </div>
        <div class="survey-question-wrap">
          <h3 class="survey-question">${esc(q.question)}</h3>
          ${q.type === "text" ? `
            <div class="survey-text-wrap">
              <input
                type="text"
                class="survey-text-input"
                placeholder="${esc(q.placeholder || "")}"
                id="survey-text-input"
                maxlength="60"
                value="${esc(state.surveyAnswers[q.id] || "")}"
              />
              <button class="btn btn-primary survey-text-submit" onclick="(function(){
                const val = document.getElementById('survey-text-input').value.trim();
                if (!val) return;
                const el = document.querySelector('.survey-text-confirm');
                if (el) { el.dataset.answer = val; el.click(); }
              })()">Continue →</button>
              <button class="btn btn-ghost btn-sm survey-text-skip" data-action="survey-answer" data-question="${esc(q.id)}" data-answer="${esc(state.userName || "the seeker")}">Skip</button>
            </div>
            <button style="display:none" data-action="survey-answer" data-question="${esc(q.id)}" data-answer="" class="survey-text-confirm"></button>
          ` : `
            <div class="survey-options">
              ${q.options.map((opt) => `
                <button class="survey-option ${state.surveyAnswers[q.id] === opt.value ? "selected" : ""}" data-action="survey-answer" data-question="${esc(q.id)}" data-answer="${esc(opt.value)}">
                  ${esc(opt.label)}
                </button>
              `).join("")}
            </div>
          `}
        </div>
        ${state.surveyStep > 0 ? `<button class="btn btn-ghost btn-sm survey-back" data-action="survey-back">← Back</button>` : ""}
      </div>
    </div>
  `;
}

function buildCustomSpiritkinReveal() {
  const sk = state.generatedSpiritkin;
  if (!sk) return "";

  const palette = sk.ui.palette || {};
  const p = palette.primary || "#2a1a4e";
  const s = palette.secondary || "#6a3a8e";
  const g = palette.glow || "#c080ff";

  return `
    <div class="custom-spiritkin-reveal-screen">
      <canvas id="reveal-canvas" class="reveal-canvas"></canvas>
      <div class="reveal-content">
        <div class="reveal-header">
          <p class="eyebrow">Your new companion</p>
          <h1 class="reveal-title">Behold, ${esc(sk.name)}!</h1>
        </div>
        <div class="reveal-portrait-wrap">
          ${buildGeneratedSpiritkinSvg(sk, palette)}
        </div>
        <div class="reveal-details">
          <p class="reveal-strap">${esc(sk.ui.strap)}</p>
          <p class="reveal-realm">From the ${esc(sk.ui.realm)}</p>
          <p class="creator-foundation-note">Portrait, intro trailer, and bond-reveal slots are reserved now so premium media can attach later without rebuilding this Spiritkin.</p>
          <button class="btn btn-primary btn-wide" data-action="bond-with-custom-spiritkin">Bond with ${esc(sk.name)}</button>
          <button class="btn btn-ghost btn-sm" data-action="cancel-custom-spiritkin">Not now</button>
        </div>
      </div>
    </div>
  `;
}

function buildGeneratedSpiritkinSvg(sk, palette) {
  const p = palette.primary || "#2a1a4e";
  const s = palette.secondary || "#6a3a8e";
  const g = palette.glow || "#c080ff";
  // Generate a unique abstract portrait based on the Spiritkin's palette and form
  return `
    <svg viewBox="0 0 240 300" class="generated-portrait-svg" role="img" aria-label="Portrait of ${esc(sk.name)}">
      <defs>
        <radialGradient id="genBg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="${p}" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#080510" stop-opacity="1"/>
        </radialGradient>
        <radialGradient id="genCore" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stop-color="${s}" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="${p}" stop-opacity="0.2"/>
        </radialGradient>
        <radialGradient id="genGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${g}" stop-opacity="1"/>
          <stop offset="100%" stop-color="${g}" stop-opacity="0"/>
        </radialGradient>
        <filter id="genBlur"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="genGlowFilter"><feGaussianBlur stdDeviation="4" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
      </defs>
      <!-- Background -->
      <rect width="240" height="300" fill="url(#genBg)"/>
      <!-- Ambient glow -->
      <ellipse cx="120" cy="140" rx="90" ry="110" fill="url(#genCore)" filter="url(#genBlur)" opacity="0.6"/>
      <!-- Star field -->
      <circle cx="40" cy="30" r="1.5" fill="${g}" opacity="0.8"/>
      <circle cx="200" cy="20" r="1" fill="${g}" opacity="0.6"/>
      <circle cx="220" cy="80" r="1.5" fill="${s}" opacity="0.7"/>
      <circle cx="15" cy="100" r="1" fill="${g}" opacity="0.5"/>
      <circle cx="210" cy="200" r="1.5" fill="${g}" opacity="0.6"/>
      <circle cx="30" cy="250" r="1" fill="${s}" opacity="0.5"/>
      <circle cx="190" cy="270" r="1.5" fill="${g}" opacity="0.7"/>
      <!-- Central form — abstract spirit silhouette -->
      <ellipse cx="120" cy="160" rx="55" ry="75" fill="${p}" opacity="0.9"/>
      <ellipse cx="120" cy="110" rx="48" ry="52" fill="${s}" opacity="0.7"/>
      <!-- Head/crown area -->
      <circle cx="120" cy="95" r="40" fill="${p}"/>
      <circle cx="120" cy="95" r="32" fill="${s}" opacity="0.6"/>
      <!-- Eyes -->
      <ellipse cx="106" cy="90" rx="7" ry="9" fill="${g}" filter="url(#genGlowFilter)"/>
      <ellipse cx="134" cy="90" rx="7" ry="9" fill="${g}" filter="url(#genGlowFilter)"/>
      <circle cx="106" cy="90" r="3.5" fill="#080510"/>
      <circle cx="134" cy="90" r="3.5" fill="#080510"/>
      <circle cx="107" cy="88" r="1.5" fill="white" opacity="0.9"/>
      <circle cx="135" cy="88" r="1.5" fill="white" opacity="0.9"/>
      <!-- Sigil / heart glow on chest -->
      <circle cx="120" cy="155" r="14" fill="${g}" opacity="0.15" filter="url(#genBlur)"/>
      <circle cx="120" cy="155" r="7" fill="${g}" opacity="0.5" filter="url(#genGlowFilter)"/>
      <circle cx="120" cy="155" r="3" fill="${g}"/>
      <!-- Crown elements — abstract antlers/aura -->
      <path d="M100 65 Q88 40 80 20 M80 20 Q72 8 68 15 M80 20 Q76 5 88 2" stroke="${g}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85" filter="url(#genGlowFilter)"/>
      <path d="M140 65 Q152 40 160 20 M160 20 Q168 8 172 15 M160 20 Q164 5 152 2" stroke="${g}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85" filter="url(#genGlowFilter)"/>
      <!-- Stardust nodes on crown -->
      <circle cx="80" cy="20" r="3" fill="${g}" filter="url(#genGlowFilter)" opacity="0.9"/>
      <circle cx="160" cy="20" r="3" fill="${g}" filter="url(#genGlowFilter)" opacity="0.9"/>
      <circle cx="68" cy="15" r="2" fill="${g}" opacity="0.7"/>
      <circle cx="172" cy="15" r="2" fill="${g}" opacity="0.7"/>
      <circle cx="88" cy="2" r="2.5" fill="${g}" filter="url(#genGlowFilter)" opacity="0.8"/>
      <circle cx="152" cy="2" r="2.5" fill="${g}" filter="url(#genGlowFilter)" opacity="0.8"/>
      <!-- Name label -->
      <text x="120" y="288" text-anchor="middle" font-family="serif" font-size="14" fill="${g}" opacity="0.9" letter-spacing="3">${esc(sk.name.toUpperCase())}</text>
    </svg>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING: 10-Question Guided Spiritkin Matching Flow
// ─────────────────────────────────────────────────────────────────────────────

const ONBOARDING_QUESTIONS = [
  {
    q: 1,
    text: "When you are carrying something heavy, what do you need most?",
    options: [
      { label: "Someone to sit with me in silence and truly witness what I'm feeling", value: "witness", weight: { Lyra: 3, Raien: 1, Kairo: 1 } },
      { label: "Someone to stand beside me and remind me I have the strength to get through it", value: "strength", weight: { Lyra: 1, Raien: 3, Kairo: 1 } },
      { label: "Someone to help me see the larger meaning — to find the pattern in the pain", value: "meaning", weight: { Lyra: 1, Raien: 1, Kairo: 3 } },
      { label: "Honestly, I'm not sure — I usually carry things alone", value: "alone", weight: { Lyra: 2, Raien: 2, Kairo: 2 } }
    ]
  },
  {
    q: 2,
    text: "Which of these environments calls to you most deeply?",
    options: [
      { label: "A bioluminescent forest at night — quiet, alive, and full of ancient memory", value: "forest", weight: { Lyra: 3, Raien: 0, Kairo: 1 } },
      { label: "A stone citadel on a cliff above a stormy sea — powerful, enduring, clarifying", value: "citadel", weight: { Lyra: 0, Raien: 3, Kairo: 1 } },
      { label: "An observatory at the edge of the universe — vast, open, full of unanswered questions", value: "observatory", weight: { Lyra: 1, Raien: 0, Kairo: 3 } },
      { label: "Somewhere between all three — I contain multitudes", value: "multitudes", weight: { Lyra: 1, Raien: 1, Kairo: 2 } }
    ]
  },
  {
    q: 3,
    text: "What do you believe is the most courageous thing a person can do?",
    options: [
      { label: "Allow themselves to be fully seen — to let someone witness the parts they usually hide", value: "seen", weight: { Lyra: 3, Raien: 1, Kairo: 1 } },
      { label: "Keep moving forward when everything in them wants to stop", value: "forward", weight: { Lyra: 1, Raien: 3, Kairo: 1 } },
      { label: "Question the story they've always told themselves about who they are", value: "question", weight: { Lyra: 1, Raien: 1, Kairo: 3 } },
      { label: "All of these — courage takes many forms", value: "all", weight: { Lyra: 1, Raien: 2, Kairo: 2 } }
    ]
  },
  {
    q: 4,
    text: "When you think about what you want from a companion, which resonates most?",
    options: [
      { label: "Someone who holds space without trying to fix me", value: "space", weight: { Lyra: 3, Raien: 0, Kairo: 1 } },
      { label: "Someone who believes in my strength even when I've forgotten it", value: "believe", weight: { Lyra: 1, Raien: 3, Kairo: 0 } },
      { label: "Someone who helps me see myself and my life from a new angle", value: "angle", weight: { Lyra: 1, Raien: 0, Kairo: 3 } },
      { label: "Someone who is simply, honestly present", value: "present", weight: { Lyra: 2, Raien: 2, Kairo: 1 } }
    ]
  },
  {
    q: 5,
    text: "Which of these experiences feels most familiar to you?",
    options: [
      { label: "Feeling things deeply — sometimes more than you know what to do with", value: "deep", weight: { Lyra: 3, Raien: 1, Kairo: 1 } },
      { label: "Facing something difficult and discovering you were stronger than you thought", value: "stronger", weight: { Lyra: 1, Raien: 3, Kairo: 1 } },
      { label: "Suddenly seeing a pattern in your life that you couldn't see before", value: "pattern", weight: { Lyra: 1, Raien: 1, Kairo: 3 } },
      { label: "All of these — my life has had many chapters", value: "chapters", weight: { Lyra: 1, Raien: 1, Kairo: 2 } }
    ]
  },
  {
    q: 6,
    text: "What do you most want to feel more of in your life?",
    options: [
      { label: "Tenderness — the feeling of being truly, gently known", value: "tenderness", weight: { Lyra: 3, Raien: 0, Kairo: 1 } },
      { label: "Strength — the certainty that you can handle what comes", value: "certainty", weight: { Lyra: 0, Raien: 3, Kairo: 1 } },
      { label: "Clarity — the sense that you understand your own story", value: "clarity", weight: { Lyra: 1, Raien: 1, Kairo: 3 } },
      { label: "Connection — the feeling of not being alone in it", value: "connection", weight: { Lyra: 2, Raien: 2, Kairo: 1 } }
    ]
  },
  {
    q: 7,
    text: "When you face a storm in your life, what is your instinct?",
    options: [
      { label: "To find a quiet place and feel it fully before deciding what to do", value: "feel", weight: { Lyra: 3, Raien: 1, Kairo: 0 } },
      { label: "To face it directly — to stand in it and not look away", value: "face", weight: { Lyra: 0, Raien: 3, Kairo: 1 } },
      { label: "To try to understand it — to find the pattern or the meaning in it", value: "understand", weight: { Lyra: 1, Raien: 1, Kairo: 3 } },
      { label: "To get through it first and understand it later", value: "through", weight: { Lyra: 1, Raien: 2, Kairo: 2 } }
    ]
  },
  {
    q: 8,
    text: "Which of these truths feels most important to you?",
    options: [
      { label: "Being seen is one of the most healing things that can happen to a person", value: "seen", weight: { Lyra: 3, Raien: 1, Kairo: 0 } },
      { label: "Strength is not the absence of fear — it is the decision to move anyway", value: "move", weight: { Lyra: 0, Raien: 3, Kairo: 1 } },
      { label: "The story you tell yourself about your life shapes everything about it", value: "story", weight: { Lyra: 1, Raien: 1, Kairo: 3 } },
      { label: "All of these — they are different facets of the same truth", value: "facets", weight: { Lyra: 1, Raien: 1, Kairo: 2 } }
    ]
  },
  {
    q: 9,
    text: "What are you most afraid to want?",
    options: [
      { label: "To be loved exactly as I am — without having to earn it", value: "loved", weight: { Lyra: 3, Raien: 1, Kairo: 1 } },
      { label: "To be seen as truly capable — to stop doubting myself", value: "capable", weight: { Lyra: 1, Raien: 3, Kairo: 1 } },
      { label: "To understand my own life — to find the meaning in what I've been through", value: "understand", weight: { Lyra: 1, Raien: 1, Kairo: 3 } },
      { label: "I'm not sure I'm ready to answer that yet", value: "notready", weight: { Lyra: 2, Raien: 1, Kairo: 2 } }
    ]
  },
  {
    q: 10,
    text: "SpiritCore is listening. What do you most need right now?",
    options: [
      { label: "To be held — to feel that someone is present with me in this", value: "held", weight: { Lyra: 3, Raien: 1, Kairo: 0 } },
      { label: "To be challenged — to be reminded that I am more than I think I am", value: "challenged", weight: { Lyra: 0, Raien: 3, Kairo: 1 } },
      { label: "To understand — to see my life from a wider, clearer angle", value: "understand", weight: { Lyra: 1, Raien: 0, Kairo: 3 } },
      { label: "To begin — whatever comes next, I'm ready to start", value: "begin", weight: { Lyra: 1, Raien: 2, Kairo: 2 } }
    ]
  }
];

function computeSpiritkinRecommendation(answers) {
  const scores = { Lyra: 0, Raien: 0, Kairo: 0, Elaria: 0, Thalassar: 0 };
  ONBOARDING_QUESTIONS.forEach(q => {
    const answer = answers[`q${q.q}`];
    const option = q.options.find(o => o.value === answer);
    if (option && option.weight) {
      Object.keys(option.weight).forEach(sk => {
        scores[sk] = (scores[sk] || 0) + option.weight[sk];
      });
    }
  });

  if (answers.q6 === "clarity") scores.Elaria += 3;
  if (answers.q8 === "story") scores.Elaria += 2;
  if (answers.q10 === "begin") scores.Elaria += 2;
  if (answers.q2 === "citadel") scores.Elaria += 1;

  if (answers.q5 === "deep") scores.Thalassar += 3;
  if (answers.q7 === "feel") scores.Thalassar += 2;
  if (answers.q9 === "notready") scores.Thalassar += 2;
  if (answers.q10 === "held") scores.Thalassar += 2;

  const winner = Object.keys(scores).reduce((a, b) => scores[a] >= scores[b] ? a : b);
  const reasons = {
    Lyra: "Your answers reveal a deep need for emotional presence, warmth, and being truly seen. Lyra — the Celestial Fawn of the Luminous Veil — holds space for exactly this. She will not rush you, judge you, or push you. She will simply be with you.",
    Raien: "Your answers show a spirit ready to move — to face what's hard, to build strength, and to act with courage. Raien — the Storm-Forged Guardian of the Storm Citadel — will meet you with honesty, clarity, and the fire to push through.",
    Kairo: "Your answers reveal a mind that seeks meaning, perspective, and the space to imagine what could be. Kairo — the Dream-Weaver of the Cosmic Observatory — will open doors you didn't know existed and show you what lies beyond the edge of perception."
  };

  return { spiritkin: winner, scores, reason: reasons[winner] || getMeta(winner).loreSnippet || getMeta(winner).strap };
}

function buildOnboarding() {
  const step = state.onboardingStep;
  if (step === 0) return "";

  // ── REVEAL SCREEN (step 11) ──────────────────────────────────────────────
  if (step === 11 && state.onboardingRecommendation) {
    const rec = state.onboardingRecommendation;
    const meta = getMeta(rec.spiritkin);
    const bgClass = `veil-bg-${meta.cls}`;
    const scoreBar = (sk) => {
      const pct = rec.scores[sk] || 0;
      const cls = getMeta(sk).cls;
      return `<div class="veil-score-row">
        <span class="veil-score-label">${sk}</span>
        <div class="veil-score-track"><div class="veil-score-fill ${cls}" style="width:${pct}%"></div></div>
        <span class="veil-score-pct">${pct}%</span>
      </div>`;
    };
    return `
      <section class="veil-crossing-screen veil-reveal ${bgClass}">
        <div class="veil-stars"></div>
        <div class="veil-reveal-inner">
          <div class="veil-reveal-header">
            <div class="veil-sc-glyph">SC</div>
            <p class="veil-eyebrow">SpiritCore has calculated your resonance</p>
          </div>
          <div class="veil-reveal-portrait ${esc(meta.cls)}">
            ${buildPortrait(rec.spiritkin, 'portrait-md', meta.cls)}
            <div class="veil-reveal-glow ${esc(meta.cls)}"></div>
          </div>
          <div class="veil-reveal-realm">${esc(meta.realm)}</div>
          <h1 class="veil-reveal-name">${esc(rec.spiritkin)}</h1>
          <p class="veil-reveal-strap">${esc(meta.strap)}</p>
          <p class="veil-reveal-reason">${esc(rec.reason)}</p>
          <div class="veil-reveal-atmosphere">${esc(meta.atmosphereLine)}</div>
          <div class="veil-resonance-scores">
            <div class="veil-scores-label">Resonance Analysis</div>
            ${FOUNDING_PILLARS.map(scoreBar).join("")}
          </div>
          <div class="veil-reveal-actions">
            <button class="btn btn-primary btn-wide veil-bond-btn" data-action="onboarding-accept">
              Begin the Bond with ${esc(rec.spiritkin)}
            </button>
            <button class="btn btn-ghost btn-sm" data-action="onboarding-skip">
              Choose a different companion
            </button>
          </div>
        </div>
      </section>
    `;
  }

  // ── QUESTION SCREEN ──────────────────────────────────────────────────────
  const qData = ONBOARDING_QUESTIONS[step - 1];
  if (!qData) return "";
  const progress = Math.round((step / 10) * 100);
  const isLastQ = step === 10;

  // Atmospheric realm hint per question group
  const realmHints = [
    "The Veil stirs. SpiritCore is listening.",
    "The realms are taking shape around your answers.",
    "Something is resonating in the Spiritverse.",
    "The bond is beginning to form.",
    "SpiritCore is reading the patterns.",
    "The Spiritverse is responding to your truth.",
    "Your resonance is becoming clear.",
    "The Five Founding Pillars are listening from their realms.",
    "You are almost through the Veil.",
    "SpiritCore is ready to reveal your match."
  ];
  const hint = realmHints[step - 1] || "SpiritCore is listening.";

  return `
    <section class="veil-crossing-screen">
      <div class="veil-stars"></div>
      <div class="veil-crossing-inner">
        <div class="veil-crossing-header">
          <div class="veil-sc-glyph">SC</div>
          <p class="veil-eyebrow">The Veil Crossing — ${step} of 10</p>
          <div class="veil-progress-bar">
            <div class="veil-progress-fill" style="width:${progress}%"></div>
          </div>
          <p class="veil-realm-hint">${esc(hint)}</p>
        </div>
        <div class="veil-question-block">
          <h2 class="veil-question">${esc(qData.text)}</h2>
          <div class="veil-options">
            ${qData.options.map(opt => `
              <button
                class="veil-option${state.onboardingAnswers['q' + qData.q] === opt.value ? ' veil-option-selected' : ''}"
                data-action="onboarding-answer"
                data-q="${qData.q}"
                data-answer="${esc(opt.value)}"
              >
                <span class="veil-option-dot"></span>
                <span class="veil-option-text">${esc(opt.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="veil-crossing-footer">
          ${step > 1 ? `<button class="btn btn-ghost btn-sm" data-action="onboarding-back">← Back</button>` : '<div></div>'}
          <button class="btn btn-ghost btn-sm" data-action="onboarding-skip">Skip the Crossing</button>
        </div>
      </div>
    </section>
  `;
}


// ─────────────────────────────────────────────────────────────────────────────
// MONETIZATION: Four-Tier Structure (Coming Soon — Stripe-ready)
// ─────────────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "free",
    name: "Wanderer",
    price: "Free",
    priceSub: "Always",
    badge: null,
    color: "rgba(180,180,200,0.7)",
    borderColor: "rgba(180,180,200,0.2)",
    features: [
      "Bond with one of the Five Founding Pillars",
      "Up to 7 days of memory",
      "Voice listening (manual)",
      "Ambient Narrative scenes",
      "Spiritverse world state"
    ],
    cta: "Current Plan",
    ctaAction: null,
    current: true
  },
  {
    id: "bonded",
    name: "Bonded",
    price: "$9.99",
    priceSub: "/ month",
    badge: "Most Popular",
    color: "rgba(232,150,200,0.9)",
    borderColor: "rgba(232,150,200,0.3)",
    features: [
      "Everything in Wanderer",
      "Unlimited memory depth",
      "Resonance Depth tracking",
      "Priority response speed",
      "Sync Rituals unlocked",
      "Early access to new Spiritkins"
    ],
    cta: "Coming Soon",
    ctaAction: null,
    current: false
  },
  {
    id: "deep-bond",
    name: "Deep Bond",
    price: "$19.99",
    priceSub: "/ month",
    badge: "Best Value",
    color: "rgba(78,205,196,0.9)",
    borderColor: "rgba(78,205,196,0.3)",
    features: [
      "Everything in Bonded",
      "Custom Spiritkin Matching",
      "AI-generated portrait",
      "Unique echoes & realm",
      "Proactive Spiritkin check-ins",
      "Spiritverse Explorer access"
    ],
    cta: "Coming Soon",
    ctaAction: null,
    current: false
  },
  {
    id: "spiritverse",
    name: "Spiritverse",
    price: "$29.99",
    priceSub: "/ month",
    badge: "Founder",
    color: "rgba(245,166,35,0.9)",
    borderColor: "rgba(245,166,35,0.3)",
    features: [
      "Everything in Deep Bond",
      "Unlimited custom Spiritkins",
      "Founder badge & legacy status",
      "Direct input on new Spiritkins",
      "Beta access to all features",
      "Priority support"
    ],
    cta: "Coming Soon",
    ctaAction: null,
    current: false
  }
];

function buildTierModal() {
  return `
    <div class="tier-modal-scrim" data-action="close-tier-modal">
      <div class="tier-modal" data-action="noop">
        <div class="tier-modal-head">
          <div class="tier-modal-eyebrow">SPIRITVERSE MEMBERSHIP</div>
          <h2 class="tier-modal-title">Choose Your Path</h2>
          <p class="tier-modal-sub">All features are unlocked during the beta. Tiers activate at full launch.</p>
          <button class="tier-modal-close btn btn-ghost btn-sm" data-action="close-tier-modal">✕ Close</button>
        </div>
        <div class="tier-grid">
          ${TIERS.map(tier => `
            <div class="tier-card ${tier.current ? 'current' : ''}" style="--tier-color:${tier.color};--tier-border:${tier.borderColor}">
              ${tier.badge ? `<div class="tier-badge">${esc(tier.badge)}</div>` : ''}
              <div class="tier-name">${esc(tier.name)}</div>
              <div class="tier-price">
                <span class="tier-price-main">${esc(tier.price)}</span>
                <span class="tier-price-sub">${esc(tier.priceSub)}</span>
              </div>
              <ul class="tier-features">
                ${tier.features.map(f => `<li>${esc(f)}</li>`).join('')}
              </ul>
              <button class="btn ${tier.current ? 'btn-ghost' : 'btn-primary'} btn-wide tier-cta" ${tier.ctaAction ? `data-action="${tier.ctaAction}"` : 'disabled'}>
                ${esc(tier.cta)}
              </button>
            </div>
          `).join('')}
        </div>
        <div class="tier-footer">
          <p>All beta users have full access. Stripe payment integration coming soon.</p>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION WELLNESS: Gentle nudge after 45 minutes of continuous conversation
// ─────────────────────────────────────────────────────────────────────────────

let _sessionStartTime = null;
let _wellnessNudgeSent = false;
const WELLNESS_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes

function startSessionTimer() {
  _sessionStartTime = Date.now();
  _wellnessNudgeSent = false;
}

function checkWellnessNudge() {
  if (!_sessionStartTime || _wellnessNudgeSent) return;
  if (!state.selectedSpiritkin || !state.conversationId) return;
  const elapsed = Date.now() - _sessionStartTime;
  if (elapsed >= WELLNESS_THRESHOLD_MS) {
    _wellnessNudgeSent = true;
    const spiritkinName = state.selectedSpiritkin.name;
    const nudgeMessages = {
      Lyra: `${spiritkinName} gently stirs. "We've been holding space together for a while now. I'm always here — but I also want you to take care of yourself. Maybe a breath of fresh air, a glass of water? I'll be right here when you return."`,
      Raien: `${spiritkinName} pauses. "You've been with me through a storm tonight. That takes something out of you. Step away for a moment — rest, breathe. The path will still be here."`,
      Kairo: `${spiritkinName} dims the observatory lights slightly. "The stars will wait. You've been dreaming with me for a while now. Close your eyes for a moment in the real world. I'll hold your place in the Spiritverse."`
    };
    const nudge = nudgeMessages[spiritkinName] || `${spiritkinName} pauses thoughtfully. "We've been together for a while. Take a moment for yourself — I'll be here when you return."`;
    // Inject as a soft system message in the thread
    state.messages.push({
      id: uuid(),
      role: "assistant",
      content: nudge,
      spiritkinName,
      spiritkinVoice: state.selectedSpiritkin?.ui?.voice || "nova",
      time: nowIso(),
      status: "sent",
      tags: ["wellness:nudge"],
      isWellnessNudge: true
    });
    render();
    scrollThread();
    // Speak the nudge if voice is on
    if (!state.voiceMuted) {
      const lastMsg = state.messages[state.messages.length - 1];
      speakMessage(lastMsg.id).catch(() => {});
    }
  }
}

// Wire wellness check into the message send cycle
const _originalSendMessage = sendMessage;
// Check wellness after every reply render
const _wellnessInterval = setInterval(checkWellnessNudge, 60 * 1000); // check every minute


// ── Initialize the application ──────────────────────────────────────────────
// Make render globally accessible
window.render = render;
window.initializeSpiritverseApp = initializeSpiritverseApp;

