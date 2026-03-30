/**
 * SpiritCore — Structured Logger (Phase F)
 *
 * Wraps Fastify's built-in Pino logger with SpiritCore-specific context fields.
 * Provides a consistent structured JSON log format across all services.
 *
 * Log format (production):
 *   { "level":"info", "time":"...", "service":"spiritcore",
 *     "traceId":"trace_...", "stage":"identity_resolution",
 *     "spiritkin":"Lyra", "msg":"Identity resolved from registry" }
 *
 * Rules:
 *   - Never log raw user message content
 *   - Never log credentials or API keys
 *   - Always include traceId when available
 */

// ── Pino logger options for server.mjs ───────────────────────────────────────
// Pass these to Fastify({ logger: getPinoOptions(config.log) }) at startup.
export function getPinoOptions(logConfig = {}) {
  const isPretty = logConfig.prettyPrint ?? (process.env.NODE_ENV !== "production");
  const level    = logConfig.level ?? "info";

  return {
    level,
    ...(isPretty
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
          },
        }
      : {}),
    serializers: {
      // Redact sensitive fields from request logs
      req(req) {
        return { method: req.method, url: req.url, requestId: req.id };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
    base: { service: "spiritcore" },
  };
}

// ── Service-layer logger factory ──────────────────────────────────────────────
// Used inside services that don't have direct access to the Fastify logger.
let _appLogger = null;

export function setAppLogger(fastifyLogger) {
  _appLogger = fastifyLogger;
}

function getLogger() {
  return _appLogger ?? console;
}

/**
 * Create a child logger bound to a specific traceId and optional context.
 * Use this inside service methods to attach trace context to every log line.
 *
 * @param {{ traceId?: string, stage?: string, spiritkin?: string }} ctx
 */
export function createTraceLogger(ctx = {}) {
  const base   = { ...ctx, service: "spiritcore" };
  const logger = getLogger();

  if (typeof logger.child === "function") {
    return logger.child(base);
  }

  // Fallback: structured console output
  return {
    info:  (msg, extra = {}) => console.log(JSON.stringify({ level: "info",  ...base, ...extra, msg, time: new Date().toISOString() })),
    warn:  (msg, extra = {}) => console.warn(JSON.stringify({ level: "warn",  ...base, ...extra, msg, time: new Date().toISOString() })),
    error: (msg, extra = {}) => console.error(JSON.stringify({ level: "error", ...base, ...extra, msg, time: new Date().toISOString() })),
    debug: (msg, extra = {}) => console.debug(JSON.stringify({ level: "debug", ...base, ...extra, msg, time: new Date().toISOString() })),
  };
}

/**
 * Log a stage transition in the orchestrator pipeline.
 * Keeps stage-level observability without exposing content.
 *
 * @param {object} logger - Pino child logger or trace logger
 * @param {string} stage  - Stage name (e.g., "identity_resolution")
 * @param {object} meta   - Non-sensitive metadata only
 */
export function logStage(logger, stage, meta = {}) {
  logger.info({ stage, ...meta }, `[stage] ${stage}`);
}

// Legacy export — kept for backward compatibility with server.mjs
export const logger = {
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
};
