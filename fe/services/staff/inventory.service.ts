import api from "../../lib/axios";

interface InventoryRow {
  product_id: number;
  variant_id: number;
  store_id: number;
  quantity: number;
}

interface ImportHistoryRow {
  staff_id: number;
  supplier_id: number;
  product_id: number;
  variant_id: number;
  import_date: string;
}

interface RecordImportBody {
  supplier_id: number;
  product_id: number;
  variant_id: number;
  import_date?: string; // omit to let server default to NOW()
}

export const inventoryService = {
  getInventory: (params?: { store_id?: number; quantity?: number }) =>
    api.get<InventoryRow[]>("/inventory", { params }).then((r) => r.data),

  // Manual stock adjustment — body carries the new absolute quantity
  adjustQuantity: (
    product_id: number,
    variant_id: number,
    store_id: number,
    body: { quantity: number },
  ) =>
    api
      .patch(`/inventory/${product_id}/${variant_id}/${store_id}`, body)
      .then((r) => r.data),

  getImportHistory: () =>
    api
      .get<ImportHistoryRow[]>("/inventory/import-history")
      .then((r) => r.data),

  // import_history has no quantity column — it's a record that a shipment
  // arrived, not an authoritative stock count. Composite PK of all 5 columns.
  recordImport: (body: RecordImportBody) =>
    api.post("/inventory/import", body).then((r) => r.data),
};
