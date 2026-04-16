export async function issueRoutes(fastify, opts) {
  const { issueReportService } = opts;

  fastify.post("/v1/issues/report", {
    schema: {
      body: {
        type: "object",
        required: ["reportText"],
        properties: {
          reportText: { type: "string", minLength: 1, maxLength: 2000 },
          userId: { type: "string", nullable: true },
          conversationId: { type: "string", nullable: true },
          spiritkinName: { type: "string", nullable: true },
          sessionId: { type: "string", nullable: true },
          sourceContext: { type: "string", nullable: true, maxLength: 120 },
          currentFeature: { type: "string", nullable: true, maxLength: 120 },
        },
      },
    },
  }, async (req, reply) => {
    if (!issueReportService) {
      return reply.code(503).send({
        ok: false,
        error: "SERVICE_UNAVAILABLE",
        message: "Issue report service unavailable.",
      });
    }

    try {
      const result = await issueReportService.reportIssue({
        userId: req.body.userId ?? null,
        conversationId: req.body.conversationId ?? null,
        spiritkinName: req.body.spiritkinName ?? null,
        sessionId: req.body.sessionId ?? null,
        input: req.body.reportText,
        source: "user_report",
        sourceContext: req.body.sourceContext ?? "explicit_user_report",
        currentFeature: req.body.currentFeature ?? null,
      });

      return {
        ok: true,
        captured: result.captured,
        classification: result.classification,
        record: result.record ?? null,
      };
    } catch (err) {
      return reply.code(400).send({
        ok: false,
        error: "ISSUE_REPORT_ERROR",
        message: err.message,
      });
    }
  });
}
