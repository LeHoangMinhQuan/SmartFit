import { rateLimit } from "express-rate-limit";

/**
 * express-rate-limit v8.5.2
 *
 * Global limiter — applied to all routes in app.ts.
 * 200 requests per 15 minutes per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,
  standardHeaders: "draft-8", // modern RateLimit header (IETF draft 8)
  legacyHeaders: false, // disable X-RateLimit-* headers
  message: {
    status: "error",
    statusCode: 429,
    message: "Too many requests, please try again later.",
  },
});

/**
 * Auth limiter — applied to login, register, forgot-password, reset-password.
 * 10 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "Too many auth attempts, please try again in 15 minutes.",
  },
});

/**
 * Virtual try-on limiter — 5 preview requests per 10 minutes per IP.
 * Referenced in the plan as `tryonLimiter` in rateLimiter.js (§5 Security).
 */
export const tryonLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "Try-on preview limit reached. Please wait 10 minutes.",
  },
});

/**
 * Password-reset limiter — extra tight for forgot-password endpoint.
 * 5 requests per hour per IP.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "Too many password reset requests. Please try again in an hour.",
  },
});
