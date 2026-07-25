import { Knex } from "knex";

/**
 * Seeds the single store for the current single-store scope (see
 * ecommerce-api-plan.md scope note + §12 "Future Work — Multi-Store
 * Expansion"): GHN only has one registered shop, so only one `store` row
 * should exist. `order.service.ts`'s DEFAULT_STORE_ID and everywhere else
 * that assumes "the" store assumes this is the only row.
 *
 * Must run before 06_demo_products.ts if you want store_product inventory
 * rows populated — that seed only writes inventory when at least one store
 * exists, and silently skips otherwise.
 *
 * store.address is VARCHAR(20) — keep addresses short.
 *
 * 🔮 Future work (multi-store): add more entries back to STORES once a
 * second GHN shop exists — see §12.
 */
const STORES = [{ name: "Main Store", address: "12 Le Loi, Q1" }];

export async function seed(knex: Knex): Promise<void> {
  const existingCount = await knex("store").count("* as count").first();
  if (existingCount && Number(existingCount["count"]) > 0) {
    console.log(
      `store table already has ${existingCount["count"]} row(s) — skipping seed. ` +
        `Single-store scope expects exactly 1; check for leftover multi-store seed data if this looks wrong.`,
    );
    return;
  }

  for (const s of STORES) {
    const [row] = await knex("store")
      .insert({ name: s.name, address: s.address })
      .returning("store_id");
    console.log(`Seeded store: ${s.name} (store_id=${row.store_id})`);
  }
}
