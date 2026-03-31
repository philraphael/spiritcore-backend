import { createHash } from "crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createId = (prefix = "id") => {
  const rand = Math.random().toString(16).slice(2);
  const t = Date.now().toString(16);
  return `${prefix}_${t}_${rand}`;
};

export function toUuid(input) {
  if (!input) return null;

  const value = String(input).trim();

  // If it is already a valid UUID, keep it unchanged
  if (UUID_RE.test(value)) {
    return value.toLowerCase();
  }

  // Otherwise derive a deterministic UUID-like value
  const hash = createHash("sha1").update(value).digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    "a" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}