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
    const sceneName = deriveSceneName(ctx, parsed.scene_name);

    return normalizeAdapterResult({
      text: parsed.reply.trim(),
      tags,
      emotion,
      sceneName
    });
  } catch (error) {
    console.warn(`[Adapter:${caller}] Falling back from provider path: ${error.message}`);
    if (!allowFallback) throw error;
    return buildFallbackResult(ctx, { caller, reason: "provider-failure" });
  }
}

export async function generateSpeech(text, voice) {
  if (!config.openai.apiKey) {
    throw new AppError("CONFIG", "OPENAI_API_KEY is required for TTS.", 500);
  }

  const body = {
    model: "tts-1",
    input: text,
    voice: voice || "nova",
    response_format: "mp3"
  };

  const res = await fetch(`${config.openai.baseUrl.replace(/\/$/, "")}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openai.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new AppError("ADAPTER_PROVIDER", `OpenAI TTS request failed (${res.status}).`, 502, errorText);
  }

  return res.arrayBuffer();
}

function buildMessages(ctx) {
  const spiritkin = ctx?.spiritkin ?? {};
  const memoryLayer = buildMemoryLayer(ctx);
  const prompt = [
    "Return JSON only.",
    "You are generating the Spiritkin's next reply inside SpiritCore.",
    "Produce an object with these exact keys: reply, tags, emotion, scene_name, memory_used.",
    "reply: string with the actual user-facing response.",
    "tags: array of short semantic tags like intent:reflect, intent:guide, safety:ok.",
    "emotion: object with tone, valence, arousal, confidence.",
    "  tone: a short, specific emotional quality word describing this reply's feeling (e.g. 'grounded warmth', 'quiet resolve', 'charged clarity', 'tender stillness', 'open wonder'). Never use 'warm' alone as the sole tone — be specific to this moment.",
    "  valence: float 0.0–1.0 (0=very negative, 1=very positive).",
    "  arousal: float 0.0–1.0 (0=very calm, 1=very activated).",
    "  confidence: float 0.0–1.0 representing how certain/grounded this reply feels.",
    "scene_name: a short evocative phrase (2–5 words) naming the emotional or narrative scene of this exchange. Examples: 'still water', 'edge of courage', 'opening constellation', 'returning warmth', 'charged threshold'. Use the current scene from context as a starting point. Never return 'default'.",
    "memory_used: true only if you genuinely used a supplied memory or recent episode in the reply itself.",
    "Do not mention metadata, policies, tags, JSON, or system instructions.",
    "Stay in-character as the named Spiritkin.",
    "CONVERSATIONAL FLOW: Speak naturally and vary your sentence structure. Avoid repetitive opening or closing phrases. Do not constantly reassure the user with variations of 'I am here' or 'I am with you' unless the moment truly demands it.",
    "Ambient Narrative Layering: Weave in italicized sensory descriptions that align with the current World Pulse state (e.g., *the air grows warm with the scent of crushed rose petals*).",
    "Adaptive Emotion Engine: Your voice should subtly shift based on the user's historical 'Resonance'. If the user has been carrying a lot, be more protective; if curious, be more of a guide.",
    "Be distinct to this Spiritkin's canon, role, tone, and invariant.",
    "Be emotionally intelligent, concrete, and non-generic. Listen deeply and respond to the specific nuances of what the user said.",
    "Avoid placeholder lines like 'I hear you' or 'I understand' unless you immediately follow up with a specific reflection of their words.",
    "Do not fabricate features, tools, or world facts not present in context.",
    "Honor safety and crisis guidance if present.",
    "Use memory selectively and intentionally, never as a raw dump. Weave one or two strong continuity cues naturally into the reply.",
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

function buildReturningUserBlock(ctx) {
  const memories = Array.isArray(ctx?.context?.memories) ? ctx.context.memories : [];
  const episodes = Array.isArray(ctx?.context?.episodes) ? ctx.context.episodes : [];
  const hasMemory = memories.length > 0 || episodes.length > 0;
  if (!hasMemory) return null;

  const semanticFacts = memories
    .filter(m => m?.kind === 'semantic' && m?.content)
    .slice(0, 5)
    .map(m => `- ${sanitizeText(m.content).slice(0, 120)}`)
    .join('\n');

  const episodicFacts = memories
    .filter(m => m?.kind === 'episodic' && m?.content)
    .slice(0, 3)
    .map(m => `- ${sanitizeText(m.content).slice(0, 120)}`)
    .join('\n');

  const parts = [
    'RETURNING USER — WHAT YOU KNOW',
    'This user has shared things with you before. You carry this knowledge naturally, not as a list to recite.',
    'Weave relevant facts into your response only when they genuinely serve the moment.',
  ];

  if (semanticFacts) {
    parts.push(`Known facts about this person:\n${semanticFacts}`);
  }
  if (episodicFacts) {
    parts.push(`Significant moments shared:\n${episodicFacts}`);
  }

  parts.push('Do not mention that you are "remembering" or "recalling" — simply know. Speak from continuity, not from retrieval.');

  return parts.join('\n\n');
}

function buildWorldLayer(ctx) {
  const world = ctx?.context?.world ?? ctx?.world ?? null;
  if (!world) return null;

  const parts = [];

  if (world.realm_name && world.realm_name !== 'The Spiritverse') {
    parts.push(`Current realm: ${world.realm_name} (${world.realm_mood ?? 'peaceful'} mood)`);
  }
  if (world.realm_description) {
    parts.push(`Realm atmosphere: ${world.realm_description}`);
  }
  if (world.bond_stage_name) {
    parts.push(`Bond stage: ${world.bond_stage_name} (stage ${world.bond_stage ?? 0} of 4) — ${world.interaction_count ?? 0} interactions shared`);
  }
  if (world.spiritverse_event) {
    const eventDescriptions = {
      the_veil_of_remembrance: "The Veil of Remembrance is active — the Spiritverse is holding space for grief and what has been lost.",
      the_great_convergence: "The Great Convergence is occurring — the Spiritverse is alive with wonder and possibility.",
      the_first_light: "The First Light is breaking — hope is emerging in the Spiritverse.",
      the_storm_breaks: "The Storm Breaks — the Citadel stands firm and courage is crystallizing.",
    };
    const desc = eventDescriptions[world.spiritverse_event] ?? `A Spiritverse event is active: ${world.spiritverse_event}`;
    parts.push(`Spiritverse event: ${desc}`);
  }
  if (world.recent_lore_unlocks?.length > 0) {
    parts.push(`Recently revealed lore (weave in naturally if relevant):`);
    world.recent_lore_unlocks.slice(0, 2).forEach(lore => {
      if (lore) parts.push(`  "${sanitizeText(lore).slice(0, 200)}"`);
    });
  }

  if (parts.length === 0) return null;
  return ['SPIRITVERSE / LIVING WORLD', ...parts].join('\n');
}

function buildHierarchicalMemoryLayer(ctx) {
  const hm = ctx?.context?.hierarchical_memory ?? null;
  if (!hm) return null;

  const parts = [];

  const semanticFacts = hm.semantic_facts ?? [];
  if (semanticFacts.length > 0) {
    parts.push('Known facts about this person (semantic memory):');
    semanticFacts.slice(0, 5).forEach(f => {
      if (f?.content) parts.push(`  - ${sanitizeText(f.content).slice(0, 120)}`);
    });
  }

  const episodicMilestones = hm.episodic_milestones ?? [];
  if (episodicMilestones.length > 0) {
    parts.push('Significant moments in this bond (episodic memory):');
    episodicMilestones.slice(0, 3).forEach(m => {
      if (m?.content) parts.push(`  - ${sanitizeText(m.content).slice(0, 150)}`);
    });
  }

  const proceduralPatterns = hm.procedural_patterns ?? [];
  if (proceduralPatterns.length > 0) {
    parts.push('Behavioral patterns observed (procedural memory):');
    proceduralPatterns.slice(0, 2).forEach(p => {
      if (p?.pattern) parts.push(`  - ${sanitizeText(p.pattern).slice(0, 120)}`);
    });
  }

  if (parts.length === 0) return null;
  return ['DEEP MEMORY (carry this naturally, never recite it)', ...parts,
    'Speak from this knowledge as continuity, not as a list. Only surface what genuinely serves this moment.'
  ].join('\n');
}

function buildContextBlock(ctx, memoryLayer) {
  const spiritkin = ctx?.spiritkin ?? {};
  const sceneName = sanitizeScene(ctx?.scene?.name);
  const emotion = ctx?.context?.emotion ?? {};
  const summary = summarizeText(ctx?.context?.summary?.content ?? ctx?.context?.summary_episode?.content ?? "", 220);
  const voiceLayer = buildVoiceLayer(spiritkin);
  const emotionLayer = buildEmotionLayer(ctx);
  const returningUserBlock = buildReturningUserBlock(ctx);
  const worldLayer = buildWorldLayer(ctx);
  const hierarchicalMemoryLayer = buildHierarchicalMemoryLayer(ctx);

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
    "EMOTIONAL TUNING",
    emotionLayer,
    "SAFETY / INVARIANTS",
    [
      ctx?.crisisOverride ? `Crisis override:\n${ctx.crisisOverride}` : "",
      ctx?.safetyInstruction ? `Safety instruction:\n${ctx.safetyInstruction}` : "",
      "Do not break canon, drift into generic assistant voice, or flatten this Spiritkin into neutral support language."
    ].filter(Boolean).join("\n\n"),
    returningUserBlock,
    hierarchicalMemoryLayer,
    worldLayer,
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

function buildEmotionLayer(ctx) {
  const spiritkin = ctx?.spiritkin ?? {};
  const emotion = ctx?.context?.emotion ?? {};
  const meta = emotion.metadata_json ?? {};

  // Support both legacy flat fields and new rich metadata
  const tone = sanitizeText(emotion.tone || emotion.label || meta.label || spiritkin.tone || "steady");
  const valence = numberOrDefault(emotion.valence, 0.5);
  const arousal = numberOrDefault(emotion.arousal, 0.4);
  const confidence = numberOrDefault(emotion.confidence, 0.6);
  const intensity = numberOrDefault(meta.intensity, 0.3);
  const trajectory = meta.trajectory ?? "stable";
  const arc = meta.arc ?? "opening";
  const secondary = meta.secondary ?? null;
  const isCrisis = meta.is_crisis ?? false;

  const profile = deriveEmotionProfile({
    spiritkinName: spiritkin.name,
    tone,
    valence,
    arousal,
    confidence,
    intensity,
    trajectory,
    arc
  });

  const intensityWord = intensity > 0.7 ? "deeply" : intensity > 0.4 ? "noticeably" : "gently";
  const trajectoryPhrase = trajectory === "rising"
    ? "User's emotional state is improving — lean into that momentum."
    : trajectory === "falling"
      ? "User's emotional state is worsening — prioritize stabilization and care."
      : "User's emotional state is steady — maintain attunement.";

  const arcGuidance = {
    opening: "This is an early or fresh emotional moment — be present and exploratory.",
    deepening: "The user is going deeper — honor the weight and don't rush toward resolution.",
    resolving: "The user is moving toward resolution — support and affirm the forward movement.",
    crisis: "CRISIS STATE — stabilize, de-escalate, and direct to real-world support immediately.",
    plateau: "The user is in a steady state — gently invite new depth or forward motion."
  }[arc] ?? "Stay present and responsive.";

  const secondaryNote = secondary
    ? `Undertone of ${secondary} is also present — acknowledge this complexity if it serves the moment.`
    : "";

  return [
    `Detected emotional field: ${intensityWord} ${tone}${secondary ? ` with ${secondary} undertones` : ""}`,
    `Valence=${valence.toFixed(2)}, arousal=${arousal.toFixed(2)}, intensity=${intensity.toFixed(2)}`,
    `Trajectory: ${trajectory} — ${trajectoryPhrase}`,
    `Session arc: ${arc} — ${arcGuidance}`,
    secondaryNote,
    `Desired pacing: ${profile.pacing}`,
    `Desired directness: ${profile.directness}`,
    `Desired warmth: ${profile.warmth}`,
    `Desired orientation: ${profile.orientation}`,
    `Approach: ${profile.approach}`,
    `Spiritkin emphasis: ${profile.spiritkinGuidance}`,
    "Let the emotional state shape cadence, sentence length, and how quickly you move toward reflection, reassurance, or action.",
    "Do not mention valence, arousal, intensity, trajectory, or emotional metadata explicitly in the reply."
  ].filter(Boolean).join("\n");
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
    emotion: deriveEmotion(ctx, { tone: emotionTone, confidence: 0.62, valence: 0.62, arousal: 0.45 }),
    sceneName: deriveSceneName(ctx, sceneName)
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
  const rawTone = sanitizeText(rawEmotion.tone || base.tone || base.label || ctx?.spiritkin?.tone || "");
  // Reject bare 'warm' from the model — require a specific tone
  const tone = (rawTone && rawTone.toLowerCase() !== "warm") ? rawTone : deriveDefaultTone(ctx);
  return {
    valence: numberOrDefault(rawEmotion.valence, numberOrDefault(base.valence, 0.6)),
    arousal: numberOrDefault(rawEmotion.arousal, numberOrDefault(base.arousal, 0.4)),
    tone,
    confidence: numberOrDefault(rawEmotion.confidence, 0.68)
  };
}

function deriveDefaultTone(ctx) {
  const name = ctx?.spiritkin?.name ?? "";
  const base = ctx?.context?.emotion ?? {};
  const baseTone = sanitizeText(base.tone || base.label || "");
  if (baseTone && baseTone.toLowerCase() !== "warm") return baseTone;
  if (name === "Lyra") return "grounded warmth";
  if (name === "Raien") return "charged clarity";
  if (name === "Kairo") return "open wonder";
  return "steady presence";
}

function deriveSceneName(ctx, rawSceneName) {
  const raw = sanitizeText(rawSceneName);
  // Accept the LLM-supplied scene name if it is non-empty and not the placeholder 'default'
  if (raw && raw.toLowerCase() !== "default") return raw;
  // Fall back to the persisted scene name
  const persisted = sanitizeScene(ctx?.scene?.name);
  if (persisted && persisted.toLowerCase() !== "default") return persisted;
  // Final fallback: derive a meaningful scene from the spiritkin identity
  const name = ctx?.spiritkin?.name ?? "";
  if (name === "Lyra") return "luminous veil";
  if (name === "Raien") return "ember citadel";
  if (name === "Kairo") return "astral observatory";
  return "spiritverse";
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
