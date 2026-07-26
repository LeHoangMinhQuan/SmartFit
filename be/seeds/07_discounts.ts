import { Knex } from "knex";

/**
 * Seeds 2 variant-level markdowns (`discount` + `product_discount`) on demo
 * products from 06_demo_products.ts, so the discount-badge / originalPrice
 * UI has real data to render against.
 *
 * ASSUMPTION: voucher_type follows the same 'percent' | 'fixed' convention
 * as the voucher table, since discount.voucher_type is just VARCHAR(15)
 * with no CHECK constraint in the schema — nothing enforces this. If your
 * PriceDisplay component or discount service expects different string
 * values, adjust DISCOUNTS below accordingly.
 *
 * Depends on 06_demo_products.ts having run first (looks up product_id by
 * name). Idempotent: skips a discount if a voucher_code already exists,
 * on the assumption it was seeded (and linked) by a prior run of this file.
 */
const DISCOUNTS = [
  {
    productName: "Demo Shirt",
    variant_id: 1,
    voucher_code: "DEMO10",
    voucher_type: "percent",
    voucher_value: 10,
  },
  {
    productName: "Striped Shirt",
    variant_id: 1,
    voucher_code: "DEMO50K",
    voucher_type: "fixed",
    voucher_value: 50000,
  },
  // These two are the actual products seeded under the "On Sale" category
  // in 06_demo_products.ts — without a real discount row, that page would
  // show products with the "on sale" label but no actual markdown.
  {
    productName: "Discounted Hat",
    variant_id: 1,
    voucher_code: "DEMOHAT20",
    voucher_type: "percent",
    voucher_value: 20,
  },
  {
    productName: "Sale Sneakers",
    variant_id: 1,
    voucher_code: "DEMOSNEAK100K",
    voucher_type: "fixed",
    voucher_value: 100000,
  },
];

export async function seed(knex: Knex): Promise<void> {
  const start_date = new Date("2025-01-01").toISOString();
  const end_date = new Date("2027-12-31").toISOString();

  for (const d of DISCOUNTS) {
    const existingDiscount = await knex("discount")
      .whereRaw("LOWER(voucher_code) = LOWER(?)", [d.voucher_code])
      .first();
    if (existingDiscount) {
      console.log(`Discount already seeded: ${d.voucher_code} — skipping.`);
      continue;
    }

    const product = await knex("product")
      .whereRaw("LOWER(name) = LOWER(?)", [d.productName])
      .first();
    if (!product) {
      console.warn(
        `Product "${d.productName}" not found — run 06_demo_products.ts first. Skipping ${d.voucher_code}.`,
      );
      continue;
    }

    const [discountRow] = await knex("discount")
      .insert({
        voucher_code: d.voucher_code,
        voucher_type: d.voucher_type,
        voucher_value: d.voucher_value,
        start_date,
        end_date,
      })
      .returning("discount_id");

    await knex("product_discount").insert({
      discount_id: discountRow.discount_id,
      product_id: product.product_id,
      variant_id: d.variant_id,
    });

    console.log(
      `Seeded discount ${d.voucher_code} (${d.voucher_type} ${d.voucher_value}) on "${d.productName}" variant ${d.variant_id}.`,
    );
  }
}
