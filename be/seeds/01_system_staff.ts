import { Knex } from "knex";
import bcrypt from "bcryptjs";

/**
 * Seeds the system staff account (staff_id = 1).
 * This MUST exist before any order can be created, since "ORDER".staff_id NOT NULL
 * and customer orders use staff_id = 1 as the system account.
 *
 * Uses OVERRIDING SYSTEM VALUE because staff_id is GENERATED ALWAYS AS IDENTITY.
 * Followed by setval to keep the sequence ahead of seeded IDs.
 */
export async function seed(knex: Knex): Promise<void> {
  const existing = await knex("staff").where({ staff_id: 1 }).first();
  if (existing) {
    console.log("System staff (staff_id=1) already exists — skipping.");
    return;
  }

  const password_hash = await bcrypt.hash(
    "system_staff_password_change_me",
    12,
  );

  await knex.raw(
    `INSERT INTO staff (staff_id, name, password_hash)
     OVERRIDING SYSTEM VALUE
     VALUES (1, 'System', ?)`,
    [password_hash],
  );

  // Advance the sequence so the next auto-generated staff_id won't collide
  await knex.raw(
    `SELECT setval('staff_staff_id_seq', GREATEST((SELECT MAX(staff_id) FROM staff), 1))`,
  );

  console.log("Seeded system staff account (staff_id=1).");
}
