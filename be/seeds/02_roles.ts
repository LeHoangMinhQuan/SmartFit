import { Knex } from "knex";

const DEFAULT_ROLES = ["admin", "warehouse", "sales"];

export async function seed(knex: Knex): Promise<void> {
  for (const name of DEFAULT_ROLES) {
    const existing = await knex("role")
      .whereRaw("LOWER(name) = LOWER(?)", [name])
      .first();
    if (!existing) {
      await knex("role").insert({ name });
      console.log(`Seeded role: ${name}`);
    }
  }
}
