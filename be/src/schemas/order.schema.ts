import { z } from "zod";
import { VN_PHONE_REGEX, VN_PHONE_ERROR_MESSAGE } from "../utils/validators.js";

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
    recipient_phone: z.string().regex(VN_PHONE_REGEX, VN_PHONE_ERROR_MESSAGE),
    // BUG FIX: this field is still accepted from the client (so the
    // frontend's existing checkout payload shape doesn't need to change)
    // but is NO LONGER used for the actual charge — order.service.ts's
    // createOrder now recomputes the authoritative fee server-side via
    // GHN before computing total_amount, closing what used to be a
    // trust-client-input-for-a-monetary-amount gap (a customer could
    // previously submit shipping_fee: 0 and simply not pay for
    // delivery). Kept in the schema purely so existing clients don't
    // break; treat it as informational/display-only from here on.
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

export const assignOrderStaffSchema = z.object({
  params: z.object({ order_id: z.coerce.number().int().positive() }),
  body: z.object({
    staff_id: z.number().int().positive(),
  }),
});

// GHN's 3 allowed values for a shipment's "buyer can inspect goods"
// policy — see ghn.service.ts's createShipmentForOrder/
// updateShipmentRequiredNote comments.
const requiredNoteEnum = z.enum([
  "CHOTHUHANG",
  "CHOXEMHANGKHONGTHU",
  "KHONGCHOXEMHANG",
]);

export const retryShipmentSchema = z.object({
  params: z.object({ order_id: z.coerce.number().int().positive() }),
  // Optional — falls back to ghn.service.ts's DEFAULT_REQUIRED_NOTE if
  // staff doesn't pick one.
  body: z.object({
    required_note: requiredNoteEnum.optional(),
  }),
});

export const updateShipmentRequiredNoteSchema = z.object({
  params: z.object({ order_id: z.coerce.number().int().positive() }),
  body: z.object({
    required_note: requiredNoteEnum,
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
