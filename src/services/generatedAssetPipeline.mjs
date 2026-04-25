import { randomUUID } from "crypto";
import { ValidationError } from "../errors.mjs";
import { normalizeRunwayAssetKind, RUNWAY_SUPPORTED_ASSET_KINDS } from "./runwayProvider.mjs";

export const GENERATED_ASSET_LIFECYCLE_DIRECTORIES = Object.freeze([
  "INCOMING",
  "REVIEW",
  "APPROVED",
  "ACTIVE",
  "REJECTED",
  "ARCHIVE",
]);

const VIDEO_KINDS = new Set(["idle_video", "speaking_video", "calm_video", "trailer"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov"]);
const SPIRITKIN_MANIFEST_SLOTS = Object.freeze({
  portrait: "portrait",
  hero: "heroImage",
  idle_video: "idleVideo",
  speaking_video: "speakingVideo",
  calm_video: "calmVideo",
  trailer: "trailerVideo",
});

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function slugify(value, fallback = "asset") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function cleanRelativePath(value) {
  const normalized = String(value || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return "";
  return normalized;
}

function extensionFromPath(value, fallback = "") {
  const match = String(value || "").toLowerCase().match(/\.([a-z0-9]+)(?:\?|#)?$/);
  return match?.[1] || fallback;
}

function mediaTypeForKind(assetKind) {
  return VIDEO_KINDS.has(assetKind) ? "video" : "image";
}

function extensionForRecord(record) {
  const fallback = VIDEO_KINDS.has(record.assetKind) ? "mp4" : "png";
  return extensionFromPath(record.sourcePath, fallback);
}

function targetDescriptor(input = {}, assetKind = "") {
  const targetId = normalizeText(input.targetId, 120);
  const spiritkinId = normalizeText(input.spiritkinId || input.spiritkinName, 120);
  const realmId = normalizeText(input.realmId || targetId, 120);
  const gameType = normalizeText(input.gameType || targetId, 80);
  const themeId = normalizeText(input.themeId || "generated-theme", 80);

  if (assetKind === "realm_background") {
    return {
      targetType: "realm",
      targetId: realmId,
      targetSlug: slugify(realmId, "realm"),
      themeSlug: null,
      requiredLabel: "realmId or targetId",
      familyPath: `realms/${slugify(realmId, "realm")}`,
    };
  }

  if (assetKind === "game_board_theme" || assetKind === "game_piece_set") {
    return {
      targetType: "game",
      targetId: gameType,
      targetSlug: slugify(gameType, "game"),
      themeSlug: slugify(themeId, "theme"),
      requiredLabel: "gameType or targetId",
      familyPath: `games/${slugify(gameType, "game")}/${slugify(themeId, "theme")}`,
    };
  }

  const id = spiritkinId || targetId;
  return {
    targetType: "spiritkin",
    targetId: id,
    targetSlug: slugify(id, "spiritkin"),
    themeSlug: null,
    requiredLabel: "spiritkinId or targetId",
    familyPath: `spiritkins/${slugify(id, "spiritkin")}`,
  };
}

function manifestTargetFor(record) {
  if (record.targetType === "spiritkin") {
    return {
      manifest: "spiritkins-app/data/spiritkinMediaManifest.js",
      spiritkinId: record.targetId,
      slot: SPIRITKIN_MANIFEST_SLOTS[record.assetKind] || null,
      updateMode: "operator_reviewed_manual_update",
    };
  }

  if (record.targetType === "realm") {
    return {
      manifest: "future realm/generated asset overlay",
      realmId: record.targetId,
      slot: "background",
      updateMode: "operator_reviewed_manual_update",
    };
  }

  return {
    manifest: "spiritkins-app/data/gameAssetManifest.js or future generated game overlay",
    gameType: record.targetId,
    themeId: record.themeId,
    slot: record.assetKind,
    updateMode: "operator_reviewed_manual_update",
  };
}

export function buildGeneratedAssetRecord(input = {}) {
  const assetKind = normalizeRunwayAssetKind(input.assetKind);
  const target = targetDescriptor(input, assetKind || "portrait");
  const versionTag = slugify(input.versionTag || input.providerJobId || `gen-${Date.now()}`, "generated");
  const sourcePath = cleanRelativePath(input.sourcePath || input.artifactPath || "");
  const ext = extensionFromPath(sourcePath, VIDEO_KINDS.has(assetKind) ? "mp4" : "png");

  return {
    id: normalizeText(input.id || input.assetId, 120) || randomUUID(),
    provider: normalizeText(input.provider || "runway", 40),
    providerJobId: normalizeText(input.providerJobId, 120) || null,
    lifecycleState: normalizeText(input.lifecycleState || "review_required", 40),
    sourcePath,
    sourceKind: normalizeText(input.sourceKind || "generated_artifact", 80),
    artifactFileName: normalizeText(input.artifactFileName || `artifact.${ext}`, 120),
    metadataFileName: normalizeText(input.metadataFileName || "metadata.json", 120),
    assetKind,
    mediaType: mediaTypeForKind(assetKind),
    extension: ext,
    targetType: target.targetType,
    targetId: target.targetId,
    targetSlug: target.targetSlug,
    familyPath: target.familyPath,
    spiritkinId: target.targetType === "spiritkin" ? target.targetId : null,
    realmId: target.targetType === "realm" ? target.targetId : null,
    gameType: target.targetType === "game" ? target.targetId : null,
    themeId: target.targetType === "game" ? (normalizeText(input.themeId || "generated-theme", 80)) : null,
    themeSlug: target.themeSlug,
    versionTag,
    requestedBy: normalizeText(input.requestedBy || "admin_promotion_plan", 80),
    reviewNotes: normalizeText(input.reviewNotes, 1000),
    createdAt: nowIso(),
  };
}

export function validateGeneratedAssetRecord(record = {}) {
  const errors = [];

  if (!record.id) errors.push("id is required");
  if (!record.sourcePath) errors.push("sourcePath is required");
  if (!record.assetKind || !RUNWAY_SUPPORTED_ASSET_KINDS.includes(record.assetKind)) {
    errors.push("assetKind must be one of the supported generated asset kinds");
  }
  if (!record.targetId) {
    errors.push(`${targetDescriptor(record, record.assetKind).requiredLabel} is required`);
  }
  if (!record.versionTag) errors.push("versionTag is required");

  const ext = String(record.extension || extensionForRecord(record)).toLowerCase();
  if (VIDEO_KINDS.has(record.assetKind) && !VIDEO_EXTENSIONS.has(ext)) {
    errors.push("video asset kinds must use mp4, webm, or mov artifacts");
  }
  if (!VIDEO_KINDS.has(record.assetKind) && !IMAGE_EXTENSIONS.has(ext)) {
    errors.push("image asset kinds must use png, jpg, jpeg, or webp artifacts");
  }

  if (String(record.lifecycleState || "").toLowerCase() === "promoted") {
    errors.push("already-promoted assets cannot be promotion-planned without rollback review");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function proposeReviewPath(record = {}) {
  return `Spiritverse_MASTER_ASSETS/REVIEW/generated/${record.familyPath}/${record.assetKind}/${record.versionTag}/${record.artifactFileName}`;
}

export function proposeActivePath(record = {}) {
  return `Spiritverse_MASTER_ASSETS/ACTIVE/generated/${record.familyPath}/${record.assetKind}/${record.versionTag}/${record.artifactFileName}`;
}

export function proposePublicPath(record = {}) {
  return `/app/assets/generated/${record.familyPath}/${record.assetKind}/${record.versionTag}/${record.artifactFileName}`;
}

function proposeApprovedPath(record = {}) {
  return `Spiritverse_MASTER_ASSETS/APPROVED/generated/${record.familyPath}/${record.assetKind}/${record.versionTag}/${record.artifactFileName}`;
}

function proposeRejectedPath(record = {}) {
  return `Spiritverse_MASTER_ASSETS/REJECTED/generated/${record.familyPath}/${record.assetKind}/${record.versionTag}/${record.artifactFileName}`;
}

function proposeArchivePath(record = {}) {
  return `Spiritverse_MASTER_ASSETS/ARCHIVE/generated/${record.familyPath}/${record.assetKind}/${record.versionTag}/${record.artifactFileName}`;
}

function metadataPathFor(artifactPath, metadataFileName = "metadata.json") {
  return String(artifactPath || "").replace(/\/[^/]+$/, `/${metadataFileName}`);
}

export function createPromotionPlan(input = {}) {
  const record = input?.assetKind ? buildGeneratedAssetRecord(input) : input;
  const validation = validateGeneratedAssetRecord(record);
  if (!validation.ok) {
    throw new ValidationError("Invalid generated asset promotion record.", validation.errors);
  }

  const reviewPath = proposeReviewPath(record);
  const activePath = proposeActivePath(record);
  const publicPath = proposePublicPath(record);
  const approvedPath = proposeApprovedPath(record);
  const rejectedPath = proposeRejectedPath(record);
  const rollbackPath = proposeArchivePath(record);

  return {
    sourcePath: record.sourcePath,
    reviewPath,
    activePath,
    publicPath,
    manifestTarget: manifestTargetFor(record),
    requiredChecks: [
      "operator approval recorded",
      "source artifact exists and checksum is captured",
      "asset kind matches target manifest slot",
      "file extension and media type are valid",
      "safety and identity review passed",
      "no existing ACTIVE asset is overwritten",
      "metadata.json is preserved with prompt and provider job id",
      "public path resolves after promotion",
      "rollback copy is available before manifest update",
    ],
    rollbackPath,
    operatorApprovalRequired: true,
    noFileWrites: true,
    noManifestUpdates: true,
    lifecycleDirectories: [...GENERATED_ASSET_LIFECYCLE_DIRECTORIES],
    reviewMetadataPath: metadataPathFor(reviewPath, record.metadataFileName),
    activeMetadataPath: metadataPathFor(activePath, record.metadataFileName),
    approvedPath,
    rejectedPath,
    record,
  };
}
