import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/authenticate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from "../schemas/auth.schema.js";
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
 *   Protected:   authenticate → validate(schema) → controller
 *
 * authLimiter:  10 req / 15 min per IP — guards against brute-force and enumeration.
 * authenticate: verifies Bearer access token, attaches req.user = { user_id, email }.
 * validate:     Zod parse + coerce; passes ApiError(422) to errorHandler on failure.
 *
 * Note — /refresh and /logout require a valid access token (authenticate).
 * This means the client must send both tokens:
 *   Authorization: Bearer <accessToken>
 *   Body: { refreshToken: "<rawRefreshToken>" }
 *
 * Rationale: the refresh_token table is keyed by (user_id, token_hash).
 * Without user_id from the access token we cannot scope the lookup,
 * allowing one user to probe another user's token hashes.
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
// authenticate first — user_id needed to scope the token lookup in the DB.
router.post(
  "/refresh",
  authenticate,
  validate(refreshSchema),
  refreshController,
);

// POST /api/auth/logout
// authenticate first — user_id needed to delete the correct token row.
router.post("/logout", authenticate, validate(logoutSchema), logoutController);

export default router;
