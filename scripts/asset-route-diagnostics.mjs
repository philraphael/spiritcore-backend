import { spawn } from "node:child_process";
import process from "node:process";

const PORT = Number(process.env.SPIRITCORE_DIAG_PORT || 3116);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, attempts = 80) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return true;
    } catch {}
    await wait(250);
  }
  throw new Error("Server did not become ready in time.");
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { res, data };
}

function logResult(ok, method, path, detail = "") {
  const status = ok ? "PASS" : "FAIL";
  console.log(`${status} ${method.padEnd(6)} ${path}${detail ? ` :: ${detail}` : ""}`);
}

async function main() {
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

  try {
    await waitForServer(BASE_URL);

    const checks = [
      { path: "/app", expected: 200 },
      { path: "/app/assets/concepts/Solis.png", expected: 200 },
      { path: "/app/assets/concepts/Neris.png", expected: 200 },
      { path: "/app/assets/concepts/Solis%20Neris%20pair.png", expected: 200 },
      { path: "/app/assets/concepts/Spiritkins%20in%20spiritverse.png", expected: 200 },
      { path: "/app/assets/ui/spiritcore-spiritkins-portraits.png", expected: 200 },
      { path: "/app/assets/ui/kairo_open.png", expected: 200 },
      { path: "/portraits/kairo_portrait.png", expected: 200 },
      { path: "/portraits/lyra_portrait.png", expected: 200 },
      { path: "/app/spiritkin-videos/Kairo/idle/idle_01.mp4", expected: 404 },
      { path: "/app/spiritkin-videos/Kairo/speaking/speaking_01.mp4", expected: 404 },
    ];

    let failures = 0;
    for (const check of checks) {
      const res = await fetch(`${BASE_URL}${check.path}`);
      const ok = res.status === check.expected;
      if (!ok) failures += 1;
      logResult(ok, "GET", check.path, `${res.status}`);
    }

    const userId = `asset-diagnostic-${Date.now()}`;
    const conversation = await requestJson(`${BASE_URL}/v1/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        spiritkinName: "Lyra",
      }),
    });

    const conversationId = conversation.data?.conversation_id || conversation.data?.conversationId || null;
    const sessionControl = await requestJson(`${BASE_URL}/v1/session/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        conversationId,
        currentSpiritkinName: "Lyra",
        currentSurface: "profile",
        currentMode: "conversation",
        activeTab: "profile",
        speechState: {
          isSpeaking: false,
          isListening: false,
          isPaused: false,
          turnPhase: "idle",
        },
      }),
    });

    const sessionOk = sessionControl.res.status === 200 && sessionControl.data?.ok !== false;
    if (!sessionOk) failures += 1;
    logResult(sessionOk, "POST", "/v1/session/control", `${sessionControl.res.status}`);

    console.log("\nSummary");
    console.log(JSON.stringify({
      baseUrl: BASE_URL,
      failures,
      ok: failures === 0,
    }, null, 2));

    if (failures > 0) {
      process.exitCode = 1;
    }
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
