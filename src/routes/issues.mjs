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
        recovery: {
          user_message: "Issue reporting is temporarily unavailable. Refresh once, then try again.",
          diagnostics: ["If this persists, capture the visible build marker and the failing room or feature."],
        },
      });
    }

    try {
      const payload = normalizeIssueReportPayload(req.body);
      if (!payload.reportText) {
        return reply.code(400).send({
          ok: false,
          error: "ISSUE_REPORT_ERROR",
          message: "Report text is required.",
          recovery: {
            user_message: "Add a short description of what failed before sending the report.",
            diagnostics: ["Include the room or feature where the issue occurred."],
          },
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

      const responseMessage = result.captured
        ? "Your report was logged for owner review."
        : "Your note was received, but it did not enter the repair queue.";

      return {
        ok: true,
        captured: result.captured,
        message: responseMessage,
        classification: result.classification,
        record: result.record ?? null,
        recovery: {
          user_message: result.record?.storage === "memory"
            ? "The report was captured in temporary fallback storage while persistence recovers."
            : "If the issue repeats, include the exact room, feature, and visible build marker in the next report.",
          diagnostics: result.record?.storage === "memory"
            ? ["Fallback storage is active for this report. Verify persistence health before treating queue counts as complete."]
            : ["Use the admin repair review surfaces to inspect clustering and packet priority."],
        },
      };
    } catch (err) {
      const message = err?.message || "Issue report could not be submitted.";
      const limitReached = /3 reports per day|report limit/i.test(message);
      return reply.code(limitReached ? 429 : 400).send({
        ok: false,
        error: limitReached ? "DAILY_REPORT_LIMIT" : "ISSUE_REPORT_ERROR",
        message,
        recovery: {
          user_message: limitReached
            ? "You have reached the current report cap. Retry tomorrow or collect details for a single fuller report."
            : "Refresh once, then retry the exact action. If it still fails, capture the visible error text and build marker.",
          diagnostics: limitReached
            ? ["Current beta report cap remains 3 user reports per UTC day."]
            : ["If the failure blocks interaction, note whether it happened during boot, render, or a specific click or submit action."],
        },
      });
    }
  });
}
