import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError.js";
import db from "../config/db.js";

// req.staff typed via module augmentation in authenticateStaff.ts

/**
 * Role-based access control for staff routes.
 * Must be placed AFTER authenticateStaff in the middleware chain.
 *
 * Queries role_assigment JOIN role and checks role.name
 * (column is `name`, not `role_name` — matches schema exactly).
 * Note: table name typo `role_assigment` is intentional — matches DB schema.
 *
 * Usage:
 *   router.delete('/products/:id', authenticateStaff, authorize('admin'), controller)
 *   router.get('/orders',          authenticateStaff, authorize('admin', 'staff'), controller)
 */
export const authorize = (...requiredRoles: string[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.staff?.staff_id) {
      return next(new ApiError(401, "Not authenticated as staff"));
    }

    try {
      const rows = await db("role_assigment as ra")
        .join("role as r", "r.role_id", "ra.role_id")
        .where("ra.staff_id", req.staff.staff_id)
        .select("r.name"); // role.name — not role_name

      const assignedRoles = rows.map((r: { name: string }) => r.name);
      const hasRole = requiredRoles.some((role) =>
        assignedRoles.includes(role),
      );

      if (!hasRole) {
        return next(
          new ApiError(
            403,
            `Access denied. Required role(s): ${requiredRoles.join(", ")}`,
          ),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
