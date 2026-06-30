import db from "../../config/db.js";

export interface Discount {
  discount_id?: number;
  voucher_code: string;
  voucher_type: string;
  voucher_value: number;
  start_date: string;
  end_date: string;
}

export async function createDiscount(
  data: Omit<Discount, "discount_id">,
): Promise<number> {
  const [row] = await db("discount").insert(data).returning("discount_id");
  return row.discount_id;
}

export async function assignDiscountToVariant(
  discount_id: number,
  product_id: number,
  variant_id: number,
) {
  return db("product_discount")
    .insert({ discount_id, product_id, variant_id })
    .onConflict(["discount_id", "product_id", "variant_id"])
    .ignore();
}

export async function findActiveDiscountForVariant(
  product_id: number,
  variant_id: number,
) {
  const now = new Date().toISOString();
  return db("discount as d")
    .join("product_discount as pd", "d.discount_id", "pd.discount_id")
    .where("pd.product_id", product_id)
    .where("pd.variant_id", variant_id)
    .where("d.start_date", "<=", now)
    .where("d.end_date", ">=", now)
    .select("d.*")
    .first();
}

export async function deleteDiscount(discount_id: number) {
  return db("discount").where({ discount_id }).delete();
}

export async function findAllDiscounts() {
  return db("discount").select("*").orderBy("discount_id", "desc");
}
