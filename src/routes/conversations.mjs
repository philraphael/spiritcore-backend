/**
 * SpiritCore — Conversations Routes (Phase D)
 *
 * POST /v1/conversations          — bootstrap a new conversation
 * GET  /v1/conversations/:userId  — list conversations for a user
 */

export async function conversationRoutes(fastify, opts) {
  const { conversationService, analyticsService, engagementEngine } = opts;

  /**
   * POST /v1/conversations
   * Bootstrap a new conversation linked to a canonical Spiritkin.
   */
  fastify.post("/v1/conversations", {
    schema: {
      body: {
        type: "object",
        required: ["userId", "spiritkinName"],
        properties: {
          userId:       { type: "string", minLength: 1 },
          spiritkinName: { type: "string", minLength: 1 },
          title:        { type: "string", nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    const { userId, spiritkinName, title } = req.body;
    try {
      const result = await conversationService.bootstrap({ userId, spiritkinName, title });

      // ── Engagement state: whisper, wellness nudge, bond milestones ──
      let engagement = null;
      if (engagementEngine?.getEngagementState) {
        try {
          engagement = await engagementEngine.getEngagementState({
            userId,
            spiritkinId: result?.spiritkin_id ?? null,
            spiritkinName,
            conversationId: result?.conversation_id ?? null,
          });
        } catch (_) {
          // Non-critical — never block bootstrap
        }
      }

      // ── Non-blocking session start event ──
      if (analyticsService) {
        analyticsService.logSessionEvent({
          userId,
          conversationId: result?.conversation_id ?? null,
          spiritkinName,
          eventType: "start",
        });
      }
      return { ok: true, conversation: result, engagement };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({ ok: false, error: err.code ?? "INTERNAL", message: err.message });
    }
  });

  /**
   * GET /v1/conversations/:userId
   * List recent conversations for a user.
   */
  fastify.get("/v1/conversations/:userId", async (req, reply) => {
    const { userId } = req.params;
    const limit = Math.min(Number(req.query?.limit ?? 20), 100);
    try {
      const conversations = await conversationService.listForUser({ userId, limit });
      return { ok: true, count: conversations.length, conversations };
    } catch (err) {
      const code = err.httpCode ?? 500;
      return reply.code(code).send({ ok: false, error: err.code ?? "INTERNAL", message: err.message });
    }
  });
}
