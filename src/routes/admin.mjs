/**
 * SpiritCore — Admin & Command Center Routes
 * 
 * GET /v1/admin/conversations/recent  — list recent conversations across all users
 * GET /v1/admin/messages/:conversationId — fetch transcript for a conversation
 * GET /v1/admin/stats                 — global system stats
 */
import { config } from "../config.mjs";
import {
  checkRunwayOrganizationAuth,
  checkRunwayTaskStatus,
  createDryRunJob,
  createExecutionSpikeJob,
  RUNWAY_SUPPORTED_ASSET_KINDS,
} from "../services/runwayProvider.mjs";
import { createPromotionPlan } from "../services/generatedAssetPipeline.mjs";
import {
  buildGenerationTemplate,
  checkMediaRequirements,
  createMediaAssetPlan,
  createMediaPromotionPlan,
  createMediaReviewPlan,
  createSpiritGateEnhancementPlan,
  getMediaCatalogSummary,
  SPIRITCORE_MEDIA_ASSET_KINDS,
  SPIRITCORE_MEDIA_REQUIREMENT_PROFILES,
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

function readRunwayTransientHeaders(body = {}, headers = {}, env = process.env) {
  const transientKey = readRunwayTransientCredential(body, headers, env);
  return {
    apiKey: transientKey.apiKey,
    keySource: transientKey.keySource,
    executeRequested: isTrueEnv(headers["x-runway-transient-execute"]),
    providerExecutionRequested: isTrueEnv(headers["x-runway-transient-provider-execution"]),
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
    preHandler: requireAdminAccess,
    schema: mediaGenerationTemplateSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    generationTemplate: buildGenerationTemplate(req.body),
  }), req, reply));

  fastify.post("/admin/media/review-plan", {
    preHandler: requireAdminAccess,
    schema: mediaAssetPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    reviewPlan: createMediaReviewPlan(req.body),
  }), req, reply));

  fastify.post("/admin/media/promotion-plan", {
    preHandler: requireAdminAccess,
    schema: mediaAssetPlanSchema,
  }, async (req, reply) => mediaRouteResult(req.routeOptions?.url || req.url, () => ({
    promotionPlan: createMediaPromotionPlan(req.body),
  }), req, reply));

  fastify.post("/admin/media/spiritgate-enhancement-plan", {
    preHandler: requireAdminAccess,
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

  fastify.get("/admin/media/catalog-summary", {
    preHandler: requireAdminAccess,
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
