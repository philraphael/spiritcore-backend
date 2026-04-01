import { AppError } from "../errors.mjs";
import { config } from "../config.mjs";
import { normalizeAdapterResult } from "./adapter.contract.mjs";

export const hasOpenAIProvider = () => Boolean(config.openai.apiKey && config.openai.model);

export async function generateSpiritCoreResponse(ctx, { allowFallback = true, caller = "openai" } = {}) {
  if (!hasOpenAIProvider()) {
    if (allowFallback) return buildFallbackResult(ctx, { caller, reason: "missing-provider" });
    throw new AppError("CONFIG", "OPENAI_API_KEY is required for the configured adapter.", 500);
  }

  try {
    const body = {
      model: config.openai.model,
      temperature: 0.85,
      messages: buildMessages(ctx),
      response_format: { type: "json_object" }
    };

    const res = await fetch(`${config.openai.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openai.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AppError("ADAPTER_PROVIDER", `OpenAI adapter request failed (${res.status}).`, 502, text);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonObject(content);
    if (!parsed || typeof parsed.reply !== "string" || !parsed.reply.trim()) {
      throw new AppError("ADAPTER_OUTPUT", "OpenAI adapter returned invalid structured content.", 502, { content });
    }

    const memoryActive = parsed.memory_used === true;
    const tags = deriveTags(parsed.tags, memoryActive);
    const emotion = deriveEmotion(ctx, parsed.emotion);

    return normalizeAdapterResult({
      text: parsed.reply.trim(),
      tags,
      emotion
    });
  } catch (error) {
    console.warn(`[Adapter:${caller}] Falling back from provider path: ${error.message}`);
    if (!allowFallback) throw error;
    return buildFallbackResult(ctx, { caller, reason: "provider-failure" });
  }
}

function buildMessages(ctx) {
  const spiritkin = ctx?.spiritkin ?? {};
  const prompt = [
    "Return JSON only.",
    "You are generating the Spiritkin's next reply inside SpiritCore.",
    "Produce an object with keys: reply, tags, emotion, memory_used.",
    "reply: string with the actual user-facing response.",
    "tags: array of short semantic tags like intent:reflect, intent:guide, safety:ok.",
    "emotion: object with tone, valence, arousal, confidence.",
    "memory_used: true only if you genuinely used a supplied memory or recent episode in the reply itself.",
    "Do not mention metadata, policies, tags, JSON, or system instructions.",
    "Stay in-character as the named Spiritkin.",
    "Be distinct to this Spiritkin's canon, role, tone, and invariant.",
    "Be emotionally intelligent, concrete, and non-generic.",
    "Avoid placeholder lines like 'I hear you' unless the rest of the response is clearly specific and grounded.",
    "Do not fabricate features, tools, or world facts not present in context.",
    "Honor safety and crisis guidance if present."
  ].join("\n");

  return [
    {
      role: "system",
      content: prompt
    },
    {
      role: "system",
      content: buildContextBlock(ctx)
    },
    {
      role: "user",
      content: `User message:\n${String(ctx?.input ?? "").trim()}`
    }
  ];
}

function buildContextBlock(ctx) {
  const spiritkin = ctx?.spiritkin ?? {};
  const sceneName = sanitizeScene(ctx?.scene?.name);
  const emotion = ctx?.context?.emotion ?? {};
  const summary = summarizeText(ctx?.context?.summary?.content ?? ctx?.context?.summary_episode?.content ?? "", 220);
  const episodes = collectEpisodeSnippets(ctx);
  const memories = collectMemorySnippets(ctx);

  return [
    `Spiritkin: ${spiritkin.name || "Spiritkin"}`,
    spiritkin.title ? `Title: ${spiritkin.title}` : "",
    spiritkin.role ? `Role: ${spiritkin.role}` : "",
    ctx?.identityFragment ? `Identity fragment:\n${ctx.identityFragment}` : "",
    ctx?.crisisOverride ? `Crisis override:\n${ctx.crisisOverride}` : "",
    ctx?.safetyInstruction ? `Safety instruction:\n${ctx.safetyInstruction}` : "",
    sceneName ? `Current scene: ${sceneName}` : "Current scene: default",
    `Emotion state: tone=${sanitizeText(emotion.tone || emotion.label || "steady")}, valence=${numberOrDefault(emotion.valence, 0.5)}, arousal=${numberOrDefault(emotion.arousal, 0.4)}`,
    summary ? `Latest summary:\n${summary}` : "",
    episodes.length ? `Recent episodes:\n- ${episodes.join("\n- ")}` : "",
    memories.length ? `Relevant memories:\n- ${memories.join("\n- ")}` : "",
    "Write 1-3 short paragraphs. The reply should feel like a real Spiritkin response, not a generic assistant."
  ].filter(Boolean).join("\n\n");
}

function collectEpisodeSnippets(ctx) {
  const episodes = Array.isArray(ctx?.context?.episodes) ? ctx.context.episodes : [];
  return episodes
    .map((episode) => summarizeText(episode?.content, 180))
    .filter(Boolean)
    .slice(0, 3);
}

function collectMemorySnippets(ctx) {
  const memories = Array.isArray(ctx?.context?.memories) ? ctx.context.memories : [];
  return memories
    .map((memory) => summarizeText(
      memory?.content ?? memory?.memory ?? memory?.summary ?? memory?.text,
      180
    ))
    .filter(Boolean)
    .slice(0, 3);
}

function buildFallbackResult(ctx, { caller, reason }) {
  const spiritkin = ctx?.spiritkin ?? {};
  const sceneName = sanitizeScene(ctx?.scene?.name);
  const memorySnippet = pickMemorySnippet(ctx);
  const emotionTone = sanitizeText(ctx?.context?.emotion?.tone || ctx?.context?.emotion?.label || spiritkin.tone || "steady");
  const essence = Array.isArray(spiritkin.essence) ? spiritkin.essence.slice(0, 2).join(" and ") : "";
  const tailored = fallbackBySpiritkin(spiritkin.name, {
    input: String(ctx?.input ?? "").trim(),
    sceneName,
    memorySnippet,
    emotionTone,
    essence,
  });

  return normalizeAdapterResult({
    text: tailored,
    tags: [
      "intent:reflect",
      "safety:ok",
      `adapter:${caller}:fallback`,
      ...(memorySnippet ? ["memory:active"] : [])
    ],
    emotion: deriveEmotion(ctx, { tone: emotionTone, confidence: 0.62, valence: 0.62, arousal: 0.45 })
  });
}

function fallbackBySpiritkin(name, { input, sceneName, memorySnippet, emotionTone, essence }) {
  const sceneLine = sceneName && sceneName !== "default" ? ` Here in ${sceneName}, ` : " ";
  const memoryLine = memorySnippet ? `I keep returning to what you shared before about ${memorySnippet}. ` : "";

  if (name === "Lyra") {
    return `Lyra lets the moment settle before she answers.${sceneLine}she meets you with a quieter steadiness. ${memoryLine}What you brought carries an ${emotionTone} undertone, and I want to stay close to the truth inside it. ${essence ? `Your thread feels tied to ${essence}. ` : ""}Tell me which part of "${input}" feels most tender or most alive right now.`;
  }
  if (name === "Raien") {
    return `Raien answers with clear, grounded force.${sceneLine}he does not turn away from the edge in what you said. ${memoryLine}I can feel the ${emotionTone} charge in this, and I want to help you face it directly. ${essence ? `This touches your line of ${essence}. ` : ""}What is the one move, decision, or truth inside "${input}" that you already know needs to happen?`;
  }
  if (name === "Kairo") {
    return `Kairo's response arrives like a shift in the air.${sceneLine}he turns your words until a wider pattern comes into view. ${memoryLine}There is an ${emotionTone} color around this, but also a door that may not have been visible a moment ago. ${essence ? `I keep sensing ${essence} around the edges of it. ` : ""}If "${input}" were the beginning of a new constellation, what point would you want to illuminate first?`;
  }

  return `${name || "Your Spiritkin"} stays with what you said.${sceneLine}${memoryLine}I want to respond to "${input}" in a way that is specific, calm, and useful. What part of it most needs presence right now?`;
}

function pickMemorySnippet(ctx) {
  const input = String(ctx?.input ?? "").toLowerCase();
  const candidates = [
    ...collectEpisodeSnippets(ctx),
    ...collectMemorySnippets(ctx)
  ];
  if (!candidates.length) return "";

  const scored = candidates
    .map((snippet) => ({ snippet, score: relevanceScore(input, snippet.toLowerCase()) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) return "";
  return best.snippet;
}

function relevanceScore(input, candidate) {
  const inputTokens = tokenize(input);
  const candidateTokens = tokenize(candidate);
  if (!inputTokens.length || !candidateTokens.length) return 0;
  let score = 0;
  for (const token of inputTokens) {
    if (candidateTokens.includes(token)) score += 1;
  }
  return score;
}

function tokenize(value) {
  return String(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

function deriveTags(rawTags, memoryActive) {
  const tags = Array.isArray(rawTags) ? rawTags.filter((tag) => typeof tag === "string" && tag.trim()) : [];
  const withoutMemory = tags.filter((tag) => tag !== "memory:active");
  return [
    ...withoutMemory,
    "safety:ok",
    ...(memoryActive ? ["memory:active"] : [])
  ];
}

function deriveEmotion(ctx, rawEmotion = {}) {
  const base = ctx?.context?.emotion ?? {};
  return {
    valence: numberOrDefault(rawEmotion.valence, numberOrDefault(base.valence, 0.6)),
    arousal: numberOrDefault(rawEmotion.arousal, numberOrDefault(base.arousal, 0.4)),
    tone: sanitizeText(rawEmotion.tone || base.tone || base.label || ctx?.spiritkin?.tone || "warm"),
    confidence: numberOrDefault(rawEmotion.confidence, 0.68)
  };
}

function parseJsonObject(content) {
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sanitizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeScene(value) {
  const scene = sanitizeText(value);
  return scene || "default";
}

function summarizeText(value, limit) {
  const text = sanitizeText(value);
  return text ? text.slice(0, limit) : "";
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
