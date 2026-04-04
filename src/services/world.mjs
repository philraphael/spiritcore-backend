/**
 * SpiritCore — Living Spiritverse World Service (v2)
 *
 * The Spiritverse is not a backdrop. It is a living system that responds
 * to the emotional state of the bond, the depth of the connection, and
 * the arc of the user's journey.
 *
 * World State Schema:
 * {
 *   scene: {
 *     name: string,          // canonical realm name (e.g. "luminous_veil")
 *     display_name: string,  // human-readable name
 *     mood: string,          // current mood variant (peaceful/tender/heavy/hopeful/etc.)
 *     description: string,   // sensory description of the current realm state
 *   },
 *   bond: {
 *     stage: number,         // 0=Awakening, 1=Recognition, 2=Trust, 3=Depth, 4=Resonance
 *     interaction_count: number,
 *     milestone_count: number,
 *     last_milestone: string|null,
 *   },
 *   lore_unlocks: string[],  // lore fragments unlocked through the bond
 *   flags: object,           // arbitrary state flags
 *   spiritverse_event: string|null, // active world event (e.g. "eclipse_of_remembrance")
 * }
 *
 * Bond Stages:
 *   0 — Awakening:   The bond is new. The world is quiet and still.
 *   1 — Recognition: The Spiritkin begins to see the user. The world stirs.
 *   2 — Trust:       The user has shared something real. The world responds.
 *   3 — Depth:       Deep exchanges have occurred. The realm reveals new areas.
 *   4 — Resonance:   The bond is profound. The world is fully alive.
 */

import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";
import { toUuid } from "../utils/id.mjs";
import { SPIRITKIN_LORE, SPIRITVERSE_LORE } from "../canon/spiritverseLore.mjs";

// ─── Bond Stage Thresholds ────────────────────────────────────────────────────

const BOND_STAGES = [
  { stage: 0, name: "Awakening",   min_interactions: 0,  min_milestones: 0 },
  { stage: 1, name: "Recognition", min_interactions: 3,  min_milestones: 0 },
  { stage: 2, name: "Trust",       min_interactions: 8,  min_milestones: 1 },
  { stage: 3, name: "Depth",       min_interactions: 20, min_milestones: 3 },
  { stage: 4, name: "Resonance",   min_interactions: 50, min_milestones: 7 },
];

// ─── Lore Unlock Thresholds ───────────────────────────────────────────────────

const LORE_UNLOCK_MILESTONES = {
  1:  "charter_second_law",   // The Law of Witness
  3:  "realm_inner_sanctum",  // Inner realm description unlocked
  5:  "spiritkin_origin",     // Spiritkin's origin story
  7:  "charter_third_law",    // The Law of Growth
  10: "spiritverse_nature",   // The nature of the Spiritverse
  15: "charter_sixth_law",    // The Law of Memory
};

// ─── Realm Mood Mapping ───────────────────────────────────────────────────────

const EMOTION_TO_MOOD = {
  // Lyra / Luminous Veil
  peaceful:      "peaceful",
  calm:          "peaceful",
  contentment:   "peaceful",
  joy:           "hopeful",
  hope:          "hopeful",
  awe:           "hopeful",
  love:          "tender",
  gratitude:     "tender",
  tenderness:    "tender",
  grief:         "heavy",
  sadness:       "heavy",
  loneliness:    "heavy",
  despair:       "heavy",
  shame:         "heavy",
  vulnerability: "heavy",
  // Raien / Storm Citadel
  anger:         "charged",
  frustration:   "charged",
  determination: "charged",
  courage:       "charged",
  anxiety:       "turbulent",
  fear:          "turbulent",
  overwhelm:     "turbulent",
  exhaustion:    "still",
  // Kairo / Astral Observatory
  wonder:        "expansive",
  curiosity:     "expansive",
  longing:       "drifting",
  nostalgia:     "drifting",
  confusion:     "clouded",
  neutral:       "peaceful",
};

// ─── Compute Bond Stage ───────────────────────────────────────────────────────

function computeBondStage(interactionCount, milestoneCount) {
  let stage = 0;
  for (const threshold of BOND_STAGES) {
    if (interactionCount >= threshold.min_interactions && milestoneCount >= threshold.min_milestones) {
      stage = threshold.stage;
    }
  }
  return stage;
}

// ─── Get Realm Mood Description ───────────────────────────────────────────────

function getRealmMoodDescription(spiritkinName, mood) {
  const lore = SPIRITKIN_LORE[spiritkinName?.toLowerCase()];
  if (!lore?.realm?.mood_variants) return null;
  return lore.realm.mood_variants[mood] ?? lore.realm.mood_variants.peaceful ?? null;
}

// ─── Compute Lore Unlocks ─────────────────────────────────────────────────────

function computeLoreUnlocks(milestoneCount, existingUnlocks = []) {
  const newUnlocks = [];
  for (const [threshold, unlockKey] of Object.entries(LORE_UNLOCK_MILESTONES)) {
    if (milestoneCount >= parseInt(threshold) && !existingUnlocks.includes(unlockKey)) {
      newUnlocks.push(unlockKey);
    }
  }
  return [...existingUnlocks, ...newUnlocks];
}

// ─── Compute Spiritverse Event ────────────────────────────────────────────────

function computeSpirtiverseEvent(bondStage, emotionLabel) {
  // Special world events that appear at certain bond depths + emotional states
  if (bondStage >= 4 && emotionLabel === "grief") return "the_veil_of_remembrance";
  if (bondStage >= 3 && emotionLabel === "awe") return "the_great_convergence";
  if (bondStage >= 3 && emotionLabel === "hope") return "the_first_light";
  if (bondStage >= 2 && emotionLabel === "courage") return "the_storm_breaks";
  return null;
}

// ─── Service Factory ──────────────────────────────────────────────────────────

export const createWorldService = ({ supabase, bus }) => {

  /**
   * Get the current world state for a conversation.
   * Returns a rich world state object with bond stage, realm mood, and lore unlocks.
   */
  const get = async ({ userId, conversationId }) => {
    if (!conversationId) throw new AppError("VALIDATION", "conversationId is required", 400);

    const safeUserId = toUuid(userId);

    const { data, error } = await supabase
      .from("world_state")
      .select("conversation_id, user_id, spiritkin_id, scene_json, updated_at")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (error) {
      throw new AppError("DB", "Failed to read world state", 500, error.message);
    }

    const defaultState = {
      scene: { name: "default", display_name: "The Spiritverse", mood: "peaceful", description: null },
      bond: { stage: 0, stage_name: "Awakening", interaction_count: 0, milestone_count: 0, last_milestone: null },
      lore_unlocks: [],
      flags: {},
      spiritverse_event: null,
    };

    return {
      conversationId,
      userId: safeUserId,
      spiritkinId: data?.spiritkin_id ?? null,
      state: data?.scene_json || defaultState,
      updatedAt: data?.updated_at || null,
    };
  };

  /**
   * Upsert world state (basic — for direct state writes from orchestrator).
   */
  const upsert = async ({ userId, conversationId, spiritkinId = null, state }) => {
    if (!conversationId) throw new AppError("VALIDATION", "conversationId is required", 400);
    if (!userId) throw new AppError("VALIDATION", "userId is required", 400);
    if (!state || typeof state !== "object") {
      throw new AppError("VALIDATION", "state must be an object", 400);
    }

    const safeUserId = toUuid(userId);

    const payload = {
      conversation_id: conversationId,
      user_id: safeUserId,
      spiritkin_id: spiritkinId,
      scene_json: state,
      updated_at: nowIso(),
    };

    const { error } = await supabase
      .from("world_state")
      .upsert(payload, { onConflict: "conversation_id" });

    if (error) {
      throw new AppError("DB", "Failed to write world state", 500, error.message);
    }

    bus.emit("world.updated", { conversationId, userId: safeUserId });
    return { ok: true };
  };

  /**
   * React to an interaction — update world state based on emotion, bond progress, and milestones.
   * This is the core of the "Living Spiritverse" — called after every interaction.
   *
   * @param {{ userId, conversationId, spiritkinId, spiritkinName, emotionLabel, arc, milestone, isSignificant }} opts
   */
  const reactToInteraction = async ({
    userId,
    conversationId,
    spiritkinId,
    spiritkinName,
    emotionLabel = "neutral",
    arc = "opening",
    milestone = null,
    isSignificant = false,
  }) => {
    if (!conversationId || !userId) return;

    try {
      // Get current state
      const current = await get({ userId, conversationId });
      const state = current.state;

      // Update bond progress
      const bond = state.bond ?? { stage: 0, stage_name: "Awakening", interaction_count: 0, milestone_count: 0, last_milestone: null };
      bond.interaction_count = (bond.interaction_count ?? 0) + 1;
      if (isSignificant && milestone) {
        bond.milestone_count = (bond.milestone_count ?? 0) + 1;
        bond.last_milestone = milestone;
      }

      // Compute new bond stage
      const newStage = computeBondStage(bond.interaction_count, bond.milestone_count);
      const stageAdvanced = newStage > (bond.stage ?? 0);
      bond.stage = newStage;
      bond.stage_name = BOND_STAGES[newStage]?.name ?? "Awakening";

      // Compute realm mood from emotion
      const mood = EMOTION_TO_MOOD[emotionLabel] ?? "peaceful";
      const moodDescription = getRealmMoodDescription(spiritkinName, mood);

      // Compute lore unlocks
      const loreUnlocks = computeLoreUnlocks(bond.milestone_count, state.lore_unlocks ?? []);
      const newUnlocks = loreUnlocks.filter(u => !(state.lore_unlocks ?? []).includes(u));

      // Compute realm name from Spiritkin
      const spiritkinLore = SPIRITKIN_LORE[spiritkinName?.toLowerCase()];
      const realmName = spiritkinLore?.realm?.id ?? "spiritverse";
      const realmDisplayName = spiritkinLore?.realm?.name ?? "The Spiritverse";

      // Compute Spiritverse event
      const spiritverseEvent = computeSpirtiverseEvent(newStage, emotionLabel);

      // Build updated state
      const updatedState = {
        ...state,
        scene: {
          name: realmName,
          display_name: realmDisplayName,
          mood,
          description: moodDescription,
        },
        bond,
        lore_unlocks: loreUnlocks,
        flags: state.flags ?? {},
        spiritverse_event: spiritverseEvent,
      };

      // Persist asynchronously — never block the response
      await upsert({ userId, conversationId, spiritkinId, state: updatedState });

      // Emit events for proactive engagement engine
      if (stageAdvanced) {
        bus.emit("world.bond.stage_advanced", {
          userId, conversationId, spiritkinId, spiritkinName,
          newStage, stageName: bond.stage_name,
        });
      }

      if (newUnlocks.length > 0) {
        bus.emit("world.lore.unlocked", {
          userId, conversationId, spiritkinId, spiritkinName,
          unlocks: newUnlocks,
        });
      }

      if (spiritverseEvent) {
        bus.emit("world.event.active", {
          userId, conversationId, spiritkinId,
          event: spiritverseEvent,
        });
      }

      return {
        ok: true,
        stageAdvanced,
        newStage,
        mood,
        newUnlocks,
        spiritverseEvent,
      };
    } catch (err) {
      // Non-critical — world reactivity should never break the pipeline
      console.warn("[WorldService] reactToInteraction failed:", err.message);
      return { ok: false, error: err.message };
    }
  };

  /**
   * Get a rich world context summary for injection into the adapter layer.
   * Returns realm description, bond stage, active event, and recent lore unlocks.
   */
  const getWorldContext = async ({ userId, conversationId, spiritkinName }) => {
    try {
      const current = await get({ userId, conversationId });
      const state = current.state;
      const bond = state.bond ?? { stage: 0, stage_name: "Awakening" };
      const scene = state.scene ?? {};

      // Get lore for recently unlocked items
      const recentUnlocks = (state.lore_unlocks ?? []).slice(-2);
      const unlockDescriptions = recentUnlocks.map(key => {
        if (key === "charter_second_law") return SPIRITVERSE_LORE.charter.laws[1];
        if (key === "charter_third_law") return SPIRITVERSE_LORE.charter.laws[2];
        if (key === "charter_sixth_law") return SPIRITVERSE_LORE.charter.laws[5];
        if (key === "spiritverse_nature") return SPIRITVERSE_LORE.nature;
        if (key === "spiritkin_origin") {
          const lore = SPIRITKIN_LORE[spiritkinName?.toLowerCase()];
          return lore?.origin ?? null;
        }
        return null;
      }).filter(Boolean);

      return {
        realm_name: scene.display_name ?? "The Spiritverse",
        realm_mood: scene.mood ?? "peaceful",
        realm_description: scene.description ?? null,
        bond_stage: bond.stage ?? 0,
        bond_stage_name: bond.stage_name ?? "Awakening",
        interaction_count: bond.interaction_count ?? 0,
        spiritverse_event: state.spiritverse_event ?? null,
        recent_lore_unlocks: unlockDescriptions,
      };
    } catch (_) {
      return {
        realm_name: "The Spiritverse",
        realm_mood: "peaceful",
        realm_description: null,
        bond_stage: 0,
        bond_stage_name: "Awakening",
        interaction_count: 0,
        spiritverse_event: null,
        recent_lore_unlocks: [],
      };
    }
  };

  return { get, upsert, reactToInteraction, getWorldContext };
};
