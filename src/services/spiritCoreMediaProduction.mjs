import { randomUUID } from "crypto";
import { ValidationError } from "../errors.mjs";
import { SPIRITGATE_RUNTIME_MEDIA } from "../../spiritkins-app/data/spiritkinRuntimeConfig.js";

export const SPIRITCORE_MEDIA_ASSET_KINDS = Object.freeze([
  "portrait",
  "hero",
  "full_body",
  "icon",
  "presence_indicator",
  "realm_background",
  "room_background",
  "gateway_background",
  "spiritgate_video",
  "idle_video",
  "speaking_video",
  "listening_video",
  "greeting_video",
  "wake_visual",
  "trailer_video",
  "game_board_theme",
  "game_piece_set",
]);

export const SPIRITCORE_MEDIA_LIFECYCLE_STATES = Object.freeze([
  "draft",
  "generated",
  "review_required",
  "approved",
  "rejected",
  "promoted",
  "active",
  "archived",
  "failed",
]);

export const SPIRITCORE_MEDIA_REVIEW_STATUSES = Object.freeze([
  "not_started",
  "pending",
  "identity_review",
  "safety_review",
  "approved",
  "rejected",
]);

export const SPIRITCORE_MEDIA_PROMOTION_STATUSES = Object.freeze([
  "not_requested",
  "planned",
  "operator_approved",
  "promoted",
  "rolled_back",
]);

const VIDEO_KINDS = new Set([
  "spiritgate_video",
  "idle_video",
  "speaking_video",
  "listening_video",
  "greeting_video",
  "trailer_video",
]);

const TARGET_TYPES = new Set(["spiritkin", "premium_spiritkin", "realm", "spiritgate", "game", "wake_presence"]);

const ASSET_KIND_ALIASES = Object.freeze({
  hero_image: "hero",
  fullbody: "full_body",
  full_body: "full_body",
  presence: "presence_indicator",
  presence_indicator: "presence_indicator",
  realm: "realm_background",
  realmbackground: "realm_background",
  realm_background: "realm_background",
  room: "room_background",
  room_background: "room_background",
  gateway: "gateway_background",
  gateway_background: "gateway_background",
  spiritgate: "spiritgate_video",
  spiritgate_video: "spiritgate_video",
  idle: "idle_video",
  idle_video: "idle_video",
  speaking: "speaking_video",
  speaking_video: "speaking_video",
  listening: "listening_video",
  listening_video: "listening_video",
  greeting: "greeting_video",
  greeting_video: "greeting_video",
  wake: "wake_visual",
  wake_visual: "wake_visual",
  trailer: "trailer_video",
  trailer_video: "trailer_video",
  gameboard: "game_board_theme",
  game_board: "game_board_theme",
  game_board_theme: "game_board_theme",
  pieces: "game_piece_set",
  game_piece: "game_piece_set",
  game_piece_set: "game_piece_set",
});

export const SPIRITCORE_MEDIA_REQUIREMENT_PROFILES = Object.freeze({
  original_spiritkin: {
    id: "original_spiritkin",
    label: "Original Spiritkin",
    targetType: "spiritkin",
    requiredAssetKinds: ["portrait", "hero", "presence_indicator", "idle_video", "speaking_video", "listening_video", "greeting_video", "trailer_video"],
    recommendedAssetKinds: ["full_body", "room_background", "wake_visual"],
    activeMinimum: ["portrait", "hero"],
  },
  premium_spiritkin: {
    id: "premium_spiritkin",
    label: "Premium User-Created Spiritkin",
    targetType: "premium_spiritkin",
    requiredAssetKinds: ["portrait", "hero", "full_body", "icon", "presence_indicator", "idle_video", "speaking_video", "listening_video", "greeting_video", "wake_visual"],
    recommendedAssetKinds: ["room_background", "trailer_video"],
    activeMinimum: ["portrait", "icon", "presence_indicator"],
  },
  spiritgate_realm: {
    id: "spiritgate_realm",
    label: "SpiritGate / Realm",
    targetType: "spiritgate",
    requiredAssetKinds: ["gateway_background", "spiritgate_video", "realm_background"],
    recommendedAssetKinds: ["trailer_video", "presence_indicator"],
    activeMinimum: ["gateway_background", "spiritgate_video"],
  },
  game_assets: {
    id: "game_assets",
    label: "Game Assets",
    targetType: "game",
    requiredAssetKinds: ["game_board_theme", "game_piece_set"],
    recommendedAssetKinds: ["presence_indicator"],
    activeMinimum: ["game_board_theme", "game_piece_set"],
  },
  wake_presence: {
    id: "wake_presence",
    label: "Wake and Living Presence",
    targetType: "wake_presence",
    requiredAssetKinds: ["wake_visual", "presence_indicator", "listening_video", "speaking_video", "idle_video"],
    recommendedAssetKinds: ["greeting_video", "room_background"],
    activeMinimum: ["presence_indicator", "idle_video"],
  },
});

export const SPIRITCORE_ASSISTANT_CAPABILITY_ROADMAP = Object.freeze([
  { id: "alarms", label: "Alarms", scope: "capability_pack", mediaDependency: "wake_visual" },
  { id: "reminders", label: "Reminders", scope: "capability_pack", mediaDependency: "presence_indicator" },
  { id: "daily_routines", label: "Daily Routines", scope: "capability_pack", mediaDependency: "greeting_video" },
  { id: "music_audio", label: "Music and Audio Actions", scope: "integration_pack", mediaDependency: "speaking_video" },
  { id: "calendar", label: "Calendar Support", scope: "integration_pack", mediaDependency: "presence_indicator" },
  { id: "tasks", label: "Task Support", scope: "capability_pack", mediaDependency: "presence_indicator" },
  { id: "smart_home", label: "Future Smart Home", scope: "future_integration", mediaDependency: "wake_visual" },
  { id: "family_safe_companion", label: "Family-Safe Companion", scope: "safety_pack", mediaDependency: "listening_video" },
  { id: "learning_play", label: "Learning and Play Modes", scope: "experience_pack", mediaDependency: "game_board_theme" },
  { id: "games_entertainment", label: "Games and Entertainment", scope: "experience_pack", mediaDependency: "game_piece_set" },
  { id: "emotional_checkins", label: "Emotional Check-Ins", scope: "companion_pack", mediaDependency: "presence_indicator" },
]);

export const SPIRITCORE_PRODUCTION_SEQUENCE_TYPES = Object.freeze([
  "spiritgate_enhancement",
  "original_motion_pack",
  "premium_spiritkin_starter_pack",
]);

export const ORIGINAL_SPIRITKIN_MOTION_PACK_TARGETS = Object.freeze([
  "Lyra",
  "Raien",
  "Kairo",
  "Elaria",
  "Thalassar",
]);

export const ORIGINAL_MOTION_PACK_ASSET_KINDS = Object.freeze([
  "idle_video",
  "speaking_video",
  "listening_video",
  "greeting_video",
  "wake_visual",
  "trailer_video",
  "presence_indicator",
]);

export const PREMIUM_SPIRITKIN_STARTER_PACK_ASSET_KINDS = Object.freeze([
  "portrait",
  "hero",
  "full_body",
  "icon",
  "presence_indicator",
  "room_background",
  "idle_video",
  "speaking_video",
  "greeting_video",
  "wake_visual",
]);

export const SOURCE_MEDIA_TYPES = Object.freeze([
  "uploaded_video",
  "uploaded_image",
  "existing_asset",
  "external_url",
]);

export const PREMIUM_MEMBER_GENERATION_BOUNDARY = Object.freeze({
  enabled: false,
  reason: "Premium member generation remains disabled until creation, moderation, budget, review, storage, and user-status systems are complete.",
  readinessChecklist: [
    "user creation form",
    "safety moderation",
    "style governance",
    "generation budget/credit limits",
    "starter asset pack requirements",
    "failed generation recovery",
    "review/approval mode",
    "storage strategy",
    "voice/wake/motion completeness",
    "user-facing status messaging",
  ],
});

export const COMMAND_CENTER_GENERATOR_READINESS = Object.freeze({
  exists: true,
  route: "/command-center",
  generatorTab: true,
  imageGeneratorControls: true,
  videoGeneratorControls: true,
  generationJobUi: true,
  providerModelSelection: false,
  promptBox: true,
  statusPolling: false,
  outputReview: true,
  assetPromotionControls: false,
  spiritGateSpecificControls: false,
  reusableForA14: [
    "generator provider status display",
    "video job form pattern",
    "generation history list",
    "review queue controls",
  ],
  connectLater: [
    "SpiritGate source summary",
    "SpiritGate enhancement payload preview",
    "operator approval checkbox",
    "status-check polling for providerJobId",
    "media review plan creation",
  ],
});

const GENERATION_TEMPLATES = Object.freeze({
  spiritgate_enhancement: {
    id: "spiritgate_enhancement",
    assetKind: "spiritgate_video",
    intent: "Enhance the existing SpiritGate entrance without replacing its identity.",
  },
  realm_background: {
    id: "realm_background",
    assetKind: "realm_background",
    intent: "Create a premium cinematic realm background for an immersive Spiritverse space.",
  },
  bonded_room_background: {
    id: "bonded_room_background",
    assetKind: "room_background",
    intent: "Create a bonded room background that feels personal, calm, and returnable.",
  },
  spiritkin_portrait_upgrade: {
    id: "spiritkin_portrait_upgrade",
    assetKind: "portrait",
    intent: "Upgrade a Spiritkin portrait while preserving canonical identity.",
  },
  idle_loop: {
    id: "idle_loop",
    assetKind: "idle_video",
    intent: "Create a subtle idle loop for living companion presence.",
  },
  speaking_loop: {
    id: "speaking_loop",
    assetKind: "speaking_video",
    intent: "Create a gentle speaking loop suitable for text and voice response states.",
  },
  listening_loop: {
    id: "listening_loop",
    assetKind: "listening_video",
    intent: "Create a listening loop that feels attentive without implying background surveillance.",
  },
  greeting_loop: {
    id: "greeting_loop",
    assetKind: "greeting_video",
    intent: "Create a greeting loop for re-entry, onboarding, and bonded return moments.",
  },
  wake_call_visual: {
    id: "wake_call_visual",
    assetKind: "wake_visual",
    intent: "Create a non-intrusive visual for a wake call or reminder moment.",
  },
  trailer_intro: {
    id: "trailer_intro",
    assetKind: "trailer_video",
    intent: "Create a memorable cinematic intro trailer for a Spiritkin or realm.",
  },
  presence_indicator: {
    id: "presence_indicator",
    assetKind: "presence_indicator",
    intent: "Create a compact premium visual state indicator for presence, listening, speaking, and idle modes.",
  },
  game_board_theme: {
    id: "game_board_theme",
    assetKind: "game_board_theme",
    intent: "Create a board theme that carries Spiritverse atmosphere without reducing gameplay clarity.",
  },
  game_piece_set: {
    id: "game_piece_set",
    assetKind: "game_piece_set",
    intent: "Create a consistent game piece set that reads clearly at small sizes.",
  },
});

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value, max = 600) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function slugify(value, fallback = "media") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function canonicalize(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeSequenceType(value) {
  const normalized = canonicalize(value);
  return SPIRITCORE_PRODUCTION_SEQUENCE_TYPES.includes(normalized) ? normalized : "";
}

export function normalizeSpiritCoreMediaAssetKind(kind) {
  const normalized = canonicalize(kind);
  const compact = normalized.replace(/_/g, "");
  const resolved = ASSET_KIND_ALIASES[normalized] || ASSET_KIND_ALIASES[compact] || normalized;
  return SPIRITCORE_MEDIA_ASSET_KINDS.includes(resolved) ? resolved : "";
}

export function mediaTypeForAssetKind(assetKind) {
  return VIDEO_KINDS.has(assetKind) ? "video" : "image";
}

function normalizeTargetType(value, assetKind = "") {
  const raw = canonicalize(value);
  if (TARGET_TYPES.has(raw)) return raw;
  if (assetKind === "spiritgate_video" || assetKind === "gateway_background") return "spiritgate";
  if (assetKind === "realm_background" || assetKind === "room_background") return "realm";
  if (assetKind === "game_board_theme" || assetKind === "game_piece_set") return "game";
  if (assetKind === "wake_visual" || assetKind === "presence_indicator") return "wake_presence";
  return "spiritkin";
}

function familyPathFor(record = {}) {
  const targetSlug = slugify(record.targetId || record.spiritkinId, "target");
  if (record.targetType === "realm") return `realms/${targetSlug}`;
  if (record.targetType === "spiritgate") return `spiritgate/${targetSlug}`;
  if (record.targetType === "game") return `games/${targetSlug}`;
  if (record.targetType === "wake_presence") return `presence/${targetSlug}`;
  if (record.targetType === "premium_spiritkin") return `premium-spiritkins/${targetSlug}`;
  return `spiritkins/${targetSlug}`;
}

function extensionForAssetKind(assetKind) {
  return VIDEO_KINDS.has(assetKind) ? "mp4" : "png";
}

function versionTagFor(input = {}) {
  return slugify(input.versionTag || input.providerJobId || `media-${Date.now()}`, "media-version");
}

function normalizeSourceMediaType(value) {
  const normalized = canonicalize(value);
  return SOURCE_MEDIA_TYPES.includes(normalized) ? normalized : "";
}

function providerCompatibilityForSource(sourceType, assetKind = "") {
  const mediaType = mediaTypeForAssetKind(assetKind);
  return {
    runway: {
      textToImage: sourceType === "uploaded_image" || sourceType === "external_url" || sourceType === "existing_asset",
      imageToVideo: mediaType === "video" && (sourceType === "uploaded_image" || sourceType === "external_url" || sourceType === "existing_asset"),
      videoToVideo: mediaType === "video" && (sourceType === "uploaded_video" || sourceType === "external_url" || sourceType === "existing_asset"),
      recommendedMode: assetKind === "spiritgate_video" ? "video_to_video" : (mediaType === "video" ? "image_to_video" : "text_to_image"),
      recommendedModel: assetKind === "spiritgate_video" ? "gen4_aleph" : (mediaType === "video" ? "gen4_turbo" : "gen4_image"),
    },
  };
}

export function buildSourceMediaReference(input = {}) {
  const sourceType = normalizeSourceMediaType(input.sourceType || input.sourceAssetType);
  const assetKind = normalizeSpiritCoreMediaAssetKind(input.assetKind || "spiritgate_video");
  const sourceUrl = normalizeText(input.sourceUrl || input.url, 1200);
  const storagePath = normalizeText(input.storagePath || input.sourceAssetRef || input.sourcePath, 1200);
  const targetId = normalizeText(input.targetId || "spiritgate", 160);
  const targetType = normalizeTargetType(input.targetType, assetKind);

  return {
    sourceAssetId: normalizeText(input.sourceAssetId, 160) || `src_${slugify(targetId)}_${slugify(assetKind)}_${Date.now()}`,
    targetId,
    targetType,
    assetKind,
    sourceType,
    sourceUrl: sourceUrl || null,
    storagePath: storagePath || null,
    providerCompatibility: providerCompatibilityForSource(sourceType, assetKind),
    uploadedAt: normalizeText(input.uploadedAt, 80) || nowIso(),
    notes: normalizeText(input.notes, 1200),
    approvedForReference: Boolean(input.approvedForReference),
    usageRestrictions: Array.isArray(input.usageRestrictions)
      ? input.usageRestrictions.map((item) => normalizeText(item, 240)).filter(Boolean)
      : ["operator_review_only", "do_not_replace_original", "no_public_promotion_without_approval"],
  };
}

export function validateSourceMediaReference(record = {}) {
  const errors = [];
  if (!record.sourceAssetId) errors.push("sourceAssetId is required");
  if (!record.targetId) errors.push("targetId is required");
  if (!record.assetKind || !SPIRITCORE_MEDIA_ASSET_KINDS.includes(record.assetKind)) errors.push("assetKind must be supported");
  if (!record.sourceType || !SOURCE_MEDIA_TYPES.includes(record.sourceType)) errors.push("sourceType must be uploaded_video, uploaded_image, existing_asset, or external_url");
  if (!record.sourceUrl && !record.storagePath) errors.push("sourceUrl or storagePath is required");
  return { ok: errors.length === 0, errors };
}

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

export function resolveExistingSpiritGateSource(input = {}) {
  const gate = SPIRITGATE_RUNTIME_MEDIA.gate || {};
  const currentPath = normalizeText(gate.path || "/videos/gate_entrance_final.mp4", 600);
  const fileName = normalizeText(gate.fileName || "gate_entrance_final.mp4", 200);
  const sourceAssetId = "existing-pika-spiritgate-video";
  const origin = normalizeOrigin(input.origin || input.publicOrigin || input.stagingOrigin);
  const publicUrl = origin && currentPath.startsWith("/")
    ? `${origin}${currentPath}`
    : "";
  const sourceAssetRef = publicUrl || currentPath;
  const sourceAssetType = publicUrl && publicUrl.startsWith("https://")
    ? "external_url"
    : "existing_asset";
  const canUseForRunwayVideoToVideo = /^https:\/\/.+/i.test(sourceAssetRef)
    || /^runway:\/\/.+/i.test(sourceAssetRef)
    || /^data:video\//i.test(sourceAssetRef);
  const missingRequirements = [];
  if (!currentPath) missingRequirements.push("SpiritGate runtime media path is missing");
  if (!canUseForRunwayVideoToVideo) {
    missingRequirements.push("Runway video-to-video requires an HTTPS, Runway, or data video URI; current source is local/public path only");
  }

  return {
    ok: Boolean(currentPath),
    sourceAssetId,
    targetId: "spiritgate",
    targetType: "spiritgate",
    assetKind: "spiritgate_video",
    sourceAssetRef,
    sourceAssetType,
    currentPath,
    fileName,
    localFilePath: `spiritkins-app/public/videos/${fileName}`,
    frontendPath: currentPath,
    publicUrl: publicUrl || null,
    providerCompatibility: providerCompatibilityForSource(sourceAssetType, "spiritgate_video"),
    canUseForRunwayVideoToVideo,
    missingRequirements,
    frontendUsage: {
      runtimeConfig: "SPIRITGATE_RUNTIME_MEDIA.gate.path",
      appVideoSource: "<source src=\"/videos/gate_entrance_final.mp4\" type=\"video/mp4\">",
      serverRoute: "GET /videos/:filename",
    },
    commandCenterGeneratorReadiness: COMMAND_CENTER_GENERATOR_READINESS,
    notes: canUseForRunwayVideoToVideo
      ? "Current SpiritGate source can be passed to Runway as a video-to-video source when this HTTPS URL is reachable from Runway."
      : "Use the existing /videos/gate_entrance_final.mp4 asset through the current staging HTTPS static route; do not create a new storage system first.",
    noFileWrites: true,
    noManifestUpdates: true,
    noActiveWrites: true,
  };
}

export function createSpiritGateEnhancementPlanFromCurrentSource(input = {}) {
  const source = resolveExistingSpiritGateSource(input);
  const promptIntent = normalizeText(input.promptIntent || [
    "Enhance the existing SpiritGate entrance video without replacing its identity.",
    "Preserve the recognizable source concept, gateway silhouette, threshold feeling, and Spiritverse arrival energy.",
    "Improve quality, cinematic polish, lighting, clarity, dimensionality, atmosphere, and premium feel.",
  ].join(" "), 1000);
  const styleProfile = normalizeText(input.styleProfile || "premium cinematic cosmic fantasy, luxury black and gold, subtle apple red accents, ivory highlights, Spiritverse gateway identity", 320);
  const safetyLevel = normalizeText(input.safetyLevel || "internal_review", 80);
  const readyToRunPayload = {
    targetId: "spiritgate",
    sourceAssetRef: source.sourceAssetRef,
    sourceAssetType: source.sourceAssetType,
    promptIntent,
    styleProfile,
    safetyLevel,
    operatorApproval: true,
  };
  const executionPlan = createSpiritGateEnhancementExecutionPlan({
    ...readyToRunPayload,
    sourceAssetId: source.sourceAssetId,
  });
  return {
    ok: true,
    source,
    readyToRunPayload,
    finalOptimizedPrompt: [
      "Enhance the existing SpiritGate entrance video without replacing its identity.",
      "Preserve the recognizable source concept, timing, gateway silhouette, threshold feeling, and Spiritverse arrival energy from the current in-app SpiritGate video.",
      "Improve quality, cinematic polish, lighting, clarity, dimensionality, atmosphere, and premium feel.",
      "Create a luxury black-and-gold cosmic fantasy gateway with subtle apple red accents and ivory highlights.",
      "Keep the scene elegant and readable on mobile and desktop.",
      "No text overlays, logos, watermarks, gore, sexualized framing, distorted geometry, identity drift, noisy UI elements, cheap stock aesthetic, or replacement of the current SpiritGate identity.",
    ].join(" "),
    modelToolRecommendation: "Runway video_to_video with gen4_aleph",
    reviewChecklist: [
      "existing SpiritGate source remains recognizable",
      "quality, lighting, dimensionality, clarity, and atmosphere improve without replacement",
      "gateway scene compatibility is preserved",
      "mobile and desktop framing remain readable",
      "provider job id, source reference, prompt, and output URL are captured before review",
      "operator review passes before any promotion plan",
    ],
    rejectionCriteria: [
      "source SpiritGate concept is no longer recognizable",
      "output behaves like replacement rather than enhancement",
      "gateway scene compatibility is broken",
      "watermarks, logos, subtitles, or text overlays",
      "generic portal, horror, sci-fi machinery, or stock-footage aesthetic",
      "missing source reference or provider metadata",
    ],
    operatorApprovalRequired: true,
    canUseForRunwayVideoToVideo: source.canUseForRunwayVideoToVideo,
    missingRequirements: source.missingRequirements,
    executionPlan,
    noGenerationPerformed: true,
    noProviderCall: true,
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
  };
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function segmentPurpose(index, totalSegments) {
  if (index === 0) return "Gate awakening / first reveal";
  if (index === totalSegments - 1) return "Spiritverse reveal / arrival settle";
  if (index === totalSegments - 2) return "Crossing into Spiritverse";
  if (index === totalSegments - 3) return "Final approach";
  if (index === 1) return "Approach / energy build";
  if (index === 2) return "Threshold formation";
  return "Deepening portal / dimensional movement";
}

function segmentPrompt({ purpose, index, totalSegments, styleProfile, endingNeedsTransitionImprovement }) {
  const common = [
    `Enhance SpiritGate segment ${index + 1} of ${totalSegments}: ${purpose}.`,
    "Preserve the existing SpiritGate source identity, gateway silhouette, timing feel, luxury black-and-gold atmosphere, subtle apple red accents, and ivory highlights.",
    `Style profile: ${styleProfile}.`,
    "Improve cinematic polish, clarity, lighting, dimensionality, motion fluency, and premium emotional presence without replacing the source concept.",
    "No text overlays, logos, watermarks, horror shift, generic portal look, noisy UI elements, identity drift, or abrupt visual discontinuity.",
  ];
  if (index === 0) {
    common.push("Open with a clear awakening of the gate: elegant, anticipatory, readable, and faithful to the current entrance.");
  } else if (index === totalSegments - 1) {
    common.push("This final arrival segment must improve flow into the Spiritverse, create a smoother threshold crossing, resolve motion gracefully, feel emotionally complete, preserve visual continuity, and avoid an abrupt ending.");
  } else if (index === totalSegments - 2 || endingNeedsTransitionImprovement) {
    common.push("Strengthen the crossing transition: make the movement into the Spiritverse more fluent, dimensional, and emotionally satisfying while preserving continuity from the prior segment.");
  } else {
    common.push("Maintain continuity from the prior segment and prepare a clean transition into the next segment.");
  }
  return common.join(" ");
}

export function createSpiritGateSegmentPlan(input = {}) {
  const targetId = normalizeText(input.targetId || "spiritgate", 160);
  if (!["spiritgate", "test-spiritgate"].includes(targetId)) {
    throw new ValidationError("Invalid SpiritGate segment target.", ["targetId must be spiritgate or test-spiritgate"]);
  }
  const sourceAssetRef = normalizeText(input.sourceAssetRef, 1200);
  if (!sourceAssetRef) {
    throw new ValidationError("Invalid SpiritGate segment source.", ["sourceAssetRef is required"]);
  }
  const sourceDurationSec = clampNumber(input.sourceDurationSec, 35, 1, 600);
  const segmentDurationSec = clampNumber(input.segmentDurationSec, 5, 1, 10);
  const styleProfile = normalizeText(input.styleProfile || "premium cinematic cosmic fantasy, luxury black and gold, subtle apple red accents, ivory highlights, Spiritverse gateway identity", 320);
  const safetyLevel = normalizeText(input.safetyLevel || "internal_review", 80);
  const endingNeedsTransitionImprovement = input.endingNeedsTransitionImprovement !== false;
  const totalSegments = Math.ceil(sourceDurationSec / segmentDurationSec);
  const segments = Array.from({ length: totalSegments }, (_, index) => {
    const startTimeSec = Number((index * segmentDurationSec).toFixed(3));
    const endTimeSec = Number(Math.min(sourceDurationSec, (index + 1) * segmentDurationSec).toFixed(3));
    const purpose = segmentPurpose(index, totalSegments);
    const finalSegment = index === totalSegments - 1;
    const crossingSegment = index >= Math.max(0, totalSegments - 2);
    return {
      segmentIndex: index + 1,
      startTimeSec,
      endTimeSec,
      durationSec: Number((endTimeSec - startTimeSec).toFixed(3)),
      purpose,
      promptIntent: segmentPrompt({ purpose, index, totalSegments, styleProfile, endingNeedsTransitionImprovement }),
      continuityRequirements: [
        "preserve source SpiritGate identity",
        "match color, lighting direction, gateway shape, and motion energy with adjacent segments",
        "avoid visible jumps at segment boundaries",
        "keep mobile and desktop framing readable",
      ],
      transitionRequirements: finalSegment
        ? ["smooth threshold crossing", "emotional arrival settle", "no abrupt ending", "clear Spiritverse arrival cue"]
        : ["first and last frames should stitch cleanly with neighboring segments", "avoid sudden style or camera changes"],
      enhancementMode: crossingSegment && endingNeedsTransitionImprovement ? "transition-improvement" : "enhancement-only",
      estimatedRunwayCost: null,
      reviewStatus: "not_started",
      lifecycleState: "review_required",
    };
  });

  return {
    ok: true,
    segmentPlanId: `spiritgate_segment_plan_${Date.now()}`,
    targetId,
    sourceAssetRef,
    sourceDurationSec,
    segmentDurationSec,
    totalSegments,
    segments,
    estimatedGenerationCount: totalSegments,
    estimatedCreditRange: null,
    continuityRules: [
      "use the existing SpiritGate video as source of truth",
      "generate one approved test segment before running the rest",
      "preserve gateway identity, color palette, camera language, and emotional tone",
      "review every segment before stitching",
      "reject segments with identity drift, abrupt endings, watermarks, or broken continuity",
    ],
    finalEntranceStrategy: {
      endingNeedsTransitionImprovement,
      goal: "make the final entrance smoother, more fluent, more cinematic, and emotionally complete",
      finalSegments: segments.slice(Math.max(0, totalSegments - 2)).map((segment) => segment.segmentIndex),
      noAbruptEnding: true,
    },
    wasteControlPlan: {
      firstSegmentOnly: true,
      firstRecommendedSegmentIndex: 1,
      firstRecommendedReason: "Validate Aleph style fidelity, source preservation, and clip quality before spending on the remaining segments.",
      stopConditions: [
        "source identity drifts",
        "motion becomes unstable or visibly synthetic",
        "gateway no longer matches Spiritverse identity",
        "segment cannot stitch cleanly",
        "credit use exceeds operator-approved budget",
      ],
      continueOnlyAfterReviewApproval: true,
      trackCreditsPerSegment: true,
    },
    reviewChecklist: [
      "segment preserves original SpiritGate identity",
      "quality improves without replacement",
      "first and last frames support stitching",
      "no text, watermark, logo, or generic portal shift",
      "final crossing has smooth emotional arrival",
      "operator approves segment before next generation",
    ],
    rejectionCriteria: [
      "identity drift",
      "abrupt segment boundary",
      "weaker ending than source",
      "generic or off-brand portal",
      "watermark, subtitle, logo, or visible artifact",
      "cannot stitch with adjacent reviewed segments",
    ],
    stitchPlan: {
      implementationStatus: "planned_only",
      requiresFfmpeg: true,
      enhancedClipsRemainReviewRequired: true,
      eachSegmentReviewedBeforeStitch: true,
      approvedSegmentsStitchedInOrder: true,
      finalFullLengthVideoLifecycleState: "review_required",
      operatorApprovalRequiredBeforeManifestOrActive: true,
      noStitchingPerformed: true,
    },
    premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
    noGenerationPerformed: true,
    noProviderCall: true,
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
  };
}

export function buildMediaAssetRecord(input = {}) {
  const assetKind = normalizeSpiritCoreMediaAssetKind(input.assetKind);
  const targetType = normalizeTargetType(input.targetType, assetKind);
  const targetId = normalizeText(input.targetId || input.spiritkinId || input.realmId || input.gameType || "spiritgate", 160);
  const versionTag = versionTagFor(input);
  const familyPath = familyPathFor({ targetType, targetId, spiritkinId: input.spiritkinId });
  const artifactFileName = normalizeText(input.artifactFileName || `artifact.${extensionForAssetKind(assetKind)}`, 120);

  return {
    assetId: normalizeText(input.assetId, 120) || randomUUID(),
    spiritkinId: normalizeText(input.spiritkinId, 160) || (targetType.includes("spiritkin") ? targetId : null),
    targetId,
    targetType,
    assetKind,
    mediaType: mediaTypeForAssetKind(assetKind),
    lifecycleState: normalizeText(input.lifecycleState || "draft", 40),
    reviewStatus: normalizeText(input.reviewStatus || "not_started", 40),
    promotionStatus: normalizeText(input.promotionStatus || "not_requested", 40),
    activeStatus: normalizeText(input.activeStatus || "inactive", 40),
    provider: normalizeText(input.provider || "runway", 40),
    providerJobId: normalizeText(input.providerJobId, 160) || null,
    sourceAssetRefs: Array.isArray(input.sourceAssetRefs) ? input.sourceAssetRefs.map((item) => normalizeText(item, 600)).filter(Boolean) : [],
    promptIntent: normalizeText(input.promptIntent, 1000),
    styleProfile: normalizeText(input.styleProfile || "spiritverse_premium_cinematic", 240),
    safetyLevel: normalizeText(input.safetyLevel || "internal_review", 80),
    outputUrls: Array.isArray(input.outputUrls) ? input.outputUrls.map((item) => normalizeText(item, 1200)).filter(Boolean) : [],
    publicPath: normalizeText(input.publicPath, 600) || `/app/assets/generated/${familyPath}/${assetKind}/${versionTag}/${artifactFileName}`,
    activePath: normalizeText(input.activePath, 600) || `Spiritverse_MASTER_ASSETS/ACTIVE/generated/${familyPath}/${assetKind}/${versionTag}/${artifactFileName}`,
    reviewPath: normalizeText(input.reviewPath, 600) || `Spiritverse_MASTER_ASSETS/REVIEW/generated/${familyPath}/${assetKind}/${versionTag}/${artifactFileName}`,
    metadataPath: normalizeText(input.metadataPath, 600) || `Spiritverse_MASTER_ASSETS/REVIEW/generated/${familyPath}/${assetKind}/${versionTag}/metadata.json`,
    approvedPath: `Spiritverse_MASTER_ASSETS/APPROVED/generated/${familyPath}/${assetKind}/${versionTag}/${artifactFileName}`,
    rollbackPath: `Spiritverse_MASTER_ASSETS/ARCHIVE/generated/${familyPath}/${assetKind}/${versionTag}/${artifactFileName}`,
    versionTag,
    familyPath,
    artifactFileName,
    createdAt: normalizeText(input.createdAt, 80) || nowIso(),
    updatedAt: normalizeText(input.updatedAt, 80) || nowIso(),
    reviewedAt: normalizeText(input.reviewedAt, 80) || null,
    promotedAt: normalizeText(input.promotedAt, 80) || null,
    rollbackFromAssetId: normalizeText(input.rollbackFromAssetId, 120) || null,
    notes: normalizeText(input.notes, 1200),
  };
}

export function validateMediaAssetRecord(record = {}) {
  const errors = [];
  if (!record.assetId) errors.push("assetId is required");
  if (!record.targetId) errors.push("targetId or spiritkinId is required");
  if (!record.assetKind || !SPIRITCORE_MEDIA_ASSET_KINDS.includes(record.assetKind)) {
    errors.push("assetKind must be a supported SpiritCore media asset kind");
  }
  if (!TARGET_TYPES.has(record.targetType)) errors.push("targetType is invalid");
  if (!SPIRITCORE_MEDIA_LIFECYCLE_STATES.includes(record.lifecycleState)) errors.push("lifecycleState is invalid");
  if (!SPIRITCORE_MEDIA_REVIEW_STATUSES.includes(record.reviewStatus)) errors.push("reviewStatus is invalid");
  if (!SPIRITCORE_MEDIA_PROMOTION_STATUSES.includes(record.promotionStatus)) errors.push("promotionStatus is invalid");
  return { ok: errors.length === 0, errors };
}

export function getRequirementProfile(profileId = "original_spiritkin") {
  const normalized = canonicalize(profileId || "original_spiritkin");
  const profile = SPIRITCORE_MEDIA_REQUIREMENT_PROFILES[normalized];
  if (!profile) {
    throw new ValidationError("Unknown media requirement profile.", [`profileId must be one of ${Object.keys(SPIRITCORE_MEDIA_REQUIREMENT_PROFILES).join(", ")}`]);
  }
  return profile;
}

function assetMatchesRequiredState(asset = {}) {
  return asset.activeStatus === "active"
    || asset.lifecycleState === "active"
    || (asset.reviewStatus === "approved" && ["approved", "promoted"].includes(asset.promotionStatus));
}

export function checkMediaRequirements(input = {}) {
  const profile = getRequirementProfile(input.profileId || input.profile || "original_spiritkin");
  const assets = Array.isArray(input.assets) ? input.assets.map((asset) => buildMediaAssetRecord(asset)) : [];
  const byKind = new Map();
  for (const asset of assets) {
    if (!byKind.has(asset.assetKind)) byKind.set(asset.assetKind, []);
    byKind.get(asset.assetKind).push(asset);
  }

  const required = profile.requiredAssetKinds.map((assetKind) => {
    const candidates = byKind.get(assetKind) || [];
    return {
      assetKind,
      present: candidates.length > 0,
      active: candidates.some(assetMatchesRequiredState),
      draftOnly: candidates.length > 0 && candidates.every((asset) => asset.lifecycleState === "draft"),
      awaitingReview: candidates.some((asset) => asset.lifecycleState === "review_required" || asset.reviewStatus === "pending"),
      readyForPromotion: candidates.some((asset) => asset.reviewStatus === "approved" && asset.promotionStatus === "planned"),
      activeAssetIds: candidates.filter(assetMatchesRequiredState).map((asset) => asset.assetId),
    };
  });

  return {
    ok: true,
    profile,
    targetId: normalizeText(input.targetId || input.spiritkinId, 160),
    missingRequiredAssets: required.filter((item) => !item.present).map((item) => item.assetKind),
    draftOnlyAssets: required.filter((item) => item.draftOnly).map((item) => item.assetKind),
    awaitingReviewAssets: required.filter((item) => item.awaitingReview).map((item) => item.assetKind),
    readyForPromotionAssets: required.filter((item) => item.readyForPromotion).map((item) => item.assetKind),
    activeAssets: required.filter((item) => item.active).map((item) => item.assetKind),
    incompletePremiumSpiritkin: profile.id === "premium_spiritkin" && required.some((item) => !item.active),
    required,
    noBehaviorBlock: true,
  };
}

function identityLine(input = {}) {
  return [
    input.spiritkinName ? `Spiritkin name: ${normalizeText(input.spiritkinName, 120)}.` : "",
    input.spiritkinRole ? `Role: ${normalizeText(input.spiritkinRole, 160)}.` : "",
    input.visualIdentity ? `Visual identity: ${normalizeText(input.visualIdentity, 600)}.` : "",
    input.loreSummary ? `Lore summary: ${normalizeText(input.loreSummary, 800)}.` : "",
    input.colorPalette ? `Color palette: ${normalizeText(input.colorPalette, 240)}.` : "",
    input.emotionalTone ? `Emotional tone: ${normalizeText(input.emotionalTone, 240)}.` : "",
  ].filter(Boolean).join(" ");
}

export function buildGenerationTemplate(input = {}) {
  const assetKind = normalizeSpiritCoreMediaAssetKind(input.assetKind);
  const templateId = canonicalize(input.templateId || input.template || "");
  const template = GENERATION_TEMPLATES[templateId]
    || Object.values(GENERATION_TEMPLATES).find((item) => item.assetKind === assetKind)
    || GENERATION_TEMPLATES.spiritkin_portrait_upgrade;
  const normalizedAssetKind = assetKind || template.assetKind;
  const references = Array.isArray(input.referenceAssets) ? input.referenceAssets.map((item) => normalizeText(item, 600)).filter(Boolean) : [];
  const prompt = [
    template.intent,
    identityLine(input),
    `Asset kind: ${normalizedAssetKind}.`,
    `Style profile: ${normalizeText(input.styleProfile || "premium cinematic Spiritverse, emotionally intelligent, magical but grounded", 320)}.`,
    `Safety level: ${normalizeText(input.safetyLevel || "internal_review", 80)}.`,
    references.length ? `Use approved reference assets for continuity: ${references.join(", ")}.` : "No approved reference assets were attached; preserve canon conservatively and require manual review.",
    "Avoid text overlays, watermarks, brand marks, gore, sexualized framing, identity drift, cheap stock aesthetics, and noisy UI-like composition.",
    "The result should feel original to the Spiritverse: premium, memorable, emotionally intelligent, and suitable for operator review before promotion.",
  ].filter(Boolean).join(" ");

  return {
    ok: true,
    templateId: template.id,
    assetKind: normalizedAssetKind,
    mediaType: mediaTypeForAssetKind(normalizedAssetKind),
    prompt,
    negativePrompt: normalizeText(input.negativePrompt, 600) || "identity drift, watermark, subtitle burn-in, distorted anatomy, low detail, unsafe framing, off-brand fantasy montage",
    referenceAssets: references,
    providerCall: false,
  };
}

export function resolveContinuityReferences(input = {}) {
  const assets = Array.isArray(input.assets) ? input.assets.map((asset) => buildMediaAssetRecord(asset)) : [];
  const usable = assets.filter((asset) => {
    if (["rejected", "archived", "failed"].includes(asset.lifecycleState)) return false;
    if (asset.reviewStatus === "rejected") return false;
    return asset.activeStatus === "active" || asset.reviewStatus === "approved" || asset.lifecycleState === "active";
  });

  const imageRefs = usable.filter((asset) => asset.mediaType === "image");
  const environmentRefs = usable.filter((asset) => ["realm_background", "room_background", "gateway_background"].includes(asset.assetKind));
  const motionRefs = usable.filter((asset) => asset.mediaType === "video");
  const canonical = imageRefs.find((asset) => ["portrait", "hero", "full_body"].includes(asset.assetKind)) || imageRefs[0] || null;

  return {
    primaryCanonicalReference: canonical,
    approvedIdentityReferences: imageRefs.filter((asset) => ["portrait", "hero", "full_body", "icon"].includes(asset.assetKind)),
    approvedRoomEnvironmentReferences: environmentRefs,
    priorActiveMotionAssets: motionRefs.filter((asset) => asset.activeStatus === "active" || asset.lifecycleState === "active"),
    sourceAssetsUsed: assets.filter((asset) => asset.sourceAssetRefs.length || asset.outputUrls.length),
    excludedAssetIds: assets.filter((asset) => !usable.includes(asset)).map((asset) => asset.assetId),
  };
}

export function createMediaAssetPlan(input = {}) {
  const record = buildMediaAssetRecord(input);
  const validation = validateMediaAssetRecord(record);
  if (!validation.ok) {
    throw new ValidationError("Invalid SpiritCore media asset plan.", validation.errors);
  }
  const continuity = resolveContinuityReferences({ assets: input.existingAssets || input.assets || [] });
  const template = buildGenerationTemplate({
    ...input,
    assetKind: record.assetKind,
    referenceAssets: [
      ...(input.referenceAssets || []),
      ...continuity.approvedIdentityReferences.map((asset) => asset.publicPath).filter(Boolean),
    ].slice(0, 8),
  });
  return {
    ok: true,
    record,
    generationTemplate: template,
    continuity,
    noProviderCall: true,
    noFileWrites: true,
    noManifestUpdates: true,
    noActiveWrites: true,
  };
}

export function createMediaReviewPlan(input = {}) {
  const record = buildMediaAssetRecord(input);
  const validation = validateMediaAssetRecord({
    ...record,
    lifecycleState: input.lifecycleState || "review_required",
    reviewStatus: input.reviewStatus || "pending",
  });
  if (!validation.ok) {
    throw new ValidationError("Invalid SpiritCore media review plan.", validation.errors);
  }
  return {
    ok: true,
    record: { ...record, lifecycleState: input.lifecycleState || "review_required", reviewStatus: input.reviewStatus || "pending" },
    requiredChecks: [
      "operator confirms target and asset kind",
      "identity continuity review completed",
      "safety review completed",
      "lore and tone consistency checked",
      "mobile and desktop framing checked",
      "no existing ACTIVE asset overwritten",
      "source prompt and provider job id captured in metadata",
    ],
    allowedDecisions: ["approved", "rejected", "needs_revision"],
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
  };
}

export function createMediaPromotionPlan(input = {}) {
  const record = buildMediaAssetRecord({
    ...input,
    lifecycleState: input.lifecycleState || "approved",
    reviewStatus: input.reviewStatus || "approved",
    promotionStatus: input.promotionStatus || "planned",
  });
  const validation = validateMediaAssetRecord(record);
  if (!validation.ok) {
    throw new ValidationError("Invalid SpiritCore media promotion plan.", validation.errors);
  }
  return {
    ok: true,
    sourcePath: record.reviewPath,
    reviewPath: record.reviewPath,
    approvedPath: record.approvedPath,
    activePath: record.activePath,
    publicPath: record.publicPath,
    metadataPath: record.metadataPath,
    rollbackPath: record.rollbackPath,
    manifestTarget: {
      updateMode: "operator_reviewed_manual_update",
      targetType: record.targetType,
      targetId: record.targetId,
      assetKind: record.assetKind,
      publicPath: record.publicPath,
    },
    requiredChecks: [
      "operator approval recorded",
      "review asset checksum captured",
      "approved copy exists before ACTIVE plan",
      "rollback archive path prepared",
      "manifest patch prepared but not applied",
      "public path tested after manual promotion",
    ],
    operatorApprovalRequired: true,
    noFileWrites: true,
    noManifestUpdates: true,
    noActiveWrites: true,
    record,
  };
}

export function createSpiritGateEnhancementPlan(input = {}) {
  const existingSourceAsset = normalizeText(input.existingSourceAsset || input.sourcePath || "SpiritGate existing Pika Labs concept asset", 600);
  const plan = createMediaAssetPlan({
    ...input,
    targetType: "spiritgate",
    targetId: input.targetId || "spiritgate",
    assetKind: input.assetKind || "spiritgate_video",
    sourceAssetRefs: [existingSourceAsset, ...(input.sourceAssetRefs || [])],
    referenceAssets: [existingSourceAsset, ...(input.referenceAssets || [])],
    promptIntent: input.promptIntent || "Enhance the recognizable SpiritGate entrance identity while preserving the original concept.",
    styleProfile: input.styleProfile || "premium cinematic SpiritGate upgrade, original Spiritverse threshold, not a replacement",
    safetyLevel: input.safetyLevel || "internal_review",
  });
  return {
    ...plan,
    spiritGate: {
      existingSourceAsset,
      enhancementRequest: "quality_upgrade_preserve_identity",
      versioning: "new reviewed version only",
      gatewaySceneCompatibility: true,
      originalReplacementAllowed: false,
    },
  };
}

function templateInputForSequence(input = {}, assetKind = "") {
  return {
    ...input,
    assetKind,
    spiritkinName: input.spiritkinName || input.targetId,
    spiritkinRole: input.spiritkinRole || (input.sequenceType === "spiritgate_enhancement" ? "SpiritGate threshold" : "Spiritverse companion"),
    visualIdentity: input.visualIdentity || "original Spiritverse identity, premium cinematic presence, emotionally intelligent companion atmosphere",
    loreSummary: input.loreSummary || "A Spiritverse production asset that must preserve canon, continuity, and reviewed source references.",
    colorPalette: input.colorPalette || "black, gold, ivory, subtle apple red accents, source-faithful companion palette when applicable",
    emotionalTone: input.emotionalTone || "premium, magical, calm, memorable, emotionally intelligent",
    styleProfile: input.styleProfile || "premium cinematic Spiritverse, original, polished, not derivative",
    safetyLevel: input.safetyLevel || "internal_review",
    referenceAssets: input.sourceAssetRefs || [],
  };
}

function assetKindsForSequence(sequenceType, input = {}) {
  const requested = Array.isArray(input.assetKinds)
    ? input.assetKinds.map(normalizeSpiritCoreMediaAssetKind).filter(Boolean)
    : [];
  if (requested.length) return requested;
  if (sequenceType === "spiritgate_enhancement") return ["spiritgate_video", "gateway_background"];
  if (sequenceType === "original_motion_pack") return [...ORIGINAL_MOTION_PACK_ASSET_KINDS];
  return [...PREMIUM_SPIRITKIN_STARTER_PACK_ASSET_KINDS];
}

function reviewChecklistForSequence(sequenceType) {
  const common = [
    "operator confirms target id, source references, and asset kinds",
    "source concept and approved references are available",
    "identity continuity review passes",
    "lore consistency review passes",
    "safety review passes",
    "mobile and desktop framing review passes",
    "no existing active asset is overwritten",
    "promotion plan remains operator-controlled",
  ];
  if (sequenceType === "spiritgate_enhancement") {
    return [
      "original Pika Labs SpiritGate concept remains recognizable",
      "quality, lighting, dimensionality, clarity, and atmosphere improve without replacement",
      "gateway scene compatibility is preserved",
      ...common,
      "rollback path is prepared before any future promotion",
    ];
  }
  if (sequenceType === "original_motion_pack") {
    return [
      "canonical Spiritkin identity is preserved across every motion state",
      "idle, speaking, listening, greeting, wake, trailer, and presence assets share continuity",
      ...common,
    ];
  }
  return [
    "premium starter pack has reviewed portrait, hero or full body, icon, presence, room, motion, wake, profile metadata, review status, and promotion status",
    "paid-ready status is false until required assets are reviewed and approved",
    ...common,
  ];
}

function rejectionCriteriaForSequence(sequenceType) {
  const common = [
    "identity drift",
    "unsafe framing",
    "watermarks or text overlays",
    "off-brand stock-like composition",
    "unclear mobile framing",
    "missing provider job or prompt metadata",
    "asset does not match requested kind",
  ];
  if (sequenceType === "spiritgate_enhancement") {
    return [
      "source SpiritGate concept is no longer recognizable",
      "enhancement behaves like a replacement instead of a quality upgrade",
      "gateway scene compatibility is broken",
      ...common,
    ];
  }
  if (sequenceType === "original_motion_pack") {
    return [
      "motion pack breaks canonical personality or visual identity",
      "state loops feel intrusive or distracting",
      ...common,
    ];
  }
  return [
    "premium Spiritkin lacks required paid-ready starter assets",
    "profile metadata, review status, or promotion status is missing",
    ...common,
  ];
}

function continuityRequirementsForSequence(sequenceType, input = {}) {
  const sourceAssetRefs = Array.isArray(input.sourceAssetRefs) ? input.sourceAssetRefs.map((item) => normalizeText(item, 600)).filter(Boolean) : [];
  return {
    primarySourceRefs: sourceAssetRefs,
    requireApprovedIdentityReferences: sequenceType !== "spiritgate_enhancement",
    requireSourceConceptPreservation: sequenceType === "spiritgate_enhancement",
    excludedStatuses: ["rejected", "archived", "failed"],
    sourceConceptMustBePreserved: sequenceType === "spiritgate_enhancement",
    gatewaySceneCompatibility: sequenceType === "spiritgate_enhancement",
  };
}

function estimatedProviderNeedsForSequence(sequenceType, assetKinds) {
  return {
    provider: "runway",
    imageJobs: assetKinds.filter((kind) => mediaTypeForAssetKind(kind) === "image").length,
    videoJobs: assetKinds.filter((kind) => mediaTypeForAssetKind(kind) === "video").length,
    executionAllowedInThisPhase: false,
    providerCallRequiredNow: false,
    notes: sequenceType === "spiritgate_enhancement"
      ? "Future execution should use the existing SpiritGate source concept as reference input."
      : "Future execution should run one reviewed asset at a time after references are approved.",
  };
}

function premiumReadinessFor(input = {}, generationPlans = []) {
  if (normalizeSequenceType(input.sequenceType) !== "premium_spiritkin_starter_pack") return null;
  const reviewedApproved = generationPlans.filter((plan) => plan.record.reviewStatus === "approved").map((plan) => plan.record.assetKind);
  const hasHeroOrFullBody = reviewedApproved.includes("hero") || reviewedApproved.includes("full_body");
  const required = ["portrait", "icon", "presence_indicator", "room_background", "idle_video", "speaking_video", "greeting_video", "wake_visual"];
  const missingReviewedApproved = required.filter((kind) => !reviewedApproved.includes(kind));
  if (!hasHeroOrFullBody) missingReviewedApproved.push("hero_or_full_body");
  return {
    paidReady: missingReviewedApproved.length === 0,
    missingReviewedApproved,
    profileMetadataRequired: true,
    reviewStatusRequired: true,
    promotionStatusRequired: true,
    rule: "premium Spiritkins are not paid-ready until required assets are reviewed and approved",
  };
}

export function createProductionSequencePlan(input = {}) {
  const sequenceType = normalizeSequenceType(input.sequenceType);
  if (!sequenceType) {
    throw new ValidationError("Invalid media production sequence type.", [`sequenceType must be one of ${SPIRITCORE_PRODUCTION_SEQUENCE_TYPES.join(", ")}`]);
  }
  const targetId = normalizeText(input.targetId || (sequenceType === "spiritgate_enhancement" ? "spiritgate" : ""), 160);
  if (!targetId) {
    throw new ValidationError("Invalid media production sequence target.", ["targetId is required"]);
  }
  const sourceAssetRefs = Array.isArray(input.sourceAssetRefs) ? input.sourceAssetRefs.map((item) => normalizeText(item, 600)).filter(Boolean) : [];
  const assetKinds = assetKindsForSequence(sequenceType, input);
  const sequenceId = `seq_${slugify(sequenceType)}_${slugify(targetId)}_${Date.now()}`;
  const targetType = sequenceType === "spiritgate_enhancement"
    ? "spiritgate"
    : (sequenceType === "premium_spiritkin_starter_pack" ? "premium_spiritkin" : "spiritkin");

  const generationPlans = assetKinds.map((assetKind) => createMediaAssetPlan({
    ...input,
    targetId,
    targetType,
    assetKind,
    sourceAssetRefs,
    referenceAssets: sourceAssetRefs,
    lifecycleState: "draft",
    reviewStatus: "not_started",
    promotionStatus: "not_requested",
    activeStatus: "inactive",
    promptIntent: input.promptIntent || `Plan ${assetKind} for ${targetId} ${sequenceType}.`,
    styleProfile: input.styleProfile || "premium cinematic Spiritverse production sequence",
    safetyLevel: input.safetyLevel || "internal_review",
    versionTag: `${slugify(sequenceType)}-${slugify(targetId)}-${slugify(assetKind)}`,
  }));

  const promptTemplates = assetKinds.map((assetKind) => buildGenerationTemplate(templateInputForSequence({
    ...input,
    sequenceType,
    targetId,
    sourceAssetRefs,
  }, assetKind)));

  const promotionPlanPlaceholders = generationPlans.map((plan) => createMediaPromotionPlan({
    ...plan.record,
    lifecycleState: "approved",
    reviewStatus: "approved",
    promotionStatus: "planned",
  }));

  return {
    sequenceId,
    sequenceType,
    targetId,
    sourceAssetRefs,
    assetKinds,
    generationPlans,
    promptTemplates,
    reviewChecklist: reviewChecklistForSequence(sequenceType),
    rejectionCriteria: rejectionCriteriaForSequence(sequenceType),
    promotionPlanPlaceholders,
    continuityRequirements: continuityRequirementsForSequence(sequenceType, input),
    estimatedProviderNeeds: estimatedProviderNeedsForSequence(sequenceType, assetKinds),
    spiritGateEnhancementProfile: sequenceType === "spiritgate_enhancement" ? {
      originalReplacementAllowed: false,
      sourceConceptMustBePreserved: true,
      enhancementOnly: true,
      reviewRequiredBeforePromotion: true,
      rollbackRequired: true,
      improvementTargets: ["quality", "cinematic polish", "lighting", "clarity", "dimensionality", "atmosphere", "premium feel", "Spiritverse identity"],
    } : null,
    originalMotionPackProfile: sequenceType === "original_motion_pack" ? {
      supportedTargets: [...ORIGINAL_SPIRITKIN_MOTION_PACK_TARGETS],
      requestedTargetSupported: ORIGINAL_SPIRITKIN_MOTION_PACK_TARGETS.map((name) => name.toLowerCase()).includes(targetId.toLowerCase()),
      requiredAssetKinds: [...ORIGINAL_MOTION_PACK_ASSET_KINDS],
    } : null,
    premiumStarterPackProfile: sequenceType === "premium_spiritkin_starter_pack" ? {
      minimumPaidReadyAssetKinds: [...PREMIUM_SPIRITKIN_STARTER_PACK_ASSET_KINDS],
      heroOrFullBodyRequired: true,
      profileMetadataRequired: true,
      reviewStatusRequired: true,
      promotionStatusRequired: true,
    } : null,
    premiumReadiness: premiumReadinessFor({ ...input, sequenceType }, generationPlans),
    assistantCapabilityAlignment: {
      principle: "assistant-like features belong in separate Spiritverse-native capability packs, not inside the media system",
      capabilityPacks: [...SPIRITCORE_ASSISTANT_CAPABILITY_ROADMAP],
      competitiveBaseline: "meet expected utility without copying assistant, companion, entertainment, or theme-park brands",
    },
    operatorApprovalRequired: true,
    noGenerationPerformed: true,
    noProviderCall: true,
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
    notes: normalizeText(input.notes, 1200),
    createdAt: nowIso(),
  };
}

export function createSpiritGateEnhancementExecutionPlan(input = {}) {
  const targetId = normalizeText(input.targetId || "spiritgate", 160);
  const sourceAssetRef = normalizeText(input.sourceAssetRef || input.sourcePath || input.sourceUrl || input.storagePath, 1200);
  const sourceReference = buildSourceMediaReference({
    sourceAssetId: input.sourceAssetId || "existing-pika-spiritgate-video",
    targetId,
    targetType: "spiritgate",
    assetKind: "spiritgate_video",
    sourceType: input.sourceAssetType || input.sourceType || "existing_asset",
    sourceUrl: String(sourceAssetRef).startsWith("http") ? sourceAssetRef : "",
    storagePath: String(sourceAssetRef).startsWith("http") ? "" : sourceAssetRef,
    approvedForReference: true,
    notes: input.notes || "SpiritGate A14 source reference registry entry.",
  });
  const sourceValidation = validateSourceMediaReference(sourceReference);
  if (!sourceValidation.ok) {
    throw new ValidationError("Invalid SpiritGate source media reference.", sourceValidation.errors);
  }

  const promptIntent = normalizeText(input.promptIntent || "Enhance the existing SpiritGate entrance video while preserving its original concept.", 1000);
  const styleProfile = normalizeText(input.styleProfile || "premium cinematic cosmic fantasy, Spiritverse gateway identity", 320);
  const safetyLevel = normalizeText(input.safetyLevel || "internal_review", 80);
  const versionTag = input.versionTag || `spiritgate-enhancement-${Date.now()}`;
  const assetRecord = buildMediaAssetRecord({
    targetId,
    targetType: "spiritgate",
    assetKind: "spiritgate_video",
    lifecycleState: "review_required",
    reviewStatus: "pending",
    promotionStatus: "not_requested",
    activeStatus: "inactive",
    provider: "runway",
    providerJobId: input.providerJobId,
    sourceAssetRefs: [sourceAssetRef],
    promptIntent,
    styleProfile,
    safetyLevel,
    versionTag,
    notes: "Automated SpiritGate enhancement output remains review_required until operator approval.",
  });
  const recordValidation = validateMediaAssetRecord(assetRecord);
  if (!recordValidation.ok) {
    throw new ValidationError("Invalid SpiritGate enhancement media asset record.", recordValidation.errors);
  }

  const generationTemplate = buildGenerationTemplate({
    templateId: "spiritgate_enhancement",
    targetId,
    assetKind: "spiritgate_video",
    spiritkinName: "SpiritGate",
    spiritkinRole: "Spiritverse threshold",
    visualIdentity: "recognizable SpiritGate gateway identity from the existing Pika Labs source concept",
    loreSummary: "The SpiritGate is the memorable entrance threshold into the Spiritverse companion realm.",
    colorPalette: "luxury black and gold, subtle apple red accents, ivory highlights",
    emotionalTone: "premium, magical, welcoming, cinematic, emotionally intelligent",
    styleProfile,
    safetyLevel,
    referenceAssets: [sourceAssetRef],
  });

  return {
    ok: true,
    sourceMediaReference: sourceReference,
    assetRecord,
    generationTemplate,
    providerTarget: {
      provider: "runway",
      providerMode: "video_to_video",
      recommendedModel: "gen4_aleph",
      endpointPath: "/v1/video_to_video",
      fallback: {
        providerMode: "image_to_video",
        recommendedModel: "gen4_turbo",
        note: "Use only if a reviewed SpiritGate frame is substituted for the source video.",
      },
    },
    commandCenterMetadata: {
      sourceAssetRequired: true,
      modelToolRecommendation: "Runway video_to_video with gen4_aleph",
      operatorApprovalRequired: true,
      estimatedProviderTarget: "video_to_video",
      generationStatus: input.providerJobId ? "submitted" : "not_submitted",
      reviewStatus: "pending",
      promotionDisabledUntilApproval: true,
    },
    premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
    spiritGatePolicy: {
      sourceConceptMustBePreserved: true,
      originalReplacementAllowed: false,
      enhancementOnly: true,
      noAutoPromotion: true,
      noManifestUpdate: true,
      noActiveWrite: true,
    },
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
  };
}

export function getMediaCatalogSummary() {
  return {
    ok: true,
    assetKinds: [...SPIRITCORE_MEDIA_ASSET_KINDS],
    lifecycleStates: [...SPIRITCORE_MEDIA_LIFECYCLE_STATES],
    reviewStatuses: [...SPIRITCORE_MEDIA_REVIEW_STATUSES],
    promotionStatuses: [...SPIRITCORE_MEDIA_PROMOTION_STATUSES],
    requirementProfiles: Object.values(SPIRITCORE_MEDIA_REQUIREMENT_PROFILES),
    generationTemplates: Object.values(GENERATION_TEMPLATES).map((template) => ({
      id: template.id,
      assetKind: template.assetKind,
      mediaType: mediaTypeForAssetKind(template.assetKind),
    })),
    assistantCapabilityRoadmap: [...SPIRITCORE_ASSISTANT_CAPABILITY_ROADMAP],
    sourceMediaTypes: [...SOURCE_MEDIA_TYPES],
    premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
    routes: [
      "POST /admin/media/asset-plan",
      "POST /admin/media/requirements-check",
      "POST /admin/media/generation-template",
      "POST /admin/media/review-plan",
      "POST /admin/media/promotion-plan",
      "POST /admin/media/production-sequence-plan",
      "POST /admin/media/source-reference-plan",
      "GET /admin/media/spiritgate-source-summary",
      "POST /admin/media/spiritgate-enhancement-plan-from-current-source",
      "POST /admin/media/spiritgate-segment-plan",
      "POST /admin/media/spiritgate-enhancement-execute",
      "GET /admin/media/catalog-summary",
    ],
    productionSequenceTypes: [...SPIRITCORE_PRODUCTION_SEQUENCE_TYPES],
    noProviderCall: true,
    noManifestUpdates: true,
    noActiveWrites: true,
  };
}
