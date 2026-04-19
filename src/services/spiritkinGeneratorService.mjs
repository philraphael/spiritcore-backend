import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { AppError, NotFoundError, ValidationError } from "../errors.mjs";
import { createTraceLogger } from "../logger.mjs";

const STORE_VERSION = 2;
const GENERATOR_DIR = path.join(process.cwd(), "runtime_data");
const STORE_PATH = path.join(GENERATOR_DIR, "spiritkin_generator_foundation_v1.json");
const GENERATED_RUNTIME_ROOT = "/generated-spiritkins";

const DEFAULT_STORE = {
  version: STORE_VERSION,
  updatedAt: null,
  imageJobs: [],
  videoJobs: [],
  outputs: [],
  assignments: {},
  reviewLog: [],
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeNumber(value, fallback, min = null, max = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  let result = numeric;
  if (min !== null) result = Math.max(min, result);
  if (max !== null) result = Math.min(max, result);
  return result;
}

function slugify(value, fallback = "item") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function inferSpiritkinKey({ spiritkinName, ownerId, ownerType }) {
  if (ownerType === "canonical") return String(spiritkinName || ownerId || "").trim();
  return String(ownerId || spiritkinName || "").trim();
}

function createStoragePaths({ ownerType, ownerId, spiritkinName, mediaKind, slotName, versionTag }) {
  const ownerKey = slugify(ownerId || spiritkinName || "spiritkin");
  const pathOwnerType = ownerType === "canonical" ? "canonical" : "user-created";
  const safeMediaKind = slugify(mediaKind, "media");
  const safeSlot = slugify(slotName, "slot");
  const safeVersion = slugify(versionTag, "v1");
  const base = `${GENERATED_RUNTIME_ROOT}/${pathOwnerType}/${ownerKey}`;
  return {
    draft: `${base}/drafts/${safeMediaKind}/${safeSlot}/${safeVersion}`,
    approved: `${base}/approved/${safeMediaKind}/${safeSlot}/${safeVersion}`,
    rejected: `${base}/rejected/${safeMediaKind}/${safeSlot}/${safeVersion}`,
  };
}

function runtimePathToWorkspacePath(runtimePath) {
  const relative = String(runtimePath || "").replace(/^\/+/, "");
  return path.join(GENERATOR_DIR, relative);
}

function chooseSeed(seed) {
  const numeric = Number(seed);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.floor(numeric);
  return Math.floor(Math.random() * 2147483647);
}

function createImagePromptPackage(spec) {
  const positives = [
    `${spec.spiritkinName} as ${spec.archetypeClass}`,
    `${spec.renderStyle} render`,
    `${spec.pose} pose`,
    `${spec.environment} environment`,
    `${spec.elementTheme} elemental theme`,
    `${spec.colors.join(", ")} palette`,
    `${spec.moodPersonality} emotional tone`,
    `${spec.rarityTier} rarity presentation`,
    spec.styleProfile ? `${spec.styleProfile} style profile` : "",
    spec.seed !== null && spec.seed !== undefined ? `seed locked ${spec.seed}` : "",
  ].filter(Boolean);
  const negatives = [
    "blurry",
    "low detail",
    "anatomy distortion",
    "duplicate limbs",
    "text watermark",
    "flat lighting",
    "generic mascot framing",
  ];
  return {
    prompt: positives.join(", "),
    negativePrompt: negatives.join(", "),
    structured: {
      positives,
      negatives,
      styleProfile: spec.styleProfile || null,
      loraHooks: spec.loraHooks || [],
    },
  };
}

function createVideoShotList(spec) {
  const introLine = normalizeText(spec.scriptVoiceLine || "", 240);
  const first = Math.max(2, Math.round(spec.durationSec * 0.22));
  const second = Math.max(2, Math.round(spec.durationSec * 0.34));
  const third = Math.max(2, Math.round(spec.durationSec * 0.24));
  const final = Math.max(2, spec.durationSec - (first + second + third));
  return [
    {
      id: randomUUID(),
      order: 1,
      title: "Arrival frame",
      durationSec: first,
      direction: `${spec.shotStyle} opening frame establishing ${spec.trailerType} energy inside ${spec.musicMood}.`,
    },
    {
      id: randomUUID(),
      order: 2,
      title: "Identity reveal",
      durationSec: second,
      direction: `Reveal ${spec.spiritkinName} with emphasis on ${spec.attachedAssetSummary || "attached image references"} and ${spec.shotStyle} motion.`,
    },
    {
      id: randomUUID(),
      order: 3,
      title: "Bonded beat",
      durationSec: third,
      direction: introLine
        ? `Hold on the spoken beat: "${introLine}".`
        : "Hold a clean identity beat without spoken line while the score carries the mood.",
    },
    {
      id: randomUUID(),
      order: 4,
      title: "Exit or loop handoff",
      durationSec: final,
      direction: `Resolve into a ${spec.trailerType} ending suitable for ${spec.slotName} attachment.`,
    },
  ];
}

function createVideoPromptPackage(spec, shotList) {
  const positives = [
    `${spec.spiritkinName} ${spec.trailerType} trailer`,
    `${spec.shotStyle} cinematography`,
    `${spec.musicMood} score mood`,
    `${spec.durationSec} second runtime`,
    `attached assets: ${spec.attachedAssetSummary || "none yet"}`,
  ];
  const negatives = [
    "hard jump cuts without intent",
    "subtitle burn-ins",
    "artifacting",
    "identity drift",
    "generic fantasy montage",
  ];
  return {
    prompt: positives.join(", "),
    negativePrompt: negatives.join(", "),
    structured: {
      positives,
      negatives,
      shotList,
    },
  };
}

function createOutputRecord({ job, providerConnected = false, storagePaths }) {
  return {
    id: randomUUID(),
    jobId: job.id,
    spiritkinKey: job.spiritkinKey,
    ownerType: job.ownerType,
    ownerId: job.ownerId,
    mediaKind: job.mediaKind,
    slotName: job.slotName,
    versionTag: job.versionTag,
    providerStatus: providerConnected ? "provider_connected" : "awaiting_provider",
    providerName: null,
    providerJobId: null,
    reviewStatus: "pending_review",
    canonical: false,
    runtimeAttached: false,
    artifactPath: null,
    artifactMetaPath: null,
    remoteArtifactUrl: null,
    lastError: null,
    attemptCount: 0,
    storagePaths,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    reviewHistory: [],
  };
}

function normalizeImageRequest(payload = {}) {
  const spiritkinName = normalizeText(payload.spiritkinName || payload.name, 80);
  if (!spiritkinName) throw new ValidationError("spiritkinName is required.");
  const ownerType = payload.ownerType === "user_created" ? "user_created" : "canonical";
  const ownerId = normalizeText(payload.ownerId || spiritkinName, 80);
  const slotName = normalizeText(payload.slotName || "portrait", 40);
  return {
    spiritkinName,
    ownerType,
    ownerId,
    archetypeClass: normalizeText(payload.archetypeClass || payload.archetype || "Founding Spiritkin", 120),
    colors: Array.isArray(payload.colors) ? payload.colors.map((item) => normalizeText(item, 40)).filter(Boolean).slice(0, 8) : [],
    elementTheme: normalizeText(payload.elementTheme || payload.theme, 80),
    moodPersonality: normalizeText(payload.moodPersonality || payload.mood, 120),
    pose: normalizeText(payload.pose, 120),
    environment: normalizeText(payload.environment, 120),
    renderStyle: normalizeText(payload.renderStyle || "premium spiritverse illustration", 120),
    rarityTier: normalizeText(payload.rarityTier || payload.tier || "premium", 80),
    slotName,
    requestedBy: normalizeText(payload.requestedBy || "command_center", 80),
    targetAudience: normalizeText(payload.targetAudience || "internal", 40),
    entitlementGate: normalizeText(payload.entitlementGate || "admin_only", 40),
    sourceAssets: Array.isArray(payload.sourceAssets) ? payload.sourceAssets.map((item) => normalizeText(item, 200)).filter(Boolean).slice(0, 16) : [],
    styleProfile: normalizeText(payload.styleProfile || "spiritverse_premium", 80),
    seed: payload.seed === undefined || payload.seed === null || payload.seed === "" ? chooseSeed(null) : chooseSeed(payload.seed),
    width: normalizeNumber(payload.width, 1024, 512, 2048),
    height: normalizeNumber(payload.height, 1024, 512, 2048),
    guidanceScale: normalizeNumber(payload.guidanceScale, 4, 1, 20),
    steps: normalizeNumber(payload.steps, 28, 8, 80),
    model: normalizeText(payload.model, 120),
    loraHooks: Array.isArray(payload.loraHooks) ? payload.loraHooks.map((item) => normalizeText(item, 120)).filter(Boolean).slice(0, 8) : [],
    execute: payload.execute !== false,
  };
}

function normalizeVideoRequest(payload = {}) {
  const spiritkinName = normalizeText(payload.spiritkinName || payload.name, 80);
  if (!spiritkinName) throw new ValidationError("spiritkinName is required.");
  const ownerType = payload.ownerType === "user_created" ? "user_created" : "canonical";
  const ownerId = normalizeText(payload.ownerId || spiritkinName, 80);
  const slotName = normalizeText(payload.slotName || payload.trailerType || "introTrailer", 40);
  const durationSec = Math.max(6, Math.min(90, Number(payload.durationSec || payload.duration || 18)));
  const attachedAssets = Array.isArray(payload.attachedAssets) ? payload.attachedAssets.map((item) => normalizeText(item, 200)).filter(Boolean).slice(0, 16) : [];
  return {
    spiritkinName,
    ownerType,
    ownerId,
    trailerType: normalizeText(payload.trailerType || "intro_trailer", 80),
    durationSec,
    shotStyle: normalizeText(payload.shotStyle || "cinematic premium reveal", 120),
    scriptVoiceLine: normalizeText(payload.scriptVoiceLine || payload.script, 320),
    musicMood: normalizeText(payload.musicMood || "mythic restrained wonder", 120),
    attachedAssets,
    attachedAssetSummary: attachedAssets.length ? attachedAssets.join(", ") : "none yet",
    slotName,
    requestedBy: normalizeText(payload.requestedBy || "command_center", 80),
    targetAudience: normalizeText(payload.targetAudience || "internal", 40),
    entitlementGate: normalizeText(payload.entitlementGate || "admin_only", 40),
    aspectRatio: normalizeText(payload.aspectRatio || "16:9", 20),
    seed: payload.seed === undefined || payload.seed === null || payload.seed === "" ? null : chooseSeed(payload.seed),
    model: normalizeText(payload.model, 120),
    execute: payload.execute !== false,
  };
}

function serializeError(error) {
  return {
    code: error?.code || "GENERATOR_PROVIDER_ERROR",
    message: error?.message || "Generator execution failed.",
    httpCode: error?.httpCode || 500,
    detail: error?.detail || null,
    at: nowIso(),
  };
}

export function createSpiritkinGeneratorService({ registry, providers = null }) {
  const logger = createTraceLogger({ stage: "spiritkin_generator" });
  let storeCache = null;

  async function ensureStoreLoaded() {
    if (storeCache) return storeCache;
    await mkdir(GENERATOR_DIR, { recursive: true });
    try {
      const raw = await readFile(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      storeCache = {
        ...DEFAULT_STORE,
        ...parsed,
        version: STORE_VERSION,
        imageJobs: Array.isArray(parsed.imageJobs) ? parsed.imageJobs : [],
        videoJobs: Array.isArray(parsed.videoJobs) ? parsed.videoJobs : [],
        outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
        assignments: parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {},
        reviewLog: Array.isArray(parsed.reviewLog) ? parsed.reviewLog : [],
      };
    } catch {
      storeCache = { ...DEFAULT_STORE, updatedAt: nowIso() };
      await persistStore();
    }
    return storeCache;
  }

  async function persistStore() {
    if (!storeCache) storeCache = { ...DEFAULT_STORE };
    storeCache.updatedAt = nowIso();
    await mkdir(GENERATOR_DIR, { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(storeCache, null, 2), "utf8");
  }

  async function validateOwner({ spiritkinName, ownerType }) {
    if (ownerType !== "canonical") return;
    const canonical = await registry.getCanonical(spiritkinName);
    if (!canonical) {
      throw new ValidationError(`No canonical Spiritkin found for "${spiritkinName}".`);
    }
  }

  async function writeOutputMetadata({ output, job, providerResult, destination }) {
    const metadata = {
      outputId: output.id,
      jobId: job.id,
      spiritkinKey: job.spiritkinKey,
      spiritkinName: job.spiritkinName,
      slotName: job.slotName,
      provider: providerResult.provider,
      providerJobId: providerResult.providerJobId,
      providerModel: providerResult.model,
      seed: providerResult.seed,
      promptPackage: job.promptPackage,
      negativePromptPackage: job.negativePromptPackage,
      spec: job.spec,
      meta: providerResult.meta || {},
      createdAt: nowIso(),
    };
    const metadataPath = `${destination}/metadata.json`;
    await writeFile(runtimePathToWorkspacePath(metadataPath), JSON.stringify(metadata, null, 2), "utf8");
    return metadataPath;
  }

  async function persistProviderArtifact({ job, output, providerResult }) {
    const destination = output.storagePaths.approved;
    const destinationDir = runtimePathToWorkspacePath(destination);
    await mkdir(destinationDir, { recursive: true });
    const artifactName = `artifact.${providerResult.extension || (job.type === "video" ? "mp4" : "png")}`;
    const artifactPath = `${destination}/${artifactName}`;
    await writeFile(runtimePathToWorkspacePath(artifactPath), providerResult.artifactBuffer);
    const metadataPath = await writeOutputMetadata({ output, job, providerResult, destination });
    return { artifactPath, metadataPath };
  }

  function findJobById(store, jobId) {
    const job = store.imageJobs.find((item) => item.id === jobId) || store.videoJobs.find((item) => item.id === jobId);
    if (!job) throw new NotFoundError("generator_job", jobId);
    return job;
  }

  function findOutputByJobId(store, jobId) {
    const output = store.outputs.find((item) => item.jobId === jobId);
    if (!output) throw new NotFoundError("generator_output", jobId);
    return output;
  }

  async function executeJob({ jobId, operation = null, requestedBy = "command_center" } = {}) {
    const store = await ensureStoreLoaded();
    const job = findJobById(store, jobId);
    const output = findOutputByJobId(store, jobId);
    const providerStatus = providers?.getStatus?.() || {
      image: { configured: false },
      video: { configured: false },
    };

    const needsImageProvider = job.type === "image";
    const providerConfigured = needsImageProvider ? providerStatus.image?.configured : providerStatus.video?.configured;
    output.attemptCount = Number(output.attemptCount || 0) + 1;
    output.updatedAt = nowIso();
    job.updatedAt = nowIso();
    job.status = providerConfigured ? "queued" : "awaiting_provider";
    job.providerStatus = providerConfigured ? "queued" : "awaiting_provider";
    output.providerStatus = providerConfigured ? "queued" : "awaiting_provider";
    await persistStore();

    if (!providers || !providerConfigured) {
      const execution = {
        ok: false,
        saved: true,
        attempted: false,
        error: {
          code: "GENERATOR_PROVIDER_UNAVAILABLE",
          message: needsImageProvider
            ? "No configured image provider. Configure Flux ComfyUI, Flux API, or Leonardo to execute this image job."
            : "No configured video provider. Configure Runway to execute this video job.",
          httpCode: 503,
        },
      };
      output.lastError = execution.error;
      await persistStore();
      return execution;
    }

    try {
      job.status = "processing";
      job.providerStatus = "processing";
      output.providerStatus = "processing";
      await persistStore();

      const executionOperation = operation || (
        job.type === "image" ? "generateImage" : "generateVideo"
      );
      const providerResult = job.type === "image"
        ? await ({
            generateImage: providers.generateImage,
            refineImage: providers.refineImage,
            upscaleImage: providers.upscaleImage,
          }[executionOperation] || providers.generateImage)(job.spec, { job, output, promptPackage: job.promptPackage })
        : await ({
            generateVideo: providers.generateVideo,
            extendVideo: providers.extendVideo,
          }[executionOperation] || providers.generateVideo)({ ...job.spec, shotList: job.shotList }, { job, output, promptPackage: job.promptPackage });

      const persisted = await persistProviderArtifact({ job, output, providerResult });
      output.providerStatus = "completed";
      output.providerName = providerResult.provider;
      output.providerJobId = providerResult.providerJobId;
      output.artifactPath = persisted.artifactPath;
      output.artifactMetaPath = persisted.metadataPath;
      output.remoteArtifactUrl = providerResult.remoteArtifactUrl || null;
      output.lastError = null;
      output.updatedAt = nowIso();

      job.status = "completed";
      job.providerStatus = "completed";
      job.providerName = providerResult.provider;
      job.providerJobId = providerResult.providerJobId;
      job.lastExecution = {
        requestedBy,
        operation: executionOperation,
        provider: providerResult.provider,
        model: providerResult.model,
        seed: providerResult.seed,
        completedAt: nowIso(),
      };
      job.updatedAt = nowIso();
      await persistStore();

      logger.info({
        jobId: job.id,
        type: job.type,
        provider: providerResult.provider,
        slotName: job.slotName,
      }, "Generator job completed");

      return {
        ok: true,
        attempted: true,
        operation: executionOperation,
        job,
        output,
      };
    } catch (error) {
      const serialized = serializeError(error);
      job.status = "failed";
      job.providerStatus = "failed";
      job.lastExecution = {
        requestedBy,
        operation: operation || (job.type === "image" ? "generateImage" : "generateVideo"),
        failedAt: nowIso(),
        error: serialized,
      };
      job.updatedAt = nowIso();
      output.providerStatus = "failed";
      output.lastError = serialized;
      output.updatedAt = nowIso();
      await persistStore();
      logger.error({ jobId: job.id, error: serialized.message, code: serialized.code }, "Generator job failed");
      return {
        ok: false,
        saved: true,
        attempted: true,
        job,
        output,
        error: serialized,
      };
    }
  }

  async function createImageJob(payload = {}) {
    const store = await ensureStoreLoaded();
    const spec = normalizeImageRequest(payload);
    await validateOwner(spec);
    const spiritkinKey = inferSpiritkinKey(spec);
    const versionTag = `img-${Date.now()}`;
    const promptPackage = createImagePromptPackage(spec);
    const job = {
      id: randomUUID(),
      type: "image",
      mediaKind: "image",
      slotName: spec.slotName,
      spiritkinKey,
      spiritkinName: spec.spiritkinName,
      ownerType: spec.ownerType,
      ownerId: spec.ownerId,
      versionTag,
      providerStatus: "awaiting_provider",
      status: "drafted",
      requestedBy: spec.requestedBy,
      targetAudience: spec.targetAudience,
      entitlementGate: spec.entitlementGate,
      spec,
      promptPackage,
      negativePromptPackage: promptPackage.structured.negatives,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastExecution: null,
    };
    const output = createOutputRecord({
      job,
      providerConnected: !!providers?.getStatus?.().image?.configured,
      storagePaths: createStoragePaths({
        ownerType: spec.ownerType,
        ownerId: spec.ownerId,
        spiritkinName: spec.spiritkinName,
        mediaKind: "images",
        slotName: spec.slotName,
        versionTag,
      }),
    });
    job.outputSlotId = output.id;
    store.imageJobs.unshift(job);
    store.outputs.unshift(output);
    await persistStore();

    let execution = null;
    if (spec.execute !== false) {
      execution = await executeJob({ jobId: job.id, operation: "generateImage", requestedBy: spec.requestedBy });
    }
    return { job, output: findOutputByJobId(storeCache, job.id), execution };
  }

  async function createVideoJob(payload = {}) {
    const store = await ensureStoreLoaded();
    const spec = normalizeVideoRequest(payload);
    await validateOwner(spec);
    const spiritkinKey = inferSpiritkinKey(spec);
    const versionTag = `vid-${Date.now()}`;
    const shotList = createVideoShotList(spec);
    const promptPackage = createVideoPromptPackage(spec, shotList);
    const job = {
      id: randomUUID(),
      type: "video",
      mediaKind: "video",
      slotName: spec.slotName,
      spiritkinKey,
      spiritkinName: spec.spiritkinName,
      ownerType: spec.ownerType,
      ownerId: spec.ownerId,
      versionTag,
      providerStatus: "awaiting_provider",
      status: "drafted",
      requestedBy: spec.requestedBy,
      targetAudience: spec.targetAudience,
      entitlementGate: spec.entitlementGate,
      spec,
      promptPackage,
      negativePromptPackage: promptPackage.structured.negatives,
      shotList,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastExecution: null,
    };
    const output = createOutputRecord({
      job,
      providerConnected: !!providers?.getStatus?.().video?.configured,
      storagePaths: createStoragePaths({
        ownerType: spec.ownerType,
        ownerId: spec.ownerId,
        spiritkinName: spec.spiritkinName,
        mediaKind: "videos",
        slotName: spec.slotName,
        versionTag,
      }),
    });
    job.outputSlotId = output.id;
    store.videoJobs.unshift(job);
    store.outputs.unshift(output);
    await persistStore();

    let execution = null;
    if (spec.execute !== false) {
      execution = await executeJob({ jobId: job.id, operation: "generateVideo", requestedBy: spec.requestedBy });
    }
    return { job, output: findOutputByJobId(storeCache, job.id), execution };
  }

  async function listJobs({ type = "all", spiritkinKey = null } = {}) {
    const store = await ensureStoreLoaded();
    let jobs = [...store.imageJobs, ...store.videoJobs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (type === "image" || type === "video") {
      jobs = jobs.filter((job) => job.type === type);
    }
    if (spiritkinKey) {
      const match = String(spiritkinKey).trim().toLowerCase();
      jobs = jobs.filter((job) => String(job.spiritkinKey || "").toLowerCase() === match);
    }
    return jobs;
  }

  async function getAssignmentsForSpiritkin(spiritkinKey) {
    const store = await ensureStoreLoaded();
    return store.assignments[String(spiritkinKey || "").trim()] || null;
  }

  async function listSummary() {
    const store = await ensureStoreLoaded();
    const jobs = await listJobs();
    const reviewQueue = store.outputs.filter((output) => output.reviewStatus === "pending_review");
    const canonicalCount = store.outputs.filter((output) => output.canonical).length;
    const providersStatus = providers?.getStatus?.() || {
      image: { configured: false },
      video: { configured: false },
    };
    return {
      version: store.version,
      updatedAt: store.updatedAt,
      providers: providersStatus,
      totals: {
        imageJobs: store.imageJobs.length,
        videoJobs: store.videoJobs.length,
        outputs: store.outputs.length,
        reviewQueue: reviewQueue.length,
        canonicalOutputs: canonicalCount,
        attachedOutputs: store.outputs.filter((output) => output.runtimeAttached).length,
        failedOutputs: store.outputs.filter((output) => output.providerStatus === "failed").length,
      },
      recentJobs: jobs.slice(0, 12),
      reviewQueue: reviewQueue.slice(0, 20),
      assignments: store.assignments,
    };
  }

  async function reviewOutput({
    outputId,
    decision,
    note = "",
    reviewer = "command_center",
    markCanonical = false,
    attachToRuntime = false,
  } = {}) {
    const store = await ensureStoreLoaded();
    const output = store.outputs.find((item) => item.id === outputId);
    if (!output) throw new NotFoundError("generator_output", outputId);
    const normalizedDecision = String(decision || "").trim().toLowerCase();
    if (!["approve", "reject", "mark_canonical", "attach"].includes(normalizedDecision)) {
      throw new ValidationError("decision must be approve, reject, mark_canonical, or attach");
    }
    const reviewEntry = {
      id: randomUUID(),
      outputId,
      decision: normalizedDecision,
      note: normalizeText(note, 320),
      reviewer: normalizeText(reviewer, 80),
      createdAt: nowIso(),
    };
    output.reviewHistory = Array.isArray(output.reviewHistory) ? output.reviewHistory : [];
    output.reviewHistory.unshift(reviewEntry);
    output.updatedAt = nowIso();

    if (normalizedDecision === "reject") {
      output.reviewStatus = "rejected";
      output.canonical = false;
      output.runtimeAttached = false;
    } else {
      output.reviewStatus = "approved";
      if (normalizedDecision === "mark_canonical" || markCanonical) {
        output.canonical = true;
      }
      if (normalizedDecision === "attach" || attachToRuntime || output.canonical) {
        output.runtimeAttached = true;
      }
    }

    if (output.runtimeAttached || output.canonical) {
      const spiritkinKey = output.spiritkinKey;
      const current = store.assignments[spiritkinKey] || {
        spiritkinKey,
        mediaSlots: {},
        history: [],
        ownerType: output.ownerType,
        ownerId: output.ownerId,
      };
      current.mediaSlots[output.slotName] = {
        outputId: output.id,
        jobId: output.jobId,
        mediaKind: output.mediaKind,
        canonical: !!output.canonical,
        reviewStatus: output.reviewStatus,
        artifactPath: output.artifactPath,
        providerStatus: output.providerStatus,
        updatedAt: nowIso(),
      };
      current.history.unshift({
        id: randomUUID(),
        outputId: output.id,
        slotName: output.slotName,
        decision: normalizedDecision,
        canonical: !!output.canonical,
        attached: !!output.runtimeAttached,
        note: reviewEntry.note,
        createdAt: reviewEntry.createdAt,
      });
      current.history = current.history.slice(0, 50);
      store.assignments[spiritkinKey] = current;
    }

    store.reviewLog.unshift(reviewEntry);
    store.reviewLog = store.reviewLog.slice(0, 300);
    await persistStore();
    return { output, reviewEntry, assignment: store.assignments[output.spiritkinKey] || null };
  }

  async function buildRuntimeMediaProfile(spiritkinName) {
    const assignment = await getAssignmentsForSpiritkin(spiritkinName);
    if (!assignment) return null;
    return {
      spiritkinKey: assignment.spiritkinKey,
      mediaSlots: assignment.mediaSlots,
      historyCount: Array.isArray(assignment.history) ? assignment.history.length : 0,
    };
  }

  async function setArtifactPath({ outputId, artifactPath }) {
    const store = await ensureStoreLoaded();
    const output = store.outputs.find((item) => item.id === outputId);
    if (!output) throw new NotFoundError("generator_output", outputId);
    output.artifactPath = normalizeText(artifactPath, 260) || null;
    output.updatedAt = nowIso();
    await persistStore();
    return output;
  }

  async function retryJob({ jobId, requestedBy = "command_center" } = {}) {
    return executeJob({ jobId, requestedBy });
  }

  function getProviderStatus() {
    return providers?.getStatus?.() || {
      image: { configured: false },
      video: { configured: false },
    };
  }

  return {
    createImageJob,
    createVideoJob,
    executeJob,
    retryJob,
    listJobs,
    listSummary,
    getAssignmentsForSpiritkin,
    buildRuntimeMediaProfile,
    reviewOutput,
    setArtifactPath,
    getProviderStatus,
  };
}
