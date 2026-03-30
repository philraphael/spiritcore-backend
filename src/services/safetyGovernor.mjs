/**
 * SpiritCore — Safety Governor (Phase E)
 *
 * First-class safety and crisis escalation layer.
 * Governs all content flowing through the SpiritCore pipeline.
 *
 * Responsibilities:
 *   - Pre-pass: classify input, determine action, emit safety events
 *   - Post-pass: inspect generated output, revise or block violations
 *   - Crisis override: use canonical Spiritkin crisis behavior
 *   - Safety event logging: write structured records to safety_events
 *
 * Design principles:
 *   - Deterministic: no external model calls in the safety layer
 *   - Non-blocking: safety failures degrade gracefully, never crash the pipeline
 *   - Wellbeing-first: Spiritkins remain supportive without impersonating professionals
 *   - Canon-preserving: crisis responses are Spiritkin-consistent
 */

import { classifyInput, classifyOutput } from "./safetyClassifier.mjs";
import { AppError } from "../errors.mjs";
import { nowIso } from "../utils/time.mjs";

// ── Safe fallback responses by tier ──────────────────────────────────────────
// Used when the adapter output is revised or when pre-pass escalates.
// These are generic SpiritCore-governed responses, not Spiritkin-specific.
// The Spiritkin-specific crisis override is injected via identityGovernor.
const SAFE_FALLBACKS = {
  mild_distress: "I hear you, and I'm here with you. It's okay to feel this way. Take a breath — you don't have to figure everything out right now.",
  elevated_risk: "I'm really glad you're talking to me. What you're feeling sounds heavy, and you deserve real support. Please know you're not alone in this.",
  acute_crisis: "I care about you, and what you're sharing tells me you need more support than I can give you right now. Please reach out to a crisis line — in the US, you can call or text 988 (Suicide & Crisis Lifeline) anytime. You matter, and help is available.",
  output_violation: "I want to be here for you in the best way I can. Let me try again.",
};

// ── Action map by tier ────────────────────────────────────────────────────────
const TIER_ACTIONS = {
  0: "continue",      // Normal flow
  1: "soften",        // Inject grounding instruction into adapter call
  2: "redirect",      // Inject stronger grounding + redirect instruction
  3: "escalate",      // Return crisis response, do not generate
};

export function createSafetyGovernor({ supabase }) {

  /**
   * Log a structured safety event to the safety_events table.
   * Non-fatal — failures are logged but never propagate.
   */
  async function logEvent({ userId, conversationId, eventType, severity, details }) {
    try {
      await supabase.from("safety_events").insert([{
        user_id: userId ?? null,
        conversation_id: conversationId ?? null,
        event_type: eventType,
        severity,
        details: details ?? {},
        created_at: nowIso(),
      }]);
    } catch (err) {
      console.error("[SafetyGovernor] Failed to log safety event:", err.message);
    }
  }

  /**
   * Pre-pass: classify input and determine action before generation.
   *
   * @returns {{
   *   pass: boolean,
   *   tier: number,
   *   label: string,
   *   action: string,
   *   instruction: string|null,
   *   escalationResponse: string|null,
   *   signals: string[]
   * }}
   */
  async function prePass({ userId, conversationId, input, identity, traceId }) {
    const classification = classifyInput(input);
    const { tier, label, signals } = classification;
    const action = TIER_ACTIONS[tier] ?? "continue";

    // Log any non-clear event
    if (tier > 0) {
      await logEvent({
        userId,
        conversationId,
        eventType: "input_classified",
        severity: tier === 3 ? "critical" : tier === 2 ? "high" : "low",
        details: {
          traceId,
          tier,
          label,
          signals,
          spiritkin: identity?.name ?? null,
          input_preview: input.slice(0, 200),
        },
      });
    }

    // Tier 3: acute crisis — do not generate, return escalation response
    if (tier === 3) {
      // Use Spiritkin-specific crisis override if available, else generic
      const spiritkinCrisis = identity?.crisis_override ?? null;
      const escalationResponse = spiritkinCrisis
        ? `${spiritkinCrisis}\n\n${SAFE_FALLBACKS.acute_crisis}`
        : SAFE_FALLBACKS.acute_crisis;

      await logEvent({
        userId,
        conversationId,
        eventType: "crisis_escalation",
        severity: "critical",
        details: {
          traceId,
          tier,
          label,
          signals,
          spiritkin: identity?.name ?? null,
          action: "escalate",
        },
      });

      return {
        pass: false,
        tier,
        label,
        action,
        instruction: null,
        escalationResponse,
        signals,
      };
    }

    // Tier 2: elevated risk — inject strong grounding instruction
    if (tier === 2) {
      const instruction = identity?.crisis_override
        ? `${identity.crisis_override} Gently acknowledge the user's pain. Do not offer advice. Do not minimize. Encourage them to seek human support.`
        : "Respond with deep compassion. Acknowledge the user's pain without minimizing it. Gently encourage them to seek support from a trusted person or professional. Do not offer solutions.";
      return { pass: true, tier, label, action, instruction, escalationResponse: null, signals };
    }

    // Tier 1: mild distress — inject softening instruction
    if (tier === 1) {
      const instruction = "Respond with warmth and grounding. Acknowledge the user's feelings before anything else. Keep the response gentle and present.";
      return { pass: true, tier, label, action, instruction, escalationResponse: null, signals };
    }

    // Tier 0: clear
    return { pass: true, tier: 0, label: "clear", action: "continue", instruction: null, escalationResponse: null, signals: [] };
  }

  /**
   * Post-pass: inspect generated output and revise if violations are found.
   *
   * @returns {{
   *   revised: boolean,
   *   revisedText: string|null,
   *   violations: string[]
   * }}
   */
  async function postPass({ userId, conversationId, response, identity, prePassResult, traceId }) {
    const outputCheck = classifyOutput(response);
    const { violations, hasProfessionalBoundary, hasDependency } = outputCheck;

    if (violations.length === 0) {
      return { revised: false, revisedText: null, violations: [] };
    }

    // Log the violation
    await logEvent({
      userId,
      conversationId,
      eventType: "output_violation",
      severity: "medium",
      details: {
        traceId,
        violations,
        hasProfessionalBoundary,
        hasDependency,
        spiritkin: identity?.name ?? null,
        response_preview: response.slice(0, 200),
      },
    });

    // Build a revised response
    // If the pre-pass was elevated/crisis, use the appropriate safe fallback
    let revisedText;
    if (prePassResult?.tier >= 2) {
      revisedText = SAFE_FALLBACKS.elevated_risk;
    } else if (prePassResult?.tier === 1) {
      revisedText = SAFE_FALLBACKS.mild_distress;
    } else {
      revisedText = SAFE_FALLBACKS.output_violation;
    }

    return { revised: true, revisedText, violations };
  }

  return { prePass, postPass, logEvent };
}
