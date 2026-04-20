function buildSpiritCoreWelcomeGreeting({ userName, returning = false, primarySpiritkinName = null }) {
  const safeName = String(userName || "").trim() || "traveler";
  if (returning && primarySpiritkinName) {
    return `${safeName}, the Crown Gate recognizes your return. SpiritCore holds your path open, and ${primarySpiritkinName} remains within the bonded chambers beyond this threshold. Enter founder selection only if you intend to witness the realm again before speaking.`;
  }
  if (returning) {
    return `${safeName}, the Crown Gate recognizes your return. SpiritCore receives your name, steadies the world around you, and opens the founders so the next bond decision is made with full witness.`;
  }
  return `${safeName}, SpiritCore receives your name and records your arrival. The Gate is open, the founders are waiting, and you may now meet them one by one before confirming the bond that will hold the center of your Spiritverse.`;
}

export async function spiritCoreRoutes(fastify) {
  fastify.post("/v1/spiritcore/welcome", {
    schema: {
      body: {
        type: "object",
        required: ["userId", "userName"],
        properties: {
          userId: { type: "string", minLength: 1 },
          userName: { type: "string", minLength: 1 },
          returning: { type: "boolean", nullable: true },
          primarySpiritkinName: { type: "string", nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body || {};
    const userName = String(body.userName || "").trim();
    if (!userName) {
      return reply.code(400).send({ ok: false, error: "NAME_REQUIRED", message: "A user name is required for SpiritCore greeting." });
    }
    return {
      ok: true,
      greeting: buildSpiritCoreWelcomeGreeting({
        userName,
        returning: !!body.returning,
        primarySpiritkinName: body.primarySpiritkinName || null,
      }),
    };
  });
}
