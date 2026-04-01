import { generateSpiritCoreResponse } from "./openai.shared.mjs";

export const openaiAdapter = {
  name: "openai",

  async generate(ctx) {
    return generateSpiritCoreResponse(ctx, { allowFallback: true, caller: "openai" });
  }
};
