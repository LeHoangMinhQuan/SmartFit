import db from "../config/db.js";

export async function findImportHistory(filters: {
  staff_id?: number;
  supplier_id?: number;
  product_id?: number;
  page?: number;
  limit?: number;
}) {
  const { staff_id, supplier_id, product_id, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  let query = db("import_history as ih")
    .join("staff as stf", "ih.staff_id", "stf.staff_id")
    .join("supplier as sup", "ih.supplier_id", "sup.supplier_id")
    .join("product as p", "ih.product_id", "p.product_id")
    .join("product_variant as pv", function () {
      this.on("ih.product_id", "pv.product_id").andOn(
        "ih.variant_id",
        "pv.variant_id",
      );
    })
    .join("store as str", "ih.store_id", "str.store_id")
    .select(
      "ih.*",
      "stf.name as staff_name",
      "sup.name as supplier_name",
      "p.name as product_name",
      "pv.name as variant_name",
      "str.name as store_name",
    )
    .orderBy("ih.import_date", "desc");

  if (staff_id) query = query.where("ih.staff_id", staff_id);
  if (supplier_id) query = query.where("ih.supplier_id", supplier_id);
  if (product_id) query = query.where("ih.product_id", product_id);

  const rows = await query.limit(limit).offset(offset);

  let countQ = db("import_history");
  if (staff_id) countQ = countQ.where({ staff_id });
  if (supplier_id) countQ = countQ.where({ supplier_id });
  if (product_id) countQ = countQ.where({ product_id });
  const totalResult = await countQ.count("staff_id as total");
  const total = totalResult[0]?.["total"] ?? 0;

  return { rows, total: Number(total) };
}

export async function createImportRecord(
  data: {
    staff_id: number;
    supplier_id: number;
    product_id: number;
    variant_id: number;
    store_id: number;
    quantity: number;
    import_date?: string;
  },
  trx = db,
) {
  return trx("import_history").insert({
    staff_id: data.staff_id,
    supplier_id: data.supplier_id,
    product_id: data.product_id,
    variant_id: data.variant_id,
    store_id: data.store_id,
    quantity: data.quantity,
    ...(data.import_date ? { import_date: data.import_date } : {}),
  });
}
