import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { verifyUserAccessToken, verifyStaffAccessToken } from "../utils/jwt.js";

/**
 * middleware/authenticateEither.ts
 *
 * For endpoints any authenticated actor can use, regardless of which
 * account type they are — currently just review replies (customer,
 * staff, and admin can all reply to a review). Everywhere else in this
 * codebase, a route is either customer-only (authenticate.ts) or
 * staff-only (authenticateStaff.ts); this is the one case that
 * genuinely needs both.
 *
 * Reuses the existing, unmodified transport convention rather than
 * inventing a new one: customer auth reads the httpOnly `accessToken`
 * cookie, staff auth reads an `Authorization: Bearer` header
 * (authenticateStaff.ts's own doc comment). Those two channels don't
 * overlap in this app, so "which header/cookie is actually present"
 * is an unambiguous signal for which account type is authenticating —
 * no need to guess or try both blindly.
 *
 * If a credential IS present but fails verification (expired,
 * malformed), this fails immediately with that credential's specific
 * error rather than silently falling through to check the other
 * channel — a staff member sending an expired Bearer token should see
 * "Staff token expired", not a generic 401 that reads as if they sent
 * nothing at all.
 */

export interface EitherActor {
  type: "customer" | "staff";
  id: number; // user_id for a customer, staff_id for staff/admin
}

declare module "express-serve-static-core" {
  interface Request {
    actor?: EitherActor;
  }
}

export const authenticateEither = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.["accessToken"] as string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = verifyStaffAccessToken(authHeader.slice(7));
      req.actor = { type: "staff", id: payload.staff_id };
      return next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError)
        return next(new ApiError(401, "Staff token expired"));
      if (err instanceof jwt.JsonWebTokenError)
        return next(new ApiError(401, "Invalid staff token"));
      return next(err);
    }
  }

  if (cookieToken) {
    try {
      const payload = verifyUserAccessToken(cookieToken);
      req.actor = { type: "customer", id: payload.user_id };
      return next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError)
        return next(new ApiError(401, "Token expired"));
      if (err instanceof jwt.JsonWebTokenError)
        return next(new ApiError(401, "Invalid token"));
      return next(err);
    }
  }

  next(new ApiError(401, "Authentication required"));
};
