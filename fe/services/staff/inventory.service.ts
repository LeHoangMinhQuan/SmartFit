import staffApi from "../../lib/staffAxios";

// Inventory endpoints respond with { data, meta } instead of the
// payload directly — unwrap r.data.data.
interface ApiResponse<T> {
  data: T;
  meta: { total: number };
}

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
    staffApi
      .get<ApiResponse<InventoryRow[]>>("/admin/inventory", { params })
      .then((r) => r.data.data),

  adjustQuantity: (
    product_id: number,
    variant_id: number,
    store_id: number,
    body: { quantity: number },
  ) =>
    staffApi
      .patch<
        ApiResponse<InventoryRow>
      >(`/admin/inventory/${product_id}/${variant_id}/${store_id}`, body)
      .then((r) => r.data.data),

  getImportHistory: () =>
    staffApi
      .get<ApiResponse<ImportHistoryRow[]>>("/admin/inventory/import-history")
      .then((r) => r.data.data),

  recordImport: (body: RecordImportBody) =>
    staffApi
      .post<ApiResponse<unknown>>("/admin/inventory/import", body)
      .then((r) => r.data.data),
};
