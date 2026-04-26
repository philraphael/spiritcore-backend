import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "../errors.mjs";
import { getMediaStorageRoot, resolveMediaPath } from "./mediaStorageRoot.mjs";

const DEFAULT_ROOT = "Spiritverse_MASTER_ASSETS";
const APPROVED_REGISTRY_RELATIVE_PATH = path.posix.join(
  DEFAULT_ROOT,
  "APPROVED",
  "_registry",
  "approved_media_assets.registry.json",
);
const APPROVED_REGISTRY_VERSION = "approved-media-assets-v1";
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

function filenamePackComponent(entityId = "", packId = "") {
  const entityPrefix = `${slugPart(entityId, "")}_`;
  const normalizedPackId = slugPart(packId, "pack");
  if (entityPrefix !== "_" && normalizedPackId.startsWith(entityPrefix)) {
    return normalizedPackId.slice(entityPrefix.length) || normalizedPackId;
  }
  return normalizedPackId;
}

function normalizeRelativePath(value = "") {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function registryKey(record = {}) {
  return [
    slugPart(record.entityId, ""),
    normalizeText(record.packId, 160),
    slugPart(record.assetType, ""),
    slugPart(record.variant || "v1", "v1"),
    normalizeText(record.providerJobId, 160),
  ].join("|");
}

function normalizeRegistryRecord(input = {}) {
  return {
    entityId: slugPart(input.entityId, ""),
    packId: normalizeText(input.packId, 160),
    assetType: slugPart(input.assetType, ""),
    variant: slugPart(input.variant || "v1", "v1"),
    status: slugPart(input.status || input.approvalState || "approved", "approved"),
    provider: slugPart(input.provider || "runway", "runway"),
    providerJobId: normalizeText(input.providerJobId, 160),
    savedPath: normalizeRelativePath(input.savedPath || input.approvedRelativePath),
    metadataPath: normalizeRelativePath(input.metadataPath || input.metadataRelativePath),
    rawArchivePath: input.rawArchivePath ? normalizeRelativePath(input.rawArchivePath) : null,
    sourceAssetRef: normalizeText(input.sourceAssetRef, 1000),
    durationSec: Number.isFinite(Number(input.durationSec)) ? Number(input.durationSec) : null,
    ratio: normalizeText(input.ratio, 40),
    generationMode: normalizeText(input.generationMode, 80),
    reviewNotes: normalizeText(input.reviewNotes, 2000),
    approvedBy: normalizeText(input.approvedBy, 120),
    approvedAt: normalizeText(input.approvedAt || input.ingestedAt || input.createdAt || nowIso(), 80),
    registryVersion: APPROVED_REGISTRY_VERSION,
  };
}

function validateApprovedRegistryRecord(record = {}) {
  const errors = [];
  if (!record.entityId) errors.push("entityId is required");
  if (!record.packId) errors.push("packId is required");
  if (!record.assetType) errors.push("assetType is required");
  if (!record.variant) errors.push("variant is required");
  if (record.status !== "approved") errors.push("status must be approved");
  if (!record.provider) errors.push("provider is required");
  if (!record.providerJobId) errors.push("providerJobId is required");
  if (!record.savedPath) errors.push("savedPath is required");
  if (!record.metadataPath) errors.push("metadataPath is required");
  if (!record.sourceAssetRef) errors.push("sourceAssetRef is required");
  if (!record.approvedBy) errors.push("approvedBy is required");
  if (record.savedPath.includes("/ACTIVE/") || record.metadataPath.includes("/ACTIVE/")) {
    errors.push("approved registry records must not point to ACTIVE");
  }
  return errors;
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
  const packId = normalizeText(input.packId, 160);
  const packSlug = slugPart(input.packId, "");
  const assetType = slugPart(input.assetType, "");
  const variant = slugPart(input.variant || "v1", "v1");
  const status = slugPart(input.status, "");
  const provider = slugPart(input.provider || "runway", "runway");
  const providerJobId = normalizeText(input.providerJobId, 160);
  const outputUrl = String(input.outputUrl || "").trim();
  const sourceAssetRef = normalizeText(input.sourceAssetRef, 1000);
  const category = categoryForAssetType(assetType);
  const createdAt = options.now ? new Date(options.now) : new Date();
  const packFileComponent = filenamePackComponent(entityId, packSlug);
  const fileName = `${entityId}_${packFileComponent}_${assetType}_${variant}_${status}_${yyyymmdd(createdAt)}_${shortJobId(providerJobId)}.mp4`;
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
    packSlug,
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
    packFileComponent,
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

export function getApprovedMediaAssetRegistryPath() {
  return APPROVED_REGISTRY_RELATIVE_PATH;
}

export async function loadApprovedMediaAssetRegistry(options = {}) {
  const registryPath = resolveMediaPath(APPROVED_REGISTRY_RELATIVE_PATH, options);
  try {
    const parsed = JSON.parse(await readFile(registryPath.resolvedPath, "utf8"));
    const records = Array.isArray(parsed.records) ? parsed.records : [];
    return {
      ok: true,
      registryPath: APPROVED_REGISTRY_RELATIVE_PATH,
      registryVersion: parsed.registryVersion || APPROVED_REGISTRY_VERSION,
      updatedAt: parsed.updatedAt || null,
      records: records.map(normalizeRegistryRecord),
      exists: true,
    };
  } catch (err) {
    if (err.code === "ENOENT") {
      return {
        ok: true,
        registryPath: APPROVED_REGISTRY_RELATIVE_PATH,
        registryVersion: APPROVED_REGISTRY_VERSION,
        updatedAt: null,
        records: [],
        exists: false,
      };
    }
    throw err;
  }
}

export async function upsertApprovedMediaAssetRegistryRecords(records = [], options = {}) {
  const normalizedRecords = records.map(normalizeRegistryRecord);
  const invalid = normalizedRecords
    .map((record) => ({ record, errors: validateApprovedRegistryRecord(record) }))
    .filter((item) => item.errors.length);
  if (invalid.length) {
    throw new ValidationError("Invalid approved media asset registry record.", invalid.flatMap((item) => item.errors));
  }

  const existing = await loadApprovedMediaAssetRegistry(options);
  const byKey = new Map(existing.records.map((record) => [registryKey(record), record]));
  let inserted = 0;
  let updated = 0;
  for (const record of normalizedRecords) {
    const key = registryKey(record);
    if (byKey.has(key)) {
      updated += 1;
    } else {
      inserted += 1;
    }
    byKey.set(key, record);
  }

  const payload = {
    registryVersion: APPROVED_REGISTRY_VERSION,
    updatedAt: nowIso(),
    records: [...byKey.values()].sort((a, b) => registryKey(a).localeCompare(registryKey(b))),
    noActiveWritePerformed: true,
    noManifestUpdatePerformed: true,
    providerGenerationPerformed: false,
  };
  const registryPath = resolveMediaPath(APPROVED_REGISTRY_RELATIVE_PATH, options);
  await mkdir(path.dirname(registryPath.resolvedPath), { recursive: true });
  await writeFile(registryPath.resolvedPath, JSON.stringify(payload, null, 2), "utf8");

  return {
    ok: true,
    registryPath: APPROVED_REGISTRY_RELATIVE_PATH,
    registryUpdated: normalizedRecords.length > 0,
    inserted,
    updated,
    recordCount: payload.records.length,
    noActiveWritePerformed: true,
    noManifestUpdatePerformed: true,
    providerGenerationPerformed: false,
  };
}

export function buildApprovedRegistryRecordFromMetadata(metadata = {}, metadataPath = "") {
  return normalizeRegistryRecord({
    ...metadata,
    metadataPath: metadata.metadataPath || metadataPath,
    savedPath: metadata.savedPath,
    rawArchivePath: metadata.rawArchivePath,
    approvedAt: metadata.approvedAt || metadata.ingestedAt || metadata.createdAt,
  });
}

async function findApprovedMetadataPaths(root, entityId) {
  const approvedRoot = resolveMediaPath(path.posix.join(DEFAULT_ROOT, "APPROVED", slugPart(entityId, "")), {
    workspaceRoot: root,
  }).resolvedPath;
  const results = [];
  async function walk(dir) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "source_stills") continue;
        await walk(absolute);
      } else if (/\.metadata\.json$/i.test(entry.name)) {
        const storageRoot = getMediaStorageRoot({ workspaceRoot: root }).storageRoot;
        results.push(path.posix.join(DEFAULT_ROOT, path.relative(storageRoot, absolute).replace(/\\/g, "/")));
      }
    }
  }
  await walk(approvedRoot);
  return results;
}

export async function createApprovedAssetRegistryBackfillPlan(input = {}, options = {}) {
  const entityId = slugPart(input.entityId, "");
  const packId = normalizeText(input.packId, 160);
  if (!entityId) throw new ValidationError("entityId is required for approved asset registry backfill.", ["entityId"]);
  if (!packId) throw new ValidationError("packId is required for approved asset registry backfill.", ["packId"]);

  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const explicitPaths = Array.isArray(input.approvedMetadataPaths)
    ? input.approvedMetadataPaths.map(normalizeRelativePath).filter(Boolean)
    : [];
  const metadataPaths = explicitPaths.length ? explicitPaths : await findApprovedMetadataPaths(workspaceRoot, entityId);
  const registry = await loadApprovedMediaAssetRegistry({ workspaceRoot });
  const existingKeys = new Set(registry.records.map(registryKey));
  const candidates = [];

  for (const metadataPath of metadataPaths) {
    const candidate = {
      metadataPath,
      valid: false,
      duplicate: false,
      missingFields: [],
      registryRecord: null,
    };
    try {
      const resolvedMetadata = resolveMediaPath(metadataPath, options);
      const metadata = JSON.parse(await readFile(resolvedMetadata.resolvedPath, "utf8"));
      const record = buildApprovedRegistryRecordFromMetadata(metadata, metadataPath);
      candidate.registryRecord = record;
      candidate.missingFields = validateApprovedRegistryRecord(record);
      candidate.duplicate = existingKeys.has(registryKey(record));
      candidate.valid = candidate.missingFields.length === 0;
    } catch (err) {
      if (err.code === "ENOENT") {
        candidate.missingFields = ["file_missing"];
      } else if (err.code === "VALIDATION_ERROR") {
        candidate.missingFields = err.detail?.fields || ["path_outside_storage_root"];
      } else if (err instanceof SyntaxError) {
        candidate.missingFields = ["metadata_invalid_json"];
      } else {
        candidate.missingFields = [`metadata could not be read: ${err.message}`];
      }
    }
    candidates.push(candidate);
  }

  return {
    ok: true,
    entityId,
    packId,
    registryPath: APPROVED_REGISTRY_RELATIVE_PATH,
    storageRoot: getMediaStorageRoot(options).storageRoot,
    dryRun: input.dryRun !== false,
    discoveredApprovedMetadataCandidates: metadataPaths,
    proposedRegistryRecords: candidates.filter((candidate) => candidate.valid).map((candidate) => candidate.registryRecord),
    duplicateRecords: candidates.filter((candidate) => candidate.duplicate).map((candidate) => candidate.metadataPath),
    missingFields: candidates.filter((candidate) => candidate.missingFields.length).map((candidate) => ({
      metadataPath: candidate.metadataPath,
      missingFields: candidate.missingFields,
    })),
    candidates,
    noProviderCall: true,
    noGenerationPerformed: true,
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
  };
}

export async function executeApprovedAssetRegistryBackfill(input = {}, options = {}) {
  const plan = await createApprovedAssetRegistryBackfillPlan({
    ...input,
    dryRun: false,
  }, options);
  const recordsToUpsert = plan.proposedRegistryRecords;
  const registryResult = await upsertApprovedMediaAssetRegistryRecords(recordsToUpsert, options);
  return {
    ...plan,
    dryRun: false,
    registryUpdated: registryResult.registryUpdated,
    registryInserted: registryResult.inserted,
    registryUpdatedExisting: registryResult.updated,
    registryRecordCount: registryResult.recordCount,
    noProviderCall: true,
    noGenerationPerformed: true,
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
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

  const assetPath = resolveMediaPath(record.approvedRelativePath, options);
  const metadataPath = resolveMediaPath(record.metadataRelativePath, options);
  const rawArchivePath = resolveMediaPath(record.rawArchiveRelativePath, options);
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

  await mkdir(path.dirname(assetPath.resolvedPath), { recursive: true });
  await writeFile(assetPath.resolvedPath, binary);
  await writeFile(metadataPath.resolvedPath, JSON.stringify(metadata, null, 2), "utf8");

  if (record.archiveRawProviderExport) {
    await mkdir(path.dirname(rawArchivePath.resolvedPath), { recursive: true });
    await writeFile(rawArchivePath.resolvedPath, binary);
  }

  const registryRecord = buildApprovedRegistryRecordFromMetadata(metadata, record.metadataRelativePath);
  const registryResult = await upsertApprovedMediaAssetRegistryRecords([registryRecord], {
    ...options,
  });

  return {
    ok: true,
    savedPath: record.approvedRelativePath,
    metadataPath: record.metadataRelativePath,
    rawArchivePath: record.archiveRawProviderExport ? record.rawArchiveRelativePath : null,
    registryPath: registryResult.registryPath,
    registryUpdated: registryResult.registryUpdated,
    storageRoot: assetPath.storageRoot,
    resolvedPath: assetPath.resolvedPath,
    resolvedMetadataPath: metadataPath.resolvedPath,
    resolvedRawArchivePath: record.archiveRawProviderExport ? rawArchivePath.resolvedPath : null,
    approvalState: "approved",
    activePromotionPerformed: false,
    noActiveWritePerformed: true,
    noManifestUpdatePerformed: true,
    providerGenerationPerformed: false,
    metadata,
  };
}
