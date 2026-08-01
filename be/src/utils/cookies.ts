import { Response } from "express";
import { env } from "../config/env.js";

/**
 * utils/cookies.ts
 *
 * Centralizes how the two auth tokens are written to/cleared from the
 * browser. Both are httpOnly — the frontend never reads or stores them in
 * JS (no localStorage, no Authorization header). `withCredentials: true`
 * on the frontend's axios instance + `credentials: true` in the CORS
 * config (app.ts) is what makes the browser actually attach these on
 * cross-port requests in dev.
 *
 * TTLs are kept in lockstep with utils/jwt.ts (ACCESS_TTL = 15m,
 * REFRESH_TTL = 7d) — if those change, update the values below too.
 */

const isProd = env.NODE_ENV === "production";

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15m — matches jwt.ts ACCESS_TTL
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7d — matches jwt.ts REFRESH_TTL

const baseCookieOptions = {
  httpOnly: true,
  secure: isProd, // over plain HTTP in local dev, secure cookies won't be set at all
  sameSite: "lax" as const,
};

export const setAccessTokenCookie = (
  res: Response,
  accessToken: string,
): void => {
  res.cookie("accessToken", accessToken, {
    ...baseCookieOptions,
    path: "/", // every API route needs this one
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
};

export const setRefreshTokenCookie = (
  res: Response,
  refreshToken: string,
): void => {
  res.cookie("refreshToken", refreshToken, {
    ...baseCookieOptions,
    // Scoped to /api/app-auth only — the refresh token never needs to
    // leave the auth surface (login/register/refresh/logout), unlike the
    // access token which every authenticated route needs on path "/".
    // Renamed 2026-08-01 from /api/auth — see app.ts's mount comment.
    path: "/api/app-auth",
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
): void => {
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/api/app-auth" });
};
