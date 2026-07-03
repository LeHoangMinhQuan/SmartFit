import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError, ZodIssue } from "zod";
import { ApiError } from "../utils/ApiError.js";

/**
 * Shape every schema passed to `validate` must produce.
 * Keeps `body`/`params`/`query` optional since not every route validates all three.
 */
interface ParsedRequestShape {
  body?: unknown;
  params?: unknown;
  query?: unknown;
}

interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Zod v4 request validation middleware.
 * Validates { body, params, query } together against the given schema.
 * Replaces req.body/req.params/req.query with the parsed (coerced + stripped) data on success.
 * On failure, passes an ApiError(422) with field-level details to next().
 *
 * Usage:
 *   router.post('/products',    validate(createProductSchema), controller)
 *   router.get('/products',     validate(listProductsSchema),  controller)
 *   router.get('/products/:id', validate(productParamsSchema), controller)
 */
export const validate = <Output extends ParsedRequestShape, Input = Output>(
  schema: ZodType<Output, Input>,
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const zodError: ZodError = result.error;
      const details: ValidationErrorDetail[] = zodError.issues.map(
        (issue: ZodIssue): ValidationErrorDetail => ({
          field: issue.path.join("."),
          message: issue.message,
        }),
      );

      next(new ApiError(422, "Validation failed", details));
      return;
    }

    const requestData: Output = result.data;

    if (requestData.body !== undefined) {
      req.body = requestData.body;
    }

    if (requestData.params !== undefined) {
      Object.defineProperty(req, "params", {
        value: requestData.params,
        writable: true,
        configurable: true,
      });
    }

    if (requestData.query !== undefined) {
      Object.defineProperty(req, "query", {
        value: requestData.query,
        writable: true,
        configurable: true,
      });
    }

    next();
  };
};
