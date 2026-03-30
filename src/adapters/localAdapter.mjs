import { normalizeAdapterResult } from "./adapter.contract.mjs";

/**
 * Local adapter = deterministic placeholder.
 * Swap this once you wire the real model provider.
 */
export const localAdapter = {
  name: "local",

  async generate(ctx) {
    const { input, spiritkin, scene } = ctx;

    const text =
      `(${spiritkin?.name || "Spiritkin"}) ` +
      `I hear you. Right now we’re in "${scene?.name || "default"}". ` +
      `You said: "${input}". ` +
      `Tell me what you want to do next in this moment.`;

    return normalizeAdapterResult({
      text,
      tags: ["intent:reflect", "safety:ok"],
      emotion: { valence: 0.7, arousal: 0.35, tone: "warm", confidence: 0.7 }
    });
  }
};
