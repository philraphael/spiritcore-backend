import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Legacy Model Plane adapters (keep v0 behavior)
import { generate as templateGenerate } from "./adapters/templateAdapter.mjs";
import { generate as localGenerate } from "./adapters/localAdapter.mjs";

// Runtime engine (legacy shim — kept for v0 compatibility)
import { RuntimeController, eventBus } from "./runtime/index.mjs";

// ── Phase D: Authoritative src DI container and v1 routes ──────────────────
import { buildContainer }        from "./src/container.mjs";
import { interactRoutes }        from "./src/routes/interact.mjs";
import { spiritkinRoutes }       from "./src/routes/spiritkins.mjs";
import { conversationRoutes }    from "./src/routes/conversations.mjs";
// ── Phase F: Production hardening ───────────────────────────────────────────
import { validateConfig, config } from "./src/config.mjs";
import { getPinoOptions, setAppLogger } from "./src/logger.mjs";
import { registerRateLimiter }    from "./src/middleware/rateLimiter.mjs";
import { healthRoutes }           from "./src/routes/health.mjs";

// Fail fast on missing required env vars
try { validateConfig(); } catch (err) { console.error("[SpiritCore] Config error:", err.message); process.exit(1); }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPERATOR_CONSOLE_DIR = path.join(__dirname, "operator-console");
const USER_APP_DIR = path.join(__dirname, "spiritkins-app");

const PORT    = config.port;
const USE_LLM = String(process.env.USE_LLM || "false").toLowerCase() === "true";
const DEBUG   = String(process.env.DEBUG   || "false").toLowerCase() === "true";

// Fastify app with structured Pino logger
const app = Fastify({
  logger:     getPinoOptions(config.log),
  trustProxy: true,
  genReqId:   () => randomUUID(),
});

await app.register(cors, { origin: true });
// Rate limiter registered via Phase F module (replaces inline registration)
await registerRateLimiter(app);

// Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  app.log.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Decorate so handlers can access
app.decorate("supabase", supabase);

// Utilities
function nowIso() { return new Date().toISOString(); }

function requireFields(obj, fields) {
  const missing = fields.filter((f) => obj?.[f] === undefined || obj?.[f] === null || obj?.[f] === "");
  return missing.length ? missing : null;
}

function safeLimit(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function sendError(reply, httpStatus, code, message, details, request_id) {
  return reply.code(httpStatus).send({
    ok: false,
    error: {
      code,
      message,
      details: details || {},
      request_id: request_id || null,
      time: nowIso()
    }
  });
}

// Request id + basic ops logging
app.addHook("onRequest", async (req, reply) => {
  req.request_id = req.headers["x-request-id"] || randomUUID();
  req.spiritcore_client = req.headers["x-spiritcore-client"] || "unknown";
  req.spiritcore_version = req.headers["x-spiritcore-version"] || "unknown";
  req._start = Date.now();
});

app.addHook("onResponse", async (req, reply) => {
  const duration_ms = Date.now() - (req._start || Date.now());
  try {
    app.log.info({
      time: nowIso(),
      request_id: req.request_id,
      method: req.method,
      path: req.url,
      status: reply.statusCode,
      duration_ms,
      client: req.spiritcore_client,
      client_version: req.spiritcore_version
    }, "request");
  } catch {}
});

// Runtime controller
const runtime = new RuntimeController(supabase, { useLLM: USE_LLM, debug: DEBUG });
runtime.start();

if (DEBUG) {
  eventBus.subscribe("heartbeat", (p) => {
    app.log.info({ time: p?.time }, "[runtime heartbeat]");
  });
}

// Root
app.get("/", async (req, reply) => {
  return {
    ok: true,
    name: "SpiritCore",
    time: nowIso(),
    request_id: req.request_id
  };
});

app.get("/operator", async (_req, reply) => {
  const html = await readFile(path.join(OPERATOR_CONSOLE_DIR, "index.html"), "utf8");
  return reply.type("text/html; charset=utf-8").send(html);
});

app.get("/operator/:asset", async (req, reply) => {
  const { asset } = req.params;
  if (!["app.js", "styles.css"].includes(asset)) {
    return reply.code(404).send({ ok: false, error: "Not found" });
  }

  const filePath = path.join(OPERATOR_CONSOLE_DIR, asset);
  const content = await readFile(filePath, "utf8");
  const mime = asset.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8";
  return reply.type(mime).send(content);
});

app.get("/app", async (_req, reply) => {
  const html = await readFile(path.join(USER_APP_DIR, "index.html"), "utf8");
  return reply.type("text/html; charset=utf-8").send(html);
});

app.get("/app/:asset", async (req, reply) => {
  const { asset } = req.params;
  if (!["app.js", "styles.css"].includes(asset)) {
    return reply.code(404).send({ ok: false, error: "Not found" });
  }

  const filePath = path.join(USER_APP_DIR, asset);
  const content = await readFile(filePath, "utf8");
  const mime = asset.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8";
  return reply.type(mime).send(content);
});

/* ------------------------ Runtime endpoints ------------------------ */

app.post("/runtime/interaction/:userId", async (req, reply) => {
  try {
    const urlUserId = req.params.userId;

    const message = String(req.body?.message ?? "");
    const conversation_id = req.body?.conversation_id ?? null;

    let spiritkin_id = req.body?.spiritkin_id ?? null;
    let resolvedUserId = urlUserId;

    if (conversation_id) {
      const ctx = await runtime.resolveContextByConversation(conversation_id);
      resolvedUserId = ctx.user_id;
      spiritkin_id = ctx.spiritkin_id ?? spiritkin_id;
    }

    if (!runtime.instances.has(resolvedUserId)) {
      runtime.createSpirit(resolvedUserId, { voiceTone: "Lyra", traits: ["warm"] }); // LEGACY SHIM — v0 compat only
    }

    const onResponse = (payload) => {
      if (payload?.userId !== resolvedUserId) return;
      eventBus.unsubscribe("response", onResponse);

      reply.send({
        ok: true,
        userId: payload.userId,
        response: payload.response,
        spiritkin_id: payload.spiritkin_id ?? null,
        conversation_id: payload.conversation_id ?? conversation_id ?? null,
        emotion: payload.emotion ?? null,
        context: payload.context ?? null,
        request_id: req.request_id,
        time: nowIso()
      });
    };

    eventBus.subscribe("response", onResponse);

    eventBus.emitEvent("interaction", {
      userId: resolvedUserId,
      message,
      spiritkin_id,
      conversation_id,
      request_id: req.request_id
    });

    setTimeout(() => {
      eventBus.unsubscribe("response", onResponse);
      if (!reply.sent) {
        sendError(reply, 504, "TIMEOUT", "Timed out waiting for response", {}, req.request_id);
      }
    }, 3000);
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.post("/runtime/spirit/:userId", async (req, reply) => {
  try {
    const userId = req.params.userId;
    const profile = req.body?.profile || { voiceTone: "Lyra", traits: ["warm"] }; // LEGACY SHIM — v0 compat only

    const spirit = runtime.createSpirit(userId, profile);
    return { ok: true, userId, spirit: spirit?.profile ?? profile, request_id: req.request_id, time: nowIso() };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.post("/runtime/conversation/bootstrap", async (req, reply) => {
  try {
    // BootstrapEngine exists in your runtime folder but your server used runtime.resolveContextByConversation,
    // so this endpoint is currently a lightweight passthrough that can be expanded later.
    const conversation_id = req.body?.conversation_id ?? null;
    if (!conversation_id) return sendError(reply, 400, "BAD_REQUEST", "conversation_id required", {}, req.request_id);

    const ctx = await runtime.resolveContextByConversation(conversation_id);
    return { ok: true, context: ctx, request_id: req.request_id, time: nowIso() };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.get("/runtime/context/:conversation_id", async (req, reply) => {
  try {
    const conversation_id = req.params.conversation_id;
    const ctx = await runtime.resolveContextByConversation(conversation_id);
    return { ok: true, context: ctx, request_id: req.request_id, time: nowIso() };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.get("/runtime/episodes/:conversation_id", async (req, reply) => {
  try {
    const conversation_id = req.params.conversation_id;
    // EpisodeEngine is inside runtime; simplest: query the same table EpisodeEngine uses.
    const { data, error } = await supabase
      .from("spirit_episodes")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) throw error;
    return { ok: true, conversation_id, episodes: data || [], request_id: req.request_id, time: nowIso() };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

/* ------------------------ v0 endpoints (legacy API) ------------------------ */

app.post("/v0/message", async (req, reply) => {
  try {
    const missing = requireFields(req.body, ["conversation_id", "content"]);
    if (missing) return sendError(reply, 400, "BAD_REQUEST", `Missing fields: ${missing.join(", ")}`, {}, req.request_id);

    const conversation_id = req.body.conversation_id;
    const content = req.body.content;
    const mood = req.body.mood || { mood: "neutral", tone: "warm" };
    const options = req.body.options || {};
    const useLLM = typeof req.body.useLLM === "boolean" ? req.body.useLLM : USE_LLM;

    const engine = useLLM ? localGenerate : templateGenerate;
    const result = await engine({ conversation_id, content, mood, options });

    return {
      ok: true,
      conversation_id,
      response: result?.text ?? result,
      meta: result?.meta ?? {},
      request_id: req.request_id,
      time: nowIso()
    };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.get("/v0/health", async (req, reply) => {
  try {
    // Simple DB ping
    const { error } = await supabase.from("conversations").select("id").limit(1);
    return {
      ok: true,
      db_ok: !error,
      time: nowIso(),
      request_id: req.request_id
    };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.post("/v0/conversations", async (req, reply) => {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .insert([{ title: req.body?.title || "New Conversation" }])
      .select("id, title, created_at")
      .single();

    if (error) throw error;

    return { ok: true, conversation: data, request_id: req.request_id, time: nowIso() };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.get("/v0/world_state/:conversation_id", async (req, reply) => {
  try {
    const conversation_id = req.params.conversation_id;

    const { data, error } = await supabase
      .from("world_state")
      .select("*")
      .eq("conversation_id", conversation_id)
      .maybeSingle();

    if (error) throw error;

    return { ok: true, conversation_id, world_state: data || null, request_id: req.request_id, time: nowIso() };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.post("/v0/world_state/:conversation_id", async (req, reply) => {
  try {
    const conversation_id = req.params.conversation_id;
    const state_json = req.body?.state_json ?? {};

    const { data, error } = await supabase
      .from("world_state")
      .upsert([{ conversation_id, state_json }], { onConflict: "conversation_id" })
      .select("*")
      .single();

    if (error) throw error;

    return { ok: true, conversation_id, world_state: data, request_id: req.request_id, time: nowIso() };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.get("/v0/memory/list/:conversation_id", async (req, reply) => {
  try {
    const conversation_id = req.params.conversation_id;
    const limit = safeLimit(req.query?.limit, 1, 50, 10);

    const { data, error } = await supabase
      .from("spirit_memory")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { ok: true, conversation_id, items: data || [], request_id: req.request_id, time: nowIso() };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

app.post("/v0/memory/pin", async (req, reply) => {
  try {
    const missing = requireFields(req.body, ["memory_id"]);
    if (missing) return sendError(reply, 400, "BAD_REQUEST", `Missing fields: ${missing.join(", ")}`, {}, req.request_id);

    const memory_id = req.body.memory_id;

    const { data, error } = await supabase
      .from("spirit_memory")
      .update({ pinned: true })
      .eq("id", memory_id)
      .select("*")
      .single();

    if (error) throw error;

    return { ok: true, pinned: data, request_id: req.request_id, time: nowIso() };
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

// ── Phase D+F: Build DI container and register all routes ──────────────────
let container;
try {
  container = buildContainer();
  app.log.info("[SpiritCore] DI container built successfully.");
} catch (err) {
  app.log.error(err, "[SpiritCore] Failed to build DI container");
  process.exit(1);
}

// Expose container and orchestrator via Fastify decorators
app.decorate("container",    container);
app.decorate("orchestrator", container.orchestrator);

// Wire the app logger into the service-layer logger (Phase F)
setAppLogger(app.log);

// Register v1 routes (authoritative src architecture)
await app.register(async (instance) => {
  await interactRoutes(instance);
}, { prefix: "/v1" });

await app.register(spiritkinRoutes, {
  prefix: "/",
  registry: container.registry,
});

await app.register(conversationRoutes, {
  prefix: "/",
  conversationService: container.conversationService,
});

// Phase F: Health, readiness, and metrics endpoints
await app.register(healthRoutes, {
  prefix:   "/",
  registry: container.registry,
  supabase: container.supabase,
});

// Start
try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`[SpiritCore] Phase F running on port ${PORT} (USE_LLM=${USE_LLM}, DEBUG=${DEBUG})`);
  app.log.info(`[SpiritCore] Routes: /v1/interact, /v1/spiritkins, /v1/conversations, /health, /ready, /metrics`);
} catch (e) {
  app.log.error(e, "Failed to start");
  process.exit(1);
}
