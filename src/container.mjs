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

  // --- Conversation & Context ---
  const conversationService = createConversationService({ supabase, registry });
  const contextService      = createContextService({
    supabase,
    emotionService,
    episodeService,
    memoryService,
  });

  // --- Adapters ---
  const adapters = buildAdapterRegistry({ bus });

  // --- Phase E: Messages Ledger + Safety Governor ---
  const messageService  = createMessageService({ supabase });
  const safetyGovernor  = createSafetyGovernor({ supabase });

  // --- Orchestrator ---
  const orchestrator = createOrchestrator({
    bus,
    adapters,
    entitlements: entitlementsService,
    memory: memoryService,
    world: worldService,
    identityGovernor,
    conversationService,
    contextService,
    emotionService,
    episodeService,
    messageService,   // Phase E
    safetyGovernor,   // Phase E
  });

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
    contextService,
    safetyGovernor,
    adapters,
    orchestrator,
  };
}
