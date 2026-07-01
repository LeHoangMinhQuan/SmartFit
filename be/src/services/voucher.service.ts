import { ApiError } from "../utils/ApiError.js";
import * as VoucherModel from "../models/voucher.model.js";
import * as DiscountModel from "../models/product/product_discount.model.js";

// ─── Vouchers (user-entered promo codes) ─────────────────────────────────────

export async function validateVoucher(code: string, order_amount: number) {
  const voucher = await VoucherModel.validateVoucher(code, order_amount);
  if (!voucher)
    throw new ApiError(
      400,
      "Voucher is invalid, expired, or minimum order amount not met",
    );

  const discount = VoucherModel.computeVoucherDiscount(voucher, order_amount);
  return {
    voucher_id: voucher.voucher_id,
    code: voucher.code,
    type: voucher.type,
    discount_amount: discount,
    description: voucher.description,
  };
}

export async function adminListVouchers(page?: number, limit?: number) {
  return VoucherModel.findAllVouchers(page, limit);
}

export async function adminCreateVoucher(
  data: Omit<
    typeof VoucherModel.createVoucher extends (d: infer D) => any ? D : never,
    never
  >,
) {
  const existing = await VoucherModel.findVoucherByCode((data as any).code);
  if (existing) throw new ApiError(409, "Voucher code already exists");
  const voucher_id = await VoucherModel.createVoucher(data as any);
  return { voucher_id };
}

export async function adminUpdateVoucher(voucher_id: number, data: any) {
  const existing = await VoucherModel.findVoucherById(voucher_id);
  if (!existing) throw new ApiError(404, "Voucher not found");
  await VoucherModel.updateVoucher(voucher_id, data);
}

// ─── Discounts (variant-level admin markdowns) ────────────────────────────────

export async function createDiscount(data: {
  voucher_code: string;
  voucher_type: string;
  voucher_value: number;
  start_date: string;
  end_date: string;
}) {
  const discount_id = await DiscountModel.createDiscount(data);
  return { discount_id };
}

export async function assignDiscount(
  discount_id: number,
  product_id: number,
  variant_id: number,
) {
  const discount = await DiscountModel.findAllDiscounts().then((all) =>
    all.find((d: any) => d.discount_id === discount_id),
  );
  if (!discount) throw new ApiError(404, "Discount not found");
  await DiscountModel.assignDiscountToVariant(
    discount_id,
    product_id,
    variant_id,
  );
}

export async function deleteDiscount(discount_id: number) {
  await DiscountModel.deleteDiscount(discount_id);
}

export async function listDiscounts() {
  return DiscountModel.findAllDiscounts();
}
