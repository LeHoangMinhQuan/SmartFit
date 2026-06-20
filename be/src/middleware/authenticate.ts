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
 * Verifies the Bearer JWT issued to a "USER"-table user.
 * Attaches { user_id, email } to req.user — no role field ("USER" has no role column).
 * Uses verifyUserAccessToken() from utils/jwt.ts (JWT_SECRET).
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication token required"));
  }

  try {
    const payload = verifyUserAccessToken(authHeader.slice(7));
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
