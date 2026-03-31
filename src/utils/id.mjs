import { createHash } from "crypto";

export const createId = (prefix = "id") => {
  const rand = Math.random().toString(16).slice(2);
  const t = Date.now().toString(16);
  return `${prefix}_${t}_${rand}`;
};

/**
 * Convert any string userId to a deterministic UUID v5-like value.
 * If the input is already a valid UUID, return it unchanged.
 * Otherwise, derive a stable UUID from the string using SHA-1 hash.
 *
 * This allows external string user IDs (e.g. "test-user-001") to be
 * stored in UUID columns without schema changes.
 */
export const toUuid = (userId) => {
  if (!userId) return userId;
  // If already a valid UUID, return as-is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(userId)) return userId;
  // Derive deterministic UUID from string using SHA-1 (UUID v5 namespace DNS style)
  const hash = createHash("sha1").update("spiritcore:" + userId).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),  // version 5
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
};
