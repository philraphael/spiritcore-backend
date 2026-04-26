import { randomUUID } from "crypto";
import { ValidationError } from "../errors.mjs";

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
    routes: [
      "POST /admin/media/asset-plan",
      "POST /admin/media/requirements-check",
      "POST /admin/media/generation-template",
      "POST /admin/media/review-plan",
      "POST /admin/media/promotion-plan",
      "GET /admin/media/catalog-summary",
    ],
    noProviderCall: true,
    noManifestUpdates: true,
    noActiveWrites: true,
  };
}
