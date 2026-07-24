import { Knex } from "knex";

/**
 * Seeds 2 demo stores. Must run before 06_demo_products.ts if you want
 * store_product inventory rows populated — that seed only writes inventory
 * when at least one store exists, and silently skips otherwise.
 *
 * store.address is VARCHAR(20) — keep addresses short.
 */
const STORES = [
  { name: "Downtown Store", address: "12 Le Loi, Q1" },
  { name: "Warehouse Store", address: "45 Tran Hung Dao" },
];

export async function seed(knex: Knex): Promise<void> {
  for (const s of STORES) {
    const existing = await knex("store")
      .whereRaw("LOWER(name) = LOWER(?)", [s.name])
      .first();
    if (existing) {
      console.log(`Store already exists: ${s.name} — skipping.`);
      continue;
    }

    const [row] = await knex("store")
      .insert({ name: s.name, address: s.address })
      .returning("store_id");
    console.log(`Seeded store: ${s.name} (store_id=${row.store_id})`);
  }
}
