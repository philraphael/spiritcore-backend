import { spawn } from "node:child_process";
import process from "node:process";

const PORT = Number(process.env.SPIRITCORE_DIAG_PORT || 3115);
const BASE_URL = `http://127.0.0.1:${PORT}`;
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
  return result?.status === 500 && /tts not available|api key not configured|adapter/i.test(String(message));
}

function printResult(entry) {
  const status = entry.skipped ? "SKIP" : entry.pass ? "PASS" : "FAIL";
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
