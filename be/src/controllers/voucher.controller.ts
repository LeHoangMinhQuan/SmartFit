import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as VoucherService from "../services/voucher.service.js";

// ─── Customer ─────────────────────────────────────────────────────────────────

export const validateVoucher = catchAsync(
  async (req: Request, res: Response) => {
    const result = await VoucherService.validateVoucher(
      req.body.code,
      req.body.order_amount,
    );
    res.json({ data: result });
  },
);

// ─── Admin — Vouchers ─────────────────────────────────────────────────────────

export const adminListVouchers = catchAsync(
  async (req: Request, res: Response) => {
    const { page, limit } = req.query as any;
    const result = await VoucherService.adminListVouchers(page, limit);
    res.json({ data: result.rows, meta: { total: result.total } });
  },
);

export const adminCreateVoucher = catchAsync(
  async (req: Request, res: Response) => {
    const result = await VoucherService.adminCreateVoucher(req.body);
    res.status(201).json({ data: result });
  },
);

export const adminUpdateVoucher = catchAsync(
  async (req: Request, res: Response) => {
    await VoucherService.adminUpdateVoucher(
      Number(req.params['voucher_id']),
      req.body,
    );
    res.json({ data: { message: "Voucher updated" } });
  },
);

// ─── Admin — Discounts ────────────────────────────────────────────────────────

export const listDiscounts = catchAsync(
  async (_req: Request, res: Response) => {
    const discounts = await VoucherService.listDiscounts();
    res.json({ data: discounts });
  },
);

export const createDiscount = catchAsync(
  async (req: Request, res: Response) => {
    const result = await VoucherService.createDiscount(req.body);
    res.status(201).json({ data: result });
  },
);

export const assignDiscount = catchAsync(
  async (req: Request, res: Response) => {
    await VoucherService.assignDiscount(
      Number(req.params['discount_id']),
      req.body.product_id,
      req.body.variant_id,
    );
    res.status(201).json({ data: { message: "Discount assigned" } });
  },
);

export const deleteDiscount = catchAsync(
  async (req: Request, res: Response) => {
    await VoucherService.deleteDiscount(Number(req.params['discount_id']));
    res.status(204).send();
  },
);
