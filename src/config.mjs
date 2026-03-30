/**
 * SpiritCore — Centralized Configuration (Phase F)
 *
 * All environment variables are declared here.
 * Call validateConfig() once at startup — it throws a descriptive error
 * if any required variable is missing. No silent fallbacks for critical values.
 */
export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3005),

  supabase: {
    url:            process.env.SUPABASE_URL             || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    anonKey:        process.env.SUPABASE_ANON_KEY         || "",
  },

  apiKey:     process.env.API_KEY     || "",
  corsOrigin: process.env.CORS_ORIGIN || true,

  // Adapter mode: "local" | "openai" | "anthropic"
  adapterMode: process.env.ADAPTER_MODE || "local",

  // OpenAI / LLM adapter
  openai: {
    apiKey:  process.env.OPENAI_API_KEY  || "",
    model:   process.env.OPENAI_MODEL    || "gpt-4o-mini",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  },

  // Memory lifecycle policy
  memoryPolicy: {
    dormantDays:       Number(process.env.MEMORY_DORMANT_DAYS        || 30),
    deleteAfterDays:   Number(process.env.MEMORY_DELETE_AFTER_DAYS   || 730),
    compressAfterDays: Number(process.env.MEMORY_COMPRESS_AFTER_DAYS || 365),
  },

  // Rate limiting (per-user, sliding window)
  rateLimit: {
    max:          Number(process.env.RATE_LIMIT_MAX            || 120),
    timeWindowMs: Number(process.env.RATE_LIMIT_TIME_WINDOW_MS || 60000),
    adapterMax:   Number(process.env.ADAPTER_RATE_LIMIT_MAX    || 30),
  },

  // Timeout guards (milliseconds)
  timeouts: {
    adapter:      Number(process.env.ADAPTER_TIMEOUT_MS       || 30000),
    orchestrator: Number(process.env.ORCHESTRATOR_TIMEOUT_MS  || 45000),
    dbQuery:      Number(process.env.DB_QUERY_TIMEOUT_MS      || 8000),
  },

  // Logging
  log: {
    level:      process.env.LOG_LEVEL  || "info",
    prettyPrint: process.env.LOG_PRETTY === "true",
  },
};

// ── Required variables ────────────────────────────────────────────────────────
const REQUIRED_ALWAYS = [
  ["SUPABASE_URL",             config.supabase.url],
  ["SUPABASE_SERVICE_ROLE_KEY", config.supabase.serviceRoleKey],
];

const REQUIRED_PRODUCTION = [
  ["SUPABASE_ANON_KEY", config.supabase.anonKey],
  ["API_KEY",           config.apiKey],
];

/**
 * Validate configuration at startup.
 * Throws a descriptive Error listing all missing variables.
 * Call once before building the DI container.
 */
export function validateConfig() {
  const missing = [];

  for (const [name, value] of REQUIRED_ALWAYS) {
    if (!value || value.trim() === "") missing.push(name);
  }

  if (config.env === "production") {
    for (const [name, value] of REQUIRED_PRODUCTION) {
      if (!value || value.trim() === "") missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[SpiritCore] Missing required environment variables:\n  ${missing.join("\n  ")}\n` +
      `Check your .env file or deployment environment.`
    );
  }

  if (config.env === "production" && config.adapterMode !== "local" && !config.openai.apiKey) {
    console.warn("[SpiritCore] WARNING: ADAPTER_MODE is not 'local' but OPENAI_API_KEY is not set.");
  }
}
