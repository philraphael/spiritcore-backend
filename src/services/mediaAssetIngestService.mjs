import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "../errors.mjs";

const DEFAULT_ROOT = "Spiritverse_MASTER_ASSETS";
const ALLOWED_STATUSES = new Set(["approved"]);
const VIDEO_ASSET_TYPES = new Set([
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
  "idle_video",
  "speaking_video",
  "listening_video",
  "greeting_video",
  "spiritgate_video",
  "trailer_video",
  "wake_visual",
]);

function nowIso() {
  return new Date().toISOString();
}

function yyyymmdd(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function normalizeText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function slugPart(value, fallback = "asset") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

function shortJobId(value = "") {
  const cleaned = slugPart(value, "job").replace(/_/g, "");
  return cleaned.slice(0, 10) || "job";
}

function categoryForAssetType(assetType = "") {
  const normalized = slugPart(assetType, "media");
  if (VIDEO_ASSET_TYPES.has(normalized) || normalized.endsWith("_video")) return "video";
  return "media";
}

function safeJoin(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const absoluteTarget = path.resolve(absoluteRoot, relativePath);
  if (absoluteTarget !== absoluteRoot && !absoluteTarget.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new ValidationError("Resolved media ingest path escaped the configured asset root.", ["path"]);
  }
  return absoluteTarget;
}

function parseDataUrl(value = "") {
  const match = String(value).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  const encoded = match[3] || "";
  return match[2]
    ? Buffer.from(encoded, "base64")
    : Buffer.from(decodeURIComponent(encoded), "utf8");
}

async function defaultDownloadAsset(outputUrl, { allowDataUrl = false } = {}) {
  const url = String(outputUrl || "").trim();
  if (allowDataUrl && url.startsWith("data:")) {
    const dataBuffer = parseDataUrl(url);
    if (!dataBuffer?.length) {
      throw new ValidationError("data outputUrl could not be decoded.", ["outputUrl"]);
    }
    return dataBuffer;
  }

  if (!/^https:\/\//i.test(url)) {
    throw new ValidationError("outputUrl must be HTTPS for media ingest.", ["outputUrl"]);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new ValidationError("outputUrl could not be downloaded for media ingest.", [`providerHttpStatus:${response.status}`]);
  }
  return Buffer.from(await response.arrayBuffer());
}

export function buildMediaAssetIngestRecord(input = {}, options = {}) {
  const entityId = slugPart(input.entityId, "");
  const packId = slugPart(input.packId, "");
  const assetType = slugPart(input.assetType, "");
  const variant = slugPart(input.variant || "v1", "v1");
  const status = slugPart(input.status, "");
  const provider = slugPart(input.provider || "runway", "runway");
  const providerJobId = normalizeText(input.providerJobId, 160);
  const outputUrl = String(input.outputUrl || "").trim();
  const sourceAssetRef = normalizeText(input.sourceAssetRef, 1000);
  const category = categoryForAssetType(assetType);
  const createdAt = options.now ? new Date(options.now) : new Date();
  const fileName = `${entityId}_${packId}_${assetType}_${variant}_${status}_${yyyymmdd(createdAt)}_${shortJobId(providerJobId)}.mp4`;
  const approvedRelativeDir = path.posix.join(DEFAULT_ROOT, "APPROVED", entityId, category);
  const approvedRelativePath = path.posix.join(approvedRelativeDir, fileName);
  const metadataRelativePath = approvedRelativePath.replace(/\.mp4$/i, ".metadata.json");
  const rawArchiveRelativePath = path.posix.join(
    DEFAULT_ROOT,
    "ARCHIVE",
    "raw_provider_exports",
    entityId,
    fileName,
  );

  return {
    entityId,
    packId,
    assetType,
    variant,
    status,
    provider,
    providerJobId,
    outputUrl,
    sourceAssetRef,
    durationSec: Number.isFinite(Number(input.durationSec)) ? Number(input.durationSec) : null,
    ratio: normalizeText(input.ratio, 40),
    generationMode: normalizeText(input.generationMode, 80),
    reviewNotes: normalizeText(input.reviewNotes, 2000),
    approvedBy: normalizeText(input.approvedBy, 120),
    category,
    fileName,
    approvedRelativeDir,
    approvedRelativePath,
    metadataRelativePath,
    rawArchiveRelativePath,
    archiveRawProviderExport: Boolean(input.archiveRawProviderExport),
    approvalState: status,
    activePromotionPerformed: false,
    noActiveWritePerformed: true,
    noManifestUpdatePerformed: true,
    providerGenerationPerformed: false,
    createdAt: createdAt.toISOString(),
  };
}

export function validateMediaAssetIngestRecord(record = {}) {
  const errors = [];
  if (!record.entityId) errors.push("entityId is required");
  if (!record.packId) errors.push("packId is required");
  if (!record.assetType) errors.push("assetType is required");
  if (!record.variant) errors.push("variant is required");
  if (!record.status) errors.push("status is required");
  if (!ALLOWED_STATUSES.has(record.status)) errors.push("status must be approved for ingest into APPROVED");
  if (!record.provider) errors.push("provider is required");
  if (!record.providerJobId) errors.push("providerJobId is required");
  if (!record.outputUrl) errors.push("outputUrl is required");
  if (!record.sourceAssetRef) errors.push("sourceAssetRef is required");
  if (!record.approvedBy) errors.push("approvedBy is required");
  if (!record.fileName.endsWith(".mp4")) errors.push("ingested media filename must end in .mp4");
  if (record.approvedRelativePath.includes("/ACTIVE/")) errors.push("ingest path must not target ACTIVE");
  return {
    ok: errors.length === 0,
    errors,
  };
}

export async function ingestReviewedMediaAsset(input = {}, options = {}) {
  const record = buildMediaAssetIngestRecord(input, options);
  const validation = validateMediaAssetIngestRecord(record);
  if (!validation.ok) {
    throw new ValidationError("Invalid reviewed media asset ingest request.", validation.errors);
  }

  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const assetPath = safeJoin(workspaceRoot, record.approvedRelativePath);
  const metadataPath = safeJoin(workspaceRoot, record.metadataRelativePath);
  const rawArchivePath = safeJoin(workspaceRoot, record.rawArchiveRelativePath);
  const downloadAsset = options.downloadAsset || defaultDownloadAsset;
  const binary = await downloadAsset(record.outputUrl, {
    allowDataUrl: Boolean(options.allowDataUrl),
  });

  if (!Buffer.isBuffer(binary) || binary.length === 0) {
    throw new ValidationError("Downloaded media asset was empty.", ["outputUrl"]);
  }

  const checksumSha256 = createHash("sha256").update(binary).digest("hex");
  const metadata = {
    ...record,
    savedPath: record.approvedRelativePath,
    metadataPath: record.metadataRelativePath,
    rawArchivePath: record.archiveRawProviderExport ? record.rawArchiveRelativePath : null,
    checksumSha256,
    byteLength: binary.length,
    ingestedAt: nowIso(),
    lifecycleState: "approved",
    reviewStatus: "approved",
    promotionStatus: "not_promoted",
    activeStatus: "inactive",
    activePromotionPerformed: false,
    noActiveWritePerformed: true,
    noManifestUpdatePerformed: true,
  };

  await mkdir(path.dirname(assetPath), { recursive: true });
  await writeFile(assetPath, binary);
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

  if (record.archiveRawProviderExport) {
    await mkdir(path.dirname(rawArchivePath), { recursive: true });
    await writeFile(rawArchivePath, binary);
  }

  return {
    ok: true,
    savedPath: record.approvedRelativePath,
    metadataPath: record.metadataRelativePath,
    rawArchivePath: record.archiveRawProviderExport ? record.rawArchiveRelativePath : null,
    approvalState: "approved",
    activePromotionPerformed: false,
    noActiveWritePerformed: true,
    noManifestUpdatePerformed: true,
    providerGenerationPerformed: false,
    metadata,
  };
}
