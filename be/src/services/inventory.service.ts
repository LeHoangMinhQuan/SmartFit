import { ApiError } from "../utils/ApiError.js";
import * as StoreProductModel from "../models/store_product.model.js";
import * as ImportModel from "../models/import_history.model.js";
import * as SupplierModel from "../models/supplier.model.js";
import * as ProductModel from "../models/product/product.model.js";
import * as StoreModel from "../models/store.model.js"; // for store existence check — adjust path if different
import db from "../config/db.js";

export async function listInventory(filters: {
  store_id?: number;
  min_quantity?: number;
  page?: number;
  limit?: number;
}) {
  return StoreProductModel.findInventory(filters);
}

export async function adjustQuantity(
  product_id: number,
  variant_id: number,
  store_id: number,
  quantity: number,
) {
  const row = await StoreProductModel.findStoreProduct(
    product_id,
    variant_id,
    store_id,
  );
  if (!row) throw new ApiError(404, "Inventory record not found");
  await StoreProductModel.upsertStoreProduct(
    product_id,
    variant_id,
    store_id,
    quantity,
  );
}

export async function getImportHistory(filters: {
  staff_id?: number;
  supplier_id?: number;
  product_id?: number;
  page?: number;
  limit?: number;
}) {
  return ImportModel.findImportHistory(filters);
}

export async function recordImport(data: {
  staff_id: number;
  supplier_id: number;
  product_id: number;
  variant_id: number;
  store_id: number;
  quantity: number;
  import_date?: string;
}) {
  const [supplier, product, variant, store] = await Promise.all([
    SupplierModel.findSupplierById(data.supplier_id),
    ProductModel.findProductById(data.product_id),
    ProductModel.findVariant(data.product_id, data.variant_id),
    StoreModel.findStoreById(data.store_id), // confirm this function name against store.model.ts
  ]);
  if (!supplier) throw new ApiError(404, "Supplier not found");
  if (!product) throw new ApiError(404, "Product not found");
  if (!variant) throw new ApiError(404, "Product variant not found");
  if (!store) throw new ApiError(404, "Store not found");

  await db.transaction(async (trx) => {
    await ImportModel.createImportRecord(data, trx);
    await StoreProductModel.receiveStock(
      data.product_id,
      data.variant_id,
      data.store_id,
      data.quantity,
      trx,
    );
  });
}

export async function listSuppliers() {
  return SupplierModel.findAllSuppliers();
}

export async function createSupplier(name: string) {
  const supplier_id = await SupplierModel.createSupplier(name);
  return { supplier_id };
}

export async function updateSupplier(supplier_id: number, name: string) {
  const existing = await SupplierModel.findSupplierById(supplier_id);
  if (!existing) throw new ApiError(404, "Supplier not found");
  await SupplierModel.updateSupplier(supplier_id, name);
}

export async function deleteSupplier(supplier_id: number) {
  const existing = await SupplierModel.findSupplierById(supplier_id);
  if (!existing) throw new ApiError(404, "Supplier not found");
  await SupplierModel.deleteSupplier(supplier_id);
}
