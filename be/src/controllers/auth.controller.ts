import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import { ApiError } from "../utils/ApiError.js";
import { register, login, refresh, logout } from "../services/auth.service.js";
import {
  setAuthCookies,
  setAccessTokenCookie,
  clearAuthCookies,
} from "../utils/cookies.js";
import type { RegisterBody, LoginBody } from "../schemas/auth.schema.js";

/**
 * controllers/auth.controller.ts
 *
 * Thin layer: parse validated req.body → call service → send response.
 * All business logic lives in auth.service.ts.
 * All error handling flows through errorHandler.ts via catchAsync.
 *
 * Tokens are never returned in the JSON body — both accessToken and
 * refreshToken are set as httpOnly cookies (see utils/cookies.ts) so
 * they're inaccessible to JS on the frontend (XSS-hardening). Only the
 * non-sensitive `user` object is returned in the body for the frontend
 * to cache (e.g. in Zustand + localStorage) for UI purposes.
 */

/**
 * POST /api/auth/register
 *
 * Body (validated by registerSchema):
 *   { username, email, password, phone, address }
 *
 * Response 201:
 *   { user: { user_id, username, email, phone, address } }
 *   + Set-Cookie: accessToken, refreshToken (httpOnly)
 */
export const registerController = catchAsync(
  async (req: Request, res: Response) => {
    const body = req.body as RegisterBody;
    const result = await register(body);

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(201).json({ user: result.user });
  },
);

/**
 * POST /api/auth/login
 *
 * Body (validated by loginSchema):
 *   { email, password }
 *
 * Response 200:
 *   { user: { user_id, username, email, phone, address } }
 *   + Set-Cookie: accessToken, refreshToken (httpOnly)
 */
export const loginController = catchAsync(
  async (req: Request, res: Response) => {
    const body = req.body as LoginBody;
    const result = await login(body);

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(200).json({ user: result.user });
  },
);

/**
 * POST /api/auth/refresh
 *
 * Public (no access token required — see routes/auth.routes.ts and
 * services/auth.service.ts for why).
 *
 * Reads the refresh token from the httpOnly `refreshToken` cookie
 * (path-scoped to /api/auth, so it's only ever sent to these four
 * routes) rather than the request body — nothing sensitive travels
 * through JS-readable state anymore.
 *
 * Response 200: { success: true } + Set-Cookie: accessToken (httpOnly)
 */
export const refreshController = catchAsync(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.["refreshToken"] as string | undefined;

    if (!refreshToken) {
      throw new ApiError(401, "Refresh token required");
    }

    const result = await refresh(refreshToken);

    setAccessTokenCookie(res, result.accessToken);
    res.status(200).json({ success: true });
  },
);

/**
 * POST /api/auth/logout
 *
 * Requires: the httpOnly `accessToken` cookie (via authenticate middleware).
 * Reads the refresh token from the httpOnly `refreshToken` cookie.
 *
 * Deletes the specific refresh_token row for (user_id, token_hash), then
 * clears both cookies. Idempotent — silently succeeds even if the token
 * is already gone or missing.
 *
 * Response 204: No Content
 */
export const logoutController = catchAsync(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.["refreshToken"] as string | undefined;
    const user_id = req.user!.user_id;

    if (refreshToken) {
      await logout(user_id, refreshToken);
    }

    clearAuthCookies(res);
    res.status(204).send();
  },
);
