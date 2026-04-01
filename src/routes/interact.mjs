export const interactRoutes = async (app) => {
  app.post(
    "/interact",
    {
      schema: {
        body: {
          type: "object",
          required: ["userId", "input"],
          properties: {
            userId: { type: "string", minLength: 1 },
            input: { type: "string", minLength: 1, maxLength: 4000 },
            spiritkin: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string" },
                name: { type: "string" }
              }
            },
            conversationId: { type: "string", nullable: true },
            context: { type: "object", nullable: true },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId, input, spiritkin, conversationId, context } = req.body;
      const t0 = Date.now();
      try {
        const result = await app.orchestrator.interact({
          userId,
          input,
          spiritkin,
          conversationId: conversationId ?? null,
          context,
        });
        // ── Non-blocking analytics hook (fire-and-forget) ──
        if (app.analyticsService) {
          app.analyticsService.logInteraction({
            userId,
            spiritkinName:  result.spiritkin ?? spiritkin?.name ?? "unknown",
            conversationId: result.metadata?.conversationId ?? conversationId ?? null,
            inputLength:    input.length,
            responseLength: (result.message ?? "").length,
            latencyMs:      Date.now() - t0,
            success:        result.ok !== false,
            safetyTier:     result.safety?.tier ?? null,
            traceId:        result.traceId ?? null,
          });
        }
        return result;
      } catch (err) {
        if (app.analyticsService) {
          app.analyticsService.logInteraction({
            userId,
            spiritkinName:  spiritkin?.name ?? "unknown",
            conversationId: conversationId ?? null,
            inputLength:    input.length,
            responseLength: 0,
            latencyMs:      Date.now() - t0,
            success:        false,
          });
        }
        const code = err.httpCode ?? 500;
        return reply.code(code).send({
          ok: false,
          error: err.code ?? "INTERNAL",
          message: err.message ?? "An unexpected error occurred.",
        });
      }
    }
  );
};
