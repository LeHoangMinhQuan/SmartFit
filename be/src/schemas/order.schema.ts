import { z } from "zod";

export const createOrderSchema = z.object({
  body: z.object({
    payment_method_id: z.number().int().positive(),
    shipping_address: z.string().min(1).max(70),
    ward_id: z.number().int().positive(),
    voucher_code: z.string().optional(),
  }),
});

export const orderParamsSchema = z.object({
  params: z.object({ order_id: z.coerce.number().int().positive() }),
});

export const listOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.string().optional(),
    user_id: z.coerce.number().int().positive().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({ order_id: z.coerce.number().int().positive() }),
  body: z.object({
    status: z.enum([
      "pending_payment",
      "paid",
      "preparing",
      "shipping",
      "delivered",
      "cancelled",
      "payment_failed",
      "refund_requested",
      "refunded",
    ]),
  }),
});
