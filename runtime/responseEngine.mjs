import { generate as templateGenerate } from "../adapters/templateAdapter.mjs";
import { generate as localGenerate } from "../adapters/localAdapter.mjs";

export default class ResponseEngine {
  constructor({ useLLM = false } = {}) {
    this.useLLM = !!useLLM;
  }

  async generate({ spiritkin, userText, mood, memories, policy, context }) {
    // We pass a "meta" bundle to adapters without breaking your existing adapter interface:
    // Adapters can ignore fields they don't use yet.
    const payload = {
      spiritkin,
      userText,
      mood,
      memories,
      policy,
      meta: {
        context, // stitched runtime context: emotion + episodes + memories
      },
    };

    if (this.useLLM) {
      return localGenerate(payload);
    }
    return templateGenerate(payload);
  }
}
