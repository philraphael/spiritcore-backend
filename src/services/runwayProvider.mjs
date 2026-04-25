import { randomUUID } from "crypto";
import { ValidationError } from "../errors.mjs";

export const RUNWAY_SUPPORTED_ASSET_KINDS = Object.freeze([
  "portrait",
  "hero",
  "idle_video",
  "speaking_video",
  "calm_video",
  "trailer",
  "realm_background",
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
  idle: "idle_video",
  idlevideo: "idle_video",
  idle_video: "idle_video",
  speaking: "speaking_video",
  speakingvideo: "speaking_video",
  speaking_video: "speaking_video",
  calm: "calm_video",
  calmvideo: "calm_video",
  calm_video: "calm_video",
  trailervideo: "trailer",
  trailer_video: "trailer",
  intro_trailer: "trailer",
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

const VIDEO_KINDS = new Set(["idle_video", "speaking_video", "calm_video", "trailer"]);
const IMAGE_KINDS = new Set(["portrait", "hero", "realm_background", "game_board_theme", "game_piece_set"]);
const SAFETY_LEVELS = new Set(["standard", "strict", "internal_review"]);

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

function buildTarget(input = {}, assetKind) {
  const spiritkinId = normalizeText(input.spiritkinId || input.spiritkinName, 120);
  const targetId = normalizeText(input.targetId, 120);
  const realmId = normalizeText(input.realmId || targetId, 120);
  const gameType = normalizeText(input.gameType || targetId, 80);
  const themeId = normalizeText(input.themeId || input.styleProfile || "runway-theme", 80);

  if (assetKind === "realm_background") {
    return {
      targetType: "realm",
      targetId: realmId,
      requiredLabel: "realmId or targetId",
      activeRoot: `Spiritverse_MASTER_ASSETS/ACTIVE/realms/${slugify(realmId, "realm")}/${assetKind}`,
      publicRoot: `/app/assets/generated/realms/${slugify(realmId, "realm")}/${assetKind}`,
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

  const aspectRatio = normalizeText(input.aspectRatio || (VIDEO_KINDS.has(assetKind) ? "16:9" : "1:1"), 20);
  const sourceAssets = Array.isArray(input.sourceAssets)
    ? input.sourceAssets.map((item) => normalizeText(item, 240)).filter(Boolean).slice(0, 16)
    : [];

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
  const sourceAssets = Array.isArray(input.sourceAssets) && input.sourceAssets.length
    ? ` Source assets to preserve: ${input.sourceAssets.join(", ")}.`
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

export function buildRunwayApiPayload(job = {}) {
  const normalized = job.normalizedJobRequest || {};
  const promptPackage = job.promptPackage || buildRunwayPrompt(normalized);
  return {
    model: job.providerModel || "gen3a_turbo",
    promptText: promptPackage.prompt,
    negativePromptText: promptPackage.negativePrompt,
    ratio: normalized.aspectRatio || "16:9",
    duration: normalized.durationSec || (normalized.mediaType === "video" ? 8 : undefined),
    seed: job.seed || undefined,
    metadata: {
      spike: true,
      targetType: normalized.targetType,
      targetId: normalized.targetId,
      assetKind: normalized.assetKind,
      safetyLevel: normalized.safetyLevel,
      requestedBy: normalized.requestedBy,
    },
  };
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
  const response = await fetch(`${baseUrl}${normalizePathPart(runway.generatePath, "/v1/video/generate")}`, {
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
    throw new Error(`Runway provider request failed with status ${response.status}.`);
  }
  return normalizeRunwayResponse(parsed);
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
    providerModel: runway.model || "gen3a_turbo",
    apiPayloadPreview: buildRunwayApiPayload({
      ...dryRunJob,
      providerModel: runway.model || "gen3a_turbo",
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
