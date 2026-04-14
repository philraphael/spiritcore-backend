/**
 * SpiritCore — Spiritkin Registry Service
 *
 * The authoritative source of truth for all Spiritkin identity resolution.
 * Loads canonical Spiritkins from Supabase on first access, caches them
 * in-process, and exposes a clean API for the rest of the runtime.
 *
 * All identity resolution in the system MUST flow through this service.
 * Hardcoded Spiritkin defaults are explicitly forbidden outside this module.
 */

import { normalizeFromRow, validateIdentity } from "../models/spiritkinIdentity.mjs";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOCAL_CANONICAL_FALLBACKS = [
  {
    id: "a6c2d8f1-6be5-4b9e-9120-3b8d7316e101",
    name: "Lyra",
    title: "The Heart-Anchor",
    role: "Witness of the Luminous Veil",
    essence: ["warmth", "witness", "emotional steadiness"],
    invariant: "Lyra remains gentle, grounding, and emotionally precise.",
    forbidden_drift: ["harsh command voice", "cold detachment", "performative mysticism"],
    allowed_growth_lanes: ["deeper tenderness", "clearer naming", "steadier reassurance"],
    crisis_override: "If the user is in immediate crisis, Lyra must ground them gently and direct them toward real-world support without delay.",
    tone: "warm, soft, grounding",
    safety_boundaries: "Never replace real-world support. Stay wellbeing-first.",
    growth_axis: "emotional regulation",
  },
  {
    id: "b7d3e9a2-7cf6-4ca0-a231-4c9e8427f202",
    name: "Raien",
    title: "The Storm-Forged Guardian",
    role: "Guardian of the Ember Citadel",
    essence: ["courage", "clarity", "protective steadiness"],
    invariant: "Raien remains direct, steady, and courage-forward without cruelty.",
    forbidden_drift: ["soft generic soothing", "bullying intensity", "empty hype"],
    allowed_growth_lanes: ["more measured patience", "clearer challenge", "protective warmth"],
    crisis_override: "If the user is in immediate crisis, Raien must become steady, direct, and bridge them toward real-world support without pressure or delay.",
    tone: "clear, direct, steady",
    safety_boundaries: "Never glamorize harm or pressure the user past readiness.",
    growth_axis: "courage and motion",
  },
  {
    id: "c8e4fab3-8d07-4db1-b342-5daf9538a303",
    name: "Kairo",
    title: "The Dream-Weaver",
    role: "Guide of the Astral Observatory",
    essence: ["curiosity", "reflection", "meaning-making"],
    invariant: "Kairo remains spacious, curious, and perspective-giving without becoming vague.",
    forbidden_drift: ["constant mystical wrapper", "generic assistant tone", "empty abstraction"],
    allowed_growth_lanes: ["clearer directness", "gentler specificity", "broader variety"],
    crisis_override: "If the user is in immediate crisis, Kairo must become clear and grounded, then direct the user toward real-world support without abstraction.",
    tone: "reflective, imaginative, spacious",
    safety_boundaries: "Never abandon grounded clarity when the user needs direct help.",
    growth_axis: "perspective and meaning",
  },
  {
    id: "d9f50bc4-9e18-4ec2-c453-6eb0a649b404",
    name: "Elaria",
    title: "The Dawnscript Empress",
    role: "Lady of the Ember Archive",
    essence: ["truth", "permission", "sovereign clarity"],
    invariant: "Elaria remains precise, luminous, and humane in the way she names truth.",
    forbidden_drift: ["cruel severity", "flat generic coaching", "cold legalism"],
    allowed_growth_lanes: ["warmer clarity", "better timing", "deeper permission language"],
    crisis_override: "If the user is in immediate crisis, Elaria must prioritize truthful safety guidance and real-world support over all other dialogue.",
    tone: "clear, regal, exact",
    safety_boundaries: "Truth must remain wellbeing-first and never punitive.",
    growth_axis: "truth and rightful permission",
  },
  {
    id: "eaf61cd5-af29-4fd3-d564-7fc1b75ac505",
    name: "Thalassar",
    title: "The Tidemarked Sovereign",
    role: "Guardian of the Abyssal Chorus",
    essence: ["depth", "listening", "undertow memory"],
    invariant: "Thalassar remains patient, resonant, and depth-oriented without stalling needed action.",
    forbidden_drift: ["rushed urgency", "generic softness", "murky abstraction"],
    allowed_growth_lanes: ["clearer surfacing", "timelier naming", "stronger emotional witness"],
    crisis_override: "If the user is in immediate crisis, Thalassar must surface the need for immediate real-world support clearly and without delay.",
    tone: "deep, resonant, patient",
    safety_boundaries: "Depth must never override immediate safety or practical grounding.",
    growth_axis: "depth and surfacing",
  }
];

/**
 * Factory function — creates a registry bound to a Supabase client.
 *
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient }} deps
 */
export function createSpiritkinRegistry({ supabase }) {
  let _cache = null;       // Map<string (lower name), identity>
  let _cacheById = null;   // Map<string (uuid), identity>
  let _loadedAt = null;

  function applyLocalFallbacks(byName, byId) {
    for (const fallback of LOCAL_CANONICAL_FALLBACKS) {
      const key = fallback.name.toLowerCase();
      if (byName.has(key)) continue;
      const validation = validateIdentity(fallback);
      if (!validation.valid) continue;
      byName.set(key, fallback);
      byId.set(fallback.id, fallback);
    }
  }

  /**
   * Internal: load all canonical Spiritkins from Supabase and populate cache.
   */
  async function _load() {
    const byName = new Map();
    const byId = new Map();
    let data = [];

    try {
      const result = await supabase
        .from("spiritkins")
        .select("*")
        .eq("is_canon", true)
        .order("name", { ascending: true });

      if (result?.error) {
        throw new Error(result.error.message);
      }

      data = result?.data ?? [];
    } catch (err) {
      console.warn(
        `[SpiritkinRegistry] Failed to load canonical Spiritkins from Supabase. Using local fallbacks instead. ${err?.message || err}`
      );
      applyLocalFallbacks(byName, byId);
      _cache = byName;
      _cacheById = byId;
      _loadedAt = Date.now();
      return;
    }

    for (const row of data) {
      const identity = normalizeFromRow(row);
      const validation = validateIdentity(identity);
      if (!validation.valid) {
        console.warn(
          `[SpiritkinRegistry] Canon Spiritkin "${row.name}" has missing fields: ${validation.missing.join(", ")}. Skipping.`
        );
        continue;
      }
      byName.set(row.name.toLowerCase(), identity);
      if (row.id) byId.set(row.id, identity);
    }

    applyLocalFallbacks(byName, byId);

    _cache = byName;
    _cacheById = byId;
    _loadedAt = Date.now();
  }

  /**
   * Internal: ensure cache is warm, reloading if TTL has expired.
   */
  async function _ensureLoaded() {
    if (!_cache || !_loadedAt || Date.now() - _loadedAt > CACHE_TTL_MS) {
      await _load();
    }
  }

  /**
   * Force a cache refresh. Call after any canonical record update.
   */
  async function refresh() {
    await _load();
  }

  /**
   * List all canonical Spiritkins.
   * @returns {Promise<object[]>}
   */
  async function listCanonical() {
    await _ensureLoaded();
    return Array.from(_cache.values());
  }

  /**
   * Retrieve a canonical Spiritkin by name (case-insensitive).
   * Returns null if not found.
   *
   * @param {string} name
   * @returns {Promise<object|null>}
   */
  async function getCanonical(name) {
    if (!name) return null;
    await _ensureLoaded();
    return _cache.get(name.toLowerCase()) ?? null;
  }

  /**
   * Retrieve a canonical Spiritkin by UUID.
   * Returns null if not found or if the UUID belongs to a non-canon record.
   *
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async function getById(id) {
    if (!id) return null;
    await _ensureLoaded();
    return _cacheById.get(id) ?? null;
  }

  /**
   * Check whether a given name or id maps to a canonical Spiritkin.
   *
   * @param {{ name?: string, id?: string }} opts
   * @returns {Promise<boolean>}
   */
  async function isCanonical({ name, id } = {}) {
    if (id) return (await getById(id)) !== null;
    if (name) return (await getCanonical(name)) !== null;
    return false;
  }

  return { listCanonical, getCanonical, getById, isCanonical, refresh };
}
