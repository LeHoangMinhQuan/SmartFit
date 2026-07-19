import db from "../config/db.js";

export async function findInventory(filters: {
  store_id?: number;
  min_quantity?: number;
  page?: number;
  limit?: number;
}) {
  const { store_id, min_quantity, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  let query = db("store_product as sp")
    .join("product as p", "sp.product_id", "p.product_id")
    .join("product_variant as pv", function () {
      this.on("sp.product_id", "pv.product_id").andOn(
        "sp.variant_id",
        "pv.variant_id",
      );
    })
    .join("store as s", "sp.store_id", "s.store_id")
    .select(
      "sp.*",
      "p.name as product_name",
      "pv.name as variant_name",
      "s.name as store_name",
    );

  if (store_id) query = query.where("sp.store_id", store_id);
  if (min_quantity !== undefined)
    query = query.where("sp.quantity", ">=", min_quantity);

  const rows = await query.limit(limit).offset(offset);
  let countQ = db("store_product");
  if (store_id) countQ = countQ.where({ store_id });
  const totalResult = await countQ.count("product_id as total");
  const total = totalResult[0]?.['total'] ?? 0;

  return { rows, total: Number(total) };
}

/**
 * Receive stock: increments existing quantity, or creates the row starting
 * at `quantity` if this (product_id, variant_id, store_id) has never had
 * stock before. Unlike upsertStoreProduct (which sets an absolute value —
 * used by manual "adjust quantity" corrections), this is always additive.
 */
export async function receiveStock(
  product_id: number,
  variant_id: number,
  store_id: number,
  quantity: number,
  trx = db,
) {
  return trx("store_product")
    .insert({ product_id, variant_id, store_id, quantity })
    .onConflict(["product_id", "variant_id", "store_id"])
    .merge({
      quantity: trx.raw("store_product.quantity + excluded.quantity"),
    });
}

export async function findStoreProduct(
  product_id: number,
  variant_id: number,
  store_id: number,
) {
  return db("store_product")
    .where({ product_id, variant_id, store_id })
    .first();
}

export async function upsertStoreProduct(
  product_id: number,
  variant_id: number,
  store_id: number,
  quantity: number,
) {
  return db("store_product")
    .insert({ product_id, variant_id, store_id, quantity })
    .onConflict(["product_id", "variant_id", "store_id"])
    .merge(["quantity"]);
}

export async function adjustStoreProductQuantity(
  product_id: number,
  variant_id: number,
  store_id: number,
  delta: number, // positive = add, negative = decrement
) {
  return db("store_product")
    .where({ product_id, variant_id, store_id })
    .increment("quantity", delta);
}

/**
 * Decrement stock for multiple items in a single transaction.
 * Throws if any item has insufficient stock.
 */
export async function decrementStockForOrder(
  items: { product_id: number; variant_id: number; quantity: number }[],
  store_id: number,
) {
  return db.transaction(async (trx) => {
    for (const item of items) {
      const row = await trx("store_product")
        .where({
          product_id: item.product_id,
          variant_id: item.variant_id,
          store_id,
        })
        .first();

      if (!row || row.quantity < item.quantity) {
        throw new Error(
          `Insufficient stock for product ${item.product_id} variant ${item.variant_id}`,
        );
      }

      await trx("store_product")
        .where({
          product_id: item.product_id,
          variant_id: item.variant_id,
          store_id,
        })
        .decrement("quantity", item.quantity);
    }
  });
}

export async function restoreStockForOrder(
  items: { product_id: number; variant_id: number; quantity: number }[],
  store_id: number,
) {
  return db.transaction(async (trx) => {
    for (const item of items) {
      await trx("store_product")
        .where({
          product_id: item.product_id,
          variant_id: item.variant_id,
          store_id,
        })
        .increment("quantity", item.quantity);
    }
  });
}

export async function findInventoryByStore(store_id: number) {
  return db("store_product as sp")
    .join("product as p", "sp.product_id", "p.product_id")
    .join("product_variant as pv", function () {
      this.on("sp.product_id", "pv.product_id").andOn(
        "sp.variant_id",
        "pv.variant_id",
      );
    })
    .where("sp.store_id", store_id)
    .select("sp.*", "p.name as product_name", "pv.name as variant_name");
}
