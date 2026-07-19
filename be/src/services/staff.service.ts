import bcrypt from "bcryptjs";
import {ApiError} from "../utils/ApiError.js";
import * as StaffModel from "../models/staff.model.js";
import * as StoreModel from "../models/store.model.js";

// ─── Staff Auth ───────────────────────────────────────────────────────────────

export async function findStaffByIdForAuth(staff_id: number) {
  return StaffModel.findStaffById(staff_id);
}

export async function verifyStaffPassword(staff_id: number, password: string) {
  const staff = await StaffModel.findStaffById(staff_id);
  if (!staff) throw new ApiError(401, "Invalid credentials");
  const valid = await bcrypt.compare(password, staff.password_hash);
  if (!valid) throw new ApiError(401, "Invalid credentials");
  return staff;
}

// ─── Staff CRUD ───────────────────────────────────────────────────────────────

export async function listStaff(page?: number, limit?: number) {
  return StaffModel.findAllStaff(page, limit);
}

export async function getStaff(staff_id: number) {
  const staff = await StaffModel.findStaffById(staff_id);
  if (!staff) throw new ApiError(404, "Staff member not found");
  const roles = await StaffModel.findStaffRoles(staff_id);
  return { ...staff, roles };
}

export async function createStaff(data: {
  name: string;
  birth_date?: string;
  start_time?: string;
  password: string;
}) {
  console.log("Creating staff with data:", data);
  const password_hash = await bcrypt.hash(data.password, 12);
  const staff_id = await StaffModel.createStaff({
    name: data.name,
    birth_date: data.birth_date,
    start_time: data.start_time,
    password_hash,
  });
  console.log("Created staff with ID:", staff_id);
  return { staff_id };
}

export async function updateStaff(
  staff_id: number,
  data: Partial<{ name: string; birth_date: string; start_time: string }>,
) {
  const existing = await StaffModel.findStaffById(staff_id);
  if (!existing) throw new ApiError(404, "Staff member not found");
  await StaffModel.updateStaff(staff_id, data);
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export async function listRoles() {
  return StaffModel.findAllRoles();
}

export async function createRole(name: string) {
  const role_id = await StaffModel.createRole(name);
  return { role_id };
}

export async function assignRole(staff_id: number, role_id: number) {
  const [staff, role] = await Promise.all([
    StaffModel.findStaffById(staff_id),
    StaffModel.findRoleById(role_id),
  ]);
  if (!staff) throw new ApiError(404, "Staff member not found");
  if (!role) throw new ApiError(404, "Role not found");
  await StaffModel.assignRole(staff_id, role_id);
}

export async function removeRole(staff_id: number, role_id: number) {
  await StaffModel.revokeRole(staff_id, role_id);
}

// ─── Store / Working History ──────────────────────────────────────────────────

export async function getStaffHistory(staff_id: number) {
  return StoreModel.findWorkingHistory(staff_id);
}

export async function getCurrentStoreAssignment(staff_id: number) {
  return StoreModel.findCurrentStoreAssignment(staff_id);
}

export async function transferStaff(
  staff_id: number,
  store_id: number,
  start_date?: string,
) {
  const [staff, store] = await Promise.all([
    StaffModel.findStaffById(staff_id),
    StoreModel.findStoreById(store_id),
  ]);
  if (!staff) throw new ApiError(404, "Staff member not found");
  if (!store) throw new ApiError(404, "Store not found");
  // transferStaff closes current open row + inserts new — atomic transaction
  await StoreModel.transferStaff(staff_id, store_id, start_date);
}

// ─── Stores ───────────────────────────────────────────────────────────────────

export async function listStores() {
  return StoreModel.findAllStores();
}

export async function getStore(store_id: number) {
  const store = await StoreModel.findStoreById(store_id);
  if (!store) throw new ApiError(404, "Store not found");
  const currentStaff = await StoreModel.findStaffAtStore(store_id);
  return { ...store, staff: currentStaff };
}

export async function createStore(data: { name: string; address: string }) {
  const store_id = await StoreModel.createStore(data);
  return { store_id };
}

export async function updateStore(
  store_id: number,
  data: Partial<{ name: string; address: string }>,
) {
  const existing = await StoreModel.findStoreById(store_id);
  if (!existing) throw new ApiError(404, "Store not found");
  await StoreModel.updateStore(store_id, data);
}
