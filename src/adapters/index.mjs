import { config } from "../config.mjs";
import { AppError } from "../errors.mjs";
import { assertAdapterContract } from "./adapter.contract.mjs";
import { localAdapter } from "./localAdapter.mjs";
import { openaiAdapter } from "./openaiAdapter.mjs";
import { templateAdapter } from "./templateAdapter.mjs";

export const buildAdapterRegistry = ({ bus }) => {
  const registry = new Map();
  [localAdapter, openaiAdapter, templateAdapter].forEach((a) => {
    assertAdapterContract(a);
    registry.set(a.name, a);
  });

  const activeName = config.adapterMode;
  const active = registry.get(activeName);
  if (!active) throw new AppError("CONFIG", `Unknown ADAPTER_MODE: ${activeName}`, 500);

  bus.emit("adapters.ready", { active: active.name, available: [...registry.keys()] });

  return {
    activeName: active.name,
    getActive: () => active,
    list: () => [...registry.keys()]
  };
};
