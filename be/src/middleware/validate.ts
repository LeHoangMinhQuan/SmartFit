import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";

type ValidateTarget = "body" | "query" | "params";

/**
 * Zod v4 request validation middleware.
 * Replaces req[target] with the parsed (coerced + stripped) data on success.
 * On failure, passes an ApiError(422) with field-level details to next().
 *
 * Usage:
 *   router.post('/register',  validate(registerSchema),          controller)
 *   router.get('/products',   validate(productQuerySchema, 'query'), controller)
 *   router.get('/:product_id', validate(idParamSchema, 'params'),   controller)
 */
export const validate = (schema: ZodType, target: ValidateTarget = "body") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const details = (result.error as ZodError).issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(new ApiError(422, "Validation failed", details));
    }

    req[target] = result.data as (typeof req)[typeof target];
    next();
  };
};
