import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { verifyUserAccessToken } from "../utils/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      user_id: number;
      email: string;
    };
  }
}

/**
 * Verifies the JWT issued to a "USER"-table user.
 * Attaches { user_id, email } to req.user — no role field ("USER" has no role column).
 * Uses verifyUserAccessToken() from utils/jwt.ts (JWT_SECRET).
 *
 * The token is read from the httpOnly `accessToken` cookie (see
 * utils/cookies.ts) rather than an Authorization header — the frontend
 * never holds the raw token in JS, so there's nothing for it to attach
 * as a header. The cookie rides along automatically on same-site requests
 * made with `withCredentials: true`.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const token = req.cookies?.["accessToken"] as string | undefined;

  if (!token) {
    return next(new ApiError(401, "Authentication token required"));
  }

  try {
    const payload = verifyUserAccessToken(token);
    req.user = {
      user_id: payload.user_id,
      email: payload.email,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError)
      return next(new ApiError(401, "Token expired"));
    if (err instanceof jwt.JsonWebTokenError)
      return next(new ApiError(401, "Invalid token"));
    next(err);
  }
};
