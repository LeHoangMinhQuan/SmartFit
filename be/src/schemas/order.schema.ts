import { z } from "zod";

export const createOrderSchema = z.object({
  body: z.object({
    payment_method_id: z.number().int().positive(),
    shipping_address: z.string().min(1).max(255),
    ward_id: z.number().int().positive(),
    // Required so GHN shipment creation (createShipmentForOrder) always has
    // a deliverable contact number. This is the ORDER-side snapshot of the
    // chosen address's required phone (see address.phone / AddressForm —
    // that's the actual collection gate); the frontend copies it in here
    // at order placement, same as it already builds shipping_address from
    // the chosen address.
    recipient_phone: z
      .string()
      .length(10)
      .regex(/^\d+$/, "Phone must be digits only"),
    // Bug fix: total_amount previously excluded this entirely — every
    // VNPay charge silently undercharged by the delivery fee. Trusting
    // client input for a monetary amount is a known gap (see order.service.ts
    // createOrder comment) rather than recomputing server-side via GHN,
    // since that needs package weight data this schema doesn't currently
    // track — flagged as a follow-up, not solved here.
    shipping_fee: z.number().min(0).default(0),
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
      "cod_confirmed",
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
