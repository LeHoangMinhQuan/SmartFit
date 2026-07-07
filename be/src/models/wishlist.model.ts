import db from "../config/db.js";

export interface WishlistItem {
  user_id: number;
  product_id: number;
  variant_id: number;
  created_at: Date;
  deleted_at: Date | null;
}

export interface WishlistItemWithProduct {
  product_id: number;
  variant_id: number;
  created_at: Date;
  product_name: string;
  variant_name: string;
}

/**
 * Active wishlist items for a user (deleted_at IS NULL), joined with product info.
 */
export async function findActiveWishlist(
  user_id: number,
): Promise<WishlistItemWithProduct[]> {
  return db("wishlist as w")
    .join("product as p", "w.product_id", "p.product_id")
    .join("product_variant as pv", function () {
      this.on("w.product_id", "pv.product_id").andOn(
        "w.variant_id",
        "pv.variant_id",
      );
    })
    .where("w.user_id", user_id)
    .whereNull("w.deleted_at")
    .select(
      "w.product_id",
      "w.variant_id",
      "w.created_at",
      "p.name as product_name",
      "pv.name as variant_name",
    );
}

export async function findWishlistItem(
  user_id: number,
  product_id: number,
  variant_id: number,
): Promise<WishlistItem | undefined> {
  return db("wishlist").where({ user_id, product_id, variant_id }).first();
}

export async function upsertWishlistItem(
  user_id: number,
  product_id: number,
  variant_id: number,
): Promise<void> {
  const existing = await findWishlistItem(user_id, product_id, variant_id);
  if (existing) {
    await db("wishlist")
      .where({ user_id, product_id, variant_id })
      .update({ deleted_at: null });
    return;
  }
  await db("wishlist").insert({ user_id, product_id, variant_id });
}

export async function softDeleteWishlistItem(
  user_id: number,
  product_id: number,
  variant_id: number,
): Promise<number> {
  return db("wishlist")
    .where({ user_id, product_id, variant_id })
    .update({ deleted_at: db.fn.now() });
}
