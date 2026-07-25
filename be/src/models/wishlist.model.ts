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
  base_price: string | null;
  image_url: string | null;
}

/**
 * Active wishlist items for a user (deleted_at IS NULL), joined with product
 * info, current price, and a preview image (variant-specific image
 * preferred, falling back to the general product-level image).
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
    .leftJoin("product_price as pp", function () {
      this.on("w.product_id", "pp.product_id").andOn(
        "w.variant_id",
        "pp.variant_id",
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
      "pp.base_price",
      db.raw(`(
        select pim.s3_url from product_image pim
        where pim.product_id = w.product_id
          and (pim.variant_id = w.variant_id or pim.variant_id is null)
        order by pim.variant_id nulls last
        limit 1
      ) as image_url`),
    )
    .orderBy("w.created_at", "desc");
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
