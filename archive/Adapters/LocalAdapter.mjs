// adapters/localAdapter.mjs
// Model Plane v0 — Local Adapter STUB
// This file is a placeholder for a future local LLM (Ollama/LM Studio/etc).
// For now, it falls back to the template adapter style.

import { generate as templateGenerate } from "./templateAdapter.mjs";

/**
 * Future signature:
 *   generate({ spiritkin, userText, mood, memories, policy, history }) -> { text, meta }
 *
 * In v0 stub mode, we call template adapter so nothing breaks.
 */
export async function generate(ctx) {
  const result = await templateGenerate(ctx);
  return {
    ...result,
    meta: {
      ...(result.meta || {}),
      adapter: "local_stub",
      note: "Local LLM not wired yet; using template fallback.",
    },
  };
}
