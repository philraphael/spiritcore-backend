import { AppError } from "../errors.mjs";

/**
 * Adapter Contract (Phase 4):
 * - All adapters MUST implement:
 *   - name: string
 *   - generate(ctx): Promise<AdapterResult>
 *
 * AdapterResult must include:
 * - text: string
 * - tags: string[]            (intent + safety tags)
 * - emotion: { valence, arousal, tone, confidence }
 * - toolCalls?: []           (reserved for future)
 */
export const assertAdapterContract = (adapter) => {
  if (!adapter || typeof adapter !== "object") throw new AppError("ADAPTER", "Invalid adapter", 500);
  if (!adapter.name || typeof adapter.name !== "string") throw new AppError("ADAPTER", "Adapter missing name", 500);
  if (typeof adapter.generate !== "function") throw new AppError("ADAPTER", "Adapter missing generate()", 500);
};

export const normalizeAdapterResult = (raw) => {
  const text = typeof raw?.text === "string" ? raw.text : "";
  const tags = Array.isArray(raw?.tags) ? raw.tags.filter((t) => typeof t === "string") : [];
  const emotion = raw?.emotion && typeof raw.emotion === "object" ? raw.emotion : {};
  const rawTone = String(emotion.tone ?? "").trim();

  const normalized = {
    text,
    tags,
    emotion: {
      valence: clamp01(Number(emotion.valence ?? 0.5)),
      arousal: clamp01(Number(emotion.arousal ?? 0.4)),
      // Reject bare 'warm' — require a specific tone; fall back to 'steady presence'
      tone: (rawTone && rawTone.toLowerCase() !== "warm") ? rawTone : "steady presence",
      confidence: clamp01(Number(emotion.confidence ?? 0.6))
    },
    // sceneName is optional but always normalized: empty string means not set
    sceneName: typeof raw?.sceneName === "string" && raw.sceneName.trim() ? raw.sceneName.trim() : "",
    toolCalls: Array.isArray(raw?.toolCalls) ? raw.toolCalls : []
  };

  if (!normalized.text) {
    throw new AppError("ADAPTER_OUTPUT", "Adapter returned empty text", 500, { raw });
  }
  return normalized;
};

const clamp01 = (n) => {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
};
