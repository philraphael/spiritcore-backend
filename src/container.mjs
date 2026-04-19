/**
 * SpiritCore — Dependency Injection Container
 *
 * Single authoritative wiring point for all src services.
 * Instantiated once at server startup and injected into Fastify via decorators.
 *
 * Dependency graph:
 *   supabase
 *     └── bus (event bus)
 *     └── memoryService       (supabase, bus)
 *     └── entitlementsService (supabase, bus)
 *     └── worldService        (supabase, bus)
 *     └── emotionService      (supabase)
 *     └── episodeService      (supabase)
 *     └── registry            (supabase)
 *         └── identityGovernor (registry)
 *     └── conversationService (supabase, registry)
 *     └── contextService      (supabase, emotionService, episodeService, memoryService)
 *     └── adapters
 *         └── orchestrator    (bus, adapters, entitlements, memory, world, identityGovernor,
 *                               conversationService, contextService, emotionService, episodeService)
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "./config.mjs";
import { AppError } from "./errors.mjs";
import { EventEmitter } from "events";

import { createMemoryService }       from "./services/memory.mjs";
import { createEntitlementsService } from "./services/entitlements.mjs";
import { createWorldService }        from "./services/world.mjs";
import { createEmotionService }      from "./services/emotionService.mjs";
import { createEpisodeService }      from "./services/episodeService.mjs";
import { createSpiritkinRegistry }   from "./services/spiritkinRegistry.mjs";
import { createIdentityGovernor }    from "./services/identityGovernor.mjs";
import { createConversationService } from "./services/conversationService.mjs";
import { createContextService }      from "./services/contextService.mjs";
import { createOrchestrator }        from "./services/orchestrator.mjs";
import { buildAdapterRegistry }      from "./adapters/index.mjs";
import { createMessageService }      from "./services/messageService.mjs";
import { createSafetyGovernor }      from "./services/safetyGovernor.mjs";
import { createMemoryExtractor }        from "./services/memoryExtractor.mjs";
import { createHierarchicalMemoryService } from "./services/hierarchicalMemory.mjs";
import { createStructuredMemoryService } from "./services/structuredMemoryService.mjs";
import { createEngagementEngine }         from "./services/engagementEngine.mjs";
import { createGameEngine }             from "./services/gameEngine.mjs";
import { createSpiritMemoryEngine }     from "./services/spiritMemoryEngine.mjs";
import { createWorldProgression }       from "./services/worldProgression.mjs";
import { createResponseEngine }         from "./services/responseEngine.mjs";
import { createSessionControlService }  from "./services/sessionControlService.mjs";
import { createSpiritkinGeneratorService } from "./services/spiritkinGeneratorService.mjs";

/**
 * Build and return the fully wired service container.
 * Call once at startup; pass the returned object to Fastify decorators.
 *
 * @returns {object} container
 */
export function buildContainer() {
  // --- Infrastructure ---
  if (!config.supabase.url) throw new AppError("CONFIG", "Missing SUPABASE_URL", 500);
  if (!config.supabase.serviceRoleKey) throw new AppError("CONFIG", "Missing SUPABASE_SERVICE_ROLE_KEY", 500);

  const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "spiritcore-phase4" } },
  });

  const bus = new EventEmitter();
  bus.setMaxListeners(50);

  // --- Core Services ---
  const memoryService       = createMemoryService({ supabase, bus });
  const entitlementsService = createEntitlementsService({ supabase, bus });
  const worldService        = createWorldService({ supabase, bus });
  const emotionService      = createEmotionService({ supabase });
  const episodeService      = createEpisodeService({ supabase });

  // --- Identity Layer ---
  const registry        = createSpiritkinRegistry({ supabase });
  const identityGovernor = createIdentityGovernor({ registry });

  // --- Phase H: Hierarchical Memory (Semantic, Episodic, Procedural) ---
  const hierarchicalMemoryService = createHierarchicalMemoryService({ supabase, bus });
  const structuredMemoryService = createStructuredMemoryService({ supabase, bus });

  // --- Phase E: Messages Ledger + Safety Governor ---
  const messageService  = createMessageService({ supabase });
  const safetyGovernor  = createSafetyGovernor({ supabase });

  // --- Conversation & Context ---
  const conversationService = createConversationService({ supabase, registry });
  const sessionControlService = createSessionControlService({
    conversationService,
    messageService,
    world: worldService,
    registry,
  });
  const spiritkinGeneratorService = createSpiritkinGeneratorService({ registry });
  const contextService      = createContextService({
    supabase,
    emotionService,
    episodeService,
    memoryService,
    hierarchicalMemoryService,
    structuredMemoryService,
    worldService,
  });

  // --- Adapters ---
  const adapters = buildAdapterRegistry({ bus });

  // --- Phase G: Deep Memory Extraction ---
  const memoryExtractor = createMemoryExtractor({ memoryService });

  // --- Phase I: Proactive Engagement Engine ---
  const engagementEngine = createEngagementEngine({ supabase, bus, worldService });
  const responseEngine = createResponseEngine();

  // --- Phase K: SpiritMemoryEngine (10x unified long-term memory) ---
  const spiritMemoryEngine = createSpiritMemoryEngine({ supabase, bus });

  // --- Orchestrator ---
  const orchestrator = createOrchestrator({
    bus,
    adapters,
    entitlements: entitlementsService,
    memory: memoryService,
    world: worldService,
    identityGovernor,
    conversationService,
    sessionControlService,
    spiritkinGeneratorService,
    contextService,
    emotionService,
    episodeService,
    messageService,             // Phase E
    safetyGovernor,             // Phase E
    memoryExtractor,            // Phase G: deep memory
    hierarchicalMemoryService,  // Phase H: hierarchical memory
    structuredMemoryService,
    engagementEngine,            // Phase I: proactive engagement
    spiritMemoryEngine,          // Phase K: 10x unified memory
    responseEngine,
  });

  // --- Phase M: World Progression Engine ---
  const worldProgression = createWorldProgression({ world: worldService, bus, spiritMemoryEngine });

  // --- Phase J: Interactive Game Engine ---
  // Initialized after orchestrator so it can call back for Spiritkin commentary
  const gameEngine = createGameEngine({ bus, world: worldService, messageService, registry, orchestrator, memory: memoryService, spiritMemoryEngine, worldProgression });

  return {
    supabase,
    bus,
    memoryService,
    messageService,
    entitlementsService,
    worldService,
    emotionService,
    episodeService,
    registry,
    identityGovernor,
    conversationService,
    sessionControlService,
    spiritkinGeneratorService,
    contextService,
    safetyGovernor,
    memoryExtractor,
    hierarchicalMemoryService,
    structuredMemoryService,
    engagementEngine,
    responseEngine,
    gameEngine,                  // Phase J
    spiritMemoryEngine,          // Phase K
    worldProgression,            // Phase M
    adapters,
    orchestrator,
  };
}
