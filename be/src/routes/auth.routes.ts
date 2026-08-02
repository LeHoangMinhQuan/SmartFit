import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/authenticate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  syncGoogleUserSchema,
} from "../schemas/auth.schema.js";
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
  syncGoogleUserController,
} from "../controllers/auth.controller.js";

/**
 * routes/auth.routes.ts
 *
 * Mounted at /api/app-auth in app.ts (renamed 2026-08-01 — see app.ts's
 * mount comment; /api/auth itself is now exclusively NextAuth's).
 *
 * Middleware chain per route:
 *   Public:      authLimiter → validate(schema) → controller
 *   Protected:   authenticate → controller
 *
 * authLimiter:  10 req / 15 min per IP — guards against brute-force and enumeration.
 * authenticate: verifies the accessToken httpOnly cookie, attaches
 *               req.user = { user_id, email }.
 * validate:     Zod parse + coerce; passes ApiError(422) to errorHandler on failure.
 *
 * Note — /refresh is public (authLimiter only), not authenticate-gated.
 * Requiring a still-valid access token to call /refresh was a catch-22:
 * the whole point of /refresh is to mint a new access token once the old
 * one has expired, so demanding a non-expired one to reach it meant the
 * endpoint could never actually be used for its intended purpose.
 * The refresh token itself (a 320-bit crypto-random value, hashed before
 * storage — see findRefreshTokenByHash) arrives via an httpOnly cookie
 * that's path-scoped to /api/app-auth, so no extra access-token-derived
 * user_id scoping is needed for security.
 *
 * /refresh and /logout no longer validate a body — both tokens now travel
 * as httpOnly cookies (see controllers/auth.controller.js), not JSON.
 */
const router = Router();

// POST /api/app-auth/register
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  registerController,
);

// POST /api/app-auth/login
router.post("/login", authLimiter, validate(loginSchema), loginController);

// POST /api/app-auth/refresh
// Public — see note above. authLimiter guards against brute-forcing tokens.
router.post("/refresh", authLimiter, refreshController);

// POST /api/app-auth/logout
// authenticate first — user_id needed to delete the correct token row.
router.post("/logout", authenticate, logoutController);

// POST /api/app-auth/forgot-password
// Public. Generates a Firebase password-reset link and emails it out.
// See controllers/auth.controller.js + services/auth.service.js.
router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPasswordController,
);

// POST /api/app-auth/reset-password
// Public — the oobCode itself (not a session) is the credential here,
// and it's redeemed server-side against Google's Identity Toolkit API.
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  resetPasswordController,
);

// POST /api/app-auth/google-sync
// Server-to-server only (Next.js's app/api/sync-google-user route) — see
// syncGoogleUserController's doc comment for why this must never be
// reachable directly from the browser. No authLimiter: this isn't a
// credential-guessing surface (the X-Internal-Secret check is), and the
// Next.js route is the only intended caller.
router.post(
  "/google-sync",
  validate(syncGoogleUserSchema),
  syncGoogleUserController,
);

export default router;
