export async function sessionRoutes(fastify, opts) {
  const { sessionControlService } = opts;

  fastify.get("/v1/session/snapshot", {
    schema: {
      querystring: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: { type: "string", minLength: 1 },
          conversationId: { type: "string", nullable: true },
          spiritkinName: { type: "string", nullable: true },
          currentSurface: { type: "string", nullable: true },
          currentMode: { type: "string", nullable: true },
          activeTab: { type: "string", nullable: true },
          messageLimit: { type: "integer", nullable: true, minimum: 1, maximum: 100 },
        },
      },
    },
  }, async (req, reply) => {
    if (!sessionControlService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Session control unavailable." });
    }

    try {
      return await sessionControlService.getSnapshot(req.query || {});
    } catch (err) {
      console.error("[SessionRoute] snapshot failed", {
        query: req.query || {},
        message: err?.message || String(err),
      });
      const code = err.httpCode ?? 500;
      return reply.code(code).send({
        ok: false,
        error: err.code ?? "SESSION_SNAPSHOT_ERROR",
        message: err.message,
      });
    }
  });

  fastify.post("/v1/session/control", {
    schema: {
      body: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: { type: "string", minLength: 1 },
          conversationId: { type: "string", nullable: true },
          currentSpiritkinName: { type: "string", nullable: true },
          currentSurface: { type: "string", nullable: true },
          currentMode: { type: "string", nullable: true },
          activeTab: { type: "string", nullable: true },
          speechState: {
            type: "object",
            nullable: true,
            properties: {
              isSpeaking: { type: "boolean", nullable: true },
              isListening: { type: "boolean", nullable: true },
              isPaused: { type: "boolean", nullable: true },
              lastUtteranceId: { type: "string", nullable: true },
              turnPhase: { type: "string", nullable: true },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    if (!sessionControlService) {
      return reply.code(503).send({ ok: false, error: "SERVICE_UNAVAILABLE", message: "Session control unavailable." });
    }

    try {
      return await sessionControlService.updateControl(req.body || {});
    } catch (err) {
      console.error("[SessionRoute] control failed", {
        body: req.body || {},
        message: err?.message || String(err),
      });
      try {
        return await sessionControlService.getSnapshot({
          userId: req.body?.userId,
          conversationId: req.body?.conversationId ?? null,
          spiritkinName: req.body?.currentSpiritkinName ?? null,
          currentSurface: req.body?.currentSurface ?? null,
          currentMode: req.body?.currentMode ?? null,
          activeTab: req.body?.activeTab ?? null,
          speechStateOverride: req.body?.speechState ?? null,
        });
      } catch (_) {}
      const code = err.httpCode ?? 500;
      return reply.code(code).send({
        ok: false,
        error: err.code ?? "SESSION_CONTROL_ERROR",
        message: err.message,
      });
    }
  });
}
