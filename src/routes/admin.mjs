/**
 * SpiritCore — Admin & Command Center Routes
 * 
 * GET /v1/admin/conversations/recent  — list recent conversations across all users
 * GET /v1/admin/messages/:conversationId — fetch transcript for a conversation
 * GET /v1/admin/stats                 — global system stats
 */
import { spawnSync } from "node:child_process";
import { config } from "../config.mjs";
import {
  checkRunwayOrganizationAuth,
  checkRunwayTaskStatus,
  buildRunwayApiPayload,
  canExecuteRunwayProvider,
  createDryRunJob,
  createExecutionSpikeJob,
  resolveRunwayGenerationTarget,
  RUNWAY_SUPPORTED_ASSET_KINDS,
  submitRunwayJob,
} from "../services/runwayProvider.mjs";
import { createPromotionPlan } from "../services/generatedAssetPipeline.mjs";
import {
  buildGenerationTemplate,
  buildSourceMediaReference,
  checkMediaRequirements,
  createMediaAssemblyPlan,
  createMediaAssetPlan,
  createMediaPromotionPlan,
  createMediaReviewPlan,
  createProductionSequencePlan,
  createSafeVideoAssemblyResult,
  createSpiritCoreAvatarPackPlan,
  createSpiritCoreDefaultOperatorPlan,
  createSpiritkinMotionPackPlan,
  createSpiritkinMotionStateExecutionPlan,
  createSpiritGateSegmentPlan,
  createSpiritGateEnhancementPlanFromCurrentSource,
  createSpiritGateEnhancementExecutionPlan,
  createSpiritGateEnhancementPlan,
  getMediaCatalogSummary,
  PREMIUM_MEMBER_GENERATION_BOUNDARY,
  SPIRITCORE_MEDIA_ASSET_KINDS,
  SPIRITCORE_MEDIA_REQUIREMENT_PROFILES,
  validateSourceMediaReference,
  resolveExistingSpiritGateSource,
  resolveExistingSpiritkinSource,
} from "../services/spiritCoreMediaProduction.mjs";

function isTrueEnv(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

export function canUseRunwayStagingTestBypass(body = {}, env = process.env) {
  return env.NODE_ENV === "staging"
    && isTrueEnv(env.RUNWAY_STAGING_TEST_BYPASS)
    && /^test-/i.test(String(body?.targetId || "").trim())
    && ["realm_background", "portrait"].includes(String(body?.assetKind || "").trim())
    && String(body?.safetyLevel || "").trim() === "internal_review";
}

function qualifiesForRunwayStagingTestBody(body = {}, env = process.env) {
  return env.NODE_ENV === "staging"
    && /^test-/i.test(String(body?.targetId || "").trim())
    && ["realm_background", "portrait"].includes(String(body?.assetKind || "").trim())
    && String(body?.safetyLevel || "").trim() === "internal_review";
}

const RUNWAY_TRANSIENT_KEY_HEADERS = Object.freeze([
  "x-runway-transient-key",
  "x-spiritcore-runway-token",
  "x-spiritcore-transient-key",
]);

function readRunwayTransientKey(headers = {}) {
  for (const header of RUNWAY_TRANSIENT_KEY_HEADERS) {
    const value = String(headers[header] || "").trim();
    if (value) {
      return { apiKey: value, keySource: "header" };
    }
  }
  return { apiKey: "", keySource: null };
}

function readRunwayTransientCredential(body = {}, headers = {}, env = process.env) {
  const headerKey = readRunwayTransientKey(headers);
  if (headerKey.apiKey) return headerKey;

  if (canUseRunwayStagingTestBypass(body, env)) {
    const bodyKey = String(body?.runwayTransientKey || "").trim();
    if (bodyKey) return { apiKey: bodyKey, keySource: "body" };
  }

  return { apiKey: "", keySource: null };
}

export function canUseRunwayTransientStagingCredentials(body = {}, headers = {}, env = process.env) {
  const transientKey = readRunwayTransientCredential(body, headers, env);
  return qualifiesForRunwayStagingTestBody(body, env)
    && canUseRunwayStagingTestBypass(body, env)
    && Boolean(transientKey.apiKey);
}

export function canUseRunwayStagingAuthCheck(env = process.env) {
  return env.NODE_ENV === "staging" && isTrueEnv(env.RUNWAY_STAGING_TEST_BYPASS);
}

export function canUseSpiritGateEnhancementStagingBypass(body = {}, env = process.env) {
  return env.NODE_ENV === "staging"
    && isTrueEnv(env.RUNWAY_STAGING_TEST_BYPASS)
    && ["spiritgate", "test-spiritgate"].includes(String(body?.targetId || "").trim())
    && String(body?.safetyLevel || "").trim() === "internal_review"
    && Boolean(body?.operatorApproval)
    && Boolean(String(body?.sourceAssetRef || "").trim());
}

export function canUseSpiritkinMotionStateStagingBypass(body = {}, env = process.env) {
  const envEnabled = isTrueEnv(env.RUNWAY_STAGING_TEST_BYPASS) || isTrueEnv(env.MEDIA_STAGING_TEST_BYPASS);
  return env.NODE_ENV === "staging"
    && envEnabled
    && Boolean(body?.operatorApproval)
    && String(body?.safetyLevel || "").trim() === "internal_review"
    && Boolean(String(body?.spiritkinId || "").trim())
    && Boolean(String(body?.targetId || "").trim())
    && Boolean(String(body?.assetType || "").trim())
    && Boolean(String(body?.assetKind || "").trim())
    && Boolean(String(body?.sourceAssetRef || "").trim());
}

const MEDIA_PLANNING_BYPASS_ROUTES = Object.freeze([
  "GET /admin/media/catalog-summary",
  "GET /admin/media/spiritgate-source-summary",
  "POST /admin/media/operator-experience-plan",
  "POST /admin/media/spiritkin-motion-pack-plan",
  "GET /admin/media/spiritkin-source-summary/:spiritkinId",
  "POST /admin/media/spiritcore-avatar-pack-plan",
  "POST /admin/media/assembly-plan",
  "POST /admin/media/assemble-video",
  "POST /admin/media/production-sequence-plan",
  "POST /admin/media/generation-template",
  "POST /admin/media/review-plan",
  "POST /admin/media/promotion-plan",
  "POST /admin/media/spiritgate-enhancement-plan",
  "POST /admin/media/spiritgate-enhancement-plan-from-current-source",
  "POST /admin/media/source-reference-plan",
]);

function mediaPlanningRouteKey(method = "", route = "") {
  return `${String(method || "").toUpperCase()} ${String(route || "").trim()}`;
}

export function canUseMediaPlanningStagingBypass({ method = "", route = "", headers = {}, env = process.env } = {}) {
  const headerEnabled = isTrueEnv(headers["x-media-planning-test"]);
  const envEnabled = isTrueEnv(env.RUNWAY_STAGING_TEST_BYPASS) || isTrueEnv(env.MEDIA_STAGING_TEST_BYPASS);
  return env.NODE_ENV === "staging"
    && envEnabled
    && headerEnabled
    && MEDIA_PLANNING_BYPASS_ROUTES.includes(mediaPlanningRouteKey(method, route));
}

function readRunwayTransientHeaders(body = {}, headers = {}, env = process.env) {
  const transientKey = readRunwayTransientCredential(body, headers, env);
  return {
    apiKey: transientKey.apiKey,
    keySource: transientKey.keySource,
    executeRequested: isTrueEnv(headers["x-runway-transient-execute"]),
    providerExecutionRequested: isTrueEnv(headers["x-runway-transient-provider-execution"]),
  };
}

function requestPublicOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) return "";
  return `${proto || "https"}://${host}`;
}

function localFfmpegRuntime() {
  const command = String(process.env.FFMPEG_PATH || "ffmpeg").trim();
  const result = spawnSync(command, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 3000,
  });
  return {
    ffmpegAvailable: result.status === 0,
    ffmpegExecutionEnabled: isTrueEnv(process.env.ENABLE_LOCAL_FFMPEG_ASSEMBLY),
    ffmpegCommand: command,
  };
}

function createRunwayExecutionContext({ req, baseConfig, baseEnv }) {
  const transient = readRunwayTransientHeaders(req.body || {}, req.headers || {}, baseEnv);
  const useTransient = canUseRunwayTransientStagingCredentials(req.body, req.headers || {}, baseEnv);
  if (!useTransient) {
    return {
      config: baseConfig,
      env: baseEnv,
      transientKeyProvided: Boolean(transient.apiKey),
      transientKeySource: transient.keySource,
      transientExecuteRequested: transient.executeRequested,
      transientProviderExecutionRequested: transient.providerExecutionRequested,
      transientCredentialNote: transient.apiKey ? null : "Transient Runway key was not received.",
    };
  }

  return {
    config: {
      ...baseConfig,
      adminAuth: {
        ...baseConfig.adminAuth,
        mode: "enforce",
      },
      generator: {
        ...baseConfig.generator,
        video: {
          ...baseConfig.generator?.video,
          runway: {
            ...baseConfig.generator?.video?.runway,
            apiKey: transient.apiKey,
          },
        },
      },
    },
    env: {
      ...baseEnv,
      RUNWAY_API_KEY: transient.apiKey,
      RUNWAY_DRY_RUN_EXECUTE: transient.executeRequested ? "true" : baseEnv.RUNWAY_DRY_RUN_EXECUTE,
      RUNWAY_ALLOW_PROVIDER_EXECUTION: transient.providerExecutionRequested ? "true" : baseEnv.RUNWAY_ALLOW_PROVIDER_EXECUTION,
    },
    transientKeyProvided: true,
    transientKeySource: transient.keySource,
    transientExecuteRequested: transient.executeRequested,
    transientProviderExecutionRequested: transient.providerExecutionRequested,
    transientCredentialNote: null,
  };
}

export async function adminRoutes(fastify, opts) {
  const { supabase, messageService, registry, issueReportService, spiritkinGeneratorService } = opts;
  const requireAdminAccess = fastify.requireAdminAccess;

  async function requireMediaPlanningAccess(req, reply) {
    const route = req.routeOptions?.url || req.routerPath || req.url;
    const allowed = canUseMediaPlanningStagingBypass({
      method: req.method,
      route,
      headers: req.headers || {},
      env: process.env,
    });
    req.mediaPlanningBypassUsed = Boolean(allowed);
    fastify.log?.warn?.({
      mediaPlanningBypassUsed: Boolean(allowed),
      route,
      method: req.method,
    }, "[admin] media planning access");
    if (allowed) {
      req.adminAccess = {
        allowed: true,
        bypassed: true,
        mode: "staging-media-planning-bypass",
        source: "staging-media-planning-bypass",
      };
      return;
    }
    return requireAdminAccess(req, reply);
  }

  // ── GET /v1/admin/conversations/recent ──────────────────────────────────────
  fastify.get("/v1/admin/conversations/recent", { preHandler: requireAdminAccess }, async (req, reply) => {
    try {
      const limit = Math.min(Number(req.query?.limit ?? 50), 200);
      const { data, error } = await supabase
        .from("conversations")
        .select("id, user_id, spiritkin_id, title, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Resolve spiritkin names from registry
      const spiritkins = await registry.listCanonical();
      const skMap = Object.fromEntries(spiritkins.map(sk => [sk.id, sk.name]));
      
      const enriched = (data || []).map(conv => ({
        ...conv,
        spiritkin_name: skMap[conv.spiritkin_id] || "Unknown"
      }));

      return { ok: true, conversations: enriched };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "DB_ERROR", message: err.message });
    }
  });

  // ── GET /v1/admin/messages/:conversationId ──────────────────────────────────
  fastify.get("/v1/admin/messages/:conversationId", { preHandler: requireAdminAccess }, async (req, reply) => {
    const { conversationId } = req.params;
    try {
      const messages = await messageService.fetchRecent({ conversationId, limit: 100 });
      return { ok: true, messages };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "DB_ERROR", message: err.message });
    }
  });

  // ── GET /v1/admin/stats ─────────────────────────────────────────────────────
  fastify.get("/v1/admin/stats", { preHandler: requireAdminAccess }, async (req, reply) => {
    try {
      const { count: totalUsers } = await supabase.from("entitlements").select("*", { count: "exact", head: true });
      const { count: totalMessages } = await supabase.from("messages").select("*", { count: "exact", head: true });
      const { count: totalConversations } = await supabase.from("conversations").select("*", { count: "exact", head: true });

      return {
        ok: true,
        stats: {
          total_users: totalUsers || 0,
          total_messages: totalMessages || 0,
          total_conversations: totalConversations || 0,
          timestamp: new Date().toISOString()
        }
      };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "DB_ERROR", message: err.message });
    }
  });

  fastify.get("/v1/admin/issues/recent", { preHandler: requireAdminAccess }, async (_req, reply) => {
    if (!issueReportService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Issue report service unavailable." });
    }
    try {
      const reports = await issueReportService.listRecent({ limit: 100 });
      return { ok: true, reports };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "ISSUE_REPORTS_ERROR", message: err.message });
    }
  });

  fastify.get("/v1/admin/issues/digest", { preHandler: requireAdminAccess }, async (_req, reply) => {
    if (!issueReportService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Issue report service unavailable." });
    }
    try {
      const digest = await issueReportService.getDigest();
      return { ok: true, digest };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "ISSUE_DIGEST_ERROR", message: err.message });
    }
  });

  fastify.get("/v1/admin/issues/repair-packets", { preHandler: requireAdminAccess }, async (req, reply) => {
    if (!issueReportService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Issue report service unavailable." });
    }
    try {
      const limit = Math.min(Number(req.query?.limit ?? 25), 100);
      const packets = await issueReportService.getRepairPackets({ limit });
      return { ok: true, packets };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "REPAIR_PACKETS_ERROR", message: err.message });
    }
  });

  fastify.get("/v1/admin/issues/repair-handoff", { preHandler: requireAdminAccess }, async (req, reply) => {
    if (!issueReportService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Issue report service unavailable." });
    }
    try {
      const limit = Math.min(Number(req.query?.limit ?? 25), 100);
      const handoff = await issueReportService.getRepairHandoffDigest({ limit });
      return { ok: true, handoff };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "REPAIR_HANDOFF_ERROR", message: err.message });
    }
  });

  fastify.get("/v1/admin/generator/summary", { preHandler: requireAdminAccess }, async (_req, reply) => {
    if (!spiritkinGeneratorService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Spiritkin generator service unavailable." });
    }
    try {
      const summary = await spiritkinGeneratorService.listSummary();
      return { ok: true, summary };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "GENERATOR_SUMMARY_ERROR", message: err.message });
    }
  });

  fastify.get("/v1/admin/generator/jobs", { preHandler: requireAdminAccess }, async (req, reply) => {
    if (!spiritkinGeneratorService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Spiritkin generator service unavailable." });
    }
    try {
      const jobs = await spiritkinGeneratorService.listJobs({
        type: req.query?.type ?? "all",
        spiritkinKey: req.query?.spiritkinKey ?? null,
      });
      return { ok: true, jobs };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "GENERATOR_JOBS_ERROR", message: err.message });
    }
  });

  fastify.get("/v1/admin/generator/providers/status", { preHandler: requireAdminAccess }, async (_req, reply) => {
    if (!spiritkinGeneratorService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Spiritkin generator service unavailable." });
    }
    try {
      const providers = spiritkinGeneratorService.getProviderStatus();
      return { ok: true, providers };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "GENERATOR_PROVIDER_STATUS_ERROR", message: err.message });
    }
  });

  async function handleRunwayDryRun(req, reply) {
    try {
      const job = createDryRunJob({
        ...req.body,
        requestedBy: req.adminAccess?.source || "admin_dry_run",
      });
      return {
        ok: true,
        route: req.routeOptions?.url || req.url,
        noCost: true,
        externalApiCall: false,
        job,
      };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({
        ok: false,
        error: err.code ?? "RUNWAY_DRY_RUN_ERROR",
        message: err.message,
        details: err.detail || {},
        supportedAssetKinds: RUNWAY_SUPPORTED_ASSET_KINDS,
      });
    }
  }

  const runwayDryRunSchema = {
    body: {
      type: "object",
      required: ["assetKind", "promptIntent", "styleProfile", "safetyLevel"],
      properties: {
        spiritkinId: { type: "string", nullable: true },
        spiritkinName: { type: "string", nullable: true },
        targetId: { type: "string", nullable: true },
        realmId: { type: "string", nullable: true },
        gameType: { type: "string", nullable: true },
        themeId: { type: "string", nullable: true },
        assetKind: { type: "string", minLength: 1 },
        promptIntent: { type: "string", minLength: 1 },
        styleProfile: { type: "string", minLength: 1 },
        safetyLevel: { type: "string", minLength: 1 },
        durationSec: { type: "number", nullable: true },
        aspectRatio: { type: "string", nullable: true },
        sourceAssets: { type: "array", items: { type: "string" }, nullable: true },
        negativePrompt: { type: "string", nullable: true },
      },
    },
  };

  const runwayExecutionSpikeSchema = {
    body: {
      ...runwayDryRunSchema.body,
      properties: {
        ...runwayDryRunSchema.body.properties,
        runwayTransientKey: { type: "string", minLength: 1 },
      },
    },
  };

  fastify.post("/admin/runway/dry-run", {
    preHandler: requireAdminAccess,
    schema: runwayDryRunSchema,
  }, handleRunwayDryRun);

  fastify.post("/v1/admin/runway/dry-run", {
    preHandler: requireAdminAccess,
    schema: runwayDryRunSchema,
  }, handleRunwayDryRun);

  const runwayAuthCheckSchema = {
    body: {
      type: "object",
      required: ["runwayTransientKey"],
      properties: {
        runwayTransientKey: { type: "string", minLength: 1 },
      },
    },
  };

  async function handleRunwayAuthCheck(req, reply) {
    if (!canUseRunwayStagingAuthCheck(process.env)) {
      return reply.code(404).send({
        ok: false,
        error: "RUNWAY_AUTH_CHECK_UNAVAILABLE",
        message: "Runway auth check is available only in staging test mode.",
      });
    }

    const runwayTransientKey = String(req.body?.runwayTransientKey || "").trim();
    if (!runwayTransientKey) {
      return reply.code(400).send({
        ok: false,
        error: "RUNWAY_TRANSIENT_KEY_REQUIRED",
        message: "Transient Runway key was not received.",
        externalApiCall: false,
        authOk: false,
        providerStatus: null,
        responseKeys: [],
      });
    }

    if (isTrueEnv(process.env.RUNWAY_AUTH_CHECK_MOCK)) {
      return {
        ok: true,
        route: req.routeOptions?.url || req.url,
        externalApiCall: false,
        authOk: true,
        providerStatus: 200,
        responseKeys: ["creditBalance"],
        creditBalance: 0,
        mock: true,
      };
    }

    try {
      const result = await checkRunwayOrganizationAuth({
        apiKey: runwayTransientKey,
        baseUrl: config.generator?.video?.runway?.baseUrl,
        version: config.generator?.video?.runway?.version,
      });
      return {
        ok: result.authOk,
        route: req.routeOptions?.url || req.url,
        ...result,
      };
    } catch {
      return reply.code(502).send({
        ok: false,
        route: req.routeOptions?.url || req.url,
        externalApiCall: true,
        authOk: false,
        providerStatus: null,
        responseKeys: [],
        message: "Runway organization auth check failed.",
      });
    }
  }

  fastify.post("/admin/runway/auth-check", {
    schema: runwayAuthCheckSchema,
  }, handleRunwayAuthCheck);

  const runwayStatusCheckSchema = {
    body: {
      type: "object",
      required: ["providerJobId"],
      properties: {
        providerJobId: { type: "string", minLength: 1 },
        runwayTransientKey: { type: "string", minLength: 1, nullable: true },
      },
    },
  };

  async function handleRunwayStatusCheck(req, reply) {
    if (!canUseRunwayStagingAuthCheck(process.env)) {
      return reply.code(404).send({
        ok: false,
        error: "RUNWAY_STATUS_CHECK_UNAVAILABLE",
        message: "Runway status check is available only in staging test mode.",
        externalApiCall: false,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      });
    }

    const providerJobId = String(req.body?.providerJobId || "").trim();
    if (!providerJobId) {
      return reply.code(400).send({
        ok: false,
        error: "RUNWAY_PROVIDER_JOB_ID_REQUIRED",
        message: "providerJobId is required.",
        externalApiCall: false,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      });
    }

    const runwayTransientKey = String(req.body?.runwayTransientKey || "").trim();
    const configuredKey = String(config.generator?.video?.runway?.apiKey || process.env.RUNWAY_API_KEY || "").trim();
    const apiKey = runwayTransientKey || configuredKey;
    if (!apiKey) {
      return reply.code(400).send({
        ok: false,
        error: "RUNWAY_KEY_REQUIRED",
        message: "Runway API key is required for task status checks.",
        externalApiCall: false,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      });
    }

    if (isTrueEnv(process.env.RUNWAY_STATUS_CHECK_MOCK)) {
      if (/mock-failed/i.test(providerJobId)) {
        return {
          ok: false,
          route: req.routeOptions?.url || req.url,
          externalApiCall: false,
          provider: "runway",
          providerJobId,
          providerStatus: "FAILED",
          providerHttpStatus: 200,
          outputUrls: [],
          error: "An unexpected error occurred.",
          failure: true,
          failureCode: "INTERNAL.BAD_OUTPUT.CODE01",
          failureMessage: "An unexpected error occurred.",
          responseKeys: ["id", "status", "failure", "failureCode", "output"],
          mock: true,
          checkedAt: new Date().toISOString(),
          noPromotionPerformed: true,
          noManifestUpdatePerformed: true,
          noActiveWritePerformed: true,
        };
      }
      return {
        ok: true,
        route: req.routeOptions?.url || req.url,
        externalApiCall: false,
        provider: "runway",
        providerJobId,
        providerStatus: "SUCCEEDED",
        providerHttpStatus: 200,
        outputUrls: ["https://example.invalid/runway-output.png"],
        error: null,
        failure: false,
        responseKeys: ["id", "status", "output", "createdAt"],
        mock: true,
        checkedAt: new Date().toISOString(),
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      };
    }

    try {
      const result = await checkRunwayTaskStatus(providerJobId, {
        apiKey,
        baseUrl: config.generator?.video?.runway?.baseUrl,
        version: config.generator?.video?.runway?.version,
        statusPath: config.generator?.video?.runway?.statusPath,
      });
      return {
        ok: !result.failure,
        route: req.routeOptions?.url || req.url,
        ...result,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      };
    } catch {
      return reply.code(502).send({
        ok: false,
        route: req.routeOptions?.url || req.url,
        externalApiCall: true,
        provider: "runway",
        providerJobId,
        providerStatus: null,
        providerHttpStatus: null,
        outputUrls: [],
        error: "Runway task status check failed.",
        failure: true,
        responseKeys: [],
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      });
    }
  }

  fastify.post("/admin/runway/status-check", {
    schema: runwayStatusCheckSchema,
  }, handleRunwayStatusCheck);

  async function handleRunwayExecutionSpike(req, reply) {
    const stagingBypassUsed = Boolean(req.runwayStagingBypassUsed);
    const executionContext = createRunwayExecutionContext({
      req,
      baseConfig: config,
      baseEnv: process.env,
    });
    try {
      const result = await createExecutionSpikeJob({
        ...req.body,
        requestedBy: req.adminAccess?.source || "admin_execution_spike",
      }, {
        config: executionContext.config,
        env: executionContext.env,
        authContext: req.adminAccess || {},
      });
      fastify.log?.warn?.({
        route: req.routeOptions?.url || req.url,
        stagingBypassUsed,
        transientKeyProvided: executionContext.transientKeyProvided,
        transientKeySource: executionContext.transientKeySource,
        transientExecuteRequested: executionContext.transientExecuteRequested,
        transientProviderExecutionRequested: executionContext.transientProviderExecutionRequested,
        targetId: req.body?.targetId || null,
        assetKind: req.body?.assetKind || null,
        safetyLevel: req.body?.safetyLevel || null,
        externalApiCall: Boolean(result.externalApiCall),
      }, "[runway] execution spike access");
      if (!result.ok) {
        return reply.code(502).send({
          ok: false,
          route: req.routeOptions?.url || req.url,
          externalApiCall: result.externalApiCall,
          stagingBypassUsed,
          transientKeyProvided: executionContext.transientKeyProvided,
          transientKeySource: executionContext.transientKeySource,
          transientExecuteRequested: executionContext.transientExecuteRequested,
          transientProviderExecutionRequested: executionContext.transientProviderExecutionRequested,
          transientCredentialNote: executionContext.transientCredentialNote,
          error: result.error,
          job: result.job,
        });
      }
      return {
        ok: true,
        route: req.routeOptions?.url || req.url,
        executionSpike: true,
        executed: result.executed,
        externalApiCall: result.externalApiCall,
        stagingBypassUsed,
        transientKeyProvided: executionContext.transientKeyProvided,
        transientKeySource: executionContext.transientKeySource,
        transientExecuteRequested: executionContext.transientExecuteRequested,
        transientProviderExecutionRequested: executionContext.transientProviderExecutionRequested,
        transientCredentialNote: executionContext.transientCredentialNote,
        job: result.job,
      };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({
        ok: false,
        error: err.code ?? "RUNWAY_EXECUTION_SPIKE_ERROR",
        message: err.message,
        details: err.detail || {},
        supportedAssetKinds: RUNWAY_SUPPORTED_ASSET_KINDS,
      });
    }
  }

  async function requireRunwayExecutionSpikeAccess(req, reply) {
    if (canUseRunwayStagingTestBypass(req.body, process.env)) {
      req.runwayStagingBypassUsed = true;
      req.adminAccess = {
        allowed: true,
        bypassed: true,
        mode: "staging-test-bypass",
        source: "staging-test-bypass",
      };
      return;
    }

    req.runwayStagingBypassUsed = false;
    return requireAdminAccess(req, reply);
  }

  fastify.post("/admin/runway/execution-spike", {
    preHandler: requireRunwayExecutionSpikeAccess,
    schema: runwayExecutionSpikeSchema,
  }, handleRunwayExecutionSpike);

  fastify.post("/v1/admin/runway/execution-spike", {
    preHandler: requireRunwayExecutionSpikeAccess,
    schema: runwayExecutionSpikeSchema,
  }, handleRunwayExecutionSpike);

  const mediaAssetPlanSchema = {
    body: {
      type: "object",
      required: ["assetKind"],
      properties: {
        assetId: { type: "string", nullable: true },
        spiritkinId: { type: "string", nullable: true },
        targetId: { type: "string", nullable: true },
        targetType: { type: "string", nullable: true },
        assetKind: { type: "string", minLength: 1 },
        lifecycleState: { type: "string", nullable: true },
        reviewStatus: { type: "string", nullable: true },
        promotionStatus: { type: "string", nullable: true },
        activeStatus: { type: "string", nullable: true },
        provider: { type: "string", nullable: true },
        providerJobId: { type: "string", nullable: true },
        sourceAssetRefs: { type: "array", items: { type: "string" }, nullable: true },
        promptIntent: { type: "string", nullable: true },
        styleProfile: { type: "string", nullable: true },
        safetyLevel: { type: "string", nullable: true },
        outputUrls: { type: "array", items: { type: "string" }, nullable: true },
        publicPath: { type: "string", nullable: true },
        activePath: { type: "string", nullable: true },
        reviewPath: { type: "string", nullable: true },
        metadataPath: { type: "string", nullable: true },
        versionTag: { type: "string", nullable: true },
        artifactFileName: { type: "string", nullable: true },
        existingAssets: { type: "array", items: { type: "object", additionalProperties: true }, nullable: true },
        assets: { type: "array", items: { type: "object", additionalProperties: true }, nullable: true },
        referenceAssets: { type: "array", items: { type: "string" }, nullable: true },
        spiritkinName: { type: "string", nullable: true },
        spiritkinRole: { type: "string", nullable: true },
        visualIdentity: { type: "string", nullable: true },
        loreSummary: { type: "string", nullable: true },
        colorPalette: { type: "string", nullable: true },
        emotionalTone: { type: "string", nullable: true },
        notes: { type: "string", nullable: true },
      },
    },
  };

  const mediaRequirementsCheckSchema = {
    body: {
      type: "object",
      required: ["profileId"],
      properties: {
        profileId: { type: "string", minLength: 1 },
        targetId: { type: "string", nullable: true },
        spiritkinId: { type: "string", nullable: true },
        assets: { type: "array", items: { type: "object", additionalProperties: true }, nullable: true },
      },
    },
  };

  const mediaGenerationTemplateSchema = {
    body: {
      type: "object",
      required: ["assetKind"],
      properties: {
        templateId: { type: "string", nullable: true },
        template: { type: "string", nullable: true },
        assetKind: { type: "string", minLength: 1 },
        spiritkinName: { type: "string", nullable: true },
        spiritkinRole: { type: "string", nullable: true },
        visualIdentity: { type: "string", nullable: true },
        loreSummary: { type: "string", nullable: true },
        colorPalette: { type: "string", nullable: true },
        emotionalTone: { type: "string", nullable: true },
        styleProfile: { type: "string", nullable: true },
        safetyLevel: { type: "string", nullable: true },
        referenceAssets: { type: "array", items: { type: "string" }, nullable: true },
        negativePrompt: { type: "string", nullable: true },
      },
    },
  };

  const mediaProductionSequencePlanSchema = {
    body: {
      type: "object",
      required: ["sequenceType", "targetId"],
      properties: {
        sequenceType: { type: "string", minLength: 1 },
        targetId: { type: "string", minLength: 1 },
        sourceAssetRefs: { type: "array", items: { type: "string" }, nullable: true },
        assetKinds: { type: "array", items: { type: "string" }, nullable: true },
        styleProfile: { type: "string", nullable: true },
        safetyLevel: { type: "string", nullable: true },
        notes: { type: "string", nullable: true },
        promptIntent: { type: "string", nullable: true },
        spiritkinName: { type: "string", nullable: true },
        spiritkinRole: { type: "string", nullable: true },
        visualIdentity: { type: "string", nullable: true },
        loreSummary: { type: "string", nullable: true },
        colorPalette: { type: "string", nullable: true },
        emotionalTone: { type: "string", nullable: true },
      },
    },
  };

  const sourceReferencePlanSchema = {
    body: {
      type: "object",
      required: ["targetId", "assetKind", "sourceType"],
      properties: {
        sourceAssetId: { type: "string", nullable: true },
        targetId: { type: "string", minLength: 1 },
        targetType: { type: "string", nullable: true },
        assetKind: { type: "string", minLength: 1 },
        sourceType: { type: "string", minLength: 1 },
        sourceAssetType: { type: "string", nullable: true },
        sourceUrl: { type: "string", nullable: true },
        storagePath: { type: "string", nullable: true },
        sourceAssetRef: { type: "string", nullable: true },
        uploadedAt: { type: "string", nullable: true },
        notes: { type: "string", nullable: true },
        approvedForReference: { type: "boolean", nullable: true },
        usageRestrictions: { type: "array", items: { type: "string" }, nullable: true },
      },
    },
  };

  const spiritGateEnhancementExecuteSchema = {
    body: {
      type: "object",
      required: ["targetId", "sourceAssetRef", "sourceAssetType", "promptIntent", "styleProfile", "safetyLevel", "operatorApproval"],
      properties: {
        targetId: { type: "string", minLength: 1 },
        sourceAssetRef: { type: "string", minLength: 1 },
        sourceAssetType: { type: "string", minLength: 1 },
        promptIntent: { type: "string", minLength: 1 },
        styleProfile: { type: "string", minLength: 1 },
        safetyLevel: { type: "string", minLength: 1 },
        runwayTransientKey: { type: "string", minLength: 1, nullable: true },
        operatorApproval: { type: "boolean" },
        notes: { type: "string", nullable: true },
      },
    },
  };

  const spiritGateSegmentPlanSchema = {
    body: {
      type: "object",
      required: ["targetId", "sourceAssetRef", "sourceDurationSec", "segmentDurationSec", "styleProfile", "safetyLevel"],
      properties: {
        targetId: { type: "string", minLength: 1 },
        sourceAssetRef: { type: "string", minLength: 1 },
        sourceDurationSec: { type: "number" },
        segmentDurationSec: { type: "number" },
        styleProfile: { type: "string", minLength: 1 },
        safetyLevel: { type: "string", minLength: 1 },
        endingNeedsTransitionImprovement: { type: "boolean", nullable: true },
      },
    },
  };

  const operatorExperiencePlanSchema = {
    body: {
      type: "object",
      properties: {
        defaultOperatorType: { type: "string", nullable: true },
        spiritkinsEnabled: { type: "boolean", nullable: true },
        spiritcoreProfile: { type: "object", nullable: true },
        spiritkinProfiles: { type: "array", items: { type: "object" }, nullable: true },
        entitlements: { type: "object", nullable: true },
      },
    },
  };

  const motionPackPlanSchema = {
    body: {
      type: "object",
      required: ["spiritkinId", "targetId", "styleProfile", "safetyLevel"],
      properties: {
        spiritkinId: { type: "string", minLength: 1 },
        targetId: { type: "string", minLength: 1 },
        styleProfile: { type: "string", minLength: 1 },
        safetyLevel: { type: "string", minLength: 1 },
        sourceRefs: { type: "array", items: { type: "string" }, nullable: true },
      },
    },
  };

  const motionStateExecuteSchema = {
    body: {
      type: "object",
      required: ["spiritkinId", "targetId", "assetType", "assetKind", "sourceAssetRef", "sourceAssetType", "promptIntent", "styleProfile", "safetyLevel", "operatorApproval"],
      properties: {
        spiritkinId: { type: "string", minLength: 1 },
        targetId: { type: "string", minLength: 1 },
        assetType: { type: "string", minLength: 1 },
        assetKind: { type: "string", minLength: 1 },
        sourceAssetRef: { type: "string", minLength: 1 },
        sourceAssetType: { type: "string", minLength: 1 },
        promptIntent: { type: "string", minLength: 1 },
        styleProfile: { type: "string", minLength: 1 },
        safetyLevel: { type: "string", minLength: 1 },
        runwayTransientKey: { type: "string", minLength: 1, nullable: true },
        operatorApproval: { type: "boolean" },
        durationSec: { type: "number", nullable: true },
        ratio: { type: "string", nullable: true },
        aspectRatio: { type: "string", nullable: true },
        motionIntensity: { type: "string", nullable: true },
        generationMode: { type: "string", nullable: true },
        allowMouthMovement: { type: "boolean", nullable: true },
        notes: { type: "string", nullable: true },
      },
    },
  };

  const avatarPackPlanSchema = {
    body: {
      type: "object",
      required: ["targetId", "avatarType", "styleProfile", "safetyLevel"],
      properties: {
        targetId: { type: "string", minLength: 1 },
        avatarType: { type: "string", minLength: 1 },
        styleProfile: { type: "string", minLength: 1 },
        safetyLevel: { type: "string", minLength: 1 },
      },
    },
  };

  const assemblyPlanSchema = {
    body: {
      type: "object",
      required: ["assemblyType", "targetId", "segments", "outputLabel", "safetyLevel"],
      properties: {
        assemblyType: { type: "string", minLength: 1 },
        targetId: { type: "string", minLength: 1 },
        segments: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["sourceRef"],
            properties: {
              sourceRef: { type: "string", minLength: 1 },
              startSec: { type: "number", nullable: true },
              endSec: { type: "number", nullable: true },
              role: { type: "string", nullable: true },
            },
          },
        },
        outputLabel: { type: "string", minLength: 1 },
        safetyLevel: { type: "string", minLength: 1 },
      },
    },
  };

  function mediaRouteResult(route, builder, req, reply) {
    try {
      return {
        ok: true,
        route,
        externalApiCall: false,
        noProviderCall: true,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
        mediaPlanningBypassUsed: Boolean(req?.mediaPlanningBypassUsed),
        ...builder(),
      };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({
        ok: false,
        route,
        error: err.code ?? "SPIRITCORE_MEDIA_PLAN_ERROR",
        message: err.message,
        details: err.detail || {},
        supportedAssetKinds: SPIRITCORE_MEDIA_ASSET_KINDS,
        requirementProfiles: Object.keys(SPIRITCORE_MEDIA_REQUIREMENT_PROFILES),
      });
    }
  }

  fastify.post("/admin/media/asset-plan", {
    preHandler: requireAdminAccess,
    schema: mediaAssetPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    assetPlan: createMediaAssetPlan({
      ...req.body,
      requestedBy: req.adminAccess?.source || "admin_media_asset_plan",
    }),
  }), req, reply));

  fastify.post("/admin/media/requirements-check", {
    preHandler: requireAdminAccess,
    schema: mediaRequirementsCheckSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    requirements: checkMediaRequirements(req.body),
  }), req, reply));

  fastify.post("/admin/media/generation-template", {
    preHandler: requireMediaPlanningAccess,
    schema: mediaGenerationTemplateSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    generationTemplate: buildGenerationTemplate(req.body),
  }), req, reply));

  fastify.post("/admin/media/review-plan", {
    preHandler: requireMediaPlanningAccess,
    schema: mediaAssetPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    reviewPlan: createMediaReviewPlan(req.body),
  }), req, reply));

  fastify.post("/admin/media/promotion-plan", {
    preHandler: requireMediaPlanningAccess,
    schema: mediaAssetPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    promotionPlan: createMediaPromotionPlan(req.body),
  }), req, reply));

  fastify.post("/admin/media/spiritgate-enhancement-plan", {
    preHandler: requireMediaPlanningAccess,
    schema: {
      body: {
        type: "object",
        properties: {
          targetId: { type: "string", nullable: true },
          assetKind: { type: "string", nullable: true },
          existingSourceAsset: { type: "string", nullable: true },
          sourcePath: { type: "string", nullable: true },
          sourceAssetRefs: { type: "array", items: { type: "string" }, nullable: true },
          referenceAssets: { type: "array", items: { type: "string" }, nullable: true },
          promptIntent: { type: "string", nullable: true },
          styleProfile: { type: "string", nullable: true },
          safetyLevel: { type: "string", nullable: true },
          versionTag: { type: "string", nullable: true },
        },
      },
    },
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    spiritGateEnhancementPlan: createSpiritGateEnhancementPlan(req.body),
  }), req, reply));

  fastify.post("/admin/media/production-sequence-plan", {
    preHandler: requireMediaPlanningAccess,
    schema: mediaProductionSequencePlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    productionSequencePlan: createProductionSequencePlan(req.body),
  }), req, reply));

  fastify.post("/admin/media/operator-experience-plan", {
    preHandler: requireMediaPlanningAccess,
    schema: operatorExperiencePlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    operatorExperiencePlan: createSpiritCoreDefaultOperatorPlan(req.body),
  }), req, reply));

  fastify.post("/admin/media/spiritkin-motion-pack-plan", {
    preHandler: requireMediaPlanningAccess,
    schema: motionPackPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    spiritkinMotionPackPlan: createSpiritkinMotionPackPlan(req.body),
  }), req, reply));

  fastify.get("/admin/media/spiritkin-source-summary/:spiritkinId", {
    preHandler: requireMediaPlanningAccess,
    schema: {
      params: {
        type: "object",
        required: ["spiritkinId"],
        properties: {
          spiritkinId: { type: "string", minLength: 1 },
        },
      },
    },
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    spiritkinSource: resolveExistingSpiritkinSource(req.params.spiritkinId, {
      origin: requestPublicOrigin(req),
    }),
  }), req, reply));

  fastify.post("/admin/media/spiritcore-avatar-pack-plan", {
    preHandler: requireMediaPlanningAccess,
    schema: avatarPackPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    spiritcoreAvatarPackPlan: createSpiritCoreAvatarPackPlan(req.body),
  }), req, reply));

  fastify.post("/admin/media/assembly-plan", {
    preHandler: requireMediaPlanningAccess,
    schema: assemblyPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    assemblyPlan: createMediaAssemblyPlan(req.body, localFfmpegRuntime()),
  }), req, reply));

  fastify.post("/admin/media/assemble-video", {
    preHandler: requireMediaPlanningAccess,
    schema: assemblyPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    assemblyResult: createSafeVideoAssemblyResult(req.body, localFfmpegRuntime()),
  }), req, reply));

  async function requireSpiritkinMotionStateAccess(req, reply) {
    if (canUseSpiritkinMotionStateStagingBypass(req.body, process.env)) {
      req.spiritkinMotionStateStagingBypassUsed = true;
      req.adminAccess = {
        allowed: true,
        bypassed: true,
        mode: "staging-spiritkin-motion-state-bypass",
        source: "staging-spiritkin-motion-state-bypass",
      };
      return;
    }
    req.spiritkinMotionStateStagingBypassUsed = false;
    return requireAdminAccess(req, reply);
  }

  fastify.post("/admin/media/spiritkin-motion-state-execute", {
    preHandler: requireSpiritkinMotionStateAccess,
    schema: motionStateExecuteSchema,
  }, async (req, reply) => {
    const route = req.routeOptions?.url || req.url;
    const body = req.body || {};
    if (process.env.NODE_ENV !== "staging") {
      return reply.code(404).send({
        ok: false,
        route,
        error: "SPIRITKIN_MOTION_STATE_EXECUTE_UNAVAILABLE",
        message: "Spiritkin motion state execution is available only in staging operator mode.",
        externalApiCall: false,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      });
    }

    const transientExecuteRequested = isTrueEnv(req.headers["x-runway-transient-execute"]);
    const transientProviderExecutionRequested = isTrueEnv(req.headers["x-runway-transient-provider-execution"]);
    const transientKeyProvided = Boolean(String(body.runwayTransientKey || "").trim());
    const envEnabled = isTrueEnv(process.env.RUNWAY_STAGING_TEST_BYPASS) || isTrueEnv(process.env.MEDIA_STAGING_TEST_BYPASS);
    const gateFailures = [];
    if (!envEnabled) gateFailures.push("RUNWAY_STAGING_TEST_BYPASS=true or MEDIA_STAGING_TEST_BYPASS=true is required");
    if (!body.operatorApproval) gateFailures.push("operatorApproval=true is required");
    if (body.safetyLevel !== "internal_review") gateFailures.push("safetyLevel must be internal_review");
    if (!String(body.sourceAssetRef || "").trim()) gateFailures.push("sourceAssetRef is required");

    try {
      const executionPlan = createSpiritkinMotionStateExecutionPlan({
        ...body,
        requestedBy: req.adminAccess?.source || "admin_media_spiritkin_motion_state_execute",
      });
      if (body.assetKind !== executionPlan.assetKind) {
        gateFailures.push(`assetKind must be ${executionPlan.assetKind} for assetType ${executionPlan.assetType}`);
      }
      const runwayApiKey = String(body.runwayTransientKey || config.generator?.video?.runway?.apiKey || process.env.RUNWAY_API_KEY || "").trim();
      const requestCanUseTransientExecution = process.env.NODE_ENV === "staging"
        && envEnabled
        && transientKeyProvided
        && Boolean(body.operatorApproval)
        && body.safetyLevel === "internal_review"
        && Boolean(String(body.sourceAssetRef || "").trim());
      const executionEnv = {
        ...process.env,
        RUNWAY_API_KEY: runwayApiKey,
        RUNWAY_DRY_RUN_EXECUTE: requestCanUseTransientExecution && transientExecuteRequested
          ? "true"
          : process.env.RUNWAY_DRY_RUN_EXECUTE,
        RUNWAY_ALLOW_PROVIDER_EXECUTION: requestCanUseTransientExecution && transientProviderExecutionRequested
          ? "true"
          : process.env.RUNWAY_ALLOW_PROVIDER_EXECUTION,
      };
      const executionConfig = {
        ...config,
        adminAuth: {
          ...config.adminAuth,
          mode: "enforce",
        },
        generator: {
          ...config.generator,
          video: {
            ...config.generator?.video,
            runway: {
              ...config.generator?.video?.runway,
              apiKey: runwayApiKey,
              videoModel: config.generator?.video?.runway?.videoModel || "gen4_turbo",
              videoGeneratePath: config.generator?.video?.runway?.videoGeneratePath || "/v1/image_to_video",
            },
          },
        },
      };
      const providerGates = canExecuteRunwayProvider(executionConfig, executionEnv, req.adminAccess || {});
      const dryRunJob = createDryRunJob({
        spiritkinId: executionPlan.spiritkinId,
        targetId: executionPlan.targetId,
        assetKind: executionPlan.assetKind,
        promptIntent: executionPlan.promptIntent,
        styleProfile: executionPlan.styleProfile,
        safetyLevel: executionPlan.safetyLevel,
        sourceAssetRef: executionPlan.sourceAssetRef,
        sourceAssets: [executionPlan.sourceAssetRef],
        sourceAssetType: executionPlan.sourceAssetType,
        durationSec: executionPlan.generationControls.durationSec,
        aspectRatio: executionPlan.generationControls.aspectRatio,
        requestedBy: req.adminAccess?.source || "admin_media_spiritkin_motion_state_execute",
      });
      const providerTarget = resolveRunwayGenerationTarget(dryRunJob, executionConfig.generator?.video?.runway || {});
      const apiPayloadPreview = buildRunwayApiPayload({
        ...dryRunJob,
        _runwayConfig: executionConfig.generator?.video?.runway || {},
      });
      if (providerTarget.providerMode === "text_to_image") {
        gateFailures.push("text_to_image is not allowed for Spiritkin motion-state execution");
      }
      const promptTextLength = String(apiPayloadPreview.promptText || "").length;
      if (providerTarget.providerMode === "image_to_video" && promptTextLength > 1000) {
        return reply.code(400).send({
          ok: false,
          route,
          error: "PROMPT_TOO_LONG",
          message: "Runway image_to_video promptText must be 1000 characters or fewer.",
          promptTextLength,
          maxPromptTextLength: 1000,
          noProviderCall: true,
          externalApiCall: false,
          providerTarget,
          payloadPreview: apiPayloadPreview,
          generationControls: executionPlan.generationControls,
          mediaAssetRecord: executionPlan.mediaAssetRecord,
          premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
          noPromotionPerformed: true,
          noManifestUpdatePerformed: true,
          noActiveWritePerformed: true,
        });
      }
      const allGates = {
        ok: gateFailures.length === 0 && providerGates.ok,
        missingGates: [...gateFailures, ...providerGates.missingGates],
      };
      const baseResponse = {
        ok: true,
        route,
        stagingBypassUsed: Boolean(req.spiritkinMotionStateStagingBypassUsed),
        operatorApprovalRequired: true,
        operatorApprovalReceived: Boolean(body.operatorApproval),
        externalApiCall: false,
        executed: false,
        transientExecuteRequested,
        transientProviderExecutionRequested,
        transientKeyProvided,
        executionGates: allGates,
        providerTarget,
        apiPayloadPreview,
        generationControls: executionPlan.generationControls,
        mediaAssetRecord: executionPlan.mediaAssetRecord,
        outputLifecycleState: "review_required",
        commandCenterMetadata: executionPlan.commandCenterMetadata,
        premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      };

      if (!allGates.ok) return baseResponse;

      if (isTrueEnv(process.env.RUNWAY_SPIRITKIN_MOTION_EXECUTE_MOCK) && String(req.headers["x-runway-mock-provider-400"] || "").toLowerCase() === "true") {
        const mockResponseBody = {
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
        };
        await submitRunwayJob({
          ...dryRunJob,
          lifecycleState: "queued",
          _runwayConfig: executionConfig.generator?.video?.runway || {},
          fetchImpl: async () => ({
            ok: false,
            status: 400,
            text: async () => JSON.stringify(mockResponseBody),
          }),
        });
      }

      if (isTrueEnv(process.env.RUNWAY_SPIRITKIN_MOTION_EXECUTE_MOCK)) {
        const mockProviderJobId = `mock-${executionPlan.spiritkinId}-${String(executionPlan.assetType || "motion").replace(/_/g, "-")}-task`;
        return {
          ...baseResponse,
          mock: true,
          providerResult: {
            provider: "runway",
            providerJobId: mockProviderJobId,
            status: "queued",
            rawStatus: "mock_submitted",
          },
          mediaAssetRecord: {
            ...executionPlan.mediaAssetRecord,
            providerJobId: mockProviderJobId,
            lifecycleState: "review_required",
            reviewStatus: "pending",
            outputUrls: [],
          },
        };
      }

      const providerResult = await submitRunwayJob({
        ...dryRunJob,
        lifecycleState: "queued",
        _runwayConfig: executionConfig.generator?.video?.runway || {},
      });
      fastify.log?.warn?.({
        route,
        stagingBypassUsed: Boolean(req.spiritkinMotionStateStagingBypassUsed),
        spiritkinId: executionPlan.spiritkinId,
        assetType: executionPlan.assetType,
        assetKind: executionPlan.assetKind,
        safetyLevel: body.safetyLevel,
        externalApiCall: true,
      }, "[runway] Spiritkin motion state execution");
      return {
        ...baseResponse,
        externalApiCall: true,
        executed: true,
        providerResult,
        mediaAssetRecord: {
          ...executionPlan.mediaAssetRecord,
          providerJobId: providerResult.providerJobId,
          lifecycleState: "review_required",
          reviewStatus: "pending",
          outputUrls: [],
        },
        commandCenterMetadata: {
          ...executionPlan.commandCenterMetadata,
          generationStatus: providerResult.status || "queued",
          reviewStatus: "pending",
        },
      };
    } catch (err) {
      const code = err.httpCode ?? 500;
      const providerDetails = {
        providerHttpStatus: err.providerHttpStatus ?? err.detail?.providerHttpStatus ?? null,
        providerBodyIssues: err.providerBodyIssues ?? err.detail?.providerBodyIssues ?? [],
        providerDocUrl: err.providerDocUrl ?? err.detail?.providerDocUrl ?? null,
        providerBodyKeys: err.providerBodyKeys ?? err.detail?.providerBodyKeys ?? [],
        providerErrorMessage: err.providerErrorMessage ?? err.detail?.providerErrorMessage ?? null,
        providerErrorCode: err.providerErrorCode ?? err.detail?.providerErrorCode ?? null,
        endpointPath: err.endpointPath ?? err.detail?.endpointPath ?? null,
        model: err.model ?? err.detail?.model ?? null,
        providerMode: err.providerMode ?? err.detail?.providerMode ?? null,
        payloadPreview: err.payloadPreview ?? err.detail?.payloadPreview ?? null,
      };
      const hasProviderDetails = Boolean(providerDetails.providerHttpStatus);
      return reply.code(code).send({
        ok: false,
        route,
        error: err.code ?? "SPIRITKIN_MOTION_STATE_EXECUTE_ERROR",
        message: err.message,
        details: err.detail || {},
        ...(hasProviderDetails ? providerDetails : {}),
        externalApiCall: hasProviderDetails,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      });
    }
  });

  fastify.post("/admin/media/source-reference-plan", {
    preHandler: requireMediaPlanningAccess,
    schema: sourceReferencePlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => {
    const sourceReference = buildSourceMediaReference(req.body);
    const validation = validateSourceMediaReference(sourceReference);
    if (!validation.ok) {
      const error = new Error("Invalid source media reference.");
      error.httpCode = 400;
      error.code = "SOURCE_MEDIA_REFERENCE_INVALID";
      error.detail = { errors: validation.errors };
      throw error;
    }
    return {
      sourceReference,
      sourceRegistryMode: "reference_only",
      noUploadStorageImplemented: true,
    };
  }, req, reply));

  fastify.get("/admin/media/spiritgate-source-summary", {
    preHandler: requireMediaPlanningAccess,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    spiritGateSource: resolveExistingSpiritGateSource({
      origin: requestPublicOrigin(req),
    }),
    noGenerationPerformed: true,
  }), req, reply));

  fastify.post("/admin/media/spiritgate-enhancement-plan-from-current-source", {
    preHandler: requireMediaPlanningAccess,
    schema: {
      body: {
        type: "object",
        properties: {
          promptIntent: { type: "string", nullable: true },
          styleProfile: { type: "string", nullable: true },
          safetyLevel: { type: "string", nullable: true },
        },
      },
    },
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    spiritGateEnhancementPlan: createSpiritGateEnhancementPlanFromCurrentSource({
      ...req.body,
      origin: requestPublicOrigin(req),
    }),
  }), req, reply));

  fastify.post("/admin/media/spiritgate-segment-plan", {
    preHandler: requireAdminAccess,
    schema: spiritGateSegmentPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    spiritGateSegmentPlan: createSpiritGateSegmentPlan(req.body),
  }), req, reply));

  async function requireSpiritGateEnhancementAccess(req, reply) {
    if (canUseSpiritGateEnhancementStagingBypass(req.body, process.env)) {
      req.spiritGateStagingBypassUsed = true;
      req.adminAccess = {
        allowed: true,
        bypassed: true,
        mode: "staging-spiritgate-enhancement-bypass",
        source: "staging-spiritgate-enhancement-bypass",
      };
      return;
    }

    req.spiritGateStagingBypassUsed = false;
    return requireAdminAccess(req, reply);
  }

  fastify.post("/admin/media/spiritgate-enhancement-execute", {
    preHandler: requireSpiritGateEnhancementAccess,
    schema: spiritGateEnhancementExecuteSchema,
  }, async (req, reply) => {
    const route = req.routeOptions?.url || req.url;
    const body = req.body || {};
    if (process.env.NODE_ENV !== "staging") {
      return reply.code(404).send({
        ok: false,
        route,
        error: "SPIRITGATE_ENHANCEMENT_EXECUTE_UNAVAILABLE",
        message: "SpiritGate enhancement execution is available only in staging operator mode.",
        externalApiCall: false,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      });
    }
    const gateFailures = [];
    if (!isTrueEnv(process.env.RUNWAY_STAGING_TEST_BYPASS)) gateFailures.push("RUNWAY_STAGING_TEST_BYPASS=true is required");
    if (!body.operatorApproval) gateFailures.push("operatorApproval=true is required");
    if (!["spiritgate", "test-spiritgate"].includes(String(body.targetId || "").trim())) gateFailures.push("targetId must be spiritgate or test-spiritgate");
    if (body.safetyLevel !== "internal_review") gateFailures.push("safetyLevel must be internal_review");
    if (!String(body.sourceAssetRef || "").trim()) gateFailures.push("sourceAssetRef is required");

    try {
      const transientExecuteRequested = isTrueEnv(req.headers["x-runway-transient-execute"]);
      const transientProviderExecutionRequested = isTrueEnv(req.headers["x-runway-transient-provider-execution"]);
      const executionPlan = createSpiritGateEnhancementExecutionPlan({
        ...body,
        requestedBy: req.adminAccess?.source || "admin_media_spiritgate_execute",
      });
      const runwayApiKey = String(body.runwayTransientKey || config.generator?.video?.runway?.apiKey || process.env.RUNWAY_API_KEY || "").trim();
      const transientKeyProvided = Boolean(String(body.runwayTransientKey || "").trim());
      const requestCanUseTransientExecution = process.env.NODE_ENV === "staging"
        && isTrueEnv(process.env.RUNWAY_STAGING_TEST_BYPASS)
        && transientKeyProvided
        && Boolean(body.operatorApproval)
        && ["spiritgate", "test-spiritgate"].includes(String(body.targetId || "").trim())
        && body.safetyLevel === "internal_review"
        && Boolean(String(body.sourceAssetRef || "").trim());
      const executionEnv = {
        ...process.env,
        RUNWAY_API_KEY: runwayApiKey,
        RUNWAY_DRY_RUN_EXECUTE: requestCanUseTransientExecution && transientExecuteRequested
          ? "true"
          : process.env.RUNWAY_DRY_RUN_EXECUTE,
        RUNWAY_ALLOW_PROVIDER_EXECUTION: requestCanUseTransientExecution && transientProviderExecutionRequested
          ? "true"
          : process.env.RUNWAY_ALLOW_PROVIDER_EXECUTION,
      };
      const executionConfig = {
        ...config,
        adminAuth: {
          ...config.adminAuth,
          mode: "enforce",
        },
        generator: {
          ...config.generator,
          video: {
            ...config.generator?.video,
            runway: {
              ...config.generator?.video?.runway,
              apiKey: runwayApiKey,
              videoToVideoModel: config.generator?.video?.runway?.videoToVideoModel || "gen4_aleph",
              videoToVideoGeneratePath: config.generator?.video?.runway?.videoToVideoGeneratePath || "/v1/video_to_video",
            },
          },
        },
      };
      const providerGates = canExecuteRunwayProvider(executionConfig, executionEnv, req.adminAccess || {});
      const dryRunJob = createDryRunJob({
        targetId: body.targetId,
        assetKind: "spiritgate_video",
        promptIntent: body.promptIntent,
        styleProfile: body.styleProfile,
        safetyLevel: body.safetyLevel,
        sourceAssetRef: body.sourceAssetRef,
        sourceAssets: [body.sourceAssetRef],
        sourceAssetType: body.sourceAssetType,
        requestedBy: req.adminAccess?.source || "admin_media_spiritgate_execute",
      });
      const providerTarget = resolveRunwayGenerationTarget(dryRunJob, executionConfig.generator?.video?.runway || {});
      const apiPayloadPreview = buildRunwayApiPayload({
        ...dryRunJob,
        _runwayConfig: executionConfig.generator?.video?.runway || {},
      });
      const allGates = {
        ok: gateFailures.length === 0 && providerGates.ok,
        missingGates: [...gateFailures, ...providerGates.missingGates],
      };

      const baseResponse = {
        ok: true,
        route,
        stagingBypassUsed: Boolean(req.spiritGateStagingBypassUsed),
        operatorApprovalRequired: true,
        operatorApprovalReceived: Boolean(body.operatorApproval),
        sourceConceptMustBePreserved: true,
        originalReplacementAllowed: false,
        enhancementOnly: true,
        externalApiCall: false,
        executed: false,
        transientExecuteRequested,
        transientProviderExecutionRequested,
        transientKeyProvided,
        executionGates: allGates,
        providerTarget,
        apiPayloadPreview,
        mediaAssetRecord: executionPlan.assetRecord,
        outputLifecycleState: "review_required",
        commandCenterMetadata: executionPlan.commandCenterMetadata,
        premiumMemberGeneration: PREMIUM_MEMBER_GENERATION_BOUNDARY,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      };

      if (!allGates.ok) {
        return baseResponse;
      }

      if (isTrueEnv(process.env.RUNWAY_SPIRITGATE_EXECUTE_MOCK)) {
        return {
          ...baseResponse,
          externalApiCall: false,
          executed: false,
          mock: true,
          providerResult: {
            provider: "runway",
            providerJobId: "mock-spiritgate-video-task",
            status: "queued",
            rawStatus: "mock_submitted",
          },
          mediaAssetRecord: {
            ...executionPlan.assetRecord,
            providerJobId: "mock-spiritgate-video-task",
            lifecycleState: "review_required",
            reviewStatus: "pending",
          },
        };
      }

      const providerResult = await submitRunwayJob({
        ...dryRunJob,
        lifecycleState: "queued",
        _runwayConfig: executionConfig.generator?.video?.runway || {},
      });
      fastify.log?.warn?.({
        route,
        stagingBypassUsed: Boolean(req.spiritGateStagingBypassUsed),
        targetId: body.targetId,
        assetKind: "spiritgate_video",
        safetyLevel: body.safetyLevel,
        externalApiCall: true,
      }, "[runway] SpiritGate enhancement execution");
      return {
        ...baseResponse,
        externalApiCall: true,
        executed: true,
        providerResult,
        mediaAssetRecord: {
          ...executionPlan.assetRecord,
          providerJobId: providerResult.providerJobId,
          lifecycleState: "review_required",
          reviewStatus: "pending",
        },
        commandCenterMetadata: {
          ...executionPlan.commandCenterMetadata,
          generationStatus: providerResult.status || "queued",
          reviewStatus: "pending",
        },
      };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({
        ok: false,
        route,
        error: err.code ?? "SPIRITGATE_ENHANCEMENT_EXECUTE_ERROR",
        message: err.message,
        details: err.detail || {},
        externalApiCall: false,
        noPromotionPerformed: true,
        noManifestUpdatePerformed: true,
        noActiveWritePerformed: true,
      });
    }
  });

  fastify.get("/admin/media/catalog-summary", {
    preHandler: requireMediaPlanningAccess,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    catalogSummary: getMediaCatalogSummary(),
  }), req, reply));

  async function handleGeneratedAssetPromotionPlan(req, reply) {
    try {
      const promotionPlan = createPromotionPlan({
        ...req.body,
        requestedBy: req.adminAccess?.source || "admin_promotion_plan",
      });
      return {
        ok: true,
        route: req.routeOptions?.url || req.url,
        operatorApprovalRequired: true,
        noFileWrites: true,
        noManifestUpdates: true,
        promotionPlan,
      };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({
        ok: false,
        error: err.code ?? "GENERATED_ASSET_PROMOTION_PLAN_ERROR",
        message: err.message,
        details: err.detail || {},
      });
    }
  }

  const generatedAssetPromotionPlanSchema = {
    body: {
      type: "object",
      required: ["sourcePath", "assetKind"],
      properties: {
        id: { type: "string", nullable: true },
        assetId: { type: "string", nullable: true },
        provider: { type: "string", nullable: true },
        providerJobId: { type: "string", nullable: true },
        lifecycleState: { type: "string", nullable: true },
        sourcePath: { type: "string", minLength: 1 },
        artifactPath: { type: "string", nullable: true },
        sourceKind: { type: "string", nullable: true },
        artifactFileName: { type: "string", nullable: true },
        metadataFileName: { type: "string", nullable: true },
        assetKind: { type: "string", minLength: 1 },
        spiritkinId: { type: "string", nullable: true },
        spiritkinName: { type: "string", nullable: true },
        targetId: { type: "string", nullable: true },
        realmId: { type: "string", nullable: true },
        gameType: { type: "string", nullable: true },
        themeId: { type: "string", nullable: true },
        versionTag: { type: "string", nullable: true },
        reviewNotes: { type: "string", nullable: true },
      },
    },
  };

  fastify.post("/admin/generated-assets/promotion-plan", {
    preHandler: requireAdminAccess,
    schema: generatedAssetPromotionPlanSchema,
  }, handleGeneratedAssetPromotionPlan);

  fastify.post("/v1/admin/generated-assets/promotion-plan", {
    preHandler: requireAdminAccess,
    schema: generatedAssetPromotionPlanSchema,
  }, handleGeneratedAssetPromotionPlan);

  fastify.post("/v1/admin/generator/image", {
    preHandler: requireAdminAccess,
    schema: {
      body: {
        type: "object",
        required: ["spiritkinName"],
        properties: {
          spiritkinName: { type: "string", minLength: 1 },
          ownerType: { type: "string", nullable: true },
          ownerId: { type: "string", nullable: true },
          slotName: { type: "string", nullable: true },
          archetypeClass: { type: "string", nullable: true },
          colors: { type: "array", items: { type: "string" }, nullable: true },
          elementTheme: { type: "string", nullable: true },
          moodPersonality: { type: "string", nullable: true },
          pose: { type: "string", nullable: true },
          environment: { type: "string", nullable: true },
          renderStyle: { type: "string", nullable: true },
          rarityTier: { type: "string", nullable: true },
          styleProfile: { type: "string", nullable: true },
          seed: { type: "number", nullable: true },
          width: { type: "number", nullable: true },
          height: { type: "number", nullable: true },
          guidanceScale: { type: "number", nullable: true },
          steps: { type: "number", nullable: true },
          model: { type: "string", nullable: true },
          loraHooks: { type: "array", items: { type: "string" }, nullable: true },
          execute: { type: "boolean", nullable: true },
          targetAudience: { type: "string", nullable: true },
          entitlementGate: { type: "string", nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    if (!spiritkinGeneratorService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Spiritkin generator service unavailable." });
    }
    try {
      const result = await spiritkinGeneratorService.createImageJob({
        ...req.body,
        requestedBy: req.adminAccess?.source || "command_center",
      });
      return { ok: true, ...result };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({ ok: false, error: err.code ?? "GENERATOR_IMAGE_ERROR", message: err.message });
    }
  });

  fastify.post("/v1/admin/generator/video", {
    preHandler: requireAdminAccess,
    schema: {
      body: {
        type: "object",
        required: ["spiritkinName"],
        properties: {
          spiritkinName: { type: "string", minLength: 1 },
          ownerType: { type: "string", nullable: true },
          ownerId: { type: "string", nullable: true },
          slotName: { type: "string", nullable: true },
          trailerType: { type: "string", nullable: true },
          durationSec: { type: "number", nullable: true },
          shotStyle: { type: "string", nullable: true },
          scriptVoiceLine: { type: "string", nullable: true },
          musicMood: { type: "string", nullable: true },
          attachedAssets: { type: "array", items: { type: "string" }, nullable: true },
          aspectRatio: { type: "string", nullable: true },
          seed: { type: "number", nullable: true },
          model: { type: "string", nullable: true },
          execute: { type: "boolean", nullable: true },
          targetAudience: { type: "string", nullable: true },
          entitlementGate: { type: "string", nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    if (!spiritkinGeneratorService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Spiritkin generator service unavailable." });
    }
    try {
      const result = await spiritkinGeneratorService.createVideoJob({
        ...req.body,
        requestedBy: req.adminAccess?.source || "command_center",
      });
      return { ok: true, ...result };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({ ok: false, error: err.code ?? "GENERATOR_VIDEO_ERROR", message: err.message });
    }
  });

  fastify.post("/v1/admin/generator/jobs/:jobId/execute", {
    preHandler: requireAdminAccess,
    schema: {
      params: {
        type: "object",
        required: ["jobId"],
        properties: {
          jobId: { type: "string", minLength: 1 },
        },
      },
      body: {
        type: "object",
        properties: {
          operation: { type: "string", nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    if (!spiritkinGeneratorService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Spiritkin generator service unavailable." });
    }
    try {
      const result = await spiritkinGeneratorService.executeJob({
        jobId: req.params.jobId,
        operation: req.body?.operation ?? null,
        requestedBy: req.adminAccess?.source || "command_center",
      });
      return { ok: true, ...result };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({ ok: false, error: err.code ?? "GENERATOR_EXECUTE_ERROR", message: err.message });
    }
  });

  fastify.post("/v1/admin/generator/jobs/:jobId/retry", {
    preHandler: requireAdminAccess,
    schema: {
      params: {
        type: "object",
        required: ["jobId"],
        properties: {
          jobId: { type: "string", minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    if (!spiritkinGeneratorService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Spiritkin generator service unavailable." });
    }
    try {
      const result = await spiritkinGeneratorService.retryJob({
        jobId: req.params.jobId,
        requestedBy: req.adminAccess?.source || "command_center",
      });
      return { ok: true, ...result };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({ ok: false, error: err.code ?? "GENERATOR_RETRY_ERROR", message: err.message });
    }
  });

  fastify.post("/v1/admin/generator/review", {
    preHandler: requireAdminAccess,
    schema: {
      body: {
        type: "object",
        required: ["outputId", "decision"],
        properties: {
          outputId: { type: "string", minLength: 1 },
          decision: { type: "string", minLength: 1 },
          note: { type: "string", nullable: true },
          markCanonical: { type: "boolean", nullable: true },
          attachToRuntime: { type: "boolean", nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    if (!spiritkinGeneratorService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Spiritkin generator service unavailable." });
    }
    try {
      const result = await spiritkinGeneratorService.reviewOutput({
        ...req.body,
        reviewer: req.adminAccess?.source || "command_center",
      });
      return { ok: true, ...result };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({ ok: false, error: err.code ?? "GENERATOR_REVIEW_ERROR", message: err.message });
    }
  });
}
