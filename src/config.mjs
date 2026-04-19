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
