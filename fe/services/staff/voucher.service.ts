import api from "../../lib/axios";
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

export const voucherAdminService = {
  // ── Vouchers (promo codes) ──
  createVoucher: (body: CreateVoucherBody) =>
    api
      .post<{ voucher_id: number }>("/admin/vouchers", body)
      .then((r) => r.data),

  listVouchers: () =>
    api.get<Voucher[]>("/admin/vouchers").then((r) => r.data),

  updateVoucher: (voucher_id: number, body: Partial<CreateVoucherBody>) =>
    api
      .patch<Voucher>(`/admin/vouchers/${voucher_id}`, body)
      .then((r) => r.data),

  // ── Discounts (variant markdowns) ──
  createDiscount: (body: CreateDiscountBody) =>
    api
      .post<{ discount_id: number }>("/discounts", body)
      .then((r) => r.data),

  // Links a discount to a specific product variant via product_discount table
  assignDiscount: (
    discount_id: number,
    body: { product_id: number; variant_id: number },
  ) =>
    api
      .post(`/discounts/${discount_id}/products`, body)
      .then((r) => r.data),

  deleteDiscount: (discount_id: number) =>
    api.delete(`/discounts/${discount_id}`).then((r) => r.data),
};
