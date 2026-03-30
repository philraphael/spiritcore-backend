import { normalizeAdapterResult } from "./adapter.contract.mjs";

/**
 * Template adapter = uses Spiritverse narrative scaffolds.
 * Good for controlled, predictable outputs early.
 */
export const templateAdapter = {
  name: "template",

  async generate(ctx) {
    const { input, spiritkin, scene } = ctx;

    const text =
      `${spiritkin?.name || "Your Spiritkin"} tilts their head, ` +
      `the air in "${scene?.name || "the Spiritverse"}" shifting gently.\n\n` +
      `“Okay. I’m with you. Say it plainly—what matters most right now?”\n\n` +
      `You: ${input}`;

    return normalizeAdapterResult({
      text,
      tags: ["intent:coach", "safety:ok"],
      emotion: { valence: 0.75, arousal: 0.45, tone: "steady", confidence: 0.72 }
    });
  }
};
