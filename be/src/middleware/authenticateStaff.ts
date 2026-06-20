import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { verifyStaffAccessToken } from "../utils/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    staff?: {
      staff_id: number;
      name: string; // matches staff.name column — no username column in schema
    };
  }
}

/**
 * Verifies the Bearer JWT issued to a staff-table member.
 * Attaches { staff_id, name } to req.staff.
 * Uses verifyStaffAccessToken() from utils/jwt.ts (STAFF_JWT_SECRET — separate from user JWT).
 */
export const authenticateStaff = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Staff authentication token required"));
  }

  try {
    const payload = verifyStaffAccessToken(authHeader.slice(7));
    req.staff = {
      staff_id: payload.staff_id,
      name: payload.name,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError)
      return next(new ApiError(401, "Staff token expired"));
    if (err instanceof jwt.JsonWebTokenError)
      return next(new ApiError(401, "Invalid staff token"));
    next(err);
  }
};
