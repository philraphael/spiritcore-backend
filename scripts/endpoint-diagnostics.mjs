import { spawn } from "node:child_process";
import process from "node:process";
import {
  canUseRunwayStagingTestBypass,
  canUseRunwayTransientStagingCredentials,
} from "../src/routes/admin.mjs";
import { canExecuteRunwayProvider } from "../src/services/runwayProvider.mjs";

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
