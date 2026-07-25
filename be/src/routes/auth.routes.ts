import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/authenticate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
} from "../controllers/auth.controller.js";

/**
 * routes/auth.routes.ts
 *
 * Mounted at /api/auth in app.ts.
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
 * that's path-scoped to /api/auth, so no extra access-token-derived
 * user_id scoping is needed for security.
 *
 * /refresh and /logout no longer validate a body — both tokens now travel
 * as httpOnly cookies (see controllers/auth.controller.js), not JSON.
 */
const router = Router();

// POST /api/auth/register
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  registerController,
);

// POST /api/auth/login
router.post("/login", authLimiter, validate(loginSchema), loginController);

// POST /api/auth/refresh
// Public — see note above. authLimiter guards against brute-forcing tokens.
router.post("/refresh", authLimiter, refreshController);

// POST /api/auth/logout
// authenticate first — user_id needed to delete the correct token row.
router.post("/logout", authenticate, logoutController);

export default router;
