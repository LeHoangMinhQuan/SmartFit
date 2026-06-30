import db from "../config/db.js";

// ─── Global Attribute Catalog ─────────────────────────────────────────────────

export async function findAllAttributes() {
  return db("attribute").select("*").orderBy("name");
}

export async function findAttributeById(attribute_id: number) {
  return db("attribute").where({ attribute_id }).first();
}

export async function findAttributeByName(name: string) {
  return db("attribute").whereRaw("LOWER(name) = LOWER(?)", [name]).first();
}

export async function createAttribute(name: string): Promise<number> {
  const [row] = await db("attribute")
    .insert({ name })
    .returning("attribute_id");
  return row.attribute_id;
}

// ─── Product Attribute (per-variant) ─────────────────────────────────────────

export async function findProductAttribute(
  attribute_id: number,
  product_id: number,
  variant_id: number,
) {
  return db("product_attribute")
    .where({ attribute_id, product_id, variant_id })
    .first();
}

export async function attachAttributeToVariant(data: {
  attribute_id: number;
  product_id: number;
  variant_id: number;
  value: string;
}) {
  return db("product_attribute").insert(data);
}

export async function updateAttributeValue(
  attribute_id: number,
  product_id: number,
  variant_id: number,
  value: string,
) {
  return db("product_attribute")
    .where({ attribute_id, product_id, variant_id })
    .update({ value });
}

export async function deleteAttributeFromVariant(
  attribute_id: number,
  product_id: number,
  variant_id: number,
) {
  return db("product_attribute")
    .where({ attribute_id, product_id, variant_id })
    .delete();
}

export async function findAttributesByVariant(
  product_id: number,
  variant_id: number,
) {
  return db("product_attribute as pa")
    .join("attribute as a", "pa.attribute_id", "a.attribute_id")
    .where({ "pa.product_id": product_id, "pa.variant_id": variant_id })
    .select("pa.attribute_id", "a.name", "pa.value");
}
