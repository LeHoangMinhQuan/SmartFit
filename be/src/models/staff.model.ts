import db from "../config/db.js";

// SYSTEM_STAFF_ID (duplicated rather than imported — same convention
// order.model.ts/order.service.ts already use for this constant, to avoid
// a circular import between model/service layers) — staff_id=1, the
// placeholder "System" account every order starts on. Must never be
// offered as an assignment target, since selecting it would just write
// the order's staff_id back to the exact value that means "unclaimed".
const SYSTEM_STAFF_ID = 1;

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface Staff {
  staff_id?: number; // IDENTITY
  name: string; // VARCHAR(30)
  birth_date?: string;
  start_time?: string;
  password_hash: string;
}

export async function createStaff(
  data: Omit<Staff, "staff_id">,
): Promise<number> {
  const [row] = await db("staff").insert(data).returning("staff_id");
  return row.staff_id;
}

export async function findStaffById(staff_id: number) {
  return db("staff").where({ staff_id }).first();
}

export async function findAllStaff(
  page = 1,
  limit = 20,
  excludeSystem = false,
) {
  const offset = (page - 1) * limit;
  let query = db("staff").select(
    "staff_id",
    "name",
    "birth_date",
    "start_time",
  );
  let countQuery = db("staff").count("staff_id as total");
  if (excludeSystem) {
    query = query.whereNot({ staff_id: SYSTEM_STAFF_ID });
    countQuery = countQuery.whereNot({ staff_id: SYSTEM_STAFF_ID });
  }
  const rows = await query.limit(limit).offset(offset);
  const totalResult = await countQuery;
  const total = totalResult[0]?.["total"] ?? 0;
  return { rows, total: Number(total) };
}

export async function updateStaff(
  staff_id: number,
  data: Partial<Pick<Staff, "name" | "birth_date" | "start_time">>,
) {
  return db("staff").where({ staff_id }).update(data);
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export async function findAllRoles() {
  return db("role").select("role_id", "name").orderBy("role_id");
}

export async function findRoleById(role_id: number) {
  return db("role").where({ role_id }).first();
}

export async function createRole(name: string): Promise<number> {
  const [row] = await db("role").insert({ name }).returning("role_id");
  return row.role_id;
}

// ─── Role Assignment (table name typo kept as-is: role_assigment) ─────────────

export async function findStaffRoles(staff_id: number) {
  return db("role_assigment as ra")
    .join("role as r", "ra.role_id", "r.role_id")
    .where("ra.staff_id", staff_id)
    .select("r.role_id", "r.name");
}

export async function assignRole(staff_id: number, role_id: number) {
  return db("role_assigment")
    .insert({ staff_id, role_id })
    .onConflict(["staff_id", "role_id"])
    .ignore();
}

export async function revokeRole(staff_id: number, role_id: number) {
  return db("role_assigment").where({ staff_id, role_id }).delete();
}

export async function staffHasRole(
  staff_id: number,
  role_name: string,
): Promise<boolean> {
  const row = await db("role_assigment as ra")
    .join("role as r", "ra.role_id", "r.role_id")
    .where({ "ra.staff_id": staff_id })
    .whereRaw("LOWER(r.name) = LOWER(?)", [role_name])
    .first();
  return !!row;
}
