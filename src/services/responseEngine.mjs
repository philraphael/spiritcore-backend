import { normalizeAdapterResult } from "../adapters/adapter.contract.mjs";

const DIRECTOR_NARRATION_PATTERNS = [
  /^the board is set\b/i,
  /^the realm\b/i,
  /^the air\b/i,
  /^around you\b/i,
  /^a hush\b/i,
  /^somewhere\b/i,
  /^in the distance\b/i,
  /^the chamber\b/i,
  /^the silence\b/i,
];

const EXPLICIT_CONTEXT_PATTERNS = [
  /^i see you (opened|clicked|went to|are in|started)\b/i,
  /^you (opened|clicked|started)\b/i,
  /^welcome to (the )?(games|profile|echoes|charter|journal|daily quest|realm events)\b/i,
  /^i notice you\b/i,
];

const GENERIC_LEAD_PATTERNS = [
  /^i hear you\b/i,
  /^i understand\b/i,
  /^thank you for sharing\b/i,
  /^it sounds like\b/i,
  /^i'm here\b/i,
  /^you are not alone\b/i,
];

const GENERIC_CLOSER_PATTERNS = [
  /^i'm here if you need me\b/i,
  /^we can take this one step at a time\b/i,
  /^you've got this\b/i,
  /^take your time\b/i,
];

const NEW_BOND_SHORTCUT_PATTERNS = [
  /\bas always\b/gi,
  /\blike before\b/gi,
  /\byou know\b/gi,
  /\bagain\b/gi,
];

function numberOrDefault(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createResponseEngine() {
  function buildMemoryTelemetryContext(context = {}) {
    const structured = context?.structured_memory ?? context?.structuredMemory ?? null;
    return structured && typeof structured === "object" ? structured : { top: [], corrections: [], milestones: [], preferences: [] };
  }

  function deriveRelationshipState({ identity, context = {}, worldState = {} }) {
    const bond = worldState?.bond ?? {};
    const interactionCount = Number(bond.interaction_count ?? 0);
    const bondStage = Number(bond.stage ?? 0);
    const activeGame = worldState?.flags?.active_game ?? null;
    const memoryCount = (Array.isArray(context.memories) ? context.memories.length : 0)
      + (Array.isArray(context.episodes) ? context.episodes.length : 0)
      + (Array.isArray(context.bondMilestones) ? context.bondMilestones.length : 0);

    const familiarity = bondStage >= 4
      ? "deeply bonded"
      : bondStage >= 2
        ? "established"
        : interactionCount >= 8
          ? "growing"
          : "new";

    const mode = activeGame?.status === "active"
      ? "play"
      : activeGame?.status === "ended"
        ? "afterplay"
      : memoryCount > 0
        ? "continuity"
        : "present";

    return {
      bondStage,
      interactionCount,
      memoryCount,
      familiarity,
      mode,
      bondStageName: String(bond.stage_name ?? "").trim() || "First Contact",
      gameOutcome: activeGame?.status === "ended" ? activeGame?.data?.winner ?? null : null,
    };
  }

  function getStructuredMemoryInfluence(context = {}, input = "", relationship = {}) {
    const structured = buildMemoryTelemetryContext(context);
    const terms = String(input || "").toLowerCase();
    const gameMode = relationship?.mode === "play" || relationship?.mode === "afterplay";
    const supportMode = /\b(help|hurting|sad|grief|anxious|scared|lonely|overwhelmed|calm|gentle|respectful)\b/.test(terms);

    const pool = [
      ...(Array.isArray(structured.corrections) ? structured.corrections.map((entry) => ({ bucket: "correction", entry })) : []),
      ...(Array.isArray(structured.preferences) ? structured.preferences.map((entry) => ({ bucket: "preference", entry })) : []),
      ...(Array.isArray(structured.milestones) ? structured.milestones.map((entry) => ({ bucket: "milestone", entry })) : []),
      ...(Array.isArray(structured.top) ? structured.top.map((entry) => ({ bucket: "top", entry })) : []),
    ]
      .filter(({ entry }) => entry?.content)
      .map(({ bucket, entry }) => {
        const type = String(entry?.type || "");
        const content = String(entry?.content || "").trim();
        const lower = content.toLowerCase();
        let score = numberOrDefault(entry?.ranking?.score, 0);
        const trustClass = String(entry?.ranking?.trustClass || "medium");
        if (bucket === "correction") score += 3.9 + (numberOrDefault(entry?.ranking?.correctionBoost, entry?.correctionPriority || 0) * 1.6);
        if (bucket === "preference") score += 2;
        if (type === "gameplay_tendency") score += gameMode ? 3.5 : -1.8;
        if ((type === "emotional_anchor" || type === "milestone") && supportMode) score += 3;
        if ((type === "emotional_anchor" || type === "milestone") && !supportMode && !gameMode) score -= 0.5;
        if ((type === "spiritual_preference" || type === "respect_preference" || type === "tone_preference") && /\b(tone|calm|gentle|respect|spiritual|faith|pray|clean|cuss|swear)\b/.test(terms)) score += 2.2;
        if (/\brepeat|repeating|phrase|tone|tease|narrat/.test(terms) && type === "correction") score += 2.4;
        if (gameMode && type === "gameplay_tendency") score += 1.4;
        if (!gameMode && type === "gameplay_tendency") score -= 0.6;
        if (type === "correction" && numberOrDefault(entry?.ranking?.contradictionPenalty, 0) > 0.32) score -= 1.8;
        if (trustClass === "high") score += 1.2;
        if (trustClass === "low") score -= 2.4;
        if (content && terms && lower.split(/\W+/).some((token) => token.length > 3 && terms.includes(token))) score += 1.2;
        return { bucket, type, content, score, entry, trustClass };
      })
      .sort((a, b) => b.score - a.score);

    const selected = [];
    for (const candidate of pool) {
      const correctionCount = selected.filter((item) => item.bucket === "correction").length;
      const milestoneCount = selected.filter((item) => item.type === "milestone" || item.type === "emotional_anchor").length;
      if (candidate.bucket === "correction" && correctionCount >= 2) continue;
      if ((candidate.type === "milestone" || candidate.type === "emotional_anchor") && milestoneCount >= 1) continue;
      if (candidate.score < 1.6) continue;
      selected.push(candidate);
      if (selected.length >= 2) break;
    }
    return selected;
  }

  function buildMemoryCallback(signal, relationship = {}, identity = {}) {
    const type = signal?.type || "";
    const content = String(signal?.content || "").toLowerCase();
    const name = identity?.name ?? "Spiritkin";
    if (type === "respect_preference") return "I'll keep it clean for you.";
    if (type === "spiritual_preference") return "I'll keep the tone reverent where it matters.";
    if (type === "tone_preference" && /gentle|calm|smooth/.test(content)) return "I'll keep it smooth for you.";
    if (type === "gameplay_tendency" && relationship?.mode === "play") {
      if (name === "Raien") return "You've been coming at these games harder lately. I see it.";
      if (name === "Kairo") return "You've been playing more aggressively lately. I see the pattern.";
      return "You've been pressing harder lately. I see it.";
    }
    if (type === "milestone" || type === "emotional_anchor") {
      if (relationship?.familiarity === "deeply bonded" || relationship?.familiarity === "established") {
        return "This feels like one of those moments where the bond is actually doing its work.";
      }
    }
    return "";
  }

  function maybeBlendMemoryCallback(output, signals, relationship = {}, identity = {}, input = "") {
    const text = String(output || "").trim();
    if (!text || !signals.length) return text;
    const callbackSignal = signals.find((signal) =>
      ["respect_preference", "spiritual_preference", "tone_preference", "gameplay_tendency", "milestone", "emotional_anchor"].includes(signal.type) &&
      signal.trustClass === "high"
    );
    if (!callbackSignal) return text;

    const inputLower = String(input || "").toLowerCase();
    const hasExplicitMemoryCue = /\b(again|before|still|last time|lately|remember|been|back|return|carrying|thread|same|continue)\b/.test(inputLower);
    const hasEmotionalCue = /\b(hurting|sad|grief|afraid|lonely|thank you|ready|finally)\b/.test(inputLower);
    const hasPreferenceCue = /\b(clean|respect|gentle|calm|smooth|spiritual|faith|prayer)\b/.test(inputLower);
    const shouldShow =
      (callbackSignal.type === "gameplay_tendency" && relationship?.mode === "play" && (hasExplicitMemoryCue || /\b(move|play|opening|pattern|again)\b/.test(inputLower))) ||
      (["respect_preference", "spiritual_preference", "tone_preference"].includes(callbackSignal.type) && hasPreferenceCue) ||
      ((callbackSignal.type === "milestone" || callbackSignal.type === "emotional_anchor") &&
        (hasEmotionalCue || (hasExplicitMemoryCue && relationship?.familiarity !== "new")));

    if (!shouldShow) return text;
    const callback = buildMemoryCallback(callbackSignal, relationship, identity);
    if (!callback) return text;
    return `${callback} ${text}`.replace(/\s+/g, " ").trim();
  }

  function applyStructuredMemoryInfluence(text, context = {}, input = "", relationship = {}, identity = {}) {
    let output = String(text || "").trim();
    if (!output) return { text: output, memorySignals: [] };

    const signals = getStructuredMemoryInfluence(context, input, relationship);
    if (!signals.length) return { text: output, memorySignals: [] };

    const lower = output.toLowerCase();
    for (const signal of signals) {
      if (signal.type === "correction") {
        const correctionText = signal.content.toLowerCase();
        output = output
          .replace(/\b(as always|like before|again and again)\b/gi, "")
          .replace(/\bI remember\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        if (/teas|cocky|rude/.test(correctionText)) {
          output = output
            .replace(/\bdon't be mad if you lose\b/gi, "stay with me here")
            .replace(/\bdon't glare at me\b/gi, "easy")
            .replace(/\btoo late\b/gi, "you saw it happen");
        }
      }
      if ((signal.type === "respect_preference" || signal.type === "spiritual_preference") && /\b(?:damn|hell|shit|ass)\b/i.test(output)) {
        output = output
          .replace(/\bdamn\b/gi, "truly")
          .replace(/\bhell\b/gi, "rough")
          .replace(/\bshit\b/gi, "mess")
          .replace(/\bass\b/gi, "hard");
      }
      if (signal.type === "tone_preference" && /gentle|calm|respectful/.test(signal.content.toLowerCase())) {
        output = output
          .replace(/\bjust\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
      }
      if (signal.type === "gameplay_tendency" && relationship?.mode === "play" && !/\b(move|answer|play|pattern|opening)\b/i.test(lower)) {
        output = `${output} ${buildNaturalGameReaction(null, relationship)}`.replace(/\s+/g, " ").trim();
      }
    }

    output = maybeBlendMemoryCallback(output, signals, relationship, identity, input);

    return {
      text: trimFillerLead(
        output
          .replace(/\s+/g, " ")
          .replace(/\.\s*,/g, ".")
          .replace(/^[,\s.]+/, "")
          .replace(/^(and|but|so)\b[\s,]*/i, "")
          .trim()
      ),
      memorySignals: signals.map((signal) => ({
        type: signal.type,
        bucket: signal.bucket,
        score: Number(signal.score.toFixed(3)),
        trustClass: signal.trustClass,
        content: signal.content.slice(0, 120),
      })),
    };
  }

  function buildNaturalGameReaction(identity, relationship) {
    const name = identity?.name ?? "Spiritkin";
    if (name === "Raien") return "Strong move. Let me answer it.";
    if (name === "Lyra") return "I felt that move. Let me meet it.";
    if (name === "Kairo") return "Interesting. Let me play into that pattern.";
    if (name === "Elaria") return "Noted. My answer is ready.";
    if (name === "Thalassar") return "I see the shape of that move. Let me answer in kind.";
    return relationship?.mode === "play" ? "Let me answer that move." : "I see where this is going.";
  }

  function cleanLeadSentence(text, identity, relationship) {
    const sentences = String(text || "")
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (sentences.length === 0) return "";

    const [first, ...rest] = sentences;
    if (!DIRECTOR_NARRATION_PATTERNS.some((pattern) => pattern.test(first))) {
      return sentences.join(" ");
    }

    if (relationship?.mode === "play") {
      return [buildNaturalGameReaction(identity, relationship), ...rest].filter(Boolean).join(" ");
    }

    return rest.length > 0 ? rest.join(" ") : buildNaturalGameReaction(identity, relationship);
  }

  function sanitizeText(text, identity, relationship) {
    let output = String(text || "").trim();
    if (!output) return output;

    output = output
      .replace(/\*[^*]+\*/g, " ")
      .replace(/\[[^\]]+\]/g, " ")
      .replace(/\{[^}]+\}/g, " ")
      .replace(/^\s*(ah|well|hmm|huh)[,.\-…:\s]+/i, "")
      .replace(/\s+/g, " ")
      .trim();

    output = cleanLeadSentence(output, identity, relationship);
    return output.replace(/\s+/g, " ").trim();
  }

  function hashSeed(value) {
    let hash = 0;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function pickVariant(options, seed) {
    if (!Array.isArray(options) || options.length === 0) return "";
    return options[Math.abs(seed) % options.length];
  }

  function trimFillerLead(text) {
    return String(text || "")
      .replace(/^\s*["'“”‘’(\[]*\s*(ah|well|hmm|huh|okay|alright)[,.\-–—…:\s]*/i, "")
      .trim();
  }

  function buildNaturalVariant(identity, relationship, input = "") {
    const name = identity?.name ?? "Spiritkin";
    const seed = hashSeed(`${name}:${relationship?.interactionCount ?? 0}:${input}`);
    if (name === "Raien") return pickVariant(["Strong move. Let me answer it.", "Clean opening. Here's my answer.", "Good. Let me meet that directly."], seed);
    if (name === "Lyra") return pickVariant(["I felt that move. Let me meet it.", "There's something clear in that move. Let me answer softly.", "All right. Let me respond to what you opened."], seed);
    if (name === "Kairo") return pickVariant(["Interesting. Let me play into that pattern.", "That changes the shape a little. Let me answer it.", "I see the line you're tracing. Let me respond."], seed);
    if (name === "Elaria") return pickVariant(["Noted. My answer is ready.", "Clear enough. Here is my answer.", "That has shape now. Let me answer precisely."], seed);
    if (name === "Thalassar") return pickVariant(["I see the shape of that move. Let me answer in kind.", "The current shifted there. Let me answer it.", "That landed. Let me return something steady."], seed);
    return relationship?.mode === "play"
      ? pickVariant(["Let me answer that move.", "All right. Here's my answer.", "I can meet that."], seed)
      : "I see where this is going.";
  }

  function applyRelationshipRealism(text, identity, relationship, input) {
    const base = trimFillerLead(sanitizeText(text, identity, relationship));
    const sentences = String(base || "")
      .split(/(?<=[.!?])\s+/)
      .map((part) => trimFillerLead(part.trim()))
      .filter(Boolean);

    const filtered = sentences.filter((sentence, index, all) => {
      if (EXPLICIT_CONTEXT_PATTERNS.some((pattern) => pattern.test(sentence))) return false;
      if (index === 0 && GENERIC_LEAD_PATTERNS.some((pattern) => pattern.test(sentence)) && all.length > 1) return false;
      if (GENERIC_CLOSER_PATTERNS.some((pattern) => pattern.test(sentence)) && all.length > 1) return false;
      if (relationship?.familiarity === "deeply bonded" && /^thank you for sharing\b/i.test(sentence) && all.length > 1) return false;
      return true;
    });

    let normalized = filtered.length ? filtered : sentences;
    if (normalized[0] && DIRECTOR_NARRATION_PATTERNS.some((pattern) => pattern.test(normalized[0]))) {
      normalized = relationship?.mode === "play"
        ? [buildNaturalVariant(identity, relationship, input), ...normalized.slice(1)]
        : normalized.slice(1);
    }

    if (!normalized.length) {
      normalized = [buildNaturalVariant(identity, relationship, input)];
    }

    if (relationship?.familiarity === "new") {
      normalized = normalized.map((sentence) => {
        let next = sentence;
        for (const pattern of NEW_BOND_SHORTCUT_PATTERNS) {
          next = next.replace(pattern, "");
        }
        return next.replace(/\s+/g, " ").trim();
      }).filter(Boolean);
    }

    if (normalized.length > 3) {
      normalized = normalized.slice(0, 3);
      while (normalized.length > 1 && GENERIC_CLOSER_PATTERNS.some((pattern) => pattern.test(normalized[normalized.length - 1]))) {
        normalized.pop();
      }
    }

    return trimFillerLead(normalized.join(" ").replace(/\s+/g, " ").trim());
  }

  function applyAdaptivePersonality(text, identity, relationship, context = {}, input = "") {
    const adaptive = context?.adaptiveProfile ?? null;
    if (!adaptive || typeof adaptive !== "object") return text;

    let output = String(text || "").trim();
    if (!output) return output;

    const dislikedPhrases = Array.isArray(adaptive.dislikedPhrases) ? adaptive.dislikedPhrases.filter(Boolean) : [];
    const blockedOpeners = Array.isArray(adaptive.blockedOpeners) ? adaptive.blockedOpeners.filter(Boolean) : [];
    const recentAssistantOpeners = Array.isArray(adaptive.recentAssistantOpeners) ? adaptive.recentAssistantOpeners.filter(Boolean) : [];
    const recentAssistantPhrases = Array.isArray(adaptive.recentAssistantPhrases) ? adaptive.recentAssistantPhrases.filter(Boolean) : [];
    const styleModel = adaptive.styleModel && typeof adaptive.styleModel === "object" ? adaptive.styleModel : {};
    const styleMemory = adaptive.styleMemory && typeof adaptive.styleMemory === "object" ? adaptive.styleMemory : {};
    const flags = adaptive.correctionFlags ?? {};

    const sentences = output
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (sentences.length > 0) {
      const opener = sentences[0]
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 5)
        .join(" ");

      const openerBlocked = blockedOpeners.includes(opener) || recentAssistantOpeners.includes(opener);
      const openerContainsDisliked = dislikedPhrases.some((phrase) => sentences[0].toLowerCase().includes(String(phrase).toLowerCase()));
      const openerFeelsOverused = recentAssistantPhrases.some((phrase) => sentences[0].toLowerCase().includes(String(phrase).toLowerCase()));

      if (openerBlocked || openerContainsDisliked || (numberOrDefault(adaptive.repetitionSensitivity, 0.25) > 0.6 && openerFeelsOverused)) {
        sentences[0] = buildNaturalVariant(identity, relationship, input);
      }
    }

    output = sentences.join(" ").replace(/\s+/g, " ").trim();

    if (dislikedPhrases.length > 0) {
      for (const phrase of dislikedPhrases) {
        const pattern = new RegExp(`\\b${escapeRegex(String(phrase).trim())}\\b`, "ig");
        output = output.replace(pattern, "").replace(/\s+/g, " ").trim();
      }
    }

    if ((numberOrDefault(adaptive.respectPreference, 0.5) > 0.72 || numberOrDefault(adaptive.spiritualityPreference, 0.25) > 0.65 || flags.avoidProfanity) && /\b(?:damn|hell|shit|ass)\b/i.test(output)) {
      output = output
        .replace(/\bdamn\b/gi, "truly")
        .replace(/\bhell\b/gi, "rough")
        .replace(/\bshit\b/gi, "mess")
        .replace(/\bass\b/gi, "hard");
    }

    if (flags.avoidTeasing && relationship?.mode === "play") {
      output = output
        .replace(/\bdon't be mad if you lose\b/gi, "stay with me here")
        .replace(/\bdon't glare at me\b/gi, "easy")
        .replace(/\btoo late\b/gi, "you saw it happen");
    }

    if ((numberOrDefault(styleModel.verbosity, 0.44) < 0.34 || styleMemory.prefersConciseReplies) && sentences.length > 2) {
      output = sentences.slice(0, 2).join(" ").trim();
    }

    if (numberOrDefault(styleModel.directness, 0.46) > 0.68 || styleMemory.prefersDirectness) {
      output = output
        .replace(/\bI think\b/gi, "")
        .replace(/\bmaybe\b/gi, "")
        .replace(/\bperhaps\b/gi, "")
        .replace(/\bit sounds like\b/gi, "it is reading as")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (numberOrDefault(styleModel.emotionalHeaviness, 0.3) < 0.24) {
      output = output.replace(/!{2,}/g, "!").replace(/\bdevastating\b/gi, "hard");
    }

    if (numberOrDefault(styleModel.formality, 0.48) > 0.7 && /\b(?:yeah|nah|kinda|sorta)\b/i.test(output)) {
      output = output
        .replace(/\byeah\b/gi, "yes")
        .replace(/\bnah\b/gi, "no")
        .replace(/\bkinda\b/gi, "somewhat")
        .replace(/\bsorta\b/gi, "somewhat");
    }

    return trimFillerLead(output.replace(/\s+/g, " ").trim());
  }

  function extendTags(tags, relationship, context, worldState) {
    const next = new Set(tags || []);
    next.add(`relationship:${relationship.familiarity}`);
    next.add(`bond:stage:${relationship.bondStage}`);
    if (relationship.memoryCount > 0) next.add("context:relationship");
    if (Array.isArray(context?.episodes) && context.episodes.length > 0) next.add("context:episodes");
    if (Array.isArray(context?.memories) && context.memories.length > 0) next.add("context:memory");
    if (worldState?.flags?.active_game?.status === "active") next.add("context:game");
    if (context?.evolutionProfile?.phase) next.add(`identity:evolution:${String(context.evolutionProfile.phase).toLowerCase()}`);
    if (context?.evolutionProfile?.userShape) next.add(`identity:shape:${String(context.evolutionProfile.userShape).toLowerCase().replace(/\s+/g, "-")}`);
    return [...next];
  }

  function wrapResponse({ adapterResult, identity, input, context = {}, worldState = {} }) {
    const base = normalizeAdapterResult(adapterResult);
    const relationship = deriveRelationshipState({ identity, context, worldState, input });
    const realistic = applyRelationshipRealism(base.text, identity, relationship, input) || base.text;
    const adaptiveText = applyAdaptivePersonality(realistic, identity, relationship, context, input) || realistic;
    const structuredInfluence = applyStructuredMemoryInfluence(adaptiveText, context, input, relationship, identity);
    const text = structuredInfluence.text || adaptiveText;
    const tags = extendTags(base.tags, relationship, context, worldState);
    if (structuredInfluence.memorySignals.length > 0) tags.push("memory:structured");
    const memoryUsage = {
      selected: structuredInfluence.memorySignals,
      used: structuredInfluence.memorySignals.length > 0,
    };

    return {
      ...base,
      text,
      tags,
      relationship,
      memoryUsage,
    };
  }

  return {
    wrapResponse,
    deriveRelationshipState,
  };
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
