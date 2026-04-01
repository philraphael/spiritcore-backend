import { normalizeAdapterResult } from "./adapter.contract.mjs";

/**
 * Template adapter = uses Spiritverse narrative scaffolds.
 * Good for controlled, predictable outputs early.
 */
export const templateAdapter = {
  name: "template",

  async generate(ctx) {
    const { input, spiritkin, scene } = ctx;
    const recentEpisode = getRecentEpisodeSnippet(ctx);

    const text =
      `${spiritkin?.name || "Your Spiritkin"} tilts their head, ` +
      `the air in "${scene?.name || "the Spiritverse"}" shifting gently.\n\n` +
      (recentEpisode
        ? `A recent echo returns to them too: "${recentEpisode}".\n\n`
        : "") +
      `"Okay. I'm with you. Say it plainly-what matters most right now?"\n\n` +
      `You: ${input}`;

    return normalizeAdapterResult({
      text,
      tags: [
        "intent:coach",
        "safety:ok",
        ...(recentEpisode ? ["memory:active"] : []),
      ],
      emotion: { valence: 0.75, arousal: 0.45, tone: "steady", confidence: 0.72 }
    });
  }
};

function getRecentEpisodeSnippet(ctx) {
  const episodes = Array.isArray(ctx?.context?.episodes) ? ctx.context.episodes : [];
  const recent = episodes.find((episode) => typeof episode?.content === "string" && episode.content.trim());
  if (!recent) return null;

  const normalized = recent.content.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized === String(ctx?.input ?? "").replace(/\s+/g, " ").trim()) return null;

  return normalized.slice(0, 160);
}
