/**
 * SpiritCore — Conversations Routes (Phase D)
 *
 * POST /v1/conversations          — bootstrap a new conversation
 * GET  /v1/conversations/:userId  — list conversations for a user
 */

function buildOpeningGreeting(spiritkinName, userName = "") {
  const normalized = String(spiritkinName || "").trim();
  const normalizedName = String(userName || "").trim();
  const greetings = {
    Lyra: "This is our first conversation. I'd like to know: what brought you here today?",
    Raien: "New energy. New possibilities. What's calling you?",
    Kairo: "A new thread in the tapestry. What does it feel like?",
    Elaria: "A new record is opening. What truth belongs here first?",
    Thalassar: "The tide is new tonight. What rises first when you listen inward?",
  };
  const greeting = greetings[normalized] || "This is our first conversation. What brought you here today?";
  return normalizedName ? `${normalizedName}, ${greeting}` : greeting;
}

export async function conversationRoutes(fastify, opts) {
  const { conversationService, analyticsService, engagementEngine, messageService, sessionControlService } = opts;

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
          userName:     { type: "string", nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    const { userId, spiritkinName, title, userName } = req.body;
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

      if (messageService && result?.conversation_id) {
        const greetingText = buildOpeningGreeting(spiritkinName, userName);
        await messageService.persist({
          conversationId: result.conversation_id,
          role: "assistant",
          content: greetingText,
        }).catch(() => null);
      }

      let session = null;
      if (sessionControlService) {
        session = await sessionControlService.updateControl({
          userId,
          conversationId: result?.conversation_id ?? null,
          currentSpiritkinName: spiritkinName,
          currentSurface: "profile",
          currentMode: "conversation",
          activeTab: "profile",
          speechState: { turnPhase: "idle", lastUtteranceId: null },
        }).catch(() => null);

        if (!session?.session) {
          session = await sessionControlService.getSnapshot({
            userId,
            conversationId: result?.conversation_id ?? null,
            spiritkinName,
            currentSurface: "profile",
            currentMode: "conversation",
          }).catch(() => null);
        }
      }

      return { ok: true, conversation: result, engagement, session: session?.session || null };
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
