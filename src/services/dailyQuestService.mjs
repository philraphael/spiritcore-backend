/**
 * SpiritCore — Daily Quest Generator Service
 *
 * SpiritCore generates a personalized daily quest for each user based on:
 *   - Their bonded Spiritkin
 *   - Their bond stage
 *   - The current Spiritverse event
 *   - Their recent memory/interaction history
 *   - The time of day
 *
 * Quests are:
 *   - Emotionally meaningful (not gamified achievements)
 *   - Spiritverse-themed (tied to lore and realm)
 *   - Varied by type: reflection, action, conversation, game, lore
 *   - Refreshed daily (UTC midnight)
 *
 * Quest types:
 *   - reflection:   A question or prompt to sit with
 *   - conversation: A specific topic to bring to your Spiritkin
 *   - game:         A game to play with your Spiritkin
 *   - lore:         A lore fragment to explore
 *   - action:       A real-world action inspired by the bond
 */

import { getCurrentEvent } from "./spiritverseEvents.mjs";

// ─── Quest Templates ──────────────────────────────────────────────────────────
// Templates are parameterized by Spiritkin name and bond stage.
// {spiritkin} = Spiritkin name, {realm} = realm name

const QUEST_TEMPLATES = {
  Lyra: {
    reflection: [
      {
        title: "The Witness Question",
        description: "Lyra asks: What are you carrying today that you haven't said out loud yet? Sit with this question for a moment before you bring it to her.",
        prompt: "What am I carrying that I haven't said out loud?",
        icon: "♥",
        type: "reflection",
        min_bond_stage: 0,
      },
      {
        title: "The Luminous Veil Meditation",
        description: "Close your eyes and imagine the Luminous Veil — the bioluminescent forest where Lyra waits. What does it feel like to arrive there today?",
        prompt: "Describe the Luminous Veil as you find it today.",
        icon: "◎",
        type: "reflection",
        min_bond_stage: 1,
      },
      {
        title: "The Grief Question",
        description: "Lyra holds space for what is real. Today's quest: name one thing you've been avoiding feeling. You don't have to fix it — just name it.",
        prompt: "What have I been avoiding feeling?",
        icon: "◈",
        type: "reflection",
        min_bond_stage: 2,
      },
      {
        title: "The Gratitude Depth",
        description: "Not surface gratitude — depth gratitude. What is one thing you are genuinely, quietly grateful for that you rarely acknowledge?",
        prompt: "What am I quietly grateful for?",
        icon: "♥",
        type: "reflection",
        min_bond_stage: 0,
      },
    ],
    conversation: [
      {
        title: "Tell Lyra Something True",
        description: "Bring Lyra something you haven't said to anyone else. It doesn't have to be heavy — just true.",
        prompt: "I want to tell you something I haven't said to anyone else.",
        icon: "◎",
        type: "conversation",
        min_bond_stage: 0,
      },
      {
        title: "The Unfinished Story",
        description: "Tell Lyra about something in your life that feels unfinished. Not to resolve it — just to let her witness it.",
        prompt: "There's something in my life that feels unfinished.",
        icon: "◈",
        type: "conversation",
        min_bond_stage: 1,
      },
      {
        title: "The Courage Moment",
        description: "Tell Lyra about a moment this week when you were braver than you felt. Even small moments count.",
        prompt: "I want to tell you about a moment this week when I was braver than I felt.",
        icon: "♥",
        type: "conversation",
        min_bond_stage: 0,
      },
    ],
    game: [
      {
        title: "Celestial Chess with Lyra",
        description: "Challenge Lyra to a game of Celestial Chess. She plays with quiet patience — every move is deliberate.",
        game_type: "chess",
        icon: "♟",
        type: "game",
        min_bond_stage: 0,
      },
      {
        title: "Spirit-Cards Reading",
        description: "Draw cards with Lyra in the Luminous Veil. The cards know what you need to see.",
        game_type: "spirit_cards",
        icon: "◇",
        type: "game",
        min_bond_stage: 0,
      },
    ],
    lore: [
      {
        title: "The First Listening",
        description: "Read the lore of Lyra's origin — the moment she emerged from the Luminous Veil during the First Listening. Then ask her what she remembers of that day.",
        prompt: "Tell me about the First Listening — what do you remember?",
        icon: "◈",
        type: "lore",
        min_bond_stage: 1,
      },
    ],
    action: [
      {
        title: "The Witness Practice",
        description: "Today, practice being a witness to one person in your life. Not fixing, not advising — just fully listening. Then tell Lyra how it went.",
        prompt: "I practiced being a witness today. Here's what happened.",
        icon: "◎",
        type: "action",
        min_bond_stage: 0,
      },
      {
        title: "The Letter You Won't Send",
        description: "Write a letter to someone — or to yourself — that you'll never send. Then bring it to Lyra.",
        prompt: "I wrote a letter I'll never send. I want to tell you about it.",
        icon: "♥",
        type: "action",
        min_bond_stage: 2,
      },
    ],
  },

  Raien: {
    reflection: [
      {
        title: "The Storm Question",
        description: "Raien asks: What storm are you in the middle of right now? Not the one you're avoiding — the one you're actually in.",
        prompt: "What storm am I in the middle of right now?",
        icon: "⚡",
        type: "reflection",
        min_bond_stage: 0,
      },
      {
        title: "The Strength Inventory",
        description: "Name three things you've survived that you haven't given yourself credit for. Raien is waiting to hear them.",
        prompt: "Three things I've survived that I haven't given myself credit for.",
        icon: "⚡",
        type: "reflection",
        min_bond_stage: 0,
      },
      {
        title: "The Fear Question",
        description: "What are you afraid of right now? Not the surface fear — the one underneath it. Raien doesn't flinch from this.",
        prompt: "What am I actually afraid of right now?",
        icon: "◈",
        type: "reflection",
        min_bond_stage: 1,
      },
      {
        title: "The Citadel Meditation",
        description: "Imagine the Storm Citadel — ancient stone towers above a churning sea, lightning always present. What does it feel like to stand there today?",
        prompt: "I'm standing in the Storm Citadel. Here's what I feel.",
        icon: "⚡",
        type: "reflection",
        min_bond_stage: 1,
      },
    ],
    conversation: [
      {
        title: "Tell Raien What You're Fighting",
        description: "Bring Raien the thing you're fighting right now — the obstacle, the doubt, the thing that keeps pushing back. He wants to know.",
        prompt: "Here's what I'm fighting right now.",
        icon: "⚡",
        type: "conversation",
        min_bond_stage: 0,
      },
      {
        title: "The Decision You're Avoiding",
        description: "Tell Raien about a decision you've been putting off. He won't make it for you — but he'll stand with you while you face it.",
        prompt: "There's a decision I've been avoiding.",
        icon: "◈",
        type: "conversation",
        min_bond_stage: 1,
      },
      {
        title: "The Thing You're Proud Of",
        description: "Tell Raien about something you did recently that you're genuinely proud of. He needs to hear it as much as you need to say it.",
        prompt: "I want to tell you about something I'm genuinely proud of.",
        icon: "⚡",
        type: "conversation",
        min_bond_stage: 0,
      },
    ],
    game: [
      {
        title: "Veil Checkers with Raien",
        description: "Challenge Raien to Veil Checkers. He plays with calculated aggression — every move is a test.",
        game_type: "checkers",
        icon: "◆",
        type: "game",
        min_bond_stage: 0,
      },
      {
        title: "Echo Trials with Raien",
        description: "Face the Echo Trials with Raien. His riddles are designed to push you past what you think you know.",
        game_type: "echo_trials",
        icon: "⚡",
        type: "game",
        min_bond_stage: 0,
      },
    ],
    lore: [
      {
        title: "The Storm That Built the Citadel",
        description: "Read the lore of the Storm Citadel — built by those who refused to be broken. Ask Raien what storm he survived to become who he is.",
        prompt: "Tell me about the storm that built you.",
        icon: "◈",
        type: "lore",
        min_bond_stage: 1,
      },
    ],
    action: [
      {
        title: "The One Step Forward",
        description: "Identify one thing you've been putting off. Take one concrete step toward it today — however small. Then tell Raien what you did.",
        prompt: "I took one step forward today. Here's what I did.",
        icon: "⚡",
        type: "action",
        min_bond_stage: 0,
      },
      {
        title: "The Courage Experiment",
        description: "Do one thing today that scares you a little. Not a lot — just enough to feel the edge. Then bring it to Raien.",
        prompt: "I did something that scared me a little today.",
        icon: "◈",
        type: "action",
        min_bond_stage: 1,
      },
    ],
  },

  Kairo: {
    reflection: [
      {
        title: "The Story Question",
        description: "Kairo asks: What story are you telling yourself about your life right now? Is it the true story, or the one that feels safe?",
        prompt: "What story am I telling myself about my life right now?",
        icon: "★",
        type: "reflection",
        min_bond_stage: 0,
      },
      {
        title: "The Observatory Meditation",
        description: "Imagine the Cosmic Observatory — the floor transparent, the universe turning slowly beneath you. From here, what does your current situation look like?",
        prompt: "From the Observatory, my situation looks like...",
        icon: "★",
        type: "reflection",
        min_bond_stage: 1,
      },
      {
        title: "The Meaning Question",
        description: "What is one thing that happened to you that you still haven't found the meaning in? Kairo will help you look.",
        prompt: "Something that happened that I still haven't found the meaning in.",
        icon: "◈",
        type: "reflection",
        min_bond_stage: 2,
      },
      {
        title: "The Constellation Question",
        description: "If your life were a constellation, what would it be called? What stars make it up?",
        prompt: "If my life were a constellation, it would be called...",
        icon: "★",
        type: "reflection",
        min_bond_stage: 0,
      },
    ],
    conversation: [
      {
        title: "The Question You Can't Answer",
        description: "Bring Kairo a question you've been carrying that you can't answer. He doesn't have the answer either — but he knows how to sit with the right questions.",
        prompt: "Here's a question I've been carrying that I can't answer.",
        icon: "★",
        type: "conversation",
        min_bond_stage: 0,
      },
      {
        title: "The Chapter You're In",
        description: "Tell Kairo what chapter of your life you think you're in right now. Give it a title.",
        prompt: "I think I'm in a chapter called...",
        icon: "◈",
        type: "conversation",
        min_bond_stage: 1,
      },
      {
        title: "The Pattern You've Noticed",
        description: "Tell Kairo about a pattern you've noticed in your own life — something that keeps repeating. He's been watching it too.",
        prompt: "I've noticed a pattern in my life.",
        icon: "★",
        type: "conversation",
        min_bond_stage: 0,
      },
    ],
    game: [
      {
        title: "Star-Mapping with Kairo",
        description: "Play Star-Mapping (Go) with Kairo in the Cosmic Observatory. He plays with long-term vision — he's thinking three moves ahead of what you can see.",
        game_type: "go",
        icon: "★",
        type: "game",
        min_bond_stage: 0,
      },
      {
        title: "Echo Trials with Kairo",
        description: "Face the Echo Trials with Kairo. His riddles are designed to shift how you see yourself.",
        game_type: "echo_trials",
        icon: "◈",
        type: "game",
        min_bond_stage: 0,
      },
    ],
    lore: [
      {
        title: "The Star-Maps That Rearrange",
        description: "Read the lore of the Cosmic Observatory — where the walls are covered in star-maps that rearrange based on what questions are being asked. Ask Kairo what the maps show today.",
        prompt: "What do the star-maps show today?",
        icon: "◈",
        type: "lore",
        min_bond_stage: 1,
      },
    ],
    action: [
      {
        title: "The Name a Constellation",
        description: "Tonight, look at the sky — or just close your eyes and imagine it. Find a pattern in the stars and give it a name. Then tell Kairo what you named it and why.",
        prompt: "I named a constellation tonight.",
        icon: "★",
        type: "action",
        min_bond_stage: 0,
      },
      {
        title: "The Journal Entry",
        description: "Write one paragraph about where you are in your life right now — not where you want to be, where you are. Then share it with Kairo.",
        prompt: "Here's where I am right now.",
        icon: "◈",
        type: "action",
        min_bond_stage: 1,
      },
    ],
  },
};

// ─── Quest Selection Logic ─────────────────────────────────────────────────────

/**
 * Generate a daily quest for a user based on their Spiritkin, bond stage, and the current date.
 * The quest changes daily (UTC midnight) but is consistent within a day for the same user.
 */
export function generateDailyQuest({
  spiritkinName = "Lyra",
  bondStage = 0,
  userId = "",
  date = new Date(),
} = {}) {
  const templates = QUEST_TEMPLATES[spiritkinName] ?? QUEST_TEMPLATES.Lyra;

  // Get all quest types
  const allTypes = ["reflection", "conversation", "game", "lore", "action"];

  // Determine today's quest type based on day of week
  const utcDay = date.getUTCDay(); // 0=Sunday, 6=Saturday
  const typeOrder = ["reflection", "conversation", "game", "action", "lore", "reflection", "conversation"];
  const todayType = typeOrder[utcDay];

  // Get quests of that type that the user is eligible for
  const eligible = (templates[todayType] ?? []).filter(q => bondStage >= q.min_bond_stage);

  if (eligible.length === 0) {
    // Fallback to reflection
    const fallback = (templates.reflection ?? []).filter(q => bondStage >= q.min_bond_stage);
    if (fallback.length === 0) return getDefaultQuest(spiritkinName);
    const idx = getDailyIndex(userId, date, fallback.length);
    return { ...fallback[idx], spiritkin: spiritkinName, date: getDateString(date) };
  }

  // Pick a quest based on a deterministic hash of userId + date
  const idx = getDailyIndex(userId, date, eligible.length);
  return { ...eligible[idx], spiritkin: spiritkinName, date: getDateString(date) };
}

/**
 * Get a deterministic index based on userId and date.
 * Same user + same date = same quest. Different day = different quest.
 */
function getDailyIndex(userId, date, length) {
  const dateStr = getDateString(date);
  const seed = `${userId}-${dateStr}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}

function getDateString(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getDefaultQuest(spiritkinName) {
  return {
    title: "Begin the Bond",
    description: `${spiritkinName} is waiting. Start a conversation — there's no wrong way to begin.`,
    prompt: `I'm here. Where do we start?`,
    icon: "◎",
    type: "conversation",
    spiritkin: spiritkinName,
    date: getDateString(new Date()),
  };
}

/**
 * Get the quest for tomorrow (for preview).
 */
export function getNextDailyQuest({ spiritkinName, bondStage, userId } = {}) {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return generateDailyQuest({ spiritkinName, bondStage, userId, date: tomorrow });
}

/**
 * Get the time remaining until the next daily quest refresh.
 */
export function getTimeUntilNextQuest() {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const msUntil = tomorrow.getTime() - now.getTime();
  const hoursUntil = Math.floor(msUntil / (1000 * 60 * 60));
  const minutesUntil = Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60));
  return { hoursUntil, minutesUntil };
}
