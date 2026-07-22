import { ApiError } from "../utils/ApiError.js";
import * as SupplierModel from "../models/supplier.model.js";

export async function listSuppliers() {
  return SupplierModel.findAllSuppliers();
}

export async function getSupplier(supplier_id: number) {
  const supplier = await SupplierModel.findSupplierById(supplier_id);
  if (!supplier) throw new ApiError(404, "Supplier not found");
  return supplier;
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
