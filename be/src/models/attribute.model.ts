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

/**
 * Distinct attribute values across ALL variants of a product (not scoped to
 * one variant). Used by the chatbot's embedding content builder to answer
 * "what sizes/colors does this come in" from the product-level embedding —
 * see ecommerce-api-plan.md §11.
 */
export async function findAttributeValuesByProduct(
  product_id: number,
): Promise<string[]> {
  const rows = await db("product_attribute")
    .where({ product_id })
    .distinct("value")
    .orderBy("value");
  return rows.map((r: { value: string }) => r.value);
}
