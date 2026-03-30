/**
 * SpiritCore — Centralized Error Types (Phase F)
 *
 * All services throw typed subclasses of AppError.
 * The orchestrator catches these and maps them to the standard response envelope.
 * Stack traces are never leaked to callers.
 */

export class AppError extends Error {
  constructor(code, message, httpCode = 400, detail = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpCode = httpCode;
    this.detail = detail;
  }

  /** Safe representation for API responses — no stack trace. */
  toJSON() {
    return { ok: false, error: this.code, message: this.message };
  }
}

/** 404 — Resource not found */
export class NotFoundError extends AppError {
  constructor(resource, id) {
    super("NOT_FOUND", `${resource} not found${id ? `: ${id}` : ""}`, 404);
    this.name = "NotFoundError";
  }
}

/** 401 / 403 — Authentication or authorization failure */
export class AuthError extends AppError {
  constructor(message = "Unauthorized") {
    super("AUTH_ERROR", message, 401);
    this.name = "AuthError";
  }
}

/** 429 — Rate limit exceeded */
export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded. Please slow down.") {
    super("RATE_LIMIT", message, 429);
    this.name = "RateLimitError";
  }
}

/** 504 — Upstream adapter or DB timed out */
export class TimeoutError extends AppError {
  constructor(label = "operation") {
    super("TIMEOUT", `The ${label} timed out. Please try again.`, 504);
    this.name = "TimeoutError";
  }
}

/** 200 — Safety escalation: acute crisis, hard block (returns 200 with safe response) */
export class SafetyEscalationError extends AppError {
  constructor(tier, escalationResponse) {
    super("SAFETY_ESCALATION", "Safety escalation triggered.", 200);
    this.name = "SafetyEscalationError";
    this.tier = tier;
    this.escalationResponse = escalationResponse;
  }
}

/** 422 — Validation failure */
export class ValidationError extends AppError {
  constructor(message, fields = []) {
    super("VALIDATION_ERROR", message, 422, { fields });
    this.name = "ValidationError";
  }
}
