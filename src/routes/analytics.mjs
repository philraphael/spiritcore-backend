/**
 * SpiritCore — Analytics & Feedback Routes
 *
 * POST /v1/feedback                  — submit user feedback
 * POST /v1/analytics/event           — log a behavioral session event
 * GET  /v1/analytics/spiritkin/:name — per-spiritkin metrics
 * GET  /v1/analytics/summary         — aggregate summary across all spiritkins
 */

export async function analyticsRoutes(fastify, opts) {
  const { feedbackService, analyticsService, supabase } = opts;

  // ── POST /v1/feedback ──────────────────────────────────────────────────────
  fastify.post("/v1/feedback", {
    schema: {
      body: {
        type: "object",
        required: ["userId", "spiritkinName"],
        properties: {
          userId:             { type: "string", minLength: 1 },
          conversationId:     { type: "string", nullable: true },
          spiritkinName:      { type: "string", minLength: 1 },
          rating:             { type: "number", minimum: 1, maximum: 5, nullable: true },
          helpful:            { type: "boolean", nullable: true },
          emotionalResonance: { type: "string", nullable: true },
          freeText:           { type: "string", maxLength: 2000, nullable: true },
          messageId:          { type: "string", nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const result = await feedbackService.submit(req.body);
      return { ok: true, ...result };
    } catch (err) {
      return reply.code(400).send({ ok: false, error: "FEEDBACK_ERROR", message: err.message });
    }
  });

  // ── POST /v1/analytics/event ───────────────────────────────────────────────
  fastify.post("/v1/analytics/event", {
    schema: {
      body: {
        type: "object",
        required: ["userId", "eventType"],
        properties: {
          userId:            { type: "string", minLength: 1 },
          conversationId:    { type: "string", nullable: true },
          spiritkinName:     { type: "string", nullable: true },
          eventType:         { type: "string", enum: ["start", "end", "spiritkin_selected", "first_message", "abandon"] },
          firstMessageDelay: { type: "number", nullable: true },
          sessionDurationMs: { type: "number", nullable: true },
          messageCount:      { type: "number", nullable: true },
          metadata:          { type: "object", nullable: true },
        },
      },
    },
  }, async (req, reply) => {
    try {
      analyticsService.logSessionEvent(req.body);
      return { ok: true };
    } catch (err) {
      return reply.code(400).send({ ok: false, error: "EVENT_ERROR", message: err.message });
    }
  });

  // ── GET /v1/analytics/spiritkin/:name ──────────────────────────────────────
  fastify.get("/v1/analytics/spiritkin/:name", async (req, reply) => {
    const { name } = req.params;
    try {
      const { data, error } = await supabase
        .from("spiritkin_metrics")
        .select("*")
        .eq("spiritkin_name", name)
        .single();

      if (error || !data) {
        return reply.code(404).send({ ok: false, error: "NOT_FOUND", message: `No metrics for spiritkin: ${name}` });
      }
      return { ok: true, metrics: data };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "INTERNAL", message: err.message });
    }
  });

  // ── GET /v1/analytics/summary ─────────────────────────────────────────────
  fastify.get("/v1/analytics/summary", async (req, reply) => {
    try {
      const { data: metrics, error: metricsErr } = await supabase
        .from("spiritkin_metrics")
        .select("*")
        .order("total_interactions", { ascending: false });

      if (metricsErr) throw new Error(metricsErr.message);

      // Aggregate totals
      const totalInteractions = (metrics ?? []).reduce((s, m) => s + (m.total_interactions ?? 0), 0);
      const totalSessions     = (metrics ?? []).reduce((s, m) => s + (m.total_sessions ?? 0), 0);
      const totalFeedback     = (metrics ?? []).reduce((s, m) => s + (m.total_feedback_count ?? 0), 0);

      // Recent interaction count (last 24h)
      const since24h = new Date(Date.now() - 86400000).toISOString();
      const { count: recent24h } = await supabase
        .from("analytics_interactions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24h);

      return {
        ok: true,
        summary: {
          total_interactions: totalInteractions,
          total_sessions:     totalSessions,
          total_feedback:     totalFeedback,
          interactions_last_24h: recent24h ?? 0,
        },
        spiritkins: metrics ?? [],
      };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: "INTERNAL", message: err.message });
    }
  });
}
