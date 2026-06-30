import db from "../../config/db.js";

export interface PriceData {
  product_id: number;
  variant_id: number;
  base_price: number;
  start_date: string;
  end_date: string;
}

/**
 * Ensure a price_history row exists for the given period, then upsert product_price.
 * product_price PK is (product_id, variant_id) — one row per variant at any time.
 */
export async function upsertProductPrice(data: PriceData) {
  return db.transaction(async (trx) => {
    // Ensure price_history period row exists
    await trx("price_history")
      .insert({ start_date: data.start_date, end_date: data.end_date })
      .onConflict(["start_date", "end_date"])
      .ignore();

    // Upsert product_price (one row per variant)
    await trx("product_price")
      .insert({
        product_id: data.product_id,
        variant_id: data.variant_id,
        base_price: data.base_price,
        start_date: data.start_date,
        end_date: data.end_date,
      })
      .onConflict(["product_id", "variant_id"])
      .merge(["base_price", "start_date", "end_date"]);
  });
}

export async function findPriceByVariant(
  product_id: number,
  variant_id: number,
) {
  return db("product_price").where({ product_id, variant_id }).first();
}

export async function findPricesByProduct(product_id: number) {
  return db("product_price").where({ product_id });
}
