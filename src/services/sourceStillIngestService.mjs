import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "../errors.mjs";
import { SPIRITKIN_MOTION_SOURCE_CATEGORIES } from "./spiritCoreMediaProduction.mjs";

const DEFAULT_ROOT = "Spiritverse_MASTER_ASSETS";
const ALLOWED_ENTITY_IDS = new Set(["lyra", "raien", "kairo", "elaria", "thalassar"]);
const ALLOWED_STATUS = "approved";
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

function nowIso() {
  return new Date().toISOString();
}

function yyyymmdd(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function normalizeText(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function slugPart(value, fallback = "source") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

function shortHash(value = "") {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 10);
}

function extensionFromUrl(value = "") {
  try {
    const parsed = new URL(value);
    const ext = path.extname(parsed.pathname).replace(/^\./, "").toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext) ? ext : "png";
  } catch {
    return "png";
  }
}

function safeJoin(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const absoluteTarget = path.resolve(absoluteRoot, relativePath);
  if (absoluteTarget !== absoluteRoot && !absoluteTarget.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new ValidationError("Resolved source still ingest path escaped the configured asset root.", ["path"]);
  }
  return absoluteTarget;
}

async function defaultDownloadSourceStill(sourceUrl) {
  const url = String(sourceUrl || "").trim();
  if (!/^https:\/\//i.test(url)) {
    throw new ValidationError("sourceUrl must be HTTPS for source still ingest.", ["sourceUrl"]);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new ValidationError("sourceUrl could not be downloaded for source still ingest.", [`providerHttpStatus:${response.status}`]);
  }
  return Buffer.from(await response.arrayBuffer());
}

export function buildSourceStillIngestRecord(input = {}, options = {}) {
  const entityId = slugPart(input.entityId, "");
  const sourceCategory = slugPart(input.sourceCategory, "");
  const sourceUrl = String(input.sourceUrl || "").trim();
  const sourceName = slugPart(input.sourceName || sourceCategory, "source");
  const status = slugPart(input.status, "");
  const createdAt = options.now ? new Date(options.now) : new Date();
  const extension = extensionFromUrl(sourceUrl);
  const fileName = `${entityId}_${sourceCategory}_${sourceName}_${status}_${yyyymmdd(createdAt)}_${shortHash(sourceUrl)}.${extension}`;
  const approvedRelativeDir = path.posix.join(DEFAULT_ROOT, "APPROVED", entityId, "source_stills", sourceCategory);
  const approvedRelativePath = path.posix.join(approvedRelativeDir, fileName);
  const metadataRelativePath = approvedRelativePath.replace(/\.[^.]+$/i, ".metadata.json");
  const rawArchiveRelativePath = path.posix.join(
    DEFAULT_ROOT,
    "ARCHIVE",
    "raw_provider_exports",
    entityId,
    "source_stills",
    sourceCategory,
    fileName,
  );

  return {
    entityId,
    sourceCategory,
    sourceUrl,
    sourceName,
    status,
    reviewNotes: normalizeText(input.reviewNotes, 2000),
    approvedBy: normalizeText(input.approvedBy, 120),
    archiveRawProviderExport: Boolean(input.archiveRawProviderExport),
    extension,
    fileName,
    approvedRelativeDir,
    approvedRelativePath,
    metadataRelativePath,
    rawArchiveRelativePath,
    approvalState: status,
    activePromotionPerformed: false,
    noActiveWritePerformed: true,
    noManifestUpdatePerformed: true,
    providerGenerationPerformed: false,
    createdAt: createdAt.toISOString(),
  };
}

export function validateSourceStillIngestRecord(record = {}) {
  const errors = [];
  if (!record.entityId) errors.push("entityId is required");
  if (!ALLOWED_ENTITY_IDS.has(record.entityId)) errors.push("entityId must be a known Spiritkin");
  if (!record.sourceCategory) errors.push("sourceCategory is required");
  if (!SPIRITKIN_MOTION_SOURCE_CATEGORIES.includes(record.sourceCategory)) errors.push("sourceCategory must be supported");
  if (record.status !== ALLOWED_STATUS) errors.push("status must be approved");
  if (!/^https:\/\//i.test(record.sourceUrl)) errors.push("sourceUrl must be HTTPS");
  if (!record.sourceName) errors.push("sourceName is required");
  if (!record.approvedBy) errors.push("approvedBy is required");
  if (!ALLOWED_EXTENSIONS.has(record.extension)) errors.push("source still extension must be png, jpg, jpeg, or webp");
  if (record.approvedRelativePath.includes("/ACTIVE/")) errors.push("source still ingest path must not target ACTIVE");
  return { ok: errors.length === 0, errors };
}

export async function ingestSourceStill(input = {}, options = {}) {
  const record = buildSourceStillIngestRecord(input, options);
  const validation = validateSourceStillIngestRecord(record);
  if (!validation.ok) {
    throw new ValidationError("Invalid source still ingest request.", validation.errors);
  }

  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const assetPath = safeJoin(workspaceRoot, record.approvedRelativePath);
  const metadataPath = safeJoin(workspaceRoot, record.metadataRelativePath);
  const rawArchivePath = safeJoin(workspaceRoot, record.rawArchiveRelativePath);
  const downloadSourceStill = options.downloadSourceStill || defaultDownloadSourceStill;
  const binary = await downloadSourceStill(record.sourceUrl);

  if (!Buffer.isBuffer(binary) || binary.length === 0) {
    throw new ValidationError("Downloaded source still was empty.", ["sourceUrl"]);
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
    providerGenerationPerformed: false,
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
    sourceCategory: record.sourceCategory,
    activePromotionPerformed: false,
    noActiveWritePerformed: true,
    noManifestUpdatePerformed: true,
    providerGenerationPerformed: false,
    metadata,
  };
}
