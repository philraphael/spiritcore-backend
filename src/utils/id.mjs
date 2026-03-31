import { createHash } from "crypto";

export const createId = (prefix = "id") => {
  const rand = Math.random().toString(16).slice(2);
  const t = Date.now().toString(16);
  return `${prefix}_${t}_${rand}`;
};

export function toUuid(input) {
  if (!input) return null;

  const hash = createHash("sha1")
    .update(String(input))
    .digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    "a" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}