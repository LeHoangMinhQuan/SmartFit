import db from "../config/db.js";

// ─── Store ────────────────────────────────────────────────────────────────────

export interface Store {
  store_id?: number; // IDENTITY
  name: string; // VARCHAR(40)
  address: string; // VARCHAR(20)
}

export async function createStore(
  data: Omit<Store, "store_id">,
): Promise<number> {
  const [row] = await db("store").insert(data).returning("store_id");
  return row.store_id;
}

export async function findAllStores() {
  return db("store").select("*").orderBy("store_id");
}

export async function findStoreById(store_id: number) {
  return db("store").where({ store_id }).first();
}

export async function updateStore(
  store_id: number,
  data: Partial<Omit<Store, "store_id">>,
) {
  return db("store").where({ store_id }).update(data);
}

// ─── Staff Working History (append-only audit log) ────────────────────────────

export async function findCurrentStoreAssignment(staff_id: number) {
  return db("staff_working_history")
    .where({ staff_id })
    .whereNull("end_date")
    .orderBy("start_date", "desc")
    .first();
}

export async function findWorkingHistory(staff_id: number) {
  return db("staff_working_history as swh")
    .join("store as s", "swh.store_id", "s.store_id")
    .where("swh.staff_id", staff_id)
    .select("swh.*", "s.name as store_name")
    .orderBy("swh.start_date", "desc");
}

/**
 * Transfer staff to a new store.
 * Runs in a transaction:
 *  1. Close the current open row (set end_date)
 *  2. Insert a new history row
 * Never updates store_id in place — history must be preserved.
 */
export async function transferStaff(
  staff_id: number,
  store_id: number,
  start_date?: string,
) {
  return db.transaction(async (trx) => {
    const effectiveDate = start_date ?? new Date().toISOString();

    // Close current open assignment
    await trx("staff_working_history")
      .where({ staff_id })
      .whereNull("end_date")
      .update({ end_date: effectiveDate });

    // Insert new assignment
    const payload: any = { staff_id, store_id };
    if (start_date) payload.start_date = start_date;
    // If no start_date: DB DEFAULT NOW() applies

    await trx("staff_working_history").insert(payload);
  });
}

export async function findStaffAtStore(store_id: number) {
  return db("staff_working_history as swh")
    .join("staff as s", "swh.staff_id", "s.staff_id")
    .where("swh.store_id", store_id)
    .whereNull("swh.end_date")
    .select("s.staff_id", "s.name", "swh.start_date");
}
