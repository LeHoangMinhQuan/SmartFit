/**
 * ApiError
 *
 * Operational (expected) errors thrown anywhere in the stack.
 * Caught by errorHandler.ts and serialised to:
 *   { status: 'error', statusCode, message, details? }
 *
 * Usage:
 *   throw new ApiError(404, 'Product not found')
 *   throw new ApiError(422, 'Validation failed', [{ field: 'email', message: '...' }])
 *   throw new ApiError(409, 'voucher.code already exists')
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: Array<{ field: string; message: string }>;

  constructor(
    statusCode: number,
    message: string,
    details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
