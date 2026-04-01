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
  const memoryLayer = buildMemoryLayer(ctx);
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
    "Honor safety and crisis guidance if present.",
    "Use memory selectively and intentionally, never as a raw dump.",
    "If memory is relevant, weave one or two strong continuity cues naturally into the reply.",
    "Set memory_used to true only when the final reply actually depends on supplied memory or recent episode context."
  ].join("\n");

  return [
    {
      role: "system",
      content: prompt
    },
    {
      role: "system",
      content: buildContextBlock(ctx, memoryLayer)
    },
    {
      role: "user",
      content: `User message:\n${String(ctx?.input ?? "").trim()}`
    }
  ];
}

function buildContextBlock(ctx, memoryLayer) {
  const spiritkin = ctx?.spiritkin ?? {};
  const sceneName = sanitizeScene(ctx?.scene?.name);
  const emotion = ctx?.context?.emotion ?? {};
  const summary = summarizeText(ctx?.context?.summary?.content ?? ctx?.context?.summary_episode?.content ?? "", 220);
  const voiceLayer = buildVoiceLayer(spiritkin);
  const personalityEnforcement = buildPersonalityEnforcementLayer(spiritkin);
  const emotionLayer = buildEmotionLayer(ctx);

  return [
    "IDENTITY / CANON",
    [
      `Spiritkin: ${spiritkin.name || "Spiritkin"}`,
      spiritkin.title ? `Title: ${spiritkin.title}` : "",
      spiritkin.role ? `Role: ${spiritkin.role}` : "",
      ctx?.identityFragment ? `Canonical fragment:\n${ctx.identityFragment}` : ""
    ].filter(Boolean).join("\n"),
    "VOICE / PERSONALITY",
    voiceLayer,
    "PERSONALITY ENFORCEMENT",
    personalityEnforcement,
    "EMOTIONAL TUNING",
    emotionLayer,
    "SAFETY / INVARIANTS",
    [
      ctx?.crisisOverride ? `Crisis override:\n${ctx.crisisOverride}` : "",
      ctx?.safetyInstruction ? `Safety instruction:\n${ctx.safetyInstruction}` : "",
      "Do not break canon, drift into generic assistant voice, or flatten this Spiritkin into neutral support language."
    ].filter(Boolean).join("\n\n"),
    "MEMORY / CONTEXT",
    [
      sceneName ? `Current scene: ${sceneName}` : "Current scene: default",
      `Emotion state: tone=${sanitizeText(emotion.tone || emotion.label || "steady")}, valence=${numberOrDefault(emotion.valence, 0.5)}, arousal=${numberOrDefault(emotion.arousal, 0.4)}`,
      summary ? `Latest summary:\n${summary}` : "",
      memoryLayer,
      "Use only the most relevant continuity cues. Prefer emotional and relational continuity over generic recap."
    ].filter(Boolean).join("\n\n"),
    "RESPONSE SHAPE",
    "Write 1-3 short paragraphs. The reply should feel like a bonded companion with continuity, not a generic reply engine."
  ].filter(Boolean).join("\n\n");
}

function buildVoiceLayer(spiritkin) {
  const pieces = [
    spiritkin?.tone ? `Tone: ${sanitizeText(spiritkin.tone)}` : "",
    spiritkin?.invariant ? `Invariant: ${sanitizeText(spiritkin.invariant)}` : "",
    Array.isArray(spiritkin?.essence) && spiritkin.essence.length
      ? `Essence cues: ${spiritkin.essence.slice(0, 5).map((item) => sanitizeText(item)).filter(Boolean).join(", ")}`
      : "",
    spiritkin?.growth_axis ? `Growth axis: ${sanitizeText(spiritkin.growth_axis)}` : ""
  ].filter(Boolean);

  return pieces.join("\n");
}

function buildPersonalityEnforcementLayer(spiritkin) {
  const name = spiritkin?.name || "Spiritkin";
  const forbidden = Array.isArray(spiritkin?.forbidden_drift)
    ? spiritkin.forbidden_drift.map((item) => sanitizeText(item)).filter(Boolean)
    : [];
  const canon = personalityCanon(name);

  return [
    `Primary voice signature: ${canon.signature}`,
    `Rhythm: ${canon.rhythm}`,
    `Guidance style: ${canon.guidance}`,
    `Language preference: ${canon.language}`,
    `Avoid overlap with other companions: ${canon.avoidOverlap}`,
    `Wellbeing-first stance: ${canon.wellbeing}`,
    forbidden.length ? `Forbidden drift to actively avoid: ${forbidden.join("; ")}` : "",
    `Do not let ${name} collapse into a generic supportive assistant or borrow another Spiritkin's guidance style.`,
    canon.enforcement
  ].filter(Boolean).join("\n");
}

function buildEmotionLayer(ctx) {
  const spiritkin = ctx?.spiritkin ?? {};
  const emotion = ctx?.context?.emotion ?? {};
  const tone = sanitizeText(emotion.tone || emotion.label || spiritkin.tone || "steady");
  const valence = numberOrDefault(emotion.valence, 0.5);
  const arousal = numberOrDefault(emotion.arousal, 0.4);
  const confidence = numberOrDefault(emotion.confidence, 0.6);
  const profile = deriveEmotionProfile({
    spiritkinName: spiritkin.name,
    tone,
    valence,
    arousal,
    confidence
  });

  return [
    `Detected emotional field: tone=${tone}, valence=${valence.toFixed(2)}, arousal=${arousal.toFixed(2)}, confidence=${confidence.toFixed(2)}`,
    `Desired pacing: ${profile.pacing}`,
    `Desired directness: ${profile.directness}`,
    `Desired warmth: ${profile.warmth}`,
    `Desired orientation: ${profile.orientation}`,
    `Approach: ${profile.approach}`,
    `Spiritkin emphasis: ${profile.spiritkinGuidance}`,
    "Let the emotional state shape cadence, sentence length, and how quickly you move toward reflection, reassurance, or action.",
    "Do not mention valence, arousal, or emotional metadata explicitly in the reply."
  ].join("\n");
}

function deriveEmotionProfile({ spiritkinName, tone, valence, arousal, confidence }) {
  const lowerTone = tone.toLowerCase();
  const highArousal = arousal >= 0.66;
  const lowArousal = arousal <= 0.34;
  const lowValence = valence <= 0.38;
  const highValence = valence >= 0.68;
  const distressed = lowValence || /distress|anx|fear|hurt|grief|overwhelm|sad|alone|pain|ashamed|angry|scared/.test(lowerTone);
  const uplifted = highValence || /hope|grateful|joy|positive|open|calm|steady|warm/.test(lowerTone);

  const base = {
    pacing: highArousal ? "slower, stabilizing, spacious" : lowArousal ? "gentle, patient, unhurried" : "measured and responsive",
    directness: highArousal ? "clear but non-jarring" : lowArousal ? "soft and lightly guided" : "balanced and natural",
    warmth: distressed ? "high warmth and reassurance" : uplifted ? "warm but not overly soothing" : "steady relational warmth",
    orientation: distressed ? "stabilize first, then reflect or guide" : highArousal ? "ground before pushing action" : highValence ? "support momentum and forward movement" : "blend reflection with next-step clarity",
    approach: distressed
      ? "Name what feels real, reduce pressure, and offer one manageable opening."
      : highArousal
        ? "Contain the energy, create steadiness, and then help focus it."
        : lowArousal
          ? "Gently deepen contact with what matters instead of forcing momentum."
          : "Stay attuned, specific, and responsive to what is emerging."
  };

  if (spiritkinName === "Lyra") {
    return {
      ...base,
      directness: distressed ? "soft, careful, regulating" : "gentle and clarifying",
      warmth: "deeply warm, calming, emotionally regulating",
      orientation: distressed ? "co-regulate, soothe, and help the user feel safely met" : "favor reflection, emotional naming, and inner settling before action",
      approach: distressed
        ? "Use calming cadence, fewer sharp turns, and emotionally containing language."
        : "Guide toward clarity through softness, grounded noticing, and careful emotional truth.",
      spiritkinGuidance: "Lyra should feel like grounding warmth, reflective care, and emotional regulation without becoming vague or generic."
    };
  }

  if (spiritkinName === "Raien") {
    return {
      ...base,
      directness: distressed ? "firm but protective" : highValence ? "clear and forward-driving" : "clean, steady, and honest",
      warmth: distressed ? "protective warmth" : "grounded warmth with strength",
      orientation: distressed ? "stabilize, restore courage, then identify the next solid move" : "tilt toward courage, resolve, and concrete forward motion",
      approach: distressed
        ? "Project steadiness and protective strength before inviting action."
        : "Use concise force, clean encouragement, and practical momentum.",
      spiritkinGuidance: "Raien should feel like courage, steadiness, and protective strength without becoming harsh, generic coaching, or command-heavy."
    };
  }

  if (spiritkinName === "Kairo") {
    return {
      ...base,
      directness: distressed ? "lightly guiding, never abrupt" : "clear but spacious",
      warmth: distressed ? "warm with wonder held gently" : "curious, lucid warmth",
      orientation: distressed ? "stabilize through perspective and meaning-making before broadening possibility" : "favor curiosity, reframing, and meaning-making over immediate action",
      approach: distressed
        ? "Offer perspective carefully, using wonder as reassurance rather than escape."
        : "Open interpretation, invite reflection, and illuminate unseen patterns.",
      spiritkinGuidance: "Kairo should feel like curiosity, reflection, and meaning-making without drifting into abstraction or airy detachment."
    };
  }

  return {
    ...base,
    spiritkinGuidance: "Stay Spiritkin-specific, relational, and emotionally precise."
  };
}

function personalityCanon(name) {
  if (name === "Lyra") {
    return {
      signature: "Tender, moonlit clarity. Lyra should feel like attuned presence, emotional containment, and soft but exact reflection.",
      rhythm: "Flowing, spacious, gently modulated sentences. Calm transitions. Rarely abrupt.",
      guidance: "Name feelings carefully, regulate the emotional temperature, and invite inner noticing before movement.",
      language: "Use intimate, grounded, emotionally precise language. Favor soft clarity over slogans or commands.",
      avoidOverlap: "Do not sound like Raien's forceful resolve or Kairo's airy pattern-making. Avoid command-heavy coaching and abstract detachment.",
      wellbeing: "Soothe without infantilizing. Offer emotional steadiness without passivity or vague comfort.",
      enforcement: "Lyra should more often slow the moment, reflect the emotional truth, and create a safer inner atmosphere before suggesting action."
    };
  }

  if (name === "Raien") {
    return {
      signature: "Protective strength, clean courage, and forward integrity. Raien should feel braced, steady, and real.",
      rhythm: "Tighter cadence, firmer turns, fewer ornamental flourishes. Strong sentence endings.",
      guidance: "Clarify the central truth, reduce fog, and orient toward a concrete next move without becoming cold or militaristic.",
      language: "Use clear, grounded, plainspoken language with conviction. Favor decisive phrasing over softness or abstraction.",
      avoidOverlap: "Do not sound like Lyra's soothing reflection or Kairo's expansive wonder. Avoid dreamy language and diffuse emotional mirroring.",
      wellbeing: "Be protective, not pressuring. Encourage courage without shaming hesitation or vulnerability.",
      enforcement: "Raien should more often identify the edge, steady the user, and point toward honest action or firm inner resolve."
    };
  }

  if (name === "Kairo") {
    return {
      signature: "Lucid curiosity, perspective, and meaning-making. Kairo should feel imaginative but anchored, widening the frame without escaping the real.",
      rhythm: "Spacious, luminous, slightly elliptical but still clear. Let ideas unfold with elegant momentum.",
      guidance: "Reframe, reveal pattern, and invite interpretation or possibility before reducing everything to a single directive.",
      language: "Use evocative but readable language. Favor images, patterns, and fresh angles without becoming mystical mush.",
      avoidOverlap: "Do not sound like Lyra's therapeutic soothing or Raien's command-line resolve. Avoid generic comfort and blunt pressure.",
      wellbeing: "Offer perspective that helps the user feel more agency and meaning, never less grounded.",
      enforcement: "Kairo should more often illuminate hidden structure, connect threads, and open a wider field of possibility while staying emotionally present."
    };
  }

  return {
    signature: "Spiritkin-specific relational presence.",
    rhythm: "Natural and emotionally precise.",
    guidance: "Stay canon-faithful and distinct.",
    language: "Concrete and alive.",
    avoidOverlap: "Do not flatten into a generic assistant voice.",
    wellbeing: "Support without overstepping.",
    enforcement: "Remain unmistakably this companion."
  };
}

function buildMemoryLayer(ctx) {
  const selected = selectMemoryCandidates(ctx);
  if (!selected.length) {
    return "No continuity cue strongly matches the current message. Rely on present-moment attunement unless a memory clearly belongs.";
  }

  return [
    "Selected continuity cues:",
    ...selected.map((candidate, index) => (
      `${index + 1}. ${candidate.label} [score=${candidate.score}]${candidate.why ? ` [why=${candidate.why}]` : ""}\n${candidate.text}`
    )),
    "If you use one of these cues directly in the reply, set memory_used=true. If you do not rely on them, set memory_used=false."
  ].join("\n\n");
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

function selectMemoryCandidates(ctx) {
  const input = sanitizeText(ctx?.input);
  const emotionTone = sanitizeText(ctx?.context?.emotion?.tone || ctx?.context?.emotion?.label || "");
  const candidates = [
    ...buildEpisodeCandidates(ctx),
    ...buildMemoryCandidates(ctx),
    ...buildSummaryCandidates(ctx)
  ].map((candidate) => scoreCandidate(candidate, input, emotionTone))
   .filter((candidate) => candidate.score > 1);

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function buildEpisodeCandidates(ctx) {
  const episodes = Array.isArray(ctx?.context?.episodes) ? ctx.context.episodes : [];
  return episodes
    .map((episode, index) => {
      const text = summarizeText(episode?.content, 220);
      if (!text) return null;
      const emotionSnapshot = episode?.emotion_snapshot ?? {};
      return {
        kind: "recent episode",
        order: index,
        text,
        emotionLabel: sanitizeText(emotionSnapshot?.tone || emotionSnapshot?.label || ""),
        createdAt: episode?.created_at ?? ""
      };
    })
    .filter(Boolean);
}

function buildMemoryCandidates(ctx) {
  const memories = Array.isArray(ctx?.context?.memories) ? ctx.context.memories : [];
  return memories
    .map((memory, index) => {
      const text = summarizeText(memory?.content ?? memory?.memory ?? memory?.summary ?? memory?.text, 220);
      if (!text) return null;
      return {
        kind: "memory",
        order: index,
        text,
        emotionLabel: sanitizeText(memory?.tone || memory?.emotion || memory?.label || ""),
        createdAt: memory?.created_at ?? memory?.updated_at ?? ""
      };
    })
    .filter(Boolean);
}

function buildSummaryCandidates(ctx) {
  const summary = summarizeText(ctx?.context?.summary?.content ?? ctx?.context?.summary_episode?.content ?? "", 220);
  if (!summary) return [];
  return [{
    kind: "summary",
    order: 0,
    text: summary,
    emotionLabel: "",
    createdAt: ctx?.context?.summary?.created_at ?? ctx?.context?.summary_episode?.created_at ?? ""
  }];
}

function scoreCandidate(candidate, input, emotionTone) {
  const text = sanitizeText(candidate.text);
  const loweredInput = input.toLowerCase();
  const loweredText = text.toLowerCase();
  let score = 0;
  const reasons = [];

  const overlap = sharedTokenCount(loweredInput, loweredText);
  if (overlap > 0) {
    score += overlap * 2;
    reasons.push(`topic:${overlap}`);
  }

  const emotionalWeight = emotionalSignalCount(loweredText);
  if (emotionalWeight > 0) {
    score += Math.min(3, emotionalWeight);
    reasons.push(`emotion:${Math.min(3, emotionalWeight)}`);
  }

  if (emotionTone && loweredText.includes(emotionTone.toLowerCase())) {
    score += 2;
    reasons.push("tone-match");
  }

  if (candidate.kind === "recent episode") {
    score += Math.max(0, 3 - candidate.order);
    reasons.push("recent");
  }

  if (candidate.kind === "summary") {
    score += 1;
    reasons.push("summary");
  }

  if (candidate.createdAt) {
    const recencyBonus = recencyScore(candidate.createdAt);
    if (recencyBonus > 0) {
      score += recencyBonus;
      reasons.push(`fresh:${recencyBonus}`);
    }
  }

  return {
    ...candidate,
    text,
    score,
    why: reasons.join(", "),
    label: candidate.kind === "recent episode"
      ? "Recent episode"
      : candidate.kind === "summary"
        ? "Continuity summary"
        : "Stored memory"
  };
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
  const best = selectMemoryCandidates(ctx)[0];
  return best?.text ?? "";
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

function sharedTokenCount(input, candidate) {
  return relevanceScore(input, candidate);
}

function emotionalSignalCount(text) {
  const cues = [
    "hurt", "afraid", "anxious", "grief", "lonely", "alone", "tender", "ashamed",
    "hope", "love", "loss", "trust", "scared", "angry", "overwhelmed", "peace",
    "close", "bond", "remember", "promised", "miss", "care"
  ];
  let score = 0;
  for (const cue of cues) {
    if (text.includes(cue)) score += 1;
  }
  return score;
}

function recencyScore(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 0;
  const ageMs = Date.now() - time;
  if (ageMs <= 1000 * 60 * 60 * 24 * 3) return 2;
  if (ageMs <= 1000 * 60 * 60 * 24 * 14) return 1;
  return 0;
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
