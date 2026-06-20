import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";
import {
  registerController,
  loginController,
} from "../controllers/auth.controller.js";

/**
 * routes/auth.routes.ts
 *
 * Mounted at /api/auth in app.ts.
 *
 * Middleware chain per route:
 *   authLimiter → validate(schema) → controller
 *
 * authLimiter: 10 req / 15 min per IP — guards against brute-force and enumeration.
 * validate:    Zod parse + coerce; passes ApiError(422) to errorHandler on failure.
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

export default router;
