import { Knex } from "knex";

/**
 * Seeds sample checkout-level vouchers (distinct from the variant-level
 * `discount` table seeded in 07_discounts.ts). Populates enough variety
 * to exercise both voucher types and the max_discount cap on checkout.
 *
 * Updated to align with the case-insensitive (CI) idempotency checks
 * introduced in 06_demo_products.ts and 07_discounts.ts.
 */
const VOUCHERS = [
  {
    code: "WELCOME10",
    description: "10% off, new customers",
    type: "percent",
    value: 10,
    max_discount: 50000,
    min_amount: 200000,
    usage_limit: 1000,
  },
  {
    code: "FREESHIP30K",
    description: "Flat 30,000₫ off shipping",
    type: "fixed",
    value: 30000,
    max_discount: 30000,
    min_amount: 0,
    usage_limit: 500,
  },
  {
    code: "SUMMER50K",
    description: "50,000₫ off summer sale",
    type: "fixed",
    value: 50000,
    max_discount: 50000,
    min_amount: 300000,
    usage_limit: 200,
  },
];

export async function seed(knex: Knex): Promise<void> {
  const start_date = new Date("2025-01-01").toISOString();
  const end_date = new Date("2027-12-31").toISOString();

  for (const v of VOUCHERS) {
    // Case-insensitive check to match the robust CI patterns from seeds 06 and 07
    const existing = await knex("voucher")
      .whereRaw("LOWER(code) = LOWER(?)", [v.code])
      .first();

    if (existing) {
      console.log(`Voucher already seeded: ${v.code} — skipping.`);
      continue;
    }

    await knex("voucher").insert({
      code: v.code,
      description: v.description,
      type: v.type,
      value: v.value,
      max_discount: v.max_discount,
      min_amount: v.min_amount,
      start_date,
      end_date,
      usage_limit: v.usage_limit,
      usage_count: 0,
    });

    console.log(`Seeded voucher: ${v.code} (${v.type} ${v.value})`);
  }
}
