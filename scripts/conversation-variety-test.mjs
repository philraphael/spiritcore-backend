import { createResponseEngine } from "../src/services/responseEngine.mjs";

function similarity(a, b) {
  const left = new Set(String(a).toLowerCase().split(/\W+/).filter(Boolean));
  const right = new Set(String(b).toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size || 1;
  return intersection / union;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const responseEngine = createResponseEngine();

const identity = {
  name: "Kairo",
};

const worldState = {
  bond: { stage: 3, stage_name: "Resonance", interaction_count: 92 },
  flags: {},
};

const context = {
  memories: [{ content: "The user has been carrying uncertainty about a career decision." }],
  episodes: [{ content: "A recent conversation centered on whether to stay or leave." }],
  bondMilestones: [{ content: "The bond deepened after a difficult honest exchange." }],
};

const newBondWorldState = {
  bond: { stage: 0, stage_name: "First Contact", interaction_count: 2 },
  flags: {},
};

const outputs = [
  responseEngine.wrapResponse({
    adapterResult: {
      text: "The air shifts as the stars listen. What feels most true about staying?",
      tags: [],
      emotion: { tone: "open wonder", valence: 0.6, arousal: 0.4, confidence: 0.7 },
    },
    identity,
    input: "Should I stay at my job?",
    context,
    worldState,
  }).text,
  responseEngine.wrapResponse({
    adapterResult: {
      text: "Around you, the observatory turns. If you leave, what are you hoping to move toward?",
      tags: [],
      emotion: { tone: "open wonder", valence: 0.6, arousal: 0.4, confidence: 0.7 },
    },
    identity,
    input: "Should I quit?",
    context,
    worldState,
  }).text,
  responseEngine.wrapResponse({
    adapterResult: {
      text: "Well, the board is set. Let me answer that move.",
      tags: [],
      emotion: { tone: "charged clarity", valence: 0.5, arousal: 0.6, confidence: 0.7 },
    },
    identity,
    input: "e2e4",
    context,
    worldState: { ...worldState, flags: { active_game: { status: "active" } } },
  }).text,
  responseEngine.wrapResponse({
    adapterResult: {
      text: "I see you opened games. Thank you for sharing that. We can take this one step at a time. Let's look at the next move.",
      tags: [],
      emotion: { tone: "charged clarity", valence: 0.5, arousal: 0.6, confidence: 0.7 },
    },
    identity: { name: "Raien" },
    input: "What should I play here?",
    context,
    worldState,
  }).text,
  responseEngine.wrapResponse({
    adapterResult: {
      text: "As always, you know this already. Thank you for sharing that. Start with the clearest part.",
      tags: [],
      emotion: { tone: "grounded warmth", valence: 0.6, arousal: 0.4, confidence: 0.7 },
    },
    identity: { name: "Lyra" },
    input: "I am not sure where to begin.",
    context: { memories: [], episodes: [], bondMilestones: [] },
    worldState: newBondWorldState,
  }).text,
];

assert(!/^the air shifts/i.test(outputs[0]), "director narration was not removed");
assert(!/^around you/i.test(outputs[1]), "director narration was not removed");
assert(!/^\s*well\b/i.test(outputs[2]), "filler opener was not removed");
assert(!/opened games/i.test(outputs[3]), "explicit tab acknowledgement was not removed");
assert(!/we can take this one step at a time/i.test(outputs[3]), "generic encouragement loop was not removed");
assert(!/\bas always\b/i.test(outputs[4]) && !/\byou know\b/i.test(outputs[4]), "new-bond shorthand was not softened");
assert(similarity(outputs[0], outputs[1]) < 0.8, "responses are too repetitive");

console.log("conversation-variety-test: ok");
