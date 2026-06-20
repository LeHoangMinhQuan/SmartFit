import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";

/**
 * 404 catch-all middleware.
 *
 * Register AFTER all routes but BEFORE errorHandler in app.ts:
 *   app.use(router)
 *   app.use(notFound)      ← here
 *   app.use(errorHandler)
 */
export const notFound = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};
