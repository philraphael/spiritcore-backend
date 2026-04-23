/**
 * SpiritCore — Unified Orchestrator (Phase E/F, world-state schema aligned)
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
 *   7.  Safety pre-pass
 *   8.  Persist inbound message to messages ledger
 *   9.  Adapter/model generation
 *   10. Identity governance + drift check
 *   11. Safety post-pass + persist outbound message
 *   12. Structured response back to caller
 */

import { AppError } from "../errors.mjs";
import { createId } from "../utils/id.mjs";
import { withTimeout } from "../utils/timeout.mjs";
import { createTraceLogger, logStage } from "../logger.mjs";
import { incrementMetric } from "../routes/health.mjs";
import { config } from "../config.mjs";

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
  messageService,
  safetyGovernor,
  memoryExtractor,
  hierarchicalMemoryService,
  structuredMemoryService,
  engagementEngine,
  spiritMemoryEngine,
  responseEngine,
  spiritCoreAdaptiveService,
}) => {
  const interact = async ({ userId, input, spiritkin, conversationId, context = {} }) => {
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    if (!input || typeof input !== "string") {
      throw new AppError("VALIDATION", "input is required", 400);
    }

    const traceId = createId("trc");
    const log = createTraceLogger({ traceId, service: "orchestrator" });

    incrementMetric("requestsTotal");
    bus.emit("orchestrator.start", { traceId, userId });
    logStage(log, "start", { userId });

    // Stage 2: Conversation lookup
    logStage(log, "conversation_lookup");
    let conversation = null;
    let resolvedSpiritkinHint = spiritkin;

    if (conversationId) {
      try {
        conversation = await conversationService.resolveByConversation(conversationId);
        if (conversation?.spiritkin_id && !resolvedSpiritkinHint?.id) {
          resolvedSpiritkinHint = { id: conversation.spiritkin_id };
        }
      } catch (err) {
        console.warn(`[Orchestrator] Conversation lookup failed: ${err.message}`);
        bus.emit("orchestrator.conversation.miss", { traceId, conversationId });
      }
    }

    bus.emit("orchestrator.conversation.resolved", {
      traceId,
      conversationId: conversation?.conversation_id ?? conversationId ?? null,
    });

    // Stage 3: Identity resolution
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
    const convId = conversation?.conversation_id ?? conversationId ?? null;

    if (!convId) {
      throw new AppError("VALIDATION", "conversationId is required", 400);
    }

    // Stage 4: Entitlements, context, world state, memory brief (parallel)
    logStage(log, "context_assembly");
    const [entitlement, contextBundle, worldSnap, memoryBrief] = await Promise.all([
      entitlements.check({ userId }),
      contextService.buildContext({
        userId,
        spiritkinId,
        conversationId: convId,
        recentText: input,
        policy: {},
        spiritkinName: resolvedIdentity.name,
        bondStage: 0,
      }),
      world.get({ userId, conversationId: convId }),
      spiritMemoryEngine
        ? spiritMemoryEngine.buildMemoryBrief({ userId, spiritkinId, conversationId: convId })
        : Promise.resolve(null),
    ]);

    bus.emit("orchestrator.entitlements", {
      traceId,
      status: entitlement?.status,
      plan: entitlement?.plan ?? entitlement?.tier ?? null,
    });

    bus.emit("orchestrator.context.built", {
      traceId,
      memoriesCount: contextBundle?.memories?.length ?? 0,
    });

    const scene = worldSnap?.state?.scene || { name: "default" };
    let nextWorldState = worldSnap?.state || { scene: { name: "default" }, flags: {} };

    if (input.toLowerCase().includes("reset scene")) {
      nextWorldState = { ...nextWorldState, scene: { name: "default" } };
      await world.upsert({
        userId,
        conversationId: convId,
        spiritkinId,
        state: nextWorldState,
      });
      bus.emit("orchestrator.scene.transition", { traceId, to: "default" });
    }

    // Stage 5: Memory policy
    const policyState = await memory.computePolicyState({ userId });
    bus.emit("orchestrator.memory.policy", { traceId, policyState });

    // Stage 7: Safety pre-pass
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

    if (!safetyPreResult.pass) {
      incrementMetric("safetyEscalations");
      log.warn({ stage: "safety_escalation", tier: safetyPreResult.tier }, "[safety] Acute crisis escalation");

      if (messageService && convId) {
        await messageService.persist({
          conversationId: convId,
          role: "user",
          content: input,
        }).catch(() => {});
        await messageService.persist({
          conversationId: convId,
          role: "assistant",
          content: safetyPreResult.escalationResponse,
        }).catch(() => {});
      }

      incrementMetric("requestsOk");

      return {
        ok: true,
        traceId,
        spiritkin: resolvedIdentity.name,
        message: safetyPreResult.escalationResponse,
        safety: {
          tier: safetyPreResult.tier,
          label: safetyPreResult.label,
          escalated: true,
        },
        metadata: {
          conversationId: convId,
          role: resolvedIdentity.role,
          tags: ["safety_escalation"],
          emotion: { label: "grounded" },
        },
      };
    }

    // Stage 8: Persist inbound message
    if (messageService && convId) {
      await messageService.persist({
        conversationId: convId,
        role: "user",
        content: input,
      }).catch((err) => console.warn("[Orchestrator] message persist (in) failed:", err.message));
    }

    // Stage 9: Adapter generation
    logStage(log, "adapter_generation");
    incrementMetric("adapterCalls");

    const adapter = adapters.getActive();
    bus.emit("orchestrator.adapter.selected", { traceId, adapter: adapter.name });

    const identityFragment = identityGovernor.buildPromptFragment(resolvedIdentity);
    const crisisOverride = identityGovernor.getCrisisOverride(resolvedIdentity);
    const safetyInstruction = safetyPreResult.instruction ?? null;
    const relationship = responseEngine?.deriveRelationshipState({
      identity: resolvedIdentity,
      context: {
        memories: contextBundle?.memories,
        episodes: contextBundle?.episodes,
        bondMilestones: memoryBrief?.bondMilestones ?? [],
      },
      worldState: nextWorldState,
    }) ?? null;

    const spiritCoreEnvelope = spiritCoreAdaptiveService
      ? await spiritCoreAdaptiveService.buildRuntimeEnvelope({
          userId,
          spiritkinIdentity: resolvedIdentity,
          conversationId: convId,
          currentSurface: context?.surfaceContext?.activeSurface ?? context?.activeTab ?? "profile",
          currentMode: context?.activeGameType ? "game" : "conversation",
          activeTab: context?.surfaceContext?.activeTab ?? context?.activeTab ?? null,
          worldState: nextWorldState,
          recentMessages: [
            ...((contextBundle?.episodes || []).slice(-2).map((episode) => ({
              role: "user",
              content: episode?.text || "",
            }))),
            { role: "user", content: input },
          ],
          currentGame: nextWorldState?.flags?.active_game || null,
          requestContext: {
            ...context,
            recentText: input,
            emotion: contextBundle?.emotion || null,
          },
          storedAdaptiveProfile: nextWorldState?.flags?.spiritcore_adaptive_profile || null,
        })
      : null;

    if (spiritCoreEnvelope) {
      nextWorldState = spiritCoreAdaptiveService.applyWorldStateEnhancements(nextWorldState, spiritCoreEnvelope);
    }

    const authoritativeContext = {
      ...(context || {}),
      adaptiveProfile: spiritCoreEnvelope?.adaptiveProfile || context?.adaptiveProfile || null,
      spiritCoreUserModel: spiritCoreEnvelope?.userModel || null,
      spiritCoreSignals: spiritCoreEnvelope?.emotionalSignals || null,
      spiritCoreGuidance: spiritCoreEnvelope?.guidance || null,
      spiritCoreSurfacePriority: spiritCoreEnvelope?.surfacePriority || null,
      spiritCoreReturnPackage: spiritCoreEnvelope?.returnPackage || null,
      spiritCoreWorldHooks: spiritCoreEnvelope?.worldHooks || null,
      spiritCoreAmbientFoundation: spiritCoreEnvelope?.ambientFoundation || null,
    };

    const rawAdapterResult = await withTimeout(
      adapter.generate({
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
          memories: contextBundle?.memories,
          episodes: contextBundle?.episodes,
          emotion: contextBundle?.emotion,
          summary: contextBundle?.summary_episode,
          // Phase K: rich memory brief for long-term recall
          memoryBrief: memoryBrief?.brief ?? null,
          structuredMemory: contextBundle?.structured_memory?.brief ?? null,
          relationship,
          identityFacts: memoryBrief?.identity ?? [],
          bondMilestones: memoryBrief?.bondMilestones ?? [],
          gameSessions: memoryBrief?.games ?? [],
          sessionSummaries: memoryBrief?.sessions ?? [],
          memoryCorrections: contextBundle?.structured_memory?.corrections ?? [],
          memoryMilestones: contextBundle?.structured_memory?.milestones ?? [],
          memoryPreferences: contextBundle?.structured_memory?.preferences ?? [],
          ...authoritativeContext,
        },
      }),
      config.timeouts.adapter,
      "adapter generation"
    );

    const adapterResult = responseEngine
      ? responseEngine.wrapResponse({
          adapterResult: rawAdapterResult,
          identity: resolvedIdentity,
          input,
          context: {
            ...contextBundle,
            relationship,
            bondMilestones: memoryBrief?.bondMilestones ?? [],
          },
          worldState: nextWorldState,
        })
      : rawAdapterResult;

    // Stage 9b: Apply LLM-derived scene name to world state if meaningful
    const adapterSceneName = typeof adapterResult.sceneName === "string" && adapterResult.sceneName.trim()
      ? adapterResult.sceneName.trim()
      : null;

    if (adapterSceneName && adapterSceneName.toLowerCase() !== "default") {
      nextWorldState = { ...nextWorldState, scene: { name: adapterSceneName } };
      // Persist the updated scene asynchronously — do not block the response
      world.upsert({
        userId,
        conversationId: convId,
        spiritkinId,
        state: nextWorldState,
      }).catch((err) => console.warn("[Orchestrator] world.upsert (scene update) failed:", err.message));
      bus.emit("orchestrator.scene.transition", { traceId, to: adapterSceneName });
    }

    // Stage 10: Identity governance
    const governance = identityGovernor.governResponse(resolvedIdentity, adapterResult.text);

    if (governance.driftDetected) {
      bus.emit("orchestrator.drift.detected", {
        traceId,
        spiritkin: resolvedIdentity.name,
        matched: governance.matched,
      });
    }

    if (adapterResult?.memoryUsage?.used) {
      bus.emit("orchestrator.memory.used", {
        traceId,
        conversationId: convId,
        spiritkin: resolvedIdentity.name,
        selected: adapterResult.memoryUsage.selected?.map((item) => ({
          type: item.type,
          bucket: item.bucket,
          score: item.score,
        })) ?? [],
      });
    }

    // Stage 11: Safety post-pass
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

    // Stage 11d: Process Spiritkin game move if present
    if (!context?.isGameMove && adapterResult.gameMove && nextWorldState.flags?.active_game?.status === "active") {
      const game = nextWorldState.flags.active_game;
      if (game.turn === "spiritkin") {
        game.history.push({
          player: "spiritkin",
          move: adapterResult.gameMove,
          timestamp: new Date().toISOString()
        });
        game.turn = "user";
        // Update game data (e.g. FEN for chess) if we had an engine here.
        // For now, we trust the LLM's move and update the world state.
        await world.upsert({
          userId,
          conversationId: convId,
          spiritkinId,
          state: nextWorldState
        }).catch(err => console.warn("[Orchestrator] game move persist failed:", err.message));
        
        bus.emit("game.move_made", { 
          userId, 
          conversationId: convId, 
          gameType: game.type, 
          player: "spiritkin", 
          move: adapterResult.gameMove 
        });
      }
    }

    // Stage 11b: Persist outbound message + derived artifacts
    await Promise.allSettled([
      ...(messageService && convId
        ? [
            messageService.persist({
              conversationId: convId,
              role: "assistant",
              content: finalResponseText,
            }),
          ]
        : []),

      emotionService.updateFromText({
        userId,
        spiritkinId,
        conversationId: convId,
        text: input,
      }),

      ...(policyState.state !== "delete_due"
        ? [
            episodeService.write({
              userId,
              spiritkinId,
              conversationId: convId,
              text: input,
              emotion: adapterResult.emotion ?? {},
            }),
          ]
        : []),
    ]);

    // Stage 11c: Memory extraction (fire-and-forget — never blocks response)
    if (memoryExtractor && policyState.state !== "delete_due") {
      memoryExtractor.extractAndPersist({
        userId,
        spiritkinId,
        conversationId: convId,
        userMessage: input,
      }).catch(() => {}); // non-critical, swallow all errors
    }

    // Stage 11e: SpiritMemoryEngine — process full interaction for 10x memory retention
    if (spiritMemoryEngine && policyState.state !== "delete_due") {
      const emotionMeta3 = adapterResult.emotion?.metadata_json ?? {};
      spiritMemoryEngine.processInteraction({
        userId,
        spiritkinId,
        conversationId: convId,
        spiritkinName: resolvedIdentity.name,
        userText: input,
        spiritkinResponse: finalResponseText,
        emotionState: {
          tone: adapterResult.emotion?.tone,
          label: emotionMeta3?.label ?? adapterResult.emotion?.tone,
          arc: emotionMeta3?.arc ?? "opening",
          intensity: emotionMeta3?.intensity ?? 0,
        },
        worldState: nextWorldState,
        bondStage: nextWorldState?.bond?.stage ?? null,
        previousBondStage: worldSnap?.state?.bond?.stage ?? null,
      }).catch(() => {});
    }

    if (structuredMemoryService && policyState.state !== "delete_due") {
      const emotionMeta4 = adapterResult.emotion?.metadata_json ?? {};
      structuredMemoryService.recordInteractionMemories({
        userId,
        spiritkinId,
        conversationId: convId,
        userText: input,
        spiritkinResponse: finalResponseText,
        emotionState: {
          tone: adapterResult.emotion?.tone,
          label: emotionMeta4?.label ?? adapterResult.emotion?.tone,
          arc: emotionMeta4?.arc ?? "opening",
          intensity: emotionMeta4?.intensity ?? 0,
          metadata_json: emotionMeta4,
        },
        worldState: nextWorldState,
        bondStage: nextWorldState?.bond?.stage ?? null,
        previousBondStage: worldSnap?.state?.bond?.stage ?? null,
      }).catch(() => {});
    }

    bus.emit("orchestrator.complete", { traceId });
    logStage(log, "complete");
    incrementMetric("requestsOk");

    // Stage 12: React to interaction — update Living Spiritverse world state
    // This fires asynchronously and never blocks the response
    if (world?.reactToInteraction) {
      const emotionMeta = adapterResult.emotion?.metadata_json ?? {};
      const emotionLabel = adapterResult.emotion?.tone ?? emotionMeta?.label ?? "neutral";
      const arc = emotionMeta?.arc ?? "opening";
      const isSignificant = (emotionMeta?.intensity ?? 0) > 0.6 || arc === "deepening" || arc === "crisis";
      const milestone = isSignificant
        ? `${resolvedIdentity.name} — ${emotionLabel} moment (${new Date().toLocaleDateString()})`
        : null;

      world.reactToInteraction({
        userId,
        conversationId: convId,
        spiritkinId,
        spiritkinName: resolvedIdentity.name,
        emotionLabel,
        arc,
        milestone,
        isSignificant,
      }).catch(err => console.warn("[Orchestrator] world.reactToInteraction failed:", err.message));
    }

    // Stage 12b: Record interaction for engagement engine (async, non-blocking)
    if (engagementEngine?.recordInteraction) {
      const emotionMeta2 = adapterResult.emotion?.metadata_json ?? {};
      engagementEngine.recordInteraction({
        userId,
        spiritkinId,
        emotionLabel: adapterResult.emotion?.tone ?? emotionMeta2?.label ?? "neutral",
        arc: emotionMeta2?.arc ?? "opening",
        intensity: emotionMeta2?.intensity ?? 0,
      }).catch(() => {});
    }

    if (spiritCoreEnvelope && world?.upsert) {
      world.upsert({
        userId,
        conversationId: convId,
        spiritkinId,
        state: nextWorldState,
      }).catch((err) => console.warn("[Orchestrator] spiritCore adaptive state persist failed:", err.message));
    }

    // Stage 13: Ensure emotion.tone and world.scene.name are always meaningful
    const finalEmotion = adapterResult.emotion ?? {};
    const finalTone = (() => {
      const t = String(finalEmotion.tone ?? "").trim();
      if (t && t.toLowerCase() !== "warm" && t.toLowerCase() !== "steady presence") return t;
      if (resolvedIdentity.name === "Lyra") return "grounded warmth";
      if (resolvedIdentity.name === "Raien") return "charged clarity";
      if (resolvedIdentity.name === "Kairo") return "open wonder";
      return "steady presence";
    })();

    const finalSceneName = (() => {
      const s = String(nextWorldState?.scene?.name ?? "").trim();
      if (s && s.toLowerCase() !== "default") return s;
      if (resolvedIdentity.name === "Lyra") return "luminous veil";
      if (resolvedIdentity.name === "Raien") return "ember citadel";
      if (resolvedIdentity.name === "Kairo") return "astral observatory";
      return "spiritverse";
    })();

    return {
      ok: true,
      traceId,
      spiritkin: resolvedIdentity.name,
      message: finalResponseText,
      safety: {
        tier: safetyPreResult.tier,
        label: safetyPreResult.label,
        escalated: false,
        revised: safetyPostResult.revised,
      },
      metadata: {
        conversationId: convId,
        role: resolvedIdentity.role,
        tags: adapterResult.tags,
        emotion: { ...finalEmotion, tone: finalTone },
        world: { 
          scene: { name: finalSceneName },
          game: nextWorldState.flags?.active_game || null
        },
        governance: {
          driftDetected: governance.driftDetected,
          matched: governance.matched,
        },
        memoryUsage: adapterResult.memoryUsage ?? { used: false, selected: [] },
        entitlement,
        policy: policyState,
        spiritCore: spiritCoreEnvelope
          ? {
              userModel: spiritCoreEnvelope.userModel,
              emotionalSignals: spiritCoreEnvelope.emotionalSignals,
              guidance: spiritCoreEnvelope.guidance,
              surfacePriority: spiritCoreEnvelope.surfacePriority,
              returnPackage: spiritCoreEnvelope.returnPackage,
              worldHooks: spiritCoreEnvelope.worldHooks,
            }
          : null,
      },
    };
  };

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

      const httpCode = err.httpCode ?? 500;
      return {
        ok: false,
        traceId,
        spiritkin: opts.spiritkin?.name ?? "unknown",
        message: err.message ?? "An unexpected error occurred.",
        error: err.code ?? "INTERNAL",
        httpCode,
      };
    }
  };

  return { interact: safeInteract };
};
