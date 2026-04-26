import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  canUseRunwayStagingAuthCheck,
  canUseRunwayStagingTestBypass,
  canUseRunwayTransientStagingCredentials,
  canUseMediaPlanningStagingBypass,
  canUseMediaIngestStagingBypass,
  canUseSpiritkinMotionStateStagingBypass,
  canUseSpiritGateEnhancementStagingBypass,
} from "../src/routes/admin.mjs";
import {
  buildRunwayApiPayload,
  canExecuteRunwayProvider,
  checkRunwayTaskStatus,
  createDryRunJob,
  resolveRunwayGenerationTarget,
  submitRunwayJob,
} from "../src/services/runwayProvider.mjs";
import {
  buildGenerationTemplate,
  buildSourceMediaReference,
  checkMediaRequirements,
  createMediaAssemblyPlan,
  createMediaPromotionPlan,
  createMotionPackBatchPlan,
  createProductionSequencePlan,
  createSafeVideoAssemblyResult,
  createSequenceComposeExecutionResult,
  createSequenceComposePlan,
  createSpiritCoreAvatarPackPlan,
  createSpiritCoreDefaultOperatorPlan,
  createSpiritkinMotionPackPlan,
  createSpiritkinMotionStateExecutionPlan,
  createSpiritkinSourceReferencePlan,
  createSpiritGateSegmentPlan,
  createSpiritGateEnhancementPlanFromCurrentSource,
  createSpiritGateEnhancementExecutionPlan,
  createSpiritGateEnhancementPlan,
  getMediaCatalogSummary,
  ORIGINAL_MOTION_PACK_ASSET_KINDS,
  PREMIUM_MEMBER_GENERATION_BOUNDARY,
  PREMIUM_SPIRITKIN_STARTER_PACK_ASSET_KINDS,
  resolveExistingSpiritGateSource,
  resolveExistingSpiritkinSource,
  SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES,
  SPIRITKIN_MOTION_SOURCE_CATEGORY_RULES,
  SPIRITCORE_AVATAR_PACK_ASSET_TYPES,
  SPIRITCORE_ASSISTANT_CAPABILITY_ROADMAP,
  SPIRITKIN_MOTION_PACK_ASSET_TYPES,
  SPIRITCORE_MEDIA_ASSET_KINDS,
  SPIRITCORE_MEDIA_REQUIREMENT_PROFILES,
} from "../src/services/spiritCoreMediaProduction.mjs";
import {
  buildMediaAssetIngestRecord,
  ingestReviewedMediaAsset,
  validateMediaAssetIngestRecord,
} from "../src/services/mediaAssetIngestService.mjs";

const PORT = Number(process.env.SPIRITCORE_DIAG_PORT || 3115);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DIAG_ADMIN_KEY = process.env.SPIRITCORE_DIAG_ADMIN_KEY || "diagnostic-admin-key";
const STARTUP_TIMEOUT_MS = 45000;
const REQUEST_TIMEOUT_MS = 15000;
const LEGACY_ROUTES_DISABLED_IN_PRODUCTION = process.env.NODE_ENV === "production"
  && !["1", "true", "yes", "on"].includes(String(process.env.ENABLE_LEGACY_ROUTES || "").trim().toLowerCase());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeJson(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return { type: "array", count: value.length };
  const summary = {};
  for (const key of ["ok", "message", "error", "count", "greeting"]) {
    if (value[key] !== undefined) summary[key] = value[key];
  }
  if (value.session?.currentSurface) summary.sessionSurface = value.session.currentSurface;
  if (value.session?.currentMode) summary.sessionMode = value.session.currentMode;
  if (value.conversation?.conversation_id) summary.conversationId = value.conversation.conversation_id;
  if (value.metadata?.conversationId) summary.metadataConversationId = value.metadata.conversationId;
  if (value.spiritkin) summary.spiritkin = value.spiritkin?.name || value.spiritkin;
  if (value.event?.id) summary.eventId = value.event.id;
  return summary;
}

function previewText(text, limit = 180) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

async function request(method, path, { body, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    let parsedBody = null;
    if (contentType.includes("application/json")) {
      parsedBody = await response.json();
    } else {
      const text = await response.text();
      parsedBody = {
        preview: previewText(text),
        length: text.length,
      };
    }

    return {
      ok: response.ok,
      status: response.status,
      contentType,
      headers: Object.fromEntries(response.headers.entries()),
      body: parsedBody,
    };
  } finally {
    clearTimeout(timer);
  }
}

function isSkippableSpeechResponse(result) {
  const message = result?.body?.error?.message || result?.body?.message || "";
  return [500, 502, 503].includes(result?.status) && /speech synthesis|tts not available|api key not configured|adapter/i.test(String(message));
}

function printResult(entry) {
  const status = entry.skipped ? "SKIP" : entry.pass ? "PASS" : "FAIL";
  const detail = entry.detail ? ` :: ${entry.detail}` : "";
  console.log(`${status.padEnd(4)} ${entry.method.padEnd(6)} ${entry.path}${detail}`);
}

function printInternalResult(entry) {
  const status = entry.pass ? "PASS" : "FAIL";
  const detail = entry.detail ? ` :: ${entry.detail}` : "";
  console.log(`${status.padEnd(4)} ${entry.method.padEnd(6)} ${entry.path}${detail}`);
}

async function waitForHealth() {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < STARTUP_TIMEOUT_MS) {
    try {
      const result = await request("GET", "/health");
      if (result.ok) return result;
    } catch {}
    await sleep(750);
  }
  throw new Error(`Server did not become healthy within ${STARTUP_TIMEOUT_MS}ms`);
}

async function main() {
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "staging",
      ADMIN_AUTH_MODE: "enforce",
      ADMIN_API_KEY: DIAG_ADMIN_KEY,
      RUNWAY_STAGING_TEST_BYPASS: "true",
      RUNWAY_AUTH_CHECK_MOCK: "true",
      RUNWAY_STATUS_CHECK_MOCK: "true",
      RUNWAY_SPIRITGATE_EXECUTE_MOCK: "true",
      RUNWAY_SPIRITKIN_MOTION_EXECUTE_MOCK: "true",
      RUNWAY_DRY_RUN_EXECUTE: "false",
      RUNWAY_ALLOW_PROVIDER_EXECUTION: "false",
      RUNWAY_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stderr.write(`[server] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[server] ${chunk}`);
  });

  const results = [];
  let conversationId = null;
  const userId = `diagnostic-${Date.now()}`;

  async function run(name, method, path, options = {}) {
    if (options.skip) {
      const entry = { name, method, path, skipped: true, pass: true, detail: options.skip };
      results.push(entry);
      printResult(entry);
      return entry;
    }

    try {
      const result = await request(method, path, options);
      const allowedStatus = Array.isArray(options.allowStatuses) && options.allowStatuses.includes(result.status);
      const entry = {
        name,
        method,
        path,
        pass: result.ok || allowedStatus,
        status: result.status,
        skipped: false,
        summary: summarizeJson(result.body),
        detail: options.describe ? options.describe(result) : null,
      };
      entry.raw = result;
      results.push(entry);
      printResult(entry);
      return entry;
    } catch (error) {
      const entry = {
        name,
        method,
        path,
        pass: false,
        skipped: false,
        detail: error?.message || String(error),
      };
      results.push(entry);
      printResult(entry);
      return entry;
    }
  }

  const cleanup = () => {
    if (!child.killed) child.kill("SIGTERM");
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    const validStagingBypassBody = {
      targetId: "test-realm",
      assetKind: "realm_background",
      promptIntent: "Diagnostic execution spike request shaping only.",
      styleProfile: "spiritverse_internal_test",
      safetyLevel: "internal_review",
    };
    const bypassChecks = [
      {
        name: "runway-staging-bypass-production-denied",
        pass: canUseRunwayStagingTestBypass(validStagingBypassBody, {
          NODE_ENV: "production",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "production does not allow staging bypass",
      },
      {
        name: "runway-staging-bypass-malformed-denied",
        pass: canUseRunwayStagingTestBypass({
          ...validStagingBypassBody,
          targetId: "real-realm",
        }, {
          NODE_ENV: "staging",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "non-test target cannot use staging bypass",
      },
      {
        name: "runway-staging-bypass-valid-allowed",
        pass: canUseRunwayStagingTestBypass(validStagingBypassBody, {
          NODE_ENV: "staging",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === true,
        detail: "valid staging test request can use bypass",
      },
      {
        name: "runway-transient-production-denied",
        pass: canUseRunwayTransientStagingCredentials(validStagingBypassBody, {
          "x-runway-transient-key": "mock-runway-key",
          "x-runway-transient-execute": "true",
          "x-runway-transient-provider-execution": "true",
        }, {
          NODE_ENV: "production",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "production cannot use transient credential path",
      },
      {
        name: "runway-transient-malformed-denied",
        pass: canUseRunwayTransientStagingCredentials({
          ...validStagingBypassBody,
          targetId: "real-realm",
        }, {
          "x-runway-transient-key": "mock-runway-key",
          "x-runway-transient-execute": "true",
          "x-runway-transient-provider-execution": "true",
        }, {
          NODE_ENV: "staging",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "malformed request cannot use transient credential path",
      },
      {
        name: "runway-transient-valid-allowed",
        pass: canUseRunwayTransientStagingCredentials(validStagingBypassBody, {
          "x-runway-transient-key": "mock-runway-key",
          "x-runway-transient-execute": "false",
          "x-runway-transient-provider-execution": "false",
        }, {
          NODE_ENV: "staging",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === true,
        detail: "valid staging request can use transient credential path",
      },
      {
        name: "runway-transient-alternate-header-allowed",
        pass: canUseRunwayTransientStagingCredentials(validStagingBypassBody, {
          "x-spiritcore-runway-token": "mock-runway-key",
          "x-runway-transient-execute": "false",
          "x-runway-transient-provider-execution": "false",
        }, {
          NODE_ENV: "staging",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === true,
        detail: "alternate transient key header accepted in staging",
      },
      {
        name: "runway-transient-body-production-denied",
        pass: canUseRunwayTransientStagingCredentials({
          ...validStagingBypassBody,
          runwayTransientKey: "mock-runway-key",
        }, {
          "x-runway-transient-execute": "true",
          "x-runway-transient-provider-execution": "true",
        }, {
          NODE_ENV: "production",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "production cannot use body fallback",
      },
      {
        name: "runway-transient-body-malformed-denied",
        pass: canUseRunwayTransientStagingCredentials({
          ...validStagingBypassBody,
          targetId: "real-realm",
          runwayTransientKey: "mock-runway-key",
        }, {
          "x-runway-transient-execute": "true",
          "x-runway-transient-provider-execution": "true",
        }, {
          NODE_ENV: "staging",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "malformed target cannot use body fallback",
      },
      {
        name: "runway-transient-body-gates-pass-with-flags",
        pass: canUseRunwayTransientStagingCredentials({
          ...validStagingBypassBody,
          runwayTransientKey: "mock-runway-key",
        }, {
          "x-runway-transient-execute": "true",
          "x-runway-transient-provider-execution": "true",
        }, {
          NODE_ENV: "staging",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === true && canExecuteRunwayProvider({
          env: "staging",
          adminAuth: { mode: "enforce" },
          generator: { video: { runway: { apiKey: "mock-runway-key" } } },
        }, {
          NODE_ENV: "staging",
          RUNWAY_API_KEY: "mock-runway-key",
          RUNWAY_DRY_RUN_EXECUTE: "true",
          RUNWAY_ALLOW_PROVIDER_EXECUTION: "true",
        }, {
          allowed: true,
          bypassed: true,
          source: "staging-test-bypass",
        }).ok === true,
        detail: "mock body fallback with execution flags would pass gates without provider call",
      },
      {
        name: "runway-auth-check-production-denied",
        pass: canUseRunwayStagingAuthCheck({
          NODE_ENV: "production",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "production cannot use Runway auth check",
      },
      {
        name: "runway-status-check-production-denied",
        pass: canUseRunwayStagingAuthCheck({
          NODE_ENV: "production",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "production cannot use Runway status check",
      },
      {
        name: "runway-image-provider-target",
        pass: (() => {
          const job = createDryRunJob({
            targetId: "test-realm",
            assetKind: "realm_background",
            promptIntent: "Diagnostic image payload mapping.",
            styleProfile: "spiritverse_internal_test",
            safetyLevel: "internal_review",
          });
          const target = resolveRunwayGenerationTarget(job, {});
          const payload = buildRunwayApiPayload(job);
          return target.endpointPath === "/v1/text_to_image"
            && target.model === "gen4_image"
            && payload.model === "gen4_image"
            && payload.ratio === "1920:1080"
            && payload.promptImage === undefined
            && payload.duration === undefined;
        })(),
        detail: "image asset maps to text_to_image gen4_image payload",
      },
      {
        name: "runway-video-provider-target",
        pass: (() => {
          const job = createDryRunJob({
            targetId: "test-realm",
            assetKind: "trailer",
            promptIntent: "Diagnostic video payload mapping.",
            styleProfile: "spiritverse_internal_test",
            safetyLevel: "internal_review",
            sourceAssets: ["https://example.com/reference.png"],
          });
          const target = resolveRunwayGenerationTarget(job, {});
          const payload = buildRunwayApiPayload(job);
          return target.endpointPath === "/v1/image_to_video"
            && target.model === "gen4_turbo"
            && payload.model === "gen4_turbo"
            && payload.promptImage === "https://example.com/reference.png"
            && payload.duration === 8;
        })(),
        detail: "video asset maps to image_to_video gen4_turbo payload",
      },
      {
        name: "runway-image-to-video-payload-compatible",
        pass: (() => {
          const job = createDryRunJob({
            spiritkinId: "lyra",
            targetId: "lyra-motion-pack-v1",
            assetKind: "idle_video",
            promptIntent: "Diagnostic idle payload compatibility.",
            styleProfile: "spiritverse_internal_test",
            safetyLevel: "internal_review",
            sourceAssetRef: "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png",
            sourceAssets: ["https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png"],
            sourceAssetType: "external_url",
            durationSec: 5,
            aspectRatio: "720:1280",
          });
          const target = resolveRunwayGenerationTarget(job, {});
          const payload = buildRunwayApiPayload(job);
          const payloadKeys = Object.keys(payload).sort();
          const unsupportedFields = ["aspectRatio", "motionIntensity", "generationMode", "allowMouthMovement", "sourceAssetRef", "sourceAssetType"];
          return target.endpointPath === "/v1/image_to_video"
            && target.providerMode === "image_to_video"
            && target.model === "gen4_turbo"
            && payload.model === "gen4_turbo"
            && payload.promptImage === "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png"
            && typeof payload.promptText === "string"
            && payload.promptText.length > 0
            && payload.ratio === "720:1280"
            && [5, 8].includes(payload.duration)
            && payloadKeys.join(",") === "duration,model,promptImage,promptText,ratio"
            && unsupportedFields.every((field) => payload[field] === undefined);
        })(),
        detail: "image_to_video payload uses only Runway-supported fields",
      },
      {
        name: "runway-provider-400-error-sanitized",
        pass: await (async () => {
          try {
            const job = createDryRunJob({
              spiritkinId: "lyra",
              targetId: "lyra-motion-pack-v1",
              assetKind: "idle_video",
              promptIntent: "Diagnostic provider 400 handling.",
              styleProfile: "spiritverse_internal_test",
              safetyLevel: "internal_review",
              sourceAssets: ["https://example.com/lyra.png"],
              durationSec: 5,
              aspectRatio: "720:1280",
            });
            await submitRunwayJob({
              ...job,
              _runwayConfig: {
                baseUrl: "https://api.dev.runwayml.com",
                apiKey: "mock-runway-key",
                videoModel: "gen4_turbo",
              },
              fetchImpl: async () => new Response(JSON.stringify({
                error: "Validation of body failed",
                issues: [
                  {
                    path: ["ratio"],
                    message: "Invalid option for ratio. Accepted values: 1280:720, 720:1280, 1104:832, 832:1104, 960:960, 1584:672.",
                    code: "invalid_enum_value",
                  },
                ],
                docUrl: "https://docs.dev.runwayml.com/api",
                code: "INVALID_ARGUMENT",
              }), { status: 400, headers: { "content-type": "application/json" } }),
            });
            return false;
          } catch (error) {
            const serialized = JSON.stringify(error.detail || {});
            return error.code === "RUNWAY_PROVIDER_REQUEST_FAILED"
              && error.providerHttpStatus === 400
              && error.providerErrorMessage === "Validation of body failed"
              && error.providerErrorCode === "INVALID_ARGUMENT"
              && error.providerBodyKeys.includes("issues")
              && Array.isArray(error.providerBodyIssues)
              && error.providerBodyIssues[0]?.message === "Invalid option for ratio. Accepted values: 1280:720, 720:1280, 1104:832, 832:1104, 960:960, 1584:672."
              && error.providerDocUrl === "https://docs.dev.runwayml.com/api"
              && error.endpointPath === "/v1/image_to_video"
              && error.model === "gen4_turbo"
              && error.providerMode === "image_to_video"
              && error.payloadPreview?.promptImage === "https://example.com/lyra.png"
              && !serialized.includes("mock-runway-key");
          }
        })(),
        detail: "mocked provider 400 returns sanitized request failure details without secrets",
      },
      {
        name: "runway-spiritgate-video-to-video-target",
        pass: (() => {
          const job = createDryRunJob({
            targetId: "spiritgate",
            assetKind: "spiritgate_video",
            promptIntent: "Diagnostic SpiritGate video-to-video payload mapping.",
            styleProfile: "spiritverse_internal_test",
            safetyLevel: "internal_review",
            sourceAssetRef: "https://example.com/spiritgate.mp4",
            sourceAssets: ["https://example.com/spiritgate.mp4"],
            sourceAssetType: "external_url",
          });
          const target = resolveRunwayGenerationTarget(job, {});
          const payload = buildRunwayApiPayload(job);
          return target.endpointPath === "/v1/video_to_video"
            && target.providerMode === "video_to_video"
            && target.model === "gen4_aleph"
            && payload.model === "gen4_aleph"
            && payload.videoUri === "https://example.com/spiritgate.mp4"
            && payload.promptImage === undefined;
        })(),
        detail: "SpiritGate video maps to video_to_video gen4_aleph payload",
      },
      {
        name: "runway-status-failure-details-sanitized",
        pass: await (async () => {
          const result = await checkRunwayTaskStatus("5d7764c2-47f4-4653-b69d-5e385e667195", {
            apiKey: "mock-runway-key",
            fetchImpl: async () => new Response(JSON.stringify({
              id: "5d7764c2-47f4-4653-b69d-5e385e667195",
              status: "FAILED",
              failure: "An unexpected error occurred.",
              failureCode: "INTERNAL.BAD_OUTPUT.CODE01",
              output: null,
            }), { status: 200, headers: { "content-type": "application/json" } }),
          });
          const serialized = JSON.stringify(result);
          return result.providerStatus === "FAILED"
            && result.providerHttpStatus === 200
            && result.failure === true
            && result.failureCode === "INTERNAL.BAD_OUTPUT.CODE01"
            && result.failureMessage === "An unexpected error occurred."
            && result.error === "An unexpected error occurred."
            && result.outputUrls.length === 0
            && result.responseKeys.includes("failure")
            && result.responseKeys.includes("failureCode")
            && !serialized.includes("mock-runway-key");
        })(),
        detail: "mocked failed Runway task returns sanitized failure code and message without secrets",
      },
      {
        name: "spiritgate-enhancement-production-denied",
        pass: canUseSpiritGateEnhancementStagingBypass({
          targetId: "spiritgate",
          sourceAssetRef: "https://example.com/spiritgate.mp4",
          sourceAssetType: "external_url",
          safetyLevel: "internal_review",
          operatorApproval: true,
        }, {
          NODE_ENV: "production",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "production cannot use SpiritGate enhancement staging bypass",
      },
      {
        name: "spiritgate-enhancement-valid-staging-bypass",
        pass: canUseSpiritGateEnhancementStagingBypass({
          targetId: "spiritgate",
          sourceAssetRef: "https://example.com/spiritgate.mp4",
          sourceAssetType: "external_url",
          safetyLevel: "internal_review",
          operatorApproval: true,
        }, {
          NODE_ENV: "staging",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === true,
        detail: "valid SpiritGate enhancement request can use staging operator bypass",
      },
      {
        name: "spiritkin-motion-state-production-denied",
        pass: canUseSpiritkinMotionStateStagingBypass({
          spiritkinId: "lyra",
          targetId: "lyra-motion-pack-v1",
          assetType: "speaking_01",
          assetKind: "speaking_video",
          sourceAssetRef: "https://example.com/lyra.png",
          sourceAssetType: "external_url",
          safetyLevel: "internal_review",
          operatorApproval: true,
        }, {
          NODE_ENV: "production",
          RUNWAY_STAGING_TEST_BYPASS: "true",
        }) === false,
        detail: "production cannot use Spiritkin motion-state staging bypass",
      },
      {
        name: "spiritkin-motion-state-valid-staging-bypass",
        pass: canUseSpiritkinMotionStateStagingBypass({
          spiritkinId: "lyra",
          targetId: "lyra-motion-pack-v1",
          assetType: "speaking_01",
          assetKind: "speaking_video",
          sourceAssetRef: "https://example.com/lyra.png",
          sourceAssetType: "external_url",
          safetyLevel: "internal_review",
          operatorApproval: true,
        }, {
          NODE_ENV: "staging",
          MEDIA_STAGING_TEST_BYPASS: "true",
        }) === true,
        detail: "valid Spiritkin motion-state request can use staging operator bypass",
      },
      {
        name: "media-planning-bypass-production-denied",
        pass: canUseMediaPlanningStagingBypass({
          method: "POST",
          route: "/admin/media/operator-experience-plan",
          headers: { "x-media-planning-test": "true" },
          env: { NODE_ENV: "production", RUNWAY_STAGING_TEST_BYPASS: "true" },
        }) === false,
        detail: "production cannot use media planning bypass",
      },
      {
        name: "media-planning-bypass-staging-allowed",
        pass: canUseMediaPlanningStagingBypass({
          method: "POST",
          route: "/admin/media/operator-experience-plan",
          headers: { "x-media-planning-test": "true" },
          env: { NODE_ENV: "staging", RUNWAY_STAGING_TEST_BYPASS: "true" },
        }) === true,
        detail: "staging planning route can use media planning bypass",
      },
      {
        name: "media-planning-bypass-execution-denied",
        pass: canUseMediaPlanningStagingBypass({
          method: "POST",
          route: "/admin/media/spiritgate-enhancement-execute",
          headers: { "x-media-planning-test": "true" },
          env: { NODE_ENV: "staging", RUNWAY_STAGING_TEST_BYPASS: "true" },
        }) === false,
        detail: "execution route cannot use media planning bypass",
      },
      {
        name: "media-asset-ingest-approved-paths-and-metadata",
        pass: await (async () => {
          const input = {
            entityId: "Lyra",
            packId: "motion-pack-v1",
            assetType: "speaking_01",
            variant: "diag",
            status: "approved",
            provider: "runway",
            providerJobId: "5d7764c2-47f4-4653-b69d-5e385e667195",
            outputUrl: "https://example.com/lyra-speaking.mp4",
            sourceAssetRef: "https://example.com/lyra-source.png",
            durationSec: 5,
            ratio: "720:1280",
            generationMode: "subtle_speaking",
            reviewNotes: "Diagnostic reviewed asset ingest.",
            approvedBy: "endpoint-diagnostics",
          };
          const record = buildMediaAssetIngestRecord(input, { now: "2026-04-26T12:00:00.000Z" });
          const validation = validateMediaAssetIngestRecord(record);
          const result = await ingestReviewedMediaAsset(input, {
            now: "2026-04-26T12:00:00.000Z",
            workspaceRoot: path.join(process.cwd(), "runtime_data", "diagnostics", "media-ingest"),
            downloadAsset: async () => Buffer.from("diagnostic mp4 bytes"),
          });
          const metadata = JSON.parse(await readFile(
            path.join(process.cwd(), "runtime_data", "diagnostics", "media-ingest", result.metadataPath),
            "utf8",
          ));
          return validation.ok
            && record.approvedRelativePath === "Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_motion_pack_v1_speaking_01_diag_approved_20260426_5d7764c247.mp4"
            && result.savedPath === record.approvedRelativePath
            && result.metadataPath.endsWith(".metadata.json")
            && metadata.providerJobId === input.providerJobId
            && metadata.approvalState === "approved"
            && metadata.activePromotionPerformed === false
            && metadata.noActiveWritePerformed === true
            && metadata.noManifestUpdatePerformed === true
            && !result.savedPath.includes("/ACTIVE/")
            && !result.metadataPath.includes("/ACTIVE/");
        })(),
        detail: "approved media ingest resolves APPROVED path, writes metadata, and avoids ACTIVE writes",
      },
      {
        name: "media-asset-ingest-filename-deduplicates-entity",
        pass: await (async () => {
          const input = {
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            assetType: "speaking_01",
            variant: "v1",
            status: "approved",
            provider: "runway",
            providerJobId: "6758f00da7-test-job",
            outputUrl: "https://example.com/lyra-speaking.mp4",
            sourceAssetRef: "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png",
            durationSec: 5,
            ratio: "720:1280",
            generationMode: "subtle_speaking",
            reviewNotes: "Diagnostic filename normalization ingest.",
            approvedBy: "endpoint-diagnostics",
          };
          const result = await ingestReviewedMediaAsset(input, {
            now: "2026-04-26T12:00:00.000Z",
            workspaceRoot: path.join(process.cwd(), "runtime_data", "diagnostics", "media-ingest-dedupe"),
            downloadAsset: async () => Buffer.from("diagnostic dedupe mp4 bytes"),
          });
          const metadata = JSON.parse(await readFile(
            path.join(process.cwd(), "runtime_data", "diagnostics", "media-ingest-dedupe", result.metadataPath),
            "utf8",
          ));
          return result.savedPath.endsWith("lyra_motion_pack_v1_speaking_01_v1_approved_20260426_6758f00da7.mp4")
            && !result.savedPath.includes("lyra_lyra_motion_pack_v1")
            && metadata.packId === "lyra-motion-pack-v1"
            && metadata.packSlug === "lyra_motion_pack_v1"
            && metadata.packFileComponent === "motion_pack_v1"
            && metadata.activePromotionPerformed === false
            && metadata.noActiveWritePerformed === true
            && metadata.noManifestUpdatePerformed === true
            && metadata.providerGenerationPerformed === false;
        })(),
        detail: "ingest filenames avoid duplicate entity prefix while metadata preserves original packId",
      },
      {
        name: "media-asset-ingest-bypass-production-denied",
        pass: canUseMediaIngestStagingBypass({
          method: "POST",
          route: "/admin/media/asset-ingest",
          headers: { "x-media-ingest-test": "true" },
          env: { NODE_ENV: "production", MEDIA_STAGING_TEST_BYPASS: "true" },
          body: {
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            status: "approved",
            outputUrl: "https://example.com/lyra.mp4",
            sourceAssetRef: "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png",
          },
        }) === false,
        detail: "production cannot use media asset ingest bypass",
      },
      {
        name: "media-asset-ingest-bypass-staging-allowed",
        pass: canUseMediaIngestStagingBypass({
          method: "POST",
          route: "/admin/media/asset-ingest",
          headers: { "x-media-ingest-test": "true" },
          env: { NODE_ENV: "staging", MEDIA_STAGING_TEST_BYPASS: "true" },
          body: {
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            status: "approved",
            outputUrl: "https://example.com/lyra.mp4",
            sourceAssetRef: "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png",
          },
        }) === true,
        detail: "staging can use narrow reviewed asset ingest bypass for approved Lyra motion pack asset",
      },
      {
        name: "media-asset-ingest-bypass-status-denied",
        pass: canUseMediaIngestStagingBypass({
          method: "POST",
          route: "/admin/media/asset-ingest",
          headers: { "x-media-ingest-test": "true" },
          env: { NODE_ENV: "staging", MEDIA_STAGING_TEST_BYPASS: "true" },
          body: {
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            status: "review_required",
            outputUrl: "https://example.com/lyra.mp4",
            sourceAssetRef: "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png",
          },
        }) === false,
        detail: "staging ingest bypass requires status=approved",
      },
      {
        name: "media-asset-ingest-bypass-output-url-denied",
        pass: canUseMediaIngestStagingBypass({
          method: "POST",
          route: "/admin/media/asset-ingest",
          headers: { "x-media-ingest-test": "true" },
          env: { NODE_ENV: "staging", MEDIA_STAGING_TEST_BYPASS: "true" },
          body: {
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            status: "approved",
            outputUrl: "http://example.com/lyra.mp4",
            sourceAssetRef: "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png",
          },
        }) === false,
        detail: "staging ingest bypass requires HTTPS outputUrl",
      },
      {
        name: "media-asset-ingest-bypass-source-host-denied",
        pass: canUseMediaIngestStagingBypass({
          method: "POST",
          route: "/admin/media/asset-ingest",
          headers: { "x-media-ingest-test": "true" },
          env: { NODE_ENV: "staging", MEDIA_STAGING_TEST_BYPASS: "true" },
          body: {
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            status: "approved",
            outputUrl: "https://example.com/lyra.mp4",
            sourceAssetRef: "https://example.com/portraits/lyra_portrait.png",
          },
        }) === false,
        detail: "staging ingest bypass requires known staging sourceAssetRef host",
      },
      {
        name: "media-asset-kinds-valid",
        pass: ["portrait", "spiritgate_video", "wake_visual", "trailer_video", "game_piece_set"].every((kind) => SPIRITCORE_MEDIA_ASSET_KINDS.includes(kind)),
        detail: "SpiritCore media asset kinds include production foundation kinds",
      },
      {
        name: "media-requirement-profiles-exist",
        pass: ["original_spiritkin", "premium_spiritkin", "spiritgate_realm", "game_assets", "wake_presence"]
          .every((profileId) => Boolean(SPIRITCORE_MEDIA_REQUIREMENT_PROFILES[profileId])),
        detail: "media requirement profiles exist",
      },
      {
        name: "media-original-requirements-check",
        pass: (() => {
          const result = checkMediaRequirements({
            profileId: "original_spiritkin",
            spiritkinId: "Lyra",
            assets: [
              { spiritkinId: "Lyra", assetKind: "portrait", lifecycleState: "active", reviewStatus: "approved", promotionStatus: "promoted", activeStatus: "active" },
              { spiritkinId: "Lyra", assetKind: "hero", lifecycleState: "review_required", reviewStatus: "pending" },
            ],
          });
          return result.missingRequiredAssets.includes("idle_video")
            && result.awaitingReviewAssets.includes("hero")
            && result.activeAssets.includes("portrait")
            && result.noBehaviorBlock === true;
        })(),
        detail: "original Spiritkin can be checked against media requirements",
      },
      {
        name: "media-premium-profile-exists",
        pass: SPIRITCORE_MEDIA_REQUIREMENT_PROFILES.premium_spiritkin?.requiredAssetKinds?.includes("wake_visual") === true,
        detail: "premium Spiritkin requirement profile exists",
      },
      {
        name: "media-template-no-provider-call",
        pass: (() => {
          const result = buildGenerationTemplate({
            assetKind: "wake_visual",
            spiritkinName: "Lyra",
            spiritkinRole: "Celestial Fawn of the Luminous Veil",
            visualIdentity: "gentle luminous companion presence",
            loreSummary: "A warm emotional anchor in the Luminous Veil.",
            colorPalette: "rose, pearl, soft gold",
            emotionalTone: "calm, reassuring, magical",
            referenceAssets: ["/app/assets/concepts/Lyra.png"],
          });
          return result.providerCall === false && result.prompt.includes("Lyra") && result.prompt.includes("wake_visual");
        })(),
        detail: "template generation produces prompt text without provider calls",
      },
      {
        name: "media-promotion-plan-no-active-write",
        pass: (() => {
          const result = createMediaPromotionPlan({
            spiritkinId: "Lyra",
            assetKind: "presence_indicator",
            lifecycleState: "approved",
            reviewStatus: "approved",
            promotionStatus: "planned",
          });
          return result.operatorApprovalRequired === true
            && result.noManifestUpdates === true
            && result.noActiveWrites === true
            && result.activePath.includes("ACTIVE");
        })(),
        detail: "review and promotion plans do not write ACTIVE assets automatically",
      },
      {
        name: "media-spiritgate-enhancement-plan",
        pass: (() => {
          const result = createSpiritGateEnhancementPlan({
            existingSourceAsset: "SpiritGate/PikaLabs/original-spiritgate.mp4",
            versionTag: "diag-spiritgate-upgrade",
          });
          return result.noProviderCall === true
            && result.spiritGate.originalReplacementAllowed === false
            && result.spiritGate.existingSourceAsset.includes("PikaLabs");
        })(),
        detail: "SpiritGate enhancement plan preserves existing source asset",
      },
      {
        name: "media-source-reference-model",
        pass: (() => {
          const result = buildSourceMediaReference({
            sourceAssetId: "existing-pika-spiritgate-video",
            targetId: "spiritgate",
            targetType: "spiritgate",
            assetKind: "spiritgate_video",
            sourceType: "external_url",
            sourceUrl: "https://example.com/spiritgate.mp4",
            approvedForReference: true,
          });
          return result.sourceAssetId === "existing-pika-spiritgate-video"
            && result.providerCompatibility.runway.videoToVideo === true
            && result.providerCompatibility.runway.recommendedMode === "video_to_video";
        })(),
        detail: "source media reference supports video-to-video provider compatibility",
      },
      {
        name: "media-spiritgate-execution-plan-review-required",
        pass: (() => {
          const result = createSpiritGateEnhancementExecutionPlan({
            targetId: "spiritgate",
            sourceAssetRef: "https://example.com/spiritgate.mp4",
            sourceAssetType: "external_url",
            promptIntent: "Diagnostic SpiritGate enhancement execution plan.",
            styleProfile: "premium cinematic SpiritGate enhancement",
            safetyLevel: "internal_review",
          });
          return result.assetRecord.lifecycleState === "review_required"
            && result.providerTarget.providerMode === "video_to_video"
            && result.providerTarget.recommendedModel === "gen4_aleph"
            && result.noPromotionPerformed === true
            && result.noManifestUpdatePerformed === true
            && result.noActiveWritePerformed === true;
        })(),
        detail: "SpiritGate execution plan remains review_required and write-safe",
      },
      {
        name: "media-existing-spiritgate-source-discovery",
        pass: (() => {
          const result = resolveExistingSpiritGateSource({
            origin: "https://spiritcore-backend-copy-production.up.railway.app",
          });
          return result.currentPath === "/videos/gate_entrance_final.mp4"
            && result.localFilePath === "spiritkins-app/public/videos/gate_entrance_final.mp4"
            && result.publicUrl === "https://spiritcore-backend-copy-production.up.railway.app/videos/gate_entrance_final.mp4"
            && result.canUseForRunwayVideoToVideo === true
            && result.noFileWrites === true;
        })(),
        detail: "existing SpiritGate source resolves to the current app video path",
      },
      {
        name: "media-spiritgate-plan-from-current-source",
        pass: (() => {
          const result = createSpiritGateEnhancementPlanFromCurrentSource({
            origin: "https://spiritcore-backend-copy-production.up.railway.app",
          });
          return result.readyToRunPayload.sourceAssetRef.endsWith("/videos/gate_entrance_final.mp4")
            && result.readyToRunPayload.sourceAssetType === "external_url"
            && result.modelToolRecommendation.includes("gen4_aleph")
            && result.noGenerationPerformed === true
            && result.noProviderCall === true
            && result.noActiveWritePerformed === true;
        })(),
        detail: "SpiritGate enhancement payload can be built from current source without generation",
      },
      {
        name: "media-spiritgate-segment-plan-calculates-count",
        pass: (() => {
          const result = createSpiritGateSegmentPlan({
            targetId: "spiritgate",
            sourceAssetRef: "https://example.com/gate_entrance_final.mp4",
            sourceDurationSec: 43.349,
            segmentDurationSec: 5,
            styleProfile: "premium cinematic SpiritGate enhancement",
            safetyLevel: "internal_review",
            endingNeedsTransitionImprovement: true,
          });
          const finalSegment = result.segments[result.segments.length - 1];
          return result.totalSegments === 9
            && result.estimatedGenerationCount === 9
            && finalSegment.enhancementMode === "transition-improvement"
            && finalSegment.promptIntent.includes("smooth")
            && finalSegment.promptIntent.includes("emotional")
            && result.noGenerationPerformed === true
            && result.noProviderCall === true
            && result.noActiveWritePerformed === true
            && result.premiumMemberGeneration.enabled === false;
        })(),
        detail: "SpiritGate segment plan calculates 5-second segments and final transition prompt",
      },
      {
        name: "media-spiritcore-default-operator-plan",
        pass: (() => {
          const result = createSpiritCoreDefaultOperatorPlan({
            defaultOperatorType: "spiritcore",
            spiritkinsEnabled: true,
            entitlements: { spiritcorePremium: true, spiritkinPremium: false },
          });
          return result.defaultOperatorType === "spiritcore"
            && result.spiritcoreIsUniversalDefault === true
            && result.spiritkinsAreOptionalCompanions === true
            && result.entitlementSeparation.spiritcorePremium === true
            && result.entitlementSeparation.spiritkinPremium === false
            && result.noProviderCall === true
            && result.noActiveWritePerformed === true;
        })(),
        detail: "SpiritCore default operator planning works with separated entitlements",
      },
      {
        name: "media-spiritkin-motion-pack-plan",
        pass: (() => {
          const result = createSpiritkinMotionPackPlan({
            spiritkinId: "lyra",
            targetId: "lyra-motion-pack-v1",
            styleProfile: "premium cinematic Spiritverse companion",
            safetyLevel: "internal_review",
          });
          return SPIRITKIN_MOTION_PACK_ASSET_TYPES.every((assetType) => result.plannedAssets.some((asset) => asset.assetType === assetType))
            && result.plannedAssets.every((asset) => asset.lifecycleState === "review_required")
            && result.noGenerationPerformed === true
            && result.noProviderCall === true
            && result.noPromotionPerformed === true
            && result.premiumMemberGeneration.enabled === false;
        })(),
        detail: "Spiritkin motion pack plan includes every required motion asset without generation",
      },
      {
        name: "media-lyra-source-resolver",
        pass: (() => {
          const result = resolveExistingSpiritkinSource("lyra", {
            origin: "https://spiritcore-backend-copy-production.up.railway.app",
          });
          return result.canonicalName === "Lyra"
            && result.currentPath === "/portraits/lyra_portrait.png"
            && result.publicUrl === "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png"
            && result.canUseForRunwayImageToVideo === true
            && result.approvedForReference === true
            && result.noProviderCall === true
            && result.noActiveWritePerformed === true;
        })(),
        detail: "Lyra source resolver finds canonical portrait for image-to-video",
      },
      {
        name: "media-spiritkin-motion-state-execution-plan",
        pass: (() => {
          const result = createSpiritkinMotionStateExecutionPlan({
            spiritkinId: "lyra",
            targetId: "lyra-motion-pack-v1",
            assetType: "speaking_01",
            assetKind: "speaking_video",
            sourceAssetRef: "https://example.com/lyra_portrait.png",
            sourceAssetType: "external_url",
            promptIntent: "Animate Lyra into a premium speaking loop.",
            styleProfile: "premium cinematic Spiritverse companion",
            safetyLevel: "internal_review",
          });
          return result.assetType === "speaking_01"
            && result.assetKind === "speaking_video"
            && result.providerTarget.providerMode === "image_to_video"
            && result.generationControls.durationSec === 5
            && result.generationControls.generationMode === "diagnostic_idle"
            && result.generationControls.motionIntensity === "low"
            && result.generationControls.allowMouthMovement === false
            && result.promptIntent.includes("No speaking, no mouth movement")
            && result.promptIntent.length < 700
            && result.mediaAssetRecord.lifecycleState === "review_required"
            && result.mediaAssetRecord.reviewStatus === "pending"
            && result.mediaAssetRecord.outputUrls.length === 0
            && result.premiumMemberGeneration.enabled === false
            && result.noPromotionPerformed === true
            && result.noManifestUpdatePerformed === true
            && result.noActiveWritePerformed === true;
        })(),
        detail: "Spiritkin motion-state execution plan remains review_required and image-to-video",
      },
      {
        name: "media-spiritkin-motion-controls-invalid-duration",
        pass: (() => {
          try {
            createSpiritkinMotionStateExecutionPlan({
              spiritkinId: "lyra",
              targetId: "lyra-motion-pack-v1",
              assetType: "idle_01",
              assetKind: "idle_video",
              sourceAssetRef: "https://example.com/lyra_portrait.png",
              sourceAssetType: "external_url",
              promptIntent: "Diagnostic invalid duration.",
              styleProfile: "premium cinematic Spiritverse companion",
              safetyLevel: "internal_review",
              durationSec: 6,
            });
            return false;
          } catch (error) {
            return String(error?.message || "").includes("Invalid Spiritkin motion generation controls")
              && (error?.detail?.fields || []).includes("durationSec must be 5 or 8");
          }
        })(),
        detail: "invalid motion duration is rejected before provider execution",
      },
      {
        name: "media-spiritkin-motion-provider-ratios",
        pass: (() => {
          const vertical = createSpiritkinMotionStateExecutionPlan({
            spiritkinId: "lyra",
            targetId: "lyra-motion-pack-v1",
            assetType: "idle_01",
            assetKind: "idle_video",
            sourceAssetRef: "https://example.com/lyra_portrait.png",
            sourceAssetType: "external_url",
            promptIntent: "Diagnostic vertical ratio normalization.",
            styleProfile: "premium cinematic Spiritverse companion",
            safetyLevel: "internal_review",
            ratio: "720:1280",
          });
          const horizontal = createSpiritkinMotionStateExecutionPlan({
            spiritkinId: "lyra",
            targetId: "lyra-motion-pack-v1",
            assetType: "idle_01",
            assetKind: "idle_video",
            sourceAssetRef: "https://example.com/lyra_portrait.png",
            sourceAssetType: "external_url",
            promptIntent: "Diagnostic horizontal ratio normalization.",
            styleProfile: "premium cinematic Spiritverse companion",
            safetyLevel: "internal_review",
            ratio: "1280:720",
          });
          let invalidRejected = false;
          try {
            createSpiritkinMotionStateExecutionPlan({
              spiritkinId: "lyra",
              targetId: "lyra-motion-pack-v1",
              assetType: "idle_01",
              assetKind: "idle_video",
              sourceAssetRef: "https://example.com/lyra_portrait.png",
              sourceAssetType: "external_url",
              promptIntent: "Diagnostic invalid provider ratio.",
              styleProfile: "premium cinematic Spiritverse companion",
              safetyLevel: "internal_review",
              ratio: "768:1280",
            });
          } catch (error) {
            invalidRejected = String(error?.message || "").includes("Invalid Spiritkin motion generation controls")
              && (error?.detail?.fields || []).some((field) => String(field).includes("ratio must be one of"));
          }
          return vertical.generationControls.aspectRatio === "720:1280"
            && horizontal.generationControls.aspectRatio === "1280:720"
            && invalidRejected;
        })(),
        detail: "provider-supported image-to-video ratios are preserved and 768:1280 is rejected",
      },
      {
        name: "media-spiritkin-diagnostic-idle-prompt-safe",
        pass: (() => {
          const result = createSpiritkinMotionStateExecutionPlan({
            spiritkinId: "lyra",
            targetId: "lyra-motion-pack-v1",
            assetType: "idle_01",
            assetKind: "idle_video",
            sourceAssetRef: "https://example.com/lyra_portrait.png",
            sourceAssetType: "external_url",
            promptIntent: "Animate Lyra in a diagnostic idle loop.",
            styleProfile: "premium cinematic Spiritverse companion",
            safetyLevel: "internal_review",
            durationSec: 5,
            motionIntensity: "low",
            generationMode: "diagnostic_idle",
            allowMouthMovement: false,
          });
          return result.assetType === "idle_01"
            && result.assetKind === "idle_video"
            && result.generationControls.durationSec === 5
            && result.generationControls.generationMode === "diagnostic_idle"
            && result.promptIntent.includes("gentle blinking, soft breathing, and tiny natural head movement")
            && result.promptIntent.includes("No speaking, no mouth movement")
            && !result.promptIntent.includes("Style profile:")
            && result.promptIntent.length < 700
            && result.noPromotionPerformed === true
            && result.noManifestUpdatePerformed === true
            && result.noActiveWritePerformed === true;
        })(),
        detail: "diagnostic idle prompt avoids speaking and mouth movement demands",
      },
      {
        name: "media-spiritkin-compact-motion-prompts",
        pass: (() => {
          const modeExpectations = [
            {
              generationMode: "diagnostic_idle",
              assetType: "idle_01",
              assetKind: "idle_video",
              mustInclude: "No speaking, no mouth movement",
              maxLength: 1000,
            },
            {
              generationMode: "subtle_speaking",
              assetType: "speaking_01",
              assetKind: "speaking_video",
              mustInclude: "silent subtle speaking presence loop",
              maxLength: 1000,
            },
            {
              generationMode: "speaking",
              assetType: "speaking_01",
              assetKind: "speaking_video",
              mustInclude: "restrained speaking presence loop",
              maxLength: 1000,
            },
          ];
          return modeExpectations.every((expectation) => {
            const plan = createSpiritkinMotionStateExecutionPlan({
              spiritkinId: "lyra",
              targetId: "lyra-motion-pack-v1",
              assetType: expectation.assetType,
              assetKind: expectation.assetKind,
              sourceAssetRef: "https://example.com/lyra_portrait.png",
              sourceAssetType: "external_url",
              promptIntent: "Animate Lyra in a motion diagnostic.",
              styleProfile: "premium cinematic Spiritverse companion with a deliberately verbose style profile that should not be duplicated in provider prompt text",
              safetyLevel: "internal_review",
              durationSec: 5,
              ratio: "720:1280",
              motionIntensity: "low",
              generationMode: expectation.generationMode,
              allowMouthMovement: expectation.generationMode !== "diagnostic_idle",
            });
            const job = createDryRunJob({
              spiritkinId: plan.spiritkinId,
              targetId: plan.targetId,
              assetKind: plan.assetKind,
              promptIntent: plan.promptIntent,
              styleProfile: plan.styleProfile,
              safetyLevel: plan.safetyLevel,
              sourceAssetRef: plan.sourceAssetRef,
              sourceAssets: [plan.sourceAssetRef],
              sourceAssetType: plan.sourceAssetType,
              durationSec: plan.generationControls.durationSec,
              aspectRatio: plan.generationControls.aspectRatio,
            });
            const payload = buildRunwayApiPayload(job);
            const payloadKeys = Object.keys(payload).sort().join(",");
            return payloadKeys === "duration,model,promptImage,promptText,ratio"
              && payload.promptText.length <= expectation.maxLength
              && payload.promptText.includes(expectation.mustInclude)
              && !payload.promptText.includes("Style profile:")
              && !payload.promptText.includes("Source assets to preserve:")
              && !payload.promptText.includes("Safety level:")
              && payload.ratio === "720:1280"
              && payload.duration === 5
              && plan.noPromotionPerformed === true
              && plan.noManifestUpdatePerformed === true
              && plan.noActiveWritePerformed === true
              && plan.premiumMemberGeneration.enabled === false;
          });
        })(),
        detail: "Spiritkin motion provider prompts stay compact without duplicated wrapper text",
      },
      {
        name: "media-spiritkin-distinct-motion-prompt-modes",
        pass: (() => {
          const modeExpectations = [
            {
              generationMode: "attentive_listening",
              assetType: "listen_01",
              assetKind: "listening_video",
              mustInclude: "silent attentive listening loop",
              mustNotInclude: "subtle idle presence loop",
            },
            {
              generationMode: "reflective_thinking",
              assetType: "think_01",
              assetKind: "idle_video",
              mustInclude: "silent reflective thinking loop",
            },
            {
              generationMode: "gentle_gesture",
              assetType: "gesture_01",
              assetKind: "idle_video",
              mustInclude: "silent gentle emotional gesture loop",
            },
            {
              generationMode: "greeting_entry",
              assetType: "greeting_or_entry_01",
              assetKind: "greeting_video",
              mustInclude: "silent warm greeting presence loop",
            },
            {
              generationMode: "seated_presence",
              assetType: "sit_or_perch_01",
              assetKind: "idle_video",
              mustInclude: "silent seated or perched presence loop",
            },
            {
              generationMode: "ambient_walk",
              assetType: "walk_loop_01",
              assetKind: "idle_video",
              mustInclude: "silent subtle ambient movement loop",
            },
          ];
          const recommendedModesOk = SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES.listen_01 === "attentive_listening"
            && SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES.think_01 === "reflective_thinking"
            && SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES.gesture_01 === "gentle_gesture"
            && SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES.greeting_or_entry_01 === "greeting_entry"
            && SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES.sit_or_perch_01 === "seated_presence"
            && SPIRITKIN_MOTION_RECOMMENDED_GENERATION_MODES.walk_loop_01 === "ambient_walk";
          return recommendedModesOk && modeExpectations.every((expectation) => {
            const plan = createSpiritkinMotionStateExecutionPlan({
              spiritkinId: "lyra",
              targetId: "lyra-motion-pack-v1",
              assetType: expectation.assetType,
              assetKind: expectation.assetKind,
              sourceAssetRef: "https://example.com/lyra_portrait.png",
              sourceAssetType: "external_url",
              promptIntent: "Animate Lyra in a distinct compact motion state.",
              styleProfile: "premium cinematic Spiritverse companion with a deliberately verbose style profile that should not be duplicated in provider prompt text",
              safetyLevel: "internal_review",
              durationSec: 5,
              ratio: "720:1280",
              motionIntensity: "low",
              generationMode: expectation.generationMode,
              allowMouthMovement: false,
            });
            const job = createDryRunJob({
              spiritkinId: plan.spiritkinId,
              targetId: plan.targetId,
              assetKind: plan.assetKind,
              promptIntent: plan.promptIntent,
              styleProfile: plan.styleProfile,
              safetyLevel: plan.safetyLevel,
              sourceAssetRef: plan.sourceAssetRef,
              sourceAssets: [plan.sourceAssetRef],
              sourceAssetType: plan.sourceAssetType,
              durationSec: plan.generationControls.durationSec,
              aspectRatio: plan.generationControls.aspectRatio,
            });
            const payload = buildRunwayApiPayload(job);
            const payloadKeys = Object.keys(payload).sort().join(",");
            return payloadKeys === "duration,model,promptImage,promptText,ratio"
              && payload.promptText.length <= 1000
              && payload.promptText.includes(expectation.mustInclude)
              && (!expectation.mustNotInclude || !payload.promptText.includes(expectation.mustNotInclude))
              && !payload.promptText.includes("Style profile:")
              && !payload.promptText.includes("Source assets to preserve:")
              && !payload.promptText.includes("Safety level:")
              && payload.ratio === "720:1280"
              && payload.duration === 5
              && plan.noPromotionPerformed === true
              && plan.noManifestUpdatePerformed === true
              && plan.noActiveWritePerformed === true
              && plan.premiumMemberGeneration.enabled === false;
          });
        })(),
        detail: "distinct Spiritkin motion prompt modes are compact, accepted, payload-clean, and write-safe",
      },
      {
        name: "media-spiritcore-avatar-pack-plan",
        pass: (() => {
          const result = createSpiritCoreAvatarPackPlan({
            targetId: "spiritcore-avatar-pack-v1",
            avatarType: "human_agent",
            styleProfile: "ultra-premium cinematic human AI operator",
            safetyLevel: "internal_review",
          });
          return result.avatarType === "human_agent"
            && SPIRITCORE_AVATAR_PACK_ASSET_TYPES.every((assetType) => result.plannedAssets.some((asset) => asset.assetType === assetType))
            && result.mediaPackReadiness.readyForGeneration === false
            && result.lifecycleState === "planning_only"
            && result.noProviderCall === true
            && result.noActiveWritePerformed === true;
        })(),
        detail: "SpiritCore avatar pack plan is planning-only and review-gated",
      },
      {
        name: "media-assembly-plan-safe",
        pass: (() => {
          const result = createMediaAssemblyPlan({
            assemblyType: "sequence_video",
            targetId: "spiritkin_motion_pack_demo",
            segments: [
              { sourceRef: "https://example.com/clip1.mp4", startSec: 0, endSec: 5, role: "intro" },
              { sourceRef: "https://example.com/clip2.mp4", startSec: 0, endSec: 5, role: "main" },
            ],
            outputLabel: "review-demo-sequence",
            safetyLevel: "internal_review",
          }, { ffmpegAvailable: false, ffmpegExecutionEnabled: false });
          return result.estimatedOutputDuration === 10
            && result.executionReady === false
            && result.ffmpegAvailable === false
            && result.lifecycleState === "review_required"
            && result.noAssemblyPerformed === true
            && result.noProviderCall === true
            && result.noActiveWritePerformed === true;
        })(),
        detail: "assembly plan validates segments without provider call or writes",
      },
      {
        name: "media-assemble-video-planned-only",
        pass: (() => {
          const result = createSafeVideoAssemblyResult({
            assemblyType: "sequence_video",
            targetId: "spiritkin_motion_pack_demo",
            segments: [{ sourceRef: "https://example.com/clip1.mp4", startSec: 0, endSec: 5, role: "intro" }],
            outputLabel: "review-demo-sequence",
            safetyLevel: "internal_review",
          }, { ffmpegAvailable: false, ffmpegExecutionEnabled: false });
          return result.ok === false
            && result.plannedOnly === true
            && result.lifecycleState === "review_required"
            && result.noPromotionPerformed === true
            && result.noManifestUpdatePerformed === true
            && result.noActiveWritePerformed === true;
        })(),
        detail: "assemble-video remains planned-only when ffmpeg is unavailable",
      },
      {
        name: "media-motion-pack-batch-plan-wave",
        pass: (() => {
          const result = createMotionPackBatchPlan({
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            requestedAssetTypes: ["think_01", "gesture_01", "walk_loop_01"],
            framingProfiles: ["close_portrait", "medium_shot", "wider_body"],
            generationPriorities: { think_01: 1, gesture_01: 2, walk_loop_01: 3 },
          });
          const think = result.generationPlan.find((asset) => asset.assetType === "think_01");
          const walk = result.generationPlan.find((asset) => asset.assetType === "walk_loop_01");
          return result.ok === true
            && result.noProviderCall === true
            && result.noIngestPerformed === true
            && result.noActiveWritePerformed === true
            && result.noManifestUpdatePerformed === true
            && think?.shotProfile === "close_portrait"
            && think?.motionCompletionRule?.requiredBehaviors?.includes("action begins within the first second")
            && think?.timingIntent === "visible_thinking_expression_with_mid_clip_head_motion"
            && walk?.shotProfile === "wider_body"
            && result.premiumMemberGeneration.enabled === false;
        })(),
        detail: "motion pack wave planning returns structured no-generation settings",
      },
      {
        name: "media-spiritkin-multi-source-reference-plan",
        pass: (() => {
          const result = createSpiritkinSourceReferencePlan({
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            requestedAssetTypes: [
              "idle_01",
              "speaking_01",
              "listen_01",
              "think_01",
              "gesture_01",
              "gesture_02",
              "greeting_or_entry_01",
              "sit_or_perch_01",
              "walk_loop_01",
            ],
            availableSources: {
              close_portrait: "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png",
              medium_body: null,
              full_body: null,
              seated_or_perched: null,
              realm_environment: null,
              approved_motion_reference: null,
            },
          });
          const byAsset = Object.fromEntries(result.sourceSelections.map((selection) => [selection.assetType, selection]));
          return result.ok === true
            && SPIRITKIN_MOTION_SOURCE_CATEGORY_RULES.greeting_or_entry_01.includes("medium_body")
            && byAsset.greeting_or_entry_01.requiredSourceCategories.includes("medium_body")
            && byAsset.greeting_or_entry_01.blockedUntilSourceExists === true
            && byAsset.gesture_02.requiredSourceCategories.includes("medium_body")
            && byAsset.gesture_02.blockedUntilSourceExists === true
            && byAsset.sit_or_perch_01.requiredSourceCategories.includes("seated_or_perched")
            && byAsset.sit_or_perch_01.blockedUntilSourceExists === true
            && byAsset.walk_loop_01.requiredSourceCategories.includes("full_body")
            && byAsset.walk_loop_01.requiredSourceCategories.includes("realm_environment")
            && byAsset.walk_loop_01.blockedUntilSourceExists === true
            && byAsset.idle_01.selectedSourceCategory === "close_portrait"
            && byAsset.speaking_01.selectedSourceCategory === "close_portrait"
            && byAsset.listen_01.selectedSourceCategory === "close_portrait"
            && byAsset.think_01.selectedSourceCategory === "close_portrait"
            && byAsset.gesture_01.selectedSourceCategory === "close_portrait"
            && result.generationBlockedAssetTypes.includes("greeting_or_entry_01")
            && result.recommendedNextSourceStills.some((item) => item.sourceCategory === "medium_body")
            && result.noProviderCall === true
            && result.noIngestPerformed === true
            && result.noActiveWritePerformed === true
            && result.noManifestUpdatePerformed === true
            && result.premiumMemberGeneration.enabled === false;
        })(),
        detail: "multi-source Spiritkin motion planning maps larger states to proper source categories without writes",
      },
      {
        name: "media-sequence-compose-plan-approved-only",
        pass: (() => {
          const result = createSequenceComposePlan({
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            sequenceId: "lyra-thinking-response-v1",
            approvedAssets: [
              {
                assetType: "idle_01",
                status: "approved",
                sourceRef: "Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_motion_pack_v1_idle_01_v1_approved_20260426_2a8cb3b449.mp4",
                durationSec: 5,
              },
              {
                assetType: "think_01",
                status: "approved",
                sourceRef: "Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_motion_pack_v1_think_01_v1_approved_20260426_1111111111.mp4",
                durationSec: 5,
              },
            ],
            targetDurationSec: 10,
            transitionStyle: "soft_cut",
          }, { ffmpegAvailable: false, ffmpegExecutionEnabled: false });
          return result.ok === true
            && result.orderedApprovedClips.length === 2
            && result.totalDuration === 10
            && result.outputNamingPlan.reviewPath.includes("Spiritverse_MASTER_ASSETS/REVIEW/lyra/sequence/")
            && result.outputNamingPlan.activePath === null
            && result.noCompositionPerformed === true
            && result.noProviderCall === true
            && result.noActiveWritePerformed === true
            && result.noManifestUpdatePerformed === true;
        })(),
        detail: "sequence composition plan uses approved clips only and avoids ACTIVE writes",
      },
      {
        name: "media-sequence-compose-invalid-assets-denied",
        pass: (() => {
          try {
            createSequenceComposePlan({
              entityId: "lyra",
              packId: "lyra-motion-pack-v1",
              sequenceId: "bad-sequence",
              approvedAssets: [
                {
                  assetType: "think_01",
                  status: "draft",
                  sourceRef: "Spiritverse_MASTER_ASSETS/ACTIVE/lyra/video/bad.mp4",
                  durationSec: 5,
                },
              ],
              targetDurationSec: 5,
              transitionStyle: "soft_cut",
            });
            return false;
          } catch (err) {
            return err.code === "VALIDATION_ERROR"
              && err.detail?.fields?.some((field) => field.includes("status must be approved"))
              && err.detail?.fields?.some((field) => field.includes("sourceRef must point to Spiritverse_MASTER_ASSETS/APPROVED"));
          }
        })(),
        detail: "invalid sequence inputs and non-approved references are denied",
      },
      {
        name: "media-sequence-compose-execute-planned-only",
        pass: (() => {
          const result = createSequenceComposeExecutionResult({
            entityId: "lyra",
            packId: "lyra-motion-pack-v1",
            sequenceId: "lyra-thinking-response-v1",
            approvedAssets: [
              {
                assetType: "idle_01",
                status: "approved",
                sourceRef: "Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_motion_pack_v1_idle_01_v1_approved_20260426_2a8cb3b449.mp4",
                durationSec: 5,
              },
            ],
            targetDurationSec: 5,
            transitionStyle: "soft_cut",
          }, { ffmpegAvailable: false, ffmpegExecutionEnabled: false, sequenceCompositionEnabled: false });
          return result.ok === false
            && result.plannedOnly === true
            && result.compositionPlan.lifecycleState === "review_required"
            && result.noCompositionPerformed === true
            && result.noProviderCall === true
            && result.noActiveWritePerformed === true
            && result.noManifestUpdatePerformed === true;
        })(),
        detail: "sequence compose execution remains safe planned-only without ffmpeg writer",
      },
      {
        name: "media-assistant-roadmap-documented",
        pass: SPIRITCORE_ASSISTANT_CAPABILITY_ROADMAP.some((item) => item.id === "alarms")
          && SPIRITCORE_ASSISTANT_CAPABILITY_ROADMAP.some((item) => item.id === "smart_home"),
        detail: "assistant capability roadmap is documented",
      },
      {
        name: "media-catalog-no-runway-generation",
        pass: getMediaCatalogSummary().noProviderCall === true
          && getMediaCatalogSummary().routes.includes("POST /admin/media/spiritgate-enhancement-execute")
          && getMediaCatalogSummary().premiumMemberGeneration.enabled === false,
        detail: "media catalog summary performs no Runway generation",
      },
      {
        name: "premium-member-generation-disabled",
        pass: PREMIUM_MEMBER_GENERATION_BOUNDARY.enabled === false
          && PREMIUM_MEMBER_GENERATION_BOUNDARY.readinessChecklist.includes("generation budget/credit limits")
          && PREMIUM_MEMBER_GENERATION_BOUNDARY.readinessChecklist.includes("review/approval mode"),
        detail: "premium member generation boundary remains disabled with readiness checklist",
      },
      {
        name: "media-production-sequence-spiritgate-preserves-source",
        pass: (() => {
          const result = createProductionSequencePlan({
            sequenceType: "spiritgate_enhancement",
            targetId: "spiritgate",
            sourceAssetRefs: ["SpiritGate/PikaLabs/original-spiritgate.mp4"],
            safetyLevel: "internal_review",
          });
          return result.spiritGateEnhancementProfile?.originalReplacementAllowed === false
            && result.spiritGateEnhancementProfile?.sourceConceptMustBePreserved === true
            && result.spiritGateEnhancementProfile?.enhancementOnly === true
            && result.operatorApprovalRequired === true
            && result.noProviderCall === true;
        })(),
        detail: "SpiritGate production sequence preserves original source concept",
      },
      {
        name: "media-production-sequence-original-motion-pack",
        pass: (() => {
          const result = createProductionSequencePlan({
            sequenceType: "original_motion_pack",
            targetId: "Lyra",
            safetyLevel: "internal_review",
          });
          return ORIGINAL_MOTION_PACK_ASSET_KINDS.every((kind) => result.assetKinds.includes(kind))
            && result.generationPlans.length === ORIGINAL_MOTION_PACK_ASSET_KINDS.length
            && result.noGenerationPerformed === true;
        })(),
        detail: "original motion pack plan includes required asset kinds",
      },
      {
        name: "media-production-sequence-premium-starter",
        pass: (() => {
          const result = createProductionSequencePlan({
            sequenceType: "premium_spiritkin_starter_pack",
            targetId: "premium-test",
            safetyLevel: "internal_review",
          });
          return PREMIUM_SPIRITKIN_STARTER_PACK_ASSET_KINDS.every((kind) => result.assetKinds.includes(kind))
            && result.premiumReadiness?.paidReady === false
            && result.premiumStarterPackProfile?.profileMetadataRequired === true;
        })(),
        detail: "premium starter pack profile exists and detects incomplete paid readiness",
      },
    ].map((check) => ({
      ...check,
      method: "INTERNAL",
      path: check.name,
      skipped: false,
      status: null,
      summary: null,
    }));
    for (const entry of bypassChecks) {
      results.push(entry);
      printInternalResult(entry);
    }

    await waitForHealth();

    await run("health", "GET", "/health");
    await run("ready", "GET", "/ready");
    await run("legacy-health", "GET", "/v0/health", LEGACY_ROUTES_DISABLED_IN_PRODUCTION ? {
      allowStatuses: [410],
      describe: () => "legacy route gated in production",
    } : {});

    await run("app-shell", "GET", "/app");
    await run("app-js", "GET", "/app/app.js");
    await run("canon-data", "GET", "/app/data/spiritverseCanon.js");
    await run("active-asset", "GET", "/app/assets/concepts/Solis.png");
    await run("theme-asset", "GET", "/app/game-theme-assets/Checkers/boards/checkers_board_premium_placeholder.svg");
    await run("video-root-alias", "GET", "/app/spiritkin-videos/README.md");
    await run("portrait", "GET", "/portraits/lyra_portrait.png");
    await run("trailer-video", "GET", "/videos/lyra_intro.mp4");

    await run("spiritkins-list", "GET", "/v1/spiritkins");
    await run("spiritkin-one", "GET", "/v1/spiritkins/Lyra");
    await run("spiritcore-welcome", "POST", "/v1/spiritcore/welcome", {
      body: {
        userId,
        userName: "Diagnostic User",
        returning: true,
        primarySpiritkinName: "Lyra",
      },
    });
    await run("veil-questions", "GET", "/v1/veil-crossing/questions");
    await run("veil-calculate", "POST", "/v1/veil-crossing/calculate", {
      body: { answers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1] },
    });
    await run("events-current", "GET", "/v1/spiritverse/events/current?bondStage=1");
    await run("events-all", "GET", "/v1/spiritverse/events/all");
    await run("quests-daily", "GET", `/v1/quests/daily?userId=${encodeURIComponent(userId)}&spiritkinName=Lyra&bondStage=1`);
    await run("games-list", "GET", "/v1/games/list");
    await run("runway-dry-run-unauth", "POST", "/admin/runway/dry-run", {
      body: {
        spiritkinId: "Lyra",
        assetKind: "trailer",
        promptIntent: "Diagnostic no-cost Runway request shaping.",
        styleProfile: "spiritverse_cinematic",
        safetyLevel: "strict",
      },
      allowStatuses: [403],
      describe: () => "admin route blocked without admin key",
    });
    await run("runway-dry-run-malformed", "POST", "/admin/runway/dry-run", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "Lyra",
        assetKind: "not-supported",
        promptIntent: "",
        styleProfile: "spiritverse_cinematic",
        safetyLevel: "strict",
      },
      allowStatuses: [400, 422],
      describe: () => "authenticated malformed dry run rejected",
    });
    await run("runway-dry-run-valid", "POST", "/admin/runway/dry-run", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "Lyra",
        assetKind: "trailer",
        promptIntent: "Create a short internal-review trailer preserving Lyra's gentle emotional anchor identity.",
        styleProfile: "spiritverse_cinematic",
        safetyLevel: "strict",
        durationSec: 8,
      },
      describe: (result) => result?.body?.job?.externalApiCall === false ? "no-cost dry run returned" : "unexpected external call flag",
    });
    await run("runway-auth-check-missing-key", "POST", "/admin/runway/auth-check", {
      body: {},
      allowStatuses: [400, 422],
      describe: () => "missing transient Runway key rejected",
    });
    await run("runway-auth-check-mock", "POST", "/admin/runway/auth-check", {
      body: {
        runwayTransientKey: "mock-runway-key",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.authOk === true
        && result?.body?.mock === true
        ? "staging mock auth check did not call provider"
        : "unexpected auth check mock result",
    });
    await run("runway-status-check-missing-provider-job-id", "POST", "/admin/runway/status-check", {
      body: {
        runwayTransientKey: "mock-runway-key",
      },
      allowStatuses: [400, 422],
      describe: () => "missing providerJobId rejected",
    });
    await run("runway-status-check-missing-key", "POST", "/admin/runway/status-check", {
      body: {
        providerJobId: "316edfbf-e63a-4fe0-9f4b-dbf2af874f09",
      },
      allowStatuses: [400],
      describe: (result) => result?.body?.error === "RUNWAY_KEY_REQUIRED"
        && result?.body?.externalApiCall === false
        ? "missing Runway key rejected before provider call"
        : "unexpected missing key status-check result",
    });
    await run("runway-status-check-mock", "POST", "/admin/runway/status-check", {
      body: {
        providerJobId: "316edfbf-e63a-4fe0-9f4b-dbf2af874f09",
        runwayTransientKey: "mock-runway-key",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.provider === "runway"
        && result?.body?.providerStatus === "SUCCEEDED"
        && Array.isArray(result?.body?.outputUrls)
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        ? "staging mock status check returned sanitized result without provider call"
        : "unexpected status-check mock result",
    });
    await run("runway-status-check-mock-failed", "POST", "/admin/runway/status-check", {
      body: {
        providerJobId: "mock-failed-runway-task",
        runwayTransientKey: "mock-runway-key",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.ok === false
        && result?.body?.provider === "runway"
        && result?.body?.providerStatus === "FAILED"
        && result?.body?.failure === true
        && result?.body?.failureCode === "INTERNAL.BAD_OUTPUT.CODE01"
        && result?.body?.failureMessage === "An unexpected error occurred."
        && result?.body?.error === "An unexpected error occurred."
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        && !JSON.stringify(result?.body || {}).includes("mock-runway-key")
        ? "staging mock failed status check returned sanitized failure details without writes"
        : "unexpected failed status-check mock result",
    });
    await run("runway-execution-spike-staging-bypass-valid", "POST", "/admin/runway/execution-spike", {
      body: {
        targetId: "test-realm",
        assetKind: "realm_background",
        promptIntent: "Diagnostic execution spike request shaping only.",
        styleProfile: "spiritverse_internal_test",
        safetyLevel: "internal_review",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.job?.executionGates?.missingGates?.includes("RUNWAY_DRY_RUN_EXECUTE=true is required")
        ? "staging bypass reached execution gate without provider call"
        : "unexpected execution spike bypass result",
    });
    await run("runway-execution-spike-transient-mock-no-exec", "POST", "/admin/runway/execution-spike", {
      headers: {
        "x-runway-transient-key": "mock-runway-key",
        "x-runway-transient-execute": "false",
        "x-runway-transient-provider-execution": "false",
      },
      body: {
        targetId: "test-realm",
        assetKind: "realm_background",
        promptIntent: "Diagnostic transient credential path request shaping only.",
        styleProfile: "spiritverse_internal_test",
        safetyLevel: "internal_review",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.transientKeyProvided === true
        && result?.body?.job?.executionGates?.missingGates?.includes("RUNWAY_DRY_RUN_EXECUTE=true is required")
        ? "mock transient key reached execution gate without provider call"
        : "unexpected transient credential result",
    });
    await run("runway-execution-spike-transient-alt-header-no-exec", "POST", "/admin/runway/execution-spike", {
      headers: {
        "x-spiritcore-runway-token": "mock-runway-key",
        "x-runway-transient-execute": "false",
        "x-runway-transient-provider-execution": "false",
      },
      body: {
        targetId: "test-realm",
        assetKind: "portrait",
        promptIntent: "Diagnostic alternate transient credential header request shaping only.",
        styleProfile: "spiritverse_internal_test",
        safetyLevel: "internal_review",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.transientKeyProvided === true
        && result?.body?.transientKeySource === "header"
        && result?.body?.job?.executionGates?.missingGates?.includes("RUNWAY_DRY_RUN_EXECUTE=true is required")
        ? "alternate transient key header reached execution gate without provider call"
        : "unexpected alternate transient credential result",
    });
    await run("runway-execution-spike-transient-body-no-exec", "POST", "/admin/runway/execution-spike", {
      headers: {
        "x-runway-transient-execute": "false",
        "x-runway-transient-provider-execution": "false",
      },
      body: {
        targetId: "test-realm",
        assetKind: "realm_background",
        promptIntent: "Diagnostic body transient credential fallback request shaping only.",
        styleProfile: "spiritverse_internal_test",
        safetyLevel: "internal_review",
        runwayTransientKey: "mock-runway-key",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.transientKeyProvided === true
        && result?.body?.transientKeySource === "body"
        && result?.body?.job?.executionGates?.missingGates?.includes("RUNWAY_DRY_RUN_EXECUTE=true is required")
        ? "body transient key fallback reached execution gate without provider call"
        : "unexpected body transient credential result",
    });
    await run("runway-execution-spike-image-payload-no-exec", "POST", "/admin/runway/execution-spike", {
      headers: {
        "x-runway-transient-execute": "false",
        "x-runway-transient-provider-execution": "false",
      },
      body: {
        targetId: "test-realm",
        assetKind: "realm_background",
        promptIntent: "Diagnostic image execution spike payload without provider execution.",
        styleProfile: "spiritverse_internal_test",
        safetyLevel: "internal_review",
        runwayTransientKey: "mock-runway-key",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.job?.providerTarget?.endpointPath === "/v1/text_to_image"
        && result?.body?.job?.apiPayloadPreview?.model === "gen4_image"
        && result?.body?.job?.apiPayloadPreview?.promptImage === undefined
        ? "image execution spike payload built without provider call"
        : "unexpected image execution payload result",
    });
    await run("runway-execution-spike-staging-bypass-malformed", "POST", "/admin/runway/execution-spike", {
      body: {
        targetId: "real-realm",
        assetKind: "realm_background",
        promptIntent: "Malformed staging bypass should not skip admin auth.",
        styleProfile: "spiritverse_internal_test",
        safetyLevel: "internal_review",
      },
      allowStatuses: [403],
      describe: () => "malformed staging bypass request rejected by normal admin auth",
    });
    await run("runway-execution-spike-malformed", "POST", "/admin/runway/execution-spike", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        targetId: "test-realm",
        assetKind: "not-supported",
        promptIntent: "",
        styleProfile: "spiritverse_internal_test",
        safetyLevel: "internal_review",
      },
      allowStatuses: [400, 422],
      describe: () => "authenticated malformed execution spike rejected",
    });
    await run("runway-execution-spike-no-flags", "POST", "/admin/runway/execution-spike", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        targetId: "test-realm",
        assetKind: "realm_background",
        promptIntent: "Shape one internal review realm background test request without provider execution.",
        styleProfile: "spiritverse_internal_test",
        safetyLevel: "internal_review",
      },
      describe: (result) => result?.body?.externalApiCall === false ? "execution gates returned dry run" : "unexpected provider execution",
    });
    await run("generated-asset-promotion-plan-unauth", "POST", "/admin/generated-assets/promotion-plan", {
      body: {
        sourcePath: "Spiritverse_MASTER_ASSETS/INCOMING/generated/lyra/trailer/artifact.mp4",
        spiritkinId: "Lyra",
        assetKind: "trailer",
        versionTag: "diag-trailer",
      },
      allowStatuses: [403],
      describe: () => "admin promotion plan blocked without admin key",
    });
    await run("generated-asset-promotion-plan-malformed", "POST", "/admin/generated-assets/promotion-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        sourcePath: "Spiritverse_MASTER_ASSETS/INCOMING/generated/lyra/trailer/artifact.txt",
        spiritkinId: "Lyra",
        assetKind: "trailer",
      },
      allowStatuses: [422],
      describe: () => "authenticated malformed promotion plan rejected",
    });
    await run("generated-asset-promotion-plan-valid", "POST", "/admin/generated-assets/promotion-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        sourcePath: "Spiritverse_MASTER_ASSETS/INCOMING/generated/lyra/trailer/artifact.mp4",
        spiritkinId: "Lyra",
        assetKind: "trailer",
        providerJobId: "diag-runway-task",
        versionTag: "diag-trailer",
      },
      describe: (result) => result?.body?.promotionPlan?.operatorApprovalRequired === true ? "operator approval required" : "unexpected approval flag",
    });
    await run("media-catalog-summary", "GET", "/admin/media/catalog-summary", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      describe: (result) => result?.body?.catalogSummary?.noProviderCall === true
        && result?.body?.catalogSummary?.assetKinds?.includes("wake_visual")
        ? "media catalog summary returned without provider call"
        : "unexpected media catalog summary",
    });
    await run("media-requirements-check", "POST", "/admin/media/requirements-check", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        profileId: "premium_spiritkin",
        spiritkinId: "custom-aura",
        assets: [
          { spiritkinId: "custom-aura", assetKind: "portrait", lifecycleState: "draft" },
        ],
      },
      describe: (result) => result?.body?.requirements?.incompletePremiumSpiritkin === true
        && result?.body?.externalApiCall === false
        ? "premium requirements checked without blocking behavior"
        : "unexpected media requirements result",
    });
    await run("media-generation-template", "POST", "/admin/media/generation-template", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        assetKind: "listening_video",
        spiritkinName: "Lyra",
        spiritkinRole: "Celestial Fawn of the Luminous Veil",
        visualIdentity: "gentle luminous companion with rose pearl and soft gold motifs",
        loreSummary: "Lyra is an emotional anchor in the Luminous Veil.",
        colorPalette: "rose, pearl, soft gold",
        emotionalTone: "calm, attentive, magical",
        styleProfile: "premium cinematic Spiritverse companion presence",
        safetyLevel: "internal_review",
        referenceAssets: ["/app/assets/concepts/Lyra.png"],
      },
      describe: (result) => result?.body?.generationTemplate?.providerCall === false
        && result?.body?.generationTemplate?.prompt?.includes("Lyra")
        ? "generation template produced prompt without provider call"
        : "unexpected media template result",
    });
    await run("media-asset-plan", "POST", "/admin/media/asset-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "Lyra",
        assetKind: "presence_indicator",
        promptIntent: "Create compact living presence indicator states for Lyra.",
        existingAssets: [
          { spiritkinId: "Lyra", assetKind: "portrait", lifecycleState: "active", reviewStatus: "approved", promotionStatus: "promoted", activeStatus: "active", publicPath: "/app/assets/concepts/Lyra.png" },
        ],
      },
      describe: (result) => result?.body?.assetPlan?.noProviderCall === true
        && result?.body?.noActiveWritePerformed === true
        ? "media asset plan generated without writes"
        : "unexpected media asset plan",
    });
    await run("media-review-plan", "POST", "/admin/media/review-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "Lyra",
        assetKind: "wake_visual",
        lifecycleState: "review_required",
        reviewStatus: "pending",
      },
      describe: (result) => result?.body?.reviewPlan?.noPromotionPerformed === true
        && result?.body?.reviewPlan?.requiredChecks?.includes("safety review completed")
        ? "review plan requires operator checks and performs no promotion"
        : "unexpected media review plan",
    });
    await run("media-promotion-plan", "POST", "/admin/media/promotion-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "Lyra",
        assetKind: "wake_visual",
        lifecycleState: "approved",
        reviewStatus: "approved",
        promotionStatus: "planned",
        versionTag: "diag-wake-visual",
      },
      describe: (result) => result?.body?.promotionPlan?.operatorApprovalRequired === true
        && result?.body?.promotionPlan?.noActiveWrites === true
        ? "promotion plan prepared without ACTIVE writes"
        : "unexpected media promotion plan",
    });
    await run("media-spiritgate-enhancement-plan", "POST", "/admin/media/spiritgate-enhancement-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        existingSourceAsset: "SpiritGate/PikaLabs/original-spiritgate.mp4",
        versionTag: "diag-spiritgate-upgrade",
      },
      describe: (result) => result?.body?.spiritGateEnhancementPlan?.spiritGate?.originalReplacementAllowed === false
        && result?.body?.spiritGateEnhancementPlan?.noProviderCall === true
        ? "SpiritGate enhancement plan preserves original without provider call"
        : "unexpected SpiritGate enhancement plan",
    });
    await run("media-production-sequence-spiritgate", "POST", "/admin/media/production-sequence-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        sequenceType: "spiritgate_enhancement",
        targetId: "spiritgate",
        sourceAssetRefs: ["SpiritGate/PikaLabs/original-spiritgate.mp4"],
        assetKinds: ["spiritgate_video", "gateway_background"],
        styleProfile: "premium cinematic SpiritGate enhancement",
        safetyLevel: "internal_review",
        notes: "Diagnostic sequence plan only.",
      },
      describe: (result) => result?.body?.productionSequencePlan?.spiritGateEnhancementProfile?.originalReplacementAllowed === false
        && result?.body?.productionSequencePlan?.noGenerationPerformed === true
        && result?.body?.productionSequencePlan?.noProviderCall === true
        && result?.body?.productionSequencePlan?.noPromotionPerformed === true
        && result?.body?.productionSequencePlan?.noManifestUpdatePerformed === true
        && result?.body?.productionSequencePlan?.noActiveWritePerformed === true
        ? "SpiritGate production sequence planned without generation or promotion"
        : "unexpected SpiritGate production sequence result",
    });
    await run("media-production-sequence-motion-pack", "POST", "/admin/media/production-sequence-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        sequenceType: "original_motion_pack",
        targetId: "Lyra",
        styleProfile: "premium cinematic Spiritkin motion pack",
        safetyLevel: "internal_review",
      },
      describe: (result) => ORIGINAL_MOTION_PACK_ASSET_KINDS.every((kind) => result?.body?.productionSequencePlan?.assetKinds?.includes(kind))
        && result?.body?.productionSequencePlan?.operatorApprovalRequired === true
        ? "original motion pack sequence includes required assets and requires operator approval"
        : "unexpected original motion pack sequence result",
    });
    await run("media-production-sequence-premium-starter", "POST", "/admin/media/production-sequence-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        sequenceType: "premium_spiritkin_starter_pack",
        targetId: "premium-test-spiritkin",
        styleProfile: "premium cinematic user-created Spiritkin starter pack",
        safetyLevel: "internal_review",
      },
      describe: (result) => result?.body?.productionSequencePlan?.premiumReadiness?.paidReady === false
        && result?.body?.productionSequencePlan?.premiumStarterPackProfile?.profileMetadataRequired === true
        && result?.body?.productionSequencePlan?.noProviderCall === true
        ? "premium starter pack sequence detects incomplete paid readiness"
        : "unexpected premium starter sequence result",
    });
    await run("media-planning-bypass-operator-experience", "POST", "/admin/media/operator-experience-plan", {
      headers: { "x-media-planning-test": "true" },
      body: {
        defaultOperatorType: "spiritcore",
        spiritkinsEnabled: true,
        entitlements: {
          spiritcorePremium: true,
          spiritkinPremium: false,
        },
      },
      describe: (result) => result?.body?.mediaPlanningBypassUsed === true
        && result?.body?.operatorExperiencePlan?.defaultOperatorType === "spiritcore"
        && result?.body?.operatorExperiencePlan?.noGenerationPerformed === true
        && result?.body?.operatorExperiencePlan?.noProviderCall === true
        && result?.body?.operatorExperiencePlan?.noPromotionPerformed === true
        && result?.body?.operatorExperiencePlan?.noManifestUpdatePerformed === true
        && result?.body?.operatorExperiencePlan?.noActiveWritePerformed === true
        ? "staging media planning bypass allowed planning-only route"
        : "unexpected media planning bypass result",
    });
    await run("media-planning-bypass-execution-blocked", "POST", "/admin/media/spiritgate-enhancement-execute", {
      headers: { "x-media-planning-test": "true" },
      body: {
        targetId: "spiritgate",
        sourceAssetRef: "https://example.com/spiritgate.mp4",
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic media planning bypass must not reach execution route.",
        styleProfile: "premium cinematic SpiritGate enhancement",
        safetyLevel: "internal_review",
        operatorApproval: true,
      },
      allowStatuses: [401, 403],
      describe: () => "media planning bypass does not allow execution route",
    });
    await run("media-operator-experience-plan", "POST", "/admin/media/operator-experience-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        defaultOperatorType: "spiritcore",
        spiritkinsEnabled: true,
        entitlements: {
          spiritcorePremium: true,
          spiritkinPremium: false,
        },
      },
      describe: (result) => result?.body?.operatorExperiencePlan?.defaultOperatorType === "spiritcore"
        && result?.body?.operatorExperiencePlan?.spiritcoreIsUniversalDefault === true
        && result?.body?.operatorExperiencePlan?.spiritkinsAreOptionalCompanions === true
        && result?.body?.operatorExperiencePlan?.entitlementSeparation?.compatibleButSeparable === true
        && result?.body?.operatorExperiencePlan?.noProviderCall === true
        && result?.body?.operatorExperiencePlan?.noActiveWritePerformed === true
        ? "SpiritCore default operator plan returned without writes"
        : "unexpected operator experience plan",
    });
    await run("media-spiritkin-motion-pack-plan", "POST", "/admin/media/spiritkin-motion-pack-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        styleProfile: "premium cinematic spiritverse companion, elegant, emotionally alive",
        safetyLevel: "internal_review",
      },
      describe: (result) => SPIRITKIN_MOTION_PACK_ASSET_TYPES.every((assetType) => result?.body?.spiritkinMotionPackPlan?.plannedAssets?.some((asset) => asset.assetType === assetType))
        && result?.body?.spiritkinMotionPackPlan?.plannedAssets?.every((asset) => asset.lifecycleState === "review_required")
        && result?.body?.spiritkinMotionPackPlan?.noGenerationPerformed === true
        && result?.body?.spiritkinMotionPackPlan?.noProviderCall === true
        && result?.body?.spiritkinMotionPackPlan?.noActiveWritePerformed === true
        ? "Spiritkin motion pack planned without generation"
        : "unexpected Spiritkin motion pack plan",
    });
    await run("media-motion-pack-batch-plan", "POST", "/admin/media/motion-pack-plan", {
      headers: { "x-media-planning-test": "true" },
      body: {
        entityId: "lyra",
        packId: "lyra-motion-pack-v1",
        requestedAssetTypes: ["think_01", "gesture_01", "walk_loop_01"],
        framingProfiles: ["close_portrait", "medium_shot", "wider_body"],
        generationPriorities: { think_01: 1, gesture_01: 2, walk_loop_01: 3 },
      },
      describe: (result) => result?.body?.mediaPlanningBypassUsed === true
        && result?.body?.motionPackPlan?.generationPlan?.length === 3
        && result?.body?.motionPackPlan?.generationPlan?.some((asset) => asset.assetType === "think_01" && asset.motionCompletionRule?.summary?.includes("Action begins early"))
        && result?.body?.motionPackPlan?.generationPlan?.some((asset) => asset.assetType === "walk_loop_01" && asset.shotProfile === "wider_body")
        && result?.body?.motionPackPlan?.noProviderCall === true
        && result?.body?.motionPackPlan?.noIngestPerformed === true
        && result?.body?.motionPackPlan?.noActiveWritePerformed === true
        && result?.body?.motionPackPlan?.noManifestUpdatePerformed === true
        ? "motion pack generation wave planned without provider, ingest, manifest, or ACTIVE writes"
        : "unexpected motion pack batch plan",
    });
    await run("media-spiritkin-source-reference-plan", "POST", "/admin/media/spiritkin-source-reference-plan", {
      headers: { "x-media-planning-test": "true" },
      body: {
        entityId: "lyra",
        packId: "lyra-motion-pack-v1",
        requestedAssetTypes: [
          "idle_01",
          "speaking_01",
          "listen_01",
          "gesture_02",
          "greeting_or_entry_01",
          "sit_or_perch_01",
          "walk_loop_01",
        ],
        availableSources: {
          close_portrait: "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png",
          medium_body: null,
          full_body: null,
          seated_or_perched: null,
          realm_environment: null,
          approved_motion_reference: null,
        },
      },
      describe: (result) => {
        const selections = result?.body?.spiritkinSourceReferencePlan?.sourceSelections || [];
        const byAsset = Object.fromEntries(selections.map((selection) => [selection.assetType, selection]));
        return result?.body?.mediaPlanningBypassUsed === true
          && byAsset.idle_01?.selectedSourceCategory === "close_portrait"
          && byAsset.speaking_01?.selectedSourceCategory === "close_portrait"
          && byAsset.listen_01?.selectedSourceCategory === "close_portrait"
          && byAsset.gesture_02?.requiredSourceCategories?.includes("medium_body")
          && byAsset.gesture_02?.blockedUntilSourceExists === true
          && byAsset.greeting_or_entry_01?.requiredSourceCategories?.includes("medium_body")
          && byAsset.greeting_or_entry_01?.blockedUntilSourceExists === true
          && byAsset.sit_or_perch_01?.requiredSourceCategories?.includes("seated_or_perched")
          && byAsset.sit_or_perch_01?.blockedUntilSourceExists === true
          && byAsset.walk_loop_01?.requiredSourceCategories?.includes("full_body")
          && byAsset.walk_loop_01?.requiredSourceCategories?.includes("realm_environment")
          && byAsset.walk_loop_01?.blockedUntilSourceExists === true
          && result?.body?.spiritkinSourceReferencePlan?.noProviderCall === true
          && result?.body?.spiritkinSourceReferencePlan?.noIngestPerformed === true
          && result?.body?.spiritkinSourceReferencePlan?.noActiveWritePerformed === true
          && result?.body?.spiritkinSourceReferencePlan?.noManifestUpdatePerformed === true
          ? "Spiritkin source reference plan blocks larger states until proper sources exist"
          : "unexpected Spiritkin source reference plan result";
      },
    });
    await run("media-spiritkin-source-summary-lyra", "GET", "/admin/media/spiritkin-source-summary/lyra", {
      headers: {
        "x-admin-key": DIAG_ADMIN_KEY,
        "x-forwarded-proto": "https",
        "x-forwarded-host": "spiritcore-backend-copy-production.up.railway.app",
      },
      describe: (result) => result?.body?.spiritkinSource?.canonicalName === "Lyra"
        && result?.body?.spiritkinSource?.currentPath === "/portraits/lyra_portrait.png"
        && result?.body?.spiritkinSource?.canUseForRunwayImageToVideo === true
        && result?.body?.spiritkinSource?.noGenerationPerformed === true
        && result?.body?.spiritkinSource?.noProviderCall === true
        && result?.body?.spiritkinSource?.noActiveWritePerformed === true
        ? "Lyra source summary returned canonical HTTPS portrait source"
        : "unexpected Lyra source summary",
    });
    await run("media-spiritcore-avatar-pack-plan", "POST", "/admin/media/spiritcore-avatar-pack-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        targetId: "spiritcore-avatar-pack-v1",
        avatarType: "human_agent",
        styleProfile: "ultra-premium cinematic human AI operator, serious, elegant, futuristic",
        safetyLevel: "internal_review",
      },
      describe: (result) => result?.body?.spiritcoreAvatarPackPlan?.avatarType === "human_agent"
        && result?.body?.spiritcoreAvatarPackPlan?.mediaPackReadiness?.readyForGeneration === false
        && result?.body?.spiritcoreAvatarPackPlan?.plannedAssets?.some((asset) => asset.assetType === "realm_presence_01")
        && result?.body?.spiritcoreAvatarPackPlan?.noProviderCall === true
        && result?.body?.spiritcoreAvatarPackPlan?.noActiveWritePerformed === true
        ? "SpiritCore avatar pack planned without generation"
        : "unexpected SpiritCore avatar pack plan",
    });
    await run("media-assembly-plan", "POST", "/admin/media/assembly-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        assemblyType: "sequence_video",
        targetId: "spiritkin_motion_pack_demo",
        segments: [
          { sourceRef: "https://example.com/clip1.mp4", startSec: 0, endSec: 5, role: "intro" },
          { sourceRef: "https://example.com/clip2.mp4", startSec: 0, endSec: 5, role: "main" },
        ],
        outputLabel: "review-demo-sequence",
        safetyLevel: "internal_review",
      },
      describe: (result) => result?.body?.assemblyPlan?.estimatedOutputDuration === 10
        && result?.body?.assemblyPlan?.lifecycleState === "review_required"
        && result?.body?.assemblyPlan?.noAssemblyPerformed === true
        && result?.body?.assemblyPlan?.noProviderCall === true
        && result?.body?.assemblyPlan?.noActiveWritePerformed === true
        ? "assembly plan returned review-required no-write result"
        : "unexpected assembly plan",
    });
    await run("media-assemble-video-safe", "POST", "/admin/media/assemble-video", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        assemblyType: "sequence_video",
        targetId: "spiritkin_motion_pack_demo",
        segments: [
          { sourceRef: "https://example.com/clip1.mp4", startSec: 0, endSec: 5, role: "intro" },
          { sourceRef: "https://example.com/clip2.mp4", startSec: 0, endSec: 5, role: "main" },
        ],
        outputLabel: "review-demo-sequence",
        safetyLevel: "internal_review",
      },
      describe: (result) => result?.body?.assemblyResult?.plannedOnly === true
        && result?.body?.assemblyResult?.lifecycleState === "review_required"
        && result?.body?.assemblyResult?.noPromotionPerformed === true
        && result?.body?.assemblyResult?.noManifestUpdatePerformed === true
        && result?.body?.assemblyResult?.noActiveWritePerformed === true
        ? "assemble-video safely returns planned-only review result"
        : "unexpected assemble-video safe result",
    });
    const approvedSequenceAssets = [
      {
        assetType: "idle_01",
        status: "approved",
        sourceRef: "Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_motion_pack_v1_idle_01_v1_approved_20260426_2a8cb3b449.mp4",
        durationSec: 5,
      },
      {
        assetType: "speaking_01",
        status: "approved",
        sourceRef: "Spiritverse_MASTER_ASSETS/APPROVED/lyra/video/lyra_motion_pack_v1_speaking_01_v1_approved_20260426_6758f00da7.mp4",
        durationSec: 5,
      },
    ];
    await run("media-sequence-compose-plan", "POST", "/admin/media/sequence-compose-plan", {
      headers: { "x-media-planning-test": "true" },
      body: {
        entityId: "lyra",
        packId: "lyra-motion-pack-v1",
        sequenceId: "lyra-response-sequence-v1",
        approvedAssets: approvedSequenceAssets,
        targetDurationSec: 10,
        transitionStyle: "soft_cut",
      },
      describe: (result) => result?.body?.mediaPlanningBypassUsed === true
        && result?.body?.sequenceComposePlan?.orderedApprovedClips?.length === 2
        && result?.body?.sequenceComposePlan?.totalDuration === 10
        && result?.body?.sequenceComposePlan?.outputNamingPlan?.reviewPath?.includes("Spiritverse_MASTER_ASSETS/REVIEW/lyra/sequence/")
        && result?.body?.sequenceComposePlan?.outputNamingPlan?.activePath === null
        && result?.body?.sequenceComposePlan?.noProviderCall === true
        && result?.body?.sequenceComposePlan?.noActiveWritePerformed === true
        && result?.body?.sequenceComposePlan?.noManifestUpdatePerformed === true
        ? "sequence composition planned from approved clips without provider or ACTIVE writes"
        : "unexpected sequence compose plan",
    });
    await run("media-sequence-compose-plan-invalid", "POST", "/admin/media/sequence-compose-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        entityId: "lyra",
        packId: "lyra-motion-pack-v1",
        sequenceId: "bad-sequence",
        approvedAssets: [
          {
            assetType: "think_01",
            status: "draft",
            sourceRef: "Spiritverse_MASTER_ASSETS/ACTIVE/lyra/video/bad.mp4",
            durationSec: 5,
          },
        ],
        targetDurationSec: 5,
        transitionStyle: "soft_cut",
      },
      allowStatuses: [422],
      describe: (result) => result?.body?.error === "VALIDATION_ERROR"
        && result?.body?.details?.fields?.some((field) => field.includes("status must be approved"))
        && result?.body?.details?.fields?.some((field) => field.includes("sourceRef must point to Spiritverse_MASTER_ASSETS/APPROVED"))
        ? "invalid sequence composition input denied"
        : "unexpected invalid sequence compose result",
    });
    await run("media-sequence-compose-execute-safe", "POST", "/admin/media/sequence-compose-execute", {
      headers: { "x-media-planning-test": "true" },
      body: {
        entityId: "lyra",
        packId: "lyra-motion-pack-v1",
        sequenceId: "lyra-response-sequence-v1",
        approvedAssets: approvedSequenceAssets,
        targetDurationSec: 10,
        transitionStyle: "soft_cut",
      },
      describe: (result) => result?.body?.mediaPlanningBypassUsed === true
        && result?.body?.sequenceComposeResult?.plannedOnly === true
        && result?.body?.sequenceComposeResult?.compositionPlan?.lifecycleState === "review_required"
        && result?.body?.sequenceComposeResult?.noCompositionPerformed === true
        && result?.body?.sequenceComposeResult?.noProviderCall === true
        && result?.body?.sequenceComposeResult?.noActiveWritePerformed === true
        && result?.body?.sequenceComposeResult?.noManifestUpdatePerformed === true
        ? "sequence composition execution remains planned-only and write-safe"
        : "unexpected sequence compose execution result",
    });
    await run("media-source-reference-plan", "POST", "/admin/media/source-reference-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        sourceAssetId: "existing-pika-spiritgate-video",
        targetId: "spiritgate",
        targetType: "spiritgate",
        assetKind: "spiritgate_video",
        sourceType: "external_url",
        sourceUrl: "https://example.com/spiritgate.mp4",
        approvedForReference: true,
      },
      describe: (result) => result?.body?.sourceReference?.providerCompatibility?.runway?.recommendedMode === "video_to_video"
        && result?.body?.noActiveWritePerformed === true
        ? "source media reference planned without storage writes"
        : "unexpected source reference result",
    });
    await run("media-spiritgate-source-summary", "GET", "/admin/media/spiritgate-source-summary", {
      headers: {
        "x-admin-key": DIAG_ADMIN_KEY,
        "x-forwarded-proto": "https",
        "x-forwarded-host": "spiritcore-backend-copy-production.up.railway.app",
      },
      describe: (result) => result?.body?.spiritGateSource?.currentPath === "/videos/gate_entrance_final.mp4"
        && result?.body?.spiritGateSource?.canUseForRunwayVideoToVideo === true
        && result?.body?.spiritGateSource?.commandCenterGeneratorReadiness?.videoGeneratorControls === true
        && result?.body?.noGenerationPerformed === true
        && result?.body?.noProviderCall === true
        ? "existing SpiritGate source summary returned without generation"
        : "unexpected SpiritGate source summary",
    });
    await run("media-spiritgate-plan-from-current-source", "POST", "/admin/media/spiritgate-enhancement-plan-from-current-source", {
      headers: {
        "x-admin-key": DIAG_ADMIN_KEY,
        "x-forwarded-proto": "https",
        "x-forwarded-host": "spiritcore-backend-copy-production.up.railway.app",
      },
      body: {
        styleProfile: "premium cinematic SpiritGate enhancement",
        safetyLevel: "internal_review",
      },
      describe: (result) => result?.body?.spiritGateEnhancementPlan?.readyToRunPayload?.sourceAssetRef === "https://spiritcore-backend-copy-production.up.railway.app/videos/gate_entrance_final.mp4"
        && result?.body?.spiritGateEnhancementPlan?.operatorApprovalRequired === true
        && result?.body?.spiritGateEnhancementPlan?.noGenerationPerformed === true
        && result?.body?.spiritGateEnhancementPlan?.noProviderCall === true
        && result?.body?.spiritGateEnhancementPlan?.noManifestUpdatePerformed === true
        && result?.body?.spiritGateEnhancementPlan?.noActiveWritePerformed === true
        ? "enhancement plan built from current SpiritGate source"
        : "unexpected SpiritGate current-source plan",
    });
    await run("media-spiritgate-segment-plan", "POST", "/admin/media/spiritgate-segment-plan", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        targetId: "spiritgate",
        sourceAssetRef: "https://spiritcore-backend-copy-production.up.railway.app/videos/gate_entrance_final.mp4",
        sourceDurationSec: 43.349,
        segmentDurationSec: 5,
        styleProfile: "premium cinematic cosmic fantasy, luxury black and gold, subtle apple red accents, ivory highlights, Spiritverse gateway identity",
        safetyLevel: "internal_review",
        endingNeedsTransitionImprovement: true,
      },
      describe: (result) => result?.body?.spiritGateSegmentPlan?.totalSegments === 9
        && result?.body?.spiritGateSegmentPlan?.segments?.[8]?.enhancementMode === "transition-improvement"
        && result?.body?.spiritGateSegmentPlan?.segments?.[8]?.promptIntent?.includes("abrupt ending")
        && result?.body?.spiritGateSegmentPlan?.stitchPlan?.noStitchingPerformed === true
        && result?.body?.spiritGateSegmentPlan?.noGenerationPerformed === true
        && result?.body?.spiritGateSegmentPlan?.noProviderCall === true
        && result?.body?.spiritGateSegmentPlan?.noPromotionPerformed === true
        && result?.body?.spiritGateSegmentPlan?.noManifestUpdatePerformed === true
        && result?.body?.spiritGateSegmentPlan?.noActiveWritePerformed === true
        && result?.body?.spiritGateSegmentPlan?.premiumMemberGeneration?.enabled === false
        ? "SpiritGate segmented plan created without generation or writes"
        : "unexpected SpiritGate segment plan",
    });
    const lyraSourceUrl = "https://spiritcore-backend-copy-production.up.railway.app/portraits/lyra_portrait.png";
    await run("media-spiritkin-motion-state-execute-missing-source", "POST", "/admin/media/spiritkin-motion-state-execute", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        assetType: "speaking_01",
        assetKind: "speaking_video",
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic missing source reference rejection.",
        styleProfile: "premium cinematic Spiritverse companion",
        safetyLevel: "internal_review",
        operatorApproval: true,
      },
      allowStatuses: [400, 422],
      describe: () => "missing sourceAssetRef rejected",
    });
    await run("media-spiritkin-motion-state-execute-missing-approval", "POST", "/admin/media/spiritkin-motion-state-execute", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        assetType: "speaking_01",
        assetKind: "speaking_video",
        sourceAssetRef: lyraSourceUrl,
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic missing operator approval rejection.",
        styleProfile: "premium cinematic Spiritverse companion",
        safetyLevel: "internal_review",
        operatorApproval: false,
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.executionGates?.missingGates?.includes("operatorApproval=true is required")
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        ? "missing operator approval cannot execute Spiritkin motion provider"
        : "unexpected missing approval result",
    });
    await run("media-spiritkin-motion-state-execute-invalid-duration", "POST", "/admin/media/spiritkin-motion-state-execute", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        assetType: "speaking_01",
        assetKind: "speaking_video",
        sourceAssetRef: lyraSourceUrl,
        sourceAssetType: "external_url",
        promptIntent: "Animate Lyra into a premium speaking loop for SpiritCore responses.",
        styleProfile: "premium cinematic Spiritverse companion, elegant, emotionally alive",
        safetyLevel: "internal_review",
        operatorApproval: true,
        durationSec: 6,
      },
      allowStatuses: [400, 422],
      describe: (result) => result?.body?.error === "VALIDATION_ERROR"
        && result?.body?.message === "Invalid Spiritkin motion generation controls."
        ? "invalid duration rejected before provider execution"
        : "unexpected invalid duration result",
    });
    await run("media-spiritkin-motion-state-execute-diagnostic-idle-preview", "POST", "/admin/media/spiritkin-motion-state-execute", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        assetType: "idle_01",
        assetKind: "idle_video",
        sourceAssetRef: lyraSourceUrl,
        sourceAssetType: "external_url",
        promptIntent: "Animate Lyra in a diagnostic idle loop for first motion validation.",
        styleProfile: "premium cinematic Spiritverse companion, elegant, emotionally alive",
        safetyLevel: "internal_review",
        operatorApproval: true,
        durationSec: 5,
        aspectRatio: "720:1280",
        motionIntensity: "low",
        generationMode: "diagnostic_idle",
        allowMouthMovement: false,
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.providerTarget?.providerMode === "image_to_video"
        && result?.body?.apiPayloadPreview?.model === "gen4_turbo"
        && result?.body?.apiPayloadPreview?.promptImage === lyraSourceUrl
        && result?.body?.apiPayloadPreview?.duration === 5
        && result?.body?.apiPayloadPreview?.ratio === "720:1280"
        && result?.body?.generationControls?.aspectRatio === "720:1280"
        && result?.body?.generationControls?.generationMode === "diagnostic_idle"
        && result?.body?.generationControls?.motionIntensity === "low"
        && result?.body?.generationControls?.allowMouthMovement === false
        && result?.body?.apiPayloadPreview?.promptText?.includes("No speaking, no mouth movement")
        && !result?.body?.apiPayloadPreview?.promptText?.includes("Style profile:")
        && result?.body?.apiPayloadPreview?.promptText?.length < 700
        && result?.body?.mediaAssetRecord?.lifecycleState === "review_required"
        && result?.body?.mediaAssetRecord?.reviewStatus === "pending"
        && Array.isArray(result?.body?.mediaAssetRecord?.outputUrls)
        && result?.body?.mediaAssetRecord?.outputUrls.length === 0
        && result?.body?.premiumMemberGeneration?.enabled === false
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        ? "valid staging diagnostic idle request builds safe image-to-video payload without provider call"
        : "unexpected Spiritkin motion execute preview",
    });
    const lyraThinkOverridePrompt = "Animate Lyra in a silent reflective thinking loop with visible lifelike motion, not slow motion. Preserve exact portrait identity, colors, eyes, face, silhouette, and calm Spiritverse tone. Keep the background clear and stable, not blurred. Add visible eye movement, thoughtful blink variation, a stronger thinking expression, and actual small head motion as if considering the user's words. No audio, no text, no subtitles, no logos, no camera movement, no background change, no identity drift.";
    await run("media-spiritkin-motion-state-execute-provider-prompt-override", "POST", "/admin/media/spiritkin-motion-state-execute", {
      headers: {
        "x-runway-transient-execute": "true",
        "x-runway-transient-provider-execution": "true",
      },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        assetType: "think_01",
        assetKind: "idle_video",
        sourceAssetRef: lyraSourceUrl,
        sourceAssetType: "external_url",
        promptIntent: "This built-in prompt should be replaced by providerPromptOverride.",
        styleProfile: "premium cinematic Spiritverse companion, elegant, emotionally alive",
        safetyLevel: "internal_review",
        operatorApproval: true,
        durationSec: 5,
        ratio: "720:1280",
        motionIntensity: "low",
        generationMode: "reflective_thinking",
        allowMouthMovement: false,
        runwayTransientKey: "mock-runway-key",
        providerPromptOverride: lyraThinkOverridePrompt,
      },
      describe: (result) => {
        const payload = result?.body?.apiPayloadPreview || {};
        const payloadKeys = Object.keys(payload).sort().join(",");
        return result?.body?.externalApiCall === false
          && result?.body?.mock === true
          && result?.body?.providerPromptOverrideUsed === true
          && result?.body?.providerPromptLength === lyraThinkOverridePrompt.length
          && payload.promptText === lyraThinkOverridePrompt
          && payload.promptText.length <= 1000
          && payloadKeys === "duration,model,promptImage,promptText,ratio"
          && payload.promptImage === lyraSourceUrl
          && payload.duration === 5
          && payload.ratio === "720:1280"
          && result?.body?.premiumMemberGeneration?.enabled === false
          && result?.body?.noPromotionPerformed === true
          && result?.body?.noManifestUpdatePerformed === true
          && result?.body?.noActiveWritePerformed === true
          ? "valid operator override used directly in image-to-video payload"
          : "unexpected provider prompt override result";
      },
    });
    await run("media-spiritkin-motion-state-execute-provider-prompt-override-too-long", "POST", "/admin/media/spiritkin-motion-state-execute", {
      headers: {
        "x-runway-transient-execute": "true",
        "x-runway-transient-provider-execution": "true",
      },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        assetType: "think_01",
        assetKind: "idle_video",
        sourceAssetRef: lyraSourceUrl,
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic too-long override rejection.",
        styleProfile: "premium cinematic Spiritverse companion, elegant, emotionally alive",
        safetyLevel: "internal_review",
        operatorApproval: true,
        durationSec: 5,
        ratio: "720:1280",
        motionIntensity: "low",
        generationMode: "reflective_thinking",
        allowMouthMovement: false,
        runwayTransientKey: "mock-runway-key",
        providerPromptOverride: `${lyraThinkOverridePrompt} ${"visible thinking motion ".repeat(60)}`,
      },
      allowStatuses: [400],
      describe: (result) => result?.body?.error === "PROVIDER_PROMPT_OVERRIDE_INVALID"
        && result?.body?.details?.fields?.includes("providerPromptOverride must be 1000 characters or fewer")
        && result?.body?.noProviderCall === true
        && result?.body?.externalApiCall === false
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        ? "too-long operator override rejected before provider call"
        : "unexpected too-long provider prompt override result",
    });
    await run("media-spiritkin-motion-state-execute-provider-prompt-override-denied", "POST", "/admin/media/spiritkin-motion-state-execute", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        assetType: "think_01",
        assetKind: "idle_video",
        sourceAssetRef: lyraSourceUrl,
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic denied override.",
        styleProfile: "premium cinematic Spiritverse companion, elegant, emotionally alive",
        safetyLevel: "internal_review",
        operatorApproval: true,
        durationSec: 5,
        ratio: "720:1280",
        motionIntensity: "low",
        generationMode: "reflective_thinking",
        allowMouthMovement: false,
        providerPromptOverride: lyraThinkOverridePrompt,
      },
      allowStatuses: [400],
      describe: (result) => result?.body?.error === "PROVIDER_PROMPT_OVERRIDE_DENIED"
        && result?.body?.noProviderCall === true
        && result?.body?.externalApiCall === false
        && result?.body?.providerPromptOverrideUsed === false
        && result?.body?.premiumMemberGeneration?.enabled === false
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        ? "operator override denied without internal transient execution gates"
        : "unexpected denied provider prompt override result",
    });
    await run("media-spiritkin-motion-state-execute-provider-400-sanitized", "POST", "/admin/media/spiritkin-motion-state-execute", {
      headers: {
        "x-admin-key": DIAG_ADMIN_KEY,
        "x-runway-transient-execute": "true",
        "x-runway-transient-provider-execution": "true",
        "x-runway-mock-provider-400": "true",
      },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        assetType: "idle_01",
        assetKind: "idle_video",
        sourceAssetRef: lyraSourceUrl,
        sourceAssetType: "external_url",
        promptIntent: "Animate Lyra in a diagnostic idle loop for provider 400 handling.",
        styleProfile: "premium cinematic Spiritverse companion, elegant, emotionally alive",
        safetyLevel: "internal_review",
        operatorApproval: true,
        durationSec: 5,
        ratio: "720:1280",
        motionIntensity: "low",
        generationMode: "diagnostic_idle",
        allowMouthMovement: false,
        runwayTransientKey: "mock-runway-key",
      },
      allowStatuses: [502],
      describe: (result) => {
        const serialized = JSON.stringify(result?.body || {});
        const payload = result?.body?.payloadPreview || {};
        const payloadKeys = Object.keys(payload).sort().join(",");
        return result?.body?.externalApiCall === true
          && result?.body?.providerHttpStatus === 400
          && result?.body?.providerErrorMessage === "Validation of body failed"
          && result?.body?.providerErrorCode === "INVALID_ARGUMENT"
          && result?.body?.providerBodyKeys?.includes("issues")
          && Array.isArray(result?.body?.providerBodyIssues)
          && result?.body?.providerBodyIssues[0]?.message === "Invalid option for ratio. Accepted values: 1280:720, 720:1280, 1104:832, 832:1104, 960:960, 1584:672."
          && result?.body?.providerDocUrl === "https://docs.dev.runwayml.com/api"
          && result?.body?.endpointPath === "/v1/image_to_video"
          && result?.body?.model === "gen4_turbo"
          && result?.body?.providerMode === "image_to_video"
          && payload.promptImage === lyraSourceUrl
          && payload.duration === 5
          && payload.ratio === "720:1280"
          && payloadKeys === "duration,model,promptImage,promptText,ratio"
          && result?.body?.noPromotionPerformed === true
          && result?.body?.noManifestUpdatePerformed === true
          && result?.body?.noActiveWritePerformed === true
          && !serialized.includes("mock-runway-key")
          ? "provider 400 returned sanitized Runway error details without writes"
          : "unexpected provider 400 sanitization result";
      },
    });
    await run("media-spiritkin-motion-state-execute-transient-flags-mock", "POST", "/admin/media/spiritkin-motion-state-execute", {
      headers: {
        "x-runway-transient-execute": "true",
        "x-runway-transient-provider-execution": "true",
      },
      body: {
        spiritkinId: "lyra",
        targetId: "lyra-motion-pack-v1",
        assetType: "idle_01",
        assetKind: "idle_video",
        sourceAssetRef: lyraSourceUrl,
        sourceAssetType: "external_url",
        promptIntent: "Animate Lyra in a diagnostic idle loop for first motion validation.",
        styleProfile: "premium cinematic Spiritverse companion, elegant, emotionally alive",
        safetyLevel: "internal_review",
        operatorApproval: true,
        durationSec: 5,
        aspectRatio: "720:1280",
        motionIntensity: "low",
        generationMode: "diagnostic_idle",
        allowMouthMovement: false,
        runwayTransientKey: "mock-runway-key",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.mock === true
        && result?.body?.transientKeyProvided === true
        && result?.body?.transientExecuteRequested === true
        && result?.body?.transientProviderExecutionRequested === true
        && result?.body?.executionGates?.ok === true
        && result?.body?.generationControls?.durationSec === 5
        && result?.body?.generationControls?.aspectRatio === "720:1280"
        && result?.body?.generationControls?.generationMode === "diagnostic_idle"
        && result?.body?.mediaAssetRecord?.providerJobId === "mock-lyra-idle-01-task"
        && result?.body?.mediaAssetRecord?.lifecycleState === "review_required"
        && result?.body?.premiumMemberGeneration?.enabled === false
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        ? "transient execution flags pass gates for Spiritkin motion mock path"
        : "unexpected Spiritkin motion transient flags result",
    });
    await run("media-spiritgate-enhancement-execute-missing-source", "POST", "/admin/media/spiritgate-enhancement-execute", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        targetId: "spiritgate",
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic missing source reference rejection.",
        styleProfile: "premium cinematic SpiritGate enhancement",
        safetyLevel: "internal_review",
        operatorApproval: true,
      },
      allowStatuses: [400, 422],
      describe: () => "missing sourceAssetRef rejected",
    });
    await run("media-spiritgate-enhancement-execute-missing-approval", "POST", "/admin/media/spiritgate-enhancement-execute", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        targetId: "spiritgate",
        sourceAssetRef: "https://example.com/spiritgate.mp4",
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic missing operator approval rejection.",
        styleProfile: "premium cinematic SpiritGate enhancement",
        safetyLevel: "internal_review",
        operatorApproval: false,
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.executionGates?.missingGates?.includes("operatorApproval=true is required")
        ? "missing operator approval cannot execute provider"
        : "unexpected missing approval result",
    });
    await run("media-spiritgate-enhancement-execute-valid-preview", "POST", "/admin/media/spiritgate-enhancement-execute", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        targetId: "spiritgate",
        sourceAssetRef: "https://example.com/spiritgate.mp4",
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic SpiritGate source-based video enhancement payload only.",
        styleProfile: "premium cinematic SpiritGate enhancement",
        safetyLevel: "internal_review",
        operatorApproval: true,
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.providerTarget?.providerMode === "video_to_video"
        && result?.body?.apiPayloadPreview?.model === "gen4_aleph"
        && result?.body?.apiPayloadPreview?.videoUri === "https://example.com/spiritgate.mp4"
        && result?.body?.mediaAssetRecord?.lifecycleState === "review_required"
        && result?.body?.commandCenterMetadata?.sourceAssetRequired === true
        && result?.body?.premiumMemberGeneration?.enabled === false
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        ? "valid staging request builds video-to-video payload without provider call"
        : "unexpected SpiritGate enhancement execute preview",
    });
    await run("media-spiritgate-enhancement-execute-transient-flags-missing", "POST", "/admin/media/spiritgate-enhancement-execute", {
      headers: { "x-admin-key": DIAG_ADMIN_KEY },
      body: {
        targetId: "spiritgate",
        sourceAssetRef: "https://example.com/spiritgate.mp4",
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic SpiritGate transient key without execution flags.",
        styleProfile: "premium cinematic SpiritGate enhancement",
        safetyLevel: "internal_review",
        operatorApproval: true,
        runwayTransientKey: "mock-runway-key",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.transientKeyProvided === true
        && result?.body?.transientExecuteRequested === false
        && result?.body?.transientProviderExecutionRequested === false
        && result?.body?.executionGates?.missingGates?.includes("RUNWAY_DRY_RUN_EXECUTE=true is required")
        && result?.body?.executionGates?.missingGates?.includes("RUNWAY_ALLOW_PROVIDER_EXECUTION=true is required")
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        ? "transient key without execution flags remains blocked"
        : "unexpected missing transient flags result",
    });
    await run("media-spiritgate-enhancement-execute-transient-flags-mock", "POST", "/admin/media/spiritgate-enhancement-execute", {
      headers: {
        "x-admin-key": DIAG_ADMIN_KEY,
        "x-runway-transient-execute": "true",
        "x-runway-transient-provider-execution": "true",
      },
      body: {
        targetId: "spiritgate",
        sourceAssetRef: "https://example.com/spiritgate.mp4",
        sourceAssetType: "external_url",
        promptIntent: "Diagnostic SpiritGate transient execution flags mock path.",
        styleProfile: "premium cinematic SpiritGate enhancement",
        safetyLevel: "internal_review",
        operatorApproval: true,
        runwayTransientKey: "mock-runway-key",
      },
      describe: (result) => result?.body?.externalApiCall === false
        && result?.body?.mock === true
        && result?.body?.transientKeyProvided === true
        && result?.body?.transientExecuteRequested === true
        && result?.body?.transientProviderExecutionRequested === true
        && result?.body?.executionGates?.ok === true
        && result?.body?.mediaAssetRecord?.lifecycleState === "review_required"
        && result?.body?.premiumMemberGeneration?.enabled === false
        && result?.body?.noPromotionPerformed === true
        && result?.body?.noManifestUpdatePerformed === true
        && result?.body?.noActiveWritePerformed === true
        ? "transient execution flags pass gates in mock path"
        : "unexpected transient flags mock result",
    });

    const conversation = await run("conversation-bootstrap", "POST", "/v1/conversations", {
      body: {
        userId,
        spiritkinName: "Lyra",
        title: "Endpoint Diagnostic Conversation",
        userName: "Diagnostic User",
      },
      describe: (result) => previewText(result?.body?.conversation?.conversation_id),
    });
    conversationId = conversation?.raw?.body?.conversation?.conversation_id || null;

    await run("conversations-list", "GET", `/v1/conversations/${encodeURIComponent(userId)}?limit=5`);
    await run("session-snapshot", "GET", `/v1/session/snapshot?userId=${encodeURIComponent(userId)}&conversationId=${encodeURIComponent(conversationId || "")}&currentSurface=profile&currentMode=conversation`);
    await run("session-control", "POST", "/v1/session/control", {
      body: {
        userId,
        conversationId,
        currentSpiritkinName: "Lyra",
        currentSurface: "profile",
        currentMode: "conversation",
        activeTab: "profile",
        speechState: { isListening: false, isSpeaking: false, turnPhase: "idle" },
      },
    });
    await run("bond-journal", "GET", `/v1/bond-journal?userId=${encodeURIComponent(userId)}&conversationId=${encodeURIComponent(conversationId || "")}`);
    await run("runtime-bootstrap", "POST", "/runtime/conversation/bootstrap", {
      body: { conversation_id: conversationId },
      ...(LEGACY_ROUTES_DISABLED_IN_PRODUCTION ? {
        allowStatuses: [410],
        describe: () => "legacy route gated in production",
      } : {}),
    });
    await run("runtime-context", "GET", `/runtime/context/${encodeURIComponent(conversationId || "")}`, LEGACY_ROUTES_DISABLED_IN_PRODUCTION ? {
      allowStatuses: [410],
      describe: () => "legacy route gated in production",
    } : {});
    await run("runtime-episodes", "GET", `/runtime/episodes/${encodeURIComponent(conversationId || "")}`, LEGACY_ROUTES_DISABLED_IN_PRODUCTION ? {
      allowStatuses: [410],
      describe: () => "legacy route gated in production",
    } : {});
    await run("games-state", "GET", `/v1/games/state/${encodeURIComponent(conversationId || "")}?userId=${encodeURIComponent(userId)}`);

    await run("interact", "POST", "/v1/interact", {
      body: {
        userId,
        input: "Hello Lyra. This is a local backend diagnostic to verify SpiritCore response flow.",
        spiritkin: { name: "Lyra" },
        conversationId,
        context: {
          activeTab: "profile",
          surfaceContext: { activeSurface: "profile", activeTab: "profile" },
          speechState: { turnPhase: "user_input" },
        },
      },
      describe: (result) => previewText(result?.body?.message || result?.body?.error?.message),
    });

    await run("speech-invalid-payload", "POST", "/v1/speech", {
      body: { text: "", voice: "alloy" },
      allowStatuses: [400],
      describe: () => "expected 400 invalid empty text",
    });
    await run("speech-invalid-voice", "POST", "/v1/speech", {
      body: { text: "Invalid voice diagnostic.", voice: "not-a-voice" },
      allowStatuses: [400],
      describe: () => "expected 400 invalid voice",
    });
    await run("speech-too-long", "POST", "/v1/speech", {
      body: { text: "x".repeat(1201), voice: "alloy" },
      allowStatuses: [400],
      describe: () => "expected 400 text too long",
    });
    const speech = await run("speech", "POST", "/v1/speech", {
      body: { text: "Diagnostic speech synthesis check.", voice: "alloy" },
      describe: (result) => result?.ok ? "audio/mpeg returned" : previewText(result?.body?.error?.message || result?.body?.message),
    });
    if (!speech.pass && isSkippableSpeechResponse(speech.raw)) {
      speech.pass = true;
      speech.skipped = true;
      speech.detail = `config-dependent: ${previewText(speech.raw?.body?.error?.message || speech.raw?.body?.message)}`;
    }

    const passCount = results.filter((entry) => entry.pass && !entry.skipped).length;
    const skipCount = results.filter((entry) => entry.skipped).length;
    const failCount = results.filter((entry) => !entry.pass && !entry.skipped).length;

    console.log("");
    console.log("Summary");
    console.log(JSON.stringify({
      baseUrl: BASE_URL,
      userId,
      conversationId,
      passCount,
      skipCount,
      failCount,
      failures: results
        .filter((entry) => !entry.pass && !entry.skipped)
        .map((entry) => ({
          name: entry.name,
          method: entry.method,
          path: entry.path,
          detail: entry.detail,
          status: entry.status || null,
          summary: entry.summary || null,
        })),
    }, null, 2));

    process.exitCode = failCount > 0 ? 1 : 0;
  } finally {
    cleanup();
    await sleep(500);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
