import { Knex } from "knex";

/**
 * Optional demo seed for local development.
 * Creates 5 top-level categories (4 featured, for the landing page's
 * "Browse By Category" section) plus 1 nested category, and 12 demo products
 * spread across them with variants, attributes, prices, and inventory — so
 * cart/order/category-browsing/homepage flows can all be exercised without
 * manual setup.
 *
 * Safe to re-run: guards on both the demo product name and (since
 * category.name is now case-insensitively unique — category_name_unique_ci)
 * on each category/attribute name individually, rather than bailing out
 * entirely on a single check.
 *
 * NOTE: store_product inserts are skipped if no store row exists yet.
 * None of the seed files 01–06 create a store — if you need inventory
 * populated, seed a store first (not included here since it wasn't part
 * of the provided seed set).
 */
export async function seed(knex: Knex): Promise<void> {
  const existing = await knex("product")
    .whereRaw("LOWER(name) = 'demo shirt'")
    .first();
  if (existing) {
    console.log("Demo data already seeded — skipping.");
    return;
  }

  async function getOrCreateCategory(
    name: string,
    parent_id: number | null,
    opts: {
      is_featured?: boolean;
      display_order?: number;
      image_url?: string;
    } = {},
  ): Promise<number> {
    const found = await knex("category")
      .whereRaw("LOWER(name) = LOWER(?)", [name])
      .first();
    if (found) return found.category_id;

    const [row] = await knex("category")
      .insert({ name, parent_id, ...opts })
      .returning("category_id");
    return row.category_id;
  }

  async function getOrCreateAttribute(name: string): Promise<number> {
    const found = await knex("attribute")
      .whereRaw("LOWER(name) = LOWER(?)", [name])
      .first();
    if (found) return found.attribute_id;
    const [row] = await knex("attribute")
      .insert({ name })
      .returning("attribute_id");
    return row.attribute_id;
  }

  // ── Categories ──────────────────────────────────────────────────────────
  const shirtsId = await getOrCreateCategory("Shirts", null, {
    is_featured: true,
    display_order: 1,
    image_url:
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800",
  });
  const pantsId = await getOrCreateCategory("Pants", null, {
    is_featured: true,
    display_order: 2,
    image_url:
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800",
  });
  const newArrivalsId = await getOrCreateCategory("New Arrivals", null, {
    is_featured: true,
    display_order: 3,
    image_url:
      "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=800",
  });
  const onSaleId = await getOrCreateCategory("On Sale", null, {
    is_featured: true,
    display_order: 4,
    image_url:
      "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800",
  });
  const jacketsId = await getOrCreateCategory("Jackets", null); // not featured — exercises the "unfeatured category" path
  await getOrCreateCategory("Formal", shirtsId); // nested under Shirts — exercises tree depth, no products assigned

  // "All" and "Brands" back the Header's nav links (/category/all,
  // /category/brands). Neither is a real catalog concept: "All" is just
  // "every product" (here hand-tagged onto every seeded product below,
  // which only works because this is a closed, finite demo dataset — any
  // product added later without this tag won't show up under "All"), and
  // "Brands" doesn't correspond to any real entity in the schema (there's
  // no brand/manufacturer table) — it's a curated subset for demo purposes
  // only. Not featured, so they don't appear as extra tiles in the
  // landing page's "Browse By Category" grid.
  const allId = await getOrCreateCategory("All", null, { is_featured: false });
  const brandsId = await getOrCreateCategory("Brands", null, {
    is_featured: false,
  });

  // ── Attributes ──────────────────────────────────────────────────────────
  const colorAttr = await getOrCreateAttribute("Color");
  const sizeAttr = await getOrCreateAttribute("Size");

  // ── Products (name ≤ 20 chars, description ≤ 100 chars) ───────────────────
  const start_date = new Date("2025-01-01").toISOString();
  const end_date = new Date("2027-12-31").toISOString();
  await knex("price_history")
    .insert({ start_date, end_date })
    .onConflict(["start_date", "end_date"])
    .ignore();

  const products = [
    {
      name: "Demo Shirt",
      description: "A sample product for testing.",
      category_id: shirtsId,
      color: "Blue",
      size: "M",
      price: 299000,
    },
    {
      name: "Striped Shirt",
      description: "Classic striped cotton shirt.",
      category_id: shirtsId,
      color: "White",
      size: "L",
      price: 349000,
    },
    {
      name: "Formal White Shirt",
      description: "Slim-fit formal shirt.",
      category_id: shirtsId,
      color: "White",
      size: "M",
      price: 399000,
      isBrand: true,
    },
    {
      name: "Slim Fit Jeans",
      description: "Stretch denim, slim cut.",
      category_id: pantsId,
      color: "Indigo",
      size: "32",
      price: 459000,
      isBrand: true,
    },
    {
      name: "Chino Pants",
      description: "Everyday chino trousers.",
      category_id: pantsId,
      color: "Khaki",
      size: "32",
      price: 379000,
    },
    {
      name: "Denim Jacket",
      description: "Classic denim jacket.",
      category_id: jacketsId,
      color: "Blue",
      size: "L",
      price: 599000,
      isBrand: true,
    },
    {
      name: "Bomber Jacket",
      description: "Lightweight bomber jacket.",
      category_id: jacketsId,
      color: "Black",
      size: "M",
      price: 649000,
      isBrand: true,
    },
    {
      name: "Windbreaker",
      description: "Water-resistant windbreaker.",
      category_id: jacketsId,
      color: "Green",
      size: "L",
      price: 529000,
    },
    // New Arrivals Products
    {
      name: "Arrival T-Shirt",
      description: "Fresh out of the box new arrival.",
      category_id: newArrivalsId,
      color: "White",
      size: "L",
      price: 320000,
    },
    {
      name: "Arrival Hoodie",
      description: "Latest autumn collection hoodie.",
      category_id: newArrivalsId,
      color: "Grey",
      size: "XL",
      price: 750000,
    },
    // On Sale Products
    {
      name: "Discounted Hat",
      description: "Summer clearance item.",
      category_id: onSaleId,
      color: "Black",
      size: "OS",
      price: 150000,
    },
    {
      name: "Sale Sneakers",
      description: "Last pair on sale.",
      category_id: onSaleId,
      color: "White",
      size: "42",
      price: 890000,
    },
  ];

  const store = await knex("store").first();

  for (const p of products) {
    const [prodRow] = await knex("product")
      .insert({ name: p.name, description: p.description })
      .returning("product_id");
    const product_id: number = prodRow.product_id;

    const category_ids = [p.category_id, allId];
    if (p.isBrand) category_ids.push(brandsId);
    await knex("product_category").insert(
      category_ids.map((category_id) => ({ product_id, category_id })),
    );

    await knex("product_variant").insert({
      product_id,
      variant_id: 1,
      is_primary: true, // only variant for this demo product
      name: `${p.color} / ${p.size}`,
    });

    await knex("product_attribute").insert([
      { attribute_id: colorAttr, product_id, variant_id: 1, value: p.color },
      { attribute_id: sizeAttr, product_id, variant_id: 1, value: p.size },
    ]);

    await knex("product_price").insert({
      product_id,
      variant_id: 1,
      base_price: p.price,
      start_date,
      end_date,
    });

    if (store) {
      await knex("store_product")
        .insert({
          product_id,
          variant_id: 1,
          store_id: store.store_id,
          quantity: 100,
        })
        .onConflict(["product_id", "variant_id", "store_id"])
        .ignore();
    }
  }

  if (!store) {
    console.warn(
      "No store found — skipped store_product inventory rows. Seed a store first if you need stock data.",
    );
  }

  console.log(
    `Seeded 7 categories (4 featured) + 1 nested category, and ${products.length} demo products.`,
  );
}
