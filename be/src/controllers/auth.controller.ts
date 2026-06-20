import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import { register, login } from "../services/auth.service.js";
import type { RegisterBody, LoginBody } from "../schemas/auth.schema.js";

/**
 * controllers/auth.controller.ts
 *
 * Thin layer: parse validated req.body → call service → send response.
 * All business logic lives in auth.service.ts.
 * All error handling flows through errorHandler.ts via catchAsync.
 */

/**
 * POST /api/auth/register
 *
 * Body (validated by registerSchema):
 *   { username, email, password, phone? }
 *
 * Response 201:
 *   { user: { user_id, username, email }, accessToken, refreshToken }
 */
export const registerController = catchAsync(
  async (req: Request, res: Response) => {
    const body = req.body as RegisterBody;
    const result = await register(body);

    res.status(201).json(result);
  },
);

/**
 * POST /api/auth/login
 *
 * Body (validated by loginSchema):
 *   { email, password }
 *
 * Response 200:
 *   { user: { user_id, username, email }, accessToken, refreshToken }
 */
export const loginController = catchAsync(
  async (req: Request, res: Response) => {
    const body = req.body as LoginBody;
    const result = await login(body);

    res.status(200).json(result);
  },
);
