import { Request, Response, NextFunction } from "express";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * catchAsync
 *
 * Wraps an async Express controller/middleware so any rejected promise
 * is forwarded to next() and caught by errorHandler.ts.
 *
 * Without this wrapper every controller would need its own try/catch.
 *
 * Usage:
 *   router.get('/products', catchAsync(productController.list))
 *   router.post('/orders',  authenticate, catchAsync(orderController.create))
 */
export const catchAsync = (fn: AsyncHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};
