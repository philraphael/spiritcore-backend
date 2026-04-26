import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "../errors.mjs";

export const MEDIA_STORAGE_LOGICAL_ROOT = "Spiritverse_MASTER_ASSETS";
export const MEDIA_STORAGE_DIRECTORIES = Object.freeze([
  "APPROVED",
  "REVIEW",
  "ARCHIVE",
  "ACTIVE",
  "APPROVED/_registry",
]);

function isTrueEnv(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function normalizeRelativePath(value = "") {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

async function exists(absolutePath) {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function storageRootFromEnv(env = process.env, workspaceRoot = process.cwd()) {
  const configured = String(env.SPIRITCORE_MEDIA_STORAGE_ROOT || "").trim();
  if (configured) {
    return path.resolve(workspaceRoot, configured);
  }
  return path.resolve(workspaceRoot, MEDIA_STORAGE_LOGICAL_ROOT);
}

export function getMediaStorageRoot(options = {}) {
  const env = options.env || process.env;
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  return {
    storageRoot: storageRootFromEnv(env, workspaceRoot),
    logicalRoot: MEDIA_STORAGE_LOGICAL_ROOT,
    workspaceRoot,
    configured: Boolean(String(env.SPIRITCORE_MEDIA_STORAGE_ROOT || "").trim()),
    configuredValue: String(env.SPIRITCORE_MEDIA_STORAGE_ROOT || "").trim() || null,
  };
}

export function mediaLogicalToStorageRelative(logicalPath = "") {
  const normalized = normalizeRelativePath(logicalPath);
  if (normalized === MEDIA_STORAGE_LOGICAL_ROOT) return "";
  if (normalized.startsWith(`${MEDIA_STORAGE_LOGICAL_ROOT}/`)) {
    return normalized.slice(MEDIA_STORAGE_LOGICAL_ROOT.length + 1);
  }
  return normalized;
}

export function resolveMediaPath(logicalPath = "", options = {}) {
  const { storageRoot, logicalRoot, workspaceRoot, configured, configuredValue } = getMediaStorageRoot(options);
  const rawPath = String(logicalPath || "").trim();
  if (!rawPath) {
    throw new ValidationError("Media path is required.", ["path"]);
  }

  const absoluteStorageRoot = path.resolve(storageRoot);
  const absolutePath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(absoluteStorageRoot, mediaLogicalToStorageRelative(rawPath));
  if (absolutePath !== absoluteStorageRoot && !absolutePath.startsWith(`${absoluteStorageRoot}${path.sep}`)) {
    throw new ValidationError("Resolved media path escaped the configured storage root.", ["path_outside_storage_root"]);
  }

  return {
    logicalPath: normalizeRelativePath(rawPath),
    storageRelativePath: path.relative(absoluteStorageRoot, absolutePath).replace(/\\/g, "/"),
    resolvedPath: absolutePath,
    absolutePath,
    storageRoot: absoluteStorageRoot,
    logicalRoot,
    workspaceRoot,
    configured,
    configuredValue,
  };
}

export async function ensureMediaDirectories(options = {}) {
  const root = getMediaStorageRoot(options);
  const created = [];
  for (const dir of MEDIA_STORAGE_DIRECTORIES) {
    const absolutePath = path.join(root.storageRoot, dir);
    await mkdir(absolutePath, { recursive: true });
    created.push({
      logicalPath: `${MEDIA_STORAGE_LOGICAL_ROOT}/${dir}`,
      resolvedPath: absolutePath,
    });
  }
  return {
    ok: true,
    storageRoot: root.storageRoot,
    directories: created,
    noActiveFileWritePerformed: true,
    noManifestUpdatePerformed: true,
  };
}

export async function getStoragePrecheck(options = {}) {
  const env = options.env || process.env;
  const root = getMediaStorageRoot(options);
  const railwayVolumeMountPath = String(env.RAILWAY_VOLUME_MOUNT_PATH || "").trim();
  const railwayVolumeName = String(env.RAILWAY_VOLUME_NAME || "").trim();
  const storageRootExists = await exists(root.storageRoot);
  const directoryStates = {};
  for (const dir of MEDIA_STORAGE_DIRECTORIES) {
    directoryStates[dir] = await exists(path.join(root.storageRoot, dir));
  }
  const railwayVolumeDetected = railwayVolumeMountPath
    ? await exists(path.resolve(root.workspaceRoot, railwayVolumeMountPath))
    : false;
  const storageRootUnderRailwayVolume = railwayVolumeMountPath
    ? root.storageRoot === path.resolve(root.workspaceRoot, railwayVolumeMountPath)
      || root.storageRoot.startsWith(`${path.resolve(root.workspaceRoot, railwayVolumeMountPath)}${path.sep}`)
    : false;
  const likelyPersistent = Boolean(root.configured && (storageRootUnderRailwayVolume || railwayVolumeDetected || railwayVolumeName));
  const warnings = [];
  if (!root.configured) warnings.push("SPIRITCORE_MEDIA_STORAGE_ROOT is not set; default local storage may be ephemeral in Railway.");
  if (!likelyPersistent) warnings.push("Media assets may be lost on redeploy until a Railway Volume or durable object storage is configured.");
  if (!storageRootExists) warnings.push("Configured media storage root does not exist yet.");

  let writeCheck = null;
  if (options.testWrite) {
    const precheckDir = path.join(root.storageRoot, "REVIEW", "_precheck");
    const precheckFile = path.join(precheckDir, `${String(options.testPathName || "storage_precheck").replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`);
    await mkdir(precheckDir, { recursive: true });
    const content = `storage-precheck ${new Date().toISOString()}`;
    await writeFile(precheckFile, content, "utf8");
    const readBack = await readFile(precheckFile, "utf8");
    const fileStat = await stat(precheckFile);
    writeCheck = {
      ok: readBack === content,
      logicalPath: `${MEDIA_STORAGE_LOGICAL_ROOT}/REVIEW/_precheck/${path.basename(precheckFile)}`,
      resolvedPath: precheckFile,
      byteLength: fileStat.size,
      deleted: false,
      noActiveWritePerformed: true,
    };
  }

  return {
    ok: true,
    currentWorkingDirectory: root.workspaceRoot,
    storageRoot: root.storageRoot,
    logicalRoot: root.logicalRoot,
    storageRootConfigured: root.configured,
    storageRootConfiguredValue: root.configuredValue,
    storageRootExists,
    directories: directoryStates,
    railwayVolumeMountPath: railwayVolumeMountPath || null,
    railwayVolumeName: railwayVolumeName || null,
    railwayVolumeDetected,
    storageRootUnderRailwayVolume,
    likelyPersistent,
    warnings,
    writeCheck,
    externalApiCall: false,
    noProviderCall: true,
    noGenerationPerformed: true,
    noPromotionPerformed: true,
    noManifestUpdatePerformed: true,
    noActiveWritePerformed: true,
  };
}

