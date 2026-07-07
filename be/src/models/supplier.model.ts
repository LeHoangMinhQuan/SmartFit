import db from "../config/db.js";

export async function findAllSuppliers() {
  return db("supplier").select("*").orderBy("name", "asc");
}

export async function findSupplierById(supplier_id: number) {
  return db("supplier").where({ supplier_id }).first();
}

export async function createSupplier(name: string) {
  const [row] = await db("supplier").insert({ name }).returning("supplier_id");
  return row.supplier_id;
}

export async function updateSupplier(supplier_id: number, name: string) {
  return db("supplier").where({ supplier_id }).update({ name });
}

export async function deleteSupplier(supplier_id: number) {
  return db("supplier").where({ supplier_id }).del();
}
