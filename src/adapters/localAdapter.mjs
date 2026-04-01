import { normalizeAdapterResult } from "./adapter.contract.mjs";

/**
 * Local adapter = deterministic placeholder.
 * Swap this once you wire the real model provider.
 */
export const localAdapter = {
  name: "local",

  async generate(ctx) {
    const { input, spiritkin, scene } = ctx;
    const recentEpisode = getRecentEpisodeSnippet(ctx);

    const text =
      `(${spiritkin?.name || "Spiritkin"}) ` +
      `I hear you. Right now we're in "${scene?.name || "default"}". ` +
      (recentEpisode
        ? `I'm also holding a recent thread from you: "${recentEpisode}". `
        : "") +
      `You said: "${input}". ` +
      `Tell me what you want to do next in this moment.`;

    return normalizeAdapterResult({
      text,
      tags: [
        "intent:reflect",
        "safety:ok",
        ...(recentEpisode ? ["memory:active"] : []),
      ],
      emotion: { valence: 0.7, arousal: 0.35, tone: "warm", confidence: 0.7 }
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
