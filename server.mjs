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
import { adminRoutes }           from "./src/routes/admin.mjs";
// -- Analytics & Feedback Layer
import { createAnalyticsService } from "./src/services/analyticsService.mjs";
import { createFeedbackService }  from "./src/services/feedbackService.mjs";
import { createIssueReportService } from "./src/services/issueReportService.mjs";
import { analyticsRoutes }        from "./src/routes/analytics.mjs";
import { issueRoutes }            from "./src/routes/issues.mjs";
import { sessionRoutes }          from "./src/routes/session.mjs";
import { createPendingCreatorMediaSlots, listRuntimeVideoFiles, SPIRITKIN_CREATOR_FOUNDATION } from "./spiritkins-app/data/spiritkinRuntimeConfig.js";
// ── Phase F: Production hardening ───────────────────────────────────────────
import { validateConfig, config } from "./src/config.mjs";
import { getPinoOptions, setAppLogger } from "./src/logger.mjs";
import { registerRateLimiter }    from "./src/middleware/rateLimiter.mjs";
import { createAdminAccessGuard, extractAdminToken } from "./src/middleware/adminAccess.mjs";
import { gameRoutes }             from "./src/routes/games.mjs";
import { veilCrossingRoutes }     from "./src/routes/veilCrossing.mjs";
import { bondJournalRoutes }      from "./src/routes/bondJournal.mjs";
import { spiritverseEventRoutes } from "./src/routes/spiritverseEvents.mjs";
import { dailyQuestRoutes }       from "./src/routes/dailyQuests.mjs";
import { healthRoutes }           from "./src/routes/health.mjs";
import { spiritCoreRoutes }       from "./src/routes/spiritcore.mjs";

// Fail fast on missing required env vars
try { validateConfig(); } catch (err) { console.error("[SpiritCore] Config error:", err.message); process.exit(1); }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPERATOR_CONSOLE_DIR = path.join(__dirname, "operator-console");
const USER_APP_DIR = path.join(__dirname, "spiritkins-app");
const ACTIVE_ASSET_DIR = path.join(__dirname, "Spiritverse_MASTER_ASSETS", "ACTIVE");
const SPIRITKIN_VIDEO_ASSET_DIR = path.join(__dirname, "Spiritverse_MASTER_ASSETS", "Spiritkin_Videos");
const GENERATED_SPIRITKIN_DIR = path.join(__dirname, "runtime_data", "generated-spiritkins");
const ACTIVE_WORLD_ART_DIRS = [
  path.join(ACTIVE_ASSET_DIR, "rooms"),
  path.join(ACTIVE_ASSET_DIR, "concepts")
];
const SPIRITVERSE_APP_BUILD = "20260422151500";

const PORT = config.port;
const USE_LLM = config.useLLM;
const DEBUG = config.debug;

// Fastify app with structured Pino logger
const app = Fastify({
  logger:     getPinoOptions(config.log),
  trustProxy: true,
  genReqId:   () => randomUUID(),
});

app.decorate("requireAdminAccess", createAdminAccessGuard({ config, logger: app.log }));

await app.register(cors, { origin: config.corsOrigin });

// Rate limiter registered via Phase F module (replaces inline registration)
await registerRateLimiter(app);

// Supabase
if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  app.log.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

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

function getStaticAssetMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

async function sendStaticAssetFromRoot(reply, rootDir, requestedPath) {
  const requested = String(requestedPath || "").replace(/\\/g, "/");
  if (!requested || requested.includes("..")) {
    return reply.code(404).send({ ok: false, error: "Not found" });
  }

  const resolvedPath = path.resolve(rootDir, requested);
  const normalizedRoot = `${path.resolve(rootDir)}${path.sep}`;
  if (!resolvedPath.startsWith(normalizedRoot)) {
    return reply.code(404).send({ ok: false, error: "Not found" });
  }

  try {
    const content = await readFile(resolvedPath);
    return reply.type(getStaticAssetMimeType(resolvedPath)).send(content);
  } catch (_err) {
    return reply.code(404).send({ ok: false, error: "Not found" });
  }
}

function setAdminSessionCookie(req, reply) {
  const auth = req.adminAccess || {};
  if (auth.bypassed) return;

  const { token, source } = extractAdminToken(req.headers || {});
  if (!token || source === "cookie") return;

  const secure = config.env === "production" ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `spiritcore_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=900${secure}`
  );
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
  if (req.headers["accept"]?.includes("text/html")) {
    return reply.type("text/html").send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SpiritCore Gateway</title>
          <style>
              body { background: #0a0514; color: #e0d5f0; font-family: 'Manrope', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { background: rgba(255,255,255,0.05); padding: 3rem; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-width: 400px; }
              h1 { font-family: 'Cormorant Garamond', serif; font-size: 2.5rem; margin-bottom: 0.5rem; color: #fff; }
              p { opacity: 0.7; margin-bottom: 2rem; line-height: 1.6; }
              .btn { display: block; width: 100%; padding: 1rem; margin-bottom: 1rem; border-radius: 12px; text-decoration: none; font-weight: 700; transition: all 0.3s ease; box-sizing: border-box; }
              .btn-primary { background: #7c4dff; color: #fff; }
              .btn-primary:hover { background: #9575cd; transform: translateY(-2px); }
              .btn-secondary { background: rgba(255,255,255,0.1); color: #e0d5f0; border: 1px solid rgba(255,255,255,0.2); }
              .btn-secondary:hover { background: rgba(255,255,255,0.15); transform: translateY(-2px); }
          </style>
      </head>
      <body>
          <div class="card">
              <h1>SpiritCore</h1>
              <p>Welcome to the governing intelligence of the Spiritverse.</p>
              <a href="/command-center" class="btn btn-primary">Open Command Center</a>
              <a href="/app" class="btn btn-secondary">Enter Spiritverse App</a>
          </div>
      </body>
      </html>
    `);
  }
  return {
    ok: true,
    name: "SpiritCore",
    time: nowIso(),
    request_id: req.request_id
  };
});

app.get("/operator", { preHandler: app.requireAdminAccess }, async (req, reply) => {
  setAdminSessionCookie(req, reply);
  const html = await readFile(path.join(OPERATOR_CONSOLE_DIR, "index.html"), "utf8");
  return reply.type("text/html; charset=utf-8").send(html);
});

app.get("/operator/:asset", { preHandler: app.requireAdminAccess }, async (req, reply) => {
  setAdminSessionCookie(req, reply);
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
  const html = injectSpiritverseBuild(await readFile(path.join(USER_APP_DIR, "index.html"), "utf8"));
  reply.header("Cache-Control", "no-store, max-age=0, must-revalidate");
  reply.header("X-Spiritverse-Build", SPIRITVERSE_APP_BUILD);
  return reply.type("text/html; charset=utf-8").send(html);
});

app.get("/command-center", { preHandler: app.requireAdminAccess }, async (req, reply) => {
  setAdminSessionCookie(req, reply);
  const html = injectSpiritverseBuild(await readFile(path.join(USER_APP_DIR, "command-center.html"), "utf8"));
  return reply.type("text/html; charset=utf-8").send(html);
});

// Serve assets for Command Center specifically
app.get("/command-center.js", { preHandler: app.requireAdminAccess }, async (req, reply) => {
  setAdminSessionCookie(req, reply);
  const content = await readFile(path.join(USER_APP_DIR, "command-center.js"), "utf8");
  return reply.type("text/javascript; charset=utf-8").send(content);
});

app.get("/command-center.css", { preHandler: app.requireAdminAccess }, async (req, reply) => {
  setAdminSessionCookie(req, reply);
  const content = await readFile(path.join(USER_APP_DIR, "command-center.css"), "utf8");
  return reply.type("text/css; charset=utf-8").send(content);
});

app.get("/app/:asset", async (req, reply) => {
  const { asset } = req.params;
  if (!["app.js", "app-constants.js", "app-helpers.js", "styles.css", "reveal-animation.js", "spiritverse-echoes.js", "video-player.js", "command-center.js", "command-center.css", "spirit-icons.svg", "spirit-background.jpg", "spiritverse-games.js", "spiritverse-games.css"].includes(asset)) {
    return reply.code(404).send({ ok: false, error: "Not found" });
  }

  const filePath = path.join(USER_APP_DIR, asset);
  const content = await readFile(filePath, "utf8");
  const mime = asset.endsWith(".js") ? "text/javascript; charset=utf-8" : (asset.endsWith(".css") ? "text/css; charset=utf-8" : "application/octet-stream");
  reply.header("Cache-Control", "no-store, max-age=0, must-revalidate");
  reply.header("X-Spiritverse-Build", SPIRITVERSE_APP_BUILD);
  return reply.type(mime).send(content);
});

app.get("/app/data/:asset", async (req, reply) => {
  const { asset } = req.params;
  if (!["spiritverseCanon.js", "gameThemes.js", "gameAssetManifest.js", "spiritkinRuntimeConfig.js", "spiritkinVideoManifest.js"].includes(asset)) {
    return reply.code(404).send({ ok: false, error: "Not found" });
  }

  const filePath = path.join(USER_APP_DIR, "data", asset);
  const content = await readFile(filePath, "utf8");
  reply.header("Cache-Control", "no-store, max-age=0, must-revalidate");
  reply.header("X-Spiritverse-Build", SPIRITVERSE_APP_BUILD);
  return reply.type("text/javascript; charset=utf-8").send(content);
});

app.get("/app/active-assets/*", async (req, reply) => {
  return sendStaticAssetFromRoot(reply, ACTIVE_ASSET_DIR, req.params["*"]);
});

app.get("/app/assets/*", async (req, reply) => {
  return sendStaticAssetFromRoot(reply, ACTIVE_ASSET_DIR, req.params["*"]);
});

app.get("/app/spiritkin-videos/*", async (req, reply) => {
  reply.header("Cache-Control", "no-store, max-age=0, must-revalidate");
  reply.header("X-Spiritverse-Build", SPIRITVERSE_APP_BUILD);
  return sendStaticAssetFromRoot(reply, SPIRITKIN_VIDEO_ASSET_DIR, req.params["*"]);
});

// Compatibility aliases for older frontend builds. These now resolve from ACTIVE.
app.get("/app/game-theme-assets/*", async (req, reply) => {
  return sendStaticAssetFromRoot(reply, ACTIVE_ASSET_DIR, req.params["*"]);
});

app.get("/app/game-concept-assets/*", async (req, reply) => {
  return sendStaticAssetFromRoot(reply, ACTIVE_ASSET_DIR, req.params["*"]);
});

app.get("/app/premium-game-assets/*", async (req, reply) => {
  return sendStaticAssetFromRoot(reply, ACTIVE_ASSET_DIR, req.params["*"]);
});

app.get("/generated-spiritkins/*", async (req, reply) => {
  return sendStaticAssetFromRoot(reply, GENERATED_SPIRITKIN_DIR, req.params["*"]);
});

// Serve portrait images from public/portraits
app.get("/portraits/:filename", async (req, reply) => {
  const { filename } = req.params;
  // Whitelist portrait filenames to prevent directory traversal
  const allowedPortraits = ["lyra_portrait.png", "raien_portrait.png", "kairo_portrait.png"];
  if (!allowedPortraits.includes(filename)) {
    return reply.code(404).send({ ok: false, error: "Portrait not found" });
  }

  try {
    const filePath = path.join(USER_APP_DIR, "public", "portraits", filename);
    const content = await readFile(filePath);
    return reply.type("image/png").send(content);
  } catch (err) {
    app.log.warn(`Failed to serve portrait ${filename}: ${err.message}`);
    return reply.code(404).send({ ok: false, error: "Portrait not found" });
  }
});

// Serve cinematic videos from public/videos
app.get("/videos/:filename", async (req, reply) => {
  const { filename } = req.params;
  const allowedVideos = listRuntimeVideoFiles();
  if (!allowedVideos.includes(filename)) {
    return reply.code(404).send({ ok: false, error: "Video not found" });
  }

  try {
    const filePath = path.join(USER_APP_DIR, "public", "videos", filename);
    const content = await readFile(filePath);
    return reply.type("video/mp4").send(content);
  } catch (err) {
    app.log.warn(`Failed to serve video ${filename}: ${err.message}`);
    return reply.code(404).send({ ok: false, error: "Video not found" });
  }
});

app.get("/world-art/:filename", async (req, reply) => {
  const { filename } = req.params;
  const allowedWorldArt = new Set([
    "Book Covers All.png",
    "Book Covers.png",
    "Chess Base theme 1.jpg",
    "Chess Base theme 2.jpg",
    "Chess base theme 3.jpg",
    "Elaria Left 1 Thalassar right 1.png",
    "Elaria Left Thalassar right.png",
    "Elaria.png",
    "Spiritkins in spiritverse.png",
    "Spiritverse background base theme.png",
    "Spiritverse elder gods photo base needs edits.png",
    "thalassar.png"
  ]);

  if (!allowedWorldArt.has(filename)) {
    return reply.code(404).send({ ok: false, error: "Art not found" });
  }

  try {
    for (const dir of ACTIVE_WORLD_ART_DIRS) {
      const filePath = path.join(dir, filename);
      try {
        const content = await readFile(filePath);
        const ext = path.extname(filename).toLowerCase();
        const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
        return reply.type(mime).send(content);
      } catch {}
    }
    throw new Error("not found");
  } catch (err) {
    app.log.warn(`Failed to serve world art ${filename}: ${err.message}`);
    return reply.code(404).send({ ok: false, error: "Art not found" });
  }
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
app.decorate("sessionControlService", container.sessionControlService);

// -- Analytics & Feedback services (non-blocking, safe to fail)
const analyticsService = createAnalyticsService({ supabase: container.supabase });
const feedbackService  = createFeedbackService({ supabase: container.supabase, analyticsService });
const issueReportService = createIssueReportService({ supabase: container.supabase, logger: app.log });
app.decorate("analyticsService", analyticsService);
app.decorate("feedbackService",  feedbackService);
app.decorate("issueReportService", issueReportService);

// Wire the app logger into the service-layer logger (Phase F)
setAppLogger(app.log);

// Register v1 routes (authoritative src architecture)
await app.register(async (instance) => {
  await interactRoutes(instance);
}, { prefix: "/v1" });

await app.register(spiritkinRoutes, {
  prefix: "/",
  registry: container.registry,
  spiritkinGeneratorService: container.spiritkinGeneratorService,
});

// Analytics & Feedback routes
await app.register(analyticsRoutes, {
  feedbackService,
  analyticsService,
  supabase: container.supabase,
});

await app.register(issueRoutes, {
  issueReportService,
  sessionControlService: container.sessionControlService,
});

await app.register(sessionRoutes, {
  sessionControlService: container.sessionControlService,
});

await app.register(spiritCoreRoutes);

await app.register(conversationRoutes, {
  prefix: "/",
  conversationService: container.conversationService,
  analyticsService,
  engagementEngine: container.engagementEngine,
  messageService: container.messageService,
  sessionControlService: container.sessionControlService,
});

await app.register(adminRoutes, {
  prefix: "/",
  supabase: container.supabase,
  messageService: container.messageService,
  conversationService: container.conversationService,
  registry: container.registry,
  issueReportService,
  spiritkinGeneratorService: container.spiritkinGeneratorService,
});

await app.register(gameRoutes, {
  prefix: "/",
  gameEngine: container.gameEngine,
  world: container.worldService,
  worldProgression: container.worldProgression,
  sessionControlService: container.sessionControlService,
});

await app.register(veilCrossingRoutes, {
  prefix: "/v1/veil-crossing",
});

// Bond Journal route — decorated with spiritMemoryEngine and worldProgression
await app.register(async (instance) => {
  instance.decorate("spiritMemoryEngine", container.spiritMemoryEngine ?? null);
  instance.decorate("worldProgression",   container.worldProgression ?? null);
  await bondJournalRoutes(instance);
});

// TTS endpoint
// OpenAI speech synthesis for Spiritkins voices
app.post("/v1/speech", async (req, reply) => {
  try {
    const { text, voice } = req.body;
    if (!text || !voice) {
      return sendError(reply, 400, "BAD_REQUEST", "Missing text or voice for speech generation.", {}, req.request_id);
    }
    const activeAdapter = container.adapters.getActive();
    if (!activeAdapter || activeAdapter.name !== "openai" || !activeAdapter.generateSpeech) {
      return sendError(reply, 500, "INTERNAL", "TTS not available for current adapter.", {}, req.request_id);
    }
    const audioBuffer = await activeAdapter.generateSpeech(text, voice);
    return reply.type("audio/mpeg").send(Buffer.from(audioBuffer));
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

// Custom Spiritkin Generation endpoint — Premium feature
app.post("/v1/spiritkin/generate", async (req, reply) => {
  try {
    const { answers, userName } = req.body;
    if (!answers || typeof answers !== "object") {
      return sendError(reply, 400, "BAD_REQUEST", "Missing survey answers.", {}, req.request_id);
    }
    if (!config.openai.apiKey) {
      return sendError(reply, 500, "INTERNAL", "OpenAI API key not configured.", {}, req.request_id);
    }

    const surveyText = Object.entries(answers)
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join("\n\n");

    const systemPrompt = `You are the SpiritCore Orchestrator, the governing intelligence of the Spiritverse — a realm of governed AI companions called Spiritkins.

Your task is to analyze a user's survey answers and generate a unique, deeply personal Spiritkin companion for them.

Spiritkins are identity-invariant companions. They are NOT animals exclusively — they can take any form: human, animal, elemental, celestial being, abstract entity, mythological creature, hybrid, or anything that fits the user's soul profile.

Generate a Spiritkin that feels like it was always waiting in the Spiritverse for this specific person.

Return ONLY valid JSON with this exact structure:
{
  "name": "single evocative name",
  "archetype": "2-4 word archetype (e.g. The Quiet Flame, The Storm Keeper, The Dream Weaver)",
  "form": "detailed description of their physical form and appearance (2-3 sentences)",
  "realm": "name of their home realm in the Spiritverse",
  "realmText": "1-2 sentence description of their realm",
  "sigil": "name of their sigil symbol (e.g. Crescent Flame, Twin Moons, Hollow Star)",
  "strap": "one powerful tagline sentence",
  "bondLine": "one sentence describing what bonding with them feels like",
  "originStory": "3-4 sentence origin story written in the Spiritverse echoes style",
  "atmosphereLine": "3 comma-separated atmospheric descriptors",
  "voice": "one of: nova, alloy, shimmer, echo, fable, onyx",
  "tone": "2-3 word emotional tone (e.g. fierce tenderness, quiet resolve, electric wonder)",
  "primaryNeed": "the core emotional or psychological need this Spiritkin serves",
  "svgPalette": {
    "primary": "hex color for their dominant color",
    "secondary": "hex color for their accent color",
    "glow": "hex color for their glow/sigil color"
  }
}`;

    const userPrompt = `The user's name is ${userName || "the seeker"}. Here are their survey answers:\n\n${surveyText}\n\nGenerate their perfect Spiritkin companion.`;

    const res = await fetch(`${config.openai.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openai.apiKey}`
      },
      body: JSON.stringify({
        model: config.openai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 1200,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return sendError(reply, 502, "ADAPTER_ERROR", `OpenAI generation failed: ${res.status}`, { detail: errText }, req.request_id);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    let spiritkin;
    try {
      spiritkin = JSON.parse(content);
    } catch {
      return sendError(reply, 502, "PARSE_ERROR", "Failed to parse generated Spiritkin.", { raw: content }, req.request_id);
    }

    const slug = String(spiritkin.name || "custom-spiritkin")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "custom-spiritkin";
    const assetBasePath = `${SPIRITKIN_CREATOR_FOUNDATION.runtimeAssetRoot}/${slug}`;
    spiritkin.creatorFoundation = {
      version: SPIRITKIN_CREATOR_FOUNDATION.version,
      status: "generated",
      source: "survey_generation",
      assetBasePath,
      mediaSlots: createPendingCreatorMediaSlots(assetBasePath),
    };

    return reply.send({ ok: true, spiritkin });
  } catch (e) {
    return sendError(reply, 500, "INTERNAL", String(e?.message ?? e), {}, req.request_id);
  }
});

// Phase 6: Shared Spiritverse Events
await app.register(async (instance) => {
  await spiritverseEventRoutes(instance);
});

// Phase 7: Daily Quest Generator
await app.register(async (instance) => {
  instance.decorate("spiritMemoryEngine", container.spiritMemoryEngine ?? null);
  instance.decorate("worldService", container.worldService ?? null);
  await dailyQuestRoutes(instance);
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
  app.log.info(`[SpiritCore] Phase F running on port ${PORT} (ADAPTER=${container.adapters.activeName}, DEBUG=${DEBUG})`);
  app.log.info(`[SpiritCore] Routes: /v1/interact, /v1/spiritkins, /v1/conversations, /health, /ready, /metrics`);
  app.log.info(`[SpiritCore] Analytics: /v1/feedback, /v1/analytics/event, /v1/analytics/spiritkin/:name, /v1/analytics/summary`);
} catch (e) {
  app.log.error(e, "Failed to start");
  process.exit(1);
}
function injectSpiritverseBuild(content) {
  return String(content).replaceAll("__SPIRITVERSE_APP_BUILD__", SPIRITVERSE_APP_BUILD);
}
