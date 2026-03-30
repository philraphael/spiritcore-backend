export const worldRoutes = async (app) => {
  app.get(
    "/world/state",
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
      const snap = await app.world.get({ userId });
      return { ok: true, ...snap };
    }
  );

  app.post(
    "/world/state",
    {
      schema: {
        body: {
          type: "object",
          required: ["userId", "state"],
          properties: {
            userId: { type: "string", minLength: 1 },
            state: { type: "object" }
          }
        }
      }
    },
    async (req) => {
      const { userId, state } = req.body;
      await app.world.upsert({ userId, state });
      return { ok: true };
    }
  );
};
