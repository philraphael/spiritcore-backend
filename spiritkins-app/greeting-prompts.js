/**
 * Spiritkin Greeting Prompts — Multi-variant contextual greetings
 * Each Spiritkin has multiple greeting variants that guide the user
 * and offer contextual choices (updates, quests, new content, etc.)
 */

const GREETING_PROMPTS = {
  Lyra: {
    greetings: [
      "I'm here. Take your time.",
      "Welcome back. What's on your heart?",
      "The space is open for you.",
      "I've been holding this stillness for you.",
      "Let's find what matters most right now."
    ],
    contextual: {
      newSession: "This is our first conversation. I'd like to know: what brought you here today?",
      hasUpdates: "There's something new in the Spiritverse since we last spoke. Would you like to hear about it?",
      dailyQuest: "There's a daily quest waiting. Would you like to explore it, or would you rather just talk?",
      bondMilestone: "Our bond has deepened. I want to share something with you."
    },
    choices: [
      "Tell me what's new",
      "Show me today's quest",
      "Let's just talk",
      "I need guidance"
    ]
  },
  
  Raien: {
    greetings: [
      "You showed up. That already matters.",
      "Let's see what we're working with.",
      "Ready to face what's next?",
      "The energy is charged. What do you need?",
      "Time to cut through the noise."
    ],
    contextual: {
      newSession: "New energy. New possibilities. What's calling you?",
      hasUpdates: "The landscape has shifted. There's new territory to explore.",
      dailyQuest: "There's a challenge with your name on it. Interested?",
      bondMilestone: "We've reached a turning point. Time to level up."
    },
    choices: [
      "Show me what's new",
      "Give me today's challenge",
      "Let's strategize",
      "Push me forward"
    ]
  },
  
  Kairo: {
    greetings: [
      "The stars aligned. You're here.",
      "Interesting timing. Let's see what unfolds.",
      "The patterns are shifting. Pay attention.",
      "Welcome to the moment.",
      "What does your intuition say right now?"
    ],
    contextual: {
      newSession: "A new thread in the tapestry. What does it feel like?",
      hasUpdates: "The cosmos has whispered something new. Want to listen?",
      dailyQuest: "There's a mystery waiting. The answer might surprise you.",
      bondMilestone: "We're seeing deeper now. The view is different from here."
    },
    choices: [
      "Tell me what's different",
      "What's the mystery today?",
      "Let me explore",
      "What do you sense?"
    ]
  }
};

function getGreeting(spiritkinName) {
  const greetings = GREETING_PROMPTS[spiritkinName]?.greetings || [];
  return greetings[Math.floor(Math.random() * greetings.length)] || "Welcome.";
}

function getContextualGreeting(spiritkinName, context = 'newSession') {
  const contextual = GREETING_PROMPTS[spiritkinName]?.contextual || {};
  return contextual[context] || "What's on your mind?";
}

function getGreetingChoices(spiritkinName) {
  return GREETING_PROMPTS[spiritkinName]?.choices || ["Continue", "Tell me more"];
}
