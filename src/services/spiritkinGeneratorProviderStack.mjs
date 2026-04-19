import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { AppError } from "../errors.mjs";
import { createTraceLogger } from "../logger.mjs";

function nowIso() {
  return new Date().toISOString();
}

function trimText(value, max = 400) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

function normalizePathPart(value, fallback = "") {
  const normalized = String(value || fallback).trim();
  if (!normalized) return fallback;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function parseJsonSafe(value, fallback = null) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function replaceTemplateTokens(input, replacements) {
  if (Array.isArray(input)) {
    return input.map((value) => replaceTemplateTokens(value, replacements));
  }
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, replaceTemplateTokens(value, replacements)])
    );
  }
  if (typeof input === "string") {
    return input.replace(/\{\{([^}]+)\}\}/g, (_match, token) => {
      const value = replacements[String(token || "").trim()];
      return value === undefined || value === null ? "" : String(value);
    });
  }
  return input;
}

function inferExtension(contentType, fallback = "bin") {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("quicktime")) return "mov";
  if (normalized.includes("webm")) return "webm";
  return fallback;
}

function buildHeaders({ apiKey, extra = {} } = {}) {
  const headers = { ...extra };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new AppError("GENERATOR_TIMEOUT", `Timed out while contacting ${url}`, 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, options = {}, timeoutMs = 120000) {
  const res = await fetchWithTimeout(url, options, timeoutMs);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new AppError(
      "GENERATOR_PROVIDER_ERROR",
      data?.message || `Provider request failed (${res.status})`,
      res.status >= 400 && res.status < 600 ? res.status : 502,
      { url, status: res.status, response: data }
    );
  }
  return data;
}

async function downloadArtifact(url, headers = {}, timeoutMs = 180000) {
  const res = await fetchWithTimeout(url, { headers }, timeoutMs);
  if (!res.ok) {
    throw new AppError("GENERATOR_PROVIDER_ERROR", `Artifact download failed (${res.status})`, 502, { url, status: res.status });
  }
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}

function extractArtifactPointer(payload) {
  if (!payload || typeof payload !== "object") return null;

  const directUrl =
    payload.artifactUrl ||
    payload.outputUrl ||
    payload.url ||
    payload.videoUrl ||
    payload.imageUrl ||
    payload.download_url ||
    payload.downloadUrl;
  if (directUrl) return { type: "url", value: directUrl };

  const base64Value =
    payload.artifactBase64 ||
    payload.base64 ||
    payload.image_base64 ||
    payload.video_base64;
  if (base64Value) {
    return {
      type: "base64",
      value: base64Value,
      contentType: payload.contentType || payload.mimeType || "application/octet-stream",
    };
  }

  const nestedArray =
    payload.outputs ||
    payload.data ||
    payload.images ||
    payload.videos ||
    payload.artifacts;
  if (Array.isArray(nestedArray) && nestedArray.length) {
    return extractArtifactPointer(nestedArray[0]);
  }

  return null;
}

function makeProviderResult({
  provider,
  operation,
  providerJobId = null,
  model = null,
  seed = null,
  artifactBuffer = null,
  contentType = null,
  remoteArtifactUrl = null,
  meta = {},
}) {
  return {
    provider,
    operation,
    providerJobId,
    model,
    seed,
    artifactBuffer,
    contentType,
    extension: inferExtension(contentType, operation === "generateVideo" || operation === "extendVideo" ? "mp4" : "png"),
    remoteArtifactUrl,
    meta,
    completedAt: nowIso(),
  };
}

async function resolveGenericArtifact({ payload, headers = {}, timeoutMs = 180000 }) {
  const pointer = extractArtifactPointer(payload);
  if (!pointer) {
    throw new AppError("GENERATOR_PROVIDER_ERROR", "Provider did not return a usable artifact pointer.", 502, { payload });
  }
  if (pointer.type === "base64") {
    return {
      buffer: Buffer.from(String(pointer.value), "base64"),
      contentType: pointer.contentType || "application/octet-stream",
      remoteArtifactUrl: null,
    };
  }

  const downloaded = await downloadArtifact(pointer.value, headers, timeoutMs);
  return { ...downloaded, remoteArtifactUrl: pointer.value };
}

async function pollJsonStatus({
  url,
  headers = {},
  timeoutMs = 300000,
  intervalMs = 3000,
  readyWhen,
}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const payload = await fetchJson(url, { headers }, Math.min(timeoutMs, 60000));
    if (readyWhen(payload)) return payload;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new AppError("GENERATOR_TIMEOUT", "Provider job did not complete before timeout.", 504, { url });
}

async function runFluxComfyUiGenerate({
  config,
  job,
  spec,
  promptPackage,
}) {
  const comfy = config.generator?.image?.flux?.comfyui || {};
  const baseUrl = normalizeBaseUrl(comfy.baseUrl);
  if (!baseUrl || !comfy.workflowPath) {
    throw new AppError("GENERATOR_PROVIDER_UNAVAILABLE", "Flux ComfyUI is not fully configured.", 503);
  }

  const workflowPath = path.isAbsolute(comfy.workflowPath)
    ? comfy.workflowPath
    : path.join(process.cwd(), comfy.workflowPath);
  const rawWorkflow = JSON.parse(await readFile(workflowPath, "utf8"));
  const seed = Number.isFinite(Number(spec.seed)) ? Number(spec.seed) : Math.floor(Math.random() * 2147483647);
  const replacements = {
    prompt: promptPackage.prompt,
    negativePrompt: promptPackage.negativePrompt,
    spiritkinName: spec.spiritkinName,
    archetypeClass: spec.archetypeClass || "",
    styleProfile: spec.styleProfile || "",
    renderStyle: spec.renderStyle || "",
    seed,
    width: spec.width || 1024,
    height: spec.height || 1024,
    guidance: spec.guidanceScale || 4,
    steps: spec.steps || 28,
    model: spec.model || comfy.model || "flux-dev",
    loraHooks: Array.isArray(spec.loraHooks) ? spec.loraHooks.join(", ") : "",
  };
  const prompt = replaceTemplateTokens(rawWorkflow, replacements);

  const submitPayload = await fetchJson(
    `${baseUrl}/prompt`,
    {
      method: "POST",
      headers: buildHeaders({
        apiKey: comfy.apiKey,
        extra: { "Content-Type": "application/json" },
      }),
      body: JSON.stringify({
        prompt,
        client_id: randomUUID(),
      }),
    },
    comfy.timeoutMs || config.timeouts.adapter
  );

  const promptId = submitPayload.prompt_id || submitPayload.id;
  if (!promptId) {
    throw new AppError("GENERATOR_PROVIDER_ERROR", "ComfyUI did not return a prompt id.", 502, { submitPayload });
  }

  const historyPayload = await pollJsonStatus({
    url: `${baseUrl}/history/${promptId}`,
    headers: buildHeaders({ apiKey: comfy.apiKey }),
    timeoutMs: comfy.pollTimeoutMs || 300000,
    intervalMs: comfy.pollIntervalMs || 3000,
    readyWhen(payload) {
      const result = payload?.[promptId];
      if (!result) return false;
      const outputs = result.outputs && typeof result.outputs === "object" ? Object.values(result.outputs) : [];
      return outputs.some((entry) => Array.isArray(entry?.images) && entry.images.length);
    },
  });

  const historyEntry = historyPayload?.[promptId];
  const outputs = historyEntry?.outputs && typeof historyEntry.outputs === "object" ? Object.values(historyEntry.outputs) : [];
  const image = outputs.flatMap((entry) => Array.isArray(entry?.images) ? entry.images : []).find(Boolean);
  if (!image?.filename) {
    throw new AppError("GENERATOR_PROVIDER_ERROR", "ComfyUI completed without a downloadable image output.", 502, { historyEntry });
  }

  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder || "",
    type: image.type || "output",
  });
  const downloaded = await downloadArtifact(
    `${baseUrl}/view?${params.toString()}`,
    buildHeaders({ apiKey: comfy.apiKey }),
    comfy.timeoutMs || 180000
  );

  return makeProviderResult({
    provider: "flux-comfyui",
    operation: "generateImage",
    providerJobId: promptId,
    model: spec.model || comfy.model || "flux-dev",
    seed,
    artifactBuffer: downloaded.buffer,
    contentType: downloaded.contentType || "image/png",
    meta: {
      outputNodeType: image.type || "output",
      workflowPath,
    },
  });
}

async function runFluxApiGenerate({ config, spec, promptPackage }) {
  const flux = config.generator?.image?.flux?.api || {};
  const baseUrl = normalizeBaseUrl(flux.baseUrl);
  if (!baseUrl || !flux.apiKey) {
    throw new AppError("GENERATOR_PROVIDER_UNAVAILABLE", "Flux API is not configured.", 503);
  }

  const seed = Number.isFinite(Number(spec.seed)) ? Number(spec.seed) : Math.floor(Math.random() * 2147483647);
  const payload = {
    model: spec.model || flux.model || "flux-dev",
    prompt: promptPackage.prompt,
    negative_prompt: promptPackage.negativePrompt,
    width: spec.width || 1024,
    height: spec.height || 1024,
    seed,
    steps: spec.steps || 28,
    guidance_scale: spec.guidanceScale || 4,
    style_profile: spec.styleProfile || null,
    reference_images: spec.sourceAssets || [],
    lora_hooks: spec.loraHooks || [],
    output_format: "png",
  };

  const submitted = await fetchJson(
    `${baseUrl}${normalizePathPart(flux.generatePath, "/v1/images/generate")}`,
    {
      method: "POST",
      headers: buildHeaders({
        apiKey: flux.apiKey,
        extra: { "Content-Type": "application/json" },
      }),
      body: JSON.stringify(payload),
    },
    flux.timeoutMs || config.timeouts.adapter
  );

  const taskId = submitted.id || submitted.taskId || submitted.generationId || null;
  let finalPayload = submitted;
  if (!extractArtifactPointer(submitted) && taskId) {
    finalPayload = await pollJsonStatus({
      url: `${baseUrl}${normalizePathPart(flux.statusPath, "/v1/images/generate")}/${taskId}`,
      headers: buildHeaders({ apiKey: flux.apiKey }),
      timeoutMs: flux.pollTimeoutMs || 300000,
      intervalMs: flux.pollIntervalMs || 3000,
      readyWhen(payload) {
        const status = String(payload?.status || payload?.state || "").toLowerCase();
        return ["completed", "succeeded", "success", "ready"].includes(status) || !!extractArtifactPointer(payload);
      },
    });
  }

  const resolved = await resolveGenericArtifact({
    payload: finalPayload,
    headers: buildHeaders({ apiKey: flux.apiKey }),
    timeoutMs: flux.timeoutMs || 180000,
  });

  return makeProviderResult({
    provider: "flux-api",
    operation: "generateImage",
    providerJobId: taskId,
    model: payload.model,
    seed,
    artifactBuffer: resolved.buffer,
    contentType: resolved.contentType || "image/png",
    remoteArtifactUrl: resolved.remoteArtifactUrl,
    meta: {
      styleProfile: spec.styleProfile || null,
    },
  });
}

async function runLeonardoGenerate({ config, spec, promptPackage }) {
  const leonardo = config.generator?.image?.leonardo || {};
  const baseUrl = normalizeBaseUrl(leonardo.baseUrl);
  if (!baseUrl || !leonardo.apiKey) {
    throw new AppError("GENERATOR_PROVIDER_UNAVAILABLE", "Leonardo fallback is not configured.", 503);
  }

  const seed = Number.isFinite(Number(spec.seed)) ? Number(spec.seed) : Math.floor(Math.random() * 2147483647);
  const payload = {
    modelId: spec.model || leonardo.model || "leonardo-diffusion-xl",
    prompt: promptPackage.prompt,
    negative_prompt: promptPackage.negativePrompt,
    seed,
    width: spec.width || 1024,
    height: spec.height || 1024,
    style: spec.styleProfile || leonardo.stylePreset || "SPIRITVERSE_PREMIUM",
  };

  const submitted = await fetchJson(
    `${baseUrl}${normalizePathPart(leonardo.generatePath, "/v1/generations")}`,
    {
      method: "POST",
      headers: buildHeaders({
        apiKey: leonardo.apiKey,
        extra: { "Content-Type": "application/json" },
      }),
      body: JSON.stringify(payload),
    },
    leonardo.timeoutMs || config.timeouts.adapter
  );

  const taskId = submitted.id || submitted.generationId || submitted.sdGenerationJob?.generationId || null;
  let finalPayload = submitted;
  if (!extractArtifactPointer(submitted) && taskId) {
    finalPayload = await pollJsonStatus({
      url: `${baseUrl}${normalizePathPart(leonardo.statusPath, "/v1/generations")}/${taskId}`,
      headers: buildHeaders({ apiKey: leonardo.apiKey }),
      timeoutMs: leonardo.pollTimeoutMs || 300000,
      intervalMs: leonardo.pollIntervalMs || 3000,
      readyWhen(payload) {
        const status = String(payload?.status || payload?.generation?.status || "").toLowerCase();
        return ["complete", "completed", "finished"].includes(status) || !!extractArtifactPointer(payload);
      },
    });
  }

  const resolved = await resolveGenericArtifact({
    payload: finalPayload,
    headers: buildHeaders({ apiKey: leonardo.apiKey }),
    timeoutMs: leonardo.timeoutMs || 180000,
  });

  return makeProviderResult({
    provider: "leonardo",
    operation: "generateImage",
    providerJobId: taskId,
    model: payload.modelId,
    seed,
    artifactBuffer: resolved.buffer,
    contentType: resolved.contentType || "image/png",
    remoteArtifactUrl: resolved.remoteArtifactUrl,
    meta: {
      fallbackProvider: true,
    },
  });
}

async function runRunwayGenerate({ config, spec, promptPackage, operation = "generateVideo" }) {
  const runway = config.generator?.video?.runway || {};
  const baseUrl = normalizeBaseUrl(runway.baseUrl);
  if (!baseUrl || !runway.apiKey) {
    throw new AppError("GENERATOR_PROVIDER_UNAVAILABLE", "Runway is not configured.", 503);
  }

  const routePath = operation === "extendVideo"
    ? normalizePathPart(runway.extendPath, "/v1/video/extend")
    : normalizePathPart(runway.generatePath, "/v1/video/generate");

  const payload = {
    model: runway.model || "gen3a_turbo",
    promptText: promptPackage.prompt,
    negativePromptText: promptPackage.negativePrompt,
    duration: spec.durationSec || 12,
    ratio: spec.aspectRatio || "16:9",
    shotList: spec.shotList || [],
    attachedAssets: spec.attachedAssets || [],
    seed: Number.isFinite(Number(spec.seed)) ? Number(spec.seed) : undefined,
  };

  const submitted = await fetchJson(
    `${baseUrl}${routePath}`,
    {
      method: "POST",
      headers: buildHeaders({
        apiKey: runway.apiKey,
        extra: { "Content-Type": "application/json", "X-Runway-Version": runway.version || "2024-11-06" },
      }),
      body: JSON.stringify(payload),
    },
    runway.timeoutMs || config.timeouts.adapter
  );

  const taskId = submitted.id || submitted.taskId || submitted.generationId || null;
  let finalPayload = submitted;
  if (!extractArtifactPointer(submitted) && taskId) {
    finalPayload = await pollJsonStatus({
      url: `${baseUrl}${normalizePathPart(runway.statusPath, "/v1/tasks")}/${taskId}`,
      headers: buildHeaders({
        apiKey: runway.apiKey,
        extra: { "X-Runway-Version": runway.version || "2024-11-06" },
      }),
      timeoutMs: runway.pollTimeoutMs || 420000,
      intervalMs: runway.pollIntervalMs || 4000,
      readyWhen(payload) {
        const status = String(payload?.status || payload?.state || "").toLowerCase();
        return ["succeeded", "completed", "complete"].includes(status) || !!extractArtifactPointer(payload);
      },
    });
  }

  const resolved = await resolveGenericArtifact({
    payload: finalPayload,
    headers: buildHeaders({
      apiKey: runway.apiKey,
      extra: { "X-Runway-Version": runway.version || "2024-11-06" },
    }),
    timeoutMs: runway.timeoutMs || 240000,
  });

  return makeProviderResult({
    provider: "runway",
    operation,
    providerJobId: taskId,
    model: runway.model || "gen3a_turbo",
    seed: payload.seed || null,
    artifactBuffer: resolved.buffer,
    contentType: resolved.contentType || "video/mp4",
    remoteArtifactUrl: resolved.remoteArtifactUrl,
    meta: {
      duration: payload.duration,
      ratio: payload.ratio,
    },
  });
}

export function createSpiritkinGeneratorProviderStack({ config }) {
  const logger = createTraceLogger({ stage: "spiritkin_generator_provider_stack" });

  function getStatus() {
    const image = config.generator?.image || {};
    const video = config.generator?.video || {};
    const fluxComfy = image.flux?.comfyui || {};
    const fluxApi = image.flux?.api || {};
    const leonardo = image.leonardo || {};
    const runway = video.runway || {};

    return {
      generatedAt: nowIso(),
      image: {
        primary: fluxComfy.baseUrl && fluxComfy.workflowPath
          ? "flux-comfyui"
          : (fluxApi.baseUrl && fluxApi.apiKey ? "flux-api" : null),
        fallback: leonardo.baseUrl && leonardo.apiKey ? "leonardo" : null,
        configured: !!(
          (fluxComfy.baseUrl && fluxComfy.workflowPath) ||
          (fluxApi.baseUrl && fluxApi.apiKey) ||
          (leonardo.baseUrl && leonardo.apiKey)
        ),
      },
      video: {
        primary: runway.baseUrl && runway.apiKey ? "runway" : null,
        configured: !!(runway.baseUrl && runway.apiKey),
      },
    };
  }

  async function generateImage(spec, ctx = {}) {
    const status = getStatus();
    const promptPackage = ctx.promptPackage || { prompt: "", negativePrompt: "" };
    const attempts = [];

    if (status.image.primary === "flux-comfyui") {
      try {
        return await runFluxComfyUiGenerate({ config, job: ctx.job, spec, promptPackage });
      } catch (error) {
        attempts.push({ provider: "flux-comfyui", message: error.message, detail: error.detail || null });
        logger.warn({ jobId: ctx.job?.id, error: error.message }, "Flux ComfyUI image generation failed");
      }
    }

    if (status.image.primary === "flux-api") {
      try {
        return await runFluxApiGenerate({ config, spec, promptPackage });
      } catch (error) {
        attempts.push({ provider: "flux-api", message: error.message, detail: error.detail || null });
        logger.warn({ jobId: ctx.job?.id, error: error.message }, "Flux API image generation failed");
      }
    }

    if (status.image.fallback === "leonardo") {
      try {
        return await runLeonardoGenerate({ config, spec, promptPackage });
      } catch (error) {
        attempts.push({ provider: "leonardo", message: error.message, detail: error.detail || null });
        logger.warn({ jobId: ctx.job?.id, error: error.message }, "Leonardo fallback image generation failed");
      }
    }

    throw new AppError(
      "GENERATOR_PROVIDER_ERROR",
      attempts.length
        ? `All configured image providers failed. Last failure: ${attempts[attempts.length - 1].message}`
        : "No image provider is configured.",
      attempts.length ? 502 : 503,
      { attempts }
    );
  }

  async function refineImage(spec, ctx = {}) {
    return generateImage({ ...spec, refinementMode: true }, ctx);
  }

  async function upscaleImage(spec, ctx = {}) {
    return generateImage({ ...spec, upscaleMode: true }, ctx);
  }

  async function generateVideo(spec, ctx = {}) {
    const promptPackage = ctx.promptPackage || { prompt: "", negativePrompt: "" };
    return runRunwayGenerate({ config, spec, promptPackage, operation: "generateVideo" });
  }

  async function extendVideo(spec, ctx = {}) {
    const promptPackage = ctx.promptPackage || { prompt: "", negativePrompt: "" };
    return runRunwayGenerate({ config, spec, promptPackage, operation: "extendVideo" });
  }

  return {
    getStatus,
    generateImage,
    refineImage,
    upscaleImage,
    generateVideo,
    extendVideo,
  };
}
