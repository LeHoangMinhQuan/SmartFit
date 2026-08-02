import { Request, Response } from "express";
import crypto from "node:crypto";
import { catchAsync } from "../utils/catchAsync.js";
import { ApiError } from "../utils/ApiError.js";
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  syncGoogleUser,
} from "../services/auth.service.js";
import {
  setAuthCookies,
  setAccessTokenCookie,
  clearAuthCookies,
} from "../utils/cookies.js";
import { env } from "../config/env.js";
import type {
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  SyncGoogleUserBody,
} from "../schemas/auth.schema.js";

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
 * (path-scoped to /api/app-auth, so it's only ever sent to these
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

/**
 * POST /api/auth/forgot-password
 *
 * Body (validated by forgotPasswordSchema): { email }
 *
 * Always responds 200 with the same generic message whether or not the
 * email is registered — prevents account enumeration. See
 * auth.service.ts#forgotPassword for the Firebase link + SMTP send.
 */
export const forgotPasswordController = catchAsync(
  async (req: Request, res: Response) => {
    const { email } = req.body as ForgotPasswordBody;
    await forgotPassword(email);
    res.status(200).json({
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  },
);

/**
 * POST /api/auth/reset-password
 *
 * Body (validated by resetPasswordSchema): { oobCode, newPassword }
 * `oobCode` comes from the query string of the link emailed by
 * forgotPassword — see app/reset-password/page.tsx on the frontend.
 */
export const resetPasswordController = catchAsync(
  async (req: Request, res: Response) => {
    const { oobCode, newPassword } = req.body as ResetPasswordBody;
    await resetPassword(oobCode, newPassword);
    res
      .status(200)
      .json({ message: "Password reset successful. You can now log in." });
  },
);

/**
 * POST /api/app-auth/google-sync
 *
 * NOT reachable from the browser directly — this endpoint trusts the
 * caller's claimed email/google_id completely (there's no password to
 * check, unlike login()), so it must only ever be called server-to-server
 * by the Next.js app (app/api/sync-google-user/route.ts), which is the
 * thing that actually validated the Google sign-in via NextAuth. Anyone
 * else calling this directly could mint a session for any email/google_id
 * they want — that's what X-Internal-Secret guards against. Compared
 * with the request header via a constant-time check to avoid a timing
 * side-channel on the secret.
 */
export const syncGoogleUserController = catchAsync(
  async (req: Request, res: Response) => {
    const provided = req.header("X-Internal-Secret") ?? "";
    const expected = env.GOOGLE_SYNC_SECRET;
    const isValid =
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!isValid) {
      throw new ApiError(401, "Unauthorized");
    }

    const body = req.body as SyncGoogleUserBody;
    const result = await syncGoogleUser({
      email: body.email,
      google_id: body.google_id,
      username: body.username,
      avatar_url: body.avatar_url ?? null,
    });

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(200).json({ user: result.user });
  },
);
