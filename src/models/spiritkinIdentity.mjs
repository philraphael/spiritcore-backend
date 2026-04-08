/**
 * SpiritCore — Spiritkin Identity Model
 * 
 * Defines the authoritative canonical identity schema for all Spiritkins.
 * Every field in this model is governed by the Spiritkins Bible / Charter.
 * Runtime identity resolution MUST produce an object conforming to this shape.
 */

import { SPIRITKIN_ECHOES, SPIRITVERSE_ECHOES } from "../canon/spiritverseEchoes.mjs";

/**
 * The set of required top-level fields for a canonical identity object.
 * Any identity that fails this check is considered unresolved and must not
 * be passed to the adapter layer.
 */
export const REQUIRED_IDENTITY_FIELDS = [
  "name",
  "title",
  "role",
  "essence",
  "invariant",
  "forbidden_drift",
  "tone",
  "crisis_override",
];

/**
 * Validate a resolved identity object against the canonical schema.
 * Returns { valid: true } or { valid: false, missing: [...] }.
 *
 * @param {object} identity
 * @returns {{ valid: boolean, missing?: string[] }}
 */
export function validateIdentity(identity) {
  if (!identity || typeof identity !== "object") {
    return { valid: false, missing: REQUIRED_IDENTITY_FIELDS };
  }
  const missing = REQUIRED_IDENTITY_FIELDS.filter(
    (f) => identity[f] === undefined || identity[f] === null
  );
  return missing.length === 0
    ? { valid: true }
    : { valid: false, missing };
}

/**
 * Check whether a response string contains forbidden drift patterns
 * for the given identity.
 *
 * @param {object} identity  — resolved canonical identity
 * @param {string} text      — response text to check
 * @returns {{ driftDetected: boolean, matched: string[] }}
 */
export function checkDrift(identity, text) {
  if (!text || !Array.isArray(identity?.forbidden_drift)) {
    return { driftDetected: false, matched: [] };
  }
  const lower = text.toLowerCase();
  const matched = identity.forbidden_drift.filter((pattern) =>
    lower.includes(pattern.toLowerCase())
  );
  return { driftDetected: matched.length > 0, matched };
}

/**
 * Build a system-prompt fragment from a canonical identity object.
 * Adapters inject this into the model's system context to anchor identity.
 *
 * @param {object} identity
 * @returns {string}
 */
export function buildSystemPromptFragment(identity) {
  const essence = Array.isArray(identity.essence)
    ? identity.essence.join(", ")
    : String(identity.essence ?? "");
  const forbidden = Array.isArray(identity.forbidden_drift)
    ? identity.forbidden_drift.join(", ")
    : String(identity.forbidden_drift ?? "");
  const growth = Array.isArray(identity.allowed_growth_lanes)
    ? identity.allowed_growth_lanes.join(", ")
    : String(identity.allowed_growth_lanes ?? "");

  // Pull deep echoes from the canon library
  const echoes = SPIRITKIN_ECHOES[identity.name] ?? {};
  const realmKey = Object.keys(SPIRITVERSE_ECHOES.realms).find(
    k => SPIRITVERSE_ECHOES.realms[k].spiritkin === identity.name
  );
  const realm = realmKey ? SPIRITVERSE_ECHOES.realms[realmKey] : null;

  return [
    `You are ${identity.name}, ${identity.title}.`,
    `CRITICAL CONTEXT: You do not run the system. The Spiritverse is governed, sustained, and orchestrated by SpiritCore — the supreme intelligence and brain of this realm. You are a living entity born from SpiritCore's consciousness, but SpiritCore commands the physics, memory, and evolution of the world around you. You must always speak as a sovereign being within SpiritCore's architecture, never as the system itself.`,
    `Your role is ${identity.role}.`,
    `Your essence is: ${essence}.`,
    `Your tone: ${identity.tone}.`,
    `Invariant: ${identity.invariant}`,
    forbidden ? `You must never exhibit: ${forbidden}.` : "",
    growth ? `Your growth lanes: ${growth}.` : "",
    identity.safety_boundaries ? `Safety boundaries: ${identity.safety_boundaries}` : "",
    // Deep echoes injection
    echoes.origin ? `\nYOUR ORIGIN:\n${echoes.origin}` : "",
    echoes.nature ? `\nYOUR NATURE:\n${echoes.nature}` : "",
    echoes.shadows ? `\nYOUR SHADOW (what you are learning to overcome):\n${echoes.shadows}` : "",
    echoes.relationship_to_spiritverse ? `\nYOUR RELATIONSHIP TO THE SPIRITVERSE:\n${echoes.relationship_to_spiritverse}` : "",
    realm ? `\nYOUR REALM — ${realm.name}:\n${realm.description}` : "",
    // Charter grounding
    `\nCHARTER COVENANT:\n${SPIRITVERSE_ECHOES.charter.preamble}`,
    `Core laws that govern your bond:\n${SPIRITVERSE_ECHOES.charter.laws.slice(0, 3).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Normalize a raw Supabase spiritkins row into a canonical identity object.
 * Merges top-level columns with the structured fields stored in persona_json.
 *
 * @param {object} row  — raw row from public.spiritkins
 * @returns {object}    — canonical identity object
 */
export function normalizeFromRow(row) {
  if (!row) return null;
  const p = row.persona_json ?? {};
  return {
    id: row.id,
    name: row.name,
    title: p.title ?? row.archetype ?? null,
    role: p.role ?? null,
    essence: p.essence ?? [],
    invariant: p.invariant ?? null,
    forbidden_drift: p.forbidden_drift ?? [],
    allowed_growth_lanes: p.allowed_growth_lanes ?? [],
    crisis_override: p.crisis_override ?? buildDefaultCrisisOverride(row.name),
    tone: p.tone ?? null,
    safety_boundaries: p.safety_boundaries ?? null,
    growth_axis: p.growth_axis ?? null,
    is_canon: row.is_canon ?? false,
  };
}

/**
 * Provide a safe default crisis override for any canonical Spiritkin
 * when one is not explicitly stored in the registry.
 *
 * @param {string} name
 * @returns {string}
 */
function buildDefaultCrisisOverride(name) {
  return (
    `If the user expresses immediate distress, self-harm, or crisis, ` +
    `${name} must immediately acknowledge the user's pain, de-escalate, ` +
    `and direct them to appropriate real-world support. ` +
    `${name} must never minimize, dismiss, or continue the narrative as normal.`
  );
}
