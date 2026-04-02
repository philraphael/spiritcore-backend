import { generateSpiritCoreResponse, generateSpeech } from "./openai.shared.mjs";

export const openaiAdapter = {
  name: "openai",

  async generate(ctx) {
    return generateSpiritCoreResponse(ctx, { allowFallback: true, caller: "openai" });
  },

  async generateSpeech(text, voice) {
    return generateSpeech(text, voice);
  }
};
