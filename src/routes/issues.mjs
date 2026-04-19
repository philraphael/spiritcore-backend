function normalizeOptionalString(value, { maxLength = 120 } = {}) {
  if (value == null) return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

export function normalizeIssueReportPayload(body = {}) {
  const reportText = String(body.reportText || "").trim().slice(0, 2000);
  return {
    reportText,
    userId: normalizeOptionalString(body.userId, { maxLength: 160 }),
    conversationId: normalizeOptionalString(body.conversationId, { maxLength: 160 }),
    spiritkinName: normalizeOptionalString(body.spiritkinName, { maxLength: 120 }),
    sessionId: normalizeOptionalString(body.sessionId, { maxLength: 160 }),
    sourceContext: normalizeOptionalString(body.sourceContext, { maxLength: 120 }),
    currentFeature: normalizeOptionalString(body.currentFeature, { maxLength: 120 }),
  };
}

export async function issueRoutes(fastify, opts) {
  const { issueReportService, sessionControlService } = opts;

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
          sourceContext: { type: "string", nullable: true, maxLength: 512 },
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
      const payload = normalizeIssueReportPayload(req.body);
      if (!payload.reportText) {
        return reply.code(400).send({
          ok: false,
          error: "ISSUE_REPORT_ERROR",
          message: "Report text is required.",
        });
      }

      const result = await issueReportService.reportIssue({
        userId: payload.userId,
        conversationId: payload.conversationId,
        spiritkinName: payload.spiritkinName,
        sessionId: payload.sessionId,
        input: payload.reportText,
        source: "user_report",
        sourceContext: payload.sourceContext ?? "explicit_user_report",
        currentFeature: payload.currentFeature,
      });

      if (sessionControlService && payload.userId) {
        sessionControlService.updateControl({
          userId: payload.userId,
          conversationId: payload.conversationId,
          currentSpiritkinName: payload.spiritkinName,
          currentSurface: "reporting",
          currentMode: "report",
          activeTab: payload.currentFeature,
          speechState: { turnPhase: "complete" },
        }).catch(() => {});
      }

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
