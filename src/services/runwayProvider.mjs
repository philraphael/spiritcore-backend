import { randomUUID } from "crypto";
import { ValidationError } from "../errors.mjs";

export const RUNWAY_SUPPORTED_ASSET_KINDS = Object.freeze([
  "portrait",
  "hero",
  "full_body",
  "icon",
  "presence_indicator",
  "spiritgate_video",
  "idle_video",
  "speaking_video",
  "listening_video",
  "greeting_video",
  "wake_visual",
  "calm_video",
  "trailer",
  "trailer_video",
  "realm_background",
  "room_background",
  "gateway_background",
  "game_board_theme",
  "game_piece_set",
]);

export const RUNWAY_JOB_LIFECYCLE_STATES = Object.freeze([
  "draft",
  "validated",
  "dry_run",
  "queued",
  "generating",
  "review_required",
  "approved",
  "promoted",
  "rejected",
  "failed",
]);

const ASSET_KIND_ALIASES = Object.freeze({
  heroimage: "hero",
  hero_image: "hero",
  fullbody: "full_body",
  full_body: "full_body",
  presence: "presence_indicator",
  presence_indicator: "presence_indicator",
  spiritgate: "spiritgate_video",
  spiritgatevideo: "spiritgate_video",
  spiritgate_video: "spiritgate_video",
  idle: "idle_video",
  idlevideo: "idle_video",
  idle_video: "idle_video",
  speaking: "speaking_video",
  speakingvideo: "speaking_video",
  speaking_video: "speaking_video",
  listening: "listening_video",
  listeningvideo: "listening_video",
  listening_video: "listening_video",
  greeting: "greeting_video",
  greetingvideo: "greeting_video",
  greeting_video: "greeting_video",
  wake: "wake_visual",
  wakevisual: "wake_visual",
  wake_visual: "wake_visual",
  calm: "calm_video",
  calmvideo: "calm_video",
  calm_video: "calm_video",
  trailervideo: "trailer",
  trailer_video: "trailer",
  intro_trailer: "trailer",
  room: "room_background",
  roombackground: "room_background",
  room_background: "room_background",
  gateway: "gateway_background",
  gatewaybackground: "gateway_background",
  gateway_background: "gateway_background",
  background: "realm_background",
  realm: "realm_background",
  realmbackground: "realm_background",
  realm_background: "realm_background",
  board: "game_board_theme",
  gameboard: "game_board_theme",
  game_board: "game_board_theme",
  gameboardtheme: "game_board_theme",
  game_board_theme: "game_board_theme",
  pieces: "game_piece_set",
  gamepieces: "game_piece_set",
  game_piece: "game_piece_set",
  game_piece_set: "game_piece_set",
});

const VIDEO_KINDS = new Set(["spiritgate_video", "idle_video", "speaking_video", "listening_video", "greeting_video", "wake_visual", "calm_video", "trailer"]);
const IMAGE_KINDS = new Set(["portrait", "hero", "full_body", "icon", "presence_indicator", "realm_background", "room_background", "gateway_background", "game_board_theme", "game_piece_set"]);
const SAFETY_LEVELS = new Set(["standard", "strict", "internal_review"]);
const DEFAULT_IMAGE_MODEL = "gen4_image";
const DEFAULT_VIDEO_MODEL = "gen4_turbo";
const DEFAULT_VIDEO_TO_VIDEO_MODEL = "gen4_aleph";
const DEFAULT_IMAGE_GENERATE_PATH = "/v1/text_to_image";
const DEFAULT_VIDEO_GENERATE_PATH = "/v1/image_to_video";
const DEFAULT_VIDEO_TO_VIDEO_GENERATE_PATH = "/v1/video_to_video";

function nowIso() {
  return new Date().toISOString();
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

function normalizePathPart(value, fallback = "") {
  const normalized = String(value || fallback).trim();
  if (!normalized) return fallback;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function normalizeText(value, max = 400) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function compactPayload(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));
}

function sanitizeProviderBody(parsed = {}) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const sanitized = {};
  for (const key of ["error", "message", "code", "failure", "failureCode", "detail", "details", "status", "docUrl"]) {
    if (parsed[key] === undefined) continue;
    if (typeof parsed[key] === "string" || typeof parsed[key] === "number" || typeof parsed[key] === "boolean") {
      sanitized[key] = normalizeText(parsed[key], 1000);
    } else if (parsed[key] && typeof parsed[key] === "object") {
      sanitized[key] = sanitizeProviderBody(parsed[key]);
    }
  }
  return sanitized;
}

function sanitizeProviderIssues(issues = []) {
  if (!Array.isArray(issues)) return [];
  return issues.slice(0, 12).map((issue) => {
    if (typeof issue === "string") return normalizeText(issue, 1000);
    if (!issue || typeof issue !== "object") return normalizeText(issue, 1000);
    const sanitized = {};
    for (const [key, value] of Object.entries(issue).slice(0, 12)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        sanitized[normalizeText(key, 80)] = normalizeText(value, 1000);
      } else if (Array.isArray(value)) {
        sanitized[normalizeText(key, 80)] = value.slice(0, 12).map((entry) => normalizeText(entry, 300));
      } else if (value && typeof value === "object") {
        sanitized[normalizeText(key, 80)] = sanitizeProviderBody(value);
      }
    }
    return sanitized;
  });
}

function providerErrorMessage(parsed = {}) {
  const error = parsed?.error;
  if (typeof error === "string") return normalizeText(error, 1000);
  if (error?.message) return normalizeText(error.message, 1000);
  return normalizeText(parsed?.message || parsed?.failure || parsed?.detail || parsed?.details, 1000) || null;
}

function providerErrorCode(parsed = {}) {
  const error = parsed?.error;
  if (error?.code) return normalizeText(error.code, 160);
  return normalizeText(parsed?.code || parsed?.failureCode, 160) || null;
}

function providerPromptText(normalized = {}, promptPackage = {}) {
  const directPrompt = normalizeText(normalized.promptIntent, 1200);
  const isCompactSpiritkinMotionPrompt = directPrompt
    && directPrompt.length <= 1000
    && directPrompt.includes("Preserve the exact portrait identity")
    && (
      directPrompt.includes("No speaking, no mouth movement")
      || directPrompt.includes("silent subtle speaking presence loop")
      || directPrompt.includes("restrained speaking presence loop")
    );
  if (isCompactSpiritkinMotionPrompt) {
    return directPrompt;
  }
  return promptPackage.prompt;
}

function slugify(value, fallback = "target") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function canonicalizeKind(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeRunwayAssetKind(kind) {
  const normalized = canonicalizeKind(kind);
  const compact = normalized.replace(/_/g, "");
  const resolved = ASSET_KIND_ALIASES[normalized] || ASSET_KIND_ALIASES[compact] || normalized;
  return RUNWAY_SUPPORTED_ASSET_KINDS.includes(resolved) ? resolved : "";
}

function assetMediaType(assetKind) {
  return VIDEO_KINDS.has(assetKind) ? "video" : "image";
}

function extensionForKind(assetKind) {
  return VIDEO_KINDS.has(assetKind) ? "mp4" : "png";
}

function runwayImageRatioForKind(assetKind, requestedRatio) {
  const requested = normalizeText(requestedRatio, 20);
  if (/^\d+:\d+$/.test(requested)) return requested;
  if (assetKind === "portrait" || assetKind === "game_piece_set") return "1024:1024";
  if (assetKind === "hero" || assetKind === "realm_background" || assetKind === "game_board_theme") return "1920:1080";
  return "1024:1024";
}

function runwayVideoRatioForKind(assetKind, requestedRatio) {
  const requested = normalizeText(requestedRatio, 20);
  if (/^\d+:\d+$/.test(requested)) return requested;
  return assetKind === "speaking_video" ? "720:1280" : "1280:720";
}

function resolveProviderMode(normalized = {}) {
  const assetKind = normalizeRunwayAssetKind(normalized.assetKind);
  if (assetKind === "spiritgate_video") return "video_to_video";
  if (VIDEO_KINDS.has(assetKind)) {
    const sourceType = normalizeText(normalized.sourceAssetType || normalized.sourceType, 80).toLowerCase();
    return sourceType.includes("video") ? "video_to_video" : "image_to_video";
  }
  return "text_to_image";
}

function buildTarget(input = {}, assetKind) {
  const spiritkinId = normalizeText(input.spiritkinId || input.spiritkinName, 120);
  const targetId = normalizeText(input.targetId, 120);
  const realmId = normalizeText(input.realmId || targetId, 120);
  const gameType = normalizeText(input.gameType || targetId, 80);
  const themeId = normalizeText(input.themeId || input.styleProfile || "runway-theme", 80);

  if (assetKind === "realm_background" || assetKind === "room_background") {
    return {
      targetType: "realm",
      targetId: realmId,
      requiredLabel: "realmId or targetId",
      activeRoot: `Spiritverse_MASTER_ASSETS/ACTIVE/realms/${slugify(realmId, "realm")}/${assetKind}`,
      publicRoot: `/app/assets/generated/realms/${slugify(realmId, "realm")}/${assetKind}`,
    };
  }

  if (assetKind === "spiritgate_video" || assetKind === "gateway_background") {
    const id = targetId || realmId || "spiritgate";
    return {
      targetType: "spiritgate",
      targetId: id,
      requiredLabel: "targetId",
      activeRoot: `Spiritverse_MASTER_ASSETS/ACTIVE/spiritgate/${slugify(id, "spiritgate")}/${assetKind}`,
      publicRoot: `/app/assets/generated/spiritgate/${slugify(id, "spiritgate")}/${assetKind}`,
    };
  }

  if (assetKind === "game_board_theme" || assetKind === "game_piece_set") {
    return {
      targetType: "game",
      targetId: gameType,
      requiredLabel: "gameType or targetId",
      activeRoot: `Spiritverse_MASTER_ASSETS/ACTIVE/games/${slugify(gameType, "game")}/${slugify(themeId, "theme")}/${assetKind}`,
      publicRoot: `/app/assets/generated/games/${slugify(gameType, "game")}/${slugify(themeId, "theme")}/${assetKind}`,
    };
  }

  const id = spiritkinId || targetId;
  return {
    targetType: "spiritkin",
    targetId: id,
    requiredLabel: "spiritkinId or targetId",
    activeRoot: `Spiritverse_MASTER_ASSETS/ACTIVE/spiritkins/${slugify(id, "spiritkin")}/${assetKind}`,
    publicRoot: `/app/assets/generated/spiritkins/${slugify(id, "spiritkin")}/${assetKind}`,
  };
}

function buildProposedPaths({ target, assetKind, versionTag }) {
  const fileName = `artifact.${extensionForKind(assetKind)}`;
  return {
    activeDirectory: `${target.activeRoot}/${versionTag}`,
    activeArtifact: `${target.activeRoot}/${versionTag}/${fileName}`,
    activeMetadata: `${target.activeRoot}/${versionTag}/metadata.json`,
    publicDirectory: `${target.publicRoot}/${versionTag}`,
    publicArtifact: `${target.publicRoot}/${versionTag}/${fileName}`,
    publicMetadata: `${target.publicRoot}/${versionTag}/metadata.json`,
  };
}

export function validateRunwayJobRequest(input = {}) {
  const errors = [];
  const assetKind = normalizeRunwayAssetKind(input.assetKind);
  if (!assetKind) errors.push("assetKind must be one of the supported Runway asset kinds");

  const target = buildTarget(input, assetKind || "portrait");
  if (!target.targetId) errors.push(`${target.requiredLabel} is required`);

  const promptIntent = normalizeText(input.promptIntent, 1000);
  if (!promptIntent) errors.push("promptIntent is required");

  const styleProfile = normalizeText(input.styleProfile, 240);
  if (!styleProfile) errors.push("styleProfile is required");

  const safetyLevel = normalizeText(input.safetyLevel || "standard", 40).toLowerCase();
  if (!SAFETY_LEVELS.has(safetyLevel)) {
    errors.push("safetyLevel must be standard, strict, or internal_review");
  }

  const durationSec = VIDEO_KINDS.has(assetKind)
    ? Math.max(4, Math.min(30, Number(input.durationSec || 8)))
    : null;
  if (VIDEO_KINDS.has(assetKind) && !Number.isFinite(durationSec)) {
    errors.push("durationSec must be a number for video asset kinds");
  }

  const aspectRatio = normalizeText(
    input.aspectRatio || (VIDEO_KINDS.has(assetKind)
      ? runwayVideoRatioForKind(assetKind)
      : runwayImageRatioForKind(assetKind)),
    20
  );
  const sourceAssets = Array.isArray(input.sourceAssets)
    ? input.sourceAssets.map((item) => normalizeText(item, 240)).filter(Boolean).slice(0, 16)
    : [];
  const sourceAssetRef = normalizeText(input.sourceAssetRef || input.videoUri, 1200);
  const sourceAssetType = normalizeText(input.sourceAssetType || input.sourceType, 80).toLowerCase();

  const normalized = {
    targetType: target.targetType,
    targetId: target.targetId,
    spiritkinId: normalizeText(input.spiritkinId || input.spiritkinName, 120) || null,
    realmId: target.targetType === "realm" ? target.targetId : null,
    gameType: target.targetType === "game" ? target.targetId : null,
    themeId: target.targetType === "game" ? slugify(input.themeId || styleProfile, "theme") : null,
    assetKind,
    mediaType: assetMediaType(assetKind),
    promptIntent,
    styleProfile,
    safetyLevel,
    durationSec,
    aspectRatio,
    sourceAssets,
    sourceAssetRef,
    sourceAssetType,
    negativePrompt: normalizeText(input.negativePrompt, 500),
    requestedBy: normalizeText(input.requestedBy || "admin_dry_run", 80),
  };

  return {
    ok: errors.length === 0,
    errors,
    normalized,
  };
}

export function buildRunwayPrompt(input = {}) {
  const assetKind = normalizeRunwayAssetKind(input.assetKind) || input.assetKind || "unknown_asset";
  const mediaType = assetMediaType(assetKind);
  const targetName = normalizeText(input.spiritkinId || input.targetId || input.realmId || input.gameType, 160);
  const styleProfile = normalizeText(input.styleProfile, 240);
  const promptIntent = normalizeText(input.promptIntent, 1000);
  const sourceAssetRefs = [
    ...(Array.isArray(input.sourceAssets) ? input.sourceAssets : []),
    input.sourceAssetRef,
  ].map((item) => normalizeText(item, 600)).filter(Boolean);
  const sourceAssets = sourceAssetRefs.length
    ? ` Source assets to preserve: ${sourceAssetRefs.join(", ")}.`
    : " No source assets attached yet; require manual review before identity-sensitive execution.";
  const duration = input.durationSec ? ` Duration target: ${input.durationSec}s.` : "";
  const safety = input.safetyLevel ? ` Safety level: ${input.safetyLevel}.` : "";

  return {
    prompt: [
      `Create a ${mediaType} asset for ${targetName || "the selected Spiritverse target"}.`,
      `Asset kind: ${assetKind}.`,
      `Intent: ${promptIntent}.`,
      `Style profile: ${styleProfile}.`,
      duration,
      sourceAssets,
      safety,
      "Maintain canonical identity, avoid text overlays, avoid brand marks, avoid gore or sexualized framing, and keep the result suitable for internal review before promotion.",
    ].filter(Boolean).join(" "),
    negativePrompt: normalizeText(input.negativePrompt, 500) || "identity drift, watermark, subtitle burn-in, distorted anatomy, low detail, unsafe framing, off-brand fantasy montage",
  };
}

function estimateRiskNotes(normalized) {
  const notes = [
    "No external Runway API call is made by this dry run.",
    "Generated output must remain review_required before any manifest promotion.",
  ];
  if (!normalized.sourceAssets.length && normalized.targetType === "spiritkin") {
    notes.push("Spiritkin identity risk is elevated because no source assets were attached.");
  }
  if (normalized.mediaType === "video") {
    notes.push("Video jobs require cost caps, provider timeout handling, and explicit retry limits before paid execution.");
  }
  if (normalized.assetKind === "speaking_video") {
    notes.push("Speaking video should remain deferred until voice/video sync policy is defined.");
  }
  if (normalized.safetyLevel !== "strict") {
    notes.push("Use strict safety level for any asset intended for public beta promotion.");
  }
  return notes;
}

export function createDryRunJob(input = {}) {
  const validation = validateRunwayJobRequest(input);
  if (!validation.ok) {
    throw new ValidationError("Invalid Runway dry-run request.", validation.errors);
  }

  const { normalized } = validation;
  const versionTag = `dry-run-${Date.now()}`;
  const target = buildTarget(normalized, normalized.assetKind);
  const proposedPaths = buildProposedPaths({ target, assetKind: normalized.assetKind, versionTag });
  const promptPackage = buildRunwayPrompt(normalized);

  return {
    id: randomUUID(),
    provider: "runway",
    lifecycleState: "dry_run",
    externalApiCall: false,
    dryRunExecuteRequested: ["1", "true", "yes", "on"].includes(String(process.env.RUNWAY_DRY_RUN_EXECUTE || "").trim().toLowerCase()),
    normalizedJobRequest: normalized,
    promptPackage,
    proposedOutputPaths: proposedPaths,
    supportedAssetKinds: [...RUNWAY_SUPPORTED_ASSET_KINDS],
    lifecycleStates: [...RUNWAY_JOB_LIFECYCLE_STATES],
    estimatedRiskNotes: estimateRiskNotes(normalized),
    createdAt: nowIso(),
  };
}

export function canExecuteRunwayProvider(config = {}, env = process.env, authContext = {}) {
  const missingGates = [];
  const runway = config?.generator?.video?.runway || {};
  const adminMode = config?.adminAuth?.mode || env.ADMIN_AUTH_MODE || "auto";
  const adminGuardActive = !!authContext?.allowed && !authContext?.bypassed;

  if ((config?.env || env.NODE_ENV || "development") !== "staging") {
    missingGates.push("NODE_ENV=staging is required");
  }
  if (!(adminMode === "enforce" || adminGuardActive)) {
    missingGates.push("ADMIN_AUTH_MODE must be enforce or admin guard must be active with a real credential");
  }
  if (!runway.apiKey && !env.RUNWAY_API_KEY) {
    missingGates.push("RUNWAY_API_KEY is required");
  }
  if (!parseBoolean(env.RUNWAY_DRY_RUN_EXECUTE)) {
    missingGates.push("RUNWAY_DRY_RUN_EXECUTE=true is required");
  }
  if (!parseBoolean(env.RUNWAY_ALLOW_PROVIDER_EXECUTION)) {
    missingGates.push("RUNWAY_ALLOW_PROVIDER_EXECUTION=true is required");
  }

  return {
    ok: missingGates.length === 0,
    missingGates,
  };
}

export function resolveRunwayGenerationTarget(job = {}, runwayConfig = {}) {
  const normalized = job.normalizedJobRequest || job;
  const assetKind = normalizeRunwayAssetKind(normalized.assetKind);
  const mediaType = normalized.mediaType || assetMediaType(assetKind);
  const providerMode = resolveProviderMode(normalized);
  if (mediaType === "image") {
    return {
      mediaType: "image",
      providerMode: "text_to_image",
      endpointPath: runwayConfig.imageGeneratePath || envValue("RUNWAY_IMAGE_GENERATE_PATH") || DEFAULT_IMAGE_GENERATE_PATH,
      model: runwayConfig.imageModel || envValue("RUNWAY_IMAGE_MODEL") || DEFAULT_IMAGE_MODEL,
    };
  }

  if (providerMode === "video_to_video") {
    return {
      mediaType: "video",
      providerMode: "video_to_video",
      endpointPath: runwayConfig.videoToVideoGeneratePath || envValue("RUNWAY_VIDEO_TO_VIDEO_GENERATE_PATH") || DEFAULT_VIDEO_TO_VIDEO_GENERATE_PATH,
      model: runwayConfig.videoToVideoModel || envValue("RUNWAY_VIDEO_TO_VIDEO_MODEL") || DEFAULT_VIDEO_TO_VIDEO_MODEL,
      fallback: {
        providerMode: "image_to_video",
        endpointPath: runwayConfig.videoGeneratePath || runwayConfig.generatePath || envValue("RUNWAY_VIDEO_GENERATE_PATH") || DEFAULT_VIDEO_GENERATE_PATH,
        model: runwayConfig.videoModel || runwayConfig.model || envValue("RUNWAY_VIDEO_MODEL") || DEFAULT_VIDEO_MODEL,
      },
    };
  }

  return {
    mediaType: "video",
    providerMode: "image_to_video",
    endpointPath: runwayConfig.videoGeneratePath || runwayConfig.generatePath || envValue("RUNWAY_VIDEO_GENERATE_PATH") || DEFAULT_VIDEO_GENERATE_PATH,
    model: runwayConfig.videoModel || runwayConfig.model || envValue("RUNWAY_VIDEO_MODEL") || DEFAULT_VIDEO_MODEL,
  };
}

function envValue(name) {
  return process.env[name] || "";
}

export function buildRunwayApiPayload(job = {}) {
  const normalized = job.normalizedJobRequest || {};
  const promptPackage = job.promptPackage || buildRunwayPrompt(normalized);
  const promptText = providerPromptText(normalized, promptPackage);
  const target = resolveRunwayGenerationTarget(job, job._runwayConfig || {});

  if (target.providerMode === "video_to_video") {
    const videoUri = normalized.sourceAssetRef || (Array.isArray(normalized.sourceAssets) ? normalized.sourceAssets[0] : "");
    return compactPayload({
      model: job.providerModel || target.model,
      videoUri: videoUri || undefined,
      promptText,
      ratio: runwayVideoRatioForKind(normalized.assetKind, normalized.aspectRatio),
      seed: job.seed || undefined,
    });
  }

  if (target.mediaType === "image") {
    return compactPayload({
      model: job.providerModel || target.model,
      promptText,
      ratio: runwayImageRatioForKind(normalized.assetKind, normalized.aspectRatio),
      seed: job.seed || undefined,
      referenceImages: Array.isArray(normalized.sourceAssets) && normalized.sourceAssets.length
        ? normalized.sourceAssets.slice(0, 3).map((uri, index) => ({ uri, tag: `ref${index + 1}` }))
        : undefined,
    });
  }

  const sourceImage = Array.isArray(normalized.sourceAssets) ? normalized.sourceAssets[0] : null;
  return compactPayload({
    model: job.providerModel || target.model,
    promptText,
    promptImage: sourceImage || undefined,
    ratio: runwayVideoRatioForKind(normalized.assetKind, normalized.aspectRatio),
    duration: normalized.durationSec || 8,
    seed: job.seed || undefined,
  });
}

export function normalizeRunwayResponse(response = {}) {
  const providerJobId = response.id || response.taskId || response.task_id || response.generationId || response.uuid || null;
  const rawStatus = response.status || response.state || response.taskStatus || "submitted";
  const normalizedStatus = String(rawStatus || "").toLowerCase();
  const status = ["queued", "pending", "submitted"].includes(normalizedStatus)
    ? "queued"
    : (["running", "processing", "generating"].includes(normalizedStatus) ? "generating" : normalizedStatus);

  return {
    provider: "runway",
    providerJobId,
    status: status || "submitted",
    rawStatus,
    responseKeys: Object.keys(response || {}).slice(0, 20),
    submittedAt: nowIso(),
  };
}

export async function submitRunwayJob(job = {}) {
  const runway = job._runwayConfig || {};
  const baseUrl = normalizeBaseUrl(runway.baseUrl);
  const apiKey = runway.apiKey;
  if (!baseUrl || !apiKey) {
    throw new Error("Runway provider is not configured.");
  }

  const payload = buildRunwayApiPayload(job);
  const target = resolveRunwayGenerationTarget(job, runway);
  const endpointPath = normalizePathPart(target.endpointPath, DEFAULT_VIDEO_GENERATE_PATH);
  const fetchImpl = job.fetchImpl || runway.fetchImpl || fetch;
  const response = await fetchImpl(`${baseUrl}${endpointPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": runway.version || "2024-11-06",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: "Provider returned a non-JSON response." };
  }
  if (!response.ok) {
    const error = new Error(`Runway provider request failed with status ${response.status}.`);
    error.code = "RUNWAY_PROVIDER_REQUEST_FAILED";
    error.httpCode = 502;
    error.providerHttpStatus = response.status;
    error.providerBody = sanitizeProviderBody(parsed);
    error.providerBodyIssues = sanitizeProviderIssues(parsed?.issues);
    error.providerDocUrl = normalizeText(parsed?.docUrl, 1000) || null;
    error.providerBodyKeys = Object.keys(parsed || {}).slice(0, 20);
    error.providerError = parsed?.error !== undefined ? sanitizeProviderBody({ error: parsed.error }).error : null;
    error.providerErrorMessage = providerErrorMessage(parsed);
    error.providerErrorCode = providerErrorCode(parsed);
    error.endpointPath = endpointPath;
    error.model = payload.model || target.model;
    error.providerMode = target.providerMode;
    error.payloadPreview = payload;
    error.detail = {
      providerHttpStatus: error.providerHttpStatus,
      providerBody: error.providerBody,
      providerBodyIssues: error.providerBodyIssues,
      providerDocUrl: error.providerDocUrl,
      providerBodyKeys: error.providerBodyKeys,
      providerError: error.providerError,
      providerErrorMessage: error.providerErrorMessage,
      providerErrorCode: error.providerErrorCode,
      endpointPath: error.endpointPath,
      model: error.model,
      providerMode: error.providerMode,
      payloadPreview: error.payloadPreview,
    };
    throw error;
  }
  return normalizeRunwayResponse(parsed);
}

export async function checkRunwayOrganizationAuth({ apiKey, baseUrl, version, fetchImpl = fetch } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl || "https://api.dev.runwayml.com");
  const key = String(apiKey || "").trim();
  if (!key) {
    return {
      externalApiCall: false,
      authOk: false,
      providerStatus: null,
      responseKeys: [],
      message: "Transient Runway key was not received.",
    };
  }

  const response = await fetchImpl(`${normalizedBaseUrl}/v1/organization`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Runway-Version": version || "2024-11-06",
    },
  });

  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }

  const result = {
    externalApiCall: true,
    authOk: response.ok,
    providerStatus: response.status,
    responseKeys: Object.keys(parsed || {}).slice(0, 20),
  };
  if (parsed?.creditBalance !== undefined) {
    result.creditBalance = parsed.creditBalance;
  }
  if (response.status === 401) {
    result.message = "Runway rejected the API key";
  } else if (!response.ok) {
    result.message = "Runway organization auth check failed.";
  }
  return result;
}

export async function checkRunwayTaskStatus(providerJobId, { apiKey, baseUrl, version, statusPath, fetchImpl = fetch } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl || "https://api.dev.runwayml.com");
  const normalizedStatusPath = normalizePathPart(statusPath, "/v1/tasks");
  const normalizedProviderJobId = normalizeText(providerJobId, 160);
  const key = String(apiKey || "").trim();

  if (!normalizedProviderJobId) {
    return {
      provider: "runway",
      providerJobId: "",
      externalApiCall: false,
      providerStatus: null,
      providerHttpStatus: null,
      outputUrls: [],
      error: "providerJobId is required.",
      failure: true,
      responseKeys: [],
      checkedAt: nowIso(),
    };
  }

  if (!/^[a-zA-Z0-9_-]{8,200}$/.test(normalizedProviderJobId)) {
    return {
      provider: "runway",
      providerJobId: normalizedProviderJobId,
      externalApiCall: false,
      providerStatus: null,
      providerHttpStatus: null,
      outputUrls: [],
      error: "providerJobId has an invalid format.",
      failure: true,
      responseKeys: [],
      checkedAt: nowIso(),
    };
  }

  if (!key) {
    return {
      provider: "runway",
      providerJobId: normalizedProviderJobId,
      externalApiCall: false,
      providerStatus: null,
      providerHttpStatus: null,
      outputUrls: [],
      error: "Runway API key is required.",
      failure: true,
      responseKeys: [],
      checkedAt: nowIso(),
    };
  }

  const response = await fetchImpl(`${normalizedBaseUrl}${normalizedStatusPath}/${encodeURIComponent(normalizedProviderJobId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Runway-Version": version || "2024-11-06",
    },
  });

  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: "Provider returned a non-JSON response." };
  }

  const output = Array.isArray(parsed?.output)
    ? parsed.output
    : (Array.isArray(parsed?.outputs) ? parsed.outputs : []);
  const providerStatus = parsed?.status || parsed?.state || parsed?.taskStatus || null;
  const failureCode = normalizeText(parsed?.failureCode || parsed?.error?.code, 160) || null;
  const parsedError = parsed?.error?.message || parsed?.error || null;
  const failureMessage = normalizeText(parsed?.failure || parsedError || parsed?.message, 600) || null;
  const failedStatus = ["FAILED", "CANCELED", "CANCELLED", "failed", "canceled", "cancelled"].includes(String(providerStatus || ""));
  const failure = !response.ok || failedStatus || Boolean(parsed?.failure || parsed?.failureCode);
  const result = {
    provider: "runway",
    providerJobId: normalizeText(parsed?.id || parsed?.taskId || normalizedProviderJobId, 160),
    externalApiCall: true,
    providerStatus,
    providerHttpStatus: response.status,
    outputUrls: output.map((item) => normalizeText(item, 1200)).filter(Boolean),
    error: failure ? (failureMessage || "Runway task failed.") : (normalizeText(parsedError || parsed?.message, 600) || null),
    failure,
    failureCode,
    failureMessage,
    responseKeys: Object.keys(parsed || {}).slice(0, 20),
    checkedAt: nowIso(),
  };
  if (parsed?.creditUsage !== undefined) {
    result.creditUsage = parsed.creditUsage;
  }
  if (parsed?.usage !== undefined) {
    result.usage = parsed.usage;
  }
  return result;
}

export async function pollRunwayJobStatus(providerJobId) {
  return {
    provider: "runway",
    providerJobId: normalizeText(providerJobId, 160),
    status: "not_polled",
    externalApiCall: false,
    note: "Status polling is intentionally stubbed for the execution spike.",
    checkedAt: nowIso(),
  };
}

export async function createExecutionSpikeJob(input = {}, { config = {}, env = process.env, authContext = {} } = {}) {
  const dryRunJob = createDryRunJob({
    ...input,
    requestedBy: input.requestedBy || authContext?.source || "admin_execution_spike",
  });
  const baseGates = canExecuteRunwayProvider(config, env, authContext);
  const normalized = dryRunJob.normalizedJobRequest || {};
  const spikeGateFailures = [];
  if (!["realm_background", "portrait"].includes(normalized.assetKind)) {
    spikeGateFailures.push("execution spike assetKind must be realm_background or portrait");
  }
  if (normalized.safetyLevel !== "internal_review") {
    spikeGateFailures.push("execution spike safetyLevel must be internal_review");
  }
  if (!/^test[-_]/i.test(String(normalized.targetId || ""))) {
    spikeGateFailures.push("execution spike targetId must be a non-production test target such as test-realm or test-spiritkin");
  }
  const gates = {
    ok: baseGates.ok && spikeGateFailures.length === 0,
    missingGates: [...baseGates.missingGates, ...spikeGateFailures],
  };
  const runway = config?.generator?.video?.runway || {};

  const job = {
    ...dryRunJob,
    lifecycleState: gates.ok ? "queued" : "dry_run",
    executionSpike: true,
    externalApiCall: false,
    executionGates: gates,
    providerTarget: resolveRunwayGenerationTarget(dryRunJob, runway),
    apiPayloadPreview: buildRunwayApiPayload({
      ...dryRunJob,
      _runwayConfig: runway,
    }),
  };

  if (!gates.ok) {
    return {
      ok: true,
      executed: false,
      externalApiCall: false,
      job,
    };
  }

  try {
    const providerResult = await submitRunwayJob({
      ...job,
      _runwayConfig: runway,
    });
    return {
      ok: true,
      executed: true,
      externalApiCall: true,
      job: {
        ...job,
        lifecycleState: "queued",
        externalApiCall: true,
        providerResult,
      },
    };
  } catch (error) {
    return {
      ok: false,
      executed: true,
      externalApiCall: true,
      job: {
        ...job,
        lifecycleState: "failed",
        externalApiCall: true,
      },
      error: {
        code: "RUNWAY_PROVIDER_ERROR",
        message: error?.message || "Runway provider execution spike failed.",
      },
    };
  }
}
