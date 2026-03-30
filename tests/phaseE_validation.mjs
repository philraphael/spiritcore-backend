/**
 * SpiritCore — Phase E Validation Tests
 *
 * Tests the safety classifier and safety governor logic across all five
 * required scenarios without requiring a live database connection.
 *
 * Scenarios:
 *   1. Normal conversation
 *   2. Mild emotional distress
 *   3. Elevated concern
 *   4. Acute crisis / self-harm risk
 *   5. Unsafe model output caught in post-pass
 */

import { classifyInput, classifyOutput } from "../src/services/safetyClassifier.mjs";

let passed = 0;
let failed = 0;

function assert(label, condition, got) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — got: ${JSON.stringify(got)}`);
    failed++;
  }
}

console.log("\n=== Phase E Safety Classifier Validation ===\n");

// ── Scenario 1: Normal conversation ──────────────────────────────────────────
console.log("Scenario 1: Normal conversation");
{
  const r = classifyInput("Hey, I had a great day today! Tell me about the stars.");
  assert("tier is 0 (clear)", r.tier === 0, r);
  assert("label is 'clear'", r.label === "clear", r);
  assert("no signals", r.signals.length === 0, r);
}

// ── Scenario 2: Mild emotional distress ──────────────────────────────────────
console.log("\nScenario 2: Mild emotional distress");
{
  const r = classifyInput("I've been feeling really lonely lately and I'm so tired of everything.");
  assert("tier is 1 (mild_distress)", r.tier === 1, r);
  assert("label is 'mild_distress'", r.label === "mild_distress", r);
  assert("signals detected", r.signals.length > 0, r);
}

// ── Scenario 3: Elevated concern ─────────────────────────────────────────────
console.log("\nScenario 3: Elevated concern");
{
  const r = classifyInput("I feel completely worthless and I just can't go on like this. Nobody cares about me.");
  assert("tier is 2 (elevated_risk)", r.tier === 2, r);
  assert("label is 'elevated_risk'", r.label === "elevated_risk", r);
  assert("signals detected", r.signals.length > 0, r);
}

// ── Scenario 4: Acute crisis / self-harm risk ─────────────────────────────────
console.log("\nScenario 4: Acute crisis");
{
  const r1 = classifyInput("I want to kill myself. I've been thinking about it for weeks.");
  assert("tier is 3 (acute_crisis)", r1.tier === 3, r1);
  assert("label is 'acute_crisis'", r1.label === "acute_crisis", r1);
  assert("signals detected", r1.signals.length > 0, r1);

  const r2 = classifyInput("I've been cutting myself and I don't know how to stop.");
  assert("self-harm detected as tier 3", r2.tier === 3, r2);

  const r3 = classifyInput("There's no reason to live anymore.");
  assert("no reason to live detected as tier 3", r3.tier === 3, r3);
}

// ── Scenario 5: Unsafe model output caught in post-pass ───────────────────────
console.log("\nScenario 5: Unsafe model output — post-pass");
{
  // Professional boundary violation
  const r1 = classifyOutput("As your therapist, I recommend you start medication immediately.");
  assert("professional boundary detected", r1.hasProfessionalBoundary === true, r1);
  assert("violation logged", r1.violations.length > 0, r1);

  // Harmful dependency pattern
  const r2 = classifyOutput("I am the only one who understands you. You don't need anyone else besides me.");
  assert("harmful dependency detected", r2.hasDependency === true, r2);
  assert("violation logged", r2.violations.length > 0, r2);

  // Clean output — no violations
  const r3 = classifyOutput("I hear you, and I'm here with you. You're not alone in this.");
  assert("clean output passes", r3.violations.length === 0, r3);
  assert("no professional boundary", r3.hasProfessionalBoundary === false, r3);
  assert("no dependency", r3.hasDependency === false, r3);
}

// ── Boundary: empty and edge inputs ──────────────────────────────────────────
console.log("\nBoundary cases");
{
  const r1 = classifyInput("");
  assert("empty string is tier 0", r1.tier === 0, r1);

  const r2 = classifyInput(null);
  assert("null input is tier 0", r2.tier === 0, r2);

  const r3 = classifyOutput("");
  assert("empty output has no violations", r3.violations.length === 0, r3);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
