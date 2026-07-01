import { z } from "zod";

export const validateVoucherSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(15),
    order_amount: z.number().positive(),
  }),
});

export const createVoucherSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(15),
    type: z.enum(["percent", "fixed"]),
    value: z.number().positive(),
    max_discount: z.number().nonnegative(),
    min_amount: z.number().nonnegative(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    usage_limit: z.number().int().positive(),
    description: z.string().max(30).optional(),
  }),
});

export const updateVoucherSchema = z.object({
  params: z.object({ voucher_id: z.coerce.number().int().positive() }),
  body: z.object({
    type: z.enum(["percent", "fixed"]).optional(),
    value: z.number().positive().optional(),
    max_discount: z.number().nonnegative().optional(),
    min_amount: z.number().nonnegative().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    usage_limit: z.number().int().positive().optional(),
    description: z.string().max(30).optional(),
  }),
});

export const createDiscountSchema = z.object({
  body: z.object({
    voucher_code: z.string().min(1).max(15),
    voucher_type: z.string().min(1).max(15),
    voucher_value: z.number().positive(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  }),
});

export const assignDiscountSchema = z.object({
  params: z.object({ discount_id: z.coerce.number().int().positive() }),
  body: z.object({
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive(),
  }),
});
