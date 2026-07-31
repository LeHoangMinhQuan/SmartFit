import { Knex } from "knex";

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
  // weight_grams/length_cm/width_cm/height_cm feed the real GHN shipping
  // fee/service calculation (see ghn.service.ts#getParcelForItems) —
  // folded-and-bagged packaging estimates per garment type, not exact
  // product specs. Deliberately varied (light shirts vs a boxed shoe) so
  // the auto-select flow actually exercises both GHN service tiers
  // ("Hàng nhẹ"/light vs "Hàng nặng"/heavy) instead of only ever hitting
  // one path.
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
      weight_grams: 250,
      length_cm: 30,
      width_cm: 25,
      height_cm: 3,
    },
    {
      name: "Striped Shirt",
      description: "Classic striped cotton shirt.",
      category_id: shirtsId,
      color: "White",
      size: "L",
      price: 349000,
      weight_grams: 260,
      length_cm: 30,
      width_cm: 25,
      height_cm: 3,
    },
    {
      name: "Formal White Shirt",
      description: "Slim-fit formal shirt.",
      category_id: shirtsId,
      color: "White",
      size: "M",
      price: 399000,
      isBrand: true,
      weight_grams: 280,
      length_cm: 32,
      width_cm: 26,
      height_cm: 3,
    },
    {
      name: "Slim Fit Jeans",
      description: "Stretch denim, slim cut.",
      category_id: pantsId,
      color: "Indigo",
      size: "32",
      price: 459000,
      isBrand: true,
      weight_grams: 600,
      length_cm: 35,
      width_cm: 28,
      height_cm: 4,
    },
    {
      name: "Chino Pants",
      description: "Everyday chino trousers.",
      category_id: pantsId,
      color: "Khaki",
      size: "32",
      price: 379000,
      weight_grams: 450,
      length_cm: 35,
      width_cm: 28,
      height_cm: 4,
    },
    {
      name: "Denim Jacket",
      description: "Classic denim jacket.",
      category_id: jacketsId,
      color: "Blue",
      size: "L",
      price: 599000,
      isBrand: true,
      weight_grams: 850,
      length_cm: 40,
      width_cm: 32,
      height_cm: 6,
    },
    {
      name: "Bomber Jacket",
      description: "Lightweight bomber jacket.",
      category_id: jacketsId,
      color: "Black",
      size: "M",
      price: 649000,
      isBrand: true,
      weight_grams: 700,
      length_cm: 38,
      width_cm: 30,
      height_cm: 6,
    },
    {
      name: "Windbreaker",
      description: "Water-resistant windbreaker.",
      category_id: jacketsId,
      color: "Green",
      size: "L",
      price: 529000,
      weight_grams: 400,
      length_cm: 36,
      width_cm: 28,
      height_cm: 4,
    },
    // New Arrivals Products
    {
      name: "Arrival T-Shirt",
      description: "Fresh out of the box new arrival.",
      category_id: newArrivalsId,
      color: "White",
      size: "L",
      price: 320000,
      weight_grams: 180,
      length_cm: 28,
      width_cm: 22,
      height_cm: 2,
    },
    {
      name: "Arrival Hoodie",
      description: "Latest autumn collection hoodie.",
      category_id: newArrivalsId,
      color: "Grey",
      size: "XL",
      price: 750000,
      weight_grams: 650,
      length_cm: 36,
      width_cm: 30,
      height_cm: 5,
    },
    // On Sale Products
    {
      name: "Discounted Hat",
      description: "Summer clearance item.",
      category_id: onSaleId,
      color: "Black",
      size: "OS",
      price: 150000,
      weight_grams: 120,
      length_cm: 25,
      width_cm: 20,
      height_cm: 12,
    },
    {
      name: "Sale Sneakers",
      description: "Last pair on sale.",
      category_id: onSaleId,
      color: "White",
      size: "42",
      price: 890000,
      // Boxed footwear: notably heavier/bulkier than the folded-garment
      // items above — this is the one most likely to tip a multi-item
      // cart from GHN's "light goods" service into "heavy goods".
      weight_grams: 1200,
      length_cm: 33,
      width_cm: 20,
      height_cm: 13,
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
