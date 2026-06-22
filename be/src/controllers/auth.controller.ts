import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import { register, login, refresh, logout } from "../services/auth.service.js";
import type {
  RegisterBody,
  LoginBody,
  RefreshBody,
  LogoutBody,
} from "../schemas/auth.schema.js";

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
 *   { username, email, password, phone, address }
 *
 * Response 201:
 *   { user: { user_id, username, email, phone, address }, accessToken, refreshToken }
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
 *   { user: { user_id, username, email, phone, address }, accessToken, refreshToken }
 */
export const loginController = catchAsync(
  async (req: Request, res: Response) => {
    const body = req.body as LoginBody;
    const result = await login(body);

    res.status(200).json(result);
  },
);

/**
 * POST /api/auth/refresh
 *
 * Requires: Authorization: Bearer <accessToken>  (via authenticate middleware)
 * Body (validated by refreshSchema):
 *   { refreshToken }
 *
 * Verifies the refresh token hash against the DB row for this user.
 * The refresh_token row is left untouched — only a new access token is issued.
 *
 * Response 200:
 *   { accessToken }
 */
export const refreshController = catchAsync(
  async (req: Request, res: Response) => {
    const { refreshToken } = req.body as RefreshBody;
    const user_id = req.user!.user_id;

    const result = await refresh(user_id, refreshToken);

    res.status(200).json(result);
  },
);

/**
 * POST /api/auth/logout
 *
 * Requires: Authorization: Bearer <accessToken>  (via authenticate middleware)
 * Body (validated by logoutSchema):
 *   { refreshToken }
 *
 * Deletes the specific refresh_token row for (user_id, token_hash).
 * Idempotent — silently succeeds even if the token is already gone.
 *
 * Response 204: No Content
 */
export const logoutController = catchAsync(
  async (req: Request, res: Response) => {
    const { refreshToken } = req.body as LogoutBody;
    const user_id = req.user!.user_id;

    await logout(user_id, refreshToken);

    res.status(204).send();
  },
);
