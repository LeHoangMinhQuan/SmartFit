import bcrypt from "bcryptjs";
import db from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import * as AddressModel from "../models/address.model.js";
import * as WishlistModel from "../models/wishlist.model.js";

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(user_id: number) {
  const user = await db('"USER"')
    .where({ user_id })
    .select(
      "user_id",
      "username",
      "email",
      "phone",
      "address",
      "avatar_url",
      "created_at",
    )
    .first();
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

export async function updateProfile(
  user_id: number,
  data: {
    username?: string;
    phone?: string;
    address?: string;
    avatar_url?: string;
  },
) {
  await db('"USER"').where({ user_id }).update(data);
  return getProfile(user_id);
}

export async function changePassword(
  user_id: number,
  old_password: string,
  new_password: string,
) {
  const user = await db('"USER"').where({ user_id }).first();
  if (!user) throw new ApiError(404, "User not found");

  const valid = await bcrypt.compare(old_password, user.password_hash);
  if (!valid) throw new ApiError(401, "Current password is incorrect");

  const password_hash = await bcrypt.hash(new_password, 12);
  await db('"USER"').where({ user_id }).update({ password_hash });
}

export async function deleteAccount(user_id: number) {
  // Soft or hard depending on FK constraints — using hard delete; FK cascade handles children
  await db('"USER"').where({ user_id }).delete();
}

// ─── Addresses ────────────────────────────────────────────────────────────────

export async function getAddresses(user_id: number) {
  return AddressModel.findUserAddresses(user_id);
}

export async function addAddress(
  user_id: number,
  data: {
    address_line: string;
    province_id: number;
    district_id: number;
    ward_id: number;
    label?: string;
  },
) {
  const address_id = await AddressModel.createAddress({
    address_line: data.address_line,
    province_id: data.province_id,
    district_id: data.district_id,
    ward_id: data.ward_id,
  });
  await AddressModel.addUserAddress(address_id, user_id, data.label);

  // Auto-set as default if it's the first address
  const all = await AddressModel.findUserAddresses(user_id);
  if (all.length === 1) {
    await AddressModel.setDefaultAddress(address_id, user_id);
  }

  return { address_id };
}

export async function updateAddress(
  user_id: number,
  address_id: number,
  data: {
    address_line?: string;
    province_id?: number;
    district_id?: number;
    ward_id?: number;
    label?: string;
  },
) {
  const existing = await AddressModel.findAddressByIdAndUser(
    address_id,
    user_id,
  );
  if (!existing) throw new ApiError(404, "Address not found");

  const addressFields: any = {};
  if (data.address_line) addressFields.address_line = data.address_line;
  if (data.province_id) addressFields.province_id = data.province_id;
  if (data.district_id) addressFields.district_id = data.district_id;
  if (data.ward_id) addressFields.ward_id = data.ward_id;

  if (Object.keys(addressFields).length) {
    await AddressModel.updateAddress(address_id, addressFields);
  }
  if (data.label !== undefined) {
    await db("user_address")
      .where({ address_id, user_id })
      .update({ label: data.label });
  }
}

export async function removeAddress(user_id: number, address_id: number) {
  const existing = await AddressModel.findAddressByIdAndUser(
    address_id,
    user_id,
  );
  if (!existing) throw new ApiError(404, "Address not found");
  await AddressModel.removeUserAddress(address_id, user_id);
  // Note: orphaned address rows are cleaned up by FK cascade or a periodic job
}

export async function setDefaultAddress(user_id: number, address_id: number) {
  const existing = await AddressModel.findAddressByIdAndUser(
    address_id,
    user_id,
  );
  if (!existing) throw new ApiError(404, "Address not found");
  await AddressModel.setDefaultAddress(address_id, user_id);
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export async function getWishlist(user_id: number) {
  return WishlistModel.findActiveWishlist(user_id);
}

export async function addToWishlist(
  user_id: number,
  product_id: number,
  variant_id: number,
) {
  await WishlistModel.upsertWishlistItem(user_id, product_id, variant_id);
}

export async function removeFromWishlist(
  user_id: number,
  product_id: number,
  variant_id: number,
) {
  await WishlistModel.softDeleteWishlistItem(user_id, product_id, variant_id);
}
