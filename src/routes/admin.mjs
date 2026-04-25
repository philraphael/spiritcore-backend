/**
 * SpiritCore — Admin & Command Center Routes
 * 
 * GET /v1/admin/conversations/recent  — list recent conversations across all users
 * GET /v1/admin/messages/:conversationId — fetch transcript for a conversation
 * GET /v1/admin/stats                 — global system stats
 */
import { createDryRunJob, RUNWAY_SUPPORTED_ASSET_KINDS } from "../services/runwayProvider.mjs";

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

  fastify.post("/admin/runway/dry-run", {
    preHandler: requireAdminAccess,
    schema: runwayDryRunSchema,
  }, handleRunwayDryRun);

  fastify.post("/v1/admin/runway/dry-run", {
    preHandler: requireAdminAccess,
    schema: runwayDryRunSchema,
  }, handleRunwayDryRun);

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
