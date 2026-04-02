/**
 * Shared OpenAI adapter helpers.
 * This module is intentionally side-effect free so it can be reused by
 * multiple adapter implementations.
 */

export const toOpenAIMessage = (role, content) => ({ role, content: String(content ?? "") });

export const buildOpenAIMessages = ({ system = "", history = [], userInput = "" } = {}) => {
  const out = [];
  if (system) out.push(toOpenAIMessage("system", system));
  for (const m of history) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
    out.push(toOpenAIMessage(role, m.content ?? ""));
  }
  if (userInput) out.push(toOpenAIMessage("user", userInput));
  return out;
};

export const extractOpenAIText = (response) => {
  if (!response) return "";
  if (typeof response.output_text === "string") return response.output_text;
  if (Array.isArray(response.output)) {
    const chunks = [];
    for (const item of response.output) {
      if (item?.content && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c?.type === "output_text" && typeof c?.text === "string") chunks.push(c.text);
        }
      }
    }
    if (chunks.length) return chunks.join("\n");
  }
  const choiceText = response?.choices?.[0]?.message?.content;
  return typeof choiceText === "string" ? choiceText : "";
};
