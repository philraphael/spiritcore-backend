/**
 * SpiritCore — Timeout Guard Utility (Phase F)
 *
 * Wraps any async operation with a hard timeout.
 * Throws a TimeoutError if the operation does not resolve within the limit.
 * Ensures no hanging requests reach the caller.
 */

import { TimeoutError } from "../errors.mjs";

/**
 * Race a promise against a timeout.
 *
 * @param {Promise<any>} promise - The async operation to guard
 * @param {number} ms            - Timeout in milliseconds
 * @param {string} label         - Human-readable label for error messages
 * @returns {Promise<any>}
 * @throws {TimeoutError} if the operation exceeds `ms` milliseconds
 *
 * @example
 *   const result = await withTimeout(
 *     adapter.generate(prompt),
 *     config.timeouts.adapter,
 *     "adapter generation"
 *   );
 */
export async function withTimeout(promise, ms, label = "operation") {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(label));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
