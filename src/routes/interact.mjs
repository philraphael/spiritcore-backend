import { adapterRateLimitConfig } from "../middleware/rateLimiter.mjs";

export const interactRoutes = async (app) => {
  app.post(
    "/interact",
    {
      config: adapterRateLimitConfig(),
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
      const t0 = Date.now();
      try {
        if (app.sessionControlService) {
          app.sessionControlService.updateControl({
            userId,
            conversationId: conversationId ?? null,
            currentSpiritkinName: spiritkin?.name ?? null,
            currentSurface: context?.surfaceContext?.activeSurface ?? context?.activeTab ?? context?.currentFeature ?? "profile",
            currentMode: context?.activeGameType ? "game" : "conversation",
            activeTab: context?.surfaceContext?.activeTab ?? context?.activeTab ?? null,
            speechState: {
              ...(context?.speechState || {}),
              turnPhase: "processing",
            },
            requestContext: context || null,
          }).catch(() => {});
        }

        const result = await app.orchestrator.interact({
          userId,
          input,
          spiritkin,
          conversationId: conversationId ?? null,
          context,
        });
        // ── Non-blocking analytics hook (fire-and-forget) ──
        if (app.analyticsService) {
          app.analyticsService.logInteraction({
            userId,
            spiritkinName:  result.spiritkin ?? spiritkin?.name ?? "unknown",
            conversationId: result.metadata?.conversationId ?? conversationId ?? null,
            inputLength:    input.length,
            responseLength: (result.message ?? "").length,
            latencyMs:      Date.now() - t0,
            success:        result.ok !== false,
            safetyTier:     result.safety?.tier ?? null,
            traceId:        result.traceId ?? null,
          });
        }

        if (app.issueReportService) {
          app.issueReportService.captureFromInteraction({
            userId,
            conversationId: result.metadata?.conversationId ?? conversationId ?? null,
            spiritkinName: result.spiritkin ?? spiritkin?.name ?? "unknown",
            input,
            source: "interact",
            currentFeature: context?.activeTab ?? context?.currentFeature ?? context?.feature ?? null,
          }).catch(() => {});
        }

        if (app.sessionControlService) {
          const activeGame = result.metadata?.world?.game || null;
          const sessionSnapshot = await app.sessionControlService.updateControl({
            userId,
            conversationId: result.metadata?.conversationId ?? conversationId ?? null,
            currentSpiritkinName: result.spiritkin ?? spiritkin?.name ?? null,
            currentSurface: activeGame?.status === "active"
              ? "games"
              : (context?.surfaceContext?.activeSurface ?? context?.activeTab ?? "profile"),
            currentMode: activeGame?.status === "active" ? "game" : "conversation",
            activeTab: activeGame?.status === "active"
              ? "games"
              : (context?.surfaceContext?.activeTab ?? context?.activeTab ?? "profile"),
            speechState: {
              ...(context?.speechState || {}),
              isSpeaking: false,
              isListening: false,
              isPaused: false,
              turnPhase: "spirit_response",
            },
            requestContext: context || null,
          }).catch(() => null);

          if (sessionSnapshot?.session) {
            result.session = sessionSnapshot.session;
          }
        }
        return result;
      } catch (err) {
        if (app.analyticsService) {
          app.analyticsService.logInteraction({
            userId,
            spiritkinName:  spiritkin?.name ?? "unknown",
            conversationId: conversationId ?? null,
            inputLength:    input.length,
            responseLength: 0,
            latencyMs:      Date.now() - t0,
            success:        false,
          });
        }
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
