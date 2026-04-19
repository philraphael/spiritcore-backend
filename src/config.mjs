/**
 * SpiritCore - Centralized configuration
 *
 * All runtime environment variables should be declared here so startup
 * validation, documentation, and feature usage stay aligned.
 */
function parseBooleanEnv(value, fallback = false) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseCorsOrigin(value) {
  if (typeof value !== "string" || value.trim() === "") return true;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  if (value.includes(",")) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return value.trim();
}

function normalizeAdminAuthMode(value) {
  const normalized = String(value || "auto").trim().toLowerCase();
  if (["off", "auto", "enforce"].includes(normalized)) return normalized;
  return "auto";
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3005),
  debug: parseBooleanEnv(process.env.DEBUG, false),
  useLLM: parseBooleanEnv(process.env.USE_LLM, false),

  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
  },

  apiKey: process.env.API_KEY || "",
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  adminAuth: {
    mode: normalizeAdminAuthMode(process.env.ADMIN_AUTH_MODE),
    apiKey: process.env.ADMIN_API_KEY || process.env.API_KEY || "",
    secretSource: process.env.ADMIN_API_KEY
      ? "ADMIN_API_KEY"
      : (process.env.API_KEY ? "API_KEY" : null),
  },

  // Adapter mode: "local" | "openai" | "anthropic"
  adapterMode: process.env.ADAPTER_MODE || "local",

  // OpenAI / LLM adapter
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  },

  generator: {
    image: {
      flux: {
        comfyui: {
          baseUrl: process.env.FLUX_COMFYUI_BASE_URL || "",
          apiKey: process.env.FLUX_COMFYUI_API_KEY || "",
          workflowPath: process.env.FLUX_COMFYUI_WORKFLOW_PATH || "",
          model: process.env.FLUX_COMFYUI_MODEL || "flux-dev",
          pollIntervalMs: Number(process.env.FLUX_COMFYUI_POLL_INTERVAL_MS || 3000),
          pollTimeoutMs: Number(process.env.FLUX_COMFYUI_POLL_TIMEOUT_MS || 300000),
          timeoutMs: Number(process.env.FLUX_COMFYUI_TIMEOUT_MS || 180000),
        },
        api: {
          baseUrl: process.env.FLUX_API_URL || "",
          apiKey: process.env.FLUX_API_KEY || "",
          model: process.env.FLUX_API_MODEL || "flux-dev",
          generatePath: process.env.FLUX_API_GENERATE_PATH || "/v1/images/generate",
          statusPath: process.env.FLUX_API_STATUS_PATH || "/v1/images/generate",
          pollIntervalMs: Number(process.env.FLUX_API_POLL_INTERVAL_MS || 3000),
          pollTimeoutMs: Number(process.env.FLUX_API_POLL_TIMEOUT_MS || 300000),
          timeoutMs: Number(process.env.FLUX_API_TIMEOUT_MS || 180000),
        },
      },
      leonardo: {
        baseUrl: process.env.LEONARDO_API_URL || "https://cloud.leonardo.ai/api/rest",
        apiKey: process.env.LEONARDO_API_KEY || "",
        model: process.env.LEONARDO_MODEL || "leonardo-diffusion-xl",
        stylePreset: process.env.LEONARDO_STYLE_PRESET || "SPIRITVERSE_PREMIUM",
        generatePath: process.env.LEONARDO_GENERATE_PATH || "/v1/generations",
        statusPath: process.env.LEONARDO_STATUS_PATH || "/v1/generations",
        pollIntervalMs: Number(process.env.LEONARDO_POLL_INTERVAL_MS || 3000),
        pollTimeoutMs: Number(process.env.LEONARDO_POLL_TIMEOUT_MS || 300000),
        timeoutMs: Number(process.env.LEONARDO_TIMEOUT_MS || 180000),
      },
    },
    video: {
      runway: {
        baseUrl: process.env.RUNWAY_API_URL || "https://api.dev.runwayml.com",
        apiKey: process.env.RUNWAY_API_KEY || "",
        version: process.env.RUNWAY_API_VERSION || "2024-11-06",
        model: process.env.RUNWAY_MODEL || "gen3a_turbo",
        generatePath: process.env.RUNWAY_GENERATE_PATH || "/v1/video/generate",
        extendPath: process.env.RUNWAY_EXTEND_PATH || "/v1/video/extend",
        statusPath: process.env.RUNWAY_STATUS_PATH || "/v1/tasks",
        pollIntervalMs: Number(process.env.RUNWAY_POLL_INTERVAL_MS || 4000),
        pollTimeoutMs: Number(process.env.RUNWAY_POLL_TIMEOUT_MS || 420000),
        timeoutMs: Number(process.env.RUNWAY_TIMEOUT_MS || 240000),
      },
    },
  },

  // Memory lifecycle policy
  memoryPolicy: {
    dormantDays: Number(process.env.MEMORY_DORMANT_DAYS || 30),
    deleteAfterDays: Number(process.env.MEMORY_DELETE_AFTER_DAYS || 730),
    compressAfterDays: Number(process.env.MEMORY_COMPRESS_AFTER_DAYS || 365),
  },

  // Rate limiting (per-user, sliding window)
  rateLimit: {
    max: Number(process.env.RATE_LIMIT_MAX || 120),
    timeWindowMs: Number(process.env.RATE_LIMIT_TIME_WINDOW_MS || 60000),
    adapterMax: Number(process.env.ADAPTER_RATE_LIMIT_MAX || 30),
  },

  // Timeout guards (milliseconds)
  timeouts: {
    adapter: Number(process.env.ADAPTER_TIMEOUT_MS || 30000),
    orchestrator: Number(process.env.ORCHESTRATOR_TIMEOUT_MS || 45000),
    dbQuery: Number(process.env.DB_QUERY_TIMEOUT_MS || 8000),
  },

  // Logging
  log: {
    level: process.env.LOG_LEVEL || "info",
    prettyPrint: parseBooleanEnv(process.env.LOG_PRETTY, process.env.NODE_ENV !== "production"),
  },
};

const REQUIRED_ALWAYS = [
  ["SUPABASE_URL", config.supabase.url],
  ["SUPABASE_SERVICE_ROLE_KEY", config.supabase.serviceRoleKey],
];

/**
 * Validate configuration at startup.
 * Throws a descriptive Error listing all missing variables.
 * Call once before building the DI container.
 */
export function validateConfig() {
  const missing = [];
  const warnings = [];

  for (const [name, value] of REQUIRED_ALWAYS) {
    if (!value || value.trim() === "") missing.push(name);
  }

  if (missing.length > 0) {
    throw new Error(
      `[SpiritCore] Missing required environment variables:\n  ${missing.join("\n  ")}\n` +
      `The backend cannot start without Supabase connectivity. Check your .env file or deployment environment.`
    );
  }

  if (config.adapterMode !== "local" && !config.openai.apiKey) {
    warnings.push(
      "[SpiritCore] WARNING: ADAPTER_MODE is not 'local' but OPENAI_API_KEY is not set. LLM responses and TTS-backed generation paths will fail until it is configured."
    );
  }

  const generatorImageConfigured = !!(
    (config.generator.image.flux.comfyui.baseUrl && config.generator.image.flux.comfyui.workflowPath) ||
    (config.generator.image.flux.api.baseUrl && config.generator.image.flux.api.apiKey) ||
    (config.generator.image.leonardo.baseUrl && config.generator.image.leonardo.apiKey)
  );
  const generatorVideoConfigured = !!(
    config.generator.video.runway.baseUrl && config.generator.video.runway.apiKey
  );

  if (!generatorImageConfigured) {
    warnings.push(
      "[SpiritCore] WARNING: No Spiritkins image generation provider is configured. Generator image jobs will save specs but cannot execute until Flux ComfyUI, Flux API, or Leonardo is configured."
    );
  }

  if (!generatorVideoConfigured) {
    warnings.push(
      "[SpiritCore] WARNING: No Spiritkins video generation provider is configured. Video jobs will save specs but cannot execute until Runway is configured."
    );
  }

  if (config.adminAuth.secretSource === "API_KEY") {
    warnings.push(
      "[SpiritCore] WARNING: Using legacy API_KEY as the admin auth secret. Prefer ADMIN_API_KEY for new deployments."
    );
  }

  if (config.env === "production" && !config.supabase.anonKey) {
    warnings.push(
      "[SpiritCore] WARNING: SUPABASE_ANON_KEY is not set. The current backend boot path does not require it, but browser-facing Supabase integrations may if introduced or re-enabled."
    );
  }

  if (config.env === "production" && config.adminAuth.mode !== "off" && !config.adminAuth.apiKey) {
    warnings.push(
      "[SpiritCore] WARNING: Admin auth enforcement is active for production but no ADMIN_API_KEY/API_KEY is configured. Sensitive routes will deny access until an admin secret is set."
    );
  }

  for (const warning of warnings) {
    console.warn(warning);
  }
}
