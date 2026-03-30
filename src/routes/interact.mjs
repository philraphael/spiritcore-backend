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
      try {
        const result = await app.orchestrator.interact({
          userId,
          input,
          spiritkin,
          conversationId: conversationId ?? null,
          context,
        });
        return result;
      } catch (err) {
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
