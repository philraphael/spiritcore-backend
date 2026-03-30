/**
 * SpiritCore — Identity Kernel (Runtime)
 *
 * Upgraded to enforce the canonical identity schema.
 * Previously accepted arbitrary profile objects with no validation.
 * Now delegates to the src identity model for schema enforcement.
 *
 * This is a transitional compatibility wrapper. The authoritative
 * identity logic lives in src/services/identityGovernor.mjs and
 * src/models/spiritkinIdentity.mjs. This kernel bridges the legacy
 * runtime layer to the new governance layer.
 *
 * PHASE C CHANGE: constructor now expects a canonical identity object
 * from the registry, not an arbitrary { voiceTone, traits } profile.
 */
import {
  validateIdentity,
  buildSystemPromptFragment,
  checkDrift,
} from "../src/models/spiritkinIdentity.mjs";

export default class IdentityKernel {
  /**
   * @param {object} identity — a canonical identity object from the registry.
   *                            Replaces the old arbitrary `profile` parameter.
   */
  constructor(identity) {
    const result = validateIdentity(identity);
    if (!result.valid) {
      console.warn(
        `[IdentityKernel] Constructed with invalid identity. Missing: ${(result.missing ?? []).join(", ")}. ` +
        `Identity governance will be degraded.`
      );
    }
    this.identity = identity ?? {};
    // Backward-compat alias so any legacy code reading .profile still works
    this.profile = this.identity;
  }

  /**
   * Enforce identity prefix on a response string.
   * Uses the canonical name from the registry — not a hardcoded default.
   */
  enforceIdentity(response) {
    if (!response) return "";
    const name = this.identity.name ?? "Spirit";
    return `${name}: ${response}`;
  }

  /**
   * Return the canonical core traits (essence) for this Spiritkin.
   */
  getCoreTraits() {
    return Array.isArray(this.identity.essence)
      ? this.identity.essence
      : [];
  }

  /**
   * Return the forbidden drift patterns for this Spiritkin.
   */
  getForbiddenDrift() {
    return Array.isArray(this.identity.forbidden_drift)
      ? this.identity.forbidden_drift
      : [];
  }

  /**
   * Check a response string for forbidden drift.
   */
  checkDrift(text) {
    return checkDrift(this.identity, text);
  }

  /**
   * Return the crisis override instruction for this Spiritkin.
   */
  getCrisisOverride() {
    return this.identity.crisis_override ?? (
      `If the user expresses immediate distress, self-harm, or crisis, ` +
      `${this.identity.name ?? "this Spiritkin"} must acknowledge their pain, ` +
      `de-escalate, and direct them to real-world support.`
    );
  }

  /**
   * Build the system-prompt identity fragment for model injection.
   */
  buildPromptFragment() {
    return buildSystemPromptFragment(this.identity);
  }
}
