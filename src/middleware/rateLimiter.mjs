/**
 * SpiritCore — Rate Limiter (Phase F)
 *
 * Registers @fastify/rate-limit (already installed) with per-user keying.
 * Falls back to IP-based keying when userId is not available.
 *
 * Two tiers:
 *   - Global:  config.rateLimit.max requests per timeWindowMs (default: 120/min)
 *   - Adapter: config.rateLimit.adapterMax per timeWindowMs (default: 30/min)
 *              Applied specifically to /v1/interact to protect LLM adapter calls.
 */

import rateLimit from "@fastify/rate-limit";
import { config } from "../config.mjs";

/**
 * Register the global rate limiter on the Fastify instance.
 * Call this in server.mjs before registering routes.
 *
 * @param {import("fastify").FastifyInstance} app
 */
export async function registerRateLimiter(app) {
  await app.register(rateLimit, {
    global: true,
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindowMs,

    // Key by userId from request body, fall back to IP
    keyGenerator(req) {
      // Try to extract userId from the parsed body (available after content-type parsing)
      const userId = req.body?.userId ?? req.headers["x-user-id"];
      if (userId && typeof userId === "string" && userId.length > 0) {
        return `user:${userId}`;
      }
      // Fall back to IP
      return `ip:${req.ip}`;
    },

    // Return a clean error response on rate limit
    errorResponseBuilder(req, context) {
      return {
        ok: false,
        error: "RATE_LIMIT",
        message: `Too many requests. Limit: ${context.max} per ${context.after}. Try again later.`,
        retryAfter: context.ttl,
      };
    },

    // Add standard rate limit headers
    addHeaders: {
      "x-ratelimit-limit":     true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset":     true,
      "retry-after":           true,
    },
  });

  app.log.info(`[SpiritCore] Rate limiter registered: ${config.rateLimit.max} req/${config.rateLimit.timeWindowMs}ms (per user)`);
}

/**
 * Route-level rate limit config for adapter/generation calls.
 * Apply directly to the /v1/interact route schema config.
 *
 * Usage in route:
 *   app.post("/interact", { config: adapterRateLimitConfig() }, handler)
 */
export function adapterRateLimitConfig() {
  return {
    rateLimit: {
      // /v1/interact identifies callers by body.userId, so this route-specific
      // limiter must run after body parsing instead of inheriting the global
      // onRequest timing.
      hook: "preHandler",
      max: config.rateLimit.adapterMax,
      timeWindow: config.rateLimit.timeWindowMs,
      errorResponseBuilder(req, context) {
        return {
          statusCode: 429,
          ok: false,
          error: "RATE_LIMIT",
          message: `Interaction limit reached. Limit: ${context.max} per ${context.after}. Please pause briefly and try again.`,
          retryAfter: context.ttl,
        };
      },
      onExceeded(req, key) {
        req.log.warn({
          route: req.routeOptions?.url ?? req.url,
          method: req.method,
          rate_limit_key: key,
          user_id: req.body?.userId ?? req.headers["x-user-id"] ?? null,
        }, "[rate-limit] interact throttled");
      },
    },
  };
}

export function speechRateLimitConfig() {
  return {
    rateLimit: {
      hook: "preHandler",
      max: Math.max(1, Math.min(config.rateLimit.adapterMax, 20)),
      timeWindow: config.rateLimit.timeWindowMs,
      errorResponseBuilder(req, context) {
        return {
          statusCode: 429,
          ok: false,
          error: {
            code: "RATE_LIMIT",
            message: `Speech synthesis limit reached. Limit: ${context.max} per ${context.after}. Please pause briefly and try again.`,
            retryAfter: context.ttl,
          },
        };
      },
      onExceeded(req, key) {
        req.log.warn({
          route: req.routeOptions?.url ?? req.url,
          method: req.method,
          rate_limit_key: key,
          user_id: req.body?.userId ?? req.headers["x-user-id"] ?? null,
        }, "[rate-limit] speech throttled");
      },
    },
  };
}
