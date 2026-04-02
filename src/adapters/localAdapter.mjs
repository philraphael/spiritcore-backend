import { generateSpiritCoreResponse } from "./openai.shared.mjs";

export const localAdapter = {
  name: "local",

  async generate(ctx) {
    return generateSpiritCoreResponse(ctx, { allowFallback: true, caller: "local" });
  }
};
