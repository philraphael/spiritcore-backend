export const memoryRoutes = async (app) => {
  app.get(
    "/memory/query",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", minLength: 1 },
            spiritkinId: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 100 }
          }
        }
      }
    },
    async (req) => {
      const { userId, spiritkinId, limit } = req.query;
      const rows = await app.memory.query({ userId, spiritkinId, limit });
      return { ok: true, rows };
    }
  );

  app.get(
    "/memory/policy",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["userId"],
          properties: { userId: { type: "string", minLength: 1 } }
        }
      }
    },
    async (req) => {
      const { userId } = req.query;
      const policyState = await app.memory.computePolicyState({ userId });
      return { ok: true, policyState, policy: app.memoryPolicy };
    }
  );
};
