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
      max: config.rateLimit.adapterMax,
      timeWindow: config.rateLimit.timeWindowMs,
    },
  };
}
