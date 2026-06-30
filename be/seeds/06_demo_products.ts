import { Knex } from "knex";

/**
 * Optional demo seed for local development.
 * Creates a sample category, product, variant, and price so the
 * cart/order flows can be tested without manual setup.
 */
export async function seed(knex: Knex): Promise<void> {
  const existing = await knex("product")
    .whereRaw("LOWER(name) = 'demo shirt'")
    .first();
  if (existing) {
    console.log("Demo products already seeded — skipping.");
    return;
  }

  // Category
  const [catRow] = await knex("category")
    .insert({ name: "Shirts", parent_id: null })
    .returning("category_id");
  const category_id: number = catRow.category_id;

  // Product (name ≤ 20, description ≤ 100)
  const [prodRow] = await knex("product")
    .insert({
      name: "Demo Shirt",
      description: "A sample product for testing.",
    })
    .returning("product_id");
  const product_id: number = prodRow.product_id;

  // product_category
  await knex("product_category").insert({ product_id, category_id });

  // Variant (variant_id app-supplied, starting at 1)
  await knex("product_variant").insert({
    product_id,
    variant_id: 1,
    name: "Blue / M",
  });

  // Attribute catalog entry
  const [colorAttr] = await knex("attribute")
    .insert({ name: "Color" })
    .returning("attribute_id");
  const [sizeAttr] = await knex("attribute")
    .insert({ name: "Size" })
    .returning("attribute_id");

  // Attach attributes to variant
  await knex("product_attribute").insert([
    {
      attribute_id: colorAttr.attribute_id,
      product_id,
      variant_id: 1,
      value: "Blue",
    },
    {
      attribute_id: sizeAttr.attribute_id,
      product_id,
      variant_id: 1,
      value: "M",
    },
  ]);

  // Price: one row per variant (upsert not needed here, it's fresh)
  const start_date = new Date("2025-01-01").toISOString();
  const end_date = new Date("2027-12-31").toISOString();
  await knex("price_history")
    .insert({ start_date, end_date })
    .onConflict(["start_date", "end_date"])
    .ignore();
  await knex("product_price").insert({
    product_id,
    variant_id: 1,
    base_price: 299000,
    start_date,
    end_date,
  });

  // Inventory: assign to store 1 if it exists
  const store = await knex("store").first();
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

  console.log(`Demo product seeded: "Demo Shirt" (product_id=${product_id})`);
}
