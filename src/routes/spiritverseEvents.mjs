/**
 * SpiritCore — Shared Spiritverse Events Route
 *
 * GET /v1/spiritverse/events/current
 *   Returns the currently active Spiritverse event (filtered by user's bond stage).
 *   Query params: userId (optional), bondStage (optional, 0-5)
 *
 * GET /v1/spiritverse/events/all
 *   Returns all events in the catalog (for admin/display).
 */

import {
  getCurrentEvent,
  getEventForUser,
  getNextEvent,
  getAllEvents,
} from "../services/spiritverseEvents.mjs";

export async function spiritverseEventRoutes(fastify) {
  /**
   * GET /v1/spiritverse/events/current
   * Returns the active event for the requesting user.
   */
  fastify.get("/v1/spiritverse/events/current", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          bondStage: { type: "integer", minimum: 0, maximum: 5 },
        }
      }
    }
  }, async (req, reply) => {
    const bondStage = parseInt(req.query.bondStage ?? "0", 10) || 0;

    const event = getEventForUser({ bondStage });
    const next = getNextEvent();

    return reply.send({
      ok: true,
      event: event ?? null,
      next: {
        hoursUntil: next.hoursUntil,
        minutesUntil: next.minutesUntil,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /v1/spiritverse/events/all
   * Returns all events in the catalog.
   */
  fastify.get("/v1/spiritverse/events/all", async (req, reply) => {
    return reply.send({
      ok: true,
      events: getAllEvents(),
      current: getCurrentEvent(),
    });
  });
}
