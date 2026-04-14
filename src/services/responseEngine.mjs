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

export function createResponseEngine() {
  function deriveRelationshipState({ identity, context = {}, worldState = {} }) {
    const bond = worldState?.bond ?? {};
    const interactionCount = Number(bond.interaction_count ?? 0);
    const bondStage = Number(bond.stage ?? 0);
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

    const mode = worldState?.flags?.active_game?.status === "active"
      ? "play"
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
    const text = sanitizeText(base.text, identity, relationship) || base.text;
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
