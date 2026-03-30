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

/**
 * Factory function — creates a registry bound to a Supabase client.
 *
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient }} deps
 */
export function createSpiritkinRegistry({ supabase }) {
  let _cache = null;       // Map<string (lower name), identity>
  let _cacheById = null;   // Map<string (uuid), identity>
  let _loadedAt = null;

  /**
   * Internal: load all canonical Spiritkins from Supabase and populate cache.
   */
  async function _load() {
    const { data, error } = await supabase
      .from("spiritkins")
      .select("*")
      .eq("is_canon", true)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`[SpiritkinRegistry] Failed to load canonical Spiritkins: ${error.message}`);
    }

    const byName = new Map();
    const byId = new Map();

    for (const row of data ?? []) {
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
