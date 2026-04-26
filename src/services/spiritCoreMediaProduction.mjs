import { randomUUID } from "crypto";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { ValidationError } from "../errors.mjs";
import { SPIRITGATE_RUNTIME_MEDIA } from "../../spiritkins-app/data/spiritkinRuntimeConfig.js";
import { getSpiritkinMediaManifest, resolveSpiritkinMediaName } from "../../spiritkins-app/data/spiritkinMediaManifest.js";

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

const TARGET_TYPES = new Set(["spiritcore", "spiritkin", "premium_spiritkin", "realm", "spiritgate", "game", "wake_presence"]);

export const SPIRITCORE_DEFAULT_OPERATOR_TYPES = Object.freeze(["spiritcore", "spiritkin"]);

export const SPIRITKIN_MOTION_PACK_ASSET_TYPES = Object.freeze([
  "idle_01",
  "idle_02",
  "speaking_01",
  "speaking_02",
  "listen_01",
  "think_01",
  "gesture_01",
  "gesture_02",
  "walk_loop_01",
  "sit_or_perch_01",
  "greeting_or_entry_01",
]);

export const SPIRITCORE_AVATAR_PACK_ASSET_TYPES = Object.freeze([
  "idle_01",
  "idle_02",
  "speaking_01",
  "speaking_02",
  "gesture_01",
  "gesture_02",
  "entrance_01",
  "seated_listening_01",
  "thinking_01",
  "realm_presence_01",
]);

export const SPIRITKIN_MOTION_GENERATION_MODES = Object.freeze([
  "diagnostic_idle",
  "subtle_speaking",
  "speaking",
  "attentive_listening",
  "reflective_thinking",
  "gentle_gesture",
  "greeting_entry",
  "seated_presence",
  "ambient_walk",
]);

export const SPIRITKIN_MOTION_SHOT_PROFILES = Object.freeze([
  "close_portrait",
  "medium_shot",
  "wider_body",
]);

export const SPIRITKIN_MOTION_SOURCE_CATEGORIES = Object.freeze([
  "close_portrait",
  "medium_body",
  "full_body",
  "seated_or_perched",
  "realm_environment",
  "approved_motion_reference",
]);

export const SPIRITKIN_MOTION_SOURCE_CATEGORY_RULES = Object.freeze({
  idle_01: ["close_portrait"],
  idle_02: ["close_portrait"],
  speaking_01: ["close_portrait"],
  speaking_02: ["close_portrait"],
  listen_01: ["close_portrait"],
  think_01: ["close_portrait", "approved_motion_reference"],
  gesture_01: ["close_portrait", "approved_motion_reference"],
  gesture_02: ["medium_body"],
  greeting_or_entry_01: ["medium_body"],
  sit_or_perch_01: ["seated_or_perched"],
  walk_loop_01: ["full_body", "realm_environment"],
});

export const SPIRITKIN_MOTION_INTENSITIES = Object.freeze(["low", "medium"]);
export const SPIRITKIN_IMAGE_TO_VIDEO_RATIOS = Object.freeze([
  "1280:720",
  "720:1280",
  "1104:832",
  "832:1104",
  "960:960",
  "1584:672",
]);

export const ORIGINAL_SPIRITKIN_IDS = Object.freeze([
  "lyra",
  "raien",
  "kairo",
  "solis",
  "neris",
  "elaria",
  "thalassar",
]);

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
  if (record.targetType === "spiritcore") return `spiritcore/${targetSlug}`;
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

function sourceRefLooksRunwayAccessibleImage(sourceAssetRef = "") {
  return /^https:\/\/.+\.(png|jpe?g|webp)(\?.*)?$/i.test(String(sourceAssetRef || ""))
    || /^data:image\//i.test(String(sourceAssetRef || ""))
    || /^runway:\/\/.+/i.test(String(sourceAssetRef || ""));
}

function canonicalSpiritkinName(spiritkinId = "") {
  const normalized = normalizeText(spiritkinId, 120);
  const resolved = resolveSpiritkinMediaName(normalized);
  if (getSpiritkinMediaManifest(resolved)) return resolved;
  const match = Object.keys({
    Lyra: true,
    Raien: true,
    Kairo: true,
    Solis: true,
    Neris: true,
  }).find((name) => name.toLowerCase() === normalized.toLowerCase());
  return match || resolved || normalized;
}

export function resolveExistingSpiritkinSource(spiritkinId, input = {}) {
  const canonicalName = canonicalSpiritkinName(spiritkinId);
  const manifest = getSpiritkinMediaManifest(canonicalName);
  const slot = manifest?.portrait?.status === "ready"
    ? manifest.portrait
    : (manifest?.heroImage?.status === "ready" ? manifest.heroImage : manifest?.fallbackImage);
  const currentPath = normalizeText(slot?.path, 800);
  const origin = normalizeOrigin(input.origin || input.publicOrigin || input.stagingOrigin);
  const publicUrl = origin && currentPath.startsWith("/")
    ? `${origin}${currentPath}`
    : "";
  const sourceAssetRef = publicUrl || currentPath;
  const sourceAssetType = publicUrl && publicUrl.startsWith("https://")
    ? "external_url"
    : (currentPath ? "existing_asset" : "");
  const canUseForRunwayImageToVideo = sourceRefLooksRunwayAccessibleImage(sourceAssetRef);
  const missingRequirements = [];
  if (!manifest) missingRequirements.push(`No media manifest entry found for ${spiritkinId}`);
  if (!currentPath) missingRequirements.push("No ready portrait, hero, or fallback image found");
  if (!canUseForRunwayImageToVideo) {
    missingRequirements.push("Runway image-to-video requires an HTTPS image, data image URI, or provider asset URI");
  }

  return {
    ok: Boolean(manifest && currentPath),
    spiritkinId: normalizeText(spiritkinId, 120),
    canonicalName,
    sourceAssetId: `existing-${slugify(canonicalName)}-portrait-source`,
    sourceAssetRef,
    sourceAssetType,
    currentPath,
    publicUrl: publicUrl || null,
    providerCompatibility: providerCompatibilityForSource(sourceAssetType, "speaking_video"),
    canUseForRunwayImageToVideo,
    approvedForReference: Boolean(manifest && currentPath),
    missingRequirements,
    notes: canUseForRunwayImageToVideo
      ? `${canonicalName} has an existing canonical still suitable for a first image-to-video motion-state test.`
      : `Expose ${canonicalName}'s canonical still through the staging HTTPS asset route before motion-state execution.`,
    noGenerationPerformed: true,
    noProviderCall: true,
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
  };
}

function lifecycleNoWriteFlags(extra = {}) {
  return {
    noGenerationPerformed: true,
    noProviderCall: true,
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
    ...extra,
  };
}

function normalizeDefaultOperatorType(value) {
  const normalized = canonicalize(value || "spiritcore");
  return SPIRITCORE_DEFAULT_OPERATOR_TYPES.includes(normalized) ? normalized : "spiritcore";
}

export function createSpiritCoreDefaultOperatorPlan(input = {}) {
  const defaultOperatorType = normalizeDefaultOperatorType(input.defaultOperatorType);
  const spiritkinsEnabled = input.spiritkinsEnabled !== false;
  const spiritkinProfiles = Array.isArray(input.spiritkinProfiles)
    ? input.spiritkinProfiles.map((profile) => ({
      spiritkinId: normalizeText(profile?.spiritkinId || profile?.id, 160),
      displayName: normalizeText(profile?.displayName || profile?.name, 160),
      enabled: profile?.enabled !== false,
      companionMode: normalizeText(profile?.companionMode || "optional_under_spiritcore", 120),
    })).filter((profile) => profile.spiritkinId)
    : [];

  return {
    ok: true,
    defaultOperatorType,
    defaultOperatorMode: defaultOperatorType === "spiritcore" ? "universal_spiritcore_operator" : "legacy_spiritkin_first",
    spiritcoreIsUniversalDefault: true,
    spiritkinsAreOptionalCompanions: true,
    spiritkinsEnabled,
    spiritcoreProfile: {
      profileId: normalizeText(input.spiritcoreProfile?.profileId || "spiritcore-default-operator", 160),
      displayName: normalizeText(input.spiritcoreProfile?.displayName || "SpiritCore", 160),
      role: "default_operator",
      governsSpiritkins: true,
      usableWithoutSpiritkins: true,
      lifecycleState: "planning_only",
    },
    spiritkinProfiles,
    entitlementSeparation: {
      spiritcorePremium: Boolean(input.entitlements?.spiritcorePremium),
      spiritkinPremium: Boolean(input.entitlements?.spiritkinPremium),
      compatibleButSeparable: true,
      note: "SpiritCore premium capabilities and Spiritkin premium companion capabilities should be granted independently.",
    },
    compatibility: {
      currentSpiritkinFlowsPreserved: true,
      currentSpiritGateFlowsPreserved: true,
      noBehaviorBlock: true,
    },
    ...lifecycleNoWriteFlags(),
  };
}

function motionAssetKindForType(assetType) {
  if (assetType.startsWith("speaking")) return "speaking_video";
  if (assetType.startsWith("listen")) return "listening_video";
  if (assetType.startsWith("greeting") || assetType.startsWith("entrance")) return "greeting_video";
  if (assetType.startsWith("idle") || assetType.startsWith("think") || assetType.startsWith("gesture") || assetType.startsWith("walk") || assetType.startsWith("sit")) return "idle_video";
  return "presence_indicator";
}

function stateTriggerForAssetType(assetType) {
  if (assetType.startsWith("speaking")) return "assistant_or_companion_speaking";
  if (assetType.startsWith("listen")) return "user_speaking_or_mic_active";
  if (assetType.startsWith("think")) return "processing_or_reflection";
  if (assetType.startsWith("gesture")) return "emphasis_or_emotional_response";
  if (assetType.startsWith("walk")) return "ambient_realm_movement";
  if (assetType.startsWith("sit")) return "resting_or_perched_presence";
  if (assetType.startsWith("greeting") || assetType.startsWith("entrance")) return "session_entry_or_return";
  if (assetType.startsWith("seated")) return "attentive_listening";
  if (assetType.startsWith("realm")) return "background_operator_presence";
  return "idle_presence";
}

function normalizeMotionGenerationControls(input = {}) {
  const errors = [];
  const durationSec = Number(input.durationSec || 5);
  if (![5, 8].includes(durationSec)) {
    errors.push("durationSec must be 5 or 8");
  }
  const motionIntensity = canonicalize(input.motionIntensity || "low");
  if (!SPIRITKIN_MOTION_INTENSITIES.includes(motionIntensity)) {
    errors.push(`motionIntensity must be one of ${SPIRITKIN_MOTION_INTENSITIES.join(", ")}`);
  }
  const generationMode = canonicalize(input.generationMode || "diagnostic_idle");
  if (!SPIRITKIN_MOTION_GENERATION_MODES.includes(generationMode)) {
    errors.push(`generationMode must be one of ${SPIRITKIN_MOTION_GENERATION_MODES.join(", ")}`);
  }
  const allowMouthMovement = Boolean(input.allowMouthMovement);
  const aspectRatio = normalizeText(input.ratio || input.aspectRatio || "720:1280", 20);
  if (!SPIRITKIN_IMAGE_TO_VIDEO_RATIOS.includes(aspectRatio)) {
    errors.push(`ratio must be one of ${SPIRITKIN_IMAGE_TO_VIDEO_RATIOS.join(", ")} for Gen-4 Turbo image_to_video`);
  }
  return {
    ok: errors.length === 0,
    errors,
    controls: {
      durationSec,
      aspectRatio,
      motionIntensity,
      generationMode,
      allowMouthMovement,
    },
  };
}

export const SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES = Object.freeze({
  idle_01: "diagnostic_idle",
  idle_02: "diagnostic_idle",
  speaking_01: "subtle_speaking",
  speaking_02: "subtle_speaking",
  listen_01: "attentive_listening",
  think_01: "reflective_thinking",
  gesture_01: "gentle_gesture",
  gesture_02: "gentle_gesture",
  greeting_or_entry_01: "greeting_entry",
  sit_or_perch_01: "seated_presence",
  walk_loop_01: "ambient_walk",
});

function normalizeShotProfile(value, fallback = "close_portrait") {
  const normalized = canonicalize(value || fallback);
  return SPIRITKIN_MOTION_SHOT_PROFILES.includes(normalized) ? normalized : fallback;
}

function poseVariantForAssetType(assetType) {
  if (assetType.startsWith("speaking")) return "front_facing_companion_expression";
  if (assetType.startsWith("listen")) return "attentive_head_tilt";
  if (assetType.startsWith("think")) return "reflective_eye_and_head_motion";
  if (assetType.startsWith("gesture")) return "small_upper_body_emotional_gesture";
  if (assetType.startsWith("walk")) return "subtle_realm_movement";
  if (assetType.startsWith("sit")) return "settled_resting_presence";
  if (assetType.startsWith("greeting")) return "warm_return_greeting";
  return "calm_idle_presence";
}

function motionCompletionRuleForAssetType(assetType) {
  return {
    ruleId: "readable_motion_completion",
    summary: "Action begins early, readable main action occurs mid-clip, and motion resolves before clip end.",
    requiredBehaviors: [
      "action begins within the first second",
      "main motion reads clearly by the middle of the clip",
      "motion settles before the clip ends",
      "loop can repeat without feeling cut off",
    ],
    rejectedBehaviors: [
      "slow-motion unfinished gestures",
      "motion that starts too late",
      "blurred or smeared background",
      "identity drift during the main action",
    ],
    assetType,
  };
}

function timingIntentForAssetType(assetType) {
  if (assetType.startsWith("speaking")) return "responsive_speaking_loop_with_early_face_motion";
  if (assetType.startsWith("listen")) return "attentive_listening_readable_by_mid_clip";
  if (assetType.startsWith("think")) return "visible_thinking_expression_with_mid_clip_head_motion";
  if (assetType.startsWith("gesture")) return "gesture_starts_early_and_resolves_cleanly";
  if (assetType.startsWith("walk")) return "ambient_motion_stays_smooth_and_loopable";
  if (assetType.startsWith("sit")) return "settled_presence_with_subtle_posture_resolution";
  if (assetType.startsWith("greeting")) return "warm_greeting_motion_arrives_before_clip_end";
  return "stable_idle_loop_with_subtle_life";
}

function backgroundClarityModeForAssetType(assetType) {
  if (assetType.startsWith("walk")) return "stable_readable_realm_background";
  return "clear_stable_background_no_extra_blur";
}

function normalizeAvailableMotionSources(value = {}) {
  const sources = {};
  for (const category of SPIRITKIN_MOTION_SOURCE_CATEGORIES) {
    const raw = value && typeof value === "object" ? value[category] : "";
    const sourceRef = normalizeText(raw, 1200);
    sources[category] = sourceRef || null;
  }
  return sources;
}

function sourceCategoriesForMotionAsset(assetType) {
  return SPIRITKIN_MOTION_SOURCE_CATEGORY_RULES[assetType] || ["close_portrait"];
}

function selectMotionSourceForAsset(assetType, availableSources = {}) {
  const requiredCategories = sourceCategoriesForMotionAsset(assetType);
  const selectedCategory = requiredCategories.find((category) => Boolean(availableSources[category])) || null;
  return {
    assetType,
    requiredSourceCategories: requiredCategories,
    requiredSourceCategory: requiredCategories.length === 1 ? requiredCategories[0] : requiredCategories.join(" or "),
    selectedSourceCategory: selectedCategory,
    selectedSourceRef: selectedCategory ? availableSources[selectedCategory] : null,
    blockedUntilSourceExists: !selectedCategory,
    sourceStatus: selectedCategory ? "ready" : "missing_required_source",
  };
}

function recommendedStillForSourceCategory(category, entityId) {
  if (category === "medium_body") {
    return `Create an approved medium-body canonical still for ${entityId} before greeting_or_entry_01 or gesture_02 generation.`;
  }
  if (category === "full_body") {
    return `Create an approved full-body canonical still for ${entityId} before walk_loop_01 generation.`;
  }
  if (category === "seated_or_perched") {
    return `Create an approved seated or perched canonical still for ${entityId} before sit_or_perch_01 generation.`;
  }
  if (category === "realm_environment") {
    return `Create or approve a realm environment reference for ${entityId} before larger ambient movement generation.`;
  }
  if (category === "approved_motion_reference") {
    return `Use an approved prior motion clip for ${entityId} when a still source is not enough to communicate the state.`;
  }
  return `Use the approved close portrait source for ${entityId}.`;
}

function buildMotionGenerationPrompt({ canonicalName, assetType, stateTrigger, promptIntent, styleProfile, controls }) {
  if (controls.generationMode === "diagnostic_idle") {
    return [
      `Animate ${canonicalName} in a subtle idle presence loop.`,
      "Preserve the exact portrait identity, colors, eyes, face, silhouette, and calm Spiritverse tone.",
      "Add only gentle blinking, soft breathing, and tiny natural head movement.",
      "Keep lips closed.",
      "No speaking, no mouth movement, no large gestures, no camera movement, no background change, no text, no logos.",
    ].join(" ");
  }

  if (controls.generationMode === "subtle_speaking") {
    return [
      `Animate ${canonicalName} in a silent subtle speaking presence loop.`,
      "Preserve the exact portrait identity, colors, eyes, face, silhouette, and calm Spiritverse tone.",
      "Add very subtle natural mouth movement for gentle speech, soft blinking, light breathing, and tiny calm head motion.",
      "No audio, no subtitles, no text, no logos, no background change, no camera movement, no large gestures.",
    ].join(" ");
  }

  if (controls.generationMode === "speaking") {
    return [
      `Animate ${canonicalName} in a restrained speaking presence loop for ${assetType}.`,
      "Preserve the exact portrait identity, colors, eyes, face, silhouette, and calm Spiritverse tone.",
      "Add natural but controlled mouth movement, soft blinking, light breathing, and small expressive head motion.",
      "Keep motion stable and premium.",
      "No audio, no subtitles, no text, no logos, no background change, no camera movement, no large gestures, no identity drift.",
    ].join(" ");
  }

  if (controls.generationMode === "attentive_listening") {
    return [
      `Animate ${canonicalName} in a silent attentive listening loop.`,
      "Preserve exact portrait identity, colors, eyes, face, silhouette, and calm Spiritverse tone.",
      "Add soft breathing, natural irregular blinking, tiny attentive head tilt, and focused eye presence as if listening to the user.",
      "No speaking, no mouth movement, no audio, no text, no camera movement, no background change, no large gestures.",
    ].join(" ");
  }

  if (controls.generationMode === "reflective_thinking") {
    return [
      `Animate ${canonicalName} in a silent reflective thinking loop.`,
      "Preserve exact portrait identity, colors, eyes, face, silhouette, and calm Spiritverse tone.",
      "Add slow breathing, thoughtful eye movement, gentle blink variation, tiny head angle shift, and a calm contemplative expression.",
      "No speaking, no audio, no text, no logos, no background change, no camera movement, no large gestures.",
    ].join(" ");
  }

  if (controls.generationMode === "gentle_gesture") {
    return [
      `Animate ${canonicalName} in a silent gentle emotional gesture loop.`,
      "Preserve exact portrait identity, colors, eyes, face, silhouette, and calm Spiritverse tone.",
      "Add soft breathing, natural blinking, a small graceful upper-body or head gesture, and subtle emotional warmth.",
      "No audio, no subtitles, no text, no logos, no background change, no camera movement, no exaggerated motion.",
    ].join(" ");
  }

  if (controls.generationMode === "greeting_entry") {
    return [
      `Animate ${canonicalName} in a silent warm greeting presence loop.`,
      "Preserve exact portrait identity, colors, eyes, face, silhouette, and calm Spiritverse tone.",
      "Add gentle breathing, friendly eye focus, soft blinking, a tiny welcoming head motion, and subtle joyful presence as if greeting the user.",
      "No audio, no text, no logos, no background change, no camera movement, no large gestures.",
    ].join(" ");
  }

  if (controls.generationMode === "seated_presence") {
    return [
      `Animate ${canonicalName} in a silent seated or perched presence loop.`,
      "Preserve exact portrait identity, colors, eyes, face, silhouette, and calm Spiritverse tone.",
      "Add soft breathing, natural blinking, tiny posture settling, and calm resting presence.",
      "No speaking, no audio, no text, no logos, no camera movement, no background change, no exaggerated motion.",
    ].join(" ");
  }

  if (controls.generationMode === "ambient_walk") {
    return [
      `Animate ${canonicalName} in a silent subtle ambient movement loop.`,
      "Preserve exact identity, colors, eyes, face, silhouette, and calm Spiritverse tone.",
      "Add gentle lifelike motion suggesting a slow graceful shift through the realm while keeping identity stable and framing readable.",
      "No audio, no text, no logos, no camera movement, no background change, no exaggerated motion.",
    ].join(" ");
  }

  const base = [
    promptIntent,
    `Animate ${canonicalName} for ${assetType} with ${controls.motionIntensity} motion intensity.`,
    `Style profile: ${styleProfile}.`,
    "Preserve canonical portrait identity, facial structure, palette, gentle Spiritverse presence, and premium screen-present realism.",
    "Keep the shot stable and suitable for an internal review motion-state loop.",
  ];
  if (controls.generationMode === "diagnostic_idle") {
    base.push("Diagnostic idle mode only: add blinking, breathing, and tiny natural head movement. Do not create speaking behavior. Do not animate mouth movement. Keep lips closed and calm.");
  } else if (controls.generationMode === "subtle_speaking") {
    base.push("Subtle speaking mode: allow only very subtle natural mouth movement with restrained facial animation, no exaggerated lip sync, no broad gestures.");
  } else {
    base.push("Speaking mode: allow clearer speaking motion while preserving identity and avoiding exaggerated mouth movement or unstable facial changes.");
  }
  if (!controls.allowMouthMovement) {
    base.push("Mouth movement is not allowed for this generation attempt.");
  }
  base.push(`State trigger: ${stateTrigger}. Duration target: ${controls.durationSec}s. Aspect ratio: ${controls.aspectRatio}.`);
  base.push("Avoid identity drift, distorted face, warped anatomy, text overlays, subtitles, logos, watermarks, camera shake, or busy background changes.");
  return base.join(" ");
}

function buildMotionAssetPlan({ assetType, targetId, subjectType, subjectId, styleProfile, safetyLevel, sourceRefs = [] }) {
  const assetKind = motionAssetKindForType(assetType);
  const recommendedGenerationMode = SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES[assetType] || "diagnostic_idle";
  return {
    assetType,
    assetKind,
    targetId,
    subjectType,
    subjectId,
    purpose: `${assetType} ${subjectType} media state`,
    sourceRefs,
    promptIntent: [
      `Plan ${assetType} for ${subjectId}.`,
      `The motion should support ${stateTriggerForAssetType(assetType)} without feeling distracting or user-facing generation driven.`,
      "Preserve identity, continuity, and Spiritverse premium tone.",
    ].join(" "),
    styleProfile,
    motionCategory: assetType.split("_")[0],
    stateTrigger: stateTriggerForAssetType(assetType),
    generationMode: recommendedGenerationMode,
    shotProfile: normalizeShotProfile(assetType.startsWith("walk") ? "wider_body" : (assetType.startsWith("gesture") || assetType.startsWith("sit") ? "medium_shot" : "close_portrait")),
    poseVariant: poseVariantForAssetType(assetType),
    motionCompletionRule: motionCompletionRuleForAssetType(assetType),
    backgroundClarityMode: backgroundClarityModeForAssetType(assetType),
    timingIntent: timingIntentForAssetType(assetType),
    reviewStatus: "not_started",
    lifecycleState: "review_required",
  };
}

export function createSpiritkinMotionPackPlan(input = {}) {
  const spiritkinId = normalizeText(input.spiritkinId || input.subjectId || "lyra", 160);
  const targetId = normalizeText(input.targetId || `${slugify(spiritkinId)}-motion-pack-v1`, 160);
  const styleProfile = normalizeText(input.styleProfile || "premium cinematic Spiritverse companion motion pack", 320);
  const safetyLevel = normalizeText(input.safetyLevel || "internal_review", 80);
  const sourceRefs = Array.isArray(input.sourceRefs) ? input.sourceRefs.map((ref) => normalizeText(ref, 600)).filter(Boolean) : [];
  const assets = SPIRITKIN_MOTION_PACK_ASSET_TYPES.map((assetType) => buildMotionAssetPlan({
    assetType,
    targetId,
    subjectType: "spiritkin",
    subjectId: spiritkinId,
    styleProfile,
    safetyLevel,
    sourceRefs,
  }));

  return {
    ok: true,
    targetId,
    spiritkinId,
    subjectType: "spiritkin",
    safetyLevel,
    motionPackState: "planning_only",
    plannedAssets: assets,
    continuityRules: [
      "preserve canonical Spiritkin identity across every motion state",
      "reuse approved portrait, hero, and room references when available",
      "keep movement loops subtle enough for repeated assistant and companion use",
      "all generated outputs remain review_required until operator review",
    ],
    visualConsistencyRequirements: [
      "same character identity",
      "same palette family",
      "compatible lighting and camera language",
      "mobile and desktop framing remains readable",
    ],
    reviewChecklist: [
      "state trigger matches intended UX moment",
      "motion loop is not distracting",
      "identity and emotional tone are consistent",
      "source references and prompt metadata are recorded",
      "operator approval required before any promotion",
    ],
    premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
    ...lifecycleNoWriteFlags(),
  };
}

function normalizeFramingProfiles(value) {
  const requested = Array.isArray(value) ? value : [];
  const profiles = requested
    .map((profile) => canonicalize(profile))
    .filter((profile) => SPIRITKIN_MOTION_SHOT_PROFILES.includes(profile));
  return profiles.length ? [...new Set(profiles)] : ["close_portrait"];
}

function priorityForAssetType(assetType, generationPriorities = {}) {
  if (Array.isArray(generationPriorities)) {
    const index = generationPriorities.map((item) => normalizeText(item, 80)).indexOf(assetType);
    return index >= 0 ? index + 1 : generationPriorities.length + 1;
  }
  const explicit = Number(generationPriorities?.[assetType]);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (assetType.startsWith("idle")) return 1;
  if (assetType.startsWith("speaking")) return 2;
  if (assetType.startsWith("listen") || assetType.startsWith("think")) return 3;
  return 4;
}

function settingsForMotionAsset(assetType, framingProfiles = ["close_portrait"], generationPriorities = {}) {
  const shotProfile = normalizeShotProfile(
    framingProfiles.includes("medium_shot") && (assetType.startsWith("gesture") || assetType.startsWith("sit"))
      ? "medium_shot"
      : (framingProfiles.includes("wider_body") && assetType.startsWith("walk") ? "wider_body" : framingProfiles[0]),
  );
  return {
    assetType,
    assetKind: motionAssetKindForType(assetType),
    generationMode: SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES[assetType] || "diagnostic_idle",
    durationSec: 5,
    ratio: shotProfile === "wider_body" ? "1280:720" : "720:1280",
    motionIntensity: "low",
    allowMouthMovement: assetType.startsWith("speaking"),
    shotProfile,
    poseVariant: poseVariantForAssetType(assetType),
    motionCompletionRule: motionCompletionRuleForAssetType(assetType),
    backgroundClarityMode: backgroundClarityModeForAssetType(assetType),
    timingIntent: timingIntentForAssetType(assetType),
    priority: priorityForAssetType(assetType, generationPriorities),
  };
}

export function createMotionPackBatchPlan(input = {}) {
  const entityId = normalizeText(input.entityId || input.spiritkinId, 120).toLowerCase();
  const packId = normalizeText(input.packId || `${slugify(entityId)}-motion-pack-v1`, 160);
  const requestedAssetTypes = Array.isArray(input.requestedAssetTypes)
    ? input.requestedAssetTypes.map((assetType) => normalizeText(assetType, 80)).filter(Boolean)
    : [];
  const framingProfiles = normalizeFramingProfiles(input.framingProfiles);
  const generationPriorities = input.generationPriorities || {};
  const errors = [];
  if (!entityId) errors.push("entityId is required");
  if (!packId) errors.push("packId is required");
  if (!requestedAssetTypes.length) errors.push("requestedAssetTypes are required");
  for (const assetType of requestedAssetTypes) {
    if (!SPIRITKIN_MOTION_PACK_ASSET_TYPES.includes(assetType)) {
      errors.push(`requestedAssetTypes contains unsupported assetType ${assetType}`);
    }
  }
  if (errors.length) {
    throw new ValidationError("Invalid motion pack batch plan request.", errors);
  }

  const uniqueAssetTypes = [...new Set(requestedAssetTypes)];
  const generationPlan = uniqueAssetTypes
    .map((assetType) => {
      const settings = settingsForMotionAsset(assetType, framingProfiles, generationPriorities);
      return {
        ...settings,
        entityId,
        packId,
        targetId: packId,
        sourceRequirement: "approved canonical still or approved prior motion reference",
        promptIntent: [
          `Generate ${entityId} ${assetType} as a review-required ${settings.assetKind}.`,
          `Use ${settings.generationMode} with ${settings.shotProfile} framing.`,
          settings.motionCompletionRule.summary,
          `Background mode: ${settings.backgroundClarityMode}. Timing: ${settings.timingIntent}.`,
        ].join(" "),
        providerSettings: {
          provider: "runway",
          mode: "image_to_video",
          model: "gen4_turbo",
          endpointPath: "/v1/image_to_video",
          payloadKeys: ["model", "promptImage", "promptText", "ratio", "duration"],
        },
        lifecycleState: "review_required",
        reviewStatus: "not_started",
      };
    })
    .sort((a, b) => a.priority - b.priority || a.assetType.localeCompare(b.assetType));

  return {
    ok: true,
    planId: `motion_pack_batch_${slugify(entityId)}_${slugify(packId)}_${Date.now()}`,
    entityId,
    packId,
    requestedAssetTypes: uniqueAssetTypes,
    framingProfiles,
    generationPlan,
    requiredPromptsAndSettings: generationPlan.map((plan) => ({
      assetType: plan.assetType,
      promptIntent: plan.promptIntent,
      providerSettings: plan.providerSettings,
      shotProfile: plan.shotProfile,
      poseVariant: plan.poseVariant,
      motionCompletionRule: plan.motionCompletionRule,
      backgroundClarityMode: plan.backgroundClarityMode,
      timingIntent: plan.timingIntent,
    })),
    completionRuleNotes: [
      "generate and review one high-priority diagnostic clip before spending credits on the rest of the wave",
      "each clip must begin its action early, show readable motion mid-clip, and resolve before the end",
      "reject clips that feel like unfinished slow motion or blur the background beyond review readability",
      "approved clips can later be composed into longer review-required sequences",
    ],
    operatorApprovalRequired: true,
    premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
    noIngestPerformed: true,
    noActiveWritePerformed: true,
    ...lifecycleNoWriteFlags(),
  };
}

export function createSpiritkinSourceReferencePlan(input = {}) {
  const entityId = normalizeText(input.entityId || input.spiritkinId, 120).toLowerCase();
  const packId = normalizeText(input.packId || `${slugify(entityId)}-motion-pack-v1`, 160);
  const requestedAssetTypes = Array.isArray(input.requestedAssetTypes)
    ? input.requestedAssetTypes.map((assetType) => normalizeText(assetType, 80)).filter(Boolean)
    : [];
  const availableSources = normalizeAvailableMotionSources(input.availableSources || {});
  const errors = [];
  if (!entityId) errors.push("entityId is required");
  if (!packId) errors.push("packId is required");
  if (!requestedAssetTypes.length) errors.push("requestedAssetTypes are required");
  for (const assetType of requestedAssetTypes) {
    if (!SPIRITKIN_MOTION_PACK_ASSET_TYPES.includes(assetType)) {
      errors.push(`requestedAssetTypes contains unsupported assetType ${assetType}`);
    }
  }
  if (errors.length) {
    throw new ValidationError("Invalid Spiritkin source reference plan request.", errors);
  }

  const sourceSelections = [...new Set(requestedAssetTypes)].map((assetType) => {
    const selection = selectMotionSourceForAsset(assetType, availableSources);
    return {
      ...selection,
      assetKind: motionAssetKindForType(assetType),
      generationMode: SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES[assetType] || "diagnostic_idle",
      shotProfile: normalizeShotProfile(assetType.startsWith("walk") ? "wider_body" : (assetType === "gesture_02" || assetType === "greeting_or_entry_01" ? "medium_shot" : "close_portrait")),
      poseVariant: poseVariantForAssetType(assetType),
      motionCompletionRule: motionCompletionRuleForAssetType(assetType),
      backgroundClarityMode: backgroundClarityModeForAssetType(assetType),
      timingIntent: timingIntentForAssetType(assetType),
      recommendation: selection.blockedUntilSourceExists
        ? `Do not generate ${assetType} until ${selection.requiredSourceCategory} exists.`
        : `Use ${selection.selectedSourceCategory} for ${assetType}.`,
    };
  });
  const missingCategories = [...new Set(sourceSelections
    .filter((selection) => selection.blockedUntilSourceExists)
    .flatMap((selection) => selection.requiredSourceCategories))];

  return {
    ok: true,
    planId: `source_ref_plan_${slugify(entityId)}_${slugify(packId)}_${Date.now()}`,
    entityId,
    packId,
    sourceCategories: [...SPIRITKIN_MOTION_SOURCE_CATEGORIES],
    availableSources,
    requestedAssetTypes: [...new Set(requestedAssetTypes)],
    sourceSelections,
    generationBlockedAssetTypes: sourceSelections
      .filter((selection) => selection.blockedUntilSourceExists)
      .map((selection) => selection.assetType),
    readyAssetTypes: sourceSelections
      .filter((selection) => !selection.blockedUntilSourceExists)
      .map((selection) => selection.assetType),
    recommendedNextSourceStills: missingCategories.map((category) => ({
      sourceCategory: category,
      recommendation: recommendedStillForSourceCategory(category, entityId),
    })),
    planningNotes: [
      "close portrait sources remain appropriate for close and micro-motion states",
      "medium-body, full-body, seated, realm, or approved motion references are required before larger framing states",
      "do not spend provider credits on blocked states until the matching source reference exists",
    ],
    premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
    noIngestPerformed: true,
    ...lifecycleNoWriteFlags(),
  };
}

export function createSourceReferenceRegistryPlan(input = {}) {
  const entityId = normalizeText(input.entityId || input.spiritkinId, 120).toLowerCase();
  const packId = normalizeText(input.packId || `${slugify(entityId)}-motion-pack-v1`, 160);
  const availableSources = normalizeAvailableMotionSources(input.availableSources || {});
  const requestedAssetTypes = Array.isArray(input.requestedAssetTypes) && input.requestedAssetTypes.length
    ? input.requestedAssetTypes
    : SPIRITKIN_MOTION_PACK_ASSET_TYPES;
  const basePlan = createSpiritkinSourceReferencePlan({
    entityId,
    packId,
    requestedAssetTypes,
    availableSources,
  });
  const becomesUnblockedBySourceCategory = {};
  for (const category of SPIRITKIN_MOTION_SOURCE_CATEGORIES) {
    const hypotheticalSources = {
      ...availableSources,
      [category]: availableSources[category] || `planned://${entityId}/${category}`,
    };
    const hypotheticalPlan = createSpiritkinSourceReferencePlan({
      entityId,
      packId,
      requestedAssetTypes,
      availableSources: hypotheticalSources,
    });
    becomesUnblockedBySourceCategory[category] = basePlan.generationBlockedAssetTypes
      .filter((assetType) => hypotheticalPlan.readyAssetTypes.includes(assetType));
  }

  return {
    ok: true,
    registryPlanId: `source_registry_${slugify(entityId)}_${slugify(packId)}_${Date.now()}`,
    entityId,
    packId,
    currentSources: availableSources,
    missingRequiredSourcesByAssetType: Object.fromEntries(basePlan.sourceSelections
      .filter((selection) => selection.blockedUntilSourceExists)
      .map((selection) => [selection.assetType, selection.requiredSourceCategories])),
    readyAssetTypes: basePlan.readyAssetTypes,
    generationBlockedAssetTypes: basePlan.generationBlockedAssetTypes,
    becomesUnblockedBySourceCategory,
    recommendedNextSourceStills: basePlan.recommendedNextSourceStills,
    sourceReferencePlan: basePlan,
    noWritesPerformed: true,
    noIngestPerformed: true,
    ...lifecycleNoWriteFlags(),
  };
}

async function findMetadataFiles(root, limit = 120) {
  const results = [];
  async function walk(dir) {
    if (results.length >= limit) return;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= limit) return;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (/\.metadata\.json$/i.test(entry.name)) {
        results.push(absolute);
      }
    }
  }
  await walk(root);
  return results;
}

function workspaceRelativePath(absolutePath = "") {
  return path.relative(process.cwd(), absolutePath).replace(/\\/g, "/");
}

async function discoverApprovedMetadataForEntity(entityId, { workspaceRoot = process.cwd() } = {}) {
  const safeEntity = slugify(entityId, "");
  if (!safeEntity) return [];
  const approvedRoot = path.join(workspaceRoot, "Spiritverse_MASTER_ASSETS", "APPROVED", safeEntity);
  const metadataFiles = await findMetadataFiles(approvedRoot);
  const records = [];
  for (const metadataFile of metadataFiles) {
    try {
      const parsed = JSON.parse(await readFile(metadataFile, "utf8"));
      records.push({
        metadataPath: parsed.metadataPath || workspaceRelativePath(metadataFile),
        savedPath: parsed.savedPath || parsed.approvedRelativePath || workspaceRelativePath(metadataFile).replace(/\.metadata\.json$/i, ".mp4"),
        assetType: normalizeText(parsed.assetType || "", 80),
        sourceCategory: normalizeText(parsed.sourceCategory || "", 80),
        provider: normalizeText(parsed.provider || "", 80),
        providerJobId: normalizeText(parsed.providerJobId || "", 180),
        durationSec: Number.isFinite(Number(parsed.durationSec)) ? Number(parsed.durationSec) : null,
        ratio: normalizeText(parsed.ratio || "", 40),
        generationMode: normalizeText(parsed.generationMode || "", 80),
        reviewNotes: normalizeText(parsed.reviewNotes || "", 2000),
        approvalState: normalizeText(parsed.approvalState || parsed.status || parsed.lifecycleState || "approved", 80),
        selectedSourceRef: parsed.savedPath || parsed.approvedRelativePath || workspaceRelativePath(metadataFile).replace(/\.metadata\.json$/i, path.extname(metadataFile)),
      });
    } catch {
      // Ignore malformed sidecars in read-only catalog mode.
    }
  }
  return records;
}

function buildAvailableSourcesFromDiscovery(entityId, input = {}, discoveredMetadata = []) {
  const explicit = normalizeAvailableMotionSources(input.availableSources || {});
  const existingSource = resolveExistingSpiritkinSource(entityId, {
    origin: input.publicOrigin || input.stagingOrigin || "https://spiritcore-backend-copy-production.up.railway.app",
  });
  if (!explicit.close_portrait && existingSource.sourceAssetRef) {
    explicit.close_portrait = existingSource.sourceAssetRef;
  }
  for (const record of discoveredMetadata) {
    if (SPIRITKIN_MOTION_SOURCE_CATEGORIES.includes(record.sourceCategory) && !explicit[record.sourceCategory]) {
      explicit[record.sourceCategory] = record.savedPath;
    }
  }
  return explicit;
}

function knownPolicyForAssetType(assetType, sourceReady) {
  if (["gesture_02", "greeting_or_entry_01"].includes(assetType) && !sourceReady) {
    return {
      retryAllowed: false,
      reason: "Do not retry from the close portrait. Create and ingest medium_body first.",
      maxRetriesRecommended: 0,
      knownBadSourcePromptCombination: true,
    };
  }
  if (assetType === "sit_or_perch_01" && !sourceReady) {
    return {
      retryAllowed: false,
      reason: "Create and ingest seated_or_perched source still first.",
      maxRetriesRecommended: 0,
      knownBadSourcePromptCombination: false,
    };
  }
  if (assetType === "walk_loop_01" && !sourceReady) {
    return {
      retryAllowed: false,
      reason: "Create and ingest full_body or realm_environment source first.",
      maxRetriesRecommended: 0,
      knownBadSourcePromptCombination: false,
    };
  }
  if (assetType === "think_01") {
    return {
      retryAllowed: sourceReady,
      reason: sourceReady
        ? "Retry only with improved compact prompt or approved_motion_reference; lower priority due known slow/no-thinking attempts."
        : "Create an approved_motion_reference or improve close source strategy before retry.",
      maxRetriesRecommended: 1,
      knownBadSourcePromptCombination: true,
    };
  }
  return {
    retryAllowed: sourceReady,
    reason: sourceReady ? "Eligible for one controlled review-required generation attempt." : "Required source category missing.",
    maxRetriesRecommended: sourceReady ? 1 : 0,
    knownBadSourcePromptCombination: false,
  };
}

function statusForAssetType(assetType, sourceReady, approvedByType = new Map()) {
  if (approvedByType.has(assetType)) return "approved";
  if (!sourceReady) return "source_blocked";
  if (assetType === "think_01") return "rejected_or_failed";
  return "needs_generation";
}

function nextActionForStatus(status, assetType) {
  if (status === "approved") return "use existing approved asset";
  if (status === "source_blocked") return "create source still first";
  if (status === "rejected_or_failed") {
    return assetType === "think_01" ? "retry with improved prompt" : "do not retry from current source";
  }
  if (status === "needs_generation") return "generate motion";
  return "unknown";
}

function buildSequenceCandidates(approvedByType = new Map()) {
  const definitions = [
    {
      sequenceId: "conversation_presence_01",
      assetTypes: ["idle_01", "listen_01", "speaking_01"],
      targetDurationSec: 15,
    },
    {
      sequenceId: "greeting_short_01",
      assetTypes: ["gesture_01", "idle_01"],
      targetDurationSec: 10,
    },
    {
      sequenceId: "listening_response_01",
      assetTypes: ["listen_01", "speaking_01"],
      targetDurationSec: 10,
    },
    {
      sequenceId: "calm_presence_loop_01",
      assetTypes: ["idle_01", "listen_01"],
      targetDurationSec: 10,
    },
  ];
  return definitions.map((definition) => {
    const missingAssetTypes = definition.assetTypes.filter((assetType) => !approvedByType.has(assetType));
    return {
      ...definition,
      status: missingAssetTypes.length === 0 ? "ready" : (missingAssetTypes.length === definition.assetTypes.length ? "blocked" : "partial"),
      missingAssetTypes,
      approvedAssetRefs: definition.assetTypes
        .filter((assetType) => approvedByType.has(assetType))
        .map((assetType) => ({
          assetType,
          savedPath: approvedByType.get(assetType)?.savedPath || null,
          metadataPath: approvedByType.get(assetType)?.metadataPath || null,
        })),
      compositionRoute: "/admin/media/sequence-compose-plan",
    };
  });
}

export async function createCommandCenterMediaCatalog(input = {}, runtime = {}) {
  const entityId = normalizeText(input.entityId || input.spiritkinId || "lyra", 120).toLowerCase();
  const packId = normalizeText(input.packId || `${slugify(entityId)}-motion-pack-v1`, 160);
  const requestedAssetTypes = Array.isArray(input.requestedAssetTypes) && input.requestedAssetTypes.length
    ? [...new Set(input.requestedAssetTypes.map((assetType) => normalizeText(assetType, 80)).filter(Boolean))]
    : ["idle_01", "speaking_01", "listen_01", "think_01", "gesture_01", "gesture_02", "greeting_or_entry_01", "sit_or_perch_01", "walk_loop_01"];
  const errors = [];
  if (!entityId) errors.push("entityId is required");
  if (!packId) errors.push("packId is required");
  for (const assetType of requestedAssetTypes) {
    if (!SPIRITKIN_MOTION_PACK_ASSET_TYPES.includes(assetType)) {
      errors.push(`requestedAssetTypes contains unsupported assetType ${assetType}`);
    }
  }
  if (errors.length) {
    throw new ValidationError("Invalid command center media catalog request.", errors);
  }

  const includeApprovedAssets = input.includeApprovedAssets !== false;
  const includeSourceReadiness = input.includeSourceReadiness !== false;
  const includeSequenceCandidates = input.includeSequenceCandidates !== false;
  const includePremiumReadiness = input.includePremiumReadiness !== false;
  const includeFailures = input.includeFailures !== false;
  const discoveredMetadata = includeApprovedAssets
    ? await discoverApprovedMetadataForEntity(entityId, runtime)
    : [];
  const approvedAssets = discoveredMetadata
    .filter((record) => record.assetType && !record.metadataPath.includes("/source_stills/"))
    .filter((record) => record.approvalState === "approved");
  const sourceStillRecords = discoveredMetadata
    .filter((record) => record.sourceCategory && record.metadataPath.includes("/source_stills/"));
  const availableSources = buildAvailableSourcesFromDiscovery(entityId, input, sourceStillRecords);
  const sourcePlan = createSpiritkinSourceReferencePlan({
    entityId,
    packId,
    requestedAssetTypes,
    availableSources,
  });
  const registryPlan = createSourceReferenceRegistryPlan({
    entityId,
    packId,
    requestedAssetTypes,
    availableSources,
  });
  const approvedByType = new Map(approvedAssets.map((asset) => [asset.assetType, asset]));

  const sourceReadiness = includeSourceReadiness
    ? SPIRITKIN_MOTION_SOURCE_CATEGORIES.map((category) => {
      const blockedAssetTypes = sourcePlan.sourceSelections
        .filter((selection) => selection.blockedUntilSourceExists && selection.requiredSourceCategories.includes(category))
        .map((selection) => selection.assetType);
      return {
        sourceCategory: category,
        exists: Boolean(availableSources[category]),
        selectedSourceRef: availableSources[category] || null,
        blockedAssetTypes,
        unlockedAssetTypes: registryPlan.becomesUnblockedBySourceCategory[category] || [],
        recommendation: recommendedStillForSourceCategory(category, entityId),
      };
    })
    : [];

  const motionPackStatus = sourcePlan.sourceSelections.map((selection) => {
    const currentStatus = statusForAssetType(selection.assetType, !selection.blockedUntilSourceExists, approvedByType);
    return {
      assetType: selection.assetType,
      requiredSourceCategory: selection.requiredSourceCategory,
      sourceReady: !selection.blockedUntilSourceExists,
      generationAllowedBySource: !selection.blockedUntilSourceExists,
      generationMode: selection.generationMode,
      assetKind: selection.assetKind,
      shotProfile: selection.shotProfile,
      poseVariant: selection.poseVariant,
      timingIntent: selection.timingIntent,
      motionCompletionRule: selection.motionCompletionRule?.summary || "",
      currentStatus,
      nextRecommendedAction: nextActionForStatus(currentStatus, selection.assetType),
    };
  });

  const retryEligibility = sourcePlan.sourceSelections.map((selection) => {
    const policy = knownPolicyForAssetType(selection.assetType, !selection.blockedUntilSourceExists);
    return {
      assetType: selection.assetType,
      retryAllowed: policy.retryAllowed,
      reason: policy.reason,
      maxRetriesRecommended: policy.maxRetriesRecommended,
      currentRecommendedSourceCategory: selection.selectedSourceCategory || selection.requiredSourceCategory,
      knownBadSourcePromptCombination: policy.knownBadSourcePromptCombination,
    };
  });

  return {
    ok: true,
    entityId,
    packId,
    generatedAt: new Date().toISOString(),
    catalogMode: "read_only",
    sourceReadiness,
    motionPackStatus,
    approvedAssets: includeApprovedAssets ? approvedAssets.map((asset) => ({
      assetType: asset.assetType,
      savedPath: asset.savedPath,
      metadataPath: asset.metadataPath,
      provider: asset.provider || null,
      providerJobId: asset.providerJobId || null,
      durationSec: asset.durationSec,
      ratio: asset.ratio || null,
      generationMode: asset.generationMode || null,
      reviewNotes: asset.reviewNotes || "",
      approvalState: asset.approvalState,
    })) : [],
    approvedAssetDiscoveryMode: includeApprovedAssets ? "limited_filesystem_metadata" : "disabled",
    approvedAssetDiscoveryRecommendation: "Future catalog phases should add a persistent approved asset registry instead of relying on filesystem metadata discovery.",
    failedOrRejectedJobs: includeFailures ? {
      failedJobDiscoveryMode: "not_persistent_yet",
      knownPolicies: [
        "think_01 has known bad attempts from close portrait: slow motion, blurred background, and weak thinking expression.",
        "gesture_02 and greeting_or_entry_01 should not continue from close portrait; require medium_body.",
        "sit_or_perch_01 requires seated_or_perched.",
        "walk_loop_01 requires full_body or realm_environment.",
      ],
      recommendation: "Add a persistent failed-job registry before premium self-generation or large motion batches.",
    } : null,
    retryEligibility,
    sequenceCandidates: includeSequenceCandidates ? buildSequenceCandidates(approvedByType) : [],
    premiumReadiness: includePremiumReadiness ? {
      premiumGenerationEnabled: false,
      blockers: PREMIUM_MEMBER_GENERATION_BOUNDARY.readinessChecklist || [],
      missingSystems: [
        "server-side Runway key",
        "budget tracker",
        "queue",
        "auto-review scorer",
        "failed-job registry",
        "source still starter pack",
        "partial activation rules",
        "admin exception review",
      ],
    } : null,
    commandCenterActions: [
      "create Lyra medium_body source still",
      "ingest approved medium_body source still",
      "rerun source-reference plan",
      "generate gesture_02 from medium_body",
      "generate greeting_or_entry_01 from medium_body",
      "create seated_or_perched still",
      "create full_body still",
      "compose approved short sequence from existing approved clips",
    ],
    externalApiCall: false,
    noIngestPerformed: true,
    premiumGenerationEnabled: false,
    ...lifecycleNoWriteFlags(),
  };
}

function normalizeApprovedSequenceAsset(input = {}, index = 0) {
  const sourceRef = normalizeText(input.sourceRef || input.path || input.assetPath || input.approvedPath, 1200);
  const status = canonicalize(input.status || input.reviewStatus || "approved");
  const assetType = normalizeText(input.assetType || `clip_${index + 1}`, 80);
  const durationSec = Number(input.durationSec || 5);
  const validationErrors = [];
  const isApprovedPath = sourceRef.startsWith("Spiritverse_MASTER_ASSETS/APPROVED/")
    || sourceRef.startsWith("Spiritverse_MASTER_ASSETS\\APPROVED\\");
  if (!sourceRef) validationErrors.push("sourceRef is required");
  if (status !== "approved") validationErrors.push("status must be approved");
  if (!isApprovedPath) validationErrors.push("sourceRef must point to Spiritverse_MASTER_ASSETS/APPROVED");
  if (sourceRef.includes("/ACTIVE/") || sourceRef.includes("\\ACTIVE\\")) validationErrors.push("sourceRef must not point to ACTIVE");
  if (!/\.mp4$/i.test(sourceRef)) validationErrors.push("approved asset sourceRef must be an mp4");
  if (!Number.isFinite(durationSec) || durationSec <= 0) validationErrors.push("durationSec must be positive");
  return {
    index: index + 1,
    assetId: normalizeText(input.assetId || `${assetType}_${index + 1}`, 160),
    entityId: normalizeText(input.entityId, 120),
    packId: normalizeText(input.packId, 160),
    assetType,
    variant: normalizeText(input.variant || "v1", 80),
    status,
    sourceRef,
    durationSec: Number((Number.isFinite(durationSec) ? durationSec : 0).toFixed(3)),
    role: normalizeText(input.role || assetType, 120),
    valid: validationErrors.length === 0,
    validationErrors,
  };
}

export function createSequenceComposePlan(input = {}, runtime = {}) {
  const entityId = normalizeText(input.entityId, 120).toLowerCase();
  const packId = normalizeText(input.packId, 160);
  const sequenceId = slugify(input.sequenceId, "");
  const targetDurationSec = Number(input.targetDurationSec || 0);
  const transitionStyle = canonicalize(input.transitionStyle || "soft_cut");
  const approvedAssets = Array.isArray(input.approvedAssets)
    ? input.approvedAssets.map(normalizeApprovedSequenceAsset)
    : [];
  const errors = [];
  if (!entityId) errors.push("entityId is required");
  if (!packId) errors.push("packId is required");
  if (!sequenceId) errors.push("sequenceId is required");
  if (!approvedAssets.length) errors.push("approvedAssets are required");
  if (!Number.isFinite(targetDurationSec) || targetDurationSec <= 0) errors.push("targetDurationSec must be positive");
  for (const asset of approvedAssets) {
    errors.push(...asset.validationErrors.map((error) => `approvedAssets[${asset.index - 1}]: ${error}`));
  }
  if (errors.length) {
    throw new ValidationError("Invalid sequence composition plan request.", errors);
  }

  const orderedApprovedClips = approvedAssets.map((asset, index) => ({
    ...asset,
    order: index + 1,
    sequenceRole: index === 0 ? "opening" : (index === approvedAssets.length - 1 ? "resolution" : "middle"),
    transitionIn: index === 0 ? "none" : transitionStyle,
    transitionOut: index === approvedAssets.length - 1 ? "resolve_to_loop_or_hold" : transitionStyle,
  }));
  const totalDuration = Number(orderedApprovedClips.reduce((sum, clip) => sum + clip.durationSec, 0).toFixed(3));
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const fileName = `${slugify(entityId)}_${slugify(packId)}_${sequenceId}_sequence_review_${date}.mp4`;
  const reviewPath = `Spiritverse_MASTER_ASSETS/REVIEW/${entityId}/sequence/${fileName}`;
  const metadataPath = reviewPath.replace(/\.mp4$/i, ".metadata.json");

  return {
    ok: true,
    planId: `sequence_compose_${slugify(entityId)}_${sequenceId}_${Date.now()}`,
    entityId,
    packId,
    sequenceId,
    targetDurationSec,
    transitionStyle,
    orderedApprovedClips,
    totalDuration,
    durationDeltaSec: Number((totalDuration - targetDurationSec).toFixed(3)),
    transitionInstructions: [
      `Use ${transitionStyle} between approved clips only.`,
      "Preserve clip order and do not interpolate new generated content.",
      "Keep the composed sequence review_required until operator approval.",
    ],
    outputNamingPlan: {
      fileName,
      reviewPath,
      metadataPath,
      activePath: null,
      publicPath: null,
    },
    compositionTooling: {
      ffmpegAvailable: Boolean(runtime.ffmpegAvailable),
      executionEnabled: Boolean(runtime.ffmpegExecutionEnabled),
      stitchMethod: "local_ffmpeg_concat_when_enabled",
    },
    lifecycleState: "review_required",
    reviewStatus: "pending",
    operatorApprovalRequired: true,
    noCompositionPerformed: true,
    noIngestPerformed: true,
    ...lifecycleNoWriteFlags(),
  };
}

export function createSequenceComposeExecutionResult(input = {}, runtime = {}) {
  const plan = createSequenceComposePlan(input, runtime);
  const executionEnabled = Boolean(runtime.ffmpegAvailable && runtime.ffmpegExecutionEnabled && runtime.sequenceCompositionEnabled);
  if (!executionEnabled) {
    return {
      ok: false,
      plannedOnly: true,
      provider: "local_ffmpeg",
      reason: "sequence composition execution is disabled; validated approved clips and returned a review-space composition plan only",
      compositionPlan: plan,
      lifecycleState: "review_required",
      outputAsset: {
        savedPath: null,
        metadataPath: null,
        plannedReviewPath: plan.outputNamingPlan.reviewPath,
        plannedMetadataPath: plan.outputNamingPlan.metadataPath,
      },
      noCompositionPerformed: true,
      ...lifecycleNoWriteFlags(),
    };
  }

  return {
    ok: false,
    plannedOnly: true,
    provider: "local_ffmpeg",
    reason: "review-space video writer is not implemented in this phase; execution remains disabled even when ffmpeg is present",
    compositionPlan: plan,
    lifecycleState: "review_required",
    outputAsset: {
      savedPath: null,
      metadataPath: null,
      plannedReviewPath: plan.outputNamingPlan.reviewPath,
      plannedMetadataPath: plan.outputNamingPlan.metadataPath,
    },
    noCompositionPerformed: true,
    ...lifecycleNoWriteFlags(),
  };
}

export function createSpiritkinMotionStateExecutionPlan(input = {}) {
  const spiritkinId = normalizeText(input.spiritkinId, 120).toLowerCase();
  const canonicalName = canonicalSpiritkinName(spiritkinId);
  const manifest = getSpiritkinMediaManifest(canonicalName);
  if (!manifest) {
    throw new ValidationError("Invalid Spiritkin motion state target.", [`spiritkinId ${input.spiritkinId || ""} is not an existing allowed Spiritkin`]);
  }
  const targetId = normalizeText(input.targetId || `${spiritkinId}-motion-pack-v1`, 160);
  const assetType = normalizeText(input.assetType || "speaking_01", 80);
  if (!SPIRITKIN_MOTION_PACK_ASSET_TYPES.includes(assetType)) {
    throw new ValidationError("Invalid Spiritkin motion asset type.", [`assetType must be one of ${SPIRITKIN_MOTION_PACK_ASSET_TYPES.join(", ")}`]);
  }
  const expectedAssetKind = motionAssetKindForType(assetType);
  const assetKind = normalizeSpiritCoreMediaAssetKind(input.assetKind || expectedAssetKind);
  if (assetKind !== expectedAssetKind) {
    throw new ValidationError("Invalid Spiritkin motion asset kind.", [`assetKind must be ${expectedAssetKind} for assetType ${assetType}`]);
  }
  const sourceAssetRef = normalizeText(input.sourceAssetRef, 1200);
  if (!sourceAssetRef) {
    throw new ValidationError("Invalid Spiritkin motion source.", ["sourceAssetRef is required"]);
  }
  const sourceAssetType = normalizeSourceMediaType(input.sourceAssetType || input.sourceType) || "external_url";
  const controlsResult = normalizeMotionGenerationControls(input);
  if (!controlsResult.ok) {
    throw new ValidationError("Invalid Spiritkin motion generation controls.", controlsResult.errors);
  }
  const generationControls = controlsResult.controls;
  const promptIntent = normalizeText(input.promptIntent || `Animate ${canonicalName} into a premium ${assetType} loop for SpiritCore conversation responses.`, 1000);
  const styleProfile = normalizeText(input.styleProfile || "premium cinematic Spiritverse companion, elegant, emotionally alive, screen-present avatar realism", 360);
  const safetyLevel = normalizeText(input.safetyLevel || "internal_review", 80);
  const stateTrigger = stateTriggerForAssetType(assetType);
  const finalPromptIntent = buildMotionGenerationPrompt({
    canonicalName,
    assetType,
    stateTrigger,
    promptIntent,
    styleProfile,
    controls: generationControls,
  });
  const mediaAssetRecord = buildMediaAssetRecord({
    spiritkinId,
    targetId,
    targetType: "spiritkin",
    assetKind,
    lifecycleState: "review_required",
    reviewStatus: "pending",
    promotionStatus: "not_requested",
    activeStatus: "inactive",
    provider: "runway",
    providerJobId: input.providerJobId,
    sourceAssetRefs: [sourceAssetRef],
    promptIntent: finalPromptIntent,
    styleProfile,
    safetyLevel,
    versionTag: input.versionTag || `${slugify(spiritkinId)}-${slugify(assetType)}-${Date.now()}`,
    artifactFileName: `${slugify(assetType)}.mp4`,
    notes: `${canonicalName} ${assetType} generated output must remain review_required until operator approval.`,
  });
  const validation = validateMediaAssetRecord(mediaAssetRecord);
  if (!validation.ok) {
    throw new ValidationError("Invalid Spiritkin motion media asset record.", validation.errors);
  }

  return {
    ok: true,
    spiritkinId,
    canonicalName,
    targetId,
    assetType,
    assetKind,
    stateTrigger,
    generationControls,
    sourceAssetRef,
    sourceAssetType,
    promptIntent: finalPromptIntent,
    styleProfile,
    safetyLevel,
    mediaAssetRecord,
    providerTarget: {
      provider: "runway",
      providerMode: sourceAssetType.includes("video") ? "video_to_video" : "image_to_video",
      recommendedModel: sourceAssetType.includes("video") ? "gen4_aleph" : "gen4_turbo",
      endpointPath: sourceAssetType.includes("video") ? "/v1/video_to_video" : "/v1/image_to_video",
      textToImageAllowed: false,
    },
    commandCenterMetadata: {
      sourceAssetRequired: true,
      modelToolRecommendation: sourceAssetType.includes("video")
        ? "Runway video_to_video with gen4_aleph"
        : "Runway image_to_video with gen4_turbo",
      operatorApprovalRequired: true,
      estimatedProviderTarget: sourceAssetType.includes("video") ? "video_to_video" : "image_to_video",
      generationStatus: input.providerJobId ? "submitted" : "not_submitted",
      reviewStatus: "pending",
      promotionDisabledUntilApproval: true,
      statusCheckRoute: "POST /admin/runway/status-check",
    },
    premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
  };
}

export function createSpiritCoreAvatarPackPlan(input = {}) {
  const targetId = normalizeText(input.targetId || "spiritcore-avatar-pack-v1", 160);
  const avatarType = normalizeText(input.avatarType || "human_agent", 120);
  const styleProfile = normalizeText(input.styleProfile || "ultra-premium cinematic human AI operator, serious, elegant, futuristic, emotionally intelligent", 420);
  const safetyLevel = normalizeText(input.safetyLevel || "internal_review", 80);
  const plannedAssets = SPIRITCORE_AVATAR_PACK_ASSET_TYPES.map((assetType) => buildMotionAssetPlan({
    assetType,
    targetId,
    subjectType: "spiritcore",
    subjectId: "spiritcore",
    styleProfile,
    safetyLevel,
    sourceRefs: [],
  }));

  return {
    ok: true,
    targetId,
    subjectType: "spiritcore",
    avatarType,
    tone: ["serious", "premium", "cinematic", "elegant"],
    lifecycleState: "planning_only",
    safetyLevel,
    mediaPackReadiness: {
      idle: "planned",
      speaking: "planned",
      gesture: "planned",
      entrance: "planned",
      seatedListening: "planned",
      thinking: "planned",
      realmPresence: "planned",
      readyForGeneration: false,
      reviewRequiredBeforePromotion: true,
    },
    plannedAssets,
    continuityRules: [
      "SpiritCore avatar is the default operator presence, not a replacement for optional Spiritkins",
      "visual tone should be serious, premium, cinematic, elegant, and emotionally intelligent",
      "states must support assistant-like utility without copying any competitor experience",
      "all outputs remain review_required before promotion",
    ],
    reviewChecklist: [
      "operator authority presence is clear",
      "avatar remains suitable for users without Spiritkins",
      "motion states are non-intrusive",
      "visual quality meets premium default operator expectations",
      "operator approval required before any promotion",
    ],
    ...lifecycleNoWriteFlags(),
  };
}

function normalizeSegment(input = {}, index = 0) {
  const sourceRef = normalizeText(input.sourceRef, 1200);
  const startSec = clampNumber(input.startSec, 0, 0, 3600);
  const requestedEnd = Number(input.endSec);
  const endSec = Number.isFinite(requestedEnd) && requestedEnd > startSec
    ? Math.min(requestedEnd, 3600)
    : Math.min(startSec + 5, 3600);
  return {
    index: index + 1,
    sourceRef,
    startSec: Number(startSec.toFixed(3)),
    endSec: Number(endSec.toFixed(3)),
    durationSec: Number((endSec - startSec).toFixed(3)),
    role: normalizeText(input.role || `segment_${index + 1}`, 120),
    sourceType: /^https?:\/\//i.test(sourceRef) ? "remote_url" : "local_or_storage_ref",
    valid: Boolean(sourceRef) && endSec > startSec,
    validationErrors: [
      ...(!sourceRef ? ["sourceRef is required"] : []),
      ...(endSec <= startSec ? ["endSec must be greater than startSec"] : []),
    ],
  };
}

export function createMediaAssemblyPlan(input = {}, runtime = {}) {
  const assemblyType = normalizeText(input.assemblyType || "sequence_video", 120);
  const targetId = normalizeText(input.targetId || "media-assembly", 160);
  const outputLabel = slugify(input.outputLabel || `${targetId}-review-sequence`, "review-sequence");
  const safetyLevel = normalizeText(input.safetyLevel || "internal_review", 80);
  const segments = Array.isArray(input.segments) ? input.segments : [];
  const validatedSegments = segments.map(normalizeSegment);
  const errors = [];
  if (assemblyType !== "sequence_video") errors.push("assemblyType must be sequence_video");
  if (!targetId) errors.push("targetId is required");
  if (!validatedSegments.length) errors.push("segments are required");
  for (const segment of validatedSegments) {
    errors.push(...segment.validationErrors.map((error) => `segment ${segment.index}: ${error}`));
  }
  const ffmpegAvailable = Boolean(runtime.ffmpegAvailable);
  const ffmpegExecutionEnabled = Boolean(runtime.ffmpegExecutionEnabled);
  const executionReady = errors.length === 0 && ffmpegAvailable && ffmpegExecutionEnabled;
  const estimatedOutputDuration = Number(validatedSegments.reduce((sum, segment) => sum + (segment.valid ? segment.durationSec : 0), 0).toFixed(3));

  return {
    ok: errors.length === 0,
    planId: `assembly_plan_${slugify(targetId)}_${Date.now()}`,
    assemblyType,
    targetId,
    outputLabel,
    safetyLevel,
    validatedSegments,
    estimatedOutputDuration,
    executionReady,
    ffmpegAvailable,
    ffmpegExecutionEnabled,
    stitchMethod: executionReady ? "local_ffmpeg_trim_concat" : "planned_adapter_only",
    lifecycleState: "review_required",
    outputCandidate: {
      provider: "local_ffmpeg",
      reviewPath: `Spiritverse_MASTER_ASSETS/REVIEW/assembled/${slugify(targetId)}/${outputLabel}.mp4`,
      activePath: null,
      publicPath: null,
    },
    validationErrors: errors,
    executionBlockReason: executionReady
      ? null
      : (errors.length ? "assembly input validation failed" : "ffmpeg execution is unavailable or not explicitly enabled"),
    ...lifecycleNoWriteFlags({ noAssemblyPerformed: true }),
  };
}

export function createSafeVideoAssemblyResult(input = {}, runtime = {}) {
  const plan = createMediaAssemblyPlan(input, runtime);
  if (!plan.executionReady) {
    return {
      ok: false,
      provider: "local_ffmpeg",
      plannedOnly: true,
      reason: plan.executionBlockReason,
      assemblyPlan: plan,
      lifecycleState: "review_required",
      noPromotionPerformed: true,
      noManifestUpdatePerformed: true,
      noActiveWritePerformed: true,
    };
  }
  return {
    ok: false,
    provider: "local_ffmpeg",
    plannedOnly: true,
    reason: "ffmpeg execution adapter is intentionally not enabled in this phase; use assembly-plan until the review-space writer is implemented.",
    assemblyPlan: plan,
    lifecycleState: "review_required",
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
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
    spiritkinMotionSourceCategories: [...SPIRITKIN_MOTION_SOURCE_CATEGORIES],
    spiritkinMotionSourceCategoryRules: { ...SPIRITKIN_MOTION_SOURCE_CATEGORY_RULES },
    premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
    defaultOperatorTypes: [...SPIRITCORE_DEFAULT_OPERATOR_TYPES],
    spiritkinMotionPackAssetTypes: [...SPIRITKIN_MOTION_PACK_ASSET_TYPES],
    spiritcoreAvatarPackAssetTypes: [...SPIRITCORE_AVATAR_PACK_ASSET_TYPES],
    routes: [
      "POST /admin/media/asset-plan",
      "POST /admin/media/requirements-check",
      "POST /admin/media/generation-template",
      "POST /admin/media/review-plan",
      "POST /admin/media/promotion-plan",
      "POST /admin/media/production-sequence-plan",
      "POST /admin/media/operator-experience-plan",
      "POST /admin/media/motion-pack-plan",
      "POST /admin/media/spiritkin-source-reference-plan",
      "POST /admin/media/spiritkin-motion-pack-plan",
      "GET /admin/media/spiritkin-source-summary/:spiritkinId",
      "POST /admin/media/spiritkin-motion-state-execute",
      "POST /admin/media/spiritcore-avatar-pack-plan",
      "POST /admin/media/assembly-plan",
      "POST /admin/media/assemble-video",
      "POST /admin/media/sequence-compose-plan",
      "POST /admin/media/sequence-compose-execute",
      "POST /admin/media/source-still-ingest",
      "POST /admin/media/source-reference-plan",
      "POST /admin/media/source-reference-registry-plan",
      "POST /admin/media/command-center-catalog",
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
