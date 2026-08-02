import { Knex } from "knex";

const DEFAULT_ROLES = ["admin"];

// staff_id=1 is the System account seeded in 01_system_staff.ts, which
// runs before this file (alphabetical seed order) — safe to reference here.
const ADMIN_STAFF_ID = 1;

export async function seed(knex: Knex): Promise<void> {
  for (const name of DEFAULT_ROLES) {
    let role = await knex("role")
      .whereRaw("LOWER(name) = LOWER(?)", [name])
      .first();
    if (!role) {
      const [inserted] = await knex("role")
        .insert({ name })
        .returning(["role_id", "name"]);
      role = inserted;
      console.log(`Seeded role: ${name}`);
    }

    if (name === "admin") {
      const existingAssignment = await knex("role_assigment")
        .where({ staff_id: ADMIN_STAFF_ID, role_id: role.role_id })
        .first();
      if (!existingAssignment) {
        await knex("role_assigment").insert({
          staff_id: ADMIN_STAFF_ID,
          role_id: role.role_id,
        });
        console.log(
          `Assigned role '${name}' to staff_id=${ADMIN_STAFF_ID} (System).`,
        );
      }
    }
  }
}
