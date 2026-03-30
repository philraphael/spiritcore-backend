// adapters/templateAdapter.mjs
// Model Plane v0 — Template Adapter (no external AI yet)
// This is the "brain plug-in" SpiritCore can swap later.

export function toneLineFromTone(tone) {
  return (
    tone === "extra-gentle" ? "I’m going to be extra gentle with you right now." :
    tone === "grounding" ? "Let’s slow down and get grounded together." :
    tone === "bright" ? "I’m matching your energy—let’s go." :
    tone === "soft" ? "We can keep this calm and steady." :
    "I’m here with warm steady support."
  );
}

export function buildMemoryLine(memories, policy) {
  if (Array.isArray(memories) && memories.length > 0) {
    return `I remember: ${memories.map((m) => `"${m.content}"`).join("; ")}.`;
  }
  if (policy?.max_memories === 0) {
    return "I can’t access long-term memory right now.";
  }
  return "";
}

/**
 * Generate a reply using templates (hybrid v0).
 * Input: context object from server.
 * Output: { text, meta }
 */
export async function generate({ spiritkin, userText, mood, memories, policy }) {
  const name = spiritkin?.name || "Lyra";
  const archetype = spiritkin?.archetype ? ` (${spiritkin.archetype})` : "";

  const toneLine = toneLineFromTone(mood?.tone || "warm");
  const memoryLine = buildMemoryLine(memories || [], policy);

  const heard = userText
    ? `I hear you saying: “${userText}.”`
    : `I’m here with you.`;

  const closer =
    "We’re building this step-by-step, and I’ll keep continuity as we go.";

  const identity = `— ${name}${archetype}.`;

  const text = [toneLine, heard, memoryLine, closer, identity]
    .filter(Boolean)
    .join(" ");

  return {
    text,
    meta: {
      adapter: "template",
      used_memories: (memories || []).length,
      tone: mood?.tone || "warm",
    },
  };
}
