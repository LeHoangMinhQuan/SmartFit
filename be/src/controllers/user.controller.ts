import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as UserService from "../services/user.service.js";

// ─── Profile ──────────────────────────────────────────────────────────────────

export const getProfile = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  const profile = await UserService.getProfile(user_id);
  res.json({ data: profile });
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  const updated = await UserService.updateProfile(user_id, req.body);
  res.json({ data: updated });
});

export const changePassword = catchAsync(
  async (req: Request, res: Response) => {
    const user_id = (req as any).user.user_id;
    await UserService.changePassword(
      user_id,
      req.body.old_password,
      req.body.new_password,
    );
    res.json({ data: { message: "Password updated" } });
  },
);

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  await UserService.deleteAccount(user_id);
  res.status(204).send();
});

// ─── Addresses ────────────────────────────────────────────────────────────────

export const getAddresses = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  const addresses = await UserService.getAddresses(user_id);
  res.json({ data: addresses });
});

export const addAddress = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  const result = await UserService.addAddress(user_id, req.body);
  res.status(201).json({ data: result });
});

export const updateAddress = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  await UserService.updateAddress(
    user_id,
    Number(req.params.address_id),
    req.body,
  );
  res.json({ data: { message: "Address updated" } });
});

export const removeAddress = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  await UserService.removeAddress(user_id, Number(req.params.address_id));
  res.status(204).send();
});

export const setDefaultAddress = catchAsync(
  async (req: Request, res: Response) => {
    const user_id = (req as any).user.user_id;
    await UserService.setDefaultAddress(user_id, Number(req.params.address_id));
    res.json({ data: { message: "Default address updated" } });
  },
);

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export const getWishlist = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  const items = await UserService.getWishlist(user_id);
  res.json({ data: items });
});

export const addToWishlist = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  await UserService.addToWishlist(
    user_id,
    req.body.product_id,
    req.body.variant_id,
  );
  res.status(201).json({ data: { message: "Added to wishlist" } });
});

export const removeFromWishlist = catchAsync(
  async (req: Request, res: Response) => {
    const user_id = (req as any).user.user_id;
    await UserService.removeFromWishlist(
      user_id,
      Number(req.params.product_id),
      Number(req.params.variant_id),
    );
    res.status(204).send();
  },
);
