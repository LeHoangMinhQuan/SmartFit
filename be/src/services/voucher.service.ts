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

/**
 * Powers the customer-facing "browse vouchers" list (checkout's
 * VoucherInput) — everything validateVoucher() would eventually accept or
 * reject for this order_amount, up front, instead of the customer having
 * to guess codes and try them one at a time.
 *
 * order_amount is optional: the list can be shown before the cart total
 * is known (e.g. an entry point outside checkout) — in that case every
 * voucher is just reported without eligible/discount_amount rather than
 * failing the whole request.
 */
export async function listAvailableVouchers(
  user_id: number,
  order_amount?: number,
) {
  const vouchers = await VoucherModel.findActiveVouchers();

  const results = await Promise.all(
    vouchers.map(async (voucher) => {
      const already_used = await VoucherModel.hasUserUsedVoucher(
        voucher.voucher_id!,
        user_id,
      );
      const eligible =
        order_amount == null ? null : order_amount >= voucher.min_amount;
      const discount_amount =
        order_amount != null && eligible
          ? VoucherModel.computeVoucherDiscount(voucher, order_amount)
          : null;

      return {
        voucher_id: voucher.voucher_id,
        code: voucher.code,
        description: voucher.description,
        type: voucher.type,
        value: voucher.value,
        max_discount: voucher.max_discount,
        min_amount: voucher.min_amount,
        end_date: voucher.end_date,
        already_used,
        eligible,
        discount_amount,
      };
    }),
  );

  // Best offers first: eligible-and-unused ahead of everything else, then
  // by discount size (falling back to raw value when order_amount wasn't
  // given, so the list still has a sensible order).
  return results.sort((a, b) => {
    const aUsable = a.eligible !== false && !a.already_used;
    const bUsable = b.eligible !== false && !b.already_used;
    if (aUsable !== bUsable) return aUsable ? -1 : 1;
    return (
      (b.discount_amount ?? Number(b.value)) -
      (a.discount_amount ?? Number(a.value))
    );
  });
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
  assignments: { product_id: number; variant_id: number }[],
) {
  const discount = await DiscountModel.findAllDiscounts().then((all) =>
    all.find((d: any) => d.discount_id === discount_id),
  );
  if (!discount) throw new ApiError(404, "Discount not found");
  await DiscountModel.assignDiscountToVariants(discount_id, assignments);
}

export async function deleteDiscount(discount_id: number) {
  await DiscountModel.deleteDiscount(discount_id);
}

export async function listDiscounts() {
  return DiscountModel.findAllDiscounts();
}
