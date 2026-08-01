import rateLimit, { ipKeyGenerator } from "express-rate-limit";
/**
 * express-rate-limit v8.5.2
 *
 * Global limiter — applied to all routes in app.ts.
 * 200 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
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
  max: 5,
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

/**
 * Chatbot limiter — 15 messages per 10 minutes, keyed by user_id rather
 * than IP (the default). This runs after `authenticate` in the route
 * chain, so req.user is always populated by the time this middleware
 * executes — what's being rate-limited is per-account Gemini spend, not
 * per-IP request volume, so IP would be the wrong key even if a user
 * switched networks. Runs before the controller starts streaming, so a
 * 429 is a normal pre-stream JSON response, never a mid-stream cutoff.
 *
 * This is a PER-USER spam throttle only — it does not protect Gemini's
 * actual per-minute quota, which is shared across every user of this app
 * (one GEMINI_API_KEY project). That's enforced separately and
 * app-wide by services/rpm-limiter.service.ts, consulted by
 * services/gemini-budget.service.ts before any chat or embedding call
 * reaches Gemini. Both layers matter: this one stops one user from
 * spamming; that one stops many well-behaved users from collectively
 * exceeding the shared quota.
 */
export const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  keyGenerator: (req) => {
    return req.user?.user_id.toString() ?? ipKeyGenerator(req.ip ?? "");
  },

  message: {
    status: "error",
    statusCode: 429,
    message: "Too many chat messages. Please wait a few minutes.",
  },
});
