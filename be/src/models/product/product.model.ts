import db from "../../config/db.js";
import { DEFAULT_STORE_ID } from "../../config/store.js";

// ─── Product ────────────────────────────────────────────────────────────────

// Correlated-subquery SQL fragments for surfacing a product's cheapest
// currently-active discount on any list-style query (findAllProducts,
// findTopSellingProducts) without joining product_discount/discount
// directly into an already-GROUP-BY'd query — a direct join would
// multiply rows across variant×discount combinations before MIN()/MAX()
// ever runs. Both fragments must be selected together — discounted_price
// null implies discount_original_price is null too, and vice versa.
// Referenced only via p.product_id, so safe to reuse verbatim in any
// query that aliases the product table as "p".
const DISCOUNTED_PRICE_SQL = `(
  select pp2.base_price - case when d.voucher_type = 'percent'
    then pp2.base_price * d.voucher_value / 100
    else d.voucher_value
  end
  from product_discount pd2
  join discount d on d.discount_id = pd2.discount_id
  join product_price pp2
    on pp2.product_id = pd2.product_id and pp2.variant_id = pd2.variant_id
  where pd2.product_id = p.product_id
    and d.start_date <= now() and d.end_date >= now()
  order by (pp2.base_price - case when d.voucher_type = 'percent'
    then pp2.base_price * d.voucher_value / 100
    else d.voucher_value
  end) asc
  limit 1
) as discounted_price`;

const DISCOUNT_ORIGINAL_PRICE_SQL = `(
  select pp2.base_price
  from product_discount pd2
  join discount d on d.discount_id = pd2.discount_id
  join product_price pp2
    on pp2.product_id = pd2.product_id and pp2.variant_id = pd2.variant_id
  where pd2.product_id = p.product_id
    and d.start_date <= now() and d.end_date >= now()
  order by (pp2.base_price - case when d.voucher_type = 'percent'
    then pp2.base_price * d.voucher_value / 100
    else d.voucher_value
  end) asc
  limit 1
) as discount_original_price`;

export interface Product {
  product_id?: number;
  name: string;
  description: string;
  is_active?: boolean;
  // Used for real GHN fee/service calculation instead of a hardcoded
  // placeholder parcel (see services/ghn.service.ts#getParcelForItems).
  // Nullable — falls back to PLACEHOLDER_PARCEL per item when unset.
  weight_grams?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

export async function createProduct(
  data: Omit<Product, "product_id">,
): Promise<number> {
  const [row] = await db("product").insert(data).returning("product_id");
  return row.product_id;
}

/** All product_ids, unpaginated — used by the chatbot's reindexAll bulk job. */
export async function findAllProductIds(): Promise<number[]> {
  const rows = await db("product").select("product_id").orderBy("product_id");
  return rows.map((r: { product_id: number }) => r.product_id);
}

export async function findProductById(product_id: number) {
  return db("product").where({ product_id }).first();
}

export async function findCategoriesByProduct(product_id: number) {
  return db("category as c")
    .join("product_category as pc", "c.category_id", "pc.category_id")
    .where("pc.product_id", product_id)
    .select("c.category_id", "c.name", "c.parent_id");
}

export async function findAllProducts(filters: {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  category_id?: number;
  minPrice?: number;
  maxPrice?: number;
  attribute_id?: number;
}) {
  const {
    page = 1,
    limit = 20,
    sort = "p.product_id", // qualified: product_price/product_image also have product_id
    order = "asc",
    category_id,
    minPrice,
    maxPrice,
    attribute_id,
  } = filters;
  const offset = (page - 1) * limit;

  // Was previously `.select("p.*").distinct(...)` with no image/price join at
  // all, so the list endpoint always returned preview_image/min_price/
  // max_price as undefined — every card on any page using this endpoint
  // (landing page, category browse) silently had no image and no price.
  let query = db("product as p")
    .select(
      "p.product_id",
      "p.name",
      "p.description",
      "pi.s3_url as preview_image",
      db.raw("min(pp.base_price) as min_price"),
      db.raw("max(pp.base_price) as max_price"),
      // Discount surfacing (was previously entirely missing — list
      // endpoints always returned originalPrice=undefined/
      // discountActive=false hardcoded on the frontend, see
      // product.service.ts's toSummary).
      db.raw(DISCOUNTED_PRICE_SQL),
      db.raw(DISCOUNT_ORIGINAL_PRICE_SQL),
    )
    .leftJoin("product_image as pi", function () {
      this.on("p.product_id", "pi.product_id").andOnNull("pi.variant_id");
    })
    .leftJoin("product_price as pp", "p.product_id", "pp.product_id")
    .where("p.is_active", true);

  if (category_id) {
    query = query
      .join("product_category as pc", "p.product_id", "pc.product_id")
      .where("pc.category_id", category_id);
  }

  if (minPrice !== undefined)
    query = query.where("pp.base_price", ">=", minPrice);
  if (maxPrice !== undefined)
    query = query.where("pp.base_price", "<=", maxPrice);

  if (attribute_id) {
    query = query
      .join("product_attribute as pa", "p.product_id", "pa.product_id")
      .where("pa.attribute_id", attribute_id);
  }

  query = query
    .groupBy("p.product_id", "p.name", "p.description", "pi.s3_url")
    .orderBy(sort, order)
    .limit(limit)
    .offset(offset);

  const countQuery = db("product as p")
    .countDistinct("p.product_id as total")
    .where("p.is_active", true);
  if (category_id) {
    countQuery
      .join("product_category as pc", "p.product_id", "pc.product_id")
      .where("pc.category_id", category_id);
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    countQuery.join("product_price as pp", "p.product_id", "pp.product_id");
    if (minPrice !== undefined)
      countQuery.where("pp.base_price", ">=", minPrice);
    if (maxPrice !== undefined)
      countQuery.where("pp.base_price", "<=", maxPrice);
  }
  if (attribute_id) {
    countQuery
      .join("product_attribute as pa", "p.product_id", "pa.product_id")
      .where("pa.attribute_id", attribute_id);
  }

  const countResult = (await countQuery) as { total: string | number }[];
  const total = countResult[0]?.total ?? 0;
  const rows = await query;

  return { rows, total: Number(total) };
}

export async function findTopSellingProducts(limit = 8) {
  // Ranks by total units sold across all orders (any status — a thesis-demo
  // seed dataset is small enough that restricting to "paid" orders would
  // likely return too few rows to fill a carousel). Left join so products
  // with zero sales still have a defined (0) sold_count rather than being
  // excluded outright.
  return db("product as p")
    .select(
      "p.product_id",
      "p.name",
      "p.description",
      "pi.s3_url as preview_image",
      db.raw("min(pp.base_price) as min_price"),
      db.raw("max(pp.base_price) as max_price"),
      db.raw("coalesce(sum(oi.quantity), 0) as sold_count"),
      db.raw(DISCOUNTED_PRICE_SQL),
      db.raw(DISCOUNT_ORIGINAL_PRICE_SQL),
    )
    .leftJoin("product_image as pi", function () {
      this.on("p.product_id", "pi.product_id").andOnNull("pi.variant_id");
    })
    .leftJoin("product_price as pp", "p.product_id", "pp.product_id")
    .leftJoin("order_item as oi", "p.product_id", "oi.product_id")
    .where("p.is_active", true)
    .groupBy("p.product_id", "p.name", "p.description", "pi.s3_url")
    .orderBy("sold_count", "desc")
    .limit(limit);
}

export async function searchProducts(query: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const rows = await db("product")
    .whereILike("name", `%${query}%`)
    .andWhere("is_active", true)
    .limit(limit)
    .offset(offset);
  const countResult = (await db("product")
    .whereILike("name", `%${query}%`)
    .andWhere("is_active", true)
    .count("product_id as total")) as { total: string | number }[];
  const total = countResult[0]?.total ?? 0;
  return { rows, total: Number(total) };
}

export async function updateProduct(
  product_id: number,
  data: Partial<Omit<Product, "product_id">>,
) {
  return db("product").where({ product_id }).update(data);
}

/**
 * Deletes a product. Products that have ever appeared in an order_item are
 * protected by ON DELETE RESTRICT (order_item -> store_product -> product),
 * so a hard delete on those would throw a Postgres FK-violation (23503).
 * Rather than surface that as a 500 to staff, fall back to a soft delete
 * (is_active = false) — the product disappears from every customer-facing
 * listing but its order history stays intact.
 *
 * Returns which path was taken so the controller can report it.
 */
export async function deleteProduct(
  product_id: number,
): Promise<{ hard_deleted: boolean }> {
  try {
    await db("product").where({ product_id }).delete();
    return { hard_deleted: true };
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23503") {
      // Foreign key violation — this product (or one of its variants) is
      // referenced by existing order_item rows. Soft-delete instead.
      await db("product").where({ product_id }).update({ is_active: false });
      return { hard_deleted: false };
    }
    throw err;
  }
}

// ─── Product Variant ─────────────────────────────────────────────────────────

export interface ProductVariant {
  product_id: number;
  variant_id: number; // app-supplied, per-product counter
  name: string;
}

export async function createVariant(data: ProductVariant) {
  return db("product_variant").insert(data);
}

export async function findVariantsByProduct(product_id: number) {
  return db("product_variant as pv")
    .select(
      "pv.*",
      // Bug fix: this used to be json_agg(json_build_object(...)) with no
      // DISTINCT. Joining product_attribute AND product_image in the same
      // query multiplies rows — a variant with 2 attributes (e.g. size +
      // color, the normal case) and 1 image produces 2 joined rows, so
      // json_agg aggregated that one image twice (and would do the same
      // to attributes if it were 2 images x 1 attribute instead). jsonb
      // supports equality/ordering so DISTINCT actually dedupes here,
      // which plain `json` does not support.
      db.raw(
        "jsonb_agg(DISTINCT jsonb_build_object('attribute_id', pa.attribute_id, 'value', pa.value)) filter (where pa.attribute_id is not null) as attributes",
      ),
      // Variant-specific images. Was previously not joined at all, so
      // `variant.images` was always undefined on the API response (rather
      // than an empty array), which crashed the storefront when it did
      // `selected.images.length`. COALESCE with '[]' so the frontend
      // always gets an array, even with zero images uploaded.
      db.raw(
        "COALESCE(jsonb_agg(DISTINCT jsonb_build_object('image_id', pim.image_id, 'product_id', pim.product_id, 'variant_id', pim.variant_id, 's3_url', pim.s3_url)) filter (where pim.image_id is not null), '[]') as images",
      ),
      "pp.base_price",
      "pp.start_date",
      "pp.end_date",
      // Single-store scope (see config/store.ts + plan §12): the customer
      // only ever sees the one seeded store's quantity as 'stock'. Was
      // previously missing entirely, so every variant showed as out of
      // stock in the UI regardless of actual store_product rows.
      db.raw("COALESCE(sp.quantity, 0) as stock"),
      // Active discount for this variant, if any — same "currently
      // active" window as findActiveDiscountForVariant in
      // product_discount.model.ts (start_date <= now <= end_date), reused
      // here as an aggregate rather than a follow-up per-variant query.
      // jsonb_agg + DISTINCT (matching the attributes/images pattern
      // above) rather than json_build_object bare, in case a variant is
      // ever assigned more than one discount that happens to overlap in
      // time — picks one deterministically instead of erroring or
      // silently multiplying variant rows the way a plain join would.
      // `-> 0` unwraps the single-element array back to an object (or
      // null if the filter matched nothing).
      db.raw(
        `(jsonb_agg(DISTINCT jsonb_build_object(
            'discount_id', d.discount_id,
            'voucher_code', d.voucher_code,
            'voucher_type', d.voucher_type,
            'voucher_value', d.voucher_value,
            'start_date', d.start_date,
            'end_date', d.end_date
          )) filter (where d.discount_id is not null))[1] as discount`,
      ),
    )
    .leftJoin("product_attribute as pa", function () {
      this.on("pv.product_id", "pa.product_id").andOn(
        "pv.variant_id",
        "pa.variant_id",
      );
    })
    .leftJoin("product_image as pim", function () {
      this.on("pv.product_id", "pim.product_id").andOn(
        "pv.variant_id",
        "pim.variant_id",
      );
    })
    .leftJoin("product_price as pp", function () {
      this.on("pv.product_id", "pp.product_id").andOn(
        "pv.variant_id",
        "pp.variant_id",
      );
    })
    .leftJoin("store_product as sp", function () {
      this.on("pv.product_id", "sp.product_id")
        .andOn("pv.variant_id", "sp.variant_id")
        .andOnVal("sp.store_id", DEFAULT_STORE_ID);
    })
    .leftJoin("product_discount as pd", function () {
      this.on("pv.product_id", "pd.product_id").andOn(
        "pv.variant_id",
        "pd.variant_id",
      );
    })
    .leftJoin("discount as d", function () {
      // Active-window filter belongs in the JOIN condition, not a WHERE
      // clause — WHERE would silently turn this into an inner join and
      // drop every variant with no currently-active discount, the same
      // storefront regression this whole feature is meant to fix.
      // Raw comparisons rather than andOnVal's operator overload, since
      // every other andOnVal call in this codebase is equality-only —
      // using the less-common 3-arg form here would be inconsistent with
      // that convention and harder to be sure behaves as expected with
      // db.fn.now() as the compared value.
      this.on("pd.discount_id", "d.discount_id")
        .andOn(db.raw("d.start_date <= now()"))
        .andOn(db.raw("d.end_date >= now()"));
    })
    .where("pv.product_id", product_id)
    .groupBy(
      "pv.product_id",
      "pv.variant_id",
      "pp.base_price",
      "pp.start_date",
      "pp.end_date",
      "sp.quantity",
    );
}

export async function findVariant(product_id: number, variant_id: number) {
  return db("product_variant").where({ product_id, variant_id }).first();
}

export async function updateVariant(
  product_id: number,
  variant_id: number,
  data: Partial<Pick<ProductVariant, "name">>,
) {
  return db("product_variant").where({ product_id, variant_id }).update(data);
}

export async function deleteVariant(product_id: number, variant_id: number) {
  return db("product_variant").where({ product_id, variant_id }).delete();
}

export async function getNextVariantId(product_id: number): Promise<number> {
  const row = await db("product_variant")
    .where({ product_id })
    .max("variant_id as max")
    .first();
  return (row?.["max"] ?? 0) + 1;
}

// ─── Product Category ─────────────────────────────────────────────────────────

export async function setProductCategories(
  product_id: number,
  category_ids: number[],
) {
  await db("product_category").where({ product_id }).delete();
  if (category_ids.length) {
    await db("product_category").insert(
      category_ids.map((category_id) => ({ product_id, category_id })),
    );
  }
}

export async function findProductsByCategory(
  category_id: number,
  page = 1,
  limit = 20,
  minPrice?: number,
  maxPrice?: number,
  sort?: string,
) {
  const offset = (page - 1) * limit;
  let query = db("product as p")
    .select(
      "p.*",
      "pi.s3_url as preview_image",
      db.raw("min(pp.base_price) as min_price"),
      db.raw("max(pp.base_price) as max_price"),
    )
    .join("product_category as pc", "p.product_id", "pc.product_id")
    .leftJoin("product_image as pi", function () {
      this.on("p.product_id", "pi.product_id").andOnNull("pi.variant_id");
    })
    .leftJoin("product_price as pp", "p.product_id", "pp.product_id")
    .where("pc.category_id", category_id)
    .andWhere("p.is_active", true);

  if (minPrice !== undefined)
    query = query.where("pp.base_price", ">=", minPrice);
  if (maxPrice !== undefined)
    query = query.where("pp.base_price", "<=", maxPrice);

  query = query.groupBy("p.product_id", "pi.s3_url");

  // ProductFilters.tsx sends one of: price_asc | price_desc | newest | undefined.
  // NULLS LAST explicitly on both directions so products with no priced
  // variant sink to the bottom either way, instead of Postgres's default
  // (NULLS FIRST on DESC) surfacing them at the top of "Price: High → Low".
  switch (sort) {
    case "price_asc":
      query = query.orderByRaw("min_price ASC NULLS LAST");
      break;
    case "price_desc":
      query = query.orderByRaw("max_price DESC NULLS LAST");
      break;
    case "newest":
      query = query.orderBy("p.product_id", "desc");
      break;
    // no sort param: previous behavior (DB default order) — unchanged
  }

  query = query.limit(limit).offset(offset);

  // total must reflect the same price filter, or Pagination shows a total
  // that doesn't match what's actually returned. countDistinct — not a
  // plain count — because joining product_price fans out one row per
  // variant; a plain count would over-count any product with 2+ variants.
  let countQuery = db("product as p")
    .join("product_category as pc", "p.product_id", "pc.product_id")
    .where("pc.category_id", category_id)
    .andWhere("p.is_active", true);
  if (minPrice !== undefined || maxPrice !== undefined) {
    countQuery = countQuery.join(
      "product_price as pp",
      "p.product_id",
      "pp.product_id",
    );
    if (minPrice !== undefined)
      countQuery = countQuery.where("pp.base_price", ">=", minPrice);
    if (maxPrice !== undefined)
      countQuery = countQuery.where("pp.base_price", "<=", maxPrice);
  }
  const countResult = (await countQuery.countDistinct(
    "p.product_id as total",
  )) as { total: string | number }[];
  const total = countResult[0]?.total ?? 0;
  const rows = await query;
  return { rows, total: Number(total) };
}

// ─── Product Image ────────────────────────────────────────────────────────────

export async function insertProductImage(data: {
  product_id: number;
  variant_id?: number;
  s3_url: string;
}): Promise<number> {
  const [row] = await db("product_image").insert(data).returning("image_id");
  return row.image_id;
}

export async function insertProductImages(
  images: { product_id: number; variant_id?: number; s3_url: string }[],
): Promise<number[]> {
  const rows = await db("product_image").insert(images).returning("image_id");
  return rows.map((r: any) => r.image_id);
}

export async function findImagesByProduct(product_id: number) {
  // Only general/product-level images (variant_id IS NULL). Variant-specific
  // images are attached per-variant in findVariantsByProduct instead, so
  // they don't need to be returned here too.
  return db("product_image").where({ product_id }).whereNull("variant_id");
}

export async function deleteProductImage(image_id: number) {
  return db("product_image").where({ image_id }).delete();
}
