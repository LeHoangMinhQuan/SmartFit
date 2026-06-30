import db from "../config/db.js";

export interface Voucher {
  voucher_id?: number; // IDENTITY
  code: string; // VARCHAR(15)
  description?: string; // VARCHAR(30)
  type: "percent" | "fixed";
  value: number;
  max_discount: number;
  min_amount: number;
  start_date: string;
  end_date: string;
  usage_limit: number;
  usage_count?: number; // DEFAULT 0
}

export async function createVoucher(
  data: Omit<Voucher, "voucher_id" | "usage_count">,
): Promise<number> {
  const [row] = await db("voucher").insert(data).returning("voucher_id");
  return row.voucher_id;
}

export async function findVoucherByCode(code: string) {
  return db("voucher").whereRaw("LOWER(code) = LOWER(?)", [code]).first();
}

export async function findVoucherById(voucher_id: number) {
  return db("voucher").where({ voucher_id }).first();
}

export async function findAllVouchers(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const rows = await db("voucher")
    .select("*")
    .orderBy("voucher_id", "desc")
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db("voucher").count("voucher_id as total");
  return { rows, total: Number(total) };
}

export async function updateVoucher(
  voucher_id: number,
  data: Partial<Omit<Voucher, "voucher_id">>,
) {
  return db("voucher").where({ voucher_id }).update(data);
}

/**
 * Validate a voucher code is active and usable.
 * Returns the voucher row if valid, null otherwise.
 */
export async function validateVoucher(code: string, order_amount: number) {
  const voucher = await findVoucherByCode(code);
  if (!voucher) return null;

  const now = new Date();
  if (new Date(voucher.start_date) > now) return null;
  if (new Date(voucher.end_date) < now) return null;
  if (voucher.usage_count >= voucher.usage_limit) return null;
  if (order_amount < voucher.min_amount) return null;

  return voucher;
}

/**
 * Compute discount amount from voucher.
 */
export function computeVoucherDiscount(
  voucher: Voucher,
  order_amount: number,
): number {
  if (voucher.type === "fixed") {
    return Math.min(Number(voucher.value), order_amount);
  }
  // percent
  const discount = (Number(voucher.value) / 100) * order_amount;
  return Math.min(discount, Number(voucher.max_discount));
}

// ─── Voucher Usage ────────────────────────────────────────────────────────────

export async function recordVoucherUsage(
  voucher_id: number,
  order_id: number,
  user_id: number,
) {
  return db.transaction(async (trx) => {
    await trx("voucher_usage").insert({ voucher_id, order_id, user_id });
    await trx("voucher").where({ voucher_id }).increment("usage_count", 1);
  });
}

export async function hasUserUsedVoucher(voucher_id: number, user_id: number) {
  const row = await db("voucher_usage").where({ voucher_id, user_id }).first();
  return !!row;
}
