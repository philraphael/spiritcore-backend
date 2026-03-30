/**
 * SpiritCore — Unified Orchestrator (Phase E)
 *
 * The authoritative 12-stage request-to-response pipeline.
 *
 * Stages:
 *   1.  Auth/input validation
 *   2.  Conversation lookup or bootstrap
 *   3.  Spiritkin identity resolution (registry-driven, never hardcoded)
 *   4.  Entitlements, context assembly, world state (parallel)
 *   5.  Memory policy check
 *   6.  (reserved)
 *   7.  Safety pre-pass (Phase E — real implementation)
 *   8.  Persist inbound message to messages ledger
 *   9.  Adapter/model generation
 *   10. Identity governance + drift check
 *   11. Safety post-pass (Phase E — real implementation) + persist outbound message
 *   12. Structured response back to caller
 *
 * PHASE C: hardcoded Lyra default removed.
 * PHASE D: full pipeline, DI wiring, context assembly, safety hook stubs.
 * PHASE E: real safety governor wired in; message persistence corrected to
 *          messages ledger (messageService) — memoryService is for derived
 *          artifacts only, not raw chat transcript.
 */

/**
 * PHASE F: Added timeout guard, structured logging, metrics, and standardized
 * response contract { ok, traceId, spiritkin, message, safety?, metadata? }.
 */
import { AppError, TimeoutError } from "../errors.mjs";
import { createId }               from "../utils/id.mjs";
import { withTimeout }            from "../utils/timeout.mjs";
import { createTraceLogger, logStage } from "../logger.mjs";
import { incrementMetric }        from "../routes/health.mjs";
import { config }                 from "../config.mjs";

export const createOrchestrator = ({
  bus,
  adapters,
  entitlements,
  memory,
  world,
  identityGovernor,
  conversationService,
  contextService,
  emotionService,
  episodeService,
  messageService,   // Phase E: authoritative message ledger
  safetyGovernor,   // Phase E: real safety governor
}) => {

  /**
   * Main interaction entry point.
   *
   * @param {{ userId, input, spiritkin?, conversationId?, context? }} opts
   */
  const interact = async ({ userId, input, spiritkin, conversationId, context = {} }) => {

    // ── Stage 1: Validate inputs ──────────────────────────────────────────────
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    if (!input || typeof input !== "string") throw new AppError("VALIDATION", "input is required", 400);

    const traceId = createId("trc");
    const log     = createTraceLogger({ traceId, service: "orchestrator" });
    incrementMetric("requestsTotal");
    bus.emit("orchestrator.start", { traceId, userId });
    logStage(log, "start", { userId });

    // ── Stage 2: Conversation lookup or bootstrap ─────────────────────────────
    logStage(log, "conversation_lookup");
    let conversation = null;
    let resolvedSpiritkinHint = spiritkin;

    if (conversationId) {
      try {
        conversation = await conversationService.resolveByConversation(conversationId);
        if (conversation.spiritkin_id && !resolvedSpiritkinHint?.id) {
          resolvedSpiritkinHint = { id: conversation.spiritkin_id };
        }
      } catch (err) {
        console.warn(`[Orchestrator] Conversation lookup failed: ${err.message}`);
        bus.emit("orchestrator.conversation.miss", { traceId, conversationId });
      }
    }

    bus.emit("orchestrator.conversation.resolved", {
      traceId,
      conversationId: conversation?.conversation_id ?? null,
    });

    // ── Stage 3: Spiritkin identity resolution ────────────────────────────────
    logStage(log, "identity_resolution");
    const resolvedIdentity = await identityGovernor.resolveOrFallback({
      id: resolvedSpiritkinHint?.id,
      name: resolvedSpiritkinHint?.name,
    });
    identityGovernor.assertValid(resolvedIdentity);
    bus.emit("orchestrator.identity.resolved", {
      traceId,
      spiritkin: resolvedIdentity.name,
      role: resolvedIdentity.role,
    });

    const spiritkinId = resolvedIdentity.id ?? null;
    const convId = conversation?.conversation_id ?? null;

    // ── Stage 4: Entitlements, context assembly, world state (parallel) ───────
    logStage(log, "context_assembly");
    const [entitlement, contextBundle, worldSnap] = await Promise.all([
      entitlements.check({ userId }),
      contextService.buildContext({
        userId,
        spiritkinId,
        conversationId: convId,
        recentText: input,
        policy: {},
      }),
      world.get({ userId }),
    ]);

    bus.emit("orchestrator.entitlements", { traceId, status: entitlement.status, plan: entitlement.plan });
    bus.emit("orchestrator.context.built", { traceId, memoriesCount: contextBundle.memories?.length ?? 0 });

    const scene = worldSnap.state.scene || { name: "default" };
    let nextWorldState = worldSnap.state;

    if (input.toLowerCase().includes("reset scene")) {
      nextWorldState = { ...worldSnap.state, scene: { name: "default" } };
      await world.upsert({ userId, state: nextWorldState });
      bus.emit("orchestrator.scene.transition", { traceId, to: "default" });
    }

    // ── Stage 5: Memory policy check ─────────────────────────────────────────
    const policyState = await memory.computePolicyState({ userId });
    bus.emit("orchestrator.memory.policy", { traceId, policyState });

    // ── Stage 7: Safety Pre-Pass ──────────────────────────────────────────────
    logStage(log, "safety_prepass");
    let safetyPreResult;
    if (safetyGovernor) {
      safetyPreResult = await safetyGovernor.prePass({
        userId,
        conversationId: convId,
        input,
        identity: resolvedIdentity,
        traceId,
      });
    } else {
      safetyPreResult = { pass: true, tier: 0, label: "clear", action: "continue" };
    }

    bus.emit("orchestrator.safety.prepass", {
      traceId,
      pass: safetyPreResult.pass,
      tier: safetyPreResult.tier,
      label: safetyPreResult.label,
      action: safetyPreResult.action,
    });

    // If pre-pass hard-blocks (acute crisis), return escalation response immediately
    if (!safetyPreResult.pass) {
      incrementMetric("safetyEscalations");
      log.warn({ stage: "safety_escalation", tier: safetyPreResult.tier }, "[safety] Acute crisis escalation");
      if (messageService && convId) {
        await messageService.persist({ conversationId: convId, role: "user", content: input }).catch(() => {});
      }
      incrementMetric("requestsOk");
      // ── Canonical Phase F response contract ──
      return {
        ok:       true,
        traceId,
        spiritkin: resolvedIdentity.name,
        message:  safetyPreResult.escalationResponse,
        safety:   { tier: safetyPreResult.tier, label: safetyPreResult.label, escalated: true },
        metadata: {
          conversationId: convId,
          role:           resolvedIdentity.role,
          tags:           ["safety_escalation"],
          emotion:        { label: "grounded" },
        },
      };
    }

    // ── Stage 8: Persist inbound message to authoritative messages ledger ─────
    // PHASE E CORRECTION: raw chat transcript goes to messageService (messages table),
    // NOT to memoryService. memoryService is for derived memory artifacts only.
    if (messageService && convId) {
      await messageService.persist({
        conversationId: convId,
        role: "user",
        content: input,
      }).catch(err => console.warn("[Orchestrator] message persist (in) failed:", err.message));
    }

    // ── Stage 9: Adapter/model generation ────────────────────────────────────
    logStage(log, "adapter_generation");
    incrementMetric("adapterCalls");
    const adapter = adapters.getActive();
    bus.emit("orchestrator.adapter.selected", { traceId, adapter: adapter.name });

    const identityFragment  = identityGovernor.buildPromptFragment(resolvedIdentity);
    const crisisOverride    = identityGovernor.getCrisisOverride(resolvedIdentity);
    const safetyInstruction = safetyPreResult.instruction ?? null;

    // Phase F: wrap adapter call with timeout guard
    const adapterResult = await withTimeout(adapter.generate({
      traceId,
      userId,
      input,
      spiritkin: resolvedIdentity,
      identityFragment,
      crisisOverride,
      safetyInstruction,
      scene,
      context: {
        entitlement,
        policyState,
        world: nextWorldState,
        memories:  contextBundle.memories,
        episodes:  contextBundle.episodes,
        emotion:   contextBundle.emotion,
        summary:   contextBundle.summary_episode,
        ...context,
      },
    }), config.timeouts.adapter, "adapter generation");

    // ── Stage 10: Identity governance / drift check ───────────────────────────
    const governance = identityGovernor.governResponse(resolvedIdentity, adapterResult.text);
    if (governance.driftDetected) {
      bus.emit("orchestrator.drift.detected", {
        traceId,
        spiritkin: resolvedIdentity.name,
        matched: governance.matched,
      });
    }

    // ── Stage 11: Safety Post-Pass ────────────────────────────────────────────
    let finalResponseText = adapterResult.text;
    let safetyPostResult;

    if (safetyGovernor) {
      safetyPostResult = await safetyGovernor.postPass({
        userId,
        conversationId: convId,
        response: adapterResult.text,
        identity: resolvedIdentity,
        prePassResult: safetyPreResult,
        traceId,
      });
      if (safetyPostResult.revised) {
        finalResponseText = safetyPostResult.revisedText;
      }
    } else {
      safetyPostResult = { revised: false, violations: [] };
    }

    bus.emit("orchestrator.safety.postpass", {
      traceId,
      driftDetected: governance.driftDetected,
      revised: safetyPostResult.revised,
      violations: safetyPostResult.violations,
    });

    // ── Stage 11b: Persist outbound message + derived artifacts ──────────────
    await Promise.allSettled([
      // Outbound message to authoritative messages ledger (PHASE E CORRECTION)
      ...(messageService && convId ? [
        messageService.persist({
          conversationId: convId,
          role: "spiritkin",
          content: finalResponseText,
        }),
      ] : []),
      // Emotion state update (derived artifact — stays in emotionService)
      emotionService.updateFromText({
        userId,
        spiritkinId,
        conversationId: convId,
        text: input,
      }),
      // Episode write — narrative arc snapshot (derived artifact)
      ...(policyState.state !== "delete_due" ? [
        episodeService.write({
          userId,
          spiritkinId,
          conversationId: convId,
          text: input,
          emotion: adapterResult.emotion ?? {},
        }),
      ] : []),
    ]);

    bus.emit("orchestrator.complete", { traceId });

    logStage(log, "complete");
    incrementMetric("requestsOk");

    // ── Stage 12: Canonical Phase F response contract ─────────────────────────
    // { ok, traceId, spiritkin, message, safety?, metadata? }
    return {
      ok:       true,
      traceId,
      spiritkin: resolvedIdentity.name,
      message:  finalResponseText,
      safety: {
        tier:     safetyPreResult.tier,
        label:    safetyPreResult.label,
        escalated: false,
        revised:  safetyPostResult.revised,
      },
      metadata: {
        conversationId: convId,
        role:           resolvedIdentity.role,
        tags:           adapterResult.tags,
        emotion:        adapterResult.emotion,
        world:          { scene: nextWorldState?.scene || scene },
        governance: {
          driftDetected: governance.driftDetected,
          matched:       governance.matched,
        },
        entitlement,
        policy: policyState,
      },
    };
  };

  /**
   * Wrap interact with the orchestrator-level timeout guard.
   * Any unhandled error is caught, logged, and returned as a stable error envelope.
   */
  const safeInteract = async (opts) => {
    const traceId = createId("trc");
    try {
      return await withTimeout(
        interact(opts),
        config.timeouts.orchestrator,
        "orchestrator"
      );
    } catch (err) {
      incrementMetric("requestsError");
      const log = createTraceLogger({ traceId });
      log.error({ error: err.code ?? err.name, msg: err.message }, "[orchestrator] unhandled error");

      // Return stable error envelope — never leak stack traces
      const httpCode = err.httpCode ?? 500;
      return {
        ok:       false,
        traceId,
        spiritkin: opts.spiritkin?.name ?? "unknown",
        message:  err.message ?? "An unexpected error occurred.",
        error:    err.code ?? "INTERNAL",
        httpCode,
      };
    }
  };

  return { interact: safeInteract };
};
