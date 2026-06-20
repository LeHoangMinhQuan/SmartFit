import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

/**
 * Centralised Express error-handling middleware.
 * Must be the LAST app.use() in app.ts, after notFound.
 *
 * Handles four error classes in priority order:
 *   1. multer.MulterError  — file upload constraint violations
 *   2. ZodError            — safety net (validate.ts converts these first)
 *   3. ApiError            — operational errors thrown across the stack
 *   4. Unknown errors      — programmer errors; stack exposed only in development
 *
 * ⚠ VNPay IPN must NOT reach this handler — the IPN controller must always
 *   return { RspCode } directly, never call next(err).
 *
 * Response shape (§8):
 *   { status: 'error', statusCode, message, details?: [{ field, message }] }
 */
export const errorHandler = (
  err: Error & {
    statusCode?: number;
    details?: Array<{ field: string; message: string }>;
  },
  _req: Request,
  res: Response,
  // Four-argument signature required for Express to recognise this as an error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // 1. Multer upload errors
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE:
        "File too large. Max 5 MB for products, 10 MB for try-on.",
      LIMIT_FILE_COUNT: "Too many files. Maximum 10 files per upload.",
      LIMIT_UNEXPECTED_FILE: err.message || "Unexpected file field.",
    };
    res.status(400).json({
      status: "error",
      statusCode: 400,
      message: messages[err.code] ?? `Upload error: ${err.message}`,
    });
    return;
  }

  // 2. Zod validation errors (safety net)
  if (err instanceof ZodError) {
    res.status(422).json({
      status: "error",
      statusCode: 422,
      message: "Validation failed",
      details: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  // 3. Operational ApiError
  if (err instanceof ApiError) {
    const body: Record<string, unknown> = {
      status: "error",
      statusCode: err.statusCode,
      message: err.message,
    };
    if (err.details) body['details'] = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  // 4. Unexpected / programmer errors
  console.error("[Unhandled Error]", err);
  res.status(500).json({
    status: "error",
    statusCode: 500,
    message:
      env.NODE_ENV === "development" ? err.message : "Internal server error",
    ...(env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
