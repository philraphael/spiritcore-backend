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
    return [...next];
  }

  function wrapResponse({ adapterResult, identity, input, context = {}, worldState = {} }) {
    const base = normalizeAdapterResult(adapterResult);
    const relationship = deriveRelationshipState({ identity, context, worldState, input });
    const realistic = applyRelationshipRealism(base.text, identity, relationship, input) || base.text;
    const text = applyAdaptivePersonality(realistic, identity, relationship, context, input) || realistic;
    const tags = extendTags(base.tags, relationship, context, worldState);

    return {
      ...base,
      text,
      tags,
      relationship,
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
