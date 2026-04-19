function clampMessageLimit(value, fallback = 40) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.round(n)));
}

function normalizeTurnPhase(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["idle", "user_input", "processing", "spirit_response", "complete"].includes(normalized)
    ? normalized
    : "idle";
}

function normalizeSurface(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "selection";
  return normalized;
}

function normalizeMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "idle";
  return normalized;
}

function hasExplicitValue(value) {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeSpeechState(raw = {}) {
  return {
    isSpeaking: !!raw.isSpeaking,
    isListening: !!raw.isListening,
    isPaused: !!raw.isPaused,
    lastUtteranceId: raw.lastUtteranceId ? String(raw.lastUtteranceId) : null,
    turnPhase: normalizeTurnPhase(raw.turnPhase),
  };
}

function normalizeStoredControl(raw = {}) {
  const speechState = normalizeSpeechState(raw.speechState || {});
  return {
    currentSurface: normalizeSurface(raw.currentSurface),
    currentMode: normalizeMode(raw.currentMode),
    activeTab: raw.activeTab ? String(raw.activeTab) : null,
    speechState,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
  };
}

function buildConversationState(messages = [], conversationId = null) {
  const lastMessage = messages[messages.length - 1] || null;
  return {
    conversationId,
    messageCount: messages.length,
    lastMessageRole: lastMessage?.role || null,
    lastMessageAt: lastMessage?.created_at || null,
  };
}

function buildMemoryContext(worldState = {}) {
  const scene = worldState.scene || {};
  const bond = worldState.bond || {};
  return {
    bondStage: Number.isFinite(bond.stage) ? bond.stage : 0,
    bondStageName: bond.stage_name || "Awakening",
    sceneName: scene.name || "default",
    sceneMood: scene.mood || "peaceful",
    activeEvent: worldState.spiritverse_event || null,
    unlockedEchoCount: Array.isArray(worldState.echo_unlocks) ? worldState.echo_unlocks.length : 0,
  };
}

function buildCurrentGame(activeGame) {
  if (!activeGame || typeof activeGame !== "object") return null;
  return {
    type: activeGame.type || null,
    name: activeGame.name || activeGame.type || null,
    status: activeGame.status || "active",
    turn: activeGame.turn || "user",
    moveCount: Number.isFinite(activeGame.moveCount) ? activeGame.moveCount : 0,
    historyLength: Array.isArray(activeGame.history) ? activeGame.history.length : 0,
  };
}

function createDefaultWorldState() {
  return {
    scene: { name: "default", display_name: "The Spiritverse", mood: "peaceful", description: null },
    bond: { stage: 0, stage_name: "Awakening", interaction_count: 0, milestone_count: 0, last_milestone: null },
    echo_unlocks: [],
    flags: {},
    spiritverse_event: null,
  };
}

function deriveDefaults({ conversationId, activeGame, spiritkinIdentity, controlHint }) {
  if (conversationId && activeGame?.status === "active") {
    return {
      currentSurface: "games",
      currentMode: "game",
      speechState: { isSpeaking: false, isListening: false, isPaused: false, lastUtteranceId: null, turnPhase: "complete" },
    };
  }

  if (conversationId) {
    return {
      currentSurface: controlHint?.currentSurface || "profile",
      currentMode: "conversation",
      speechState: { isSpeaking: false, isListening: false, isPaused: false, lastUtteranceId: null, turnPhase: "idle" },
    };
  }

  if (spiritkinIdentity) {
    return {
      currentSurface: "selection",
      currentMode: "selection",
      speechState: { isSpeaking: false, isListening: false, isPaused: false, lastUtteranceId: null, turnPhase: "idle" },
    };
  }

  return {
    currentSurface: controlHint?.currentSurface || "selection",
    currentMode: controlHint?.currentMode || "idle",
    speechState: { isSpeaking: false, isListening: false, isPaused: false, lastUtteranceId: null, turnPhase: "idle" },
  };
}

export function createSessionControlService({ conversationService, messageService, world, registry }) {
  async function safeResolveSpiritkinById(id) {
    if (!id) return null;
    try {
      return await registry.getById(id);
    } catch (_) {
      return null;
    }
  }

  async function safeResolveSpiritkinByName(name) {
    if (!name) return null;
    try {
      return await registry.getCanonical(name);
    } catch (_) {
      return null;
    }
  }

  async function safeGetWorldData({ userId, conversationId }) {
    try {
      return await world.get({ userId, conversationId });
    } catch (_) {
      return {
        conversationId,
        userId,
        spiritkinId: null,
        state: createDefaultWorldState(),
        updatedAt: null,
      };
    }
  }

  async function getSnapshot({
    userId,
    conversationId = null,
    spiritkinName = null,
    currentSurface = null,
    currentMode = null,
    activeTab = null,
    speechStateOverride = null,
    messageLimit = 40,
  }) {
    const limit = clampMessageLimit(messageLimit);
    let conversation = null;
    let worldData = null;
    let activeGame = null;
    let messages = [];
    let spiritkinIdentity = null;
    let storedControl = null;
    let resolvedConversationId = conversationId ? String(conversationId) : null;

    try {
      if (resolvedConversationId) {
        try {
          conversation = await conversationService.resolveByConversation(resolvedConversationId);
          resolvedConversationId = conversation?.conversation_id || resolvedConversationId;
        } catch (error) {
          console.error("[SessionControl] resolveByConversation failed", {
            userId,
            conversationId: resolvedConversationId,
            message: error?.message || String(error),
          });
        }

        worldData = await safeGetWorldData({ userId, conversationId: resolvedConversationId });

        try {
          messages = await messageService.fetchRecent({ conversationId: resolvedConversationId, limit });
        } catch (error) {
          console.error("[SessionControl] fetchRecent failed", {
            userId,
            conversationId: resolvedConversationId,
            message: error?.message || String(error),
          });
          messages = [];
        }

        activeGame = worldData?.state?.flags?.active_game || null;
        storedControl = normalizeStoredControl(worldData?.state?.flags?.spiritcore_session || {});
        if (conversation?.spiritkin_id) {
          spiritkinIdentity = await safeResolveSpiritkinById(conversation.spiritkin_id);
        }
      } else if (spiritkinName) {
        spiritkinIdentity = await safeResolveSpiritkinByName(spiritkinName);
      }

      const defaults = deriveDefaults({
        conversationId: resolvedConversationId,
        activeGame,
        spiritkinIdentity,
        controlHint: { currentSurface, currentMode },
      });

      const explicitSpeechState = speechStateOverride ? normalizeSpeechState(speechStateOverride) : null;
      const speechState = explicitSpeechState || (storedControl
        ? {
            ...defaults.speechState,
            ...storedControl.speechState,
            turnPhase: normalizeTurnPhase(storedControl.speechState?.turnPhase || defaults.speechState.turnPhase),
          }
        : normalizeSpeechState(defaults.speechState));

      const resolvedSurface = hasExplicitValue(currentSurface)
        ? normalizeSurface(currentSurface)
        : (storedControl?.currentSurface || defaults.currentSurface);
      const resolvedMode = hasExplicitValue(currentMode)
        ? normalizeMode(currentMode)
        : (storedControl?.currentMode || defaults.currentMode);
      const resolvedActiveTab = hasExplicitValue(activeTab)
        ? String(activeTab).trim().toLowerCase()
        : (storedControl?.activeTab || null);

      const snapshot = {
        sessionId: resolvedConversationId,
        userId,
        currentSpiritkin: spiritkinIdentity
          ? {
              id: spiritkinIdentity.id,
              name: spiritkinIdentity.name,
              title: spiritkinIdentity.title || null,
              role: spiritkinIdentity.role || null,
            }
          : null,
        currentSurface: resolvedSurface,
        currentMode: resolvedMode,
        activeTab: resolvedActiveTab,
        currentGame: buildCurrentGame(activeGame),
        gameState: activeGame || null,
        conversationState: buildConversationState(messages, resolvedConversationId),
        speechState,
        memoryContext: buildMemoryContext(worldData?.state || {}),
        recentMessages: messages,
        controlUpdatedAt: storedControl?.updatedAt || null,
      };

      return { ok: true, session: snapshot };
    } catch (error) {
      console.error("[SessionControl] getSnapshot fallback", {
        userId,
        conversationId: resolvedConversationId,
        spiritkinName,
        currentSurface,
        currentMode,
        activeTab,
        message: error?.message || String(error),
      });

      if (!spiritkinIdentity && spiritkinName) {
        spiritkinIdentity = await safeResolveSpiritkinByName(spiritkinName);
      }
      const defaults = deriveDefaults({
        conversationId: resolvedConversationId,
        activeGame: null,
        spiritkinIdentity,
        controlHint: { currentSurface, currentMode },
      });
      const speechState = normalizeSpeechState(speechStateOverride || defaults.speechState);
      const fallbackWorldState = createDefaultWorldState();

      return {
        ok: true,
        session: {
          sessionId: resolvedConversationId,
          userId,
          currentSpiritkin: spiritkinIdentity
            ? {
                id: spiritkinIdentity.id,
                name: spiritkinIdentity.name,
                title: spiritkinIdentity.title || null,
                role: spiritkinIdentity.role || null,
              }
            : null,
          currentSurface: hasExplicitValue(currentSurface) ? normalizeSurface(currentSurface) : defaults.currentSurface,
          currentMode: hasExplicitValue(currentMode) ? normalizeMode(currentMode) : defaults.currentMode,
          activeTab: hasExplicitValue(activeTab) ? String(activeTab).trim().toLowerCase() : null,
          currentGame: null,
          gameState: null,
          conversationState: buildConversationState([], resolvedConversationId),
          speechState,
          memoryContext: buildMemoryContext(fallbackWorldState),
          recentMessages: [],
          controlUpdatedAt: null,
        },
      };
    }
  }

  async function updateControl({
    userId,
    conversationId = null,
    currentSpiritkinName = null,
    currentSurface = null,
    currentMode = null,
    activeTab = null,
    speechState = null,
  }) {
    const normalizedSpeech = normalizeSpeechState(speechState || {});
    if (!conversationId) {
      return getSnapshot({
        userId,
        conversationId: null,
        spiritkinName: currentSpiritkinName,
        currentSurface,
        currentMode,
        activeTab,
        speechStateOverride: normalizedSpeech,
      });
    }

    try {
      const worldData = await safeGetWorldData({ userId, conversationId });
      const nextState = {
        ...(worldData.state || {}),
        flags: {
          ...(worldData.state?.flags || {}),
          spiritcore_session: {
            currentSurface: normalizeSurface(currentSurface),
            currentMode: normalizeMode(currentMode),
            activeTab: activeTab ? String(activeTab) : null,
            speechState: normalizedSpeech,
            updatedAt: new Date().toISOString(),
          },
        },
      };

      await world.upsert({
        userId,
        conversationId,
        spiritkinId: worldData.spiritkinId,
        state: nextState,
      });
    } catch (_) {
      // UI control writes must degrade to a synthesized snapshot rather than crashing the flow.
    }

    return getSnapshot({
      userId,
      conversationId,
      spiritkinName: currentSpiritkinName,
      currentSurface,
      currentMode,
      activeTab,
      speechStateOverride: normalizedSpeech,
    });
  }

  return { getSnapshot, updateControl };
}
