/**
 * SpiritCore — Memory Extractor Service
 *
 * Runs asynchronously after each interaction to extract semantic facts
 * from the user's message and persist them to the memories table.
 *
 * This is the bridge between raw conversation and deep memory —
 * transforming what users say into what Spiritkins remember.
 *
 * Memory kinds:
 *   - "semantic"  : structured facts (name, relationships, goals, fears)
 *   - "episodic"  : significant emotional events
 *   - "procedural": interaction patterns and preferences
 */
import OpenAI from "openai";

const client = new OpenAI();

const EXTRACTION_PROMPT = `You are a memory extraction engine for SpiritCore, an AI companion platform.

Your task: Read the user's message and extract any meaningful personal facts worth remembering.

Extract ONLY facts that are:
1. Personal and specific (not generic statements)
2. Emotionally or relationally significant
3. Likely to be relevant in future conversations

Return a JSON array of memory objects. Each object has:
- "kind": one of "semantic" (facts/info), "episodic" (significant events/emotions), "procedural" (preferences/patterns)
- "content": a concise, third-person statement of the fact (e.g., "User's name is Alex", "User is going through a divorce", "User prefers gentle, slow responses")
- "weight": 1-3 (1=minor, 2=significant, 3=critical/core identity)

Rules:
- Return [] if there are no meaningful facts to extract
- Maximum 3 memories per message
- Do not extract generic statements like "I'm fine" or "I had a good day"
- Do not extract things that are already obvious from context
- Keep content under 100 characters
- Always return valid JSON array, nothing else`;

/**
 * Extract semantic memories from a user message.
 * Returns array of {kind, content, weight} objects.
 */
async function extractMemories(userMessage) {
  if (!userMessage || userMessage.trim().length < 10) return [];

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `User message: "${userMessage.slice(0, 500)}"` }
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" }
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    // Handle both {memories: [...]} and direct array responses
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.memories) ? parsed.memories : []);
    return arr
      .filter(m => m && typeof m.content === "string" && m.content.trim().length > 5)
      .slice(0, 3);
  } catch (err) {
    // Memory extraction is non-critical — never throw
    console.warn("[MemoryExtractor] extraction failed:", err.message);
    return [];
  }
}

/**
 * Create the memory extractor service.
 * Designed to be called fire-and-forget after each interaction.
 */
export function createMemoryExtractor({ memoryService }) {
  /**
   * Extract and persist memories from a user message.
   * Non-blocking — always resolves, never rejects.
   */
  async function extractAndPersist({ userId, spiritkinId, conversationId, userMessage }) {
    if (!userId || !userMessage) return { ok: false, reason: "missing required fields" };

    try {
      const extracted = await extractMemories(userMessage);
      if (!extracted.length) return { ok: true, count: 0 };

      const results = await Promise.allSettled(
        extracted.map(mem =>
          memoryService.write({
            userId,
            spiritkinId: spiritkinId ?? null,
            kind: mem.kind ?? "semantic",
            content: mem.content,
            meta: {
              weight: mem.weight ?? 1,
              conversationId: conversationId ?? null,
              source: "auto_extract",
              extractedAt: new Date().toISOString()
            }
          })
        )
      );

      const written = results.filter(r => r.status === "fulfilled").length;
      return { ok: true, count: written };
    } catch (err) {
      console.warn("[MemoryExtractor] persist failed:", err.message);
      return { ok: false, reason: err.message };
    }
  }

  return { extractAndPersist };
}
