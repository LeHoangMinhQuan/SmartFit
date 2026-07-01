import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as CartService from "../services/cart.service.js";

export const getCart = catchAsync(async (req: Request, res: Response) => {
  const cart = await CartService.getCart((req as any).user.user_id);
  res.json({ data: cart });
});

export const addItem = catchAsync(async (req: Request, res: Response) => {
  const { product_id, variant_id, quantity } = req.body;
  const cart = await CartService.addItem(
    (req as any).user.user_id,
    product_id,
    variant_id,
    quantity,
  );
  res.status(201).json({ data: cart });
});

export const updateItem = catchAsync(async (req: Request, res: Response) => {
  const { product_id, variant_id, quantity } = req.body;
  const cart = await CartService.updateItem(
    (req as any).user.user_id,
    product_id,
    variant_id,
    quantity,
  );
  res.json({ data: cart });
});

export const removeItem = catchAsync(async (req: Request, res: Response) => {
  const { product_id, variant_id } = req.body;
  const cart = await CartService.removeItem(
    (req as any).user.user_id,
    product_id,
    variant_id,
  );
  res.json({ data: cart });
});

export const clearCart = catchAsync(async (req: Request, res: Response) => {
  await CartService.clearCart((req as any).user.user_id);
  res.status(204).send();
});

export const mergeCart = catchAsync(async (req: Request, res: Response) => {
  const cart = await CartService.mergeCart(
    (req as any).user.user_id,
    req.body.items,
  );
  res.json({ data: cart });
});
