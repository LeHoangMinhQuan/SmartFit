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
  // Added alongside the price-display consistency pass — same shape as
  // product.model.ts's per-variant `discount` field, so the frontend can
  // reuse the same PriceDisplay component/calcDiscounted logic here as
  // everywhere else a product price shows. Previously not selected at
  // all, so the wishlist silently showed base price only even for
  // items currently on sale.
  discount: {
    discount_id: number;
    voucher_code: string;
    voucher_type: "percent" | "fixed";
    voucher_value: number;
    start_date: string;
    end_date: string;
  } | null;
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
      // Correlated subquery, same "currently active" window and
      // cheapest-first tiebreak as product.model.ts's DISCOUNTED_PRICE_SQL
      // — a plain JOIN here would risk multiplying rows if a variant ever
      // has more than one overlapping active discount, and this query has
      // no GROUP BY to collapse that the way the catalog list query does.
      db.raw(`(
        select jsonb_build_object(
          'discount_id', d.discount_id,
          'voucher_code', d.voucher_code,
          'voucher_type', d.voucher_type,
          'voucher_value', d.voucher_value,
          'start_date', d.start_date,
          'end_date', d.end_date
        )
        from product_discount pd2
        join discount d on d.discount_id = pd2.discount_id
        where pd2.product_id = w.product_id and pd2.variant_id = w.variant_id
          and d.start_date <= now() and d.end_date >= now()
        order by (pp.base_price - case when d.voucher_type = 'percent'
          then pp.base_price * d.voucher_value / 100
          else d.voucher_value
        end) asc
        limit 1
      ) as discount`),
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
