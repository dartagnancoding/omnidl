/**
 * Minimal Result type for expected failures (missing binary, bad URL,
 * subprocess exit != 0). Exceptions stay reserved for genuinely
 * unexpected conditions.
 */

/** Structured application error carried inside a failed Result. */
export interface AppError {
  /** Stable machine-readable code, e.g. "BINARY_NOT_FOUND". */
  code: string;
  /** Human-readable description of what went wrong. */
  message: string;
  /** Optional actionable suggestion shown to the user. */
  hint?: string;
}

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Wraps a value in a successful Result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Builds a failed Result from an AppError (or its parts). */
export function fail<T = never>(code: string, message: string, hint?: string): Result<T, AppError> {
  return { ok: false, error: { code, message, hint } };
}
