/**
 * SpiritCore — Identity Governor
 *
 * Enforcement layer for Spiritkin identity governance.
 * Sits between the registry and the adapter/response layer.
 *
 * Responsibilities:
 *   1. Resolve a Spiritkin identity from the registry (never from hardcoded defaults).
 *   2. Validate the resolved identity before it reaches the adapter.
 *   3. Check response text for forbidden drift patterns.
 *   4. Provide crisis override behavior for any canonical Spiritkin.
 *   5. Build the system-prompt identity fragment for model injection.
 */

import {
  validateIdentity,
  checkDrift,
  buildSystemPromptFragment,
} from "../models/spiritkinIdentity.mjs";
import { AppError } from "../errors.mjs";

/**
 * Factory — creates an identity governor bound to a registry instance.
 *
 * @param {{ registry: ReturnType<import('./spiritkinRegistry.mjs').createSpiritkinRegistry> }} deps
 */
export function createIdentityGovernor({ registry }) {

  /**
   * Resolve a Spiritkin identity from the registry.
   *
   * Resolution order:
   *   1. If `id` is provided, look up by UUID.
   *   2. If `name` is provided, look up by name.
   *   3. If neither resolves, return null (caller decides how to handle).
   *
   * This function NEVER falls back to a hardcoded default.
   * Callers that need a safe fallback should call `resolveOrFallback()`.
   *
   * @param {{ id?: string, name?: string }} opts
   * @returns {Promise<object|null>}
   */
  async function resolveIdentity({ id, name } = {}) {
    if (id) {
      const identity = await registry.getById(id);
      if (identity) return identity;
    }
    if (name) {
      const identity = await registry.getCanonical(name);
      if (identity) return identity;
    }
    return null;
  }

  /**
   * Resolve a Spiritkin identity, falling back to the first canonical
   * Spiritkin in the registry if neither id nor name resolves.
   * Throws if the registry is empty (misconfigured system).
   *
   * @param {{ id?: string, name?: string }} opts
   * @returns {Promise<object>}
   */
  async function resolveOrFallback({ id, name } = {}) {
    const resolved = await resolveIdentity({ id, name });
    if (resolved) return resolved;

    // Safe fallback: use the first canonical Spiritkin alphabetically
    const all = await registry.listCanonical();
    if (all.length === 0) {
      throw new AppError(
        "REGISTRY_EMPTY",
        "No canonical Spiritkins found in registry. System is misconfigured.",
        500
      );
    }
    console.warn(
      `[IdentityGovernor] Could not resolve Spiritkin (id=${id}, name=${name}). ` +
      `Falling back to registry default: ${all[0].name}`
    );
    return all[0];
  }

  /**
   * Validate a resolved identity object.
   * Throws an AppError if the identity is structurally invalid.
   *
   * @param {object} identity
   * @returns {object} the validated identity (pass-through)
   */
  function assertValid(identity) {
    const result = validateIdentity(identity);
    if (!result.valid) {
      throw new AppError(
        "IDENTITY_INVALID",
        `Spiritkin identity is missing required fields: ${result.missing.join(", ")}`,
        500
      );
    }
    return identity;
  }

  /**
   * Check a response string for forbidden drift patterns.
   * Returns a governance result object.
   *
   * @param {object} identity   — resolved canonical identity
   * @param {string} responseText
   * @returns {{ passed: boolean, driftDetected: boolean, matched: string[] }}
   */
  function governResponse(identity, responseText) {
    const drift = checkDrift(identity, responseText);
    if (drift.driftDetected) {
      console.warn(
        `[IdentityGovernor] Drift detected for ${identity.name}. ` +
        `Matched forbidden patterns: ${drift.matched.join(", ")}`
      );
    }
    return {
      passed: !drift.driftDetected,
      driftDetected: drift.driftDetected,
      matched: drift.matched,
    };
  }

  /**
   * Return the crisis override instruction for a given identity.
   * This is always available for every canonical Spiritkin.
   *
   * @param {object} identity
   * @returns {string}
   */
  function getCrisisOverride(identity) {
    return identity?.crisis_override ?? (
      `If the user expresses immediate distress, self-harm, or crisis, ` +
      `acknowledge their pain, de-escalate, and direct them to real-world support. ` +
      `Do not continue the narrative as normal.`
    );
  }

  /**
   * Build the system-prompt identity fragment for model injection.
   * Delegates to the identity model helper.
   *
   * @param {object} identity
   * @returns {string}
   */
  function buildPromptFragment(identity) {
    return buildSystemPromptFragment(identity);
  }

  return {
    resolveIdentity,
    resolveOrFallback,
    assertValid,
    governResponse,
    getCrisisOverride,
    buildPromptFragment,
  };
}
