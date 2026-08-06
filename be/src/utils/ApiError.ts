/**
 * ApiError
 *
 * Operational (expected) errors thrown anywhere in the stack.
 * Caught by errorHandler.ts and serialised to:
 *   { status: 'error', statusCode, message, details?, code? }
 *
 * `code` (NEW) is an optional machine-readable reason distinct from
 * `message` — added for cases where the SAME statusCode can mean two
 * different things a client needs to handle differently. Concretely:
 * model-router.service.ts's 503s can mean either "an RPM window is
 * saturated and clears in ~60s" or "today's daily budget is genuinely
 * gone" — both were previously indistinguishable to the frontend, which
 * only branches on statusCode (see ChatPanel.tsx). `message` stays
 * human-readable prose; `code` is for `if (err.code === "...")` checks
 * that shouldn't be coupled to exact wording.
 *
 * IMPORTANT: `code` is appended AFTER `details`, not before — middleware
 * /validate.ts already calls `new ApiError(422, "Validation failed", details)`
 * with `details` as the 3rd positional arg. Inserting `code` ahead of
 * `details` would silently reassign that array into `code` and drop the
 * real validation details on every Zod-validated route in the app. Every
 * existing call site in this codebase passes at most 3 args, so adding
 * `code` as a 4th, optional param is additive and doesn't require
 * touching any of them.
 *
 * Usage:
 *   throw new ApiError(404, 'Product not found')
 *   throw new ApiError(422, 'Validation failed', [{ field: 'email', message: '...' }])
 *   throw new ApiError(503, 'Try again shortly', undefined, 'rpm_transient')
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: Array<{ field: string; message: string }>;
  readonly code?: string;

  constructor(
    statusCode: number,
    message: string,
    details?: Array<{ field: string; message: string }>,
    code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;

    // Maintain proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
