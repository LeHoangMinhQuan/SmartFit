import api from "../../lib/staffAxios";
import type { Voucher } from "../../interfaces";

// Vouchers — user-entered promo codes at checkout
interface CreateVoucherBody {
  code: string;
  type: "percent" | "fixed";
  value: number;
  max_discount: number;
  min_amount: number;
  start_date: string;
  end_date: string;
  usage_limit: number;
  description?: string;
}

// Discounts — admin-set variant-level markdowns (separate from vouchers)
interface CreateDiscountBody {
  voucher_code: string;
  voucher_type: string;
  voucher_value: number;
  start_date: string;
  end_date: string;
}

export interface Discount {
  discount_id: number;
  voucher_code: string;
  voucher_type: string;
  voucher_value: number;
  start_date: string;
  end_date: string;
}

export const voucherAdminService = {
  // ── Vouchers (promo codes) ──
  createVoucher: (body: CreateVoucherBody) =>
    api
      .post<{ voucher_id: number }>("/admin/vouchers", body)
      .then((r) => r.data),

  listVouchers: () =>
    api.get<{ data: Voucher[] }>("/admin/vouchers").then((r) => r.data.data),

  updateVoucher: (voucher_id: number, body: Partial<CreateVoucherBody>) =>
    api
      .patch<Voucher>(`/admin/vouchers/${voucher_id}`, body)
      .then((r) => r.data),

  // ── Discounts (variant markdowns) ──
  // BUG FIX: these three all called bare /discounts... with no /admin
  // prefix. Every discount route (admin.routes.ts) is mounted under
  // /api/admin — there's no bare /api/discounts — so every one of these
  // 404'd, surfaced to staff as a generic "Failed to create/assign
  // discount." toast with no indication it was a routing bug rather
  // than bad input.
  listDiscounts: () =>
    api.get<{ data: Discount[] }>("/admin/discounts").then((r) => r.data.data),

  createDiscount: (body: CreateDiscountBody) =>
    api
      .post<{ discount_id: number }>("/admin/discounts", body)
      .then((r) => r.data),

  // Links a discount to one or more product variants via product_discount
  // table. Always sends an array — even a single assignment is
  // assignments: [{...}] — matching the backend's one-shape contract
  // (schemas/voucher.schema.ts).
  assignDiscount: (
    discount_id: number,
    assignments: { product_id: number; variant_id: number }[],
  ) =>
    api
      .post(`/admin/discounts/${discount_id}/products`, { assignments })
      .then((r) => r.data),

  deleteDiscount: (discount_id: number) =>
    api.delete(`/admin/discounts/${discount_id}`).then((r) => r.data),
};
