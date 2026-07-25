import api from "../lib/axios";

/**
 * Response shape of POST /vouchers/validate — the backend already
 * computes the discount server-side, so this is intentionally a smaller,
 * separate interface from the full DB-row `Voucher` type (used elsewhere,
 * e.g. staff voucher CRUD) rather than reusing it. The validate endpoint
 * never returns `value`/`max_discount` — recomputing the discount
 * client-side from those (which don't exist on this response) was the
 * bug; consume `discount_amount` directly instead.
 */
export interface VoucherValidationResult {
  voucher_id: number;
  code: string;
  type: "percent" | "fixed";
  discount_amount: number;
  description: string;
}

export const voucherService = {
  // Validates code eligibility (dates, usage limit, min amount) and
  // returns the pre-computed discount for this order. `order_amount` is
  // required — the backend needs it for the minimum-order-amount check
  // and to compute discount_amount; omitting it always fails validation.
  validateVoucher: (code: string, order_amount: number) =>
    api
      .post<{ data: VoucherValidationResult }>("/vouchers/validate", {
        code,
        order_amount,
      })
      .then((r) => r.data.data),
};
