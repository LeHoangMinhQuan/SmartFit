import { Knex } from "knex";

const PAYMENT_METHODS = ["VNPay", "COD"];

/**
 * payment_method_id is IDENTITY but payment_method_id is NOT NULL on "ORDER".
 * At least one row must exist before orders can be placed.
 */
export async function seed(knex: Knex): Promise<void> {
  for (const name of PAYMENT_METHODS) {
    const existing = await knex("payment_method")
      .whereRaw("LOWER(name) = LOWER(?)", [name])
      .first();
    if (!existing) {
      const [row] = await knex("payment_method")
        .insert({ name })
        .returning("payment_method_id");
      console.log(
        `Seeded payment method: ${name} (id=${row.payment_method_id})`,
      );
    }
  }
}
