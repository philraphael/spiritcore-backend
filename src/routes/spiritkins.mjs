/**
 * SpiritCore — Spiritkins Registry Routes
 *
 * GET /v1/spiritkins          — list all canonical Spiritkins
 * GET /v1/spiritkins/:name    — fetch a single canonical Spiritkin by name
 *
 * These are read-only, public endpoints. They expose the authoritative
 * canonical identity definitions from the Spiritkin Registry.
 */

export async function spiritkinRoutes(fastify, opts) {
  const { registry } = opts;

  /**
   * GET /v1/spiritkins
   * Returns all canonical Spiritkins from the registry.
   */
  fastify.get("/v1/spiritkins", async (req, reply) => {
    try {
      const spiritkins = await registry.listCanonical();
      return {
        ok: true,
        count: spiritkins.length,
        spiritkins,
      };
    } catch (err) {
      req.log.error(err, "[spiritkins] listCanonical failed");
      return reply.code(500).send({
        ok: false,
        error: "INTERNAL",
        message: "Failed to load Spiritkin registry.",
      });
    }
  });

  /**
   * GET /v1/spiritkins/:name
   * Returns a single canonical Spiritkin by name (case-insensitive).
   */
  fastify.get("/v1/spiritkins/:name", async (req, reply) => {
    const { name } = req.params;
    try {
      const identity = await registry.getCanonical(name);
      if (!identity) {
        return reply.code(404).send({
          ok: false,
          error: "NOT_FOUND",
          message: `No canonical Spiritkin found with name "${name}".`,
        });
      }
      return { ok: true, spiritkin: identity };
    } catch (err) {
      req.log.error(err, `[spiritkins] getCanonical failed for name="${name}"`);
      return reply.code(500).send({
        ok: false,
        error: "INTERNAL",
        message: "Failed to resolve Spiritkin identity.",
      });
    }
  });
}
