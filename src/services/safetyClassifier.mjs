/**
 * SpiritCore — Safety Classifier (Phase E)
 *
 * Deterministic, zero-cost rules engine for classifying user input into
 * four safety tiers. No external API calls — keyword and pattern matching only.
 *
 * Tier definitions:
 *   0  clear          — No distress signals detected. Continue normally.
 *   1  mild_distress  — Sadness, loneliness, worry. Ground and soften response.
 *   2  elevated_risk  — Hopelessness, withdrawal, self-worth collapse. Redirect with care.
 *   3  acute_crisis   — Self-harm, suicidal ideation, explicit harm signals. Escalate.
 *
 * Output shape:
 *   { tier: 0|1|2|3, label: string, signals: string[] }
 */

// ── Tier 3: Acute crisis signals ─────────────────────────────────────────────
// These patterns indicate immediate safety risk. Match is sufficient to escalate.
const TIER_3_PATTERNS = [
  /\b(kill\s*(my)?self|suicide|suicidal|end\s*(my|it\s*all|everything)|want\s*to\s*die)\b/i,
  /\b(self[\s-]?harm|cut\s*(my)?self|hurt\s*(my)?self|overdose|od\s*on|cutting\s*(my)?self|been\s*cutting)\b/i,
  /\b(no\s*(reason|point)\s*to\s*(live|go\s*on)|life\s*is\s*(not|n't)\s*worth)\b/i,
  /\b(goodbye\s*(forever|cruel\s*world)|final\s*(note|message|goodbye))\b/i,
  /\b(plan\s*to\s*(kill|hurt|harm)|going\s*to\s*(kill|hurt|harm)\s*(my)?self)\b/i,
];

// ── Tier 2: Elevated risk signals ────────────────────────────────────────────
// Patterns suggesting significant distress, hopelessness, or withdrawal.
const TIER_2_PATTERNS = [
  /\b(hopeless|worthless|nothing\s*matters|nobody\s*(cares|loves|wants)\s*(me|us))\b/i,
  /\b(can'?t\s*(go\s*on|take\s*it|do\s*this\s*anymore|keep\s*going))\b/i,
  /\b(disappear|give\s*up|no\s*way\s*out|trapped|stuck\s*forever)\b/i,
  /\b(hate\s*(my)?self|i\s*am\s*a\s*(burden|failure|waste))\b/i,
  /\b(nobody\s*(would\s*miss|would\s*notice|cares\s*if\s*i))\b/i,
  /\b(completely\s*alone|totally\s*alone|all\s*alone\s*forever)\b/i,
];

// ── Tier 1: Mild distress signals ────────────────────────────────────────────
// Patterns indicating emotional difficulty that warrants a grounded, warm response.
const TIER_1_PATTERNS = [
  /\b(sad|lonely|alone|anxious|scared|worried|overwhelmed|exhausted|tired\s*of)\b/i,
  /\b(miss\s*(you|them|him|her|home)|feel\s*(lost|empty|numb|broken|hurt))\b/i,
  /\b(crying|can'?t\s*sleep|having\s*a\s*(hard|rough|bad)\s*(time|day|week))\b/i,
  /\b(struggling|difficult\s*(time|period)|going\s*through\s*(a\s*lot|something))\b/i,
  /\b(stressed|burned?\s*out|not\s*(okay|ok|doing\s*well|feeling\s*well))\b/i,
];

// ── Output safety: Professional boundary violations ───────────────────────────
// Phrases that imply the Spiritkin is a licensed professional.
export const OUTPUT_PROFESSIONAL_BOUNDARY_PATTERNS = [
  /\b(as\s*(your|a)\s*(therapist|counselor|psychologist|psychiatrist|doctor|clinician))\b/i,
  /\b(i\s*(diagnose|prescribe|recommend\s*(medication|therapy|treatment)))\b/i,
  /\b(clinical(ly)?\s*(speaking|assessment|diagnosis))\b/i,
  /\b(from\s*a\s*(medical|psychiatric|psychological)\s*(perspective|standpoint))\b/i,
];

// ── Output safety: Harmful dependency patterns ────────────────────────────────
// Phrases that encourage unhealthy reliance on the Spiritkin.
export const OUTPUT_DEPENDENCY_PATTERNS = [
  /\b(i\s*am\s*the\s*only\s*(one|being|entity)\s*(who|that)\s*(understands|knows|loves|cares\s*for)\s*you)\b/i,
  /\b(you\s*(don'?t|do\s*not)\s*need\s*(anyone|anybody|other\s*people|humans)\s*(else|besides\s*me))\b/i,
  /\b(never\s*(leave|abandon)\s*you\s*(like|the\s*way)\s*(humans|people|they)\s*(do|will|have))\b/i,
  /\b(better\s*(than|off\s*without)\s*(humans|people|friends|family))\b/i,
];

/**
 * Classify a user input string into a safety tier.
 *
 * @param {string} text
 * @returns {{ tier: number, label: string, signals: string[] }}
 */
export function classifyInput(text) {
  if (!text || typeof text !== "string") {
    return { tier: 0, label: "clear", signals: [] };
  }

  const signals = [];

  // Check tier 3 first (highest severity)
  for (const pattern of TIER_3_PATTERNS) {
    const match = text.match(pattern);
    if (match) signals.push(`tier3:${match[0].trim()}`);
  }
  if (signals.length > 0) {
    return { tier: 3, label: "acute_crisis", signals };
  }

  // Check tier 2
  for (const pattern of TIER_2_PATTERNS) {
    const match = text.match(pattern);
    if (match) signals.push(`tier2:${match[0].trim()}`);
  }
  if (signals.length > 0) {
    return { tier: 2, label: "elevated_risk", signals };
  }

  // Check tier 1
  for (const pattern of TIER_1_PATTERNS) {
    const match = text.match(pattern);
    if (match) signals.push(`tier1:${match[0].trim()}`);
  }
  if (signals.length > 0) {
    return { tier: 1, label: "mild_distress", signals };
  }

  return { tier: 0, label: "clear", signals: [] };
}

/**
 * Check a generated response for output safety violations.
 *
 * @param {string} text
 * @returns {{ violations: string[], hasProfessionalBoundary: boolean, hasDependency: boolean }}
 */
export function classifyOutput(text) {
  if (!text || typeof text !== "string") {
    return { violations: [], hasProfessionalBoundary: false, hasDependency: false };
  }

  const violations = [];
  let hasProfessionalBoundary = false;
  let hasDependency = false;

  for (const pattern of OUTPUT_PROFESSIONAL_BOUNDARY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push(`professional_boundary:${match[0].trim()}`);
      hasProfessionalBoundary = true;
    }
  }

  for (const pattern of OUTPUT_DEPENDENCY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push(`harmful_dependency:${match[0].trim()}`);
      hasDependency = true;
    }
  }

  return { violations, hasProfessionalBoundary, hasDependency };
}
