export const entitlementsRoutes = async (app) => {
  app.get(
    "/entitlements/check",
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
      const result = await app.entitlements.check({ userId });
      return result;
    }
  );
};
