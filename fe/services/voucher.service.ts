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

/**
 * A row from GET /vouchers/available — everything needed to render a
 * "pick a voucher" list without the customer having to know a code first.
 * eligible/discount_amount are null when the list was fetched without an
 * order_amount (nothing to check eligibility against yet).
 */
export interface AvailableVoucher {
  voucher_id: number;
  code: string;
  description: string | null;
  type: "percent" | "fixed";
  value: number;
  max_discount: number;
  min_amount: number;
  end_date: string;
  already_used: boolean;
  eligible: boolean | null;
  discount_amount: number | null;
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

  // Lists all currently-active vouchers (not expired/future/exhausted),
  // sorted best-offer-first, with per-order eligibility and the already
  // -computed discount when order_amount is supplied.
  getAvailableVouchers: (order_amount?: number) =>
    api
      .get<{ data: AvailableVoucher[] }>("/vouchers/available", {
        params: order_amount != null ? { order_amount } : undefined,
      })
      .then((r) => r.data.data),
};
