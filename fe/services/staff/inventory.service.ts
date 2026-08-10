import staffApi from "../../lib/staffAxios";
import type { PaginationMeta } from "../../interfaces";

interface ApiResponse<T> {
  data: T;
  meta: { total: number };
}

interface InventoryRow {
  product_id: number;
  product_name: string;
  variant_id: number;
  variant_name: string;
  store_id: number;
  store_name: string;
  quantity: number;
}

interface ImportHistoryRow {
  staff_id: number;
  staff_name: string;
  supplier_id: number;
  supplier_name: string;
  product_id: number;
  product_name: string;
  variant_id: number;
  variant_name: string;
  store_id: number;
  store_name: string;
  quantity: number;
  import_date: string;
}

interface RecordImportBody {
  supplier_id: number;
  product_id: number;
  variant_id: number;
  store_id: number;
  quantity: number;
  import_date?: string;
}

export const inventoryService = {
  // BUG FIX: was `getInventory: (params?: { store_id?: number; quantity?: number })`
  // — sent a `quantity` query param that the backend's filter schema
  // never recognized (the actual filter is `min_quantity`), so the min-
  // quantity filter silently did nothing whenever the caller tried to use
  // it. Also dropped `page`/`limit` entirely (always fetched the default
  // page-1/limit-50 window with no way to move) and unwrapped straight to
  // `r.data.data`, discarding `meta` — so there was nothing to paginate
  // with even after the backend started returning a proper meta object
  // (see admin.controller.ts's listInventory). Renamed the param, added
  // page/limit, and now returns the full `{ data, meta }` envelope like
  // getImportHistory already does below.
  getInventory: (params?: {
    store_id?: number;
    min_quantity?: number;
    page?: number;
    limit?: number;
  }) =>
    staffApi
      .get<{
        data: InventoryRow[];
        meta: PaginationMeta;
      }>("/admin/inventory", { params })
      .then((r) => r.data),

  adjustQuantity: (
    product_id: number,
    variant_id: number,
    store_id: number,
    body: { quantity: number },
  ) =>
    staffApi
      .patch<
        ApiResponse<{ message: string }>
      >(`/admin/inventory/${product_id}/${variant_id}/${store_id}`, body)
      .then((r) => r.data.data),

  getImportHistory: (params?: {
    page?: number;
    limit?: number;
    staff_id?: number;
    supplier_id?: number;
    product_id?: number;
  }) =>
    staffApi
      .get<{
        data: ImportHistoryRow[];
        meta: PaginationMeta;
      }>("/admin/inventory/import-history", { params })
      .then((r) => r.data),

  recordImport: (body: RecordImportBody) =>
    staffApi
      .post<ApiResponse<unknown>>("/admin/inventory/import", body)
      .then((r) => r.data.data),
};
